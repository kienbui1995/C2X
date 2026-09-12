import { describe, expect, it } from "vitest";
import { clampBudget, estimateTokens, formatTokens } from "@/core/tokens";

describe("estimateTokens", () => {
  it("returns 0 for empty text", () => {
    expect(estimateTokens("")).toBe(0);
  });

  it("grows with longer text", () => {
    const short = estimateTokens("fix the filter");
    const long = estimateTokens("fix the filter\n".repeat(40));
    expect(long).toBeGreaterThan(short);
  });
});

describe("formatTokens", () => {
  it("uses k for thousands", () => {
    expect(formatTokens(1200)).toBe("1.2k");
    expect(formatTokens(12_400)).toBe("12k");
  });
});

describe("clampBudget", () => {
  it("keeps budgets inside the supported window", () => {
    expect(clampBudget(12)).toBe(800);
    expect(clampBudget(99_000)).toBe(16_000);
    expect(clampBudget(Number.NaN)).toBe(4000);
  });
});
