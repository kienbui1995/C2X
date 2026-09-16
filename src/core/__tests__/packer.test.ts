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

  it("applies extraIgnore and never packs .c2x drops", () => {
    const pack = packWorkspace({
      goal: "keep.ts vendor",
      files: [
        { path: "src/keep.ts", content: "export const keep = 1;\n" },
        { path: "vendor/lib.ts", content: "export const vendor = 1;\n" },
        { path: ".c2x/briefs/codex.md", content: "OWNER: codex\n" },
      ],
      budgetTokens: 2000,
      extraIgnore: ["vendor"],
    });
    const paths = pack.excerpts.map((item) => item.path);
    expect(paths).toContain("src/keep.ts");
    expect(paths).not.toContain("vendor/lib.ts");
    expect(paths).not.toContain(".c2x/briefs/codex.md");
    expect(pack.tree).toContain("src/keep.ts");
    expect(pack.tree).not.toContain("vendor/lib.ts");
  });

  it("packs DESIGN.md and design/** when present and never treats them as a harness", () => {
    const noise = {
      path: "src/generated/noise.ts",
      content: `export const noise = ${JSON.stringify("keep ".repeat(400))};\n`,
    };
    const pack = packWorkspace({
      goal: "keep.ts vendor board",
      files: [
        { path: "src/keep.ts", content: "export const keep = 1;\n" },
        {
          path: "DESIGN.md",
          content: "# OpenDesign drop\nPrimary board layout for the task list.\n",
        },
        {
          path: "design/board.html",
          content: "<html><body>task board mock</body></html>\n",
        },
        noise,
      ],
      budgetTokens: 900,
    });
    const paths = pack.excerpts.map((item) => item.path);
    expect(paths).toContain("DESIGN.md");
    expect(paths).toContain("design/board.html");
    expect(pack.tree).toContain("DESIGN.md");
    expect(pack.skippedSensitive).not.toContain("DESIGN.md");
  });
});

