import { existsSync, readFileSync } from "node:fs";
import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { packageRoot } from "@/core/package-root";

describe("packageRoot", () => {
  it("finds the chat-to-x install even when cwd is another project", async () => {
    const other = await mkdtemp(path.join(os.tmpdir(), "c2x-other-app-"));
    const prev = process.cwd();
    process.chdir(other);
    try {
      const root = packageRoot();
      expect(existsSync(path.join(root, "skill", "SKILL.md"))).toBe(true);
      const pkg = JSON.parse(readFileSync(path.join(root, "package.json"), "utf8")) as {
        name: string;
      };
      expect(pkg.name).toBe("chat-to-x");
      expect(root).not.toBe(other);
    } finally {
      process.chdir(prev);
      await rm(other, { recursive: true, force: true });
    }
  });

  it("tells README that apps do not clone this git repo", () => {
    const readme = readFileSync(path.join(process.cwd(), "README.md"), "utf8");
    expect(readme).toMatch(/không clone|Không clone/i);
    expect(readme).toMatch(/một lần/);
    const cli = readFileSync(path.join(process.cwd(), "src/cli/c2x.ts"), "utf8");
    expect(cli).toMatch(/packageRoot\(/);
    expect(cli).not.toMatch(/repoRoot:\s*process\.cwd\(\)/);
  });
});
