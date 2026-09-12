import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

describe("npm package identity", () => {
  it("stays chat-to-x and private so we never squat the CSS c2x package", () => {
    const pkg = JSON.parse(
      readFileSync(path.join(process.cwd(), "package.json"), "utf8"),
    ) as { name: string; private?: boolean; bin?: Record<string, string> };
    expect(pkg.name).toBe("chat-to-x");
    expect(pkg.private).toBe(true);
    expect(pkg.name).not.toBe("c2x");
    expect(pkg.bin?.["chat-to-x"]).toBe("src/cli/c2x.ts");
    expect(pkg.bin?.c2x).toBe("src/cli/c2x.ts");
  });
});
