import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { loadWorkspaceFiles, resolveWorkspaceRoot } from "@/core/workspace";

describe("resolveWorkspaceRoot", () => {
  it("prefers CLI cwd, then C2X_WORKSPACE, then process.cwd — never a config path", () => {
    expect(resolveWorkspaceRoot({ cwd: "/tmp/a", env: { C2X_WORKSPACE: "/tmp/b" } })).toBe("/tmp/a");
    expect(resolveWorkspaceRoot({ env: { C2X_WORKSPACE: "/tmp/b" } })).toBe("/tmp/b");
    expect(resolveWorkspaceRoot({ env: {} })).toBe(process.cwd());
  });
});

describe("loadWorkspaceFiles cwd", () => {
  it("walks the injected cwd even when C2X_WORKSPACE points elsewhere", async () => {
    const cwd = await mkdtemp(path.join(os.tmpdir(), "c2x-cwd-"));
    const other = await mkdtemp(path.join(os.tmpdir(), "c2x-other-"));
    await mkdir(path.join(cwd, "src"), { recursive: true });
    await writeFile(path.join(cwd, "src", "keep.ts"), "export const keep = 1;\n", "utf8");
    await writeFile(path.join(other, "skip.ts"), "export const skip = 1;\n", "utf8");
    const prev = process.env.C2X_WORKSPACE;
    process.env.C2X_WORKSPACE = other;
    const files = await loadWorkspaceFiles("repo", undefined, cwd);
    if (prev === undefined) {
      delete process.env.C2X_WORKSPACE;
    } else {
      process.env.C2X_WORKSPACE = prev;
    }
    expect(files.map((file) => file.path)).toEqual(["src/keep.ts"]);
    await rm(cwd, { recursive: true, force: true });
    await rm(other, { recursive: true, force: true });
  });
});
