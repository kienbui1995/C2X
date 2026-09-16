import { existsSync, readFileSync } from "node:fs";
import { mkdir, mkdtemp, readFile, readdir, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { DEFAULT_INIT_GOAL, formatInitReport, runInit } from "@/core/init";

let dataDir = "";
let workspaceRoot = "";
let skillHome = "";
let skillHomeLegacy = "";
let skillHomeClaude = "";
let codexConfigPath = "";
let agentsPath = "";
let prevData: string | undefined;
let prevWorkspace: string | undefined;

beforeEach(async () => {
  dataDir = await mkdtemp(path.join(os.tmpdir(), "c2x-init-data-"));
  workspaceRoot = await mkdtemp(path.join(os.tmpdir(), "c2x-init-ws-"));
  skillHome = await mkdtemp(path.join(os.tmpdir(), "c2x-init-skill-"));
  skillHomeLegacy = await mkdtemp(path.join(os.tmpdir(), "c2x-init-skill-legacy-"));
  skillHomeClaude = await mkdtemp(path.join(os.tmpdir(), "c2x-init-skill-claude-"));
  const codexHome = await mkdtemp(path.join(os.tmpdir(), "c2x-init-codex-"));
  codexConfigPath = path.join(codexHome, "config.toml");
  agentsPath = path.join(codexHome, "AGENTS.md");
  prevData = process.env.FRUGAL_DATA_DIR;
  prevWorkspace = process.env.C2X_WORKSPACE;
  process.env.FRUGAL_DATA_DIR = dataDir;
  process.env.C2X_WORKSPACE = workspaceRoot;
});

afterEach(async () => {
  if (prevData === undefined) {
    delete process.env.FRUGAL_DATA_DIR;
  } else {
    process.env.FRUGAL_DATA_DIR = prevData;
  }
  if (prevWorkspace === undefined) {
    delete process.env.C2X_WORKSPACE;
  } else {
    process.env.C2X_WORKSPACE = prevWorkspace;
  }
  await rm(dataDir, { recursive: true, force: true });
  await rm(workspaceRoot, { recursive: true, force: true });
  await rm(skillHome, { recursive: true, force: true });
  await rm(skillHomeLegacy, { recursive: true, force: true });
  await rm(skillHomeClaude, { recursive: true, force: true });
  await rm(path.dirname(codexConfigPath), { recursive: true, force: true });
});

describe("runInit", () => {
  it("installs the Codex skill, mock-plans, and drops briefs without touching other homes", async () => {
    const result = await runInit({
      goal: "Sửa createTask",
      harnessTeam: ["codex", "claude-code"],
      workspaceSource: "demo",
      cwd: workspaceRoot,
      repoRoot: process.cwd(),
      skillHomes: [skillHome, skillHomeLegacy, skillHomeClaude],
      agentsPath,
      codexConfigPath,
    });
    expect(result.skillPath).toBe(path.join(skillHome, "chat-to-x", "SKILL.md"));
    expect(result.skillPaths).toEqual([
      path.join(skillHome, "chat-to-x", "SKILL.md"),
      path.join(skillHomeLegacy, "chat-to-x", "SKILL.md"),
      path.join(skillHomeClaude, "chat-to-x", "SKILL.md"),
    ]);
    expect(result.agentsPath).toBe(agentsPath);
    expect(result.mcpConfigPath).toBe(codexConfigPath);
    expect(await readFile(agentsPath, "utf8")).toMatch(/<!-- c2x:begin -->/);
    expect(await readFile(agentsPath, "utf8")).toMatch(/c2x_start/);
    const mcpToml = await readFile(codexConfigPath, "utf8");
    expect(mcpToml).toMatch(/\[mcp_servers\.chat-to-x\]/);
    expect(mcpToml).toMatch(/tsx/);
    expect(mcpToml).toMatch(/--tsconfig/);
    expect(mcpToml).toContain(path.join(process.cwd(), "tsconfig.json"));
    expect(mcpToml).not.toMatch(/command = "npx"/);
    const skill = await readFile(result.skillPath, "utf8");
    expect(skill).toContain(process.cwd());
    expect(skill).not.toContain("replace-with-absolute-path");
    expect(await readdir(skillHome)).toEqual(["chat-to-x"]);
    expect(await readdir(skillHomeLegacy)).toEqual(["chat-to-x"]);
    expect(await readdir(skillHomeClaude)).toEqual(["chat-to-x"]);
    expect(result.hooks.map((item) => item.id)).toEqual([
      "codex-skill",
      "codex-skill-legacy",
      "codex-agents",
      "codex-mcp",
    ]);
    expect(result.hooks.every((item) => item.ok)).toBe(true);
    expect(result.session.state).toBe("PLAN");
    expect(result.session.planner).toBe("mock");
    expect(result.session.goal).toBe("Sửa createTask");
    expect(result.session.harnessTeam).toEqual(["codex", "claude-code"]);
    expect(result.doctor.map((item) => item.id)).toEqual(["codex", "claude-code"]);
    expect(result.briefDrops).toEqual([
      path.join(workspaceRoot, ".c2x", "briefs", "codex.md"),
      path.join(workspaceRoot, ".c2x", "briefs", "claude-code.md"),
    ]);
    expect(await readFile(result.briefDrops[0]!, "utf8")).toMatch(/OWNER:\s*codex/);
    expect(await readFile(result.briefDrops[1]!, "utf8")).toMatch(/OWNER:\s*claude-code/);
    const report = formatInitReport(result);
    expect(report).toContain(result.skillPath);
    expect(report).toContain(result.session.id);
    expect(report).toMatch(/codex-skill/);
    expect(report).toMatch(/codex-agents/);
    expect(report).toContain(path.join(skillHomeClaude, "chat-to-x", "SKILL.md"));
    expect(report).not.toMatch(/does not auto-install/);
    expect(report).toMatch(/does not spawn/i);
    expect(report).toMatch(/codex-plugin/);
    expect(report).not.toMatch(/127\.0\.0\.1:45218/);
  });

  it("defaults to the demo workspace and default init goal", async () => {
    const result = await runInit({
      skillHome,
      agentsPath,
      repoRoot: process.cwd(),
      cwd: workspaceRoot,
      codexConfigPath,
    });
    expect(result.session.workspaceSource).toBe("demo");
    expect(result.session.goal).toBe(DEFAULT_INIT_GOAL);
    expect(result.session.harnessTeam).toEqual(["codex", "claude-code"]);
    expect(result.session.state).toBe("PLAN");
  });

  it("documents the CLI command without spawning or recommending npx c2x", () => {
    const cli = readFileSync(path.join(process.cwd(), "src/cli/c2x.ts"), "utf8");
    expect(cli).toMatch(/\.command\("init"\)/);
    expect(cli).toMatch(/no spawn/);
    expect(cli).not.toMatch(/npx c2x/);
    expect(cli).toMatch(/--pipeline/);
    expect(cli).toMatch(/\.command\("brainstorm"\)/);
  });

  it("accepts --pipeline as the claude-code + codex + grok-build team", async () => {
    const result = await runInit({
      pipeline: true,
      workspaceSource: "demo",
      cwd: workspaceRoot,
      repoRoot: process.cwd(),
      skillHomes: [skillHome, skillHomeLegacy, skillHomeClaude],
      agentsPath,
      codexConfigPath,
    });
    expect(result.session.harnessTeam).toEqual(["codex", "claude-code", "grok-build"]);
    expect(result.session.planner).toBe("mock");
    expect(result.doctor.map((item) => item.id)).toEqual([
      "codex",
      "claude-code",
      "grok-build",
    ]);
    const report = formatInitReport(result);
    expect(report).toMatch(/Claude Code|implement/i);
    expect(report).toMatch(/Codex|fix/i);
    expect(report).toMatch(/Grok|ci|CI/i);
    expect(report).toMatch(/ChatGPT|planner/i);
  });
});

describe("runInit --cwd isolation", () => {
  it("does not write briefs into the process cwd when cwd is injected", async () => {
    const other = await mkdtemp(path.join(os.tmpdir(), "c2x-init-other-"));
    await mkdir(path.join(other, ".c2x", "briefs"), { recursive: true });
    const result = await runInit({
      goal: "Sửa createTask",
      harnessTeam: ["codex"],
      workspaceSource: "demo",
      cwd: other,
      repoRoot: process.cwd(),
      skillHome,
      agentsPath,
      codexConfigPath,
    });
    expect(result.briefDrops).toEqual([path.join(other, ".c2x", "briefs", "codex.md")]);
    expect(existsSync(path.join(workspaceRoot, ".c2x", "briefs", "codex.md"))).toBe(false);
    await rm(other, { recursive: true, force: true });
  });
});
