import { spawn } from "node:child_process";
import path from "node:path";
import { detectHarness } from "@/core/harness";
import { getHarness, resolveExecArgs } from "@/core/providers/catalog";
import type { HarnessId } from "@/core/types";

export const DEFAULT_SPAWN_TIMEOUT_MS = 10 * 60_000;

export type HarnessSpawnResult = {
  owner: HarnessId;
  command: string;
  args: string[];
  exitCode: number;
  skipped: boolean;
  reason: string | null;
};

export type SpawnHarnessFn = (input: {
  owner: HarnessId;
  workspaceRoot: string;
  timeoutMs?: number;
}) => Promise<HarnessSpawnResult>;

export function briefRelForHarness(owner: HarnessId): string {
  return path.posix.join(".c2x", "briefs", `${owner}.md`);
}

export async function spawnHarness(input: {
  owner: HarnessId;
  workspaceRoot: string;
  timeoutMs?: number;
}): Promise<HarnessSpawnResult> {
  const entry = getHarness(input.owner);
  const detected = await detectHarness(input.owner);
  const args = resolveExecArgs(entry, briefRelForHarness(input.owner));
  if (!detected.ok || !detected.binary) {
    return {
      owner: input.owner,
      command: entry.binaries[0] ?? input.owner,
      args,
      exitCode: 127,
      skipped: true,
      reason: detected.hintEn,
    };
  }
  const timeoutMs = input.timeoutMs ?? DEFAULT_SPAWN_TIMEOUT_MS;
  const exitCode = await new Promise<number>((resolve, reject) => {
    const child = spawn(detected.binary as string, [...args], {
      cwd: input.workspaceRoot,
      env: { ...process.env, C2X_BRIEF: briefRelForHarness(input.owner) },
      stdio: ["ignore", "pipe", "pipe"],
    });
    const timer = setTimeout(() => {
      child.kill("SIGTERM");
      reject(new Error(`Harness ${input.owner} timed out after ${timeoutMs}ms.`));
    }, timeoutMs);
    child.once("error", (error) => {
      clearTimeout(timer);
      reject(error);
    });
    child.once("exit", (code) => {
      clearTimeout(timer);
      resolve(code ?? 1);
    });
  });
  return {
    owner: input.owner,
    command: detected.binary,
    args,
    exitCode,
    skipped: false,
    reason: null,
  };
}
