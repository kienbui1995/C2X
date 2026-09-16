import { readFileSync } from "node:fs";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { formatInitReport, runInit } from "@/core/init";
import { callCodexMcpTool, listCodexMcpTools } from "@/core/mcp-codex";
import { detectHarness } from "@/core/harness";
import { getHarness, HARNESS_BY_ID, resolveExecArgs } from "@/core/providers/catalog";
import { runDrive } from "@/core/drive";
import { runPlan } from "@/core/run-loop";
import { createSession, normalizeSession } from "@/core/session";
import { getSession } from "@/core/store";
import { briefRelForHarness } from "@/core/spawn-harness";
import {
  HARNESS_IDS,
  PIPELINE_AGY_HARNESS_TEAM,
  PIPELINE_HARNESS_TEAM,
  isHarnessId,
  isSessionBrain,
  resolveSessionBrain,
  resolveBrainTeam,
} from "@/core/types";

let dataDir = "";
let workspaceRoot = "";
let skillHome = "";
let agentsPath = "";
let codexConfigPath = "";
let prevData: string | undefined;
let prevWorkspace: string | undefined;

beforeEach(async () => {
  dataDir = await mkdtemp(path.join(os.tmpdir(), "c2x-agy-data-"));
  workspaceRoot = await mkdtemp(path.join(os.tmpdir(), "c2x-agy-ws-"));
  skillHome = await mkdtemp(path.join(os.tmpdir(), "c2x-agy-skill-"));
  const codexHome = await mkdtemp(path.join(os.tmpdir(), "c2x-agy-codex-"));
  agentsPath = path.join(codexHome, "AGENTS.md");
  codexConfigPath = path.join(codexHome, "config.toml");
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
  await rm(path.dirname(codexConfigPath), { recursive: true, force: true });
});

describe("agy catalog row", () => {
  it("registers Google Antigravity CLI as one implement harness named agy", () => {
    expect(HARNESS_IDS).toContain("agy");
    expect(isHarnessId("agy")).toBe(true);
    expect(HARNESS_IDS).not.toContain("antigravity");
    expect(HARNESS_IDS).not.toContain("jira");
    const entry = getHarness("agy");
    expect(entry).toBe(HARNESS_BY_ID.agy);
    expect(entry.id).toBe("agy");
    expect(entry.packetRole).toBe("implement");
    expect(entry.binaries).toEqual(["agy"]);
    expect(entry.execArgs.join(" ")).toMatch(/-p|--print|--prompt/);
    expect(entry.execArgs.join(" ")).toMatch(/\{brief\}/);
    expect(resolveExecArgs(entry, briefRelForHarness("agy")).join(" ")).toContain(
      ".c2x/briefs/agy.md",
    );
    expect(entry.unofficial).toBe(true);
    expect(entry.blurb).toMatch(/Antigravity|agy/i);
    expect(entry.blurb).toMatch(/community|unofficial|not affiliated/i);
    expect(entry.blurbVi).toMatch(/Antigravity|agy/i);
    expect(entry.blurbVi).toMatch(/cộng đồng|không chính thức|không liên kết/i);
  });

  it("detects a missing agy binary without requiring it on PATH", async () => {
    const prev = process.env.PATH;
    process.env.PATH = "/nonexistent-c2x-agy-path";
    const missing = await detectHarness("agy");
    process.env.PATH = prev;
    expect(missing.ok).toBe(false);
    expect(missing.binary).toBeNull();
    expect(missing.id).toBe("agy");
    expect(`${missing.hintEn} ${missing.hintVi}`).toMatch(/unofficial|không chính thức/i);
    expect(`${missing.hintEn} ${missing.hintVi}`).toMatch(/flags may change|cờ có thể đổi/i);
  });
});

describe("symmetric brain seats", () => {
  it("accepts brain=agy and brain=codex and excludes the brain from the execute team", () => {
    expect(isSessionBrain("none")).toBe(true);
    expect(isSessionBrain("codex")).toBe(true);
    expect(isSessionBrain("agy")).toBe(true);
    expect(isSessionBrain("claude-code")).toBe(false);
    expect(resolveSessionBrain(undefined)).toBe("none");
    expect(resolveSessionBrain("codex")).toBe("codex");
    expect(resolveSessionBrain("agy")).toBe("agy");
    expect(PIPELINE_AGY_HARNESS_TEAM).toEqual(["agy"]);
    expect(PIPELINE_HARNESS_TEAM).toEqual(["claude-code", "codex", "grok-build"]);
    expect(resolveBrainTeam({ brain: "codex" })).toEqual(["agy"]);
    expect(resolveBrainTeam({ brain: "codex", harness: "agy" })).toEqual(["agy"]);
    expect(resolveBrainTeam({ brain: "codex", harnessTeam: ["codex", "agy"] })).toEqual(["agy"]);
    expect(resolveBrainTeam({ brain: "agy" })).toEqual(["codex"]);
    expect(resolveBrainTeam({ brain: "agy", harness: "codex" })).toEqual(["codex"]);
    expect(resolveBrainTeam({ brain: "agy", harnessTeam: ["agy", "codex"] })).toEqual(["codex"]);
    expect(resolveBrainTeam({ brain: "none", harnessTeam: ["codex"] })).toEqual(["codex"]);
    expect(resolveBrainTeam({ brain: "agy" })).not.toContain("agy");
    expect(resolveBrainTeam({ brain: "codex" })).not.toContain("codex");
    expect(resolveBrainTeam({ brain: "agy" }).includes("agy") && resolveBrainTeam({ brain: "agy" }).includes("codex")).toBe(false);
    expect(resolveBrainTeam({ brain: "codex" }).includes("agy") && resolveBrainTeam({ brain: "codex" }).includes("codex")).toBe(false);
  });

  it("stores either brain on new sessions and restores none on legacy rows", () => {
    const created = createSession({
      goal: "Sửa createTask",
      planner: "mock",
      plannerChoice: "mock",
      harnessTeam: ["agy"],
      budgetTokens: 2000,
      workspaceSource: "demo",
      brain: "codex",
    });
    expect(created.brain).toBe("codex");
    expect(created.harnessTeam).toEqual(["agy"]);
    expect(created.harnessTeam).not.toContain("codex");
    const legacy = { ...created } as { brain?: string };
    delete legacy.brain;
    expect(normalizeSession(legacy as typeof created).brain).toBe("none");

    const agyBrain = createSession({
      goal: "Sửa createTask",
      planner: "mock",
      plannerChoice: "mock",
      harnessTeam: ["codex"],
      budgetTokens: 2000,
      workspaceSource: "demo",
      brain: "agy",
    });
    expect(agyBrain.brain).toBe("agy");
    expect(agyBrain.harnessTeam).toEqual(["codex"]);
    expect(agyBrain.harnessTeam).not.toContain("agy");
  });
});

describe("runInit Codex-brain + AGY", () => {
  it("uses --brain-codex --harness agy with mock planner and drops agy.md only", async () => {
    const result = await runInit({
      goal: "Sửa createTask",
      brain: "codex",
      harness: "agy",
      workspaceSource: "demo",
      cwd: workspaceRoot,
      repoRoot: process.cwd(),
      skillHomes: [skillHome],
      agentsPath,
      codexConfigPath,
    });
    expect(result.session.planner).toBe("mock");
    expect(result.session.brain).toBe("codex");
    expect(result.session.harnessTeam).toEqual(["agy"]);
    expect(result.session.harnessTeam).not.toEqual(["codex", "agy"]);
    expect(result.doctor.map((item) => item.id)).toEqual(["agy"]);
    expect(result.briefDrops).toEqual([path.join(workspaceRoot, ".c2x", "briefs", "agy.md")]);
    expect(await readFile(result.briefDrops[0]!, "utf8")).toMatch(/OWNER:\s*agy/);
    const report = formatInitReport(result);
    expect(report).toMatch(/brain|não/i);
    expect(report).toMatch(/agy/i);
    expect(report).toMatch(/does not spawn/i);
    expect(report).not.toMatch(/Codex is the harness/i);
  });

  it("treats --pipeline-agy as team [agy], not [codex,agy]", async () => {
    const result = await runInit({
      pipelineAgy: true,
      workspaceSource: "demo",
      cwd: workspaceRoot,
      repoRoot: process.cwd(),
      skillHomes: [skillHome],
      agentsPath,
      codexConfigPath,
    });
    expect(result.session.brain).toBe("codex");
    expect(result.session.harnessTeam).toEqual(["agy"]);
    expect(result.session.planner).toBe("mock");
    expect(result.briefDrops).toEqual([path.join(workspaceRoot, ".c2x", "briefs", "agy.md")]);
  });

  it("uses --brain-agy --harness codex with mock planner and drops codex.md only", async () => {
    const result = await runInit({
      goal: "Sửa createTask",
      brain: "agy",
      harness: "codex",
      workspaceSource: "demo",
      cwd: workspaceRoot,
      repoRoot: process.cwd(),
      skillHomes: [skillHome],
      agentsPath,
      codexConfigPath,
    });
    expect(result.session.planner).toBe("mock");
    expect(result.session.brain).toBe("agy");
    expect(result.session.harnessTeam).toEqual(["codex"]);
    expect(result.session.harnessTeam).not.toContain("agy");
    expect(result.doctor.map((item) => item.id)).toEqual(["codex"]);
    expect(result.briefDrops).toEqual([path.join(workspaceRoot, ".c2x", "briefs", "codex.md")]);
    expect(await readFile(result.briefDrops[0]!, "utf8")).toMatch(/OWNER:\s*codex/);
    const report = formatInitReport(result);
    expect(report).toMatch(/brain|não/i);
    expect(report).toMatch(/agy/i);
    expect(report).toMatch(/does not spawn/i);
    expect(report).toMatch(/Codex is the implementer|OWNER:\s*codex|briefs\/codex/i);
    expect(report).not.toMatch(/Codex is the harness/i);
  });
});

describe("Codex MCP brain=codex", () => {
  it("accepts brain=codex and/or harness=agy / team=agy and does not return an execute brief", async () => {
    const tools = listCodexMcpTools();
    const start = tools.find((tool) => tool.name === "c2x_start");
    expect(JSON.stringify(start?.inputSchema)).toMatch(/brain/);
    expect(JSON.stringify(start?.inputSchema)).toMatch(/harness/);
    expect(JSON.stringify(start?.inputSchema)).toMatch(/team/);

    const started = await callCodexMcpTool("c2x_start", {
      goal: "Sửa createTask",
      cwd: workspaceRoot,
      workspace: "demo",
      brain: "codex",
    });
    expect(started.ok).toBe(true);
    if (!started.ok) {
      return;
    }
    expect(started.state).toBe("PLAN");
    expect(started.action).toBe("wait");
    expect(started.brief).toBeNull();
    expect(started.instruction).toMatch(/You are the brain/i);
    expect(started.instruction).toMatch(/Do not write app code/i);
    expect(started.instruction).toMatch(/AGY executes|agy executes/i);
    expect(started.instruction).toMatch(/\.c2x\/briefs\/agy\.md/);
    expect(started.instruction).toMatch(/you do not execute it/i);
    expect(started.instruction).not.toMatch(/You are the harness/i);

    const session = await getSession(started.session);
    expect(session?.brain).toBe("codex");
    expect(session?.harnessTeam).toEqual(["agy"]);
    expect(session?.planner).toBe("mock");

    const leak = await callCodexMcpTool("c2x_brief", {
      session: started.session,
      owner: "agy",
    });
    expect(leak.ok).toBe(false);

    const recorded = await callCodexMcpTool("c2x_record", {
      session: started.session,
      owner: "agy",
      cwd: workspaceRoot,
    });
    expect(recorded.ok).toBe(true);
    if (!recorded.ok) {
      return;
    }
    expect(recorded.state).toBe("DONE");
    const status = await callCodexMcpTool("c2x_status", { session: started.session });
    expect(status.ok).toBe(true);
    if (!status.ok) {
      return;
    }
    expect(status.state).toBe("DONE");
    expect(status.action).toBe("done");
    expect(status.brief).toBeNull();
  });

  it("sets team [agy] from harness=agy or team=agy without a second Codex harness", async () => {
    const viaHarness = await callCodexMcpTool("c2x_start", {
      goal: "Sửa createTask",
      cwd: workspaceRoot,
      workspace: "demo",
      harness: "agy",
    });
    expect(viaHarness.ok).toBe(true);
    if (!viaHarness.ok) {
      return;
    }
    expect((await getSession(viaHarness.session))?.harnessTeam).toEqual(["agy"]);
    expect((await getSession(viaHarness.session))?.brain).toBe("codex");
    expect(viaHarness.action).toBe("wait");
    expect(viaHarness.brief).toBeNull();

    const viaTeam = await callCodexMcpTool("c2x_start", {
      goal: "Sửa createTask",
      cwd: workspaceRoot,
      workspace: "demo",
      team: "agy",
    });
    expect(viaTeam.ok).toBe(true);
    if (!viaTeam.ok) {
      return;
    }
    expect((await getSession(viaTeam.session))?.harnessTeam).toEqual(["agy"]);
    expect((await getSession(viaTeam.session))?.brain).toBe("codex");
  });
});

describe("Codex MCP brain=agy", () => {
  it("treats Codex as the implementer: execute only the Codex brief", async () => {
    const started = await callCodexMcpTool("c2x_start", {
      goal: "Sửa createTask",
      cwd: workspaceRoot,
      workspace: "demo",
      brain: "agy",
      harness: "codex",
    });
    expect(started.ok).toBe(true);
    if (!started.ok) {
      return;
    }
    expect(started.state).toBe("PLAN");
    expect(started.action).toBe("execute");
    expect(started.brief).toMatch(/OWNER:\s*codex/);
    expect(started.brief).not.toMatch(/OWNER:\s*agy/);
    expect(started.instruction).toMatch(/You are the harness|execute only this brief/i);
    expect(started.instruction).not.toMatch(/You are the brain/i);
    expect(started.instruction).toMatch(/Do not plan or review/i);

    const session = await getSession(started.session);
    expect(session?.brain).toBe("agy");
    expect(session?.harnessTeam).toEqual(["codex"]);
    expect(session?.planner).toBe("mock");

    const leak = await callCodexMcpTool("c2x_brief", {
      session: started.session,
      owner: "agy",
    });
    expect(leak.ok).toBe(false);

    const brief = await callCodexMcpTool("c2x_brief", {
      session: started.session,
      owner: "codex",
    });
    expect(brief.ok).toBe(true);
    if (!brief.ok) {
      return;
    }
    expect(brief.action).toBe("execute");
    expect(brief.brief).toMatch(/OWNER:\s*codex/);

    const recorded = await callCodexMcpTool("c2x_record", {
      session: started.session,
      owner: "codex",
      cwd: workspaceRoot,
    });
    expect(recorded.ok).toBe(true);
    if (!recorded.ok) {
      return;
    }
    expect(recorded.state).toBe("DONE");
    expect(recorded.action).toBe("done");
  });
});

describe("drive does not spawn Codex when it is the brain", () => {
  it("spawns only the AGY lane and never a Codex harness", async () => {
    const owners: string[] = [];
    const result = await runDrive({
      goal: "Sửa createTask",
      plannerChoice: "mock",
      harnessTeam: ["agy"],
      brain: "codex",
      workspaceSource: "demo",
      cwd: workspaceRoot,
      spawn: true,
      spawnHarness: async ({ owner }) => {
        owners.push(owner);
        if (owner === "codex") {
          throw new Error("must not spawn a Codex harness when brain=codex");
        }
        return {
          owner,
          command: "agy",
          args: ["-p", ".c2x/briefs/agy.md"],
          exitCode: 0,
          skipped: false,
          reason: null,
        };
      },
    });
    expect(result.session.brain).toBe("codex");
    expect(result.session.harnessTeam).toEqual(["agy"]);
    expect(owners).toEqual(["agy"]);
    expect(result.spawns.map((item) => item.owner)).toEqual(["agy"]);
    expect(await readFile(path.join(workspaceRoot, ".c2x", "briefs", "agy.md"), "utf8")).toMatch(
      /OWNER:\s*agy/,
    );
    expect(result.session.state).toBe("DONE");
  });

  it("spawns only Codex when AGY is the brain", async () => {
    const owners: string[] = [];
    const result = await runDrive({
      goal: "Sửa createTask",
      plannerChoice: "mock",
      harnessTeam: ["codex"],
      brain: "agy",
      workspaceSource: "demo",
      cwd: workspaceRoot,
      spawn: true,
      spawnHarness: async ({ owner }) => {
        owners.push(owner);
        if (owner === "agy") {
          throw new Error("must not spawn AGY when brain=agy");
        }
        return {
          owner,
          command: "codex",
          args: ["exec"],
          exitCode: 0,
          skipped: false,
          reason: null,
        };
      },
    });
    expect(result.session.brain).toBe("agy");
    expect(result.session.harnessTeam).toEqual(["codex"]);
    expect(owners).toEqual(["codex"]);
    expect(result.spawns.map((item) => item.owner)).toEqual(["codex"]);
    expect(await readFile(path.join(workspaceRoot, ".c2x", "briefs", "codex.md"), "utf8")).toMatch(
      /OWNER:\s*codex/,
    );
    expect(result.session.state).toBe("DONE");
  });
});

describe("existing pipeline stays Claude Code + Codex + Grok", () => {
  it("does not fold AGY into --pipeline", async () => {
    const session = await runPlan({
      goal: "Sửa createTask",
      plannerChoice: "mock",
      harnessTeam: PIPELINE_HARNESS_TEAM,
      budgetTokens: 2000,
      workspaceSource: "demo",
      cwd: workspaceRoot,
    });
    expect(session.harnessTeam).toEqual(["codex", "claude-code", "grok-build"]);
    expect(session.brain).toBe("none");
    expect(PIPELINE_HARNESS_TEAM).not.toContain("agy");
  });
});

describe("catalog is the only place that names agy", () => {
  it("does not add case agy or case codex in studio, CLI, router, or packets", () => {
    const files = [
      "src/components/studio-client.tsx",
      "src/cli/c2x.ts",
      "src/core/providers/router.ts",
      "src/core/packets.ts",
    ];
    for (const file of files) {
      const text = readFileSync(path.join(process.cwd(), file), "utf8");
      expect(text).not.toMatch(/case ["']agy["']/);
      expect(text).not.toMatch(/case ["']codex["']/);
    }
    const cli = readFileSync(path.join(process.cwd(), "src/cli/c2x.ts"), "utf8");
    expect(cli).toMatch(/--brain-codex/);
    expect(cli).toMatch(/--brain-agy/);
    expect(cli).toMatch(/--pipeline-agy/);
    const install = readFileSync(path.join(process.cwd(), "install.sh"), "utf8");
    expect(install).toMatch(/c2x init --harness codex/);
    expect(install).not.toMatch(/--pipeline-agy|--brain-codex|--brain-agy/);
  });

  it("documents both brain seats in skill and README", () => {
    const skill = readFileSync(path.join(process.cwd(), "skill", "SKILL.md"), "utf8");
    const readme = readFileSync(path.join(process.cwd(), "README.md"), "utf8");
    const architecture = readFileSync(path.join(process.cwd(), "docs/architecture.md"), "utf8");
    for (const text of [skill, readme, architecture]) {
      expect(text).toMatch(/--brain-codex|--pipeline-agy/);
      expect(text).toMatch(/--brain-agy/);
      expect(text).toMatch(/AGY|agy/);
      expect(text).toMatch(/não|brain/i);
      expect(text).not.toMatch(/Jira Cloud OAuth app|Azure DevOps PAT in repo/i);
      expect(text).toMatch(/[Nn]o Jira OAuth|Không Jira OAuth|không dùng OAuth/i);
    }
    expect(skill).toMatch(/You are the brain/i);
    expect(skill).toMatch(/Do not write app code/i);
    expect(skill).toMatch(/\.c2x\/briefs\/agy\.md/);
    expect(skill).toMatch(/\.c2x\/briefs\/codex\.md/);
    expect(skill).toMatch(/You \*\*are\*\* the harness|you are the harness/i);
    expect(skill).toMatch(/\.claude\/skills/);
    expect(skill).toMatch(/--brain-agy --harness codex|brain=agy/);
  });
});
