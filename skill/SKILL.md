---
name: chat-to-x
description: Use chat-to-x (C2X) MCP from Codex CLI. The user writes a goal; you finish it here. Default planner is mock (no paste). Trigger on C2X, chat-to-x, tự làm hết, Dùng C2X, or a coding goal that should not burn Codex quota on planning.
---

# chat-to-x

The checkout lives at: replace-with-absolute-path

Install with `c2x init --harness codex` or `c2x skill-install` (writes
`$HOME/.agents/skills/chat-to-x/SKILL.md`, `~/.codex/skills/chat-to-x/SKILL.md`
for older Codex, the C2X block in `~/.codex/AGENTS.md`, and
`[mcp_servers.chat-to-x]` in `~/.codex/config.toml`). Claude Code: copy the
same file to `~/.claude/skills/chat-to-x/` — C2X does not auto-install there.

## When the user opens Codex CLI

You **are** the harness. Do not start another `codex` process. Do not open a
second terminal. Use the **chat-to-x MCP tools** (`c2x_start`, `c2x_submit`,
`c2x_brief`, `c2x_record`, `c2x_status`).

Default path — user only writes a description (“tự làm hết”):

1. Call `c2x_start` with the user goal, this project `cwd`, and **no**
   `chatgpt-web` planner (omit `planner`, or `mock` / an API id).
2. When the tool returns `brief` or `.c2x/briefs/<your-harness-id>.md` exists
   (Codex = `codex.md`), read **only** that file / brief. Execute it.
   Do not read other files in `.c2x/briefs/`. Do not plan or review.
3. Call `c2x_record`. If `action` is `done`, stop and tell the user it is done.

Paste path — only if the user asked for ChatGPT / Claude / Gemini **web**:

1. `c2x_start` with `planner=chatgpt-web` (or `claude-web` / `gemini-web`).
2. Show `prompt`. User pastes the `[C2X]` block **back into this Codex chat**.
   Call `c2x_submit`. Then execute + `c2x_record` as above.

If MCP tools are missing, fallback:

```bash
c2x "<mục tiêu của user>" --planner mock --no-spawn
```

Never `npx c2x`.

## Rules

1. Codex does not plan or review. Only execute the `OWNER: codex` packet.
2. Default finishes inside Codex. Web paste is opt-in.
3. Never paste file bodies, diffs, or logs into the planner chat.
4. Control messages stay small and start with `[C2X]` (legacy `[C2C]` ok).
5. Do not show another harness's brief to this session.
6. If the drop is missing, `c2x brief --session … --owner codex --drop`.

## Loop

```text
INIT → PLAN (packets) → EXECUTING (per harness) → EXECUTED (merge) → REVIEW → PLAN | DONE | BLOCKED
```

## Commands

```bash
c2x init --harness codex
c2x_start / c2x_submit / c2x_record
c2x "<mục tiêu>" --planner mock --no-spawn
c2x skill-install
```

`.c2x/briefs/` — Do not read other harness drops. Do not plan or review.

Claude Code (`claude-code`) and other harnesses: same rule — read only
`.c2x/briefs/<your-harness-id>.md`. Do not read other files. Do not plan or review.
