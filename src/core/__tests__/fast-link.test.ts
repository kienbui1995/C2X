import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { reusedPack } from "@/core/session";
import { importPlan, runPlan } from "@/core/run-loop";
import * as workspace from "@/core/workspace";

let dataDir = "";

beforeEach(async () => {
  dataDir = await mkdtemp(path.join(os.tmpdir(), "c2x-fast-"));
  process.env.FRUGAL_DATA_DIR = dataDir;
});

afterEach(async () => {
  delete process.env.FRUGAL_DATA_DIR;
  await rm(dataDir, { recursive: true, force: true });
  vi.restoreAllMocks();
});

describe("reusedPack", () => {
  it("returns the existing pack and importPlan does not walk the repo", async () => {
    const session = await runPlan({
      goal: "Sửa createTask",
      plannerChoice: "chatgpt-web",
      harnessTeam: ["codex"],
      budgetTokens: 2000,
      workspaceSource: "demo",
    });
    expect(session.pack).not.toBeNull();
    expect(reusedPack(session)).toBe(session.pack);

    const walk = vi.spyOn(workspace, "loadWorkspaceFiles");
    const next = await importPlan({
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
    expect(next.pack).toBe(session.pack);
    expect(next.pack?.tree).toBe(session.pack?.tree);
    expect(next.pack?.packedTokens).toBe(session.pack?.packedTokens);
  });

  it("throws when the session was never packed", async () => {
    const session = await runPlan({
      goal: "Sửa createTask",
      plannerChoice: "chatgpt-web",
      harnessTeam: ["codex"],
      budgetTokens: 2000,
      workspaceSource: "demo",
    });
    expect(() => reusedPack({ ...session, pack: null })).toThrow(/pack|reuse/i);
  });
});
