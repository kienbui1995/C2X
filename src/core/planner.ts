import { renderPackForPlanner } from "@/core/packer";
import { createTaskId, listItems, parseControlMessage, planToMessage } from "@/core/protocol";
import { estimateTokens } from "@/core/tokens";
import type { ContextPack, ExecutionPlan, ReviewVerdict } from "@/core/types";

export const PLANNER_SYSTEM_PROMPT = `You are the planning and review layer of a Frugal Codex (C2X) session.
Codex owns execution. You own reasoning, planning, and review.
Reply with a single [C2X] control message. No file dumps. No diffs.
Plans must be finite and executable (not 40-step epics).
After EXECUTED, do not trust claims — judge from the supplied diff stats.`;

export function buildPlanUserPrompt(pack: ContextPack, taskId: string): string {
  return `${renderPackForPlanner(pack)}

Return only:

[C2X]
STATE: PLAN
TASK_ID: ${taskId}
ITERATION: 1

GOAL:
...

RATIONALE:
...

ACTIONS:
1. ...

FILES_LIKELY_INVOLVED:
- ...

TESTS:
- ...

SUCCESS_CRITERIA:
- ...

RISKS:
- ...`;
}

export function buildReviewUserPrompt(input: {
  pack: ContextPack;
  taskId: string;
  iteration: number;
  changedFiles: string[];
  tests: string;
}): string {
  return `GOAL:\n${input.pack.goal}

CHANGED_FILES:
${input.changedFiles.map((path) => `- ${path}`).join("\n") || "- (none)"}

TESTS:
${input.tests}

PACKED TREE:
${input.pack.tree}

Reply [C2X] with STATE DONE if success criteria are met, PLAN for another iteration, or BLOCKED.
TASK_ID: ${input.taskId}
ITERATION: ${input.iteration}`;
}

export function mockPlanFromPack(pack: ContextPack, taskId = createTaskId()): ExecutionPlan {
  const files = pack.excerpts.map((excerpt) => excerpt.path);
  const mentionsCreate = /create|thêm|add|post/i.test(pack.goal);
  const mentionsFilter = /filter|lọc|status|url/i.test(pack.goal);
  const actions = [
    mentionsCreate
      ? "Fix createTask so new rows persist in the shared store, not a discarded copy."
      : "Read the packed excerpts and apply the smallest change that matches the goal.",
    mentionsFilter
      ? "Keep the status filter on the URL when the board reloads; wire the control to search params."
      : "Touch only files listed below unless a path is missing.",
    "Add or extend tests for the empty state and the behavior named in the goal.",
    "Stop when success criteria pass. Do not refactor unrelated files.",
  ];
  return {
    taskId,
    iteration: 1,
    goal: pack.goal,
    rationale:
      "The packed excerpts already show the likely defect. Codex should execute this slice instead of re-reading the repo.",
    actions,
    filesLikelyInvolved: files.slice(0, 6),
    tests: [
      "Unit-test create/filter behavior from the packed modules.",
      "Cover the empty list if the board can render no rows.",
    ],
    successCriteria: [
      "Goal behavior works without a full-page rewrite.",
      "Existing happy path still renders the task list.",
    ],
    risks: pack.omittedFiles.length
      ? [`Pack omitted ${pack.omittedFiles.length} files; open one only if a symbol is missing.`]
      : ["Keep the execution brief under the control-plane budget."],
  };
}

export function mockReview(input: {
  taskId: string;
  iteration: number;
  changedFiles: string[];
  tests: string;
}): ReviewVerdict {
  const failed = /fail|error/i.test(input.tests);
  if (failed) {
    return {
      taskId: input.taskId,
      iteration: input.iteration,
      state: "PLAN",
      summary: "Tests still fail. One more tight iteration.",
      issues: [input.tests],
      nextActions: ["Read the failing assertion, change only the implicated file, re-run tests."],
    };
  }
  if (input.changedFiles.length === 0) {
    return {
      taskId: input.taskId,
      iteration: input.iteration,
      state: "BLOCKED",
      summary: "No files changed. Cannot mark DONE.",
      issues: ["Execution produced an empty diff."],
      nextActions: ["Confirm Codex actually applied the plan."],
    };
  }
  return {
    taskId: input.taskId,
    iteration: input.iteration,
    state: "DONE",
    summary: "Changed files match the brief and tests are not failing.",
    issues: [],
    nextActions: [],
  };
}

export function parsePlannerOutput(text: string, fallback: ExecutionPlan): ExecutionPlan {
  try {
    const message = parseControlMessage(extractControlBlock(text));
    if (message.state !== "PLAN") {
      return fallback;
    }
    return {
      taskId: message.taskId || fallback.taskId,
      iteration: message.iteration || fallback.iteration,
      goal: message.sections.GOAL || fallback.goal,
      rationale: message.sections.RATIONALE || fallback.rationale,
      actions: listItems(message.sections.ACTIONS).length
        ? listItems(message.sections.ACTIONS)
        : fallback.actions,
      filesLikelyInvolved: listItems(message.sections.FILES_LIKELY_INVOLVED).length
        ? listItems(message.sections.FILES_LIKELY_INVOLVED)
        : fallback.filesLikelyInvolved,
      tests: listItems(message.sections.TESTS).length
        ? listItems(message.sections.TESTS)
        : fallback.tests,
      successCriteria: listItems(message.sections.SUCCESS_CRITERIA).length
        ? listItems(message.sections.SUCCESS_CRITERIA)
        : fallback.successCriteria,
      risks: listItems(message.sections.RISKS),
    };
  } catch {
    return fallback;
  }
}

export function extractControlBlock(text: string): string {
  const startC2x = text.indexOf("[C2X]");
  const startC2c = text.indexOf("[C2C]");
  const start =
    startC2x === -1 ? startC2c : startC2c === -1 ? startC2x : Math.min(startC2x, startC2c);
  if (start === -1) {
    throw new Error("No [C2X] or [C2C] block in the reply.");
  }
  return text.slice(start).trim();
}

export function buildChatgptPastePrompt(pack: ContextPack, taskId: string): string {
  const planPrompt = buildPlanUserPrompt(pack, taskId);
  return `${PLANNER_SYSTEM_PROMPT}

${planPrompt}`;
}

export function estimatePlannerPromptTokens(pack: ContextPack): number {
  return estimateTokens(buildChatgptPastePrompt(pack, "c2x_preview"));
}

export { planToMessage };
