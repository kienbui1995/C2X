import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { mergeConfig } from "@/core/config";
import type { AppConfig, SessionRecord } from "@/core/types";

function dataDir(): string {
  return process.env.FRUGAL_DATA_DIR || path.join(process.cwd(), "data");
}

function configPath(): string {
  return path.join(dataDir(), "config.json");
}

function sessionsPath(): string {
  return path.join(dataDir(), "sessions.json");
}

async function ensureDir(): Promise<void> {
  await mkdir(dataDir(), { recursive: true });
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
  await writeFile(configPath(), `${JSON.stringify(merged, null, 2)}\n`, "utf8");
  return merged;
}

export async function loadSessions(): Promise<SessionRecord[]> {
  try {
    const raw = await readFile(sessionsPath(), "utf8");
    const parsed = JSON.parse(raw) as SessionRecord[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export async function saveSessions(sessions: SessionRecord[]): Promise<void> {
  await ensureDir();
  await writeFile(sessionsPath(), `${JSON.stringify(sessions, null, 2)}\n`, "utf8");
}

export async function upsertSession(session: SessionRecord): Promise<SessionRecord> {
  const sessions = await loadSessions();
  const index = sessions.findIndex((item) => item.id === session.id);
  if (index === -1) {
    sessions.unshift(session);
  } else {
    sessions[index] = session;
  }
  await saveSessions(sessions.slice(0, 80));
  return session;
}

export async function getSession(id: string): Promise<SessionRecord | null> {
  const sessions = await loadSessions();
  return sessions.find((item) => item.id === id) ?? null;
}
