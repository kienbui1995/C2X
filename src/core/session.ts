import { planToBrief } from "@/core/brief";
import { createTaskId } from "@/core/protocol";
import type {
  HarnessId,
  PlannerChoice,
  ProviderId,
  SessionEvent,
  SessionRecord,
  WorkspaceSource,
} from "@/core/types";

export function createSession(input: {
  goal: string;
  planner: ProviderId;
  plannerChoice: PlannerChoice;
  harness: HarnessId;
  budgetTokens: number;
  workspaceSource: WorkspaceSource;
}): SessionRecord {
  const now = new Date().toISOString();
  const id = createTaskId();
  return {
    id,
    createdAt: now,
    updatedAt: now,
    goal: input.goal.trim(),
    planner: input.planner,
    plannerChoice: input.plannerChoice,
    harness: input.harness,
    budgetTokens: input.budgetTokens,
    workspaceSource: input.workspaceSource,
    state: "INIT",
    pack: null,
    plan: null,
    brief: null,
    review: null,
    pastePrompt: null,
    usedFallback: false,
    fallbackReason: null,
    events: [
      {
        at: now,
        state: "INIT",
        actor: "system",
        note: "Session opened. Waiting for a packed PLAN.",
      },
    ],
    savings: null,
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
  const brief = plan ? planToBrief(plan) : session.brief;
  return {
    ...session,
    ...extras,
    brief,
    updatedAt: new Date().toISOString(),
  };
}
