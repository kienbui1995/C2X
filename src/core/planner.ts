import { renderPackForPlanner } from "@/core/packer";
import { filesFromPack, parseWorkPackets, splitWorkPackets } from "@/core/packets";
import { createTaskId, listItems, parseControlMessage, planToMessage } from "@/core/protocol";
import { estimateTokens } from "@/core/tokens";
import {
  DEFAULT_HARNESS_TEAM,
  resolveHarnessTeam,
  type ContextPack,
  type ExecutionPlan,
  type HarnessId,
  type ReviewVerdict,
} from "@/core/types";

export const PLANNER_SYSTEM_PROMPT = `You are the planning and review layer of a chat-to-x (C2X) session.
The execution harness team (Codex, Claude Code, Grok Build, OpenCode, Kiro CLI — any subset) owns edits, shell, tests, and git.
You own reasoning, planning, and review. Never spend harness quota on thinking.
Split the PLAN into per-harness work packets with disjoint file ownership when possible.
Each harness must only see its own packet. Reply with a single [C2X] control message.
No file dumps. No diffs. Plans must be finite and executable (not 40-step epics).
After EXECUTED, do not trust claims — judge from the supplied merged diff stats.`;

export function buildPlanUserPrompt(
  pack: ContextPack,
  taskId: string,
  team: readonly HarnessId[] = DEFAULT_HARNESS_TEAM,
): string {
  const harnessTeam = resolveHarnessTeam({ harnessTeam: team });
  const packetStub = harnessTeam
    .map((owner, index) => {
      const role =
        harnessTeam.length === 1
          ? "general"
          : index === 0
            ? "implement"
            : index === harnessTeam.length - 1
              ? "test"
              : "general";
      return `## owner=${owner} role=${role}
ACTIONS:
1. ...
FILES:
- ...
TESTS:
- ...
SUCCESS_CRITERIA:
- ...`;
    })
    .join("\n\n");
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
- ...

PACKETS:
${packetStub}`;
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

export function mockPlanFromPack(
  pack: ContextPack,
  taskId = createTaskId(),
  team: readonly HarnessId[] = DEFAULT_HARNESS_TEAM,
): ExecutionPlan {
  const harnessTeam = resolveHarnessTeam({ harnessTeam: team });
  const files = filesFromPack(pack);
  const packets = splitWorkPackets({
    team: harnessTeam,
    files,
    goal: pack.goal,
    taskId,
  });
  const ownedFiles = [...new Set(packets.flatMap((packet) => packet.files))];
  const actions = [...new Set(packets.flatMap((packet) => packet.actions))];
  const tests = [...new Set(packets.flatMap((packet) => packet.tests))];
  const successCriteria = [...new Set(packets.flatMap((packet) => packet.successCriteria))];
  return {
    taskId,
    iteration: 1,
    goal: pack.goal,
    rationale:
      harnessTeam.length > 1
        ? "The packed excerpts already show the defect. Split execution across the harness team so each scarce quota only sees its packet."
        : "The packed excerpts already show the likely defect. The selected harness should execute this slice instead of re-reading the repo.",
    actions: actions.slice(0, 10),
    filesLikelyInvolved: ownedFiles.slice(0, 12),
    tests: tests.slice(0, 8),
    successCriteria: successCriteria.slice(0, 8),
    risks: pack.omittedFiles.length
      ? [`Pack omitted ${pack.omittedFiles.length} files; open one only if a symbol is missing.`]
      : ["Keep each per-harness brief under the control-plane budget."],
    packets,
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
      packets: parseWorkPackets(message.sections.PACKETS).length
        ? parseWorkPackets(message.sections.PACKETS)
        : fallback.packets,
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

export function buildReviewPastePrompt(input: {
  pack: ContextPack;
  taskId: string;
  iteration: number;
  changedFiles: string[];
  tests: string;
  diffStat?: string;
}): string {
  const files =
    input.changedFiles.map((path) => `- ${path}`).join("\n") || "- (none)";
  const diff = input.diffStat?.trim()
    ? `\nDIFF_STAT:\n${input.diffStat.trim()}\n`
    : "";
  return `${PLANNER_SYSTEM_PROMPT}

GOAL:
${input.pack.goal}

CHANGED_FILES:
${files}

TESTS:
${input.tests}
${diff}
PACKED TREE:
${input.pack.tree}

Reply with a single [C2X] control message. STATE must be DONE, PLAN, or BLOCKED.
TASK_ID: ${input.taskId}
ITERATION: ${input.iteration}

[C2X]
STATE: DONE|PLAN|BLOCKED
TASK_ID: ${input.taskId}
ITERATION: ${input.iteration}

SUMMARY:
...
`;
}

export function buildWebPastePrompt(
  pack: ContextPack,
  taskId: string,
  team: readonly HarnessId[] = DEFAULT_HARNESS_TEAM,
): string {
  const planPrompt = buildPlanUserPrompt(pack, taskId, team);
  return `${PLANNER_SYSTEM_PROMPT}

${planPrompt}`;
}

export function buildChatgptPastePrompt(pack: ContextPack, taskId: string): string {
  return buildWebPastePrompt(pack, taskId);
}

export function estimatePlannerPromptTokens(pack: ContextPack): number {
  return estimateTokens(buildWebPastePrompt(pack, "c2x_preview"));
}

export { planToMessage };
