import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

describe("npm package identity", () => {
  it("stays chat-to-x and private so we never squat the CSS c2x package", () => {
    const pkg = JSON.parse(
      readFileSync(path.join(process.cwd(), "package.json"), "utf8"),
    ) as {
      name: string;
      private?: boolean;
      bin?: Record<string, string>;
      repository?: { url?: string } | string;
      bugs?: string | { url?: string };
      homepage?: string;
      engines?: { node?: string };
      author?: { email?: string };
    };
    expect(pkg.name).toBe("chat-to-x");
    expect(pkg.private).toBe(true);
    expect(pkg.name).not.toBe("c2x");
    expect(pkg.bin?.["chat-to-x"]).toBe("src/cli/c2x.ts");
    expect(pkg.bin?.c2x).toBe("src/cli/c2x.ts");
    expect(pkg.engines?.node).toBe(">=20");
    const repo =
      typeof pkg.repository === "string" ? pkg.repository : pkg.repository?.url;
    expect(repo).toMatch(/github\.com\/kienbui1995\/chat-to-x/);
    expect(pkg.homepage).toMatch(/github\.com\/kienbui1995\/chat-to-x/);
    expect(pkg.author?.email).toBeUndefined();
  });

  it("points at the real public GitHub repo and stays private as chat-to-x", () => {
    const readme = readFileSync(path.join(process.cwd(), "README.md"), "utf8");
    expect(readme).toMatch(/npx chat-to-x/);
    expect(readme).toMatch(/Không[\s\S]*npx c2x/);
    expect(readme).toMatch(/github\.com\/kienbui1995\/chat-to-x/);
    expect(readme).toMatch(/private/);
  });
});
