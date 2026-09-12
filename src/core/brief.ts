import { estimateTokens } from "@/core/tokens";
import { encodeControlMessage } from "@/core/protocol";
import type { ExecutionBrief, ExecutionPlan, WorkPacket } from "@/core/types";

const SHARED_DO_NOT = [
  "Do not re-plan. The web/API planner already decided the approach.",
  "Do not paste the repository into the next planner turn.",
  "Do not spend Codex, Claude Code, Grok Build, or OpenCode quota on planning or review.",
];

function withEstimate(brief: ExecutionBrief): ExecutionBrief {
  return {
    ...brief,
    tokenEstimate: estimateTokens(renderCodexBrief({ ...brief, tokenEstimate: 0 })),
  };
}

export function planToBrief(plan: ExecutionPlan): ExecutionBrief {
  return withEstimate({
    taskId: plan.taskId,
    iteration: plan.iteration,
    owner: plan.packets[0]?.owner ?? "codex",
    goal: plan.goal,
    actions: plan.actions.slice(0, 8),
    files: plan.filesLikelyInvolved.slice(0, 12),
    tests: plan.tests.slice(0, 6),
    successCriteria: plan.successCriteria.slice(0, 6),
    doNot: [
      ...SHARED_DO_NOT,
      "Do not open extra files unless a listed path is missing.",
    ],
    tokenEstimate: 0,
  });
}

export function packetToBrief(plan: ExecutionPlan, packet: WorkPacket): ExecutionBrief {
  return withEstimate({
    taskId: plan.taskId,
    iteration: plan.iteration,
    owner: packet.owner,
    goal: plan.goal,
    actions: packet.actions.slice(0, 8),
    files: packet.files.slice(0, 12),
    tests: packet.tests.slice(0, 6),
    successCriteria: packet.successCriteria.slice(0, 6),
    doNot: [
      ...SHARED_DO_NOT,
      "Do not open files owned by another harness unless a listed path is missing.",
      `Do not execute work assigned to a different owner than ${packet.owner}.`,
    ],
    tokenEstimate: 0,
  });
}

export function planToBriefs(plan: ExecutionPlan): ExecutionBrief[] {
  if (plan.packets.length === 0) {
    return [planToBrief(plan)];
  }
  return plan.packets.map((packet) => packetToBrief(plan, packet));
}

export function renderCodexBrief(brief: ExecutionBrief): string {
  return encodeControlMessage({
    state: "PLAN",
    taskId: brief.taskId,
    iteration: brief.iteration,
    sections: {
      OWNER: brief.owner,
      GOAL: brief.goal,
      ACTIONS: brief.actions.map((item, index) => `${index + 1}. ${item}`).join("\n"),
      FILES: brief.files.map((item) => `- ${item}`).join("\n"),
      TESTS: brief.tests.map((item) => `- ${item}`).join("\n"),
      SUCCESS_CRITERIA: brief.successCriteria.map((item) => `- ${item}`).join("\n"),
      DO_NOT: brief.doNot.map((item) => `- ${item}`).join("\n"),
    },
  });
}

export function renderHarnessBrief(brief: ExecutionBrief): string {
  return renderCodexBrief(brief);
}
