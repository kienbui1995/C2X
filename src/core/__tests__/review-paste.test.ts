import { describe, expect, it } from "vitest";
import { DEMO_FILES } from "@/core/fixtures/demo-workspace";
import { packWorkspace } from "@/core/packer";
import { PLANNER_SYSTEM_PROMPT, buildReviewPastePrompt } from "@/core/planner";
import { createSession, normalizeSession } from "@/core/session";
import type { SessionRecord } from "@/core/types";

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

    const { reviewPastePrompt: _dropped, ...legacy } = session;
    const restored = normalizeSession(legacy as SessionRecord);
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
