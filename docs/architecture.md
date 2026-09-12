# chat-to-x architecture

Inspired by [XiaoDuoYa/codex-with-chatgpt](https://github.com/XiaoDuoYa/codex-with-chatgpt):
thinking stays off the execution harness. chat-to-x adds a token packer, a provider
router, a **harness team** that shares one PLAN, and a **quota-split** model so
scarce Codex / Claude Code / Grok Build / OpenCode / Kiro CLI allowances are
not burned on plan/review — or on doing the entire job in one tool.

The constraint: a single harness quota runs out; ChatGPT web, Gemini web, and
Claude web already include large chat allowances on subscriptions (or free
tiers) the user already pays for.

```
  chatgpt-web / claude-web / gemini-web   (then cheap APIs)
  (plan + review, large included chat quota)
           │ packed context
           ▼
      chat-to-x packer ──► [C2X] PLAN + PACKETS
           │
           ├─► brief OWNER=codex        ──► Codex (its files only)
           ├─► brief OWNER=claude-code  ──► Claude Code (its files only)
           ├─► brief OWNER=grok-build   ──► Grok Build (execute only)
           ├─► brief OWNER=opencode     ──► OpenCode (execute only)
           └─► brief OWNER=kiro-cli     ──► Kiro CLI (execute only)
           │
           ▼
     EXECUTING per harness ──► EXECUTED merge metadata
           │
           ▼
     same web planner reviews
```

The roster is `HARNESS_IDS`: `codex`, `claude-code`, `grok-build`, `opencode`,
`kiro-cli`. Default team is still Codex + Claude Code; the others are opt-in
teammates.
Adding another id means catalog + exhaustive `never` switches. The wire format
uses `owner=<harness-id>` rather than hardcoded Codex/Claude Code sections.

## Roles

| Role | Who | Never |
| --- | --- | --- |
| Plan | Web/subscription planners first, then local, then paid APIs | any `HarnessId` |
| Review | Same as plan | any `HarnessId` |
| Execute | Any subset of `codex`, `claude-code`, `grok-build`, `opencode`, `kiro-cli` | planners |

Default team is Codex + Claude Code. The control room can pick any one harness
or several together. A single-harness team is still valid.

`gemini` (API) is distinct from `gemini-web` (paste). `anthropic` (API) is
distinct from `claude-web` (paste) and `claude-code` (harness). Paste planners
generate a compact prompt; the user pastes the `[C2X]` PLAN back. No unofficial
reverse proxies and no cookie theft.

Auto-pick ranks ready planners by kind (`subscription` → `local` → `api`), then
input price, then name.

## Work packets

The planner (including the mock planner) splits packed files into packets:

| Team size | Split |
| --- | --- |
| 1 | One `general` packet owns every planned file |
| 2+ | First harness `implement` (non-test files), last harness `test` (`*.test.*`, `test-hint`, `__tests__`). Middle teammates get remaining implement files. If the pack has only one class of files, files are partitioned so ownership stays disjoint. |

Each packet carries owner, role, actions, files, tests, and success criteria.
`planToBriefs` renders one `[C2X]` brief per owner so a harness never receives
the teammate's packet.

## Protocol

```
INIT → PLAN → EXECUTING → EXECUTED → REVIEW → PLAN | DONE | BLOCKED
```

- `PLAN` includes a `PACKETS` section (indented so inner `ACTIONS:` lines stay
  inside that section).
- `EXECUTING` may stay `EXECUTING` while other teammates are still running.
- `EXECUTED` merges changed-file and test metadata from every harness run.
- Review always returns to the web/API planner — never to a harness.

## Why this saves harness quota (and tokens)

A typical harness-only turn dumps files into the same expensive context that
also plans and reviews. That costs **tokens** and **turns**. C2X splits both,
and splits **execute** across the team:

| Role | Who pays | Quota story |
| --- | --- | --- |
| Plan | ChatGPT / Claude / Gemini web, or a cheap API | Large included chats, or API tokens |
| Execute | Each selected harness, brief only | One scarce turn per teammate, scoped files |
| Review | Same planner, from merged git/test metadata | Another web-chat turn, not a harness turn |

Naive path: 3 harness turns on **one** tool (think + run + review). C2X: 1
execute turn per teammate + 2 web-chat turns when the planner is a
subscription paste target.

## Security

The packer refuses `.env*`, keys, and SSH material. There is no write MCP in
this slice — the selected harnesses remain the only writers. Keys live in
`data/config.json` or environment variables, never in git. Web planners never
receive account credentials.

## Compatibility

Control messages accept `[C2X]` and legacy `[C2C]`. You can still run the
original C2C bridge for ChatGPT Computer Use; this repo is the multi-provider,
multi-harness, quota-splitting base on top of that idea.

## Next features (not implemented in this checkout)

Design (Vietnamese): [docs/superpowers/specs/2026-09-12-chat-to-x-features-design.md](superpowers/specs/2026-09-12-chat-to-x-features-design.md)

Implementation plan: [docs/superpowers/plans/2026-09-12-chat-to-x-features.md](superpowers/plans/2026-09-12-chat-to-x-features.md)

OSS locks (public MIT): publish as `chat-to-x` never `c2x`; no browser
workspace paths; no harness spawn; no C2C OAuth/tunnel fork. Feature slice 1
first: web-chat PLAN+REVIEW paste loop. Slice 0 (NOTICE, SECURITY, ignore
`/data/`) does not block that loop.
