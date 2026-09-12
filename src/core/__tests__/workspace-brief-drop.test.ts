import { mkdtemp, readFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { planToBriefs, renderCodexBrief } from "@/core/brief";
import { DEMO_FILES } from "@/core/fixtures/demo-workspace";
import {
  workspaceBriefPath,
  writeWorkspaceBriefDrop,
} from "@/core/harness";
import { packWorkspace } from "@/core/packer";
import { mockPlanFromPack } from "@/core/planner";
import { createSession } from "@/core/session";

function sessionWithTeam(team: readonly ("codex" | "claude-code")[]) {
  const pack = packWorkspace({
    goal: "Sửa createTask",
    files: DEMO_FILES,
    budgetTokens: 2000,
  });
  const created = createSession({
    goal: pack.goal,
    planner: "mock",
    plannerChoice: "mock",
    harnessTeam: team,
    budgetTokens: 2000,
    workspaceSource: "demo",
  });
  const plan = mockPlanFromPack(pack, created.id, team);
  const briefs = planToBriefs(plan);
  return { ...created, plan, briefs, brief: briefs[0] ?? null, pack };
}

describe("writeWorkspaceBriefDrop", () => {
  it("writes only that owner brief under .c2x/briefs/<harness>.md", async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), "c2x-ws-"));
    const session = sessionWithTeam(["codex", "claude-code"]);
    const briefPath = await writeWorkspaceBriefDrop({
      workspaceRoot: root,
      session,
      owner: "codex",
    });
    expect(briefPath).toBe(path.join(root, ".c2x", "briefs", "codex.md"));
    expect(briefPath).toBe(workspaceBriefPath(root, "codex"));
    const text = await readFile(briefPath, "utf8");
    expect(text).toBe(renderCodexBrief(session.briefs[0]!));
    expect(text).toMatch(/OWNER:\s*codex/);
    expect(text).not.toMatch(/OWNER:\s*claude-code/);
    await rm(root, { recursive: true, force: true });
  });

  it("throws when the owner has no precomputed brief", async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), "c2x-ws-"));
    const session = sessionWithTeam(["codex"]);
    await expect(
      writeWorkspaceBriefDrop({
        workspaceRoot: root,
        session,
        owner: "claude-code",
      }),
    ).rejects.toThrow(/brief|owner/i);
    await rm(root, { recursive: true, force: true });
  });
});
