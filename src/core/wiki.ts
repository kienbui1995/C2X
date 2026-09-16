import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { isDocsOwnedPath } from "@/core/packets";
import { resolveWorkspaceRoot } from "@/core/workspace";
import type { SessionRecord } from "@/core/types";

function wantsWikiOutbox(session: SessionRecord): boolean {
  if (session.state !== "PLAN" || !session.plan) {
    return false;
  }
  const hay = [session.goal, session.plan.rationale, session.brainstormNotes ?? ""].join("\n");
  if (/wiki|jira|azure devops|tài liệu/i.test(hay)) {
    return true;
  }
  if (session.plan.packets.some((packet) => packet.role === "docs")) {
    return true;
  }
  return session.plan.filesLikelyInvolved.some((file) => isDocsOwnedPath(file));
}

export function renderWikiPage(session: SessionRecord): string {
  const plan = session.plan;
  const notes = session.brainstormNotes?.trim();
  return [
    `# ${session.goal.trim() || session.id}`,
    "",
    "Paste this markdown into Azure DevOps wiki or Jira. C2X does not call those APIs (no OAuth, no PAT).",
    "",
    "## Goal",
    session.goal.trim(),
    "",
    notes ? `## Brainstorm notes\n${notes}\n` : "",
    plan?.rationale ? `## Rationale\n${plan.rationale.trim()}\n` : "",
    "## Packets",
    ...(plan?.packets ?? []).map(
      (packet) => `- ${packet.owner} (${packet.role}): ${packet.files.join(", ") || "(none)"}`,
    ),
    "",
  ]
    .filter((line) => line !== "")
    .join("\n")
    .concat("\n");
}

export async function persistWikiOutbox(
  session: SessionRecord,
  cwd?: string,
): Promise<string[]> {
  if (!wantsWikiOutbox(session)) {
    return [];
  }
  const root = resolveWorkspaceRoot({ cwd, env: process.env });
  const body = renderWikiPage(session);
  const dests = [
    path.join(root, ".c2x", "outbox", "wiki", `${session.id}.md`),
    path.join(root, "docs", "wiki", `${session.id}.md`),
  ];
  for (const dest of dests) {
    await mkdir(path.dirname(dest), { recursive: true, mode: 0o700 });
    await writeFile(dest, body, { encoding: "utf8", mode: 0o600 });
  }
  return dests;
}
