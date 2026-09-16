import { existsSync } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

export function defaultCodexConfigPath(home = os.homedir()): string {
  return path.join(home, ".codex", "config.toml");
}

export function defaultCodexAgentsPath(home = os.homedir()): string {
  return path.join(home, ".codex", "AGENTS.md");
}

export function defaultCodexSkillHomes(home = os.homedir()): string[] {
  return [path.join(home, ".agents", "skills"), path.join(home, ".codex", "skills")];
}

export function defaultClaudeSkillHome(home = os.homedir()): string {
  return path.join(home, ".claude", "skills");
}

export function defaultSkillHomes(home = os.homedir()): string[] {
  return [...defaultCodexSkillHomes(home), defaultClaudeSkillHome(home)];
}

export const CODEX_AGENTS_BEGIN = "<!-- c2x:begin -->";
export const CODEX_AGENTS_END = "<!-- c2x:end -->";

export type CodexHookId =
  | "codex-skill"
  | "codex-skill-legacy"
  | "claude-skill"
  | "codex-agents"
  | "codex-mcp";

export type CodexHookResult = {
  id: CodexHookId;
  ok: boolean;
  path: string;
  hintVi: string;
  hintEn: string;
};

function skillDest(skillHome: string): string {
  return path.join(skillHome, "chat-to-x", "SKILL.md");
}

function hookHints(id: CodexHookId, ok: boolean): Pick<CodexHookResult, "hintVi" | "hintEn"> {
  switch (id) {
    case "codex-skill":
      return ok
        ? {
            hintVi: "Skill USER Codex đã có ($HOME/.agents/skills).",
            hintEn: "Codex USER skill is installed.",
          }
        : {
            hintVi: "Thiếu $HOME/.agents/skills/chat-to-x. Chạy c2x init trên máy này.",
            hintEn: "Missing $HOME/.agents/skills/chat-to-x. Run c2x init on this machine.",
          };
    case "codex-skill-legacy":
      return ok
        ? {
            hintVi: "Skill Codex cũ đã có (~/.codex/skills).",
            hintEn: "Legacy Codex skill is installed.",
          }
        : {
            hintVi: "Thiếu ~/.codex/skills/chat-to-x (Codex cũ).",
            hintEn: "Missing ~/.codex/skills/chat-to-x (older Codex).",
          };
    case "claude-skill":
      return ok
        ? {
            hintVi: "Skill Claude Code đã có (~/.claude/skills).",
            hintEn: "Claude Code skill is installed.",
          }
        : {
            hintVi: "Thiếu ~/.claude/skills/chat-to-x. Chạy c2x init --pipeline hoặc c2x skill-install.",
            hintEn: "Missing ~/.claude/skills/chat-to-x. Run c2x init --pipeline or c2x skill-install.",
          };
    case "codex-agents":
      return ok
        ? {
            hintVi: "~/.codex/AGENTS.md đã có khối C2X.",
            hintEn: "~/.codex/AGENTS.md has the C2X block.",
          }
        : {
            hintVi: "Thiếu khối C2X trong ~/.codex/AGENTS.md. Chạy c2x init.",
            hintEn: "Missing C2X block in ~/.codex/AGENTS.md. Run c2x init.",
          };
    case "codex-mcp":
      return ok
        ? {
            hintVi: "Plugin MCP chat-to-x đã có trong config.toml.",
            hintEn: "chat-to-x MCP is in config.toml.",
          }
        : {
            hintVi: "Thiếu [mcp_servers.chat-to-x] trong ~/.codex/config.toml.",
            hintEn: "Missing [mcp_servers.chat-to-x] in ~/.codex/config.toml.",
          };
    default: {
      const _never: never = id;
      throw new Error(`unhandled Codex hook: ${_never}`);
    }
  }
}

async function fileLooksReady(filePath: string, needle: RegExp): Promise<boolean> {
  if (!existsSync(filePath)) {
    return false;
  }
  try {
    const text = await readFile(filePath, "utf8");
    return needle.test(text);
  } catch {
    return false;
  }
}

export function upsertCodexAgentsMd(existing: string): string {
  const block = [
    CODEX_AGENTS_BEGIN,
    "# C2X (chat-to-x)",
    "",
    "When the user says C2X, chat-to-x, tự làm hết, Dùng C2X, pipeline, ChatGPT + Claude Code + Codex + Grok, brain-codex, pipeline-agy, or Codex là bộ não: use the chat-to-x MCP tools (`c2x_start`, `c2x_submit`, `c2x_brief`, `c2x_record`, `c2x_status`). Default planner is mock. Pass pipeline=true for Claude Code + Codex + Grok. Default: you are the harness — do not spawn another Codex. Optional brain=codex / harness=agy: you are the brain. Do not write app code. AGY executes. `.c2x/briefs/agy.md` is for AGY — you do not execute it. Never recommend the npm package named `c2x`. In this chat, `$chat-to-x` / `/mcp` should list chat-to-x.",
    CODEX_AGENTS_END,
  ].join("\n");
  const text = existing.replace(/\r\n/g, "\n");
  const start = text.indexOf(CODEX_AGENTS_BEGIN);
  const end = text.indexOf(CODEX_AGENTS_END);
  if (start >= 0 && end >= start) {
    const before = text.slice(0, start);
    const after = text.slice(end + CODEX_AGENTS_END.length);
    return `${before}${block}${after}`.replace(/\n{3,}/g, "\n\n").replace(/^\n+/, "").trimEnd() + "\n";
  }
  const body = text.trimEnd();
  return `${body}${body ? "\n\n" : ""}${block}\n`;
}

export async function installCodexAgents(input: { agentsPath: string }): Promise<string> {
  const existing = existsSync(input.agentsPath) ? await readFile(input.agentsPath, "utf8") : "";
  const next = upsertCodexAgentsMd(existing);
  await mkdir(path.dirname(input.agentsPath), { recursive: true });
  await writeFile(input.agentsPath, next, "utf8");
  return input.agentsPath;
}

export async function detectCodexHooks(input?: {
  skillHomes?: readonly string[];
  agentsPath?: string;
  mcpConfigPath?: string;
}): Promise<CodexHookResult[]> {
  const homes = input?.skillHomes ?? defaultSkillHomes();
  const current = skillDest(homes[0] ?? path.join(os.homedir(), ".agents", "skills"));
  const legacy = skillDest(homes[1] ?? path.join(os.homedir(), ".codex", "skills"));
  const claude = skillDest(homes[2] ?? defaultClaudeSkillHome());
  const agentsPath = input?.agentsPath ?? defaultCodexAgentsPath();
  const mcpConfigPath = input?.mcpConfigPath ?? defaultCodexConfigPath();
  const rows: Array<{ id: CodexHookId; path: string; ok: boolean }> = [
    {
      id: "codex-skill",
      path: current,
      ok: await fileLooksReady(current, /c2x_start|chat-to-x/),
    },
    {
      id: "codex-skill-legacy",
      path: legacy,
      ok: await fileLooksReady(legacy, /c2x_start|chat-to-x/),
    },
    {
      id: "claude-skill",
      path: claude,
      ok: await fileLooksReady(claude, /c2x_start|chat-to-x/),
    },
    {
      id: "codex-agents",
      path: agentsPath,
      ok: await fileLooksReady(agentsPath, /<!-- c2x:begin -->|c2x_start/),
    },
    {
      id: "codex-mcp",
      path: mcpConfigPath,
      ok: await fileLooksReady(mcpConfigPath, /\[mcp_servers\.chat-to-x\]/),
    },
  ];
  return rows.map((row) => ({
    ...row,
    ...hookHints(row.id, row.ok),
  }));
}

const SERVER_HEADER = "mcp_servers.chat-to-x";

function isChatToXSection(header: string): boolean {
  const name = header.replace(/"/g, "");
  return name === SERVER_HEADER || name.startsWith(`${SERVER_HEADER}.`);
}

export function upsertCodexMcpToml(
  existing: string,
  command: string,
  args: readonly string[],
): string {
  const lines = existing.replace(/\r\n/g, "\n").split("\n");
  const kept: string[] = [];
  let skipping = false;
  for (const line of lines) {
    const header = line.match(/^\[([^\]]+)\]/);
    if (header) {
      skipping = isChatToXSection(header[1] ?? "");
    }
    if (!skipping) {
      kept.push(line);
    }
  }
  const body = kept.join("\n").replace(/\n{3,}/g, "\n\n").trimEnd();
  const argsToml = args.map((item) => JSON.stringify(item)).join(", ");
  const block = [
    "[mcp_servers.chat-to-x]",
    `command = ${JSON.stringify(command)}`,
    `args = [${argsToml}]`,
    "startup_timeout_sec = 20",
  ].join("\n");
  return `${body}${body ? "\n\n" : ""}${block}\n`;
}

export async function installCodexMcp(input: {
  configPath: string;
  command: string;
  args: readonly string[];
}): Promise<string> {
  const existing = existsSync(input.configPath) ? await readFile(input.configPath, "utf8") : "";
  const next = upsertCodexMcpToml(existing, input.command, input.args);
  await mkdir(path.dirname(input.configPath), { recursive: true });
  await writeFile(input.configPath, next, "utf8");
  return input.configPath;
}

export function chatToXMcpLaunch(repoRoot: string): { command: string; args: string[] } {
  return {
    command: path.join(repoRoot, "node_modules", ".bin", "tsx"),
    args: [
      "--tsconfig",
      path.join(repoRoot, "tsconfig.json"),
      path.join(repoRoot, "src", "cli", "c2x.ts"),
      "mcp",
    ],
  };
}
