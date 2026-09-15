import { existsSync, readFileSync } from "node:fs";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { upsertCodexMcpToml } from "@/core/codex-config";
import { runDrive } from "@/core/drive";
import { callCodexMcpTool, listCodexMcpTools } from "@/core/mcp-codex";
import { handleMcpStdioMessage } from "@/core/mcp-stdio";

let dataDir = "";
let workspaceRoot = "";
let prevData: string | undefined;
let prevWorkspace: string | undefined;

beforeEach(async () => {
  dataDir = await mkdtemp(path.join(os.tmpdir(), "c2x-mcp-data-"));
  workspaceRoot = await mkdtemp(path.join(os.tmpdir(), "c2x-mcp-ws-"));
  prevData = process.env.FRUGAL_DATA_DIR;
  prevWorkspace = process.env.C2X_WORKSPACE;
  process.env.FRUGAL_DATA_DIR = dataDir;
  process.env.C2X_WORKSPACE = workspaceRoot;
});

afterEach(async () => {
  if (prevData === undefined) {
    delete process.env.FRUGAL_DATA_DIR;
  } else {
    process.env.FRUGAL_DATA_DIR = prevData;
  }
  if (prevWorkspace === undefined) {
    delete process.env.C2X_WORKSPACE;
  } else {
    process.env.C2X_WORKSPACE = prevWorkspace;
  }
  await rm(dataDir, { recursive: true, force: true });
  await rm(workspaceRoot, { recursive: true, force: true });
});

function planBlock(sessionId: string): string {
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
- src/lib/tasks.ts

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
  - src/lib/tasks.ts
  TESTS:
  - unit
  SUCCESS_CRITERIA:
  - persist
`;
}

describe("callCodexMcpTool", () => {
  it("starts a mock plan and returns only the Codex brief to execute", async () => {
    const started = await callCodexMcpTool("c2x_start", {
      goal: "Sửa createTask",
      cwd: workspaceRoot,
      planner: "mock",
      workspace: "demo",
    });
    expect(started.ok).toBe(true);
    if (!started.ok) {
      return;
    }
    expect(started.state).toBe("PLAN");
    expect(started.action).toBe("execute");
    expect(started.brief).toMatch(/OWNER:\s*codex/);
    expect(started.brief).not.toMatch(/OWNER:\s*claude-code/);
    expect(started.prompt).toBeNull();
    expect(started.instruction).toMatch(/c2x_record/);
    expect(started.instruction).toMatch(/harness|brief/i);

    const leak = await callCodexMcpTool("c2x_brief", {
      session: started.session,
      owner: "claude-code",
    });
    expect(leak.ok).toBe(false);
  });

  it("keeps ChatGPT paste inside the Codex chat via c2x_submit", async () => {
    const started = await callCodexMcpTool("c2x_start", {
      goal: "Sửa createTask",
      cwd: workspaceRoot,
      planner: "chatgpt-web",
      workspace: "demo",
    });
    expect(started.ok).toBe(true);
    if (!started.ok) {
      return;
    }
    expect(started.state).toBe("INIT");
    expect(started.action).toBe("paste_plan");
    expect(started.prompt).toMatch(/\[C2X\]|GOAL|TASK/);
    expect(started.brief).toBeNull();
    expect(started.instruction).toMatch(/c2x_submit/);
    expect(started.instruction).not.toMatch(/inbox\.md/);

    const submitted = await callCodexMcpTool("c2x_submit", {
      session: started.session,
      raw: planBlock(started.session),
      cwd: workspaceRoot,
    });
    expect(submitted.ok).toBe(true);
    if (!submitted.ok) {
      return;
    }
    expect(submitted.state).toBe("PLAN");
    expect(submitted.action).toBe("execute");
    expect(submitted.brief).toMatch(/OWNER:\s*codex/);

    const recorded = await callCodexMcpTool("c2x_record", {
      session: started.session,
      owner: "codex",
      cwd: workspaceRoot,
    });
    expect(recorded.ok).toBe(true);
    if (!recorded.ok) {
      return;
    }
    expect(recorded.state).toBe("REVIEW");
    expect(recorded.action).toBe("paste_review");
    expect(recorded.prompt).toMatch(/DONE|PLAN|BLOCKED/);

    const done = await callCodexMcpTool("c2x_submit", {
      session: started.session,
      raw: `[C2X]
STATE: DONE
TASK_ID: ${started.session}
ITERATION: 1

SUMMARY:
Looks good.
`,
    });
    expect(done.ok).toBe(true);
    if (!done.ok) {
      return;
    }
    expect(done.state).toBe("DONE");
    expect(done.action).toBe("done");
  });
});

describe("Codex MCP stdio", () => {
  it("lists tools and answers initialize without starting HTTP", async () => {
    const names = listCodexMcpTools().map((tool) => tool.name);
    expect(names).toEqual([
      "c2x_start",
      "c2x_submit",
      "c2x_brief",
      "c2x_record",
      "c2x_status",
    ]);
    const init = await handleMcpStdioMessage({
      jsonrpc: "2.0",
      id: 1,
      method: "initialize",
      params: { protocolVersion: "2024-11-05", capabilities: {}, clientInfo: { name: "codex" } },
    });
    expect(init).toMatchObject({
      jsonrpc: "2.0",
      id: 1,
      result: {
        protocolVersion: "2024-11-05",
        serverInfo: { name: "chat-to-x" },
      },
    });
    const listed = await handleMcpStdioMessage({ jsonrpc: "2.0", id: 2, method: "tools/list" });
    expect(listed).toEqual(
      expect.objectContaining({
        jsonrpc: "2.0",
        id: 2,
        result: { tools: listCodexMcpTools() },
      }),
    );
    const note = await handleMcpStdioMessage({
      jsonrpc: "2.0",
      method: "notifications/initialized",
    });
    expect(note).toBeNull();
  });
});

describe("upsertCodexMcpToml", () => {
  it("adds mcp_servers.chat-to-x without wiping other servers", () => {
    const next = upsertCodexMcpToml(
      `[mcp_servers.other]
command = "echo"
`,
      "npx",
      ["--prefix", "/repo", "chat-to-x", "mcp"],
    );
    expect(next).toMatch(/\[mcp_servers\.other\]/);
    expect(next).toMatch(/\[mcp_servers\.chat-to-x\]/);
    expect(next).toMatch(/command = "npx"/);
    expect(next).toContain("chat-to-x");
    expect(next).not.toMatch(/npx c2x/);
    const again = upsertCodexMcpToml(next, "npx", ["--prefix", "/repo2", "chat-to-x", "mcp"]);
    expect(again.match(/\[mcp_servers\.chat-to-x\]/g)).toHaveLength(1);
    expect(again).toContain("/repo2");
    expect(again).not.toContain("/repo\"");
  });
});

describe("drive --no-spawn from inside Codex", () => {
  it("returns PLAN instead of throwing so Codex can execute the brief", async () => {
    const result = await runDrive({
      goal: "Sửa createTask",
      plannerChoice: "mock",
      harnessTeam: ["codex"],
      workspaceSource: "demo",
      cwd: workspaceRoot,
      spawn: false,
    });
    expect(result.session.state).toBe("PLAN");
    expect(result.spawns).toHaveLength(0);
    expect(await readFile(path.join(workspaceRoot, ".c2x", "briefs", "codex.md"), "utf8")).toMatch(
      /OWNER:\s*codex/,
    );
  });
});

describe("Codex plugin docs", () => {
  it("teaches init to install the stdio MCP and stay inside Codex", () => {
    const skill = readFileSync(path.join(process.cwd(), "skill", "SKILL.md"), "utf8");
    expect(skill).toMatch(/c2x_start/);
    expect(skill).toMatch(/c2x_submit/);
    expect(skill).toMatch(/You \*\*are\*\* the harness|you are the harness/i);
    expect(skill).not.toMatch(/inbox\.md/);
    const readme = readFileSync(path.join(process.cwd(), "README.md"), "utf8");
    expect(readme).toMatch(/mcp_servers\.chat-to-x|plugin Codex|MCP Codex/i);
    expect(readme).toMatch(/Không[\s\S]*npx c2x/);
    const cli = readFileSync(path.join(process.cwd(), "src/cli/c2x.ts"), "utf8");
    expect(cli).toMatch(/--stdio|stdio/);
    expect(cli).toMatch(/\.command\("mcp"\)[\s\S]*?\.option\("--session/);
    expect(cli).not.toMatch(/\.command\("mcp"\)[\s\S]*?requiredOption\("--session/);
    expect(existsSync(path.join(process.cwd(), "src/app/api/drive/route.ts"))).toBe(false);
    const security = readFileSync(path.join(process.cwd(), "SECURITY.md"), "utf8");
    expect(security).toMatch(/127\.0\.0\.1/);
    expect(security).toMatch(/stdio/i);
    expect(security).toMatch(/tunnel/i);
  });
});
