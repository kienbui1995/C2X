import { existsSync } from "node:fs";
import { mkdir, readFile, readdir, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { renderCodexBrief } from "@/core/brief";
import { getHarness } from "@/core/providers/catalog";
import { isHarnessId, type HarnessId, type SessionRecord } from "@/core/types";
import { resolveWorkspaceRoot } from "@/core/workspace";

export type HarnessDetectResult = {
  id: HarnessId;
  ok: boolean;
  binary: string | null;
  hintVi: string;
  hintEn: string;
};

export const DETECT_CACHE_TTL_MS = 30_000;

const detectCache = new Map<string, { result: HarnessDetectResult; at: number }>();

export function clearDetectCache(): void {
  detectCache.clear();
}

export function binariesForHarness(id: HarnessId): string[] {
  return [...getHarness(id).binaries];
}

function cacheKey(id: HarnessId): string {
  return `${id}\0${process.env.PATH ?? ""}`;
}

function pathExtensions(): string[] {
  const pathext = process.env.PATHEXT;
  if (!pathext) {
    return [""];
  }
  return ["", ...pathext.split(";").filter(Boolean)];
}

function resolveOnPath(name: string): string | null {
  const dirs = (process.env.PATH ?? "").split(path.delimiter).filter(Boolean);
  const exts = pathExtensions();
  for (const dir of dirs) {
    for (const ext of exts) {
      const candidate = path.join(dir, `${name}${ext}`);
      if (existsSync(candidate)) {
        return candidate;
      }
    }
  }
  return null;
}

function missingHints(id: HarnessId, names: readonly string[]): Pick<
  HarnessDetectResult,
  "hintVi" | "hintEn"
> {
  const listed = names.join(" / ");
  return withUnofficialNote(id, {
    hintVi: `Không thấy ${listed}. Sao chép brief \`${id}\` vào tool đó — C2X không spawn harness.`,
    hintEn: `No ${listed} on PATH. Copy the \`${id}\` brief into that tool — C2X does not spawn a harness.`,
  });
}

function withUnofficialNote(
  id: HarnessId,
  hints: Pick<HarnessDetectResult, "hintVi" | "hintEn">,
): Pick<HarnessDetectResult, "hintVi" | "hintEn"> {
  if (!getHarness(id).unofficial) {
    return hints;
  }
  return {
    hintVi: `${hints.hintVi} Cộng đồng, không chính thức; cờ có thể đổi.`,
    hintEn: `${hints.hintEn} Unofficial, flags may change.`,
  };
}

export async function detectHarness(
  id: HarnessId,
  now?: () => number,
): Promise<HarnessDetectResult> {
  const clock = now ?? Date.now;
  const key = cacheKey(id);
  const cached = detectCache.get(key);
  if (cached && clock() - cached.at < DETECT_CACHE_TTL_MS) {
    return cached.result;
  }
  const names = binariesForHarness(id);
  let binary: string | null = null;
  for (const name of names) {
    binary = resolveOnPath(name);
    if (binary) {
      break;
    }
  }
  const hints = missingHints(id, names);
  const result: HarnessDetectResult = binary
    ? {
        id,
        ok: true,
        binary,
        ...withUnofficialNote(id, {
          hintVi: `Đã thấy ${path.basename(binary)} trên PATH. C2X không spawn harness.`,
          hintEn: `Found ${path.basename(binary)} on PATH. C2X does not spawn a harness.`,
        }),
      }
    : {
        id,
        ok: false,
        binary: null,
        ...hints,
      };
  detectCache.set(key, { result, at: clock() });
  return result;
}

export async function detectHarnessTeam(
  team: readonly HarnessId[],
  now?: () => number,
): Promise<HarnessDetectResult[]> {
  return Promise.all(team.map((id) => detectHarness(id, now)));
}

export function workspaceBriefPath(workspaceRoot: string, owner: HarnessId): string {
  return path.join(workspaceRoot, ".c2x", "briefs", `${owner}.md`);
}

export async function writeWorkspaceBriefDrop(input: {
  workspaceRoot: string;
  session: SessionRecord;
  owner: HarnessId;
}): Promise<string> {
  const brief =
    input.session.briefs.find((item) => item.owner === input.owner) ??
    (input.session.brief?.owner === input.owner ? input.session.brief : null);
  if (!brief) {
    throw new Error(`No precomputed brief for owner ${input.owner}.`);
  }
  const dest = workspaceBriefPath(input.workspaceRoot, input.owner);
  await mkdir(path.dirname(dest), { recursive: true, mode: 0o700 });
  await writeFile(dest, renderCodexBrief(brief), { encoding: "utf8", mode: 0o600 });
  return dest;
}

export async function syncWorkspaceBriefDrops(input: {
  workspaceRoot: string;
  session: SessionRecord;
}): Promise<string[]> {
  const written: string[] = [];
  for (const owner of input.session.harnessTeam) {
    const hasBrief =
      input.session.briefs.some((item) => item.owner === owner) ||
      input.session.brief?.owner === owner;
    if (!hasBrief) {
      continue;
    }
    written.push(
      await writeWorkspaceBriefDrop({
        workspaceRoot: input.workspaceRoot,
        session: input.session,
        owner,
      }),
    );
  }
  const dir = path.join(input.workspaceRoot, ".c2x", "briefs");
  let names: string[] = [];
  try {
    names = await readdir(dir);
  } catch {
    return written;
  }
  const keep = new Set(input.session.harnessTeam.map((id) => `${id}.md`));
  for (const name of names) {
    const id = name.endsWith(".md") ? name.slice(0, -3) : "";
    if (isHarnessId(id) && !keep.has(name)) {
      await rm(path.join(dir, name), { force: true });
    }
  }
  return written;
}

export async function persistWorkspaceBriefs(
  session: SessionRecord,
  cwd?: string,
): Promise<string[]> {
  if (session.state !== "PLAN" || session.briefs.length === 0) {
    return [];
  }
  const workspaceRoot = resolveWorkspaceRoot({ cwd, env: process.env });
  return syncWorkspaceBriefDrops({ workspaceRoot, session });
}

export async function writeHarnessBrief(input: {
  session: SessionRecord;
  owner: HarnessId;
  dataDir: string;
}): Promise<string> {
  const brief =
    input.session.briefs.find((item) => item.owner === input.owner) ??
    (input.session.brief?.owner === input.owner ? input.session.brief : null);
  if (!brief) {
    throw new Error(`No precomputed brief for owner ${input.owner}.`);
  }
  const dest = path.join(input.dataDir, "briefs", `${input.session.id}.${input.owner}.c2x.md`);
  await mkdir(path.dirname(dest), { recursive: true, mode: 0o700 });
  await writeFile(dest, renderCodexBrief(brief), { encoding: "utf8", mode: 0o600 });
  return dest;
}

export async function installSkill(input: {
  repoRoot: string;
  skillHome: string;
}): Promise<string> {
  const source = path.join(input.repoRoot, "skill", "SKILL.md");
  const dest = path.join(input.skillHome, "chat-to-x", "SKILL.md");
  const raw = existsSync(source)
    ? await readFile(source, "utf8")
    : await readFile(path.join(process.cwd(), "skill", "SKILL.md"), "utf8");
  const text = raw.replace("replace-with-absolute-path", input.repoRoot);
  await mkdir(path.dirname(dest), { recursive: true });
  await writeFile(dest, text, "utf8");
  return dest;
}

export async function installSkills(input: {
  repoRoot: string;
  skillHomes: readonly string[];
}): Promise<string[]> {
  const paths: string[] = [];
  for (const skillHome of input.skillHomes) {
    paths.push(await installSkill({ repoRoot: input.repoRoot, skillHome }));
  }
  return paths;
}
