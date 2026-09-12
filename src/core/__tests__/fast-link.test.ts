import { readFileSync } from "node:fs";
import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { mergeConfig } from "@/core/config";
import {
  PLANNER_API_MAX_TOKENS,
  PLANNER_API_TIMEOUT_MS,
  completePlanner,
} from "@/core/providers/complete";
import {
  CONTROL_BUDGET_DEFAULT,
  CONTROL_BUDGET_MAX,
  assertControlBudget,
  executedMessage,
} from "@/core/protocol";
import { reusedPack } from "@/core/session";
import { importPlan, runPlan } from "@/core/run-loop";
import * as workspace from "@/core/workspace";

let dataDir = "";

beforeEach(async () => {
  dataDir = await mkdtemp(path.join(os.tmpdir(), "c2x-fast-"));
  process.env.FRUGAL_DATA_DIR = dataDir;
});

afterEach(async () => {
  delete process.env.FRUGAL_DATA_DIR;
  await rm(dataDir, { recursive: true, force: true });
  vi.restoreAllMocks();
});

describe("reusedPack", () => {
  it("returns the existing pack and importPlan does not walk the repo", async () => {
    const session = await runPlan({
      goal: "Sửa createTask",
      plannerChoice: "chatgpt-web",
      harnessTeam: ["codex"],
      budgetTokens: 2000,
      workspaceSource: "demo",
    });
    expect(session.pack).not.toBeNull();
    expect(reusedPack(session)).toBe(session.pack);

    const walk = vi.spyOn(workspace, "loadWorkspaceFiles");
    const next = await importPlan({
      sessionId: session.id,
      raw: `[C2X]
STATE: PLAN
TASK_ID: ${session.id}
ITERATION: 1

GOAL:
Sửa createTask

RATIONALE:
Reuse the packed tree.

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
`,
    });
    expect(walk).not.toHaveBeenCalled();
    expect(next.pack).toBe(session.pack);
    expect(next.pack?.tree).toBe(session.pack?.tree);
    expect(next.pack?.packedTokens).toBe(session.pack?.packedTokens);
  });

  it("throws when the session was never packed", async () => {
    const session = await runPlan({
      goal: "Sửa createTask",
      plannerChoice: "chatgpt-web",
      harnessTeam: ["codex"],
      budgetTokens: 2000,
      workspaceSource: "demo",
    });
    expect(() => reusedPack({ ...session, pack: null })).toThrow(/pack|reuse/i);
  });
});

describe("planner API fail-fast", () => {
  it("exports an 8s timeout and 1200-token completion budget", () => {
    expect(PLANNER_API_TIMEOUT_MS).toBe(8_000);
    expect(PLANNER_API_MAX_TOKENS).toBe(1_200);
  });

  it("aborts a hung OpenAI-compatible fetch instead of waiting", async () => {
    const prev = globalThis.fetch;
    globalThis.fetch = () => new Promise(() => {});
    const started = Date.now();
    const result = await completePlanner({
      provider: "openai",
      config: mergeConfig({ keys: { openai: "sk-test" } }),
      messages: [{ role: "user", content: "ping" }],
      allowFallback: true,
      timeoutMs: 40,
    });
    globalThis.fetch = prev;
    expect(Date.now() - started).toBeLessThan(800);
    expect(result.usedFallback).toBe(true);
    expect(result.fallbackReason ?? "").toMatch(/timeout|abort/i);
  });

  it("does not fetch for paste planners", async () => {
    const prev = globalThis.fetch;
    let called = 0;
    globalThis.fetch = async () => {
      called += 1;
      return new Response("{}");
    };
    const result = await completePlanner({
      provider: "chatgpt-web",
      config: mergeConfig(),
      messages: [{ role: "user", content: "ping" }],
    });
    globalThis.fetch = prev;
    expect(called).toBe(0);
    expect(result.text).toBe("");
    expect(result.usedFallback).toBe(false);
  });
});

describe("control budget and localhost", () => {
  it("keeps EXECUTED metadata-only and under 1200 tokens", () => {
    expect(CONTROL_BUDGET_DEFAULT).toBe(1200);
    expect(CONTROL_BUDGET_MAX).toBe(2000);
    const raw = executedMessage({
      taskId: "c2x_fast",
      iteration: 1,
      changedFiles: 2,
      tests: "codex: recorded",
      team: ["codex"],
    });
    expect(raw).not.toContain("@@");
    expect(raw).not.toMatch(/-----BEGIN/);
    expect(raw).not.toContain("export function");
    assertControlBudget(raw);
  });

  it("rejects a 3k-token control dump", () => {
    const dump = `[C2X]\nSTATE: PLAN\nTASK_ID: c2x_big\nITERATION: 1\n\nGOAL:\n${"dump ".repeat(3000)}\n`;
    expect(() => assertControlBudget(dump, CONTROL_BUDGET_MAX)).toThrow(/token/i);
  });

  it("binds next dev and start to loopback", () => {
    const pkg = JSON.parse(
      readFileSync(path.join(process.cwd(), "package.json"), "utf8"),
    ) as { scripts: Record<string, string> };
    expect(pkg.scripts.dev).toMatch(/127\.0\.0\.1/);
    expect(pkg.scripts.start).toMatch(/127\.0\.0\.1/);
    expect(pkg.scripts.dev).not.toMatch(/0\.0\.0\.0/);
  });
});
