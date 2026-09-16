import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { parseWorkPackets } from "@/core/packets";
import { CONTROL_BUDGET_MAX } from "@/core/protocol";
import { importPlan, runPlan } from "@/core/run-loop";

let dataDir = "";

beforeEach(async () => {
  dataDir = await mkdtemp(path.join(os.tmpdir(), "c2x-import-files-"));
  process.env.FRUGAL_DATA_DIR = dataDir;
  process.env.C2X_WORKSPACE = dataDir;
});

afterEach(async () => {
  delete process.env.FRUGAL_DATA_DIR;
  delete process.env.C2X_WORKSPACE;
  await rm(dataDir, { recursive: true, force: true });
});

function planBlock(sessionId: string, files: string[]): string {
  const listed = files.map((item) => `  - ${item}`).join("\n");
  return `[C2X]
STATE: PLAN
TASK_ID: ${sessionId}
ITERATION: 1

GOAL:
Sửa createTask

RATIONALE:
Packed excerpts show the defect.

ACTIONS:
1. Fix createTask persistence.

FILES_LIKELY_INVOLVED:
${listed}

TESTS:
- unit

SUCCESS_CRITERIA:
- tasks persist

RISKS:
- none

PACKETS:
  ## owner=codex role=general
  ACTIONS:
  1. Fix createTask persistence.
  FILES:
${listed}
  TESTS:
  - unit
  SUCCESS_CRITERIA:
  - persist
`;
}

describe("import [C2X] packet FILES", () => {
  it("strips absolute, parent, and sensitive packet paths", async () => {
    const session = await runPlan({
      goal: "Sửa createTask",
      plannerChoice: "mock",
      harnessTeam: ["codex"],
      budgetTokens: 2000,
      workspaceSource: "demo",
    });
    const next = await importPlan({
      sessionId: session.id,
      raw: planBlock(session.id, [
        "src/lib/tasks.ts",
        "/etc/passwd",
        "../.env",
        ".envrc",
        ".npmrc",
        "id_ecdsa",
        "src/../../.git-credentials",
      ]),
    });
    const files = next.plan?.packets.flatMap((packet) => packet.files) ?? [];
    expect(files).toEqual(["src/lib/tasks.ts"]);
    expect(files.join("\n")).not.toMatch(/\.\./);
    expect(files.join("\n")).not.toMatch(/^\//);
    expect(next.plan?.filesLikelyInvolved ?? []).toEqual(["src/lib/tasks.ts"]);
  });

  it("rejects an oversized imported control block", async () => {
    const session = await runPlan({
      goal: "Sửa createTask",
      plannerChoice: "mock",
      harnessTeam: ["codex"],
      budgetTokens: 2000,
      workspaceSource: "demo",
    });
    const dump = `[C2X]
STATE: PLAN
TASK_ID: ${session.id}
ITERATION: 1

GOAL:
${"dump ".repeat(3000)}
`;
    await expect(importPlan({ sessionId: session.id, raw: dump })).rejects.toThrow(/token/i);
    expect(CONTROL_BUDGET_MAX).toBe(2000);
  });

  it("drops unsafe FILES when parsing packets", () => {
    const packets = parseWorkPackets(`
## owner=codex role=general
ACTIONS:
1. stay local
FILES:
- src/lib/tasks.ts
- /etc/shadow
- ../secrets/id_rsa
- .netrc
TESTS:
- unit
SUCCESS_CRITERIA:
- ok
`);
    expect(packets[0]?.files).toEqual(["src/lib/tasks.ts"]);
  });
});
