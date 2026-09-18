import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const root = process.cwd();
const workflowPath = path.join(root, ".github/workflows/ci.yml");

describe("GitHub Actions CI workflow", () => {
  it("exists and runs Node 20 test + typecheck without publishing", () => {
    expect(existsSync(workflowPath)).toBe(true);
    const yaml = readFileSync(workflowPath, "utf8");
    expect(yaml).toMatch(/node-version:\s*['"]?20['"]?/);
    expect(yaml).toMatch(/npm test/);
    expect(yaml).toMatch(/typecheck/);
    expect(yaml).not.toMatch(/npm publish/);
    expect(yaml).not.toMatch(/npx c2x/);
  });

  it("README CI badge points at github.com/kienbui1995/C2X", () => {
    const readme = readFileSync(path.join(root, "README.md"), "utf8");
    expect(readme).toMatch(
      /https:\/\/(github\.com\/kienbui1995\/C2X\/actions|img\.shields\.io\/github\/actions\/workflow\/status\/kienbui1995\/C2X)/,
    );
    expect(readme).not.toMatch(/github\.com\/(?!kienbui1995\/)[A-Za-z0-9_.-]+\/C2X\/actions/);
    expect(readme).not.toMatch(/github\.com\/[A-Za-z0-9_.-]+\/chat-to-x\/actions/);
  });
});
