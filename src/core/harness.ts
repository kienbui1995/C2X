import { existsSync } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { renderCodexBrief } from "@/core/brief";
import { getHarness } from "@/core/providers/catalog";
import type { HarnessId, SessionRecord } from "@/core/types";

export type HarnessDetectResult = {
  id: HarnessId;
  ok: boolean;
  binary: string | null;
  hintVi: string;
  hintEn: string;
};

const detectCache = new Map<string, HarnessDetectResult>();

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
  return {
    hintVi: `Không thấy ${listed}. Sao chép brief \`${id}\` vào tool đó — C2X không spawn harness.`,
    hintEn: `No ${listed} on PATH. Copy the \`${id}\` brief into that tool — C2X does not spawn a harness.`,
  };
}

export async function detectHarness(id: HarnessId): Promise<HarnessDetectResult> {
  const key = cacheKey(id);
  const cached = detectCache.get(key);
  if (cached) {
    return cached;
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
        hintVi: `Đã thấy ${path.basename(binary)} trên PATH. C2X không spawn harness.`,
        hintEn: `Found ${path.basename(binary)} on PATH. C2X does not spawn a harness.`,
      }
    : {
        id,
        ok: false,
        binary: null,
        ...hints,
      };
  detectCache.set(key, result);
  return result;
}

export async function detectHarnessTeam(
  team: readonly HarnessId[],
): Promise<HarnessDetectResult[]> {
  return Promise.all(team.map((id) => detectHarness(id)));
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
  await mkdir(path.dirname(dest), { recursive: true });
  await writeFile(dest, renderCodexBrief(brief), "utf8");
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
