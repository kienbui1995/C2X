import { describe, expect, it } from "vitest";
import { planToBrief, planToBriefs, renderCodexBrief } from "@/core/brief";
import { DEMO_FILES } from "@/core/fixtures/demo-workspace";
import { packWorkspace } from "@/core/packer";
import { mockPlanFromPack } from "@/core/planner";
import { canTransition, messageToPlan, parseControlMessage, planToMessage } from "@/core/protocol";
import { getHarness, HARNESS_BY_ID, HARNESS_CATALOG } from "@/core/providers/catalog";
import { routeExecuteTeam, routeRole } from "@/core/providers/router";
import { mergeConfig } from "@/core/config";
import { completeHarnessRun, createSession, mergedExecutionReport } from "@/core/session";
import { packetOverlapWarning, splitWorkPackets } from "@/core/packets";
import {
  HARNESS_IDS,
  PROVIDER_IDS,
  ROLES,
  toggleHarnessInTeam,
  type HarnessId,
  type PlannerChoice,
} from "@/core/types";

const FOUR_TEAM: HarnessId[] = ["codex", "claude-code", "grok-build", "opencode"];
const ALL_HARNESSES: HarnessId[] = [...FOUR_TEAM, "kiro-cli"];

const DEMO_GOAL =
  "Sửa createTask để việc mới thật sự được lưu, giữ bộ lọc status trên URL khi reload, và thêm test cho empty state.";

function packedDemo() {
  return packWorkspace({
    goal: DEMO_GOAL,
    files: DEMO_FILES,
    budgetTokens: 4000,
  });
}

describe("splitWorkPackets", () => {
  it("splits a 2-harness team into packets with disjoint file ownership", () => {
    const pack = packedDemo();
    const files = pack.excerpts.map((excerpt) => excerpt.path);
    const packets = splitWorkPackets({
      team: ["codex", "claude-code"],
      files,
      goal: pack.goal,
      taskId: "c2x_team",
    });

    expect(packets).toHaveLength(2);
    expect(packets.map((packet) => packet.owner)).toEqual(["codex", "claude-code"]);
    expect(packets.every((packet) => packet.actions.length > 0)).toBe(true);
    expect(packets.every((packet) => packet.successCriteria.length > 0)).toBe(true);

    const owned = packets.flatMap((packet) => packet.files);
    expect(owned.length).toBeGreaterThan(1);
    expect(new Set(owned).size).toBe(owned.length);

    const implement = packets[0];
    const tester = packets[1];
    expect(implement.files.some((path) => path.includes("tasks.ts"))).toBe(true);
    expect(tester.files.some((path) => /test/i.test(path))).toBe(true);
    expect(implement.files.some((path) => /test/i.test(path))).toBe(false);
  });

  it("keeps a single-harness team as one packet that owns every planned file", () => {
    const pack = packedDemo();
    const files = pack.excerpts.map((excerpt) => excerpt.path);
    const packets = splitWorkPackets({
      team: ["codex"],
      files,
      goal: pack.goal,
      taskId: "c2x_one",
    });

    expect(packets).toHaveLength(1);
    expect(packets[0]?.owner).toBe("codex");
    expect(packets[0]?.files).toEqual(files);
    expect(packets[0]?.actions.length).toBeGreaterThan(0);
  });

  it("does not mention createTask when the goal is unrelated", () => {
    const packets = splitWorkPackets({
      team: ["codex"],
      files: ["src/theme.ts"],
      goal: "Add a dark mode toggle",
      taskId: "c2x_dark",
    });
    expect(packets[0]?.actions.join(" ")).not.toMatch(/createTask/i);
    expect(packets[0]?.actions.join(" ")).toMatch(/dark mode/i);
  });

  it("builds generic packets from a non-demo workspace shape", () => {
    const files = ["src/theme.ts", "src/theme.test.ts", "src/tokens.css"];
    const packets = splitWorkPackets({
      team: ["opencode", "kiro-cli"],
      files,
      goal: "Add a dark mode toggle",
      taskId: "c2x_theme",
    });
    const joined = packets.flatMap((packet) => [
      ...packet.actions,
      ...packet.tests,
      ...packet.successCriteria,
    ]).join(" ");
    expect(joined).not.toMatch(/createTask/i);
    expect(joined).not.toMatch(/persist in the shared store/i);
    expect(joined).toMatch(/dark mode/i);
    expect(packets.map((packet) => packet.owner)).toEqual(["opencode", "kiro-cli"]);
    expect(packets[0]?.files).toEqual(["src/theme.ts", "src/tokens.css"]);
    expect(packets[1]?.files).toEqual(["src/theme.test.ts"]);
  });
});

describe("packetOverlapWarning", () => {
  it("returns null for disjoint packets and a warning when files overlap", () => {
    const disjoint = splitWorkPackets({
      team: ["codex", "claude-code"],
      files: ["src/theme.ts", "src/theme.test.ts"],
      goal: "Add a dark mode toggle",
      taskId: "c2x_ok",
    });
    expect(packetOverlapWarning(disjoint)).toBeNull();

    const overlapping = [
      { ...disjoint[0]!, files: ["src/theme.ts"] },
      { ...disjoint[1]!, files: ["src/theme.ts"] },
    ];
    const warning = packetOverlapWarning(overlapping);
    expect(warning).toMatch(/overlap|chồng/i);
  });
});

describe("splitWorkPackets team sizes", () => {
  it("splits a 4-harness team into one packet each with disjoint files", () => {
    const pack = packedDemo();
    const files = pack.excerpts.map((excerpt) => excerpt.path);
    const packets = splitWorkPackets({
      team: FOUR_TEAM,
      files,
      goal: pack.goal,
      taskId: "c2x_four",
    });

    expect(packets).toHaveLength(4);
    expect(packets.map((packet) => packet.owner)).toEqual(FOUR_TEAM);
    expect(packets.every((packet) => packet.actions.length > 0)).toBe(true);
    expect(packets.every((packet) => packet.successCriteria.length > 0)).toBe(true);
    const owned = packets.flatMap((packet) => packet.files);
    expect(new Set(owned).size).toBe(owned.length);
    expect(owned.some((path) => path.includes("tasks.ts"))).toBe(true);
    expect(owned.some((path) => /test/i.test(path))).toBe(true);
    expect(packets[0]?.files.some((path) => /test/i.test(path))).toBe(false);
    expect(packets[3]?.files.some((path) => /test/i.test(path))).toBe(true);
  });
});

describe("harness catalog", () => {
  it("lists five first-class execution harnesses including kiro-cli", () => {
    expect(HARNESS_IDS).toEqual(ALL_HARNESSES);
    expect(HARNESS_CATALOG.map((entry) => entry.id)).toEqual(ALL_HARNESSES);
    for (const id of HARNESS_IDS) {
      const entry = getHarness(id);
      expect(entry).toBe(HARNESS_BY_ID[id]);
      expect(entry.id).toBe(id);
      expect(entry.binaries.length).toBeGreaterThan(0);
      expect(entry.blurb.length).toBeGreaterThan(12);
      expect(entry.blurbVi.length).toBeGreaterThan(12);
      expect(entry.quotaEn.length).toBeGreaterThan(0);
      expect(entry.quotaVi.length).toBeGreaterThan(0);
    }
    const kiro = getHarness("kiro-cli");
    expect(kiro.name).toBe("Kiro CLI");
    expect(kiro.blurbVi).toMatch(/Kiro CLI — harness thực thi/);
    expect(kiro.blurb).toMatch(/Kiro CLI — execution harness/i);
  });

  it("lets the user add or drop any harness while keeping at least one", () => {
    expect(toggleHarnessInTeam(["codex"], "claude-code")).toEqual(["codex", "claude-code"]);
    expect(toggleHarnessInTeam(["codex"], "codex")).toEqual(["codex"]);
    expect(toggleHarnessInTeam(FOUR_TEAM, "grok-build")).toEqual([
      "codex",
      "claude-code",
      "opencode",
    ]);
    expect(toggleHarnessInTeam(["opencode"], "grok-build")).toEqual(["grok-build", "opencode"]);
    expect(toggleHarnessInTeam(["codex"], "kiro-cli")).toEqual(["codex", "kiro-cli"]);
    expect(toggleHarnessInTeam(ALL_HARNESSES, "kiro-cli")).toEqual(FOUR_TEAM);
  });
});

describe("mockPlanFromPack", () => {
  it("produces a real two-harness split from the packed demo workspace", () => {
    const plan = mockPlanFromPack(packedDemo(), "c2x_mock");
    expect(plan.packets).toHaveLength(2);
    expect(plan.packets[0]?.owner).toBe("codex");
    expect(plan.packets[1]?.owner).toBe("claude-code");
    const owned = plan.packets.flatMap((packet) => packet.files);
    expect(new Set(owned).size).toBe(owned.length);
    expect(owned.some((path) => path.includes("tasks.ts"))).toBe(true);
    expect(owned.some((path) => /test/i.test(path))).toBe(true);
  });

  it("still plans for a single-harness team", () => {
    const plan = mockPlanFromPack(packedDemo(), "c2x_solo", ["claude-code"]);
    expect(plan.packets).toHaveLength(1);
    expect(plan.packets[0]?.owner).toBe("claude-code");
  });

  it("emits a kiro-cli packet when that harness is selected alone", () => {
    const plan = mockPlanFromPack(packedDemo(), "c2x_kiro", ["kiro-cli"]);
    expect(plan.packets).toHaveLength(1);
    expect(plan.packets[0]?.owner).toBe("kiro-cli");
    expect(plan.packets[0]?.files.length).toBeGreaterThan(0);
    expect(planToBriefs(plan).map((brief) => brief.owner)).toEqual(["kiro-cli"]);
  });

  it("emits a kiro-cli packet when it is combined with other harnesses", () => {
    const plan = mockPlanFromPack(packedDemo(), "c2x_kiro_mix", ["codex", "kiro-cli"]);
    expect(plan.packets.map((packet) => packet.owner)).toEqual(["codex", "kiro-cli"]);
    expect(plan.packets.every((packet) => packet.files.length > 0 || plan.packets.length === 2)).toBe(
      true,
    );
    const owned = plan.packets.flatMap((packet) => packet.files);
    expect(new Set(owned).size).toBe(owned.length);
  });

  it("plans a 4-harness team without collapsing to one brief", () => {
    const plan = mockPlanFromPack(packedDemo(), "c2x_quad", FOUR_TEAM);
    expect(plan.packets).toHaveLength(4);
    expect(planToBriefs(plan).map((brief) => brief.owner)).toEqual(FOUR_TEAM);
  });

  it("plans a 5-harness team including kiro-cli", () => {
    const plan = mockPlanFromPack(packedDemo(), "c2x_five", ALL_HARNESSES);
    expect(plan.packets).toHaveLength(5);
    expect(planToBriefs(plan).map((brief) => brief.owner)).toEqual(ALL_HARNESSES);
    expect(plan.packets.some((packet) => packet.owner === "kiro-cli")).toBe(true);
  });
});

describe("planToBriefs", () => {
  it("gives each harness only its own packet", () => {
    const plan = mockPlanFromPack(packedDemo(), "c2x_briefs");
    const briefs = planToBriefs(plan);
    expect(briefs).toHaveLength(2);
    const codex = briefs.find((brief) => brief.owner === "codex");
    const claude = briefs.find((brief) => brief.owner === "claude-code");
    expect(codex).toBeDefined();
    expect(claude).toBeDefined();
    expect(codex?.files.some((path) => claude?.files.includes(path))).toBe(false);
    expect(renderCodexBrief(codex!)).toMatch(/OWNER:\s*codex/);
    expect(renderCodexBrief(claude!)).toMatch(/OWNER:\s*claude-code/);
  });
});

describe("protocol packets", () => {
  it("round-trips packets inside a PLAN message", () => {
    const plan = mockPlanFromPack(packedDemo(), "c2x_wire");
    const parsed = messageToPlan(parseControlMessage(planToMessage(plan)));
    expect(parsed.packets).toHaveLength(2);
    expect(parsed.packets[0]?.owner).toBe("codex");
    expect(parsed.packets[1]?.files).toEqual(plan.packets[1]?.files);
  });

  it("follows INIT → PLAN → EXECUTING → EXECUTED → REVIEW → DONE", () => {
    expect(canTransition("INIT", "PLAN")).toBe(true);
    expect(canTransition("PLAN", "EXECUTING")).toBe(true);
    expect(canTransition("EXECUTING", "EXECUTING")).toBe(true);
    expect(canTransition("EXECUTING", "EXECUTED")).toBe(true);
    expect(canTransition("EXECUTED", "REVIEW")).toBe(true);
    expect(canTransition("REVIEW", "DONE")).toBe(true);
    expect(canTransition("PLAN", "REVIEW")).toBe(false);
  });
});

describe("routeRole and routeExecuteTeam", () => {
  const config = mergeConfig({
    enabledProviders: ["mock", "chatgpt-web", "claude-web", "gemini-web", "groq"],
    defaultHarnessTeam: ["codex", "claude-code"],
  });

  it("never sends plan or review to any harness on the team", () => {
    const choices: PlannerChoice[] = ["auto", ...PROVIDER_IDS];
    for (const role of ROLES) {
      if (role === "execute") {
        continue;
      }
      for (const choice of choices) {
        const decision = routeRole({
          role,
          choice,
          harness: "claude-code",
          harnessTeam: ["codex", "claude-code"],
          config,
          hasKey: () => true,
        });
        expect(decision.provider).not.toBe("codex");
        expect(decision.provider).not.toBe("claude-code");
        expect(decision.provider).not.toBe("grok-build");
        expect(decision.provider).not.toBe("opencode");
        expect(decision.provider).not.toBe("kiro-cli");
      }
    }
  });

  it("never routes plan or review to any execution harness including kiro-cli", () => {
    for (const harness of ALL_HARNESSES) {
      for (const role of ["plan", "review"] as const) {
        const decision = routeRole({
          role,
          choice: "auto",
          harness,
          harnessTeam: ALL_HARNESSES,
          config,
          hasKey: () => true,
        });
        expect(ALL_HARNESSES).not.toContain(decision.provider);
      }
    }
  });

  it("routes execute to every team member, never to a planner", () => {
    const decisions = routeExecuteTeam(["codex", "claude-code"]);
    expect(decisions.map((item) => item.provider)).toEqual(["codex", "claude-code"]);
    expect(decisions.every((item) => item.role === "execute")).toBe(true);

    const four = routeExecuteTeam(FOUR_TEAM);
    expect(four.map((item) => item.provider)).toEqual(FOUR_TEAM);
    expect(four.every((item) => item.role === "execute")).toBe(true);

    const five = routeExecuteTeam(ALL_HARNESSES);
    expect(five.map((item) => item.provider)).toEqual(ALL_HARNESSES);
    expect(five.every((item) => item.role === "execute")).toBe(true);
  });
});

describe("completeHarnessRun", () => {
  it("stays EXECUTING until every teammate finishes, then EXECUTED with merged metadata", () => {
    const pack = packedDemo();
    const plan = mockPlanFromPack(pack, "c2x_run");
    const briefs = planToBriefs(plan);
    let session = createSession({
      goal: pack.goal,
      planner: "mock",
      plannerChoice: "mock",
      harnessTeam: ["codex", "claude-code"],
      budgetTokens: 4000,
      workspaceSource: "demo",
    });
    session = {
      ...session,
      state: "PLAN",
      pack,
      plan,
      briefs,
      brief: briefs[0] ?? null,
    };

    session = completeHarnessRun(session, "codex", {
      changedFiles: plan.packets[0]?.files ?? [],
      tests: "implementer: not run",
    });
    expect(session.state).toBe("EXECUTING");
    expect(session.harnessRuns.find((run) => run.owner === "codex")?.state).toBe("executed");
    expect(session.harnessRuns.find((run) => run.owner === "claude-code")?.state).toBe("pending");

    session = completeHarnessRun(session, "claude-code", {
      changedFiles: plan.packets[1]?.files ?? [],
      tests: "12 passed",
    });
    expect(session.state).toBe("EXECUTED");
    expect(session.harnessRuns.every((run) => run.state === "executed")).toBe(true);

    const merged = mergedExecutionReport(session);
    expect(merged.changedFiles).toEqual(
      expect.arrayContaining([...(plan.packets[0]?.files ?? []), ...(plan.packets[1]?.files ?? [])]),
    );
    expect(merged.tests).toContain("codex");
    expect(merged.tests).toContain("claude-code");
  });
});

describe("planToBrief regression", () => {
  it("still builds a combined brief smaller than the packed workspace", () => {
    const pack = packedDemo();
    const brief = planToBrief(mockPlanFromPack(pack, "c2x_combo"));
    expect(brief.tokenEstimate).toBeLessThan(pack.packedTokens);
    expect(brief.actions.length).toBeGreaterThan(0);
  });
});
