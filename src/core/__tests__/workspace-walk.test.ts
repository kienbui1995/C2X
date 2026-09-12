import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { DEMO_FILES } from "@/core/fixtures/demo-workspace";
import { isIgnoredPath } from "@/core/sensitive";
import {
  loadC2xIgnore,
  loadWorkspaceFiles,
  MAX_BYTES,
  MAX_FILES,
  MAX_WALK_MS,
} from "@/core/workspace";

describe("workspace speed caps", () => {
  it("exports hard caps and keeps demo off disk", async () => {
    expect(MAX_FILES).toBe(80);
    expect(MAX_BYTES).toBe(120_000);
    expect(MAX_WALK_MS).toBe(250);
    expect(isIgnoredPath("node_modules/foo/index.js")).toBe(true);
    expect(isIgnoredPath(".git/config")).toBe(true);
    expect(isIgnoredPath(".next/cache/x")).toBe(true);
    expect(isIgnoredPath(".c2x/briefs/codex.md")).toBe(true);
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

describe(".c2xignore", () => {
  let root = "";
  let prevWorkspace: string | undefined;

  afterEach(async () => {
    if (prevWorkspace === undefined) {
      delete process.env.C2X_WORKSPACE;
    } else {
      process.env.C2X_WORKSPACE = prevWorkspace;
    }
    if (root) {
      await rm(root, { recursive: true, force: true });
    }
  });

  it("skips comments and blank lines", async () => {
    root = await mkdtemp(path.join(os.tmpdir(), "c2x-ignore-parse-"));
    await writeFile(
      path.join(root, ".c2xignore"),
      "# skip vendor dumps\n\nvendor\n  tmp  \n",
      "utf8",
    );
    expect(await loadC2xIgnore(root)).toEqual(["vendor", "tmp"]);
    expect(await loadC2xIgnore(path.join(root, "missing"))).toEqual([]);
  });

  it("does not read .c2xignore when the workspace is demo", async () => {
    prevWorkspace = process.env.C2X_WORKSPACE;
    root = await mkdtemp(path.join(os.tmpdir(), "c2x-ignore-demo-"));
    await writeFile(path.join(root, ".c2xignore"), "src\n", "utf8");
    process.env.C2X_WORKSPACE = root;
    const files = await loadWorkspaceFiles("demo");
    expect(files).toEqual(DEMO_FILES);
    expect(files.some((file) => file.path.startsWith("src/"))).toBe(true);
  });

  it("skips matching paths on a repo walk", async () => {
    prevWorkspace = process.env.C2X_WORKSPACE;
    root = await mkdtemp(path.join(os.tmpdir(), "c2x-ignore-walk-"));
    await mkdir(path.join(root, "src"), { recursive: true });
    await mkdir(path.join(root, "vendor"), { recursive: true });
    await mkdir(path.join(root, "tmp"), { recursive: true });
    await mkdir(path.join(root, ".c2x", "briefs"), { recursive: true });
    await writeFile(path.join(root, "src", "keep.ts"), "export const keep = 1;\n", "utf8");
    await writeFile(path.join(root, "vendor", "lib.ts"), "export const skip = 1;\n", "utf8");
    await writeFile(path.join(root, "tmp", "noise.ts"), "export const noise = 1;\n", "utf8");
    await writeFile(path.join(root, ".c2x", "briefs", "codex.md"), "OWNER: codex\n", "utf8");
    await writeFile(path.join(root, ".c2xignore"), "# comment\nvendor\ntmp\n", "utf8");
    process.env.C2X_WORKSPACE = root;
    const files = await loadWorkspaceFiles("repo");
    expect(files.map((file) => file.path)).toEqual(["src/keep.ts"]);
  });
});

