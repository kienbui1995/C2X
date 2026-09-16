import { chmod, mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { mergeConfig } from "@/core/config";
import { normalizeSession } from "@/core/session";
import type { AppConfig, ContextPack, SessionRecord } from "@/core/types";

const livePacks = new Map<string, ContextPack>();

function withLivePack(session: SessionRecord): SessionRecord {
  if (!session.pack) {
    return session;
  }
  const live = livePacks.get(session.id) ?? session.pack;
  livePacks.set(session.id, live);
  if (live === session.pack) {
    return session;
  }
  return { ...session, pack: live };
}

export function dataDir(): string {
  return (
    process.env.C2X_DATA_DIR ||
    process.env.FRUGAL_DATA_DIR ||
    path.join(process.cwd(), "data")
  );
}

function configPath(): string {
  return path.join(dataDir(), "config.json");
}

function sessionsPath(): string {
  return path.join(dataDir(), "sessions.json");
}

async function ensureDir(): Promise<void> {
  await mkdir(dataDir(), { recursive: true, mode: 0o700 });
  await chmod(dataDir(), 0o700);
}

async function writePrivateFile(filePath: string, body: string): Promise<void> {
  await writeFile(filePath, body, { encoding: "utf8", mode: 0o600 });
  await chmod(filePath, 0o600);
}

export async function loadConfig(): Promise<AppConfig> {
  try {
    const raw = await readFile(configPath(), "utf8");
    return mergeConfig(JSON.parse(raw) as Partial<AppConfig>);
  } catch {
    return mergeConfig();
  }
}

export async function saveConfig(config: AppConfig): Promise<AppConfig> {
  await ensureDir();
  const merged = mergeConfig(config);
  await writePrivateFile(configPath(), `${JSON.stringify(merged, null, 2)}\n`);
  return merged;
}

export async function loadSessions(): Promise<SessionRecord[]> {
  try {
    const raw = await readFile(sessionsPath(), "utf8");
    const parsed = JSON.parse(raw) as SessionRecord[];
    return Array.isArray(parsed)
      ? parsed.map((item) => withLivePack(normalizeSession(item)))
      : [];
  } catch {
    return [];
  }
}

export async function saveSessions(sessions: SessionRecord[]): Promise<void> {
  await ensureDir();
  await writePrivateFile(sessionsPath(), `${JSON.stringify(sessions, null, 2)}\n`);
}

export async function upsertSession(session: SessionRecord): Promise<SessionRecord> {
  const normalized = withLivePack(normalizeSession(session));
  const sessions = await loadSessions();
  const index = sessions.findIndex((item) => item.id === normalized.id);
  if (index === -1) {
    sessions.unshift(normalized);
  } else {
    sessions[index] = normalized;
  }
  await saveSessions(sessions.slice(0, 80));
  return normalized;
}

export async function getSession(id: string): Promise<SessionRecord | null> {
  const sessions = await loadSessions();
  return sessions.find((item) => item.id === id) ?? null;
}

export async function resolveSessionRecord(id?: string): Promise<SessionRecord | null> {
  const trimmed = id?.trim();
  if (trimmed) {
    return getSession(trimmed);
  }
  const sessions = await loadSessions();
  return sessions[0] ?? null;
}
