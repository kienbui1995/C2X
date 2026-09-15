import readline from "node:readline";
import { callCodexMcpTool, listCodexMcpTools, parseCodexMcpToolName } from "@/core/mcp-codex";

export const MCP_PROTOCOL_VERSION = "2024-11-05";

type JsonRpcId = string | number | null;

type JsonRpcRequest = {
  jsonrpc?: string;
  id?: JsonRpcId;
  method?: string;
  params?: unknown;
};

export type JsonRpcResponse = {
  jsonrpc: "2.0";
  id: JsonRpcId;
  result?: unknown;
  error?: { code: number; message: string };
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function response(id: JsonRpcId, result: unknown): JsonRpcResponse {
  return { jsonrpc: "2.0", id, result };
}

function failure(id: JsonRpcId, code: number, message: string): JsonRpcResponse {
  return { jsonrpc: "2.0", id, error: { code, message } };
}

export async function handleMcpStdioMessage(message: unknown): Promise<JsonRpcResponse | null> {
  if (!isRecord(message)) {
    return failure(null, -32600, "invalid request");
  }
  const request = message as JsonRpcRequest;
  const id = request.id ?? null;
  const method = request.method;
  if (!method) {
    return failure(id, -32600, "method is required");
  }
  if (id === null && method.startsWith("notifications/")) {
    return null;
  }
  switch (method) {
    case "initialize":
      return response(id, {
        protocolVersion: MCP_PROTOCOL_VERSION,
        capabilities: { tools: {} },
        serverInfo: { name: "chat-to-x", version: "0.1.0" },
      });
    case "notifications/initialized":
      return null;
    case "ping":
      return response(id, {});
    case "tools/list":
      return response(id, { tools: listCodexMcpTools() });
    case "tools/call":
      return callTool(id, request.params);
    default:
      return failure(id, -32601, `Unknown method: ${method}`);
  }
}

async function callTool(id: JsonRpcId, params: unknown): Promise<JsonRpcResponse> {
  if (!isRecord(params) || typeof params.name !== "string") {
    return failure(id, -32602, "tool name is required");
  }
  const name = parseCodexMcpToolName(params.name);
  if (!name) {
    return failure(id, -32602, `unknown tool: ${params.name}`);
  }
  const args = isRecord(params.arguments) ? params.arguments : {};
  const result = await callCodexMcpTool(name, args);
  return response(id, {
    content: [{ type: "text", text: JSON.stringify(result) }],
    isError: result.ok === false,
  });
}

export async function runMcpStdio(): Promise<void> {
  const rl = readline.createInterface({ input: process.stdin, crlfDelay: Infinity });
  for await (const line of rl) {
    const trimmed = line.trim();
    if (!trimmed) {
      continue;
    }
    let parsed: unknown;
    try {
      parsed = JSON.parse(trimmed) as unknown;
    } catch {
      process.stdout.write(
        `${JSON.stringify({ jsonrpc: "2.0", id: null, error: { code: -32700, message: "parse error" } })}\n`,
      );
      continue;
    }
    const reply = await handleMcpStdioMessage(parsed);
    if (reply) {
      process.stdout.write(`${JSON.stringify(reply)}\n`);
    }
  }
}
