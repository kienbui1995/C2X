import { existsSync } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

export function defaultCodexConfigPath(): string {
  return path.join(os.homedir(), ".codex/config.toml");
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
    args: [path.join(repoRoot, "src", "cli", "c2x.ts"), "mcp"],
  };
}
