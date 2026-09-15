import { mkdir, readdir, readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";
import { extractControlBlock } from "@/core/planner";

export const C2X_INBOX = path.join(".c2x", "inbox");
export const C2X_OUTBOX = path.join(".c2x", "outbox");
export const C2X_INBOX_CONSUMED = path.join(".c2x", "inbox", "consumed");

export function inboxDir(workspaceRoot: string): string {
  return path.join(workspaceRoot, C2X_INBOX);
}

export function outboxDir(workspaceRoot: string): string {
  return path.join(workspaceRoot, C2X_OUTBOX);
}

export async function writeOutboxFile(
  workspaceRoot: string,
  name: string,
  content: string,
): Promise<string> {
  const dest = path.join(outboxDir(workspaceRoot), name);
  await mkdir(path.dirname(dest), { recursive: true });
  await writeFile(dest, content, "utf8");
  return dest;
}

function looksLikeControl(raw: string): boolean {
  const trimmed = raw.trim();
  return trimmed.includes("[C2X]") || trimmed.includes("[C2C]");
}

async function takeControlFile(abs: string, consumedName: string, workspaceRoot: string): Promise<string | null> {
  let raw = "";
  try {
    raw = await readFile(abs, "utf8");
  } catch {
    return null;
  }
  if (!looksLikeControl(raw)) {
    return null;
  }
  const consumed = path.join(workspaceRoot, C2X_INBOX_CONSUMED);
  await mkdir(consumed, { recursive: true });
  await rename(abs, path.join(consumed, consumedName));
  return extractControlBlock(raw);
}

export async function consumeInboxControl(workspaceRoot: string): Promise<string | null> {
  const single = path.join(workspaceRoot, ".c2x", "inbox.md");
  const fromSingle = await takeControlFile(single, "inbox.md", workspaceRoot);
  if (fromSingle) {
    return fromSingle;
  }
  const dir = inboxDir(workspaceRoot);
  let names: string[] = [];
  try {
    names = (await readdir(dir)).filter((name) => name.endsWith(".md") && name !== "consumed");
  } catch {
    return null;
  }
  names.sort((a, b) => a.localeCompare(b));
  for (const name of names) {
    const taken = await takeControlFile(path.join(dir, name), name, workspaceRoot);
    if (taken) {
      return taken;
    }
  }
  return null;
}

export async function waitForInboxControl(input: {
  workspaceRoot: string;
  timeoutMs?: number;
  intervalMs?: number;
  now?: () => number;
  sleep?: (ms: number) => Promise<void>;
}): Promise<string> {
  const timeoutMs = input.timeoutMs ?? 15 * 60_000;
  const intervalMs = input.intervalMs ?? 250;
  const now = input.now ?? Date.now;
  const sleep = input.sleep ?? ((ms: number) => new Promise((resolve) => setTimeout(resolve, ms)));
  const started = now();
  while (now() - started <= timeoutMs) {
    const raw = await consumeInboxControl(input.workspaceRoot);
    if (raw) {
      return raw;
    }
    if (now() - started + intervalMs > timeoutMs) {
      break;
    }
    await sleep(intervalMs);
  }
  throw new Error(
    `Dán khối [C2X] vào ${path.join(input.workspaceRoot, ".c2x", "inbox.md")}`,
  );
}
