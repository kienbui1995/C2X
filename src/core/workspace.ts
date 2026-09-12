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

const MAX_FILES = 80;
const MAX_BYTES = 120_000;

async function walk(dir: string, root: string, acc: string[]): Promise<void> {
  if (acc.length >= MAX_FILES) {
    return;
  }
  const entries = await readdir(dir, { withFileTypes: true });
  for (const entry of entries) {
    if (acc.length >= MAX_FILES) {
      return;
    }
    const abs = path.join(dir, entry.name);
    const rel = path.relative(root, abs).replaceAll("\\", "/");
    if (isIgnoredPath(rel) || isSensitivePath(rel)) {
      continue;
    }
    if (entry.isDirectory()) {
      await walk(abs, root, acc);
      continue;
    }
    if (!TEXT_EXT.has(path.extname(entry.name))) {
      continue;
    }
    acc.push(rel);
  }
}

export async function loadWorkspaceFiles(source: WorkspaceSource): Promise<WorkspaceFile[]> {
  if (source === "demo") {
    return DEMO_FILES;
  }
  const root = process.cwd();
  const rels: string[] = [];
  await walk(root, root, rels);
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
