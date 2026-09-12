import { describe, expect, it } from "vitest";
import { resolveWorkspaceRoot } from "@/core/workspace";

describe("resolveWorkspaceRoot", () => {
  it("prefers CLI cwd, then C2X_WORKSPACE, then process.cwd — never a config path", () => {
    expect(resolveWorkspaceRoot({ cwd: "/tmp/a", env: { C2X_WORKSPACE: "/tmp/b" } })).toBe("/tmp/a");
    expect(resolveWorkspaceRoot({ env: { C2X_WORKSPACE: "/tmp/b" } })).toBe("/tmp/b");
    expect(resolveWorkspaceRoot({ env: {} })).toBe(process.cwd());
  });
});
