import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { execFile } from "node:child_process";
import os from "node:os";
import path from "node:path";
import { promisify } from "node:util";
import { describe, expect, it } from "vitest";
import { planToBriefs } from "@/core/brief";
import { DEMO_FILES } from "@/core/fixtures/demo-workspace";
import { collectGitMetadata } from "@/core/git-meta";
import { packWorkspace } from "@/core/packer";
import { mockPlanFromPack } from "@/core/planner";
import { executedMessage } from "@/core/protocol";
import { applyExecutionRecord } from "@/core/records";
import { createSession, normalizeSession } from "@/core/session";
import { isExecutionExitStatus, type SessionRecord } from "@/core/types";

const execFileAsync = promisify(execFile);

describe("ExecutionRecord on session", () => {
  it("normalizes missing records to an empty array", () => {
    expect(isExecutionExitStatus("ok")).toBe(true);
    expect(isExecutionExitStatus("nope")).toBe(false);
    const session = createSession({
      goal: "x",
      planner: "mock",
      plannerChoice: "mock",
      harnessTeam: ["codex"],
      budgetTokens: 4000,
      workspaceSource: "demo",
    });
    expect(session.records).toEqual([]);
    const { records: _r, ...legacy } = session;
    expect(normalizeSession(legacy as SessionRecord).records).toEqual([]);
  });
});

describe("collectGitMetadata", () => {
  it("reads porcelain paths and a stat line from a temp repo", async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), "c2x-git-"));
    await execFileAsync("git", ["-C", root, "init"]);
    await execFileAsync("git", ["-C", root, "config", "user.email", "c2x@example.com"]);
    await execFileAsync("git", ["-C", root, "config", "user.name", "c2x"]);
    await writeFile(path.join(root, "README.md"), "one\n", "utf8");
    await execFileAsync("git", ["-C", root, "add", "README.md"]);
    await execFileAsync("git", ["-C", root, "commit", "-m", "init"]);
    await writeFile(path.join(root, "README.md"), "two\n", "utf8");
    await writeFile(path.join(root, "src-new.ts"), "export const x = 1;\n", "utf8");

    const meta = await collectGitMetadata(root);
    expect(meta.isGit).toBe(true);
    expect(meta.changedFiles.some((item) => item.endsWith("README.md"))).toBe(true);
    expect(meta.diffStat.length).toBeGreaterThan(0);
    expect(meta.diffStat).not.toContain("export const x");

    await rm(root, { recursive: true, force: true });
  });

  it("returns isGit false outside a repository", async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), "c2x-nogit-"));
    const meta = await collectGitMetadata(root);
    expect(meta.isGit).toBe(false);
    expect(meta.changedFiles).toEqual([]);
    await rm(root, { recursive: true, force: true });
  });
});

describe("applyExecutionRecord", () => {
  it("keeps the session EXECUTING until the whole team records and EXECUTED stays metadata-only", () => {
    const pack = packWorkspace({
      goal: "Sửa createTask",
      files: DEMO_FILES,
      budgetTokens: 2000,
    });
    const plan = mockPlanFromPack(pack, "c2x_rec", ["codex", "claude-code"]);
    const briefs = planToBriefs(plan);
    const session = {
      ...createSession({
        goal: pack.goal,
        planner: "mock",
        plannerChoice: "mock",
        harnessTeam: ["codex", "claude-code"],
        budgetTokens: 2000,
        workspaceSource: "demo",
      }),
      state: "PLAN" as const,
      pack,
      plan,
      briefs,
      brief: briefs[0] ?? null,
    };
    const next = applyExecutionRecord(session, {
      taskId: session.id,
      iteration: plan.iteration,
      owner: "codex",
      changedFiles: ["src/lib/tasks.ts"],
      tests: "recorded",
      exitStatus: "ok",
      recordedAt: new Date().toISOString(),
      diffStat: "1 file changed, 8 insertions(+)",
    });
    expect(next.state).toBe("EXECUTING");
    expect(next.records).toHaveLength(1);
    expect(next.records[0]?.owner).toBe("codex");
    const raw = executedMessage({
      taskId: session.id,
      iteration: 1,
      changedFiles: 1,
      tests: "codex: recorded",
      team: ["codex", "claude-code"],
    });
    expect(raw).not.toContain("@@");
    expect(raw).not.toContain(next.records[0]?.diffStat ?? "@@");
  });
});
