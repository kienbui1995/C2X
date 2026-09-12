---
name: frugal-codex
description: Use Frugal Codex (C2X) so ChatGPT or another cheap planner thinks, and Codex only executes a short brief.
---

# Frugal Codex

The checkout lives at: replace-with-absolute-path

## When to use

Any implementation, review, or debugging task where Codex would otherwise read a large workspace just to plan.

## Rules

1. Codex does not plan. A planner (ChatGPT web, Groq, Gemini, DeepSeek, OpenRouter, Ollama, OpenAI, Anthropic, or the mock planner) plans.
2. Never paste file bodies, diffs, or logs into the planner chat. Use the packed prompt from `c2x`.
3. Control messages stay under ~1 KB and start with `[C2X]` (legacy `[C2C]` is accepted).
4. After EXECUTED, ask the planner to review from changed-file and test metadata, not from your summary alone.

## Loop

```text
INIT → PLAN → EXECUTING → EXECUTED → REVIEW → PLAN | DONE | BLOCKED
```

## Commands

```bash
npx tsx src/cli/c2x.ts plan --goal "…" --planner auto --workspace demo
npx tsx src/cli/c2x.ts pack --goal "…"
npx tsx src/cli/c2x.ts estimate --goal "…"
npx tsx src/cli/c2x.ts route --choice auto
```

Copy the printed brief. Execute only those actions. Then:

```bash
# In the dashboard, or POST /api/review with changed files + test summary
```

## ChatGPT web

If the planner is `chatgpt-web`, `c2x plan` prints a paste prompt. Open ChatGPT, paste it, paste the `[C2X] PLAN` back into the dashboard Import field (or `POST /api/import-plan`).

## First-time local setup

```bash
npm install
npm run dev
```

Open the control room, run Pack & plan on the demo workspace, copy the Codex brief, then continue in this session from that brief only.
