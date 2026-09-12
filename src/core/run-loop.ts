import { planToBriefs } from "@/core/brief";
import { hasProviderKey } from "@/core/config";
import { packWorkspace } from "@/core/packer";
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
import { isPastePlanner } from "@/core/providers/catalog";
import { applyImportedReview } from "@/core/review-import";
import { completePlanner } from "@/core/providers/complete";
import { resolvePlanner } from "@/core/providers/router";
import { messageToReview, parseControlMessage } from "@/core/protocol";
import { estimateSavings } from "@/core/savings";
import {
  applyPlan,
  completeAllHarnessRuns,
  completeHarnessRun,
  createSession,
  mergedExecutionReport,
  reusedPack,
  touchSession,
} from "@/core/session";
import { getSession, loadConfig, upsertSession } from "@/core/store";
import { loadWorkspaceFiles } from "@/core/workspace";
import {
  isHarnessId,
  resolveHarnessTeam,
  type HarnessId,
  type PlannerChoice,
  type SessionRecord,
  type WorkspaceSource,
} from "@/core/types";

export async function runPlan(input: {
  goal: string;
  plannerChoice: PlannerChoice;
  harness?: HarnessId;
  harnessTeam?: readonly HarnessId[];
  budgetTokens: number;
  workspaceSource: WorkspaceSource;
  allowFallback?: boolean;
}): Promise<SessionRecord> {
  const config = await loadConfig();
  const planner = resolvePlanner({
    choice: input.plannerChoice,
    config,
    hasKey: (id) => hasProviderKey(config, id),
  });
  const harnessTeam = resolveHarnessTeam({
    harnessTeam: input.harnessTeam,
    harness: input.harness,
    fallbackTeam: config.defaultHarnessTeam,
  });
  const files = await loadWorkspaceFiles(input.workspaceSource);
  const pack = packWorkspace({
    goal: input.goal,
    files,
    budgetTokens: input.budgetTokens,
  });
  let session = createSession({
    goal: input.goal,
    planner,
    plannerChoice: input.plannerChoice,
    harness: harnessTeam[0],
    harnessTeam,
    budgetTokens: input.budgetTokens,
    workspaceSource: input.workspaceSource,
  });
  session = { ...session, pack };

  if (isPastePlanner(planner)) {
    const pastePrompt = buildWebPastePrompt(pack, session.id, harnessTeam);
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
    return upsertSession(session);
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
        { role: "user", content: buildPlanUserPrompt(pack, session.id, harnessTeam) },
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
  return upsertSession(session);
}

export async function importPlan(input: {
  sessionId?: string;
  raw: string;
}): Promise<SessionRecord> {
  const message = parseControlMessage(extractControlBlock(input.raw));
  if (message.state !== "PLAN") {
    throw new Error(`Imported message must be PLAN (got ${message.state}).`);
  }
  const existing = input.sessionId ? await getSession(input.sessionId) : null;
  if (!existing) {
    throw new Error("Import needs an existing packed session. Run plan first.");
  }
  const pack = reusedPack(existing);
  const fallback = mockPlanFromPack(pack, existing.id, existing.harnessTeam);
  const plan = parsePlannerOutput(input.raw, fallback);
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
  return upsertSession(next);
}

export async function importControlMessage(input: {
  sessionId?: string;
  raw: string;
}): Promise<SessionRecord> {
  const message = parseControlMessage(extractControlBlock(input.raw));
  const existing = input.sessionId ? await getSession(input.sessionId) : null;
  if (
    existing &&
    (existing.state === "EXECUTED" || existing.state === "REVIEW") &&
    (message.state === "DONE" || message.state === "BLOCKED" || message.state === "PLAN")
  ) {
    return upsertSession(applyImportedReview(existing, input.raw));
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
    const reviewPastePrompt = buildReviewPastePrompt({
      pack: reusedPack(existing),
      taskId: existing.id,
      iteration: existing.plan.iteration,
      changedFiles,
      tests,
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

  const next = touchSession(
    {
      ...reviewing,
      review,
      usedFallback,
      fallbackReason,
    },
    {
      state: review.state,
      actor: "planner",
      note: review.summary || `Review ended in ${review.state}.`,
    },
  );
  return upsertSession(next);
}
