import { getHarness } from "@/core/providers/catalog";
import { sanitizeImportedFiles } from "@/core/sensitive";
import {
  assertNever,
  CATALOG_PACKET_ROLES,
  isHarnessId,
  isHarnessPacketRole,
  resolveHarnessTeam,
  type CatalogPacketRole,
  type ContextPack,
  type HarnessId,
  type HarnessPacketRole,
  type WorkPacket,
} from "@/core/types";

function unique(values: string[]): string[] {
  return [...new Set(values.filter(Boolean))];
}

function listItems(block: string | undefined): string[] {
  if (!block) {
    return [];
  }
  return block
    .split("\n")
    .map((line) => line.replace(/^\s*(?:[-*]|\d+\.)\s*/, "").trim())
    .filter(Boolean);
}

export function isTestOwnedPath(path: string): boolean {
  const lower = path.toLowerCase();
  return (
    /\.(test|spec)\.[cm]?[jt]sx?$/.test(lower) ||
    /test-hint/.test(lower) ||
    /(^|\/)__tests__\//.test(lower) ||
    /(^|\/)tests?\//.test(lower)
  );
}

export function isCiOwnedPath(filePath: string): boolean {
  const lower = filePath.replaceAll("\\", "/").toLowerCase();
  const base = lower.split("/").pop() ?? lower;
  return (
    /(^|\/)\.github\//.test(lower) ||
    base === "dockerfile" ||
    base.startsWith("dockerfile.") ||
    /(^|\/)deploy\//.test(lower) ||
    /(^|\/)infra(\/|$)/.test(lower) ||
    /(^|\/)scripts\/deploy(\/|$)/.test(lower)
  );
}

export function isDocsOwnedPath(filePath: string): boolean {
  const lower = filePath.replaceAll("\\", "/").toLowerCase();
  return /(^|\/)docs\/wiki\//.test(lower) || /(^|\/)\.c2x\/outbox\/wiki\//.test(lower);
}

export function isDesignPath(filePath: string): boolean {
  const lower = filePath.replaceAll("\\", "/").toLowerCase();
  return lower === "design.md" || lower.endsWith("/design.md") || /(^|\/)design\//.test(lower);
}

export function classifyPathRole(filePath: string): CatalogPacketRole {
  if (isDocsOwnedPath(filePath)) {
    return "docs";
  }
  if (isCiOwnedPath(filePath)) {
    return "ci";
  }
  if (isTestOwnedPath(filePath)) {
    return "fix";
  }
  return "implement";
}

export function normalizePacketRole(value: string): HarnessPacketRole | null {
  if (value === "test") {
    return "fix";
  }
  return isHarnessPacketRole(value) ? value : null;
}

export function filesFromPack(pack: ContextPack): string[] {
  const fromExcerpts = pack.excerpts.map((excerpt) => excerpt.path);
  if (fromExcerpts.length > 0) {
    return unique(fromExcerpts);
  }
  return unique(
    pack.tree
      .split("\n")
      .map((line) => line.replace(/^\s*-\s*/, "").trim())
      .filter((line) => line && line !== "…"),
  );
}

export function assignPacketRoles(
  team: readonly HarnessId[],
): Array<{ owner: HarnessId; role: HarnessPacketRole }> {
  const resolved = resolveHarnessTeam({ harnessTeam: team });
  return resolved.map((owner) => ({
    owner,
    role: getHarness(owner).packetRole,
  }));
}

function clipGoal(goal: string): string {
  const trimmed = goal.trim().replace(/\s+/g, " ");
  return trimmed.length > 120 ? `${trimmed.slice(0, 117)}...` : trimmed;
}

function packetActions(
  role: HarnessPacketRole,
  goal: string,
  issues: readonly string[] = [],
): string[] {
  const clipped = clipGoal(goal);
  switch (role) {
    case "implement":
      return [
        `Apply the smallest production change that matches: ${clipped}`,
        "Touch only the production files in this packet.",
        "Do not edit test files owned by another harness.",
        "Stop when the implementation criteria pass. Do not refactor unrelated files.",
      ];
    case "fix":
      return [
        ...issues.map((issue) => `Fix: ${issue}`),
        `Add or extend tests for: ${clipped}`,
        "Cover the packed test modules only — do not re-implement production files owned by another harness.",
        "Run the focused tests and stop when they pass.",
      ].slice(0, 8);
    case "ci":
      return [
        `Update CI/CD, Docker, or deploy files for: ${clipped}`,
        "Touch only .github, Dockerfile, deploy/, infra, and scripts/deploy in this packet.",
        "Do not rewrite app/src owned by another harness.",
      ];
    case "docs":
      return [
        `Write wiki markdown for: ${clipped}`,
        "Drop files under docs/wiki or .c2x/outbox/wiki. Do not call Jira or Azure APIs.",
      ];
    case "general":
      return [
        `Read the packed excerpts and apply the smallest change that matches: ${clipped}`,
        "Touch only files listed in this packet unless a path is missing.",
        "Add or extend tests if this packet includes test files.",
        "Stop when success criteria pass. Do not refactor unrelated files.",
      ];
    default:
      return assertNever(role, `Unknown packet role: ${role}`);
  }
}

function packetTests(role: HarnessPacketRole, files: string[], goal: string): string[] {
  const clipped = clipGoal(goal);
  switch (role) {
    case "implement":
      return ["Leave automated tests to the fix-owner harness unless a smoke check is required."];
    case "fix":
      return [
        `Unit-test the packed modules for: ${clipped}`,
        ...files.filter(isTestOwnedPath).map((item) => `Extend ${item}.`),
      ].slice(0, 6);
    case "ci":
      return ["Run the focused CI/lint job for the files in this packet if one exists."];
    case "docs":
      return ["Wiki markdown is paste-only — no harness review."];
    case "general":
      return [`Unit-test the packed modules for: ${clipped}`];
    default:
      return assertNever(role, `Unknown packet role: ${role}`);
  }
}

function packetCriteria(role: HarnessPacketRole, goal: string): string[] {
  const clipped = clipGoal(goal);
  switch (role) {
    case "implement":
      return [
        `Goal behavior works: ${clipped}`,
        "No files outside this packet were edited.",
      ];
    case "fix":
      return [
        `Tests covering ${clipped} exist and pass.`,
        "Tests do not rewrite production files owned by another harness.",
      ];
    case "ci":
      return [
        `CI/CD files for ${clipped} stay in this packet.`,
        "No app/src edits leaked into the CI packet.",
      ];
    case "docs":
      return [`Wiki markdown for ${clipped} is ready to paste into ADO/Jira.`];
    case "general":
      return [
        `Goal behavior works: ${clipped}`,
        "No files outside this packet were edited.",
      ];
    default:
      return assertNever(role, `Unknown packet role: ${role}`);
  }
}

function ownersForRole(
  team: readonly HarnessId[],
  role: CatalogPacketRole,
): HarnessId[] {
  return team.filter((id) => getHarness(id).packetRole === role);
}

function fallbackOwners(
  team: readonly HarnessId[],
  role: CatalogPacketRole,
): HarnessId[] {
  const direct = ownersForRole(team, role);
  if (direct.length > 0) {
    return direct;
  }
  switch (role) {
    case "implement": {
      const first = team.find(Boolean);
      return first ? [first] : [];
    }
    case "fix":
    case "ci":
    case "docs": {
      const implementers = ownersForRole(team, "implement");
      const lastImplementer = implementers.slice(-1);
      if (lastImplementer.length > 0) {
        return lastImplementer;
      }
      const last = team.slice(-1);
      return last;
    }
    default:
      return assertNever(role, `Unknown catalog packet role: ${role}`);
  }
}

function appendOwned(
  owned: Map<HarnessId, string[]>,
  owner: HarnessId,
  files: readonly string[],
): void {
  const current = owned.get(owner) ?? [];
  current.push(...files);
  owned.set(owner, current);
}

function partitionFiles(
  files: string[],
  team: readonly HarnessId[],
): Map<HarnessId, string[]> {
  const uniqueFiles = unique(files);
  const owned = new Map<HarnessId, string[]>();
  for (const owner of team) {
    owned.set(owner, []);
  }
  if (team.length === 0) {
    return owned;
  }
  if (team.length === 1) {
    const only = team.find(Boolean);
    if (only) {
      owned.set(only, uniqueFiles);
    }
    return owned;
  }

  const buckets = new Map<CatalogPacketRole, string[]>();
  for (const role of CATALOG_PACKET_ROLES) {
    buckets.set(role, []);
  }
  for (const file of uniqueFiles) {
    const role = classifyPathRole(file);
    buckets.get(role)?.push(file);
  }

  for (const role of CATALOG_PACKET_ROLES) {
    const roleFiles = buckets.get(role) ?? [];
    if (roleFiles.length === 0) {
      continue;
    }
    const owners = fallbackOwners(team, role);
    if (owners.length === 0) {
      continue;
    }
    if (owners.length === 1) {
      appendOwned(owned, owners[0]!, roleFiles);
      continue;
    }
    const chunk = Math.ceil(roleFiles.length / owners.length) || 1;
    owners.forEach((owner, index) => {
      appendOwned(owned, owner, roleFiles.slice(index * chunk, (index + 1) * chunk));
    });
  }
  return owned;
}

export function splitWorkPackets(input: {
  team: readonly HarnessId[];
  files: string[];
  goal: string;
  taskId: string;
  iteration?: number;
  issues?: readonly string[];
}): WorkPacket[] {
  const team = resolveHarnessTeam({ harnessTeam: input.team });
  const roles = assignPacketRoles(team);
  const owned = partitionFiles(input.files, team);
  return roles.map(({ owner, role }) => {
    const files = owned.get(owner) ?? [];
    return {
      id: `${input.taskId}:${owner}`,
      owner,
      role,
      actions: packetActions(role, input.goal, input.issues),
      files,
      tests: packetTests(role, files, input.goal),
      successCriteria: packetCriteria(role, input.goal),
    };
  });
}

export function renderWorkPackets(packets: WorkPacket[]): string {
  const raw = packets
    .map((packet) =>
      [
        `## owner=${packet.owner} role=${packet.role}`,
        "ACTIONS:",
        packet.actions.map((item, index) => `${index + 1}. ${item}`).join("\n"),
        "FILES:",
        packet.files.map((item) => `- ${item}`).join("\n") || "- (none)",
        "TESTS:",
        packet.tests.map((item) => `- ${item}`).join("\n") || "- (none)",
        "SUCCESS_CRITERIA:",
        packet.successCriteria.map((item) => `- ${item}`).join("\n") || "- (none)",
      ].join("\n"),
    )
    .join("\n\n");
  // Indent so inner ACTIONS:/FILES: lines stay inside the PACKETS section.
  return raw
    .split("\n")
    .map((line) => (line.length > 0 ? `  ${line}` : line))
    .join("\n");
}

function parseInnerSections(body: string): Record<string, string> {
  const sections: Record<string, string> = {};
  let current = "";
  for (const line of body.split("\n")) {
    const match = /^(ACTIONS|FILES|TESTS|SUCCESS_CRITERIA):\s*(.*)$/.exec(line.trimEnd());
    if (match) {
      current = match[1];
      sections[current] = match[2] ? `${match[2]}\n` : "";
      continue;
    }
    if (!current) {
      continue;
    }
    sections[current] += `${line}\n`;
  }
  for (const key of Object.keys(sections)) {
    sections[key] = sections[key].trim();
  }
  return sections;
}

export function parseWorkPackets(block: string | undefined): WorkPacket[] {
  if (!block?.trim()) {
    return [];
  }
  const normalized = block.replace(/^ {2}/gm, "");
  const chunks = normalized
    .split(/^##\s+/m)
    .map((chunk) => chunk.trim())
    .filter(Boolean);
  const packets: WorkPacket[] = [];
  for (const chunk of chunks) {
    const lines = chunk.split("\n");
    const header = lines[0]?.trim() ?? "";
    const match = /^owner=([a-z0-9-]+)\s+role=([a-z]+)\s*$/i.exec(header);
    const role = match ? normalizePacketRole(match[2]) : null;
    if (!match || !isHarnessId(match[1]) || !role) {
      continue;
    }
    const sections = parseInnerSections(lines.slice(1).join("\n"));
    const files = sanitizeImportedFiles(
      listItems(sections.FILES).filter((item) => item !== "(none)"),
    );
    packets.push({
      id: `${match[1]}:${packets.length}`,
      owner: match[1],
      role,
      actions: listItems(sections.ACTIONS),
      files,
      tests: listItems(sections.TESTS).filter((item) => item !== "(none)"),
      successCriteria: listItems(sections.SUCCESS_CRITERIA).filter((item) => item !== "(none)"),
    });
  }
  return packets;
}

export function applyIssuesToPlan<T extends { goal: string; taskId: string; iteration: number; filesLikelyInvolved: string[]; packets: WorkPacket[] }>(
  plan: T,
  team: readonly HarnessId[],
  issues: readonly string[],
): T {
  if (issues.length === 0) {
    return plan;
  }
  return {
    ...plan,
    packets: splitWorkPackets({
      team,
      files: plan.filesLikelyInvolved.length > 0
        ? plan.filesLikelyInvolved
        : plan.packets.flatMap((packet) => packet.files),
      goal: plan.goal,
      taskId: plan.taskId,
      iteration: plan.iteration,
      issues,
    }),
  };
}

export function packetsHaveDisjointFiles(packets: WorkPacket[]): boolean {
  const owned = packets.flatMap((packet) => packet.files);
  return new Set(owned).size === owned.length;
}

export function packetOverlapWarning(packets: WorkPacket[]): string | null {
  if (packetsHaveDisjointFiles(packets)) {
    return null;
  }
  return "PACKETS overlap files — C2X kept the planner packets and did not auto-split. Mỗi harness chỉ thấy brief của mình.";
}
