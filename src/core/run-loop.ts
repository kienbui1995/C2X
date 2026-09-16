import {
  buildBrainstormPastePrompt,
  hasControlTag,
  parseBrainstormReply,
  synthesizeBrainstormNotes,
} from "@/core/brainstorm";
import { planToBriefs } from "@/core/brief";
import { hasProviderKey } from "@/core/config";
import { collectGitMetadata } from "@/core/git-meta";
import { persistWorkspaceBriefs } from "@/core/harness";
import { packWorkspace } from "@/core/packer";
import { applyIssuesToPlan } from "@/core/packets";
import {
  PLANNER_SYSTEM_PROMPT,
  buildPlanUserPrompt,
  buildReviewPastePrompt,
  buildReviewUserPrompt,
  buildWebPastePrompt,
  extractControlBlock,
  mockPlanFromPack,
  mockReview,
  parsePlannerOutput,
} from "@/core/planner";
import { persistWikiOutbox } from "@/core/wiki";
import { isPastePlanner } from "@/core/providers/catalog";
import { applyImportedReview } from "@/core/review-import";
import { applyExecutionRecord } from "@/core/records";
import { completePlanner } from "@/core/providers/complete";
import { resolvePlanner } from "@/core/providers/router";
import {
  CONTROL_BUDGET_MAX,
  assertControlBudget,
  messageToReview,
  parseControlMessage,
} from "@/core/protocol";
import { estimateSavings } from "@/core/savings";
import {
  applyPlan,
  blockAtIterationLimit,
  completeAllHarnessRuns,
  completeHarnessRun,
  createSession,
  mergedExecutionReport,
  reusedPack,
  touchSession,
} from "@/core/session";
import { getSession, loadConfig, upsertSession } from "@/core/store";
import { loadC2xIgnore, loadWorkspaceFiles, resolveWorkspaceRoot } from "@/core/workspace";
import {
  isHarnessId,
  resolveBrainTeam,
  resolveSessionBrain,
  type ExecutionExitStatus,
  type HarnessId,
  type PlannerChoice,
  type SessionBrain,
  type SessionRecord,
  type WorkspaceSource,
} from "@/core/types";

async function persistPlanDrops(session: SessionRecord, cwd?: string): Promise<SessionRecord> {
  await persistWorkspaceBriefs(session, cwd);
  await persistWikiOutbox(session, cwd);
  return session;
}

export async function runPlan(input: {
  goal: string;
  plannerChoice: PlannerChoice;
  harness?: HarnessId;
  harnessTeam?: readonly HarnessId[];
  budgetTokens: number;
  workspaceSource: WorkspaceSource;
  allowFallback?: boolean;
  cwd?: string;
  brainstorm?: boolean;
  brain?: SessionBrain;
}): Promise<SessionRecord> {
  const config = await loadConfig();
  const planner = resolvePlanner({
    choice: input.plannerChoice,
    config,
    hasKey: (id) => hasProviderKey(config, id),
  });
  const brain = resolveSessionBrain(input.brain);
  const harnessTeam = resolveBrainTeam({
    brain,
    harnessTeam: input.harnessTeam,
    harness: input.harness,
    fallbackTeam: config.defaultHarnessTeam,
  });
  const files = await loadWorkspaceFiles(input.workspaceSource, undefined, input.cwd);
  const extraIgnore =
    input.workspaceSource === "repo"
      ? await loadC2xIgnore(resolveWorkspaceRoot({ cwd: input.cwd, env: process.env }))
      : [];
  const pack = packWorkspace({
    goal: input.goal,
    files,
    budgetTokens: input.budgetTokens,
    extraIgnore,
  });
  let session = createSession({
    goal: input.goal,
    planner,
    plannerChoice: input.plannerChoice,
    harness: harnessTeam[0],
    harnessTeam,
    budgetTokens: input.budgetTokens,
    workspaceSource: input.workspaceSource,
    brain,
  });
  session = { ...session, pack };

  if (input.brainstorm && isPastePlanner(planner)) {
    const pastePrompt = buildBrainstormPastePrompt(pack.goal, session.id);
    session = touchSession(
      {
        ...session,
        pastePrompt,
        brainstormPending: true,
        brainstormNotes: null,
        savings: estimateSavings({ pack, brief: null, planner }),
      },
      {
        state: "INIT",
        actor: "planner",
        note: `${planner}: first paste is nghiệp vụ Q&A (not PLAN). Store notes, then PLAN.`,
      },
    );
    return persistPlanDrops(await upsertSession(session), input.cwd);
  }

  if (input.brainstorm) {
    session = {
      ...session,
      brainstormNotes: synthesizeBrainstormNotes(input.goal),
      brainstormPending: false,
    };
  }

  if (isPastePlanner(planner)) {
    const pastePrompt = buildWebPastePrompt(
      pack,
      session.id,
      harnessTeam,
      session.brainstormNotes,
    );
    session = touchSession(
      {
        ...session,
        pastePrompt,
        savings: estimateSavings({ pack, brief: null, planner }),
      },
      {
        state: "INIT",
        actor: "planner",
        note: `${planner}: copy the packed prompt into that web chat, paste the [C2X] PLAN back. Team ${harnessTeam.join(" + ")} stays on execute only.`,
      },
    );
    return persistPlanDrops(await upsertSession(session), input.cwd);
  }

  const fallback = mockPlanFromPack(pack, session.id, harnessTeam);
  let usedFallback = planner === "mock";
  let fallbackReason: string | null =
    planner === "mock" ? "Mock planner — no network call." : null;
  let plan = fallback;

  if (planner !== "mock") {
    const completion = await completePlanner({
      provider: planner,
      config,
      allowFallback: input.allowFallback,
      messages: [
        { role: "system", content: PLANNER_SYSTEM_PROMPT },
        {
          role: "user",
          content: buildPlanUserPrompt(pack, session.id, harnessTeam, session.brainstormNotes),
        },
      ],
    });
    usedFallback = completion.usedFallback;
    fallbackReason = completion.fallbackReason;
    if (completion.text.trim()) {
      plan = parsePlannerOutput(completion.text, fallback);
    } else if (completion.usedFallback) {
      plan = fallback;
    }
  }

  const briefs = planToBriefs(plan);
  session = applyPlan(
    touchSession(session, {
      state: "PLAN",
      actor: usedFallback ? "system" : "planner",
      note: usedFallback
        ? `Fell back to mock planner${fallbackReason ? `: ${fallbackReason}` : "."}`
        : `Planner ${planner} returned a PLAN with ${plan.packets.length} work packets.`,
    }),
    {
      plan,
      briefs,
      brief: briefs[0] ?? null,
      usedFallback,
      fallbackReason,
      planner,
      savings: estimateSavings({ pack, brief: briefs[0] ?? null, briefs, planner }),
    },
  );
  return persistPlanDrops(await upsertSession(session), input.cwd);
}

export async function importPlan(input: {
  sessionId?: string;
  raw: string;
}): Promise<SessionRecord> {
  const block = extractControlBlock(input.raw);
  assertControlBudget(block, CONTROL_BUDGET_MAX);
  const message = parseControlMessage(block);
  if (message.state !== "PLAN") {
    throw new Error(`Imported message must be PLAN (got ${message.state}).`);
  }
  const existing = input.sessionId ? await getSession(input.sessionId) : null;
  if (!existing) {
    throw new Error("Import needs an existing packed session. Run plan first.");
  }
  const pack = reusedPack(existing);
  if (existing.plan && existing.plan.iteration >= existing.iterationLimit) {
    return persistPlanDrops(await upsertSession(blockAtIterationLimit(existing)));
  }
  const fallback = mockPlanFromPack(pack, existing.id, existing.harnessTeam);
  const plan = parsePlannerOutput(input.raw, fallback);
  if (plan.iteration >= existing.iterationLimit && existing.plan) {
    return persistPlanDrops(await upsertSession(blockAtIterationLimit(existing)));
  }
  const briefs = planToBriefs(plan);
  const next = applyPlan(
    touchSession(existing, {
      state: "PLAN",
      actor: "user",
      note: "Imported [C2X] PLAN from a web chat or another planner.",
    }),
    {
      plan,
      briefs,
      brief: briefs[0] ?? null,
      pastePrompt: existing.pastePrompt,
      savings: estimateSavings({
        pack,
        brief: briefs[0] ?? null,
        briefs,
        planner: existing.planner,
      }),
    },
  );
  return persistPlanDrops(await upsertSession(next));
}

async function importBrainstormNotes(
  existing: SessionRecord,
  raw: string,
): Promise<SessionRecord> {
  const notes = parseBrainstormReply(raw);
  const pack = reusedPack(existing);
  const pastePrompt = buildWebPastePrompt(
    pack,
    existing.id,
    existing.harnessTeam,
    notes,
  );
  const next = touchSession(
    {
      ...existing,
      brainstormNotes: notes,
      brainstormPending: false,
      pastePrompt,
    },
    {
      state: "INIT",
      actor: "user",
      note: "Stored brainstorm notes. Next paste is the [C2X] PLAN.",
    },
  );
  return persistPlanDrops(await upsertSession(next));
}

export async function importControlMessage(input: {
  sessionId?: string;
  raw: string;
}): Promise<SessionRecord> {
  const existing = input.sessionId ? await getSession(input.sessionId) : null;
  if (existing?.brainstormPending && !hasControlTag(input.raw)) {
    return importBrainstormNotes(existing, input.raw);
  }
  const block = extractControlBlock(input.raw);
  assertControlBudget(block, CONTROL_BUDGET_MAX);
  const message = parseControlMessage(block);
  if (
    existing &&
    (existing.state === "EXECUTED" || existing.state === "REVIEW") &&
    (message.state === "DONE" || message.state === "BLOCKED" || message.state === "PLAN")
  ) {
    const next = await upsertSession(applyImportedReview(existing, input.raw));
    return persistPlanDrops(next);
  }
  return importPlan(input);
}

export async function runExecute(input: {
  sessionId: string;
  harness?: HarnessId;
  all?: boolean;
  changedFiles?: string[];
  tests?: string;
}): Promise<SessionRecord> {
  const existing = await getSession(input.sessionId);
  if (!existing?.plan) {
    throw new Error("Execute needs a session that already has a PLAN.");
  }
  if (input.all) {
    return upsertSession(
      completeAllHarnessRuns(existing, {
        changedFiles: input.changedFiles,
        tests: input.tests ?? "simulated pass",
      }),
    );
  }
  if (!input.harness || !isHarnessId(input.harness)) {
    throw new Error("harness or all is required");
  }
  const packet = existing.plan.packets.find((item) => item.owner === input.harness);
  return upsertSession(
    completeHarnessRun(existing, input.harness, {
      changedFiles: input.changedFiles?.length ? input.changedFiles : packet?.files ?? [],
      tests: input.tests ?? "simulated pass",
    }),
  );
}

export async function runRecord(input: {
  sessionId: string;
  owner: HarnessId;
  changedFiles?: string[];
  tests?: string;
  exitStatus?: ExecutionExitStatus;
  /** CLI `--cwd` only. HTTP callers omit this. */
  cwd?: string;
}): Promise<SessionRecord> {
  const existing = await getSession(input.sessionId);
  if (!existing) {
    throw new Error("Record needs an existing session.");
  }
  if (!existing.harnessTeam.includes(input.owner)) {
    throw new Error(`${input.owner} is not on this session's harness team.`);
  }
  const root = resolveWorkspaceRoot({ cwd: input.cwd, env: process.env });
  const provided = input.changedFiles?.filter(Boolean) ?? [];
  const meta =
    provided.length > 0
      ? { changedFiles: provided, diffStat: "", isGit: true }
      : await collectGitMetadata(root);
  let changedFiles = meta.changedFiles;
  if (changedFiles.length === 0 && !meta.isGit) {
    const packet = existing.plan?.packets.find((item) => item.owner === input.owner);
    changedFiles = packet?.files ?? [];
  }
  const teammateFiles = new Set(
    (existing.plan?.packets ?? [])
      .filter((packet) => packet.owner !== input.owner)
      .flatMap((packet) => packet.files),
  );
  changedFiles = changedFiles.filter((file) => !teammateFiles.has(file));
  const exitStatus = input.exitStatus ?? (meta.isGit ? "ok" : "unknown");
  const tests =
    input.tests?.trim() ||
    (exitStatus === "fail" ? "failed" : meta.isGit ? "recorded" : "unknown");
  return upsertSession(
    applyExecutionRecord(existing, {
      taskId: existing.id,
      iteration: existing.plan?.iteration ?? 1,
      owner: input.owner,
      changedFiles,
      tests,
      exitStatus,
      recordedAt: new Date().toISOString(),
      diffStat: meta.diffStat,
    }),
  );
}

export async function runReview(input: {
  sessionId: string;
  changedFiles: string[];
  tests: string;
  importedRaw?: string;
}): Promise<SessionRecord> {
  const existing = await getSession(input.sessionId);
  if (!existing?.pack || !existing.plan) {
    throw new Error("Review needs a session that already has a PLAN.");
  }
  const config = await loadConfig();
  let current = existing;
  if (!current.harnessRuns.every((run) => run.state === "executed")) {
    current = completeAllHarnessRuns(current, {
      changedFiles: input.changedFiles,
      tests: input.tests,
    });
  }
  const merged = mergedExecutionReport(current);
  const changedFiles = input.changedFiles.length > 0 ? input.changedFiles : merged.changedFiles;
  const tests = input.tests.trim() && input.tests !== "not run" ? input.tests : merged.tests;
  const executed =
    current.state === "EXECUTED"
      ? current
      : touchSession(current, {
          state: "EXECUTED",
          actor: "system",
          note: `Merged ${current.harnessTeam.join(" + ")} execution metadata.`,
        });
  const reviewing = touchSession(executed, {
    state: "REVIEW",
    actor: "planner",
    note: "Planner is reviewing the merged execution report.",
  });

  if (isPastePlanner(existing.planner) && !input.importedRaw) {
    const diffStat = existing.records
      .map((item) => `${item.owner}: ${item.diffStat}`)
      .filter((line) => !line.endsWith(": "))
      .join("\n");
    const reviewPastePrompt = buildReviewPastePrompt({
      pack: reusedPack(existing),
      taskId: existing.id,
      iteration: existing.plan.iteration,
      changedFiles,
      tests,
      diffStat: diffStat || undefined,
    });
    return upsertSession(
      touchSession(
        { ...reviewing, review: null, reviewPastePrompt },
        {
          state: "REVIEW",
          actor: "planner",
          note: `${existing.planner}: copy the review prompt into that web chat, paste DONE|PLAN|BLOCKED back.`,
        },
      ),
    );
  }
  if (input.importedRaw) {
    return upsertSession(applyImportedReview(reviewing, input.importedRaw));
  }

  let review = mockReview({
    taskId: existing.id,
    iteration: existing.plan.iteration,
    changedFiles,
    tests,
  });
  let usedFallback = existing.planner === "mock" || isPastePlanner(existing.planner);
  let fallbackReason: string | null = usedFallback
    ? "Local review from changed-file and test metadata."
    : null;

  if (existing.planner !== "mock" && !isPastePlanner(existing.planner)) {
    const completion = await completePlanner({
      provider: existing.planner,
      config,
      messages: [
        { role: "system", content: PLANNER_SYSTEM_PROMPT },
        {
          role: "user",
          content: buildReviewUserPrompt({
            pack: existing.pack,
            taskId: existing.id,
            iteration: existing.plan.iteration,
            changedFiles,
            tests,
          }),
        },
      ],
    });
    if (completion.text.trim() && !completion.usedFallback) {
      try {
        review = messageToReview(parseControlMessage(extractControlBlock(completion.text)));
        usedFallback = false;
        fallbackReason = null;
      } catch (error) {
        fallbackReason = error instanceof Error ? error.message : "invalid review payload";
        usedFallback = true;
      }
    } else if (completion.usedFallback) {
      usedFallback = true;
      fallbackReason = completion.fallbackReason;
    }
  }

  const plan =
    review.state === "PLAN" && reviewing.plan
      ? applyIssuesToPlan(reviewing.plan, existing.harnessTeam, review.issues)
      : reviewing.plan;
  const briefs = plan ? planToBriefs(plan) : reviewing.briefs;
  const next = touchSession(
    {
      ...reviewing,
      review,
      plan,
      briefs,
      brief: briefs[0] ?? reviewing.brief,
      usedFallback,
      fallbackReason,
    },
    {
      state: review.state,
      actor: "planner",
      note: review.summary || `Review ended in ${review.state}.`,
    },
  );
  const saved = await upsertSession(next);
  return review.state === "PLAN" ? persistPlanDrops(saved) : saved;
}
