import { existsSync } from "node:fs";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { runPlan } from "@/core/run-loop";
import { HARNESS_IDS, isHarnessId } from "@/core/types";

let dataDir = "";
let workspaceRoot = "";

beforeEach(async () => {
  dataDir = await mkdtemp(path.join(os.tmpdir(), "c2x-wiki-data-"));
  workspaceRoot = await mkdtemp(path.join(os.tmpdir(), "c2x-wiki-ws-"));
  process.env.FRUGAL_DATA_DIR = dataDir;
  process.env.C2X_WORKSPACE = workspaceRoot;
});

afterEach(async () => {
  delete process.env.FRUGAL_DATA_DIR;
  delete process.env.C2X_WORKSPACE;
  await rm(dataDir, { recursive: true, force: true });
  await rm(workspaceRoot, { recursive: true, force: true });
});

describe("wiki outbox", () => {
  it("writes PLAN docs to docs/wiki and .c2x/outbox/wiki without calling Jira", async () => {
    const session = await runPlan({
      goal: "Viết wiki Azure DevOps cho createTask — dán tay, không OAuth",
      plannerChoice: "mock",
      harnessTeam: ["claude-code", "codex", "grok-build"],
      budgetTokens: 2000,
      workspaceSource: "demo",
      cwd: workspaceRoot,
    });
    expect(session.state).toBe("PLAN");
    const outboxDir = path.join(workspaceRoot, ".c2x", "outbox", "wiki");
    const docsDir = path.join(workspaceRoot, "docs", "wiki");
    const outbox = path.join(outboxDir, `${session.id}.md`);
    const wiki = path.join(docsDir, `${session.id}.md`);
    expect(existsSync(outbox)).toBe(true);
    expect(existsSync(wiki)).toBe(true);
    const text = await readFile(outbox, "utf8");
    expect(text).toMatch(/createTask/i);
    expect(text).toMatch(/Azure DevOps|wiki|Jira/i);
    expect(text).not.toMatch(/Authorization:|Bearer |JIRA_API|AZURE_DEVOPS_PAT/i);
    expect(isHarnessId("agy")).toBe(false);
    expect(HARNESS_IDS).not.toContain("agy");
    expect(HARNESS_IDS).not.toContain("jira");
  });
});
