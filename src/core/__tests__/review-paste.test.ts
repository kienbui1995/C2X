import { describe, expect, it } from "vitest";
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
