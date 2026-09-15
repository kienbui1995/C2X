import { existsSync, readFileSync } from "node:fs";
import { chmod, mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { formatDriveReport, runDrive } from "@/core/drive";
import { clearDetectCache } from "@/core/harness";
import { consumeInboxControl, waitForInboxControl, writeOutboxFile } from "@/core/mailbox";
import { briefRelForHarness, spawnHarness } from "@/core/spawn-harness";
import { HARNESS_IDS } from "@/core/types";

let dataDir = "";
let workspaceRoot = "";
let prevData: string | undefined;
let prevWorkspace: string | undefined;
let prevPath: string | undefined;

beforeEach(async () => {
  dataDir = await mkdtemp(path.join(os.tmpdir(), "c2x-drive-data-"));
  workspaceRoot = await mkdtemp(path.join(os.tmpdir(), "c2x-drive-ws-"));
  prevData = process.env.FRUGAL_DATA_DIR;
  prevWorkspace = process.env.C2X_WORKSPACE;
  prevPath = process.env.PATH;
  process.env.FRUGAL_DATA_DIR = dataDir;
  process.env.C2X_WORKSPACE = workspaceRoot;
});

afterEach(async () => {
  if (prevData === undefined) {
    delete process.env.FRUGAL_DATA_DIR;
  } else {
    process.env.FRUGAL_DATA_DIR = prevData;
  }
  if (prevWorkspace === undefined) {
    delete process.env.C2X_WORKSPACE;
  } else {
    process.env.C2X_WORKSPACE = prevWorkspace;
  }
  if (prevPath === undefined) {
    delete process.env.PATH;
  } else {
    process.env.PATH = prevPath;
  }
  await rm(dataDir, { recursive: true, force: true });
  await rm(workspaceRoot, { recursive: true, force: true });
});

describe("mailbox", () => {
  it("writes outbox and consumes the first [C2X] inbox file", async () => {
    const out = await writeOutboxFile(workspaceRoot, "plan-prompt.md", "PASTE ME");
    expect(await readFile(out, "utf8")).toBe("PASTE ME");
    await mkdir(path.join(workspaceRoot, ".c2x", "inbox"), { recursive: true });
    await writeFile(path.join(workspaceRoot, ".c2x", "inbox", "note.md"), "not a block\n", "utf8");
    await writeFile(
      path.join(workspaceRoot, ".c2x", "inbox", "reply.md"),
      "noise\n[C2X]\nSTATE: DONE\nTASK_ID: c2x_x\nITERATION: 1\n",
      "utf8",
    );
    const raw = await consumeInboxControl(workspaceRoot);
    expect(raw).toMatch(/^\[C2X\]/);
    expect(await consumeInboxControl(workspaceRoot)).toBeNull();
  });

  it("times out when the inbox stays empty", async () => {
    await expect(
      waitForInboxControl({
        workspaceRoot,
        timeoutMs: 5,
        intervalMs: 5,
        now: (() => {
          let t = 0;
          return () => {
            t += 5;
            return t;
          };
        })(),
        sleep: async () => undefined,
      }),
    ).rejects.toThrow(/inbox/i);
  });
});

describe("spawnHarness", () => {
  it("runs the PATH binary with catalog exec args and skips when missing", async () => {
    const binDir = await mkdtemp(path.join(os.tmpdir(), "c2x-spawn-bin-"));
    const fake = path.join(binDir, "codex");
    await writeFile(fake, "#!/bin/sh\necho ok\n", "utf8");
    await chmod(fake, 0o755);
    process.env.PATH = binDir;
    clearDetectCache();
    const ran = await spawnHarness({
      owner: "codex",
      workspaceRoot,
      timeoutMs: 2000,
    });
    expect(ran.skipped).toBe(false);
    expect(ran.exitCode).toBe(0);
    expect(ran.args.join(" ")).toContain(briefRelForHarness("codex"));
    process.env.PATH = "/nonexistent-c2x-path";
    clearDetectCache();
    const missing = await spawnHarness({ owner: "codex", workspaceRoot, timeoutMs: 500 });
    expect(missing.skipped).toBe(true);
    expect(missing.exitCode).toBe(127);
    await rm(binDir, { recursive: true, force: true });
  });
});

describe("runDrive", () => {
  it("mock-plans, spawns Codex, and finishes review without an inbox", async () => {
    const result = await runDrive({
      goal: "Sửa createTask",
      plannerChoice: "mock",
      harnessTeam: ["codex"],
      workspaceSource: "demo",
      cwd: workspaceRoot,
      spawn: true,
      spawnHarness: async ({ owner }) => ({
        owner,
        command: "codex",
        args: ["exec"],
        exitCode: 0,
        skipped: false,
        reason: null,
      }),
    });
    expect(result.session.state).toBe("DONE");
    expect(result.session.planner).toBe("mock");
    expect(result.spawns).toHaveLength(1);
    expect(result.spawns[0]?.owner).toBe("codex");
    expect(await readFile(path.join(workspaceRoot, ".c2x", "briefs", "codex.md"), "utf8")).toMatch(
      /OWNER:\s*codex/,
    );
    expect(formatDriveReport(result)).toMatch(/does not open a browser/i);
  });

  it("writes ChatGPT prompts to outbox and imports inbox replies", async () => {
    const result = await runDrive({
      goal: "Sửa createTask",
      plannerChoice: "chatgpt-web",
      harnessTeam: ["codex"],
      workspaceSource: "demo",
      cwd: workspaceRoot,
      spawn: true,
      waitForControl: async (session) => {
        if (session.state === "INIT") {
          return `[C2X]
STATE: PLAN
TASK_ID: ${session.id}
ITERATION: 1

GOAL:
Sửa createTask

RATIONALE:
Packed excerpts show the defect.

ACTIONS:
1. Fix createTask persistence.

FILES_LIKELY_INVOLVED:
- src/lib/tasks.ts

TESTS:
- unit

SUCCESS_CRITERIA:
- tasks persist

RISKS:
- none

PACKETS:
  ## owner=codex role=general
  ACTIONS:
  1. Fix createTask persistence.
  FILES:
  - src/lib/tasks.ts
  TESTS:
  - unit
  SUCCESS_CRITERIA:
  - persist
`;
        }
        return `[C2X]
STATE: DONE
TASK_ID: ${session.id}
ITERATION: 1

SUMMARY:
Looks good.
`;
      },
      spawnHarness: async ({ owner }) => ({
        owner,
        command: "codex",
        args: ["exec"],
        exitCode: 0,
        skipped: false,
        reason: null,
      }),
    });
    expect(result.session.state).toBe("DONE");
    expect(result.outbox.some((item) => item.endsWith("plan-prompt.md"))).toBe(true);
    expect(result.outbox.some((item) => item.endsWith("review-prompt.md"))).toBe(true);
    expect(await readFile(result.outbox[0]!, "utf8")).toMatch(/\[C2X\]|GOAL|TASK/);
  });

  it("documents CLI drive and never exposes spawn over HTTP", () => {
    const cli = readFileSync(path.join(process.cwd(), "src/cli/c2x.ts"), "utf8");
    expect(cli).toMatch(/\.command\("drive"\)/);
    expect(cli).toMatch(/--spawn/);
    for (const id of HARNESS_IDS) {
      expect(cli).not.toMatch(new RegExp(`case "${id}"`));
    }
    expect(existsSync(path.join(process.cwd(), "src/app/api/drive/route.ts"))).toBe(false);
  });
});
