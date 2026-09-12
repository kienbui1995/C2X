import { chmod, mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { binariesForHarness, detectHarness } from "@/core/harness";
import { getHarness } from "@/core/providers/catalog";
import { HARNESS_IDS } from "@/core/types";

describe("binariesForHarness", () => {
  it("lists at least one binary name for every harness id", () => {
    for (const id of HARNESS_IDS) {
      expect(binariesForHarness(id).length).toBeGreaterThan(0);
    }
    expect(binariesForHarness("grok-build")).toEqual([...getHarness("grok-build").binaries]);
    expect(binariesForHarness("kiro-cli")).toEqual(["kiro"]);
  });
});

describe("detectHarness", () => {
  it("finds a fake claude binary on PATH and stays ok:false when missing", async () => {
    const dir = await mkdtemp(path.join(os.tmpdir(), "c2x-bin-"));
    const fake = path.join(dir, "claude");
    await writeFile(fake, "#!/bin/sh\necho ok\n", "utf8");
    await chmod(fake, 0o755);
    const prev = process.env.PATH;
    process.env.PATH = dir;
    const found = await detectHarness("claude-code");
    process.env.PATH = "/nonexistent-c2x-path";
    const missing = await detectHarness("claude-code");
    process.env.PATH = prev;
    expect(found.ok).toBe(true);
    expect(found.binary).toBe(fake);
    expect(missing.ok).toBe(false);
    expect(missing.binary).toBeNull();
    expect(missing.hintVi.length).toBeGreaterThan(10);
    await rm(dir, { recursive: true, force: true });
  });
});
