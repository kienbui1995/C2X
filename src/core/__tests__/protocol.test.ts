import { describe, expect, it } from "vitest";
import { planToBrief, renderCodexBrief } from "@/core/brief";
import { mockPlanFromPack } from "@/core/planner";
import { packWorkspace } from "@/core/packer";
import { DEMO_FILES } from "@/core/fixtures/demo-workspace";
import {
  CONTROL_BUDGET_DEFAULT,
  assertControlBudget,
  canTransition,
  encodeControlMessage,
  handoffMessage,
  messageToPlan,
  parseControlMessage,
} from "@/core/protocol";

describe("protocol", () => {
  it("round-trips a PLAN message", () => {
    const pack = packWorkspace({
      goal: "Fix createTask",
      files: DEMO_FILES,
      budgetTokens: 2000,
    });
    const plan = mockPlanFromPack(pack, "c2x_test");
    const raw = encodeControlMessage({
      state: "PLAN",
      taskId: plan.taskId,
      iteration: 1,
      sections: {
        GOAL: plan.goal,
        ACTIONS: plan.actions.map((item, index) => `${index + 1}. ${item}`).join("\n"),
      },
    });
    const parsed = parseControlMessage(raw);
    expect(parsed.state).toBe("PLAN");
    expect(messageToPlan(parsed).actions.length).toBeGreaterThan(0);
  });

  it("accepts legacy [C2C] tags", () => {
    const parsed = parseControlMessage(`[C2C]
STATE: DONE
TASK_ID: c2c_ab12
ITERATION: 2

SUMMARY:
Looks good.
`);
    expect(parsed.state).toBe("DONE");
    expect(parsed.taskId).toBe("c2c_ab12");
  });

  it("rejects illegal transitions", () => {
    expect(canTransition("INIT", "PLAN")).toBe(true);
    expect(canTransition("INIT", "DONE")).toBe(false);
    expect(canTransition("EXECUTED", "REVIEW")).toBe(true);
  });

  it("keeps the Codex brief smaller than the packed workspace", () => {
    const pack = packWorkspace({
      goal: "Fix createTask and persist the status filter",
      files: DEMO_FILES,
      budgetTokens: 3000,
    });
    const brief = planToBrief(mockPlanFromPack(pack, "c2x_brief"));
    expect(brief.tokenEstimate).toBeLessThan(pack.packedTokens);
    expect(renderCodexBrief(brief).startsWith("[C2X]")).toBe(true);
  });
});

describe("handoffMessage", () => {
  it("round-trips a HANDOFF checkpoint under the 1200-token budget", () => {
    const raw = handoffMessage({
      taskId: "c2x_hand",
      iteration: 3,
      originalGoal: "Add a dark mode toggle",
      progress: "PLAN imported; brief copied to opencode.",
      currentState: "EXECUTED",
      knownIssues: "Tests not run.",
      nextExpectedStep: "Paste REVIEW into the web chat.",
    });
    expect(raw).toContain("[C2X]");
    expect(raw).toMatch(/STATE:\s*HANDOFF/);
    expect(raw).toContain("ORIGINAL_GOAL");
    expect(raw).toContain("Add a dark mode toggle");
    expect(raw).toContain("PROGRESS");
    expect(raw).toContain("CURRENT_STATE");
    expect(raw).toContain("EXECUTED");
    expect(raw).toContain("KNOWN_ISSUES");
    expect(raw).toContain("NEXT_EXPECTED_STEP");
    const parsed = parseControlMessage(raw);
    expect(parsed.state).toBe("HANDOFF");
    expect(parsed.taskId).toBe("c2x_hand");
    expect(parsed.iteration).toBe(3);
    expect(parsed.sections.ORIGINAL_GOAL).toContain("dark mode");
    assertControlBudget(raw, CONTROL_BUDGET_DEFAULT);
  });
});
