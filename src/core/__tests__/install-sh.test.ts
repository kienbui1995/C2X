import { existsSync, readFileSync } from "node:fs";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { execFileSync } from "node:child_process";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { chatToXMcpLaunch } from "@/core/codex-config";

const installSh = path.join(process.cwd(), "install.sh");
const repoRoot = process.cwd();

function runCaptured(
  file: string,
  args: string[],
  extraEnv: Record<string, string | undefined>,
  cwd: string,
): { status: number; stdout: string; stderr: string } {
  try {
    const stdout = execFileSync(file, args, {
      cwd,
      env: { ...process.env, ...extraEnv },
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
    });
    return { status: 0, stdout, stderr: "" };
  } catch (error) {
    const err = error as { status?: number; stdout?: string; stderr?: string };
    return {
      status: typeof err.status === "number" ? err.status : 1,
      stdout: err.stdout ?? "",
      stderr: err.stderr ?? "",
    };
  }
}

function writeWrappersFromInstallSh(dest: string, binDir: string): void {
  const text = readFileSync(installSh, "utf8");
  const start = text.indexOf("for name in c2x chat-to-x; do");
  const end = text.indexOf("\ndone\n", start);
  if (start < 0 || end < 0) {
    throw new Error("install.sh wrapper loop missing");
  }
  const loop = text.slice(start, end + "\ndone".length);
  const script = [
    "set -euo pipefail",
    `DEST=${JSON.stringify(dest)}`,
    `BIN_DIR=${JSON.stringify(binDir)}`,
    'TSX="${DEST}/node_modules/.bin/tsx"',
    'CLI="${DEST}/src/cli/c2x.ts"',
    'mkdir -p "${BIN_DIR}"',
    loop,
  ].join("\n");
  execFileSync("bash", ["-c", script], { encoding: "utf8" });
}

function runInstall(
  args: string[],
  extraEnv: Record<string, string | undefined>,
  cwd = process.cwd(),
): { status: number; stdout: string; stderr: string } {
  return runCaptured("bash", [installSh, ...args], extraEnv, cwd);
}

describe("install.sh", () => {
  it("is a curl|bash installer that never calls npx c2x", () => {
    const text = readFileSync(installSh, "utf8");
    expect(text.startsWith("#!/usr/bin/env bash")).toBe(true);
    expect(text).toMatch(/C2X_REPO|--repo/);
    expect(text).toMatch(/c2x init --harness codex/);
    expect(text).toMatch(/refusing to install/);
    expect(text).toMatch(/npm ci/);
    expect(text).toMatch(/\.agents\/skills/);
    expect(text).toMatch(/\.codex\/skills/);
    expect(text).toMatch(/\.codex\/AGENTS\.md/);
    expect(text).toMatch(/\.codex\/config\.toml/);
    expect(text).toMatch(/\.local\/bin/);
    expect(text).not.toMatch(/npx c2x/);
    expect(text).not.toMatch(/npm audit fix --force/);
    expect(text).toMatch(/github\.com\/kienbui1995\/chat-to-x/);
    expect(text).toMatch(
      /exec "\$\{TSX\}" --tsconfig "\$\{DEST\}\/tsconfig\.json" "\$\{CLI\}" "\\\$@"/,
    );
    const readme = readFileSync(path.join(process.cwd(), "README.md"), "utf8");
    expect(readme).toMatch(/curl -fsSL/);
    expect(readme).toMatch(/\| bash/);
    expect(readme).toMatch(/raw\.githubusercontent\.com\/kienbui1995\/chat-to-x/);
    expect(readme).toMatch(/any directory|thư mục bất kỳ|mọi thư mục/i);
  });

  it("runs the installed wrapper from a cwd that is not the package", async () => {
    const home = await mkdtemp(path.join(os.tmpdir(), "c2x-alias-home-"));
    const cwd = await mkdtemp(path.join(os.tmpdir(), "c2x-alias-cwd-"));
    const binDir = path.join(home, ".local", "bin");
    writeWrappersFromInstallSh(repoRoot, binDir);
    const wrapper = readFileSync(path.join(binDir, "c2x"), "utf8");
    expect(wrapper).toContain(`--tsconfig "${repoRoot}/tsconfig.json"`);
    expect(wrapper).not.toMatch(/^\s*cd /m);

    const usage = runCaptured(path.join(binDir, "c2x"), [], { HOME: home }, cwd);
    expect(`${usage.stdout}\n${usage.stderr}`).not.toMatch(/Cannot find module/);
    expect(usage.status).toBe(0);
    expect(usage.stdout).toMatch(/Cài một lệnh/);
    expect(usage.stdout).toMatch(/install\.sh/);

    const doctor = runCaptured(path.join(binDir, "c2x"), ["doctor"], { HOME: home }, cwd);
    expect(`${doctor.stdout}\n${doctor.stderr}`).not.toMatch(/Cannot find module/);
    expect(doctor.status).toBe(0);
    expect(doctor.stdout).toMatch(/codex-skill/);

    await rm(home, { recursive: true, force: true });
    await rm(cwd, { recursive: true, force: true });
  });

  it("refuses DEST=/ from a checkout without writing to /", () => {
    const probe = path.join("/", "c2x-install-refuse-probe");
    expect(existsSync(probe)).toBe(false);
    const result = runInstall(["--home", "/"], {});
    expect(result.status).toBe(1);
    expect(`${result.stdout}\n${result.stderr}`).toMatch(/refusing to install/);
    expect(existsSync(probe)).toBe(false);
    if (existsSync("/package.json")) {
      expect(readFileSync("/package.json", "utf8")).not.toMatch(/"name": "chat-to-x"/);
    }
  });

  it("refuses DEST=$HOME on the tar branch from a checkout", async () => {
    const home = await mkdtemp(path.join(os.tmpdir(), "c2x-install-home-refuse-"));
    const result = runInstall(["--home", home], { HOME: home, C2X_HOME: home });
    expect(result.status).toBe(1);
    expect(`${result.stdout}\n${result.stderr}`).toMatch(/refusing to install/);
    expect(existsSync(path.join(home, "package.json"))).toBe(false);
    await rm(home, { recursive: true, force: true });
  });

  it("does not rm -rf a DEST that is not a chat-to-x checkout", async () => {
    const cwd = await mkdtemp(path.join(os.tmpdir(), "c2x-install-empty-cwd-"));
    const dest = await mkdtemp(path.join(os.tmpdir(), "c2x-install-precious-"));
    const precious = path.join(dest, "precious.txt");
    await writeFile(precious, "keep-me\n", "utf8");
    const result = runInstall(
      ["--home", dest, "--repo", "https://example.invalid/chat-to-x.git"],
      { HOME: cwd, C2X_HOME: dest },
      cwd,
    );
    expect(result.status).toBe(1);
    expect(existsSync(precious)).toBe(true);
    expect(readFileSync(precious, "utf8")).toBe("keep-me\n");
    await rm(cwd, { recursive: true, force: true });
    await rm(dest, { recursive: true, force: true });
  });

  it("installs c2x and Codex plugin into HOME without cloning the app", { timeout: 180_000 }, async () => {
    const home = await mkdtemp(path.join(os.tmpdir(), "c2x-install-home-"));
    const dest = await mkdtemp(path.join(os.tmpdir(), "c2x-install-dest-"));
    const workspace = path.join(home, "ws");
    await mkdir(workspace, { recursive: true });
    execFileSync(
      "bash",
      [
        "-c",
        'tar -C "$1" --exclude=node_modules --exclude=.next --exclude=.git --exclude=data -cf - . | tar -C "$2" -xf -',
        "copy",
        process.cwd(),
        dest,
      ],
      { stdio: "pipe" },
    );
    execFileSync("bash", [installSh, "--in-place"], {
      cwd: dest,
      env: {
        ...process.env,
        HOME: home,
        C2X_BIN_DIR: path.join(home, ".local", "bin"),
        FRUGAL_DATA_DIR: path.join(home, "data"),
        C2X_WORKSPACE: workspace,
      },
      stdio: "pipe",
    });
    const bin = path.join(home, ".local", "bin", "c2x");
    expect(existsSync(bin)).toBe(true);
    expect(readFileSync(bin, "utf8")).toMatch(/tsx|chat-to-x/);
    expect(readFileSync(bin, "utf8")).toContain(`--tsconfig "${dest}/tsconfig.json"`);
    expect(readFileSync(bin, "utf8")).not.toMatch(/npx c2x/);
    expect(existsSync(path.join(home, ".agents", "skills", "chat-to-x", "SKILL.md"))).toBe(true);
    expect(existsSync(path.join(home, ".codex", "skills", "chat-to-x", "SKILL.md"))).toBe(true);
    expect(readFileSync(path.join(home, ".codex", "config.toml"), "utf8")).toMatch(
      /\[mcp_servers\.chat-to-x\]/,
    );
    expect(readFileSync(path.join(home, ".codex", "AGENTS.md"), "utf8")).toMatch(
      /<!-- c2x:begin -->|c2x_start/,
    );
    await rm(home, { recursive: true, force: true });
    await rm(dest, { recursive: true, force: true });
  });
});

describe("chatToXMcpLaunch", () => {
  it("passes --tsconfig so Codex MCP resolves @/ from an app cwd", () => {
    const launch = chatToXMcpLaunch(repoRoot);
    expect(launch.command).toBe(path.join(repoRoot, "node_modules", ".bin", "tsx"));
    expect(launch.args).toEqual([
      "--tsconfig",
      path.join(repoRoot, "tsconfig.json"),
      path.join(repoRoot, "src", "cli", "c2x.ts"),
      "mcp",
    ]);
  });
});
