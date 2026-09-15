import { existsSync, readFileSync } from "node:fs";
import { mkdir, mkdtemp, rm } from "node:fs/promises";
import { execFileSync } from "node:child_process";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";

const installSh = path.join(process.cwd(), "install.sh");

describe("install.sh", () => {
  it("is a curl|bash installer that never calls npx c2x", () => {
    const text = readFileSync(installSh, "utf8");
    expect(text.startsWith("#!/usr/bin/env bash")).toBe(true);
    expect(text).toMatch(/C2X_REPO|--repo/);
    expect(text).toMatch(/c2x init --harness codex/);
    expect(text).not.toMatch(/npx c2x/);
    expect(text).not.toMatch(/github\.com\/[A-Za-z0-9_.-]+\/chat-to-x/);
    const readme = readFileSync(path.join(process.cwd(), "README.md"), "utf8");
    expect(readme).toMatch(/curl -fsSL/);
    expect(readme).toMatch(/\| bash/);
    expect(readme).not.toMatch(/github\.com\/[A-Za-z0-9_.-]+\/chat-to-x/);
  });

  it("installs c2x and Codex plugin into HOME without cloning the app", async () => {
    const home = await mkdtemp(path.join(os.tmpdir(), "c2x-install-home-"));
    const workspace = path.join(home, "ws");
    await mkdir(workspace, { recursive: true });
    execFileSync("bash", [installSh, "--in-place"], {
      cwd: process.cwd(),
      env: {
        ...process.env,
        HOME: home,
        C2X_HOME: process.cwd(),
        C2X_BIN_DIR: path.join(home, ".local", "bin"),
        FRUGAL_DATA_DIR: path.join(home, "data"),
        C2X_WORKSPACE: workspace,
      },
      stdio: "pipe",
    });
    const bin = path.join(home, ".local", "bin", "c2x");
    expect(existsSync(bin)).toBe(true);
    expect(readFileSync(bin, "utf8")).toMatch(/tsx|chat-to-x/);
    expect(readFileSync(bin, "utf8")).not.toMatch(/npx c2x/);
    expect(existsSync(path.join(home, ".codex", "skills", "chat-to-x", "SKILL.md"))).toBe(true);
    expect(readFileSync(path.join(home, ".codex", "config.toml"), "utf8")).toMatch(
      /\[mcp_servers\.chat-to-x\]/,
    );
    await rm(home, { recursive: true, force: true });
  });
});
