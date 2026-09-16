import { describe, expect, it } from "vitest";
import {
  getHarness,
  getProvider,
  HARNESS_BY_ID,
  HARNESS_CATALOG,
  PROVIDER_BY_ID,
  PROVIDER_CATALOG,
} from "@/core/providers/catalog";
import { HARNESS_IDS, PROVIDER_IDS } from "@/core/types";
import { routeExecuteTeam, routeRole } from "@/core/providers/router";
import { mergeConfig } from "@/core/config";
import { assignPacketRoles, packetsHaveDisjointFiles, splitWorkPackets } from "@/core/packets";

describe("catalog registry", () => {
  it("covers every HarnessId and ProviderId without a second list", () => {
    expect(HARNESS_CATALOG.map((entry) => entry.id)).toEqual([...HARNESS_IDS]);
    expect(PROVIDER_CATALOG.map((entry) => entry.id)).toEqual([...PROVIDER_IDS]);
    for (const id of HARNESS_IDS) {
      expect(getHarness(id)).toBe(HARNESS_BY_ID[id]);
      expect(HARNESS_BY_ID[id].id).toBe(id);
      expect(HARNESS_BY_ID[id].binaries.length).toBeGreaterThan(0);
      expect(HARNESS_BY_ID[id].execArgs.length).toBeGreaterThan(0);
    }
    for (const id of PROVIDER_IDS) {
      expect(getProvider(id)).toBe(PROVIDER_BY_ID[id]);
      expect(PROVIDER_BY_ID[id].id).toBe(id);
    }
    expect(HARNESS_BY_ID["grok-build"].binaries).toEqual(["grok", "grok-build"]);
    expect(HARNESS_BY_ID["kiro-cli"].binaries).toEqual(["kiro"]);
  });

  it("routes execute from catalog names and never lists harnesses as planners", () => {
    const config = mergeConfig({
      enabledProviders: ["mock", "chatgpt-web"],
      defaultHarnessTeam: [...HARNESS_IDS],
    });
    for (const id of HARNESS_IDS) {
      const decision = routeRole({
        role: "execute",
        choice: "auto",
        harness: id,
        config,
        hasKey: () => false,
      });
      expect(decision.provider).toBe(id);
      expect(decision.reason).toContain(getHarness(id).name);
    }
    expect(routeExecuteTeam([...HARNESS_IDS]).map((item) => item.provider)).toEqual([
      ...HARNESS_IDS,
    ]);
    for (const role of ["plan", "review"] as const) {
      const decision = routeRole({
        role,
        choice: "auto",
        config,
        hasKey: () => false,
      });
      expect(HARNESS_IDS).not.toContain(decision.provider);
    }
  });

  it("splits packets by catalog packetRole, not by team position or named id switch", () => {
    const files = ["src/a.ts", "src/a.test.ts"];
    const packets = splitWorkPackets({
      team: ["opencode", "kiro-cli"],
      files,
      goal: "Add a dark mode toggle",
      taskId: "c2x_reg",
    });
    expect(packets.map((packet) => packet.owner)).toEqual(["opencode", "kiro-cli"]);
    expect(assignPacketRoles(["kiro-cli"])).toEqual([{ owner: "kiro-cli", role: "implement" }]);
    expect(packets.every((packet) => packet.role === "implement")).toBe(true);
    expect(packetsHaveDisjointFiles(packets)).toBe(true);
    expect(packets.flatMap((packet) => packet.files).sort()).toEqual(["src/a.test.ts", "src/a.ts"]);
    expect(packets[0]?.actions.join(" ")).not.toMatch(/createTask/i);
    expect(getHarness("codex").packetRole).toBe("fix");
    expect(getHarness("claude-code").packetRole).toBe("implement");
  });
});
