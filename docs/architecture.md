# Frugal Codex architecture

Inspired by [XiaoDuoYa/codex-with-chatgpt](https://github.com/XiaoDuoYa/codex-with-chatgpt):
the planner thinks, Codex keeps the harness. C2X adds a token packer and a
provider router so the planner is not locked to ChatGPT web.

```
  ChatGPT web / Groq / Gemini / DeepSeek / …
  (plan + review, cheap or $0 API)
           │ packed context
           ▼
      Frugal packer ──► [C2X] PLAN < 2k tok
           │
           ▼
        Codex brief ──► Codex harness (edit / test / git)
           │
           ▼
     EXECUTED metadata ──► planner review
```

## Why this saves Codex tokens

A typical Codex-only turn dumps files into the same expensive context that
also plans and reviews. C2X splits the bill:

| Role | Who pays |
| --- | --- |
| Plan | ChatGPT subscription or a cheap API |
| Execute | Codex, but only the brief |
| Review | Same planner, from git/test metadata |

## Security

The packer refuses `.env*`, keys, and SSH material. There is no write MCP in
this slice — Codex remains the only writer. Keys live in `data/config.json`
or environment variables, never in git.

## Compatibility

Control messages accept `[C2X]` and legacy `[C2C]`. You can still run the
original C2C bridge for ChatGPT Computer Use; this repo is the multi-provider
token-economy base on top of that idea.
