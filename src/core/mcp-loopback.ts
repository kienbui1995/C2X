import { createServer, type IncomingMessage, type Server, type ServerResponse } from "node:http";
import { renderCodexBrief } from "@/core/brief";
import { assertNever, isHarnessId, type SessionRecord } from "@/core/types";

export const MCP_LOOPBACK_HOST = "127.0.0.1";
export const MCP_LOOPBACK_PORT = 45218;
export const MCP_MAX_BODY_BYTES = 1_048_576;

export type McpToolName = "c2x_get_brief" | "c2x_get_session";

export function assertLoopbackBind(host: string): void {
  if (host !== MCP_LOOPBACK_HOST) {
    throw new Error(`MCP must bind ${MCP_LOOPBACK_HOST} (got ${host}).`);
  }
}

function isMcpToolName(value: string): value is McpToolName {
  return value === "c2x_get_brief" || value === "c2x_get_session";
}

function briefForOwner(session: SessionRecord, owner: string) {
  if (!isHarnessId(owner) || !session.harnessTeam.includes(owner)) {
    return null;
  }
  return session.briefs.find((brief) => brief.owner === owner) ?? null;
}

export function handleMcpTool(input: {
  name: McpToolName;
  owner?: string;
  session: SessionRecord;
}): { ok: true; text: string } | { ok: false; error: string } {
  switch (input.name) {
    case "c2x_get_brief": {
      if (!input.owner) {
        return { ok: false, error: "owner is required" };
      }
      const brief = briefForOwner(input.session, input.owner);
      if (!brief) {
        return { ok: false, error: `no brief for ${input.owner}` };
      }
      return { ok: true, text: renderCodexBrief(brief) };
    }
    case "c2x_get_session":
      return {
        ok: true,
        text: JSON.stringify({
          id: input.session.id,
          state: input.session.state,
          planner: input.session.planner,
          harnessTeam: input.session.harnessTeam,
          goal: input.session.goal,
        }),
      };
    default:
      return assertNever(input.name, `Unknown MCP tool: ${input.name}`);
  }
}

function readBody(
  request: IncomingMessage,
  limit = MCP_MAX_BODY_BYTES,
): Promise<string> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    let size = 0;
    let settled = false;
    const finish = (fn: () => void) => {
      if (settled) {
        return;
      }
      settled = true;
      fn();
    };
    request.on("data", (chunk: Buffer) => {
      size += chunk.length;
      if (size > limit) {
        finish(() => {
          reject(new Error("payload too large"));
        });
        return;
      }
      chunks.push(chunk);
    });
    request.on("end", () => {
      finish(() => {
        resolve(Buffer.concat(chunks).toString("utf8"));
      });
    });
    request.on("error", (error) => {
      finish(() => {
        reject(error);
      });
    });
  });
}

function sendJson(response: ServerResponse, status: number, body: unknown): void {
  response.writeHead(status, { "Content-Type": "application/json" });
  response.end(`${JSON.stringify(body)}\n`);
}

export function createMcpLoopbackServer(input: {
  getSession: (id: string) => Promise<SessionRecord | null>;
  pinnedSessionId?: string;
}): Server {
  return createServer((request, response) => {
    void (async () => {
      if (request.method !== "POST") {
        sendJson(response, 405, { ok: false, error: "POST only" });
        return;
      }
      let payload: { name?: string; owner?: string; session?: string };
      try {
        payload = JSON.parse(await readBody(request)) as {
          name?: string;
          owner?: string;
          session?: string;
        };
      } catch (error) {
        if (error instanceof Error && error.message === "payload too large") {
          sendJson(response, 413, { ok: false, error: "payload too large" });
          return;
        }
        sendJson(response, 400, { ok: false, error: "invalid JSON" });
        return;
      }
      if (input.pinnedSessionId && payload.session && payload.session !== input.pinnedSessionId) {
        sendJson(response, 400, { ok: false, error: "session not found" });
        return;
      }
      const sessionId = input.pinnedSessionId ?? payload.session;
      if (!sessionId) {
        sendJson(response, 400, { ok: false, error: "session is required" });
        return;
      }
      if (!payload.name || !isMcpToolName(payload.name)) {
        sendJson(response, 400, { ok: false, error: "unknown tool" });
        return;
      }
      const session = await input.getSession(sessionId);
      if (!session) {
        sendJson(response, 400, { ok: false, error: "session not found" });
        return;
      }
      const result = handleMcpTool({
        name: payload.name,
        owner: payload.owner,
        session,
      });
      sendJson(response, result.ok ? 200 : 400, result);
    })().catch((error: unknown) => {
      const message = error instanceof Error ? error.message : "mcp failed";
      sendJson(response, 500, { ok: false, error: message });
    });
  });
}
