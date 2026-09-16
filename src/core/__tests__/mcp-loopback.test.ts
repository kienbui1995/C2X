import { readFileSync } from "node:fs";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { planToBriefs, renderCodexBrief } from "@/core/brief";
import { DEMO_FILES } from "@/core/fixtures/demo-workspace";
import {
  MCP_LOOPBACK_HOST,
  MCP_LOOPBACK_PORT,
  MCP_MAX_BODY_BYTES,
  assertLoopbackBind,
  createMcpLoopbackServer,
  handleMcpTool,
} from "@/core/mcp-loopback";
import { packWorkspace } from "@/core/packer";
import { mockPlanFromPack } from "@/core/planner";
import { createSession } from "@/core/session";
import type { SessionRecord } from "@/core/types";

function sessionTwo(): SessionRecord {
  const pack = packWorkspace({
    goal: "Sửa createTask",
    files: DEMO_FILES,
    budgetTokens: 2000,
  });
  const created = createSession({
    goal: pack.goal,
    planner: "mock",
    plannerChoice: "mock",
    harnessTeam: ["codex", "claude-code"],
    budgetTokens: 2000,
    workspaceSource: "demo",
  });
  const plan = mockPlanFromPack(pack, created.id, ["codex", "claude-code"]);
  const briefs = planToBriefs(plan);
  return { ...created, plan, briefs, brief: briefs[0] ?? null, pack };
}

describe("mcp loopback handlers", () => {
  it("rejects non-loopback binds and hides teammate briefs", () => {
    expect(MCP_LOOPBACK_HOST).toBe("127.0.0.1");
    expect(MCP_LOOPBACK_PORT).toBe(45218);
    expect(() => assertLoopbackBind("127.0.0.1")).not.toThrow();
    expect(() => assertLoopbackBind("0.0.0.0")).toThrow(/127\.0\.0\.1/);
    expect(() => assertLoopbackBind("localhost")).toThrow(/127\.0\.0\.1/);
    const session = sessionTwo();
    const brief = handleMcpTool({ name: "c2x_get_brief", owner: "codex", session });
    expect(brief.ok).toBe(true);
    if (brief.ok) {
      expect(brief.text).toBe(renderCodexBrief(session.briefs[0]!));
      expect(brief.text).not.toMatch(/OWNER:\s*claude-code/);
    }
    const leak = handleMcpTool({ name: "c2x_get_brief", owner: "kiro-cli", session });
    expect(leak.ok).toBe(false);
    const meta = handleMcpTool({ name: "c2x_get_session", session });
    expect(meta.ok).toBe(true);
    if (meta.ok) {
      expect(meta.text).toContain(session.id);
      expect(meta.text).not.toContain("export function");
      expect(meta.text).not.toContain("@@");
    }
  });
});

describe("mcp loopback HTTP", () => {
  const servers: Array<ReturnType<typeof createMcpLoopbackServer>> = [];

  afterEach(async () => {
    await Promise.all(
      servers.splice(0).map(
        (server) =>
          new Promise<void>((resolve, reject) => {
            server.close((error) => (error ? reject(error) : resolve()));
          }),
      ),
    );
  });

  it("serves read-only tools on 127.0.0.1 only", async () => {
    const session = sessionTwo();
    const server = createMcpLoopbackServer({
      getSession: async (id) => (id === session.id ? session : null),
    });
    servers.push(server);
    const address = await new Promise<{ port: number }>((resolve, reject) => {
      server.once("error", reject);
      server.listen(0, MCP_LOOPBACK_HOST, () => {
        const info = server.address();
        if (!info || typeof info === "string") {
          reject(new Error("expected a TCP address"));
          return;
        }
        resolve({ port: info.port });
      });
    });

    const missing = await fetch(`http://127.0.0.1:${address.port}/`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "c2x_get_session" }),
    });
    expect(missing.status).toBe(400);

    const briefRes = await fetch(`http://127.0.0.1:${address.port}/`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: "c2x_get_brief",
        owner: "codex",
        session: session.id,
      }),
    });
    expect(briefRes.ok).toBe(true);
    const briefJson = (await briefRes.json()) as { ok: boolean; text?: string };
    expect(briefJson.ok).toBe(true);
    expect(briefJson.text).toBe(renderCodexBrief(session.briefs[0]!));
    expect(briefJson.text).not.toMatch(/OWNER:\s*claude-code/);
  });

  it("pins HTTP getSession to the --session id", async () => {
    const pinned = sessionTwo();
    const other = { ...sessionTwo(), id: "c2x_other_session" };
    const server = createMcpLoopbackServer({
      pinnedSessionId: pinned.id,
      getSession: async (id) => (id === pinned.id ? pinned : id === other.id ? other : null),
    });
    servers.push(server);
    const address = await new Promise<{ port: number }>((resolve, reject) => {
      server.once("error", reject);
      server.listen(0, MCP_LOOPBACK_HOST, () => {
        const info = server.address();
        if (!info || typeof info === "string") {
          reject(new Error("expected a TCP address"));
          return;
        }
        resolve({ port: info.port });
      });
    });

    const leak = await fetch(`http://127.0.0.1:${address.port}/`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "c2x_get_session", session: other.id }),
    });
    expect(leak.status).toBe(400);
    const leakJson = (await leak.json()) as { ok?: boolean; text?: string; error?: string };
    expect(leakJson.text ?? "").not.toContain(other.id);
    expect(leakJson.ok).toBe(false);
  });

  it("rejects HTTP bodies larger than ~1MB", async () => {
    expect(MCP_MAX_BODY_BYTES).toBe(1_048_576);
    const session = sessionTwo();
    const server = createMcpLoopbackServer({
      pinnedSessionId: session.id,
      getSession: async (id) => (id === session.id ? session : null),
    });
    servers.push(server);
    const address = await new Promise<{ port: number }>((resolve, reject) => {
      server.once("error", reject);
      server.listen(0, MCP_LOOPBACK_HOST, () => {
        const info = server.address();
        if (!info || typeof info === "string") {
          reject(new Error("expected a TCP address"));
          return;
        }
        resolve({ port: info.port });
      });
    });
    const huge = "x".repeat(MCP_MAX_BODY_BYTES + 64);
    const res = await fetch(`http://127.0.0.1:${address.port}/`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: "c2x_get_session",
        session: session.id,
        pad: huge,
      }),
    });
    expect(res.status).toBe(413);
  });
});

describe("mcp loopback docs", () => {
  it("warns that MCP stays loopback-only", () => {
    const security = readFileSync(path.join(process.cwd(), "SECURITY.md"), "utf8");
    expect(security).toMatch(/127\.0\.0\.1/);
    expect(security).toMatch(/tunnel/i);
  });
});
