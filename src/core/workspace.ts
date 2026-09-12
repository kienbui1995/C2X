import { readdir, readFile, stat } from "node:fs/promises";
import path from "node:path";
import { DEMO_FILES } from "@/core/fixtures/demo-workspace";
import { isIgnoredPath, isSensitivePath } from "@/core/sensitive";
import type { WorkspaceFile, WorkspaceSource } from "@/core/types";

const TEXT_EXT = new Set([
  ".ts",
  ".tsx",
  ".js",
  ".jsx",
  ".mjs",
  ".cjs",
  ".json",
  ".md",
  ".css",
  ".html",
  ".yml",
  ".yaml",
  ".toml",
  ".txt",
]);

export const MAX_FILES = 80;
export const MAX_BYTES = 120_000;
export const MAX_WALK_MS = 250;

export function resolveWorkspaceRoot(input?: {
  cwd?: string;
  env?: NodeJS.ProcessEnv | Record<string, string | undefined>;
}): string {
  const cwd = input?.cwd?.trim();
  if (cwd) {
    return cwd;
  }
  const envRoot = (input?.env ?? process.env).C2X_WORKSPACE?.trim();
  if (envRoot) {
    return envRoot;
  }
  return process.cwd();
}

export async function loadC2xIgnore(root: string): Promise<string[]> {
  try {
    const raw = await readFile(path.join(root, ".c2xignore"), "utf8");
    return raw
      .split("\n")
      .map((line) => line.trim())
      .filter((line) => line.length > 0 && !line.startsWith("#"));
  } catch {
    return [];
  }
}

async function walk(
  dir: string,
  root: string,
  acc: string[],
  started: number,
  now: () => number,
  extra: string[],
): Promise<void> {
  if (acc.length >= MAX_FILES || now() - started >= MAX_WALK_MS) {
    return;
  }
  const entries = await readdir(dir, { withFileTypes: true });
  for (const entry of entries) {
    if (acc.length >= MAX_FILES || now() - started >= MAX_WALK_MS) {
      return;
    }
    const abs = path.join(dir, entry.name);
    const rel = path.relative(root, abs).replaceAll("\\", "/");
    if (isIgnoredPath(rel, extra) || isSensitivePath(rel)) {
      continue;
    }
    if (entry.isDirectory()) {
      await walk(abs, root, acc, started, now, extra);
      continue;
    }
    if (!TEXT_EXT.has(path.extname(entry.name))) {
      continue;
    }
    acc.push(rel);
  }
}

export async function loadWorkspaceFiles(
  source: WorkspaceSource,
  now?: () => number,
): Promise<WorkspaceFile[]> {
  if (source === "demo") {
    return DEMO_FILES;
  }
  const clock = now ?? Date.now;
  const root = resolveWorkspaceRoot({ env: process.env });
  const extra = await loadC2xIgnore(root);
  const rels: string[] = [];
  await walk(root, root, rels, clock(), clock, extra);
  const files: WorkspaceFile[] = [];
  for (const rel of rels) {
    const abs = path.join(root, rel);
    const info = await stat(abs);
    if (info.size > MAX_BYTES) {
      continue;
    }
    const content = await readFile(abs, "utf8");
    files.push({ path: rel, content });
  }
  return files;
}
