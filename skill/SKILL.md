---
name: chat-to-x
description: Use chat-to-x (C2X) from Codex CLI. ChatGPT/Claude/Gemini web plans and reviews; this Codex session only executes `.c2x/briefs/codex.md`. Trigger on C2X, chat-to-x, ChatGPT nghĩ Codex chạy, or a goal that should not burn Codex quota on planning.
---

# chat-to-x

The checkout lives at: replace-with-absolute-path

Install this skill with `c2x skill-install` (writes `~/.codex/skills/chat-to-x/SKILL.md`
and replaces the checkout path). Claude Code: copy the same file to
`~/.claude/skills/chat-to-x/` — C2X does not auto-install there.

## When the user opens Codex CLI

You **are** the harness. Do not start another `codex` process.

1. Run (from the project cwd):

```bash
c2x "<mục tiêu của user>" --no-spawn
```

If `c2x` is missing: `npx --prefix <checkout> chat-to-x "<mục tiêu>" --no-spawn`.
Never `npx c2x`.

2. If C2X prints an outbox path, tell the user: dán file đó vào ChatGPT, lưu
   khối `[C2X]` vào `.c2x/inbox.md`, rồi nói "đã dán". Chạy lại cùng lệnh
   `c2x --session <id> --no-spawn` (hoặc `c2x status` rồi resume).
3. When `.c2x/briefs/<your-harness-id>.md` exists (Codex = `codex.md`), read
   **only** that file. Execute it. Do not read other files in `.c2x/briefs/`.
   Do not plan or review.
4. Then: `c2x record --session <id> --owner codex`
5. If C2X writes `review-prompt.md`, user pastes ChatGPT again into
   `.c2x/inbox.md`. You do not write the DONE verdict.

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
c2x "<mục tiêu>" --no-spawn
c2x status
c2x record --session <id> --owner codex
c2x skill-install
```

`.c2x/briefs/` — Do not read other harness drops. Do not plan or review.

Claude Code (`claude-code`) and other harnesses: same rule — read only
`.c2x/briefs/<your-harness-id>.md`. Do not read other files. Do not plan or review.
