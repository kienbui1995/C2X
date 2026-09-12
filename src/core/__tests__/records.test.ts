import { describe, expect, it } from "vitest";
import { createSession, normalizeSession } from "@/core/session";
import { isExecutionExitStatus, type SessionRecord } from "@/core/types";

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
