import { describe, expect, it } from "vitest";
import { mergeConfig } from "@/core/config";
import { DEMO_FILES } from "@/core/fixtures/demo-workspace";
import { packWorkspace } from "@/core/packer";
import { mockPlanFromPack } from "@/core/planner";
import { planToBrief } from "@/core/brief";
import { HARNESS_IDS, isHarnessId, PROVIDER_IDS, ROLES, type PlannerChoice } from "@/core/types";
import { isWebSubscriptionPlanner } from "@/core/providers/catalog";
import { resolvePlanner, routeRole } from "@/core/providers/router";
import { estimateSavings } from "@/core/savings";

const WEB_PLANNERS = ["chatgpt-web", "claude-web", "gemini-web"] as const;

describe("routeRole", () => {
  const config = mergeConfig({
    enabledProviders: ["mock", "chatgpt-web", "claude-web", "gemini-web", "groq"],
    defaultHarness: "codex",
  });

  it("never sends plan or review to Codex or Claude Code", () => {
    const choices: PlannerChoice[] = ["auto", ...PROVIDER_IDS];
    for (const role of ROLES) {
      if (role === "execute") {
        continue;
      }
      for (const choice of choices) {
        const decision = routeRole({
          role,
          choice,
          harness: "claude-code",
          config,
          hasKey: () => true,
        });
        expect(HARNESS_IDS).not.toContain(decision.provider);
      }
    }
  });

  it("routes execute to the selected harness only", () => {
    const toCodex = routeRole({
      role: "execute",
      choice: "groq",
      harness: "codex",
      config,
      hasKey: () => false,
    });
    expect(toCodex.provider).toBe("codex");

    const toClaudeCode = routeRole({
      role: "execute",
      choice: "claude-web",
      harness: "claude-code",
      config,
      hasKey: () => false,
    });
    expect(toClaudeCode.provider).toBe("claude-code");

    const toGrok = routeRole({
      role: "execute",
      choice: "chatgpt-web",
      harness: "grok-build",
      config,
      hasKey: () => false,
    });
    expect(toGrok.provider).toBe("grok-build");

    const toOpenCode = routeRole({
      role: "execute",
      choice: "auto",
      harness: "opencode",
      config,
      hasKey: () => false,
    });
    expect(toOpenCode.provider).toBe("opencode");
  });

  it("auto-picks a web/subscription planner when one is enabled", () => {
    const decision = routeRole({
      role: "plan",
      choice: "auto",
      config,
      hasKey: (id) => id === "groq",
    });
    expect(WEB_PLANNERS).toContain(decision.provider);
    expect(HARNESS_IDS).not.toContain(decision.provider);
    if (!isHarnessId(decision.provider)) {
      expect(isWebSubscriptionPlanner(decision.provider)).toBe(true);
    }
  });

  it("prefers any enabled web planner over a cheaper paid API", () => {
    const slim = mergeConfig({
      enabledProviders: ["groq", "claude-web"],
    });
    const decision = routeRole({
      role: "review",
      choice: "auto",
      config: slim,
      hasKey: () => true,
    });
    expect(decision.provider).toBe("claude-web");
  });

  it("auto-picks gemini-web before the Gemini API when both are ready", () => {
    const both = mergeConfig({
      enabledProviders: ["gemini", "gemini-web"],
    });
    const decision = routeRole({
      role: "plan",
      choice: "auto",
      config: both,
      hasKey: () => true,
    });
    expect(decision.provider).toBe("gemini-web");
  });
});

describe("resolvePlanner", () => {
  it("never resolves plan/review to a harness id", () => {
    const config = mergeConfig({
      enabledProviders: ["chatgpt-web", "claude-web"],
      defaultHarness: "claude-code",
    });
    const planner = resolvePlanner({
      choice: "auto",
      config,
      hasKey: () => false,
    });
    expect(HARNESS_IDS).not.toContain(planner);
    expect(WEB_PLANNERS).toContain(planner);
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

  it("counts scarce harness quota separately from large web-chat quota", () => {
    const pack = packWorkspace({
      goal: "Fix createTask",
      files: DEMO_FILES,
      budgetTokens: 2000,
    });
    const brief = planToBrief(mockPlanFromPack(pack, "c2x_quota"));
    const web = estimateSavings({ pack, brief, planner: "claude-web" });
    expect(web.naiveHarnessTurns).toBeGreaterThan(web.c2xHarnessTurns);
    expect(web.webChatTurns).toBeGreaterThan(0);
    expect(web.savedHarnessTurns).toBeGreaterThan(0);

    const api = estimateSavings({ pack, brief, planner: "groq" });
    expect(api.webChatTurns).toBe(0);
    expect(api.c2xHarnessTurns).toBe(1);
  });
});
