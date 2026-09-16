import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { applyImportedReview } from "@/core/review-import";
import {
  assignPacketRoles,
  packetsHaveDisjointFiles,
  parseWorkPackets,
  splitWorkPackets,
} from "@/core/packets";
import { mockPlanFromPack, parsePlannerOutput } from "@/core/planner";
import { packWorkspace } from "@/core/packer";
import { getHarness, HARNESS_BY_ID } from "@/core/providers/catalog";
import { createSession } from "@/core/session";
import {
  CATALOG_PACKET_ROLES,
  HARNESS_IDS,
  PIPELINE_HARNESS_TEAM,
  isHarnessId,
  type HarnessId,
} from "@/core/types";

const PIPELINE_TEAM: HarnessId[] = ["claude-code", "codex", "grok-build"];

const PIPELINE_FILES = [
  "src/app/page.tsx",
  "src/lib/tasks.ts",
  "DESIGN.md",
  "src/lib/tasks.test.ts",
  "src/components/board.test.tsx",
  ".github/workflows/ci.yml",
  "Dockerfile",
  "deploy/fly.toml",
  "infra/main.tf",
  "scripts/deploy/release.sh",
];

describe("catalog packetRole", () => {
  it("puts a catalog packetRole on every harness so a new id fails typecheck", () => {
    expect(CATALOG_PACKET_ROLES).toEqual(["implement", "fix", "ci", "docs"]);
    expect(getHarness("claude-code").packetRole).toBe("implement");
    expect(getHarness("codex").packetRole).toBe("fix");
    expect(getHarness("grok-build").packetRole).toBe("ci");
    expect(getHarness("opencode").packetRole).toBe("implement");
    expect(getHarness("kiro-cli").packetRole).toBe("implement");
    expect(getHarness("agy").packetRole).toBe("implement");
    for (const id of HARNESS_IDS) {
      expect(HARNESS_BY_ID[id].packetRole).toBe(getHarness(id).packetRole);
      expect(CATALOG_PACKET_ROLES).toContain(getHarness(id).packetRole);
    }
    const catalog = readFileSync(
      path.join(process.cwd(), "src/core/providers/catalog.ts"),
      "utf8",
    );
    expect(catalog).toMatch(/packetRole:\s*CatalogPacketRole|packetRole:\s*["']implement["']/);
    expect(catalog).toMatch(/satisfies Record<HarnessId/);
  });

  it("never treats DESIGN.md or OpenDesign as a harness id", () => {
    expect(isHarnessId("DESIGN.md")).toBe(false);
    expect(isHarnessId("opendesign")).toBe(false);
    expect(isHarnessId("open-design")).toBe(false);
    expect(HARNESS_IDS).not.toContain("opendesign");
  });
});

describe("splitWorkPackets catalog roles", () => {
  it("assigns implement / fix / ci files by catalog packetRole for the pipeline team", () => {
    expect(PIPELINE_HARNESS_TEAM).toEqual(PIPELINE_TEAM);
    const packets = splitWorkPackets({
      team: PIPELINE_TEAM,
      files: PIPELINE_FILES,
      goal: "Ship the feature with tests and CI",
      taskId: "c2x_pipe",
    });
    const byOwner = Object.fromEntries(packets.map((packet) => [packet.owner, packet]));
    expect(byOwner["claude-code"]?.role).toBe("implement");
    expect(byOwner.codex?.role).toBe("fix");
    expect(byOwner["grok-build"]?.role).toBe("ci");

    expect(byOwner["claude-code"]?.files).toEqual(
      expect.arrayContaining(["src/app/page.tsx", "src/lib/tasks.ts", "DESIGN.md"]),
    );
    expect(
      byOwner["claude-code"]?.files.every(
        (file) => !/(^|\/)(\.github|deploy|infra|scripts\/deploy)\b|Dockerfile|\.test\./i.test(file),
      ),
    ).toBe(true);

    expect(byOwner.codex?.files).toEqual(
      expect.arrayContaining(["src/lib/tasks.test.ts", "src/components/board.test.tsx"]),
    );
    expect(byOwner.codex?.files.every((file) => /test/i.test(file))).toBe(true);

    expect(byOwner["grok-build"]?.files).toEqual(
      expect.arrayContaining([
        ".github/workflows/ci.yml",
        "Dockerfile",
        "deploy/fly.toml",
        "infra/main.tf",
        "scripts/deploy/release.sh",
      ]),
    );

    const owned = packets.flatMap((packet) => packet.files);
    expect(owned.sort()).toEqual([...PIPELINE_FILES].sort());
    expect(new Set(owned).size).toBe(owned.length);
    expect(packetsHaveDisjointFiles(packets)).toBe(true);
  });

  it("maps assignPacketRoles from the catalog instead of team[0] / last teammate", () => {
    expect(assignPacketRoles(["kiro-cli"])).toEqual([{ owner: "kiro-cli", role: "implement" }]);
    expect(assignPacketRoles(PIPELINE_TEAM)).toEqual([
      { owner: "codex", role: "fix" },
      { owner: "claude-code", role: "implement" },
      { owner: "grok-build", role: "ci" },
    ]);
    const packetsSrc = readFileSync(path.join(process.cwd(), "src/core/packets.ts"), "utf8");
    expect(packetsSrc).not.toMatch(/case ["']codex["']/);
    expect(packetsSrc).toMatch(/packetRole/);
    expect(packetsSrc).not.toMatch(/index === 0/);
    expect(packetsSrc).not.toMatch(/team\.at\(-1\)|team\[team\.length - 1\]/);
    expect(packetsSrc).not.toMatch(/owners\.slice\(0,\s*-1\)/);
  });

  it("does not reserve the last implementer for tests when no fix owner exists", () => {
    const files = ["src/theme.ts", "src/theme.test.ts", "src/tokens.css"];
    const packets = splitWorkPackets({
      team: ["opencode", "kiro-cli"],
      files,
      goal: "Add a dark mode toggle",
      taskId: "c2x_two_impl",
    });
    const byOwner = Object.fromEntries(packets.map((packet) => [packet.owner, packet]));
    expect(packets.every((packet) => packet.role === "implement")).toBe(true);
    const implementFiles = ["src/theme.ts", "src/tokens.css"];
    expect(byOwner.opencode?.files.some((file) => implementFiles.includes(file))).toBe(true);
    expect(byOwner["kiro-cli"]?.files.some((file) => implementFiles.includes(file))).toBe(true);
    expect(packetsHaveDisjointFiles(packets)).toBe(true);
    expect(packets.flatMap((packet) => packet.files).sort()).toEqual([...files].sort());
  });

  it("re-splits imported PACKETS by catalog role instead of trusting the planner", () => {
    const fallback = mockPlanFromPack(
      packWorkspace({
        goal: "Ship the feature with tests and CI",
        files: PIPELINE_FILES.map((path) => ({ path, content: `${path}\n` })),
        budgetTokens: 4000,
      }),
      "c2x_import_roles",
      PIPELINE_TEAM,
    );
    const imported = parsePlannerOutput(
      `[C2X]
STATE: PLAN
TASK_ID: c2x_import_roles
ITERATION: 1

GOAL:
Ship the feature with tests and CI

RATIONALE:
Planner tried to hand review to Codex.

ACTIONS:
1. Do everything.

FILES_LIKELY_INVOLVED:
- src/app/page.tsx
- src/lib/tasks.test.ts
- .github/workflows/ci.yml

TESTS:
- unit

SUCCESS_CRITERIA:
- tests pass

RISKS:
- none

PACKETS:
  ## owner=codex role=implement
  ACTIONS:
  1. Review the whole PR and rewrite src.
  FILES:
  - src/app/page.tsx
  - src/lib/tasks.test.ts
  - .github/workflows/ci.yml
  - /etc/passwd
  TESTS:
  - review
  SUCCESS_CRITERIA:
  - reviewed
  ## owner=claude-code role=fix
  ACTIONS:
  1. Also take the same files.
  FILES:
  - src/app/page.tsx
  TESTS:
  - none
  SUCCESS_CRITERIA:
  - overlap
`,
      fallback,
    );
    const byOwner = Object.fromEntries(imported.packets.map((packet) => [packet.owner, packet]));
    expect(byOwner.codex?.role).toBe("fix");
    expect(byOwner["claude-code"]?.role).toBe("implement");
    expect(byOwner["grok-build"]?.role).toBe("ci");
    expect(byOwner.codex?.files).toEqual(["src/lib/tasks.test.ts"]);
    expect(byOwner["claude-code"]?.files).toEqual(["src/app/page.tsx"]);
    expect(byOwner["grok-build"]?.files).toEqual([".github/workflows/ci.yml"]);
    expect(byOwner.codex?.actions.join(" ")).not.toMatch(/Review the whole PR/i);
    expect(imported.packets.flatMap((packet) => packet.files).join("\n")).not.toMatch(/\/etc\/passwd/);
    expect(packetsHaveDisjointFiles(imported.packets)).toBe(true);
  });

  it("accepts legacy role=test as fix when parsing packets", () => {
    const packets = parseWorkPackets(`
## owner=codex role=test
ACTIONS:
1. Cover the packed tests.
FILES:
- src/lib/tasks.test.ts
TESTS:
- unit
SUCCESS_CRITERIA:
- tests pass
`);
    expect(packets).toHaveLength(1);
    expect(packets[0]?.role).toBe("fix");
    expect(packets[0]?.owner).toBe("codex");
  });
});

describe("review ISSUES become execute-only fix packets", () => {
  it("gives Codex the ISSUES after REVIEW without making Codex the reviewer", () => {
    const pack = packWorkspace({
      goal: "Sửa createTask",
      files: [
        { path: "src/lib/tasks.ts", content: "export function createTask() {}" },
        { path: "src/lib/tasks.test.ts", content: "it('persists', () => {});" },
      ],
      budgetTokens: 2000,
    });
    const plan = mockPlanFromPack(pack, "c2x_issues", PIPELINE_TEAM);
    const session = {
      ...createSession({
        goal: pack.goal,
        planner: "chatgpt-web",
        plannerChoice: "chatgpt-web",
        harnessTeam: PIPELINE_TEAM,
        budgetTokens: 2000,
        workspaceSource: "demo",
      }),
      state: "EXECUTED" as const,
      pack,
      plan,
    };
    const next = applyImportedReview(
      session,
      `[C2X]
STATE: PLAN
TASK_ID: ${session.id}
ITERATION: 2

GOAL:
Sửa createTask

RATIONALE:
One more tight iteration.

ACTIONS:
1. Fix the failing assertion.

FILES_LIKELY_INVOLVED:
- src/lib/tasks.ts
- src/lib/tasks.test.ts

TESTS:
- unit

SUCCESS_CRITERIA:
- tests pass

RISKS:
- none

ISSUES:
- createTask still drops the row

PACKETS:
`,
    );
    expect(next.state).toBe("PLAN");
    const fix = next.plan?.packets.find((packet) => packet.owner === "codex");
    expect(fix?.role).toBe("fix");
    expect(fix?.actions.join(" ")).toMatch(/createTask still drops the row/);
    expect(next.events.at(-1)?.note ?? "").not.toMatch(/Codex.*review|reviewer/i);
  });
});
