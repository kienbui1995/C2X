import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  buildBrainstormPastePrompt,
  parseBrainstormReply,
  synthesizeBrainstormNotes,
} from "@/core/brainstorm";
import { DEMO_FILES } from "@/core/fixtures/demo-workspace";
import { packWorkspace } from "@/core/packer";
import { buildPlanUserPrompt } from "@/core/planner";
import { importControlMessage, runPlan } from "@/core/run-loop";
import { createSession, normalizeSession } from "@/core/session";
import type { SessionRecord } from "@/core/types";

let dataDir = "";
let workspaceRoot = "";

beforeEach(async () => {
  dataDir = await mkdtemp(path.join(os.tmpdir(), "c2x-brain-data-"));
  workspaceRoot = await mkdtemp(path.join(os.tmpdir(), "c2x-brain-ws-"));
  process.env.FRUGAL_DATA_DIR = dataDir;
  process.env.C2X_WORKSPACE = workspaceRoot;
});

afterEach(async () => {
  delete process.env.FRUGAL_DATA_DIR;
  delete process.env.C2X_WORKSPACE;
  await rm(dataDir, { recursive: true, force: true });
  await rm(workspaceRoot, { recursive: true, force: true });
});

const GOAL = "Bảng việc nội bộ: persist createTask và giữ bộ lọc status trên URL";

describe("brainstorm notes", () => {
  it("synthesizes short mock notes from the nghiệp vụ goal", () => {
    const notes = synthesizeBrainstormNotes(GOAL);
    expect(notes).toMatch(/Nghiệp vụ|phạm vi|ràng buộc/i);
    expect(notes).toContain("createTask");
    expect(notes.length).toBeGreaterThan(40);
    expect(notes.length).toBeLessThan(800);
  });

  it("asks ChatGPT for nghiệp vụ Q&A instead of a PLAN block", () => {
    const prompt = buildBrainstormPastePrompt(GOAL, "c2x_brain1");
    expect(prompt).toMatch(/nghiệp vụ|câu hỏi|Q&A/i);
    expect(prompt).toContain(GOAL);
    expect(prompt).not.toMatch(/STATE:\s*PLAN/);
    expect(prompt).not.toMatch(/PACKETS:/);
  });

  it("keeps pasted answers as notes", () => {
    const notes = parseBrainstormReply(
      "Người dùng lọc việc theo status. createTask phải persist sau reload.",
    );
    expect(notes).toMatch(/createTask/);
    expect(notes).toMatch(/status/);
  });

  it("includes persisted notes in the next PLAN prompt", () => {
    const pack = packWorkspace({
      goal: GOAL,
      files: DEMO_FILES,
      budgetTokens: 2000,
    });
    const notes = "Người dùng cần persist filter; không đụng CI.";
    const prompt = buildPlanUserPrompt(pack, "c2x_brain2", ["codex"], notes);
    expect(prompt).toContain(notes);
    expect(prompt).toMatch(/BRAINSTORM|NOTES|ghi chú/i);
  });

  it("normalizes missing brainstorm fields on legacy sessions", () => {
    const session = createSession({
      goal: GOAL,
      planner: "mock",
      plannerChoice: "mock",
      harnessTeam: ["codex"],
      budgetTokens: 2000,
      workspaceSource: "demo",
    });
    expect(session.brainstormNotes).toBeNull();
    expect(session.brainstormPending).toBe(false);
    const legacy = { ...session } as SessionRecord;
    delete (legacy as { brainstormNotes?: string | null }).brainstormNotes;
    delete (legacy as { brainstormPending?: boolean }).brainstormPending;
    const restored = normalizeSession(legacy);
    expect(restored.brainstormNotes).toBeNull();
    expect(restored.brainstormPending).toBe(false);
  });
});

describe("runPlan brainstorm", () => {
  it("lets mock synthesize notes then PLAN so Codex-in-loop still tự làm hết", async () => {
    const session = await runPlan({
      goal: GOAL,
      plannerChoice: "mock",
      harnessTeam: ["codex"],
      budgetTokens: 2000,
      workspaceSource: "demo",
      brainstorm: true,
    });
    expect(session.state).toBe("PLAN");
    expect(session.brainstormNotes).toMatch(/createTask|Nghiệp vụ/i);
    expect(session.brainstormPending).toBe(false);
    expect(session.planner).toBe("mock");
  });

  it("stores ChatGPT Q&A first and feeds the answers into the PLAN prompt", async () => {
    const started = await runPlan({
      goal: GOAL,
      plannerChoice: "chatgpt-web",
      harnessTeam: ["codex"],
      budgetTokens: 2000,
      workspaceSource: "demo",
      brainstorm: true,
    });
    expect(started.state).toBe("INIT");
    expect(started.brainstormPending).toBe(true);
    expect(started.pastePrompt).toMatch(/nghiệp vụ|câu hỏi|Q&A/i);
    expect(started.pastePrompt).not.toMatch(/STATE:\s*PLAN/);

    const noted = await importControlMessage({
      sessionId: started.id,
      raw: "Người dùng lọc theo status. createTask phải persist. Không viết wiki Jira trong vòng này.",
    });
    expect(noted.brainstormPending).toBe(false);
    expect(noted.brainstormNotes).toMatch(/persist/);
    expect(noted.state).toBe("INIT");
    expect(noted.pastePrompt).toContain("persist");
    expect(noted.pastePrompt).toMatch(/STATE:\s*PLAN|PACKETS:/);
  });
});
