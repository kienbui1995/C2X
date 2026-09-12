import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { planToBriefs } from "@/core/brief";
import { DEMO_FILES } from "@/core/fixtures/demo-workspace";
import { packWorkspace } from "@/core/packer";
import { PLANNER_SYSTEM_PROMPT, buildReviewPastePrompt, mockPlanFromPack } from "@/core/planner";
import { applyImportedReview } from "@/core/review-import";
import { importControlMessage, runPlan, runReview } from "@/core/run-loop";
import { createSession, normalizeSession } from "@/core/session";
import { upsertSession } from "@/core/store";
import type { SessionRecord } from "@/core/types";

let dataDir = "";

beforeEach(async () => {
  dataDir = await mkdtemp(path.join(os.tmpdir(), "c2x-"));
  process.env.FRUGAL_DATA_DIR = dataDir;
});

afterEach(async () => {
  delete process.env.FRUGAL_DATA_DIR;
  await rm(dataDir, { recursive: true, force: true });
});

describe("session.reviewPastePrompt", () => {
  it("starts null on a new session and survives normalize of legacy JSON", () => {
    const session = createSession({
      goal: "Sửa createTask",
      planner: "chatgpt-web",
      plannerChoice: "chatgpt-web",
      harnessTeam: ["codex", "claude-code"],
      budgetTokens: 4000,
      workspaceSource: "demo",
    });
    expect(session.reviewPastePrompt).toBeNull();

    const legacy = { ...session } as SessionRecord;
    delete (legacy as { reviewPastePrompt?: SessionRecord["reviewPastePrompt"] }).reviewPastePrompt;
    const restored = normalizeSession(legacy);
    expect(restored.reviewPastePrompt).toBeNull();
  });
});

describe("buildReviewPastePrompt", () => {
  it("asks the web planner for DONE|PLAN|BLOCKED without dumping file bodies", () => {
    const pack = packWorkspace({
      goal: "Sửa createTask",
      files: DEMO_FILES,
      budgetTokens: 2000,
    });
    const prompt = buildReviewPastePrompt({
      pack,
      taskId: "c2x_rev1",
      iteration: 1,
      changedFiles: ["src/lib/tasks.ts"],
      tests: "codex: not run\nclaude-code: 12 passed",
      diffStat: "1 file changed, 8 insertions(+)",
    });

    expect(prompt).toContain(PLANNER_SYSTEM_PROMPT);
    expect(prompt).toContain("TASK_ID: c2x_rev1");
    expect(prompt).toContain("src/lib/tasks.ts");
    expect(prompt).toContain("12 passed");
    expect(prompt).toContain("1 file changed, 8 insertions(+)");
    expect(prompt).toMatch(/STATE:\s*DONE\|PLAN\|BLOCKED|DONE, PLAN, or BLOCKED|DONE\|PLAN\|BLOCKED/);
    expect(prompt).not.toMatch(/-----BEGIN/);
    expect(prompt).not.toContain("function createTask");
  });
});

function sessionAfterExecute() {
  const pack = packWorkspace({
    goal: "Sửa createTask",
    files: DEMO_FILES,
    budgetTokens: 2000,
  });
  const plan = mockPlanFromPack(pack, "c2x_rev1", ["codex"]);
  const briefs = planToBriefs(plan);
  let session = createSession({
    goal: pack.goal,
    planner: "chatgpt-web",
    plannerChoice: "chatgpt-web",
    harnessTeam: ["codex"],
    budgetTokens: 2000,
    workspaceSource: "demo",
  });
  session = {
    ...session,
    state: "EXECUTED",
    pack,
    plan,
    briefs,
    brief: briefs[0] ?? null,
    harnessRuns: [
      {
        owner: "codex",
        state: "executed",
        changedFiles: ["src/lib/tasks.ts"],
        tests: "12 passed",
      },
    ],
  };
  return session;
}

describe("applyImportedReview", () => {
  it("accepts a web-chat DONE block after EXECUTED", () => {
    const next = applyImportedReview(
      sessionAfterExecute(),
      `[C2X]
STATE: DONE
TASK_ID: c2x_rev1
ITERATION: 1

SUMMARY:
Changed files match the brief.
`,
    );
    expect(next.state).toBe("DONE");
    expect(next.review?.state).toBe("DONE");
    expect(next.review?.summary).toMatch(/match/i);
  });

  it("rejects INIT as a review import", () => {
    expect(() =>
      applyImportedReview(
        sessionAfterExecute(),
        `[C2X]
STATE: INIT
TASK_ID: c2x_rev1
ITERATION: 0

GOAL:
nope
`,
      ),
    ).toThrow(/DONE|PLAN|BLOCKED|REVIEW/i);
  });
});

describe("runReview paste planner", () => {
  it("does not mark DONE until a web-chat review block is imported", async () => {
    let session = await runPlan({
      goal: "Sửa createTask",
      plannerChoice: "chatgpt-web",
      harnessTeam: ["codex"],
      budgetTokens: 2000,
      workspaceSource: "demo",
    });
    session = await importControlMessage({
      sessionId: session.id,
      raw: `[C2X]
STATE: PLAN
TASK_ID: ${session.id}
ITERATION: 1

GOAL:
Sửa createTask

RATIONALE:
Packed excerpts show the defect.

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
    await upsertSession({
      ...session,
      state: "EXECUTED",
      harnessRuns: session.harnessTeam.map((owner) => ({
        owner,
        state: "executed" as const,
        changedFiles: ["src/lib/tasks.ts"],
        tests: "12 passed",
      })),
    });

    const waiting = await runReview({
      sessionId: session.id,
      changedFiles: ["src/lib/tasks.ts"],
      tests: "12 passed",
    });
    expect(waiting.state).toBe("REVIEW");
    expect(waiting.review).toBeNull();
    expect(waiting.reviewPastePrompt).toContain(session.id);
    expect(waiting.reviewPastePrompt).toContain("src/lib/tasks.ts");

    const done = await importControlMessage({
      sessionId: session.id,
      raw: `[C2X]
STATE: DONE
TASK_ID: ${session.id}
ITERATION: 1

SUMMARY:
Looks good.
`,
    });
    expect(done.state).toBe("DONE");
    expect(done.review?.state).toBe("DONE");
  });
});
