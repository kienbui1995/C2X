import { estimateTokens } from "@/core/tokens";
import { encodeControlMessage } from "@/core/protocol";
import type { ExecutionBrief, ExecutionPlan } from "@/core/types";

export function planToBrief(plan: ExecutionPlan): ExecutionBrief {
  const brief: ExecutionBrief = {
    taskId: plan.taskId,
    iteration: plan.iteration,
    goal: plan.goal,
    actions: plan.actions.slice(0, 8),
    files: plan.filesLikelyInvolved.slice(0, 12),
    tests: plan.tests.slice(0, 6),
    successCriteria: plan.successCriteria.slice(0, 6),
    doNot: [
      "Do not re-plan. The web/API planner already decided the approach.",
      "Do not paste the repository into the next planner turn.",
      "Do not spend Codex or Claude Code quota on planning or review.",
      "Do not open extra files unless a listed path is missing.",
    ],
    tokenEstimate: 0,
  };
  brief.tokenEstimate = estimateTokens(renderCodexBrief(brief));
  return brief;
}

export function renderCodexBrief(brief: ExecutionBrief): string {
  return encodeControlMessage({
    state: "PLAN",
    taskId: brief.taskId,
    iteration: brief.iteration,
    sections: {
      GOAL: brief.goal,
      ACTIONS: brief.actions.map((item, index) => `${index + 1}. ${item}`).join("\n"),
      FILES: brief.files.map((item) => `- ${item}`).join("\n"),
      TESTS: brief.tests.map((item) => `- ${item}`).join("\n"),
      SUCCESS_CRITERIA: brief.successCriteria.map((item) => `- ${item}`).join("\n"),
      DO_NOT: brief.doNot.map((item) => `- ${item}`).join("\n"),
    },
  });
}
