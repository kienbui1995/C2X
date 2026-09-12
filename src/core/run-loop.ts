import { planToBrief } from "@/core/brief";
import { hasProviderKey } from "@/core/config";
import { packWorkspace } from "@/core/packer";
import {
  PLANNER_SYSTEM_PROMPT,
  buildPlanUserPrompt,
  buildReviewUserPrompt,
  buildWebPastePrompt,
  extractControlBlock,
  mockPlanFromPack,
  mockReview,
  parsePlannerOutput,
} from "@/core/planner";
import { isPastePlanner } from "@/core/providers/catalog";
import { completePlanner } from "@/core/providers/complete";
import { resolvePlanner } from "@/core/providers/router";
import { messageToReview, parseControlMessage } from "@/core/protocol";
import { estimateSavings } from "@/core/savings";
import { applyPlan, createSession, touchSession } from "@/core/session";
import { getSession, loadConfig, upsertSession } from "@/core/store";
import { loadWorkspaceFiles } from "@/core/workspace";
import {
  isHarnessId,
  type HarnessId,
  type PlannerChoice,
  type SessionRecord,
  type WorkspaceSource,
} from "@/core/types";

export async function runPlan(input: {
  goal: string;
  plannerChoice: PlannerChoice;
  harness?: HarnessId;
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
  const harness: HarnessId = input.harness ?? config.defaultHarness;
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
    harness,
    budgetTokens: input.budgetTokens,
    workspaceSource: input.workspaceSource,
  });
  session = { ...session, pack };

  if (isPastePlanner(planner)) {
    const pastePrompt = buildWebPastePrompt(pack, session.id);
    session = touchSession(
      {
        ...session,
        pastePrompt,
        savings: estimateSavings({ pack, brief: null, planner }),
      },
      {
        state: "INIT",
        actor: "planner",
        note: `${planner}: copy the packed prompt into that web chat, paste the [C2X] PLAN back. ${harness} stays the execution harness.`,
      },
    );
    return upsertSession(session);
  }

  const fallback = mockPlanFromPack(pack, session.id);
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
        { role: "user", content: buildPlanUserPrompt(pack, session.id) },
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

  const brief = planToBrief(plan);
  session = applyPlan(
    touchSession(session, {
      state: "PLAN",
      actor: usedFallback ? "system" : "planner",
      note: usedFallback
        ? `Fell back to mock planner${fallbackReason ? `: ${fallbackReason}` : "."}`
        : `Planner ${planner} returned a PLAN.`,
    }),
    {
      plan,
      brief,
      usedFallback,
      fallbackReason,
      planner,
      savings: estimateSavings({ pack, brief, planner }),
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
  const pack = existing?.pack;
  if (!existing || !pack) {
    throw new Error("Import needs an existing packed session. Run plan first.");
  }
  const fallback = mockPlanFromPack(pack, existing.id);
  const plan = parsePlannerOutput(input.raw, fallback);
  const brief = planToBrief(plan);
  const next = applyPlan(
    touchSession(existing, {
      state: "PLAN",
      actor: "user",
      note: "Imported [C2X] PLAN from a web chat or another planner.",
    }),
    {
      plan,
      brief,
      pastePrompt: existing.pastePrompt,
      savings: estimateSavings({ pack, brief, planner: existing.planner }),
    },
  );
  return upsertSession(next);
}

export async function runReview(input: {
  sessionId: string;
  changedFiles: string[];
  tests: string;
}): Promise<SessionRecord> {
  const existing = await getSession(input.sessionId);
  if (!existing?.pack || !existing.plan) {
    throw new Error("Review needs a session that already has a PLAN.");
  }
  const config = await loadConfig();
  const harness = isHarnessId(existing.harness) ? existing.harness : "codex";
  const executed = touchSession(existing, {
    state: "EXECUTED",
    actor: harness,
    note: `${harness} reported ${input.changedFiles.length} changed files.`,
  });
  const reviewing = touchSession(executed, {
    state: "REVIEW",
    actor: "planner",
    note: "Planner is reviewing the execution report.",
  });

  let review = mockReview({
    taskId: existing.id,
    iteration: existing.plan.iteration,
    changedFiles: input.changedFiles,
    tests: input.tests,
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
            changedFiles: input.changedFiles,
            tests: input.tests,
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
