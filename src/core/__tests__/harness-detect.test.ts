import { chmod, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { planToBriefs, renderCodexBrief } from "@/core/brief";
import { DEMO_FILES } from "@/core/fixtures/demo-workspace";
import { defaultClaudeSkillHome, defaultSkillHomes } from "@/core/codex-config";
import {
  DETECT_CACHE_TTL_MS,
  binariesForHarness,
  clearDetectCache,
  detectHarness,
  installSkill,
  installSkills,
  writeHarnessBrief,
} from "@/core/harness";
import { packWorkspace } from "@/core/packer";
import { mockPlanFromPack } from "@/core/planner";
import { getHarness } from "@/core/providers/catalog";
import { createSession } from "@/core/session";
import { HARNESS_IDS } from "@/core/types";

describe("binariesForHarness", () => {
  it("lists at least one binary name for every harness id", () => {
    for (const id of HARNESS_IDS) {
      expect(binariesForHarness(id).length).toBeGreaterThan(0);
    }
    expect(binariesForHarness("grok-build")).toEqual([...getHarness("grok-build").binaries]);
    expect(binariesForHarness("kiro-cli")).toEqual(["kiro"]);
    expect(binariesForHarness("agy")).toEqual(["agy"]);
  });
});

describe("detectHarness", () => {
  it("finds a fake claude binary on PATH and stays ok:false when missing", async () => {
    const dir = await mkdtemp(path.join(os.tmpdir(), "c2x-bin-"));
    const fake = path.join(dir, "claude");
    await writeFile(fake, "#!/bin/sh\necho ok\n", "utf8");
    await chmod(fake, 0o755);
    const prev = process.env.PATH;
    process.env.PATH = dir;
    const found = await detectHarness("claude-code");
    process.env.PATH = "/nonexistent-c2x-path";
    const missing = await detectHarness("claude-code");
    process.env.PATH = prev;
    expect(found.ok).toBe(true);
    expect(found.binary).toBe(fake);
    expect(missing.ok).toBe(false);
    expect(missing.binary).toBeNull();
    expect(missing.hintVi.length).toBeGreaterThan(10);
    await rm(dir, { recursive: true, force: true });
  });
});

describe("detectHarness cache", () => {
  it("reuses a PATH hit inside TTL and misses after expiry or clear", async () => {
    clearDetectCache();
    const dir = await mkdtemp(path.join(os.tmpdir(), "c2x-cache-"));
    const fake = path.join(dir, "claude");
    await writeFile(fake, "#!/bin/sh\necho ok\n", "utf8");
    await chmod(fake, 0o755);
    const prev = process.env.PATH;
    process.env.PATH = dir;
    const t0 = 1_000;
    const found = await detectHarness("claude-code", () => t0);
    await rm(dir, { recursive: true, force: true });
    const cached = await detectHarness("claude-code", () => t0 + 100);
    expect(DETECT_CACHE_TTL_MS).toBe(30_000);
    expect(cached.ok).toBe(true);
    expect(cached.binary).toBe(found.binary);
    const expired = await detectHarness("claude-code", () => t0 + DETECT_CACHE_TTL_MS + 1);
    expect(expired.ok).toBe(false);
    process.env.PATH = dir;
    const dir2 = await mkdtemp(path.join(os.tmpdir(), "c2x-cache2-"));
    await writeFile(path.join(dir2, "claude"), "#!/bin/sh\n", "utf8");
    await chmod(path.join(dir2, "claude"), 0o755);
    process.env.PATH = dir2;
    clearDetectCache();
    const again = await detectHarness("claude-code", () => t0);
    expect(again.ok).toBe(true);
    process.env.PATH = prev;
    await rm(dir2, { recursive: true, force: true });
  });
});

describe("writeHarnessBrief", () => {
  it("writes only that owner brief under data/briefs", async () => {
    const pack = packWorkspace({
      goal: "Sửa createTask",
      files: DEMO_FILES,
      budgetTokens: 2000,
    });
    const created = createSession({
      goal: pack.goal,
      planner: "mock",
      plannerChoice: "mock",
      harnessTeam: ["codex", "claude-code"],
      budgetTokens: 2000,
      workspaceSource: "demo",
    });
    const plan = mockPlanFromPack(pack, created.id, ["codex", "claude-code"]);
    const briefs = planToBriefs(plan);
    const session = { ...created, plan, briefs, brief: briefs[0] ?? null };
    const dir = await mkdtemp(path.join(os.tmpdir(), "c2x-data-"));
    const briefPath = await writeHarnessBrief({ session, owner: "codex", dataDir: dir });
    expect(briefPath).toBe(path.join(dir, "briefs", `${session.id}.codex.c2x.md`));
    const text = await readFile(briefPath, "utf8");
    expect(text).toBe(renderCodexBrief(session.briefs[0]!));
    expect(text).toMatch(/OWNER:\s*codex/);
    expect(text).not.toMatch(/OWNER:\s*claude-code/);
    await rm(dir, { recursive: true, force: true });
  });
});

describe("installSkill", () => {
  it("copies SKILL.md into a fake skill home and embeds the repo path", async () => {
    const skillHome = await mkdtemp(path.join(os.tmpdir(), "c2x-skill-"));
    const repoRoot = path.join(skillHome, "repo");
    const dest = await installSkill({ repoRoot, skillHome });
    expect(dest).toBe(path.join(skillHome, "chat-to-x", "SKILL.md"));
    const text = await readFile(dest, "utf8");
    expect(text).toContain(repoRoot);
    expect(text).not.toContain("replace-with-absolute-path");
    expect(text).toMatch(/c2x skill-install/);
    expect(text).toMatch(/\.c2x\/briefs\//);
    expect(text).toMatch(/Do not read other/);
    expect(text).toMatch(/--no-spawn/);
    expect(text).toMatch(/You \*\*are\*\* the harness|you are the harness/i);
    await rm(skillHome, { recursive: true, force: true });
  });

  it("writes Codex homes and ~/.claude/skills from injected fake homes", async () => {
    expect(defaultClaudeSkillHome("/home/alice")).toBe(
      path.join("/home/alice", ".claude", "skills"),
    );
    expect(defaultSkillHomes("/home/alice")).toEqual([
      path.join("/home/alice", ".agents", "skills"),
      path.join("/home/alice", ".codex", "skills"),
      path.join("/home/alice", ".claude", "skills"),
      path.join("/home/alice", ".gemini", "antigravity-cli", "skills"),
    ]);
    const root = await mkdtemp(path.join(os.tmpdir(), "c2x-skills-"));
    const agents = path.join(root, ".agents", "skills");
    const codex = path.join(root, ".codex", "skills");
    const claude = path.join(root, ".claude", "skills");
    const dests = await installSkills({
      repoRoot: process.cwd(),
      skillHomes: [agents, codex, claude],
    });
    expect(dests).toEqual([
      path.join(agents, "chat-to-x", "SKILL.md"),
      path.join(codex, "chat-to-x", "SKILL.md"),
      path.join(claude, "chat-to-x", "SKILL.md"),
    ]);
    expect(await readFile(dests[2]!, "utf8")).toMatch(/c2x skill-install/);
    await rm(root, { recursive: true, force: true });
  });
});
