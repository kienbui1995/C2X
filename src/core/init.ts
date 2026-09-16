import path from "node:path";
import {
  chatToXMcpLaunch,
  defaultCodexAgentsPath,
  defaultCodexConfigPath,
  defaultSkillHomes,
  detectCodexHooks,
  installCodexAgents,
  installCodexMcp,
  type CodexHookResult,
} from "@/core/codex-config";
import {
  detectHarnessTeam,
  installSkills,
  persistWorkspaceBriefs,
  type HarnessDetectResult,
} from "@/core/harness";
import { packageRoot } from "@/core/package-root";
import { getHarness } from "@/core/providers/catalog";
import { runPlan } from "@/core/run-loop";
import {
  PIPELINE_AGY_HARNESS_TEAM,
  PIPELINE_HARNESS_TEAM,
  assertNever,
  resolveBrainTeam,
  resolveSessionBrain,
  type HarnessId,
  type SessionBrain,
  type SessionRecord,
  type WorkspaceSource,
} from "@/core/types";

export const DEFAULT_INIT_GOAL = "Khởi tạo vòng C2X trên workspace demo";

export type InitResult = {
  skillPath: string;
  skillPaths: string[];
  agentsPath: string;
  mcpConfigPath: string;
  doctor: HarnessDetectResult[];
  hooks: CodexHookResult[];
  session: SessionRecord;
  briefDrops: string[];
};

export async function runInit(input: {
  goal?: string;
  harnessTeam?: readonly HarnessId[];
  harness?: HarnessId;
  workspaceSource?: WorkspaceSource;
  cwd?: string;
  repoRoot?: string;
  skillHome?: string;
  skillHomes?: readonly string[];
  agentsPath?: string;
  codexConfigPath?: string;
  budgetTokens?: number;
  pipeline?: boolean;
  pipelineAgy?: boolean;
  brain?: SessionBrain;
}): Promise<InitResult> {
  const repoRoot = input.repoRoot ?? packageRoot();
  const skillHomes =
    input.skillHomes ?? (input.skillHome ? [input.skillHome] : defaultSkillHomes());
  const agentsPath = input.agentsPath ?? defaultCodexAgentsPath();
  const workspaceSource = input.workspaceSource ?? "demo";
  const brain = input.pipelineAgy ? "codex" : resolveSessionBrain(input.brain);
  const harnessTeam = resolveBrainTeam({
    brain,
    harnessTeam:
      input.pipelineAgy && !input.harnessTeam && !input.harness
        ? PIPELINE_AGY_HARNESS_TEAM
        : input.pipeline && !input.harnessTeam && !input.harness
          ? PIPELINE_HARNESS_TEAM
          : input.harnessTeam,
    harness: input.harness,
  });
  const skillPaths = await installSkills({ repoRoot, skillHomes });
  const skillPath = skillPaths[0] ?? path.join(skillHomes[0] ?? "", "chat-to-x", "SKILL.md");
  const mcp = chatToXMcpLaunch(repoRoot);
  const mcpConfigPath = await installCodexMcp({
    configPath: input.codexConfigPath ?? defaultCodexConfigPath(),
    command: mcp.command,
    args: mcp.args,
  });
  await installCodexAgents({ agentsPath });
  const doctor = await detectHarnessTeam(harnessTeam);
  const hooks = await detectCodexHooks({
    skillHomes,
    agentsPath,
    mcpConfigPath,
  });
  const session = await runPlan({
    goal: input.goal ?? DEFAULT_INIT_GOAL,
    plannerChoice: "mock",
    harnessTeam,
    budgetTokens: input.budgetTokens ?? 4000,
    workspaceSource,
    cwd: input.cwd,
    brain,
  });
  const briefDrops = await persistWorkspaceBriefs(session, input.cwd);
  return {
    skillPath,
    skillPaths,
    agentsPath,
    mcpConfigPath,
    doctor,
    hooks,
    session,
    briefDrops,
  };
}

export function formatInitReport(result: InitResult): string {
  const doctorLines = result.doctor.map((item) => {
    const status = item.ok ? "ok" : "missing";
    const detail = item.ok ? (item.binary ?? "") : item.hintVi;
    return `  ${item.id}\t${status}\t${detail}`;
  });
  const hookLines = result.hooks.map((item) => {
    const status = item.ok ? "ok" : "missing";
    const detail = item.ok ? item.path : item.hintVi;
    return `  ${item.id}\t${status}\t${detail}`;
  });
  const briefLines =
    result.briefDrops.length > 0
      ? result.briefDrops.map((drop) => `  ${drop}`)
      : ["  (none)"];
  const skillLines =
    result.skillPaths.length > 0
      ? result.skillPaths.map((skillPath) => `skill\t${skillPath}`)
      : [`skill\t${result.skillPath}`];
  return [
    ...skillLines,
    `codex-agents\t${result.agentsPath}`,
    `codex-plugin\t${result.mcpConfigPath}`,
    "hooks",
    ...hookLines,
    "doctor",
    ...doctorLines,
    `session\t${result.session.id} ${result.session.state} ${result.session.planner}`,
    "briefs",
    ...briefLines,
    "Open Codex in the project and say the goal. Codex uses the chat-to-x MCP tools.",
    "Claude Code skill: ~/.claude/skills/chat-to-x (written by init / skill-install).",
    "AGY CLI skill (optional, not an official plugin): ~/.gemini/antigravity-cli/skills/chat-to-x.",
    pipelineRoleLines(result.session.harnessTeam),
    ...initClosingLines(result.session),
    "",
  ]
    .filter((line) => line.length > 0)
    .join("\n");
}

function pipelineRoleLines(team: readonly HarnessId[]): string {
  const rows = team.map((id) => {
    const entry = getHarness(id);
    return `  ${id}\t${entry.packetRole}\t${entry.name}`;
  });
  return ["roles", ...rows, "planner\tChatGPT web (paste) or mock"].join("\n");
}

function initClosingLines(session: SessionRecord): string[] {
  const brain = resolveSessionBrain(session.brain);
  switch (brain) {
    case "codex":
      return [
        "Codex is the brain (MCP commands). Do not write app code. The harness team executes.",
        "C2X does not spawn harnesses from init. Codex does not review.",
      ];
    case "agy":
      return [
        "AGY is the brain (plan + commands). Codex is the implementer — read only .c2x/briefs/codex.md.",
        "C2X does not spawn harnesses from init. Codex does not review.",
      ];
    case "none":
      return [
        "C2X does not spawn harnesses from init. Codex is the harness — it does not review.",
      ];
    default:
      return assertNever(brain, `Unknown session brain: ${brain}`);
  }
}
