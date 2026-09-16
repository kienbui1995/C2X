import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { maskSecret, mergeConfig } from "@/core/config";
import { getPublicConfig } from "@/lib/server-data";
import { saveConfig } from "@/core/store";

const RAW_KEY = "sk-super-secret-key-material-xyz";

describe("getPublicConfig", () => {
  let dataDir = "";
  let prevData: string | undefined;

  beforeEach(async () => {
    dataDir = await mkdtemp(path.join(os.tmpdir(), "c2x-public-config-"));
    prevData = process.env.C2X_DATA_DIR;
    process.env.C2X_DATA_DIR = dataDir;
  });

  afterEach(async () => {
    if (prevData === undefined) {
      delete process.env.C2X_DATA_DIR;
    } else {
      process.env.C2X_DATA_DIR = prevData;
    }
    await rm(dataDir, { recursive: true, force: true });
  });

  it("masks provider keys with the same maskSecret as GET /api/config", async () => {
    await saveConfig(mergeConfig({ keys: { openai: RAW_KEY } }));
    const pub = await getPublicConfig();
    const serialized = JSON.stringify(pub);
    expect(serialized).not.toContain(RAW_KEY);
    expect(serialized).not.toContain("sk-super-secret");
    expect(pub.keys.openai).toBe(maskSecret(RAW_KEY));
    expect(pub.keys.openai).toMatch(/••••/);
    expect(pub.configured.openai).toBe(true);
  });
});
