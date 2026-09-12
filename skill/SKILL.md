---
name: chat-to-x
description: Use chat-to-x (C2X) so ChatGPT/Claude/Gemini web chats plan and review, and a selectable harness team (Codex, Claude Code, Grok Build, OpenCode, Kiro CLI) only executes per-harness briefs.
---

# chat-to-x

The checkout lives at: replace-with-absolute-path

Install this skill with `c2x skill-install` (writes `~/.codex/skills/chat-to-x/SKILL.md`
and replaces the checkout path). Claude Code: copy the same file to
`~/.claude/skills/chat-to-x/` — C2X does not auto-install there.

## When to use

Any implementation, review, or debugging task where a single harness quota
(Codex, Claude Code, Grok Build, OpenCode, or Kiro CLI) would otherwise be
burned on planning — or on doing the entire job. Combine scarce harness
quotas: web chats think, the planner splits packets, each selected harness
executes only its brief.

## Rules

1. Codex, Claude Code, Grok Build, OpenCode, and Kiro CLI do not plan or review. They only execute their packet.
2. Prefer an enabled web/subscription planner (`chatgpt-web`, `claude-web`,
   `gemini-web`) before any paid API. `auto` already does this.
3. Never paste file bodies, diffs, or logs into the planner chat. Use the packed
   prompt from `c2x` (CLI alias for chat-to-x).
4. Control messages stay under ~1 KB and start with `[C2X]` (legacy `[C2C]` is
   accepted). A PLAN may include a `PACKETS` section; each execute brief has
   `OWNER`.
5. After each harness reports EXECUTED, merge metadata and ask the web-chat
   planner to review. Do not review inside a harness.
6. Do not show another harness's brief to this one. Quota is per tool.
7. After a PLAN exists, read **only** `.c2x/briefs/<your-harness-id>.md` if
   that file exists (Codex=`codex`, Claude Code=`claude-code`,
   Grok Build=`grok-build`, OpenCode=`opencode`, Kiro CLI=`kiro-cli`).
   Do not read other files in `.c2x/briefs/`. Do not plan or review.
   If the drop is missing, use the copied brief / `c2x brief --session … --owner …`.

## Loop

```text
INIT → PLAN (packets) → EXECUTING (per harness) → EXECUTED (merge) → REVIEW → PLAN | DONE | BLOCKED
```

## Commands

```bash
npx tsx src/cli/c2x.ts plan --goal "…" --planner auto
npx tsx src/cli/c2x.ts plan --goal "…" --planner mock --team codex,claude-code,grok-build,opencode,kiro-cli
npx tsx src/cli/c2x.ts plan --goal "…" --planner claude-web --harness claude-code
npx tsx src/cli/c2x.ts plan --goal "…" --planner mock --harness kiro-cli
npx tsx src/cli/c2x.ts pack --goal "…"
npx tsx src/cli/c2x.ts estimate --goal "…"
npx tsx src/cli/c2x.ts route --choice auto --team grok-build,opencode,kiro-cli
npx tsx src/cli/c2x.ts doctor
npx tsx src/cli/c2x.ts brief --session <id> --owner <your-id> --drop
npx tsx src/cli/c2x.ts record --session <id> --owner <your-id>
npx tsx src/cli/c2x.ts review-prompt --session <id>
```

Default team is Codex + Claude Code. `--harness` keeps a single-harness session.
`--team` accepts any subset of `codex,claude-code,grok-build,opencode,kiro-cli`.
Copy the printed brief for **this** harness only (`OWNER` must match). Then:

```bash
# Dashboard: Giả lập đã chạy on one lane or all, or POST /api/execute then /api/review
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

Open the control room, pick a web planner and enable the harness team, run
Pack & plan on the demo workspace, copy each harness brief, then continue in
this session from **your** brief only.
