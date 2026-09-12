import { readFileSync } from "node:fs";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { planToBriefs, renderCodexBrief } from "@/core/brief";
import { DEMO_FILES } from "@/core/fixtures/demo-workspace";
import {
  persistWorkspaceBriefs,
  syncWorkspaceBriefDrops,
  workspaceBriefPath,
  writeWorkspaceBriefDrop,
} from "@/core/harness";
import { packWorkspace } from "@/core/packer";
import { mockPlanFromPack } from "@/core/planner";
import { importPlan, runPlan } from "@/core/run-loop";
import { createSession } from "@/core/session";
import * as workspace from "@/core/workspace";

function sessionWithTeam(team: readonly ("codex" | "claude-code")[]) {
  const pack = packWorkspace({
    goal: "Sửa createTask",
    files: DEMO_FILES,
    budgetTokens: 2000,
  });
  const created = createSession({
    goal: pack.goal,
    planner: "mock",
    plannerChoice: "mock",
    harnessTeam: team,
    budgetTokens: 2000,
    workspaceSource: "demo",
  });
  const plan = mockPlanFromPack(pack, created.id, team);
  const briefs = planToBriefs(plan);
  return { ...created, plan, briefs, brief: briefs[0] ?? null, pack };
}

describe("writeWorkspaceBriefDrop", () => {
  it("writes only that owner brief under .c2x/briefs/<harness>.md", async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), "c2x-ws-"));
    const session = sessionWithTeam(["codex", "claude-code"]);
    const briefPath = await writeWorkspaceBriefDrop({
      workspaceRoot: root,
      session,
      owner: "codex",
    });
    expect(briefPath).toBe(path.join(root, ".c2x", "briefs", "codex.md"));
    expect(briefPath).toBe(workspaceBriefPath(root, "codex"));
    const text = await readFile(briefPath, "utf8");
    expect(text).toBe(renderCodexBrief(session.briefs[0]!));
    expect(text).toMatch(/OWNER:\s*codex/);
    expect(text).not.toMatch(/OWNER:\s*claude-code/);
    await rm(root, { recursive: true, force: true });
  });

  it("throws when the owner has no precomputed brief", async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), "c2x-ws-"));
    const session = sessionWithTeam(["codex"]);
    await expect(
      writeWorkspaceBriefDrop({
        workspaceRoot: root,
        session,
        owner: "claude-code",
      }),
    ).rejects.toThrow(/brief|owner/i);
    await rm(root, { recursive: true, force: true });
  });
});

describe("syncWorkspaceBriefDrops", () => {
  it("writes every teammate and removes leftover harness files only", async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), "c2x-sync-"));
    const dir = path.join(root, ".c2x", "briefs");
    await mkdir(dir, { recursive: true });
    await writeFile(path.join(dir, "kiro-cli.md"), "stale", "utf8");
    await writeFile(path.join(dir, "notes.md"), "keep", "utf8");
    const session = sessionWithTeam(["codex", "claude-code"]);
    const written = await syncWorkspaceBriefDrops({ workspaceRoot: root, session });
    expect(written).toEqual([
      path.join(dir, "codex.md"),
      path.join(dir, "claude-code.md"),
    ]);
    expect(await readFile(path.join(dir, "codex.md"), "utf8")).toMatch(/OWNER:\s*codex/);
    expect(await readFile(path.join(dir, "claude-code.md"), "utf8")).toMatch(
      /OWNER:\s*claude-code/,
    );
    await expect(readFile(path.join(dir, "kiro-cli.md"), "utf8")).rejects.toMatchObject({
      code: "ENOENT",
    });
    expect(await readFile(path.join(dir, "notes.md"), "utf8")).toBe("keep");
    await rm(root, { recursive: true, force: true });
  });
});

let dataDir = "";
let wsRoot = "";

beforeEach(async () => {
  dataDir = await mkdtemp(path.join(os.tmpdir(), "c2x-drop-data-"));
  wsRoot = await mkdtemp(path.join(os.tmpdir(), "c2x-drop-ws-"));
  process.env.FRUGAL_DATA_DIR = dataDir;
  process.env.C2X_WORKSPACE = wsRoot;
});

afterEach(async () => {
  delete process.env.FRUGAL_DATA_DIR;
  delete process.env.C2X_WORKSPACE;
  await rm(dataDir, { recursive: true, force: true });
  await rm(wsRoot, { recursive: true, force: true });
  vi.restoreAllMocks();
});

describe("persistWorkspaceBriefs", () => {
  it("is a no-op until the session is PLAN with briefs", async () => {
    const session = sessionWithTeam(["codex"]);
    const paths = await persistWorkspaceBriefs({ ...session, state: "INIT", briefs: [] }, wsRoot);
    expect(paths).toEqual([]);
  });

  it("drops briefs on mock runPlan and importPlan without walking the repo", async () => {
    const session = await runPlan({
      goal: "Sửa createTask",
      plannerChoice: "mock",
      harnessTeam: ["codex", "claude-code"],
      budgetTokens: 2000,
      workspaceSource: "demo",
    });
    expect(session.state).toBe("PLAN");
    const codexText = await readFile(path.join(wsRoot, ".c2x", "briefs", "codex.md"), "utf8");
    expect(codexText).toMatch(/OWNER:\s*codex/);
    expect(codexText).not.toMatch(/OWNER:\s*claude-code/);

    const walk = vi.spyOn(workspace, "loadWorkspaceFiles");
    await importPlan({
      sessionId: session.id,
      raw: `[C2X]
STATE: PLAN
TASK_ID: ${session.id}
ITERATION: 1

GOAL:
Sửa createTask

RATIONALE:
Reuse the packed tree.

ACTIONS:
1. Fix createTask persistence.

FILES_LIKELY_INVOLVED:
- src/lib/tasks.ts

TESTS:
- unit

SUCCESS_CRITERIA:
- tasks persist

RISKS:
- none

PACKETS:
  ## owner=codex role=general
  ACTIONS:
  1. Fix createTask persistence.
  FILES:
  - src/lib/tasks.ts
  TESTS:
  - unit
  SUCCESS_CRITERIA:
  - persist
`,
    });
    expect(walk).not.toHaveBeenCalled();
    expect(await readFile(path.join(wsRoot, ".c2x", "briefs", "codex.md"), "utf8")).toMatch(
      /OWNER:\s*codex/,
    );
  });
});

describe("skill and gitignore for workspace drops", () => {
  it("tells each harness to read only its own drop path", () => {
    const skill = readFileSync(path.join(process.cwd(), "skill", "SKILL.md"), "utf8");
    expect(skill).toMatch(/\.c2x\/briefs\/<your-harness-id>\.md|\.c2x\/briefs\/<id/);
    expect(skill).toMatch(/Do not read other files/i);
    expect(skill).toMatch(/Do not plan or review/i);
    expect(skill).toContain("claude-code");
    const gi = readFileSync(path.join(process.cwd(), ".gitignore"), "utf8");
    expect(gi).toMatch(/\.c2x\/briefs\//);
  });
});
