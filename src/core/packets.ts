import { sanitizeImportedFiles } from "@/core/sensitive";
import {
  assertNever,
  isHarnessId,
  isHarnessPacketRole,
  resolveHarnessTeam,
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
  if (team.length === 1) {
    return [{ owner: team[0], role: "general" }];
  }
  return team.map((owner, index) => {
    if (index === 0) {
      return { owner, role: "implement" };
    }
    if (index === team.length - 1) {
      return { owner, role: "test" };
    }
    return { owner, role: "general" };
  });
}

function clipGoal(goal: string): string {
  const trimmed = goal.trim().replace(/\s+/g, " ");
  return trimmed.length > 120 ? `${trimmed.slice(0, 117)}...` : trimmed;
}

function packetActions(role: HarnessPacketRole, goal: string): string[] {
  const clipped = clipGoal(goal);
  switch (role) {
    case "implement":
      return [
        `Apply the smallest production change that matches: ${clipped}`,
        "Touch only the production files in this packet.",
        "Do not edit test files owned by another harness.",
        "Stop when the implementation criteria pass. Do not refactor unrelated files.",
      ];
    case "test":
      return [
        `Add or extend tests for: ${clipped}`,
        "Cover the packed test modules only — do not re-implement production files owned by another harness.",
        "Run the focused tests and stop when they pass.",
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
      return ["Leave automated tests to the test-owner harness unless a smoke check is required."];
    case "test":
      return [
        `Unit-test the packed modules for: ${clipped}`,
        ...files.filter(isTestOwnedPath).map((path) => `Extend ${path}.`),
      ].slice(0, 6);
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
    case "test":
      return [
        `Tests covering ${clipped} exist and pass.`,
        "Tests do not rewrite production files owned by another harness.",
      ];
    case "general":
      return [
        `Goal behavior works: ${clipped}`,
        "No files outside this packet were edited.",
      ];
    default:
      return assertNever(role, `Unknown packet role: ${role}`);
  }
}

function partitionFiles(
  files: string[],
  team: readonly HarnessId[],
): Map<HarnessId, string[]> {
  const uniqueFiles = unique(files);
  const owned = new Map<HarnessId, string[]>();
  if (team.length === 0) {
    return owned;
  }
  if (team.length === 1) {
    owned.set(team[0], uniqueFiles);
    return owned;
  }

  const testFiles = uniqueFiles.filter(isTestOwnedPath);
  const implFiles = uniqueFiles.filter((path) => !isTestOwnedPath(path));

  if (testFiles.length === 0 || implFiles.length === 0) {
    const chunk = Math.ceil(uniqueFiles.length / team.length) || 1;
    team.forEach((owner, index) => {
      owned.set(owner, uniqueFiles.slice(index * chunk, (index + 1) * chunk));
    });
    return owned;
  }

  const implementers = team.slice(0, -1);
  const tester = team[team.length - 1];
  const chunk = Math.ceil(implFiles.length / implementers.length) || 1;
  implementers.forEach((owner, index) => {
    owned.set(owner, implFiles.slice(index * chunk, (index + 1) * chunk));
  });
  owned.set(tester, testFiles);
  return owned;
}

export function splitWorkPackets(input: {
  team: readonly HarnessId[];
  files: string[];
  goal: string;
  taskId: string;
  iteration?: number;
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
      actions: packetActions(role, input.goal),
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
    if (!match || !isHarnessId(match[1]) || !isHarnessPacketRole(match[2])) {
      continue;
    }
    const sections = parseInnerSections(lines.slice(1).join("\n"));
    const files = sanitizeImportedFiles(
      listItems(sections.FILES).filter((item) => item !== "(none)"),
    );
    packets.push({
      id: `${match[1]}:${packets.length}`,
      owner: match[1],
      role: match[2],
      actions: listItems(sections.ACTIONS),
      files,
      tests: listItems(sections.TESTS).filter((item) => item !== "(none)"),
      successCriteria: listItems(sections.SUCCESS_CRITERIA).filter((item) => item !== "(none)"),
    });
  }
  return packets;
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
