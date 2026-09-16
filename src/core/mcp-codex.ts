import { renderCodexBrief } from "@/core/brief";
import { getHarness } from "@/core/providers/catalog";
import { importControlMessage, runPlan, runRecord, runReview } from "@/core/run-loop";
import { getSession } from "@/core/store";
import {
  PIPELINE_AGY_HARNESS_TEAM,
  PIPELINE_HARNESS_TEAM,
  assertNever,
  isHarnessId,
  isPlannerChoice,
  isSessionBrain,
  isWorkspaceSource,
  resolveBrainTeam,
  resolveHarnessTeam,
  resolveSessionBrain,
  type HarnessId,
  type PlannerChoice,
  type ProtocolState,
  type SessionBrain,
  type SessionRecord,
  type WorkspaceSource,
} from "@/core/types";

export const CODEX_MCP_OWNER: HarnessId = "codex";

export const CODEX_MCP_TOOL_NAMES = [
  "c2x_start",
  "c2x_submit",
  "c2x_brief",
  "c2x_record",
  "c2x_status",
] as const;

export type CodexMcpToolName = (typeof CODEX_MCP_TOOL_NAMES)[number];

export type CodexMcpAction =
  | "paste_plan"
  | "execute"
  | "wait"
  | "paste_review"
  | "done"
  | "blocked"
  | "error";

export type CodexMcpTurn = {
  ok: true;
  session: string;
  state: ProtocolState;
  action: CodexMcpAction;
  instruction: string;
  prompt: string | null;
  brief: string | null;
};

export type CodexMcpFailure = {
  ok: false;
  error: string;
};

export type CodexMcpResult = CodexMcpTurn | CodexMcpFailure;

export type CodexMcpToolSpec = {
  name: CodexMcpToolName;
  description: string;
  inputSchema: {
    type: "object";
    properties: Record<string, unknown>;
    required?: string[];
  };
};

function stringArg(args: Record<string, unknown>, key: string): string | undefined {
  const value = args[key];
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function boolArg(args: Record<string, unknown>, key: string): boolean {
  const value = args[key];
  if (value === true || value === 1) {
    return true;
  }
  if (typeof value === "string") {
    return /^(1|true|yes)$/i.test(value.trim());
  }
  return false;
}

function isCodexMcpToolName(value: string): value is CodexMcpToolName {
  return (CODEX_MCP_TOOL_NAMES as readonly string[]).includes(value);
}

function ownerFromArgs(args: Record<string, unknown>): HarnessId | CodexMcpFailure {
  const raw = stringArg(args, "owner") ?? CODEX_MCP_OWNER;
  if (!isHarnessId(raw) || raw !== CODEX_MCP_OWNER) {
    return { ok: false, error: `no brief for ${raw}` };
  }
  return raw;
}

function recordOwnerFromSession(
  session: SessionRecord,
  args: Record<string, unknown>,
): HarnessId | CodexMcpFailure {
  const brain = resolveSessionBrain(session.brain);
  switch (brain) {
    case "codex": {
      const raw = stringArg(args, "owner");
      if (raw) {
        if (!isHarnessId(raw) || !session.harnessTeam.includes(raw)) {
          return { ok: false, error: `no brief for ${raw}` };
        }
        return raw;
      }
      const pending = session.harnessRuns.find((run) => run.state !== "executed");
      const owner = pending?.owner ?? session.harnessTeam[0];
      if (!owner) {
        return { ok: false, error: "no harness to record" };
      }
      return owner;
    }
    case "none": {
      return ownerFromArgs(args);
    }
    default:
      return assertNever(brain, `Unknown session brain: ${brain}`);
  }
}

function briefForCodex(session: SessionRecord): string | null {
  const brain = resolveSessionBrain(session.brain);
  switch (brain) {
    case "codex":
      return null;
    case "none": {
      if (!session.harnessTeam.includes(CODEX_MCP_OWNER)) {
        return null;
      }
      const brief = session.briefs.find((item) => item.owner === CODEX_MCP_OWNER) ?? null;
      return brief ? renderCodexBrief(brief) : null;
    }
    default:
      return assertNever(brain, `Unknown session brain: ${brain}`);
  }
}

function instructionFor(action: CodexMcpAction, session?: SessionRecord): string {
  switch (action) {
    case "paste_plan":
      if (session?.brainstormPending) {
        return "Hiện prompt nghiệp vụ / Q&A. User dán ghi chú (không khối PLAN). Gọi c2x_submit. Không mở terminal khác. Không spawn Codex.";
      }
      return "Hiện prompt cho user. User dán vào ChatGPT, rồi dán khối [C2X] lại chat Codex này. Gọi c2x_submit. Không mở terminal khác. Không spawn Codex.";
    case "execute":
      return "You are the harness. Execute only this brief. Do not plan or review. Then call c2x_record.";
    case "wait":
      return waitInstruction(session);
    case "paste_review":
      return "Hiện review prompt cho user. User dán [C2X] DONE|PLAN|BLOCKED lại chat này, rồi gọi c2x_submit.";
    case "done":
      return "Phiên xong. Không plan thêm trừ khi user mở mục tiêu mới (c2x_start).";
    case "blocked":
      return "BLOCKED. User xác nhận rồi c2x_submit PLAN mới, hoặc c2x_start lại.";
    case "error":
      return "Lỗi phiên. Xem sự kiện rồi c2x_start lại. Không spawn Codex.";
    default:
      return assertNever(action, `Unknown Codex MCP action: ${action}`);
  }
}

function waitInstruction(session?: SessionRecord): string {
  if (!session) {
    return "Codex packet xong. Đợi teammate (Claude Code / Grok) execute. Không review. Khi cả đội xong, gọi c2x_status.";
  }
  const brain = resolveSessionBrain(session.brain);
  switch (brain) {
    case "codex": {
      const names =
        session.harnessTeam.map((id) => getHarness(id).name).join(" / ") || "the harness";
      const drops = session.harnessTeam.map((id) => `\`.c2x/briefs/${id}.md\``).join(", ");
      return `You are the brain. Do not write app code. ${names} executes. ${drops} is for the harness — you do not execute it. Call c2x_status after they record. Do not spawn Codex.`;
    }
    case "none":
      return "Codex packet xong. Đợi teammate (Claude Code / Grok) execute. Không review. Khi cả đội xong, gọi c2x_status.";
    default:
      return assertNever(brain, `Unknown session brain: ${brain}`);
  }
}

function actionForCodexHarness(session: SessionRecord): CodexMcpAction {
  switch (session.state) {
    case "INIT":
      return "paste_plan";
    case "PLAN":
    case "EXECUTING": {
      const mine = session.harnessRuns.find((run) => run.owner === CODEX_MCP_OWNER);
      if (mine?.state === "executed") {
        return "wait";
      }
      return "execute";
    }
    case "EXECUTED":
    case "REVIEW":
      return "paste_review";
    case "DONE":
    case "HANDOFF":
      return "done";
    case "BLOCKED":
      return "blocked";
    case "ERROR":
      return "error";
    default:
      return assertNever(session.state, `Unhandled protocol state: ${session.state}`);
  }
}

function actionForCodexBrain(session: SessionRecord): CodexMcpAction {
  switch (session.state) {
    case "INIT":
      return "paste_plan";
    case "PLAN":
    case "EXECUTING":
      return "wait";
    case "EXECUTED":
    case "REVIEW":
      return "paste_review";
    case "DONE":
    case "HANDOFF":
      return "done";
    case "BLOCKED":
      return "blocked";
    case "ERROR":
      return "error";
    default:
      return assertNever(session.state, `Unhandled protocol state: ${session.state}`);
  }
}

function actionFor(session: SessionRecord): CodexMcpAction {
  const brain = resolveSessionBrain(session.brain);
  switch (brain) {
    case "codex":
      return actionForCodexBrain(session);
    case "none":
      return actionForCodexHarness(session);
    default:
      return assertNever(brain, `Unknown session brain: ${brain}`);
  }
}

function turnFromSession(session: SessionRecord): CodexMcpTurn {
  const action = actionFor(session);
  const prompt =
    action === "paste_plan"
      ? session.pastePrompt
      : action === "paste_review"
        ? session.reviewPastePrompt
        : null;
  const brief = action === "execute" ? briefForCodex(session) : null;
  return {
    ok: true,
    session: session.id,
    state: session.state,
    action,
    instruction: instructionFor(action, session),
    prompt,
    brief,
  };
}

async function ensureReview(session: SessionRecord): Promise<SessionRecord> {
  if (session.state !== "EXECUTED") {
    return session;
  }
  return runReview({
    sessionId: session.id,
    changedFiles: session.records.flatMap((item) => item.changedFiles),
    tests: session.records.map((item) => item.tests).join("\n") || "recorded",
  });
}

function isMcpFailure(value: SessionRecord | CodexMcpFailure): value is CodexMcpFailure {
  return "ok" in value && value.ok === false;
}

async function loadSession(id: string | undefined): Promise<SessionRecord | CodexMcpFailure> {
  if (!id) {
    return { ok: false, error: "session is required" };
  }
  const session = await getSession(id);
  if (!session) {
    return { ok: false, error: "session not found" };
  }
  return session;
}

export function listCodexMcpTools(): CodexMcpToolSpec[] {
  return [
    {
      name: "c2x_start",
      description:
        "Start or resume a C2X session from inside Codex. Default planner is mock so the user only writes a goal and you execute. Pass planner=chatgpt-web only if they asked to paste a web chat (dán ChatGPT). Pass brainstorm=true or phase=brainstorm for nghiệp vụ notes first. Pass pipeline=true for Claude Code + Codex + Grok. Pass brain=codex and/or harness=agy / team=agy so this chat is the brain and AGY executes — do not write app code and do not spawn Codex. Never spawn another Codex.",
      inputSchema: {
        type: "object",
        properties: {
          goal: { type: "string", description: "User goal" },
          session: { type: "string", description: "Resume session id" },
          cwd: { type: "string", description: "Project workspace (CLI/MCP only)" },
          planner: { type: "string", description: "mock (default), chatgpt-web, or an API id" },
          workspace: { type: "string", description: "repo (default) or demo" },
          brainstorm: {
            type: "boolean",
            description: "Synthesize or paste nghiệp vụ notes before PLAN",
          },
          phase: { type: "string", description: "brainstorm | plan" },
          pipeline: {
            type: "boolean",
            description: "Team claude-code + codex + grok-build",
          },
          brain: {
            type: "string",
            description: "codex = this chat plans/commands; harness team executes",
          },
          harness: { type: "string", description: "Single execute harness (e.g. agy)" },
          team: { type: "string", description: "Comma-separated execute harness ids" },
        },
      },
    },
    {
      name: "c2x_submit",
      description:
        "Import a [C2X] PLAN or DONE|PLAN|BLOCKED block the user pasted into this Codex chat.",
      inputSchema: {
        type: "object",
        properties: {
          session: { type: "string" },
          raw: { type: "string", description: "Full [C2X] control block" },
          cwd: { type: "string" },
        },
        required: ["session", "raw"],
      },
    },
    {
      name: "c2x_brief",
      description: "Read only the Codex OWNER brief. Never request another harness brief.",
      inputSchema: {
        type: "object",
        properties: {
          session: { type: "string" },
          owner: { type: "string", description: "Must be codex" },
        },
        required: ["session"],
      },
    },
    {
      name: "c2x_record",
      description: "Record that this Codex session finished its brief, then fetch the review prompt.",
      inputSchema: {
        type: "object",
        properties: {
          session: { type: "string" },
          owner: { type: "string", description: "Must be codex" },
          cwd: { type: "string" },
        },
        required: ["session"],
      },
    },
    {
      name: "c2x_status",
      description: "Show the next C2X step for this Codex session.",
      inputSchema: {
        type: "object",
        properties: {
          session: { type: "string" },
        },
        required: ["session"],
      },
    },
  ];
}

export async function callCodexMcpTool(
  name: CodexMcpToolName,
  args: Record<string, unknown>,
): Promise<CodexMcpResult> {
  switch (name) {
    case "c2x_start":
      return startTurn(args);
    case "c2x_submit":
      return submitTurn(args);
    case "c2x_brief":
      return briefTurn(args);
    case "c2x_record":
      return recordTurn(args);
    case "c2x_status":
      return statusTurn(args);
    default:
      return assertNever(name, `Unknown Codex MCP tool: ${name}`);
  }
}

async function startTurn(args: Record<string, unknown>): Promise<CodexMcpResult> {
  const sessionId = stringArg(args, "session");
  if (sessionId) {
    const existing = await loadSession(sessionId);
    if (isMcpFailure(existing)) {
      return existing;
    }
    return turnFromSession(await ensureReview(existing));
  }
  const goal = stringArg(args, "goal");
  if (!goal) {
    return { ok: false, error: "goal is required" };
  }
  const plannerRaw = stringArg(args, "planner") ?? "mock";
  if (!isPlannerChoice(plannerRaw)) {
    return { ok: false, error: `unknown planner: ${plannerRaw}` };
  }
  const planner: PlannerChoice = plannerRaw;
  const workspaceRaw = stringArg(args, "workspace") ?? "repo";
  if (!isWorkspaceSource(workspaceRaw)) {
    return { ok: false, error: `unknown workspace: ${workspaceRaw}` };
  }
  const workspace: WorkspaceSource = workspaceRaw;
  const brainstorm =
    boolArg(args, "brainstorm") || stringArg(args, "phase") === "brainstorm";
  const started = startTeamFromArgs(args);
  if ("ok" in started) {
    return started;
  }
  const session = await runPlan({
    goal,
    plannerChoice: planner,
    harnessTeam: started.harnessTeam,
    budgetTokens: 4000,
    workspaceSource: workspace,
    cwd: stringArg(args, "cwd"),
    brainstorm,
    brain: started.brain,
  });
  return turnFromSession(session);
}

function startTeamFromArgs(
  args: Record<string, unknown>,
): { harnessTeam: HarnessId[]; brain: SessionBrain } | CodexMcpFailure {
  const requestedBrain = stringArg(args, "brain");
  if (requestedBrain && !isSessionBrain(requestedBrain)) {
    return { ok: false, error: `unknown brain: ${requestedBrain}` };
  }
  const harnessArg = stringArg(args, "harness");
  if (harnessArg && !isHarnessId(harnessArg)) {
    return { ok: false, error: `unknown harness: ${harnessArg}` };
  }
  const teamArg = stringArg(args, "team");
  const pipeline = boolArg(args, "pipeline");
  let brain: SessionBrain =
    requestedBrain && isSessionBrain(requestedBrain) ? requestedBrain : "none";
  if (brain === "none" && !pipeline && (harnessArg || teamArg)) {
    const preview = resolveHarnessTeam({
      harnessTeam: teamArg,
      harness: harnessArg,
    });
    if (!preview.includes(CODEX_MCP_OWNER)) {
      brain = "codex";
    }
  }
  return {
    brain,
    harnessTeam: resolveBrainTeam({
      brain,
      harnessTeam: pipeline ? PIPELINE_HARNESS_TEAM : teamArg,
      harness: pipeline ? undefined : harnessArg,
      fallbackTeam: brain === "codex" ? PIPELINE_AGY_HARNESS_TEAM : [CODEX_MCP_OWNER],
    }),
  };
}

async function submitTurn(args: Record<string, unknown>): Promise<CodexMcpResult> {
  const sessionId = stringArg(args, "session");
  const raw = stringArg(args, "raw");
  if (!sessionId || !raw) {
    return { ok: false, error: "session and raw are required" };
  }
  const existing = await loadSession(sessionId);
  if (isMcpFailure(existing)) {
    return existing;
  }
  const session = await importControlMessage({ sessionId, raw });
  return turnFromSession(await ensureReview(session));
}

async function briefTurn(args: Record<string, unknown>): Promise<CodexMcpResult> {
  const existing = await loadSession(stringArg(args, "session"));
  if (isMcpFailure(existing)) {
    return existing;
  }
  const brain = resolveSessionBrain(existing.brain);
  switch (brain) {
    case "codex":
      return {
        ok: false,
        error: "briefs in .c2x/briefs/ are for the harness team — you do not execute them",
      };
    case "none": {
      const owner = ownerFromArgs(args);
      if (typeof owner !== "string") {
        return owner;
      }
      const brief = briefForCodex(existing);
      if (!brief) {
        return { ok: false, error: `no brief for ${owner}` };
      }
      return { ...turnFromSession(existing), action: "execute", brief, prompt: null };
    }
    default:
      return assertNever(brain, `Unknown session brain: ${brain}`);
  }
}

async function recordTurn(args: Record<string, unknown>): Promise<CodexMcpResult> {
  const sessionId = stringArg(args, "session");
  if (!sessionId) {
    return { ok: false, error: "session is required" };
  }
  const existing = await loadSession(sessionId);
  if (isMcpFailure(existing)) {
    return existing;
  }
  const owner = recordOwnerFromSession(existing, args);
  if (typeof owner !== "string") {
    return owner;
  }
  const recorded = await runRecord({
    sessionId,
    owner,
    cwd: stringArg(args, "cwd"),
  });
  return turnFromSession(await ensureReview(recorded));
}

async function statusTurn(args: Record<string, unknown>): Promise<CodexMcpResult> {
  const existing = await loadSession(stringArg(args, "session"));
  if (isMcpFailure(existing)) {
    return existing;
  }
  return turnFromSession(await ensureReview(existing));
}

export function parseCodexMcpToolName(value: string): CodexMcpToolName | null {
  return isCodexMcpToolName(value) ? value : null;
}
