import { describe, expect, it } from "vitest";
import { DEMO_FILES } from "@/core/fixtures/demo-workspace";
import { packWorkspace } from "@/core/packer";

describe("packWorkspace", () => {
  it("stays at or under the token budget", () => {
    const bulky = {
      path: "src/generated/noise.ts",
      content: `export const noise = ${JSON.stringify("x".repeat(4000))};\n`,
    };
    const pack = packWorkspace({
      goal: "Sửa POST /api/tasks và giữ bộ lọc status trên URL",
      files: [...DEMO_FILES, bulky],
      budgetTokens: 1200,
    });
    expect(pack.packedTokens).toBeLessThanOrEqual(pack.budgetTokens);
    expect(pack.rawTokens).toBeGreaterThan(pack.packedTokens);
    expect(pack.excerpts.length).toBeGreaterThan(0);
  });

  it("never packs secret files", () => {
    const pack = packWorkspace({
      goal: "check secrets",
      files: [
        ...DEMO_FILES,
        { path: ".env.local", content: "OPENAI_API_KEY=sk-secret" },
        { path: "keys/id_rsa", content: "-----BEGIN PRIVATE KEY-----" },
      ],
      budgetTokens: 4000,
    });
    expect(pack.skippedSensitive).toEqual(expect.arrayContaining([".env.local", "keys/id_rsa"]));
    expect(pack.excerpts.every((item) => !item.path.includes(".env"))).toBe(true);
  });

  it("prefers files that match the goal", () => {
    const pack = packWorkspace({
      goal: "createTask discarded copy",
      files: DEMO_FILES,
      budgetTokens: 2000,
    });
    expect(pack.excerpts.some((item) => item.path.includes("tasks.ts"))).toBe(true);
  });
});
