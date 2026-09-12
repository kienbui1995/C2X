import { planToBriefs } from "@/core/brief";
import { splitWorkPackets } from "@/core/packets";
import { createTaskId } from "@/core/protocol";
import {
  isHarnessId,
  resolveHarnessTeam,
  type ContextPack,
  type HarnessId,
  type HarnessRun,
  type SessionEvent,
  type SessionRecord,
  type WorkspaceSource,
  type PlannerChoice,
  type ProviderId,
  type ReviewVerdict,
} from "@/core/types";

export function blockAtIterationLimit(session: SessionRecord): SessionRecord {
  const review: ReviewVerdict = {
    taskId: session.id,
    iteration: session.plan?.iteration ?? 0,
    state: "BLOCKED",
    summary: `Iteration ${session.plan?.iteration ?? 0} reached the limit ${session.iterationLimit}. Confirm continue.`,
    issues: [`iteration ${session.plan?.iteration ?? 0} >= ${session.iterationLimit}`],
    nextActions: ["confirm continue"],
  };
  return touchSession(
    { ...session, review },
    {
      state: "BLOCKED",
      actor: "system",
      note: "NEEDS: confirm continue — iterationLimit reached.",
    },
  );
}

export function reusedPack(session: SessionRecord): ContextPack {
  if (!session.pack) {
    throw new Error("Session has no pack to reuse; do not walk the repo.");
  }
  return session.pack;
}

function pendingRuns(team: readonly HarnessId[]): HarnessRun[] {
  return team.map((owner) => ({
    owner,
    state: "pending" as const,
    changedFiles: [],
    tests: "",
  }));
}

export function createSession(input: {
  goal: string;
  planner: ProviderId;
  plannerChoice: PlannerChoice;
  harness?: HarnessId;
  harnessTeam?: readonly HarnessId[];
  budgetTokens: number;
  workspaceSource: WorkspaceSource;
}): SessionRecord {
  const now = new Date().toISOString();
  const id = createTaskId();
  const harnessTeam = resolveHarnessTeam({
    harnessTeam: input.harnessTeam,
    harness: input.harness,
  });
  const harness =
    input.harness && harnessTeam.includes(input.harness) ? input.harness : harnessTeam[0];
  return {
    id,
    createdAt: now,
    updatedAt: now,
    goal: input.goal.trim(),
    planner: input.planner,
    plannerChoice: input.plannerChoice,
    harness,
    harnessTeam,
    budgetTokens: input.budgetTokens,
    workspaceSource: input.workspaceSource,
    state: "INIT",
    pack: null,
    plan: null,
    brief: null,
    briefs: [],
    harnessRuns: pendingRuns(harnessTeam),
    records: [],
    review: null,
    pastePrompt: null,
    reviewPastePrompt: null,
    usedFallback: false,
    fallbackReason: null,
    events: [
      {
        at: now,
        state: "INIT",
        actor: "system",
        note:
          harnessTeam.length > 1
            ? `Session opened with harness team ${harnessTeam.join(" + ")}. Waiting for a packed PLAN with work packets.`
            : "Session opened. Waiting for a packed PLAN.",
      },
    ],
    savings: null,
    iterationLimit: 12,
  };
}

export function touchSession(
  session: SessionRecord,
  event: Omit<SessionEvent, "at">,
): SessionRecord {
  const at = new Date().toISOString();
  return {
    ...session,
    updatedAt: at,
    state: event.state,
    events: [...session.events, { ...event, at }],
  };
}

export function applyPlan(session: SessionRecord, extras: Partial<SessionRecord>): SessionRecord {
  const plan = extras.plan ?? session.plan;
  const briefs = plan ? planToBriefs(plan) : extras.briefs ?? session.briefs;
  const brief = briefs[0] ?? extras.brief ?? session.brief;
  const planChanged = Boolean(extras.plan);
  const harnessRuns = extras.harnessRuns ?? (planChanged ? pendingRuns(session.harnessTeam) : session.harnessRuns);
  return {
    ...session,
    ...extras,
    plan,
    briefs,
    brief,
    harnessRuns,
    updatedAt: new Date().toISOString(),
  };
}

export function normalizeSession(raw: SessionRecord): SessionRecord {
  const harnessTeam = resolveHarnessTeam({
    harnessTeam: raw.harnessTeam,
    harness: raw.harness,
  });
  const harness = raw.harness && harnessTeam.includes(raw.harness) ? raw.harness : harnessTeam[0];
  const plan = raw.plan
    ? {
        ...raw.plan,
        packets:
          raw.plan.packets?.length > 0
            ? raw.plan.packets
            : splitWorkPackets({
                team: harnessTeam,
                files: raw.plan.filesLikelyInvolved ?? [],
                goal: raw.plan.goal,
                taskId: raw.plan.taskId,
                iteration: raw.plan.iteration,
              }),
      }
    : raw.plan;
  const briefs =
    raw.briefs?.length > 0 ? raw.briefs : plan ? planToBriefs(plan) : raw.brief ? [raw.brief] : [];
  const harnessRuns =
    raw.harnessRuns?.length > 0
      ? harnessTeam.map((owner) => {
          const existing = raw.harnessRuns.find((run) => run.owner === owner);
          return (
            existing ?? {
              owner,
              state: "pending" as const,
              changedFiles: [],
              tests: "",
            }
          );
        })
      : pendingRuns(harnessTeam);
  return {
    ...raw,
    harness,
    harnessTeam,
    plan,
    briefs,
    brief: briefs[0] ?? raw.brief ?? null,
    harnessRuns,
    records: raw.records ?? [],
    reviewPastePrompt: raw.reviewPastePrompt ?? null,
    iterationLimit: raw.iterationLimit ?? 12,
  };
}

export function completeHarnessRun(
  session: SessionRecord,
  owner: HarnessId,
  report: { changedFiles: string[]; tests: string },
): SessionRecord {
  if (!isHarnessId(owner)) {
    throw new Error(`Unknown harness: ${String(owner)}`);
  }
  if (!session.harnessTeam.includes(owner)) {
    throw new Error(`${owner} is not on this session's harness team.`);
  }
  const harnessRuns = session.harnessRuns.map((run) =>
    run.owner === owner
      ? {
          ...run,
          state: "executed" as const,
          changedFiles: report.changedFiles,
          tests: report.tests,
        }
      : run,
  );
  const allDone = harnessRuns.every((run) => run.state === "executed");
  return touchSession(
    { ...session, harnessRuns },
    {
      state: allDone ? "EXECUTED" : "EXECUTING",
      actor: owner,
      note: allDone
        ? `${owner} finished. Team execution merged.`
        : `${owner} finished its packet. Waiting on the rest of the team.`,
    },
  );
}

export function completeAllHarnessRuns(
  session: SessionRecord,
  report?: { changedFiles?: string[]; tests?: string },
): SessionRecord {
  let next = session;
  for (const owner of session.harnessTeam) {
    const run = next.harnessRuns.find((item) => item.owner === owner);
    if (run?.state === "executed") {
      continue;
    }
    const packet = next.plan?.packets.find((item) => item.owner === owner);
    const scopedFiles = report?.changedFiles?.length
      ? report.changedFiles.filter((path) => !packet || packet.files.includes(path))
      : packet?.files ?? [];
    next = completeHarnessRun(next, owner, {
      changedFiles: scopedFiles.length > 0 ? scopedFiles : packet?.files ?? report?.changedFiles ?? [],
      tests: report?.tests ?? "simulated pass",
    });
  }
  return next;
}

export function mergedExecutionReport(session: SessionRecord): {
  changedFiles: string[];
  tests: string;
} {
  const changedFiles = [...new Set(session.harnessRuns.flatMap((run) => run.changedFiles))];
  const tests =
    session.harnessRuns.map((run) => `${run.owner}: ${run.tests || "not run"}`).join("\n") ||
    "not run";
  return { changedFiles, tests };
}
