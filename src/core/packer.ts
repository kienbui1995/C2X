import { isIgnoredPath, isSensitivePath } from "@/core/sensitive";
import { clampBudget, estimateTokens } from "@/core/tokens";
import type { ContextPack, PackedExcerpt, WorkspaceFile } from "@/core/types";

const TREE_BUDGET = 400;
const EXCERPT_LINE_CAP = 80;

function tokenizeGoal(goal: string): string[] {
  return goal
    .toLowerCase()
    .split(/[^a-z0-9àáạảãâầấậẩẫăằắặẳẵèéẹẻẽêềếệểễìíịỉĩòóọỏõôồốộổỗơờớợởỡùúụủũưừứựửữỳýỵỷỹđ_]+/i)
    .map((token) => token.trim())
    .filter((token) => token.length >= 2);
}

function scoreFile(file: WorkspaceFile, terms: string[]): number {
  const hay = `${file.path}\n${file.content}`.toLowerCase();
  let score = 0;
  for (const term of terms) {
    if (file.path.toLowerCase().includes(term)) {
      score += 8;
    }
    const hits = hay.split(term).length - 1;
    score += Math.min(12, hits);
  }
  if (/\.(ts|tsx|js|jsx|py|go|rs|md)$/.test(file.path)) {
    score += 2;
  }
  if (file.path.endsWith("package.json") || file.path.endsWith("README.md")) {
    score += 3;
  }
  return score;
}

function buildTree(files: WorkspaceFile[]): string {
  const lines = files
    .map((file) => file.path)
    .sort((a, b) => a.localeCompare(b))
    .map((path) => `- ${path}`);
  const text = lines.join("\n");
  if (estimateTokens(text) <= TREE_BUDGET) {
    return text;
  }
  return `${lines.slice(0, 80).join("\n")}\n- … ${Math.max(0, lines.length - 80)} more`;
}

function excerptForFile(file: WorkspaceFile, terms: string[]): PackedExcerpt {
  const lines = file.content.split("\n");
  if (lines.length <= EXCERPT_LINE_CAP) {
    const content = file.content.trimEnd();
    return {
      path: file.path,
      startLine: 1,
      endLine: lines.length,
      content,
      reason: "full file fits the budget",
      tokens: estimateTokens(content),
    };
  }

  const windows: number[] = [];
  lines.forEach((line, index) => {
    const lower = line.toLowerCase();
    if (terms.some((term) => lower.includes(term))) {
      windows.push(index);
    }
  });

  const start = windows.length > 0 ? Math.max(0, windows[0] - 8) : 0;
  const end = Math.min(lines.length, start + EXCERPT_LINE_CAP);
  const content = lines.slice(start, end).join("\n");
  return {
    path: file.path,
    startLine: start + 1,
    endLine: end,
    content,
    reason:
      windows.length > 0
        ? "keyword window around the goal"
        : "file head — no keyword hit",
    tokens: estimateTokens(content),
  };
}

export function packWorkspace(input: {
  goal: string;
  files: WorkspaceFile[];
  budgetTokens: number;
}): ContextPack {
  const budget = clampBudget(input.budgetTokens);
  const terms = tokenizeGoal(input.goal);
  const skippedSensitive: string[] = [];
  const usable: WorkspaceFile[] = [];

  for (const file of input.files) {
    if (isIgnoredPath(file.path)) {
      continue;
    }
    if (isSensitivePath(file.path)) {
      skippedSensitive.push(file.path);
      continue;
    }
    usable.push(file);
  }

  const rawTokens = usable.reduce(
    (sum, file) => sum + estimateTokens(file.content),
    0,
  );
  const tree = buildTree(usable);
  const ranked = [...usable].sort(
    (a, b) => scoreFile(b, terms) - scoreFile(a, terms),
  );

  const excerpts: PackedExcerpt[] = [];
  const omittedFiles: string[] = [];
  let packedTokens = estimateTokens(`${input.goal}\n${tree}`);

  for (const file of ranked) {
    const excerpt = excerptForFile(file, terms);
    if (packedTokens + excerpt.tokens > budget && excerpts.length >= 2) {
      omittedFiles.push(file.path);
      continue;
    }
    if (packedTokens + excerpt.tokens > budget) {
      const room = Math.max(120, budget - packedTokens);
      const clipped = excerpt.content.slice(0, room * 4);
      const tokens = estimateTokens(clipped);
      excerpts.push({ ...excerpt, content: clipped, tokens, reason: "clipped to budget" });
      packedTokens += tokens;
      continue;
    }
    excerpts.push(excerpt);
    packedTokens += excerpt.tokens;
  }

  const compressionRatio = rawTokens === 0 ? 1 : packedTokens / rawTokens;
  return {
    goal: input.goal,
    tree,
    excerpts,
    omittedFiles,
    skippedSensitive,
    fileCount: usable.length,
    rawTokens,
    packedTokens,
    budgetTokens: budget,
    compressionRatio,
  };
}

export function renderPackForPlanner(pack: ContextPack): string {
  const excerptBlock = pack.excerpts
    .map(
      (excerpt) =>
        `FILE ${excerpt.path}:${excerpt.startLine}-${excerpt.endLine} (${excerpt.reason})\n${excerpt.content}`,
    )
    .join("\n\n");
  return [
    `GOAL:\n${pack.goal}`,
    `TREE:\n${pack.tree}`,
    excerptBlock ? `EXCERPTS:\n${excerptBlock}` : "EXCERPTS:\n(none)",
    pack.omittedFiles.length
      ? `OMITTED:\n${pack.omittedFiles.map((path) => `- ${path}`).join("\n")}`
      : "",
  ]
    .filter(Boolean)
    .join("\n\n");
}
