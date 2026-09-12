import { estimateTokens } from "@/core/tokens";
import {
  assertNever,
  isProtocolState,
  type ExecutionPlan,
  type ProtocolMessage,
  type ProtocolState,
  type ReviewVerdict,
} from "@/core/types";

const HEADER_RE = /^([A-Z_]+):\s*(.*)$/;

export function createTaskId(): string {
  const bytes = new Uint8Array(4);
  crypto.getRandomValues(bytes);
  return `c2x_${Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("")}`;
}

export function allowedNextStates(state: ProtocolState): ProtocolState[] {
  switch (state) {
    case "INIT":
      return ["PLAN", "BLOCKED", "ERROR"];
    case "PLAN":
      return ["EXECUTING", "BLOCKED", "ERROR"];
    case "EXECUTING":
      return ["EXECUTED", "ERROR"];
    case "EXECUTED":
      return ["REVIEW", "ERROR"];
    case "REVIEW":
      return ["PLAN", "DONE", "BLOCKED", "ERROR"];
    case "DONE":
      return ["HANDOFF"];
    case "BLOCKED":
      return ["INIT", "HANDOFF"];
    case "ERROR":
      return ["INIT", "HANDOFF"];
    case "HANDOFF":
      return ["PLAN", "REVIEW", "ERROR"];
    default:
      return assertNever(state, `Unhandled protocol state: ${state}`);
  }
}

export function canTransition(from: ProtocolState, to: ProtocolState): boolean {
  return allowedNextStates(from).includes(to);
}

function renderSections(sections: Record<string, string>): string {
  return Object.entries(sections)
    .filter(([, value]) => value.trim().length > 0)
    .map(([key, value]) => `${key}:\n${value.trim()}`)
    .join("\n\n");
}

export function encodeControlMessage(input: {
  state: ProtocolState;
  taskId: string;
  iteration: number;
  sections: Record<string, string>;
}): string {
  const header = [
    "[C2X]",
    `STATE: ${input.state}`,
    `TASK_ID: ${input.taskId}`,
    `ITERATION: ${input.iteration}`,
  ].join("\n");
  const body = renderSections(input.sections);
  const raw = body ? `${header}\n\n${body}\n` : `${header}\n`;
  return raw;
}

export function parseControlMessage(text: string): ProtocolMessage {
  const trimmed = text.trim();
  const lines = trimmed.split(/\r?\n/);
  const tag = lines[0]?.trim();
  if (tag !== "[C2X]" && tag !== "[C2C]") {
    throw new Error("Control message must start with [C2X] or [C2C].");
  }

  let state: ProtocolState | null = null;
  let taskId = "";
  let iteration = 0;
  let index = 1;
  for (; index < lines.length; index += 1) {
    const line = lines[index]?.trim() ?? "";
    if (!line) {
      index += 1;
      break;
    }
    const match = HEADER_RE.exec(line);
    if (!match) {
      break;
    }
    const key = match[1];
    const value = match[2] ?? "";
    if (key === "STATE") {
      if (!isProtocolState(value)) {
        throw new Error(`Unknown STATE: ${value}`);
      }
      state = value;
    } else if (key === "TASK_ID") {
      taskId = value;
    } else if (key === "ITERATION") {
      iteration = Number.parseInt(value, 10) || 0;
    }
  }

  if (!state || !taskId) {
    throw new Error("Control message is missing STATE or TASK_ID.");
  }

  const sections: Record<string, string> = {};
  let current = "";
  const body = lines.slice(index);
  for (const line of body) {
    const match = HEADER_RE.exec(line.trimEnd());
    if (match && line === line.trim() && match[1].length > 1) {
      current = match[1];
      sections[current] = match[2] ? `${match[2]}\n` : "";
      continue;
    }
    if (!current) {
      continue;
    }
    sections[current] += `${line}\n`;
  }
  for (const key of Object.keys(sections)) {
    sections[key] = sections[key].trim();
  }

  return { state, taskId, iteration, sections, raw: trimmed };
}

export function planToMessage(plan: ExecutionPlan): string {
  return encodeControlMessage({
    state: "PLAN",
    taskId: plan.taskId,
    iteration: plan.iteration,
    sections: {
      GOAL: plan.goal,
      RATIONALE: plan.rationale,
      ACTIONS: plan.actions.map((item, index) => `${index + 1}. ${item}`).join("\n"),
      FILES_LIKELY_INVOLVED: plan.filesLikelyInvolved.map((item) => `- ${item}`).join("\n"),
      TESTS: plan.tests.map((item) => `- ${item}`).join("\n"),
      SUCCESS_CRITERIA: plan.successCriteria.map((item) => `- ${item}`).join("\n"),
      RISKS: plan.risks.map((item) => `- ${item}`).join("\n"),
    },
  });
}

export function initMessage(taskId: string, goal: string): string {
  return encodeControlMessage({
    state: "INIT",
    taskId,
    iteration: 0,
    sections: {
      GOAL: goal,
      INSTRUCTION:
        "Inspect only the packed excerpts. Write a finite executable PLAN for Codex. Do not dump files back.",
    },
  });
}

export function executedMessage(input: {
  taskId: string;
  iteration: number;
  changedFiles: number;
  tests: string;
}): string {
  return encodeControlMessage({
    state: "EXECUTED",
    taskId: input.taskId,
    iteration: input.iteration,
    sections: {
      RESULT: "Execution finished.",
      CHANGED_FILES: String(input.changedFiles),
      TESTS: input.tests,
    },
  });
}

export function messageToPlan(message: ProtocolMessage): ExecutionPlan {
  if (message.state !== "PLAN") {
    throw new Error(`Expected PLAN, got ${message.state}`);
  }
  return {
    taskId: message.taskId,
    iteration: message.iteration || 1,
    goal: message.sections.GOAL || "",
    rationale: message.sections.RATIONALE || "",
    actions: listItems(message.sections.ACTIONS),
    filesLikelyInvolved: listItems(message.sections.FILES_LIKELY_INVOLVED),
    tests: listItems(message.sections.TESTS),
    successCriteria: listItems(message.sections.SUCCESS_CRITERIA),
    risks: listItems(message.sections.RISKS),
  };
}

export function messageToReview(message: ProtocolMessage): ReviewVerdict {
  if (message.state !== "DONE" && message.state !== "PLAN" && message.state !== "BLOCKED") {
    throw new Error(`Review must be DONE, PLAN, or BLOCKED (got ${message.state})`);
  }
  return {
    taskId: message.taskId,
    iteration: message.iteration,
    state: message.state,
    summary: message.sections.SUMMARY || message.sections.RATIONALE || message.sections.REASON || "",
    issues: listItems(message.sections.ISSUES || message.sections.REASON),
    nextActions: listItems(message.sections.NEEDS || message.sections.ACTIONS),
  };
}

export function listItems(block: string | undefined): string[] {
  if (!block) {
    return [];
  }
  return block
    .split("\n")
    .map((line) => line.replace(/^\s*(?:[-*]|\d+\.)\s*/, "").trim())
    .filter(Boolean);
}

export function assertControlBudget(raw: string, limit = 1200): void {
  const tokens = estimateTokens(raw);
  if (tokens > limit) {
    throw new Error(`Control message is ${tokens} tokens; keep it under ${limit}.`);
  }
}
