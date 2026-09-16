import { mkdtemp, rm, stat } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { mergeConfig } from "@/core/config";
import { createSession } from "@/core/session";
import { saveConfig, saveSessions } from "@/core/store";

describe("store file modes", () => {
  let root = "";
  let prevData: string | undefined;

  beforeEach(async () => {
    root = await mkdtemp(path.join(os.tmpdir(), "c2x-store-perms-"));
    prevData = process.env.C2X_DATA_DIR;
    process.env.C2X_DATA_DIR = path.join(root, "data");
  });

  afterEach(async () => {
    if (prevData === undefined) {
      delete process.env.C2X_DATA_DIR;
    } else {
      process.env.C2X_DATA_DIR = prevData;
    }
    await rm(root, { recursive: true, force: true });
  });

  it("creates the data dir 0o700 and writes config/sessions 0o600", async () => {
    await saveConfig(mergeConfig());
    await saveSessions([
      createSession({
        goal: "Sửa createTask",
        planner: "mock",
        plannerChoice: "mock",
        harnessTeam: ["codex"],
        budgetTokens: 2000,
        workspaceSource: "demo",
      }),
    ]);
    const dir = await stat(path.join(root, "data"));
    const config = await stat(path.join(root, "data", "config.json"));
    const sessions = await stat(path.join(root, "data", "sessions.json"));
    expect(dir.mode & 0o777).toBe(0o700);
    expect(config.mode & 0o777).toBe(0o600);
    expect(sessions.mode & 0o777).toBe(0o600);
  });
});
