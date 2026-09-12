import { describe, expect, it } from "vitest";
import { mergeConfig } from "@/core/config";
import { DEMO_FILES } from "@/core/fixtures/demo-workspace";
import { packWorkspace } from "@/core/packer";
import { mockPlanFromPack } from "@/core/planner";
import { planToBrief } from "@/core/brief";
import { routeRole } from "@/core/providers/router";
import { estimateSavings } from "@/core/savings";

describe("routeRole", () => {
  const config = mergeConfig({
    enabledProviders: ["mock", "chatgpt-web", "groq"],
  });

  it("always sends execute to Codex", () => {
    const decision = routeRole({
      role: "execute",
      choice: "groq",
      config,
      hasKey: () => false,
    });
    expect(decision.provider).toBe("codex");
  });

  it("auto-picks a free planner when paid keys are missing", () => {
    const decision = routeRole({
      role: "plan",
      choice: "auto",
      config,
      hasKey: () => false,
    });
    expect(decision.provider === "mock" || decision.provider === "chatgpt-web").toBe(true);
  });
});

describe("estimateSavings", () => {
  it("reports Codex token savings versus a naive dump", () => {
    const pack = packWorkspace({
      goal: "Fix createTask",
      files: DEMO_FILES,
      budgetTokens: 2000,
    });
    const brief = planToBrief(mockPlanFromPack(pack, "c2x_save"));
    const ledger = estimateSavings({ pack, brief, planner: "chatgpt-web" });
    expect(ledger.savedCodexTokens).toBeGreaterThan(0);
    expect(ledger.c2xCodexTotal).toBeLessThan(ledger.naiveCodexTotal);
    expect(ledger.c2xCostUsd).toBeLessThan(ledger.naiveCostUsd);
  });
});
