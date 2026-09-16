---
name: chat-to-x
description: Use chat-to-x (C2X) MCP from Codex CLI. The user writes a goal; you finish it here. Default planner is mock (no paste). Trigger on C2X, chat-to-x, tự làm hết, Dùng C2X, pipeline, pipeline đầy đủ, ChatGPT + Claude Code + Codex + Grok, brain-codex, brain-agy, pipeline-agy, Codex là bộ não, AGY là bộ não, AGY, or a coding goal that should not burn Codex quota on planning.
---

# chat-to-x

This is **not** an official OpenAI skill or plugin. Unofficial community project.

The checkout lives at: replace-with-absolute-path

Install with `c2x init --harness codex`, `c2x init --pipeline`,
`c2x init --brain-codex --harness agy`, `c2x init --brain-agy --harness codex`,
`c2x init --pipeline-agy`, or `c2x skill-install` (writes
`$HOME/.agents/skills/chat-to-x/SKILL.md`, `~/.codex/skills/chat-to-x/SKILL.md`
for older Codex, `~/.claude/skills/chat-to-x/SKILL.md`,
`~/.gemini/antigravity-cli/skills/chat-to-x/SKILL.md` if that AGY CLI home
exists on this machine, the C2X block in `~/.codex/AGENTS.md`, and
`[mcp_servers.chat-to-x]` in `~/.codex/config.toml`). No official AGY plugin.

| Vai | Ai |
| --- | --- |
| Brainstorm / nghiệp vụ / PLAN / REVIEW | ChatGPT web (dán) |
| UI | OpenDesign ngoài C2X → DESIGN.md |
| Code | Claude Code |
| Test + sửa bug (execute) | Codex |
| CI/CD | Grok Build |
| Codex = não (lệnh MCP) / AGY = chạy code | Optional: `--brain-codex --harness agy` |
| AGY = não / Codex = chạy code | Optional: `--brain-agy --harness codex` |
| Wiki | `docs/wiki` outbox, dán ADO/Jira |

**Codex does not review.** No official vendor plugin. No Jira OAuth.

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

Paste path — only if the user asked for ChatGPT / Claude / Gemini **web**
(“dán ChatGPT”):

1. `c2x_start` with `planner=chatgpt-web` (or `claude-web` / `gemini-web`).
2. Show `prompt`. User pastes the `[C2X]` block **back into this Codex chat**.
   Call `c2x_submit`. Then execute + `c2x_record` as above.

Brainstorm — nghiệp vụ before PLAN:

- `c2x brainstorm "…"` or `c2x_start` with `brainstorm=true` / `phase=brainstorm`.
- Mock synthesizes short notes then PLAN (still execute-only).
- ChatGPT web: first paste is Q&A; stored notes feed the next PLAN prompt.

Pipeline — “pipeline” / “ChatGPT + Claude Code + Codex + Grok” / `c2x init --pipeline`:

- `c2x_start` with `pipeline=true` (team Claude Code implement, Codex fix,
  Grok Build ci). You still execute **only** the Codex brief.
- UI: run OpenDesign (or any UI tool) **outside** C2X, drop `DESIGN.md` /
  HTML into the repo, then PLAN assigns implement to Claude Code.
- Wiki: C2X writes `docs/wiki` and `.c2x/outbox/wiki`. User pastes into
  Azure DevOps wiki / Jira. No Jira OAuth. Do not store provider tokens
  in the checkout.

Optional Codex-brain + AGY — “Codex là bộ não” / `c2x init --brain-codex --harness agy`
/ `c2x init --pipeline-agy` / `c2x_start` with `brain=codex` and/or `harness=agy`
/ `team=agy`:

- **You are the brain.** Do not write app code. AGY executes.
- Planner stays `mock` unless the user asked to paste a web chat.
- Do not spawn another `codex` process. Do not execute the implement brief.
- `.c2x/briefs/agy.md` is for AGY — you do not execute it.
- After AGY records, call `c2x_status`. You are not a catalog reviewer.

Optional AGY-brain + Codex — “AGY là bộ não” / `c2x init --brain-agy --harness codex`
/ `c2x_start` with `brain=agy` and `harness=codex`:

- AGY is the brain (plan + commands). Codex **is** the implementer.
- If you are Codex in this mode: you **are** the harness. Read **only**
  `.c2x/briefs/codex.md`. Execute it. Do not plan or review. Then `c2x_record`.
- If you are AGY in this mode: **You are the brain.** Do not write app code.
  Do not spawn Codex. Codex reads `.c2x/briefs/codex.md`.
- Planner stays `mock` unless the user asked to paste a web chat.
- Never put both `codex` and `agy` on the execute team.

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
c2x init --pipeline
c2x init --brain-codex --harness agy
c2x init --brain-agy --harness codex
c2x init --pipeline-agy
c2x brainstorm "nghiệp vụ…"
c2x_start / c2x_submit / c2x_record
c2x "<mục tiêu>" --planner mock --no-spawn
c2x skill-install
```

`.c2x/briefs/` — Do not read other harness drops. Do not plan or review.

Claude Code (`claude-code`) and other harnesses: same rule — read only
`.c2x/briefs/<your-harness-id>.md`. Do not read other files. Do not plan or review.
