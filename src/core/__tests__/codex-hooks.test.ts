import { existsSync, readFileSync } from "node:fs";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  defaultCodexSkillHomes,
  detectCodexHooks,
  upsertCodexAgentsMd,
} from "@/core/codex-config";

describe("defaultCodexSkillHomes", () => {
  it("puts the current Codex USER skill home first, then the legacy Codex path", () => {
    const homes = defaultCodexSkillHomes("/home/alice");
    expect(homes).toEqual([
      path.join("/home/alice", ".agents", "skills"),
      path.join("/home/alice", ".codex", "skills"),
    ]);
  });
});

describe("upsertCodexAgentsMd", () => {
  it("appends a C2X marker block without wiping the user's notes", () => {
    const next = upsertCodexAgentsMd("# My notes\nKeep this.\n");
    expect(next).toContain("# My notes");
    expect(next).toContain("Keep this.");
    expect(next).toContain("<!-- c2x:begin -->");
    expect(next).toContain("<!-- c2x:end -->");
    expect(next).toMatch(/c2x_start/);
    expect(next).toMatch(/tự làm hết|Dùng C2X/);
    expect(next).not.toMatch(/npx c2x/);
  });

  it("replaces only the existing C2X block on re-install", () => {
    const first = upsertCodexAgentsMd("# Pref\n");
    const second = upsertCodexAgentsMd(`${first}\n# After\n`);
    expect(second.match(/<!-- c2x:begin -->/g)).toHaveLength(1);
    expect(second.match(/<!-- c2x:end -->/g)).toHaveLength(1);
    expect(second).toContain("# Pref");
    expect(second).toContain("# After");
  });
});

describe("detectCodexHooks", () => {
  it("reports missing Codex visibility files, then ok after they exist", async () => {
    const home = await mkdtemp(path.join(os.tmpdir(), "c2x-hooks-"));
    const skillCurrent = path.join(home, ".agents", "skills");
    const skillLegacy = path.join(home, ".codex", "skills");
    const agentsPath = path.join(home, ".codex", "AGENTS.md");
    const mcpConfigPath = path.join(home, ".codex", "config.toml");
    const missing = await detectCodexHooks({
      skillHomes: [skillCurrent, skillLegacy],
      agentsPath,
      mcpConfigPath,
    });
    expect(missing.map((item) => item.id)).toEqual([
      "codex-skill",
      "codex-skill-legacy",
      "codex-agents",
      "codex-mcp",
    ]);
    expect(missing.every((item) => item.ok === false)).toBe(true);

    await mkdir(path.join(skillCurrent, "chat-to-x"), { recursive: true });
    await mkdir(path.join(skillLegacy, "chat-to-x"), { recursive: true });
    await writeFile(
      path.join(skillCurrent, "chat-to-x", "SKILL.md"),
      "c2x_start\n",
      "utf8",
    );
    await writeFile(
      path.join(skillLegacy, "chat-to-x", "SKILL.md"),
      "c2x_start\n",
      "utf8",
    );
    await writeFile(agentsPath, upsertCodexAgentsMd(""), "utf8");
    await writeFile(mcpConfigPath, "[mcp_servers.chat-to-x]\ncommand = \"tsx\"\n", "utf8");

    const ready = await detectCodexHooks({
      skillHomes: [skillCurrent, skillLegacy],
      agentsPath,
      mcpConfigPath,
    });
    expect(ready.every((item) => item.ok === true)).toBe(true);
    expect(ready[0]?.path).toBe(path.join(skillCurrent, "chat-to-x", "SKILL.md"));
    await rm(home, { recursive: true, force: true });
  });
});

describe("Codex visibility docs", () => {
  it("tells Codex and the user where C2X actually appears", () => {
    const skill = readFileSync(path.join(process.cwd(), "skill", "SKILL.md"), "utf8");
    expect(skill).toMatch(/\.agents\/skills/);
    expect(skill).toMatch(/AGENTS\.md/);
    const readme = readFileSync(path.join(process.cwd(), "README.md"), "utf8");
    expect(readme).toMatch(/\.agents\/skills/);
    expect(readme).toMatch(/AGENTS\.md/);
    expect(readme).toMatch(/\/mcp|codex mcp/);
    const cli = readFileSync(path.join(process.cwd(), "src/cli/c2x.ts"), "utf8");
    expect(cli).toMatch(/defaultCodexSkillHomes|installSkills/);
    expect(cli).toMatch(/installCodexAgents|defaultCodexAgentsPath/);
    expect(cli).toMatch(/detectCodexHooks/);
    expect(cli).toMatch(/\$chat-to-x|\/mcp/);
    expect(existsSync(path.join(process.cwd(), "src/core/codex-config.ts"))).toBe(true);
  });
});
