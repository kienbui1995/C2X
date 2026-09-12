import { spawn } from "node:child_process";

function runGit(root: string, args: string[]): Promise<{ ok: boolean; stdout: string }> {
  return new Promise((resolve) => {
    const child = spawn("git", ["-C", root, ...args], {
      stdio: ["ignore", "pipe", "pipe"],
    });
    const chunks: Buffer[] = [];
    child.stdout.on("data", (chunk: Buffer) => {
      chunks.push(chunk);
    });
    child.on("error", () => {
      resolve({ ok: false, stdout: "" });
    });
    child.on("close", (code) => {
      resolve({
        ok: code === 0,
        stdout: Buffer.concat(chunks).toString("utf8"),
      });
    });
  });
}

function porcelainPath(line: string): string | null {
  const trimmed = line.trimEnd();
  if (!trimmed) {
    return null;
  }
  const rest = trimmed.slice(3).replace(/^"|"$/g, "");
  const path = rest.split(" -> ").at(-1)?.trim();
  return path || null;
}

export async function collectGitMetadata(root: string): Promise<{
  changedFiles: string[];
  diffStat: string;
  isGit: boolean;
}> {
  const inside = await runGit(root, ["rev-parse", "--is-inside-work-tree"]);
  if (!inside.ok) {
    return { changedFiles: [], diffStat: "", isGit: false };
  }
  const status = await runGit(root, ["status", "--porcelain"]);
  const changedFiles = status.stdout
    .split("\n")
    .map(porcelainPath)
    .filter((item): item is string => Boolean(item));
  const diff = await runGit(root, ["diff", "--stat", "HEAD"]);
  const diffStat = diff.stdout.trim().slice(0, 2000);
  return { changedFiles, diffStat, isGit: true };
}
