import { readFileSync } from "node:fs";
import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { runPlan } from "@/core/run-loop";
import { createSession } from "@/core/session";
import {
  describeSessionStatus,
  formatSessionStatus,
  nextExpectedStepVi,
  resolveSessionRecord,
} from "@/core/session-status";
import { PROTOCOL_STATES } from "@/core/types";

describe("nextExpectedStepVi", () => {
  it("covers every protocol state with a concrete next action", () => {
    for (const state of PROTOCOL_STATES) {
      expect(nextExpectedStepVi(state).length).toBeGreaterThan(8);
    }
  });
});

describe("describeSessionStatus", () => {
  it("lists id, state, team, and bilingual next steps", () => {
    const session = {
      ...createSession({
        goal: "Sửa createTask",
        planner: "mock",
        plannerChoice: "mock",
        harnessTeam: ["codex", "claude-code"],
        budgetTokens: 2000,
        workspaceSource: "demo",
      }),
      state: "PLAN" as const,
    };
    const view = describeSessionStatus(session);
    expect(view.id).toBe(session.id);
    expect(view.state).toBe("PLAN");
    expect(view.harnessTeam).toEqual(["codex", "claude-code"]);
    expect(view.nextEn).toMatch(/brief|record/i);
    expect(view.nextVi).toMatch(/brief|record/i);
    const report = formatSessionStatus(view, "vi");
    expect(report).toContain(session.id);
    expect(report).toContain("PLAN");
    expect(report).toContain(view.nextVi);
    expect(formatSessionStatus(view, "en")).toContain(view.nextEn);
  });
});

let dataDir = "";
let prevData: string | undefined;
let prevWorkspace: string | undefined;

beforeEach(async () => {
  dataDir = await mkdtemp(path.join(os.tmpdir(), "c2x-status-"));
  prevData = process.env.FRUGAL_DATA_DIR;
  prevWorkspace = process.env.C2X_WORKSPACE;
  process.env.FRUGAL_DATA_DIR = dataDir;
  process.env.C2X_WORKSPACE = dataDir;
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
  await rm(dataDir, { recursive: true, force: true });
});

describe("resolveSessionRecord", () => {
  it("returns null when empty, latest when omitted, and the named id when set", async () => {
    expect(await resolveSessionRecord()).toBeNull();
    const first = await runPlan({
      goal: "Phiên một",
      plannerChoice: "mock",
      harnessTeam: ["codex"],
      budgetTokens: 2000,
      workspaceSource: "demo",
    });
    const second = await runPlan({
      goal: "Phiên hai",
      plannerChoice: "mock",
      harnessTeam: ["codex"],
      budgetTokens: 2000,
      workspaceSource: "demo",
    });
    expect((await resolveSessionRecord())?.id).toBe(second.id);
    expect((await resolveSessionRecord(first.id))?.id).toBe(first.id);
    expect(await resolveSessionRecord("c2x_missing")).toBeNull();
  });
});

describe("resume links", () => {
  it("opens a session from /sessions via ?session= and documents c2x status", () => {
    const sessions = readFileSync(
      path.join(process.cwd(), "src/components/sessions-client.tsx"),
      "utf8",
    );
    expect(sessions).toMatch(/\?session=\$\{session\.id\}|\?session=\{session\.id\}/);
    const cli = readFileSync(path.join(process.cwd(), "src/cli/c2x.ts"), "utf8");
    expect(cli).toMatch(/\.command\("status"\)/);
    const studio = readFileSync(
      path.join(process.cwd(), "src/components/studio-client.tsx"),
      "utf8",
    );
    expect(studio).toMatch(/searchParams|session=/);
    expect(studio).toMatch(/\/api\/sessions/);
  });
});
