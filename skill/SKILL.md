---
name: chat-to-x
description: Use chat-to-x (C2X) MCP from Codex CLI. ChatGPT/Claude/Gemini web plans and reviews; this Codex session only executes the Codex brief. Trigger on C2X, chat-to-x, ChatGPT nghĩ Codex chạy, or a goal that should not burn Codex quota on planning.
---

# chat-to-x

The checkout lives at: replace-with-absolute-path

Install with `c2x init --harness codex` or `c2x skill-install` (writes
`~/.codex/skills/chat-to-x/SKILL.md` and `[mcp_servers.chat-to-x]` in
`~/.codex/config.toml`). Claude Code: copy the same file to
`~/.claude/skills/chat-to-x/` — C2X does not auto-install there.

## When the user opens Codex CLI

You **are** the harness. Do not start another `codex` process. Do not open a
second terminal. Use the **chat-to-x MCP tools** (`c2x_start`, `c2x_submit`,
`c2x_brief`, `c2x_record`, `c2x_status`).

1. Call `c2x_start` with the user goal and this project `cwd`.
2. If the tool returns `paste_plan` / `paste_review`, show `prompt` to the user.
   They paste it into ChatGPT (or Claude/Gemini web), then paste the `[C2X]`
   block **back into this Codex chat**. Call `c2x_submit` with that block.
   Stay in this chat — do not send them to another app file.
3. When `.c2x/briefs/<your-harness-id>.md` exists (Codex = `codex.md`) or the
   tool returns `brief`, read **only** that file / brief. Execute it.
   Do not read other files in `.c2x/briefs/`. Do not plan or review.
4. Call `c2x_record`. Repeat paste/submit if a review prompt appears.

If MCP tools are missing, fallback:

```bash
c2x "<mục tiêu của user>" --no-spawn
```

Never `npx c2x`.

## Rules

1. Codex does not plan or review. Only execute the `OWNER: codex` packet.
2. Prefer `chatgpt-web` / `claude-web` / `gemini-web` for thinking.
3. Never paste file bodies, diffs, or logs into the planner chat.
4. Control messages stay small and start with `[C2X]` (legacy `[C2C]` ok).
5. After EXECUTED, review stays on the web chat. Do not review here.
6. Do not show another harness's brief to this session.
7. If the drop is missing, `c2x brief --session … --owner codex --drop`.

## Loop

```text
INIT → PLAN (packets) → EXECUTING (per harness) → EXECUTED (merge) → REVIEW → PLAN | DONE | BLOCKED
```

## Commands

```bash
c2x init --harness codex
c2x_start / c2x_submit / c2x_record
c2x "<mục tiêu>" --no-spawn
c2x skill-install
```

`.c2x/briefs/` — Do not read other harness drops. Do not plan or review.

Claude Code (`claude-code`) and other harnesses: same rule — read only
`.c2x/briefs/<your-harness-id>.md`. Do not read other files. Do not plan or review.
