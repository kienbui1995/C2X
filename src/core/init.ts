import os from "node:os";
import path from "node:path";
import {
  chatToXMcpLaunch,
  defaultCodexConfigPath,
  installCodexMcp,
} from "@/core/codex-config";
import {
  detectHarnessTeam,
  installSkill,
  persistWorkspaceBriefs,
  type HarnessDetectResult,
} from "@/core/harness";
import { packageRoot } from "@/core/package-root";
import { runPlan } from "@/core/run-loop";
import {
  resolveHarnessTeam,
  type HarnessId,
  type SessionRecord,
  type WorkspaceSource,
} from "@/core/types";

export const DEFAULT_INIT_GOAL = "Khởi tạo vòng C2X trên workspace demo";

export type InitResult = {
  skillPath: string;
  mcpConfigPath: string;
  doctor: HarnessDetectResult[];
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
  codexConfigPath?: string;
  budgetTokens?: number;
}): Promise<InitResult> {
  const repoRoot = input.repoRoot ?? packageRoot();
  const skillHome = input.skillHome ?? path.join(os.homedir(), ".codex/skills");
  const workspaceSource = input.workspaceSource ?? "demo";
  const harnessTeam = resolveHarnessTeam({
    harnessTeam: input.harnessTeam,
    harness: input.harness,
  });
  const skillPath = await installSkill({ repoRoot, skillHome });
  const mcp = chatToXMcpLaunch(repoRoot);
  const mcpConfigPath = await installCodexMcp({
    configPath: input.codexConfigPath ?? defaultCodexConfigPath(),
    command: mcp.command,
    args: mcp.args,
  });
  const doctor = await detectHarnessTeam(harnessTeam);
  const session = await runPlan({
    goal: input.goal ?? DEFAULT_INIT_GOAL,
    plannerChoice: "mock",
    harnessTeam,
    budgetTokens: input.budgetTokens ?? 4000,
    workspaceSource,
    cwd: input.cwd,
  });
  const briefDrops = await persistWorkspaceBriefs(session, input.cwd);
  return { skillPath, mcpConfigPath, doctor, session, briefDrops };
}

export function formatInitReport(result: InitResult): string {
  const doctorLines = result.doctor.map((item) => {
    const status = item.ok ? "ok" : "missing";
    const detail = item.ok ? (item.binary ?? "") : item.hintVi;
    return `  ${item.id}\t${status}\t${detail}`;
  });
  const briefLines =
    result.briefDrops.length > 0
      ? result.briefDrops.map((drop) => `  ${drop}`)
      : ["  (none)"];
  return [
    `skill\t${result.skillPath}`,
    `codex-plugin\t${result.mcpConfigPath}`,
    "doctor",
    ...doctorLines,
    `session\t${result.session.id} ${result.session.state} ${result.session.planner}`,
    "briefs",
    ...briefLines,
    "Open Codex in the project and say the goal. Codex uses the chat-to-x MCP tools.",
    "Claude Code: copy the same SKILL.md to ~/.claude/skills/chat-to-x/ (C2X does not auto-install there).",
    "C2X does not spawn harnesses from init. Codex is the harness.",
    "",
  ].join("\n");
}
