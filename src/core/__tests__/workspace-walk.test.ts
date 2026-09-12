import { describe, expect, it } from "vitest";
import { DEMO_FILES } from "@/core/fixtures/demo-workspace";
import {
  loadWorkspaceFiles,
  MAX_BYTES,
  MAX_FILES,
  MAX_WALK_MS,
} from "@/core/workspace";
import { isIgnoredPath } from "@/core/sensitive";

describe("workspace speed caps", () => {
  it("exports hard caps and keeps demo off disk", async () => {
    expect(MAX_FILES).toBe(80);
    expect(MAX_BYTES).toBe(120_000);
    expect(MAX_WALK_MS).toBe(250);
    expect(isIgnoredPath("node_modules/foo/index.js")).toBe(true);
    expect(isIgnoredPath(".git/config")).toBe(true);
    expect(isIgnoredPath(".next/cache/x")).toBe(true);
    const files = await loadWorkspaceFiles("demo");
    expect(files).toEqual(DEMO_FILES);
  });

  it("stops a repo walk when the clock hits MAX_WALK_MS", async () => {
    let t = 0;
    const files = await loadWorkspaceFiles("repo", () => {
      t += 300;
      return t;
    });
    expect(files.length).toBeLessThanOrEqual(MAX_FILES);
    expect(files.length).toBeLessThanOrEqual(8);
  });
});
