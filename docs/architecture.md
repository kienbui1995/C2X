# Frugal Codex architecture

Inspired by [XiaoDuoYa/codex-with-chatgpt](https://github.com/XiaoDuoYa/codex-with-chatgpt):
thinking stays off the execution harness. C2X adds a token packer, a provider
router, and a **quota-split** model so one scarce Codex/Claude Code allowance is
not burned on plan/review.

The constraint: a single harness quota runs out; ChatGPT web, Gemini web, and
Claude web already include large chat allowances on subscriptions (or free
tiers) the user already pays for.

```
  chatgpt-web / claude-web / gemini-web   (then cheap APIs)
  (plan + review, large included chat quota)
           │ packed context
           ▼
      Frugal packer ──► [C2X] PLAN < 2k tok
           │
           ▼
     harness brief ──► Codex or Claude Code (edit / test / git only)
           │
           ▼
     EXECUTED metadata ──► same web planner reviews
```

## Roles

| Role | Who | Never |
| --- | --- | --- |
| Plan | Web/subscription planners first, then local, then paid APIs | `codex`, `claude-code` |
| Review | Same as plan | `codex`, `claude-code` |
| Execute | `codex` or `claude-code` | planners |

`gemini` (API) is distinct from `gemini-web` (paste). `anthropic` (API) is
distinct from `claude-web` (paste) and `claude-code` (harness). Paste planners
generate a compact prompt; the user pastes the `[C2X]` PLAN back. No unofficial
reverse proxies and no cookie theft.

Auto-pick ranks ready planners by kind (`subscription` → `local` → `api`), then
input price, then name.

## Why this saves harness quota (and tokens)

A typical harness-only turn dumps files into the same expensive context that
also plans and reviews. That costs **tokens** and **turns**. C2X splits both:

| Role | Who pays | Quota story |
| --- | --- | --- |
| Plan | ChatGPT / Claude / Gemini web, or a cheap API | Large included chats, or API tokens |
| Execute | Codex or Claude Code, brief only | One scarce harness turn |
| Review | Same planner, from git/test metadata | Another web-chat turn, not a harness turn |

Naive path: 3 harness turns (think + run + review). C2X: 1 harness turn +
2 web-chat turns when the planner is a subscription paste target.

## Security

The packer refuses `.env*`, keys, and SSH material. There is no write MCP in
this slice — the selected harness remains the only writer. Keys live in
`data/config.json` or environment variables, never in git. Web planners never
receive account credentials.

## Compatibility

Control messages accept `[C2X]` and legacy `[C2C]`. You can still run the
original C2C bridge for ChatGPT Computer Use; this repo is the multi-provider,
quota-splitting base on top of that idea.
