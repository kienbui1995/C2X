---
name: frugal-codex
description: Use Frugal Codex (C2X) so ChatGPT/Claude/Gemini web chats plan and review, and Codex or Claude Code only executes a short brief.
---

# Frugal Codex

The checkout lives at: replace-with-absolute-path

## When to use

Any implementation, review, or debugging task where a single harness quota
(Codex *or* Claude Code) would otherwise be burned on planning. Spread thinking
across the large included chat allowances on ChatGPT web, Gemini web, and
Claude web.

## Rules

1. Codex and Claude Code do not plan or review. They only execute.
2. Prefer an enabled web/subscription planner (`chatgpt-web`, `claude-web`,
   `gemini-web`) before any paid API. `auto` already does this.
3. Never paste file bodies, diffs, or logs into the planner chat. Use the packed
   prompt from `c2x`.
4. Control messages stay under ~1 KB and start with `[C2X]` (legacy `[C2C]` is
   accepted).
5. After EXECUTED, ask the web-chat planner to review from changed-file and test
   metadata, not from the harness summary alone.

## Loop

```text
INIT → PLAN → EXECUTING → EXECUTED → REVIEW → PLAN | DONE | BLOCKED
```

## Commands

```bash
npx tsx src/cli/c2x.ts plan --goal "…" --planner auto --harness codex --workspace demo
npx tsx src/cli/c2x.ts plan --goal "…" --planner claude-web --harness claude-code
npx tsx src/cli/c2x.ts pack --goal "…"
npx tsx src/cli/c2x.ts estimate --goal "…"
npx tsx src/cli/c2x.ts route --choice auto --harness claude-code
```

Copy the printed brief. Execute only those actions in Codex or Claude Code. Then:

```bash
# In the dashboard, or POST /api/review with changed files + test summary
```

## Web chats (large quota)

If the planner is `chatgpt-web`, `claude-web`, or `gemini-web`, `c2x plan`
prints a paste prompt. Open that site, paste it, paste the `[C2X] PLAN` back
into the dashboard Import field (or `POST /api/import-plan`). No unofficial
proxy. No stolen cookies.

## First-time local setup

```bash
npm install
npm run dev
```

Open the control room, pick a web planner and a harness, run Pack & plan on the
demo workspace, copy the harness brief, then continue in this session from that
brief only.
