# Security / Bảo mật

## Reporting a vulnerability / Báo cáo lỗ hổng

Please report security issues through **GitHub Security Advisory** on this
repository. Do **not** open a public issue for RCE, LFI, path traversal, or
credential leaks.

Báo cáo lỗ hổng qua **GitHub Security Advisory**. **Không** mở issue công khai
cho RCE / LFI / lộ credential.

## What we will reject / PR bị từ chối

Pull requests that add any of the following are out of scope and will be closed:

- ChatGPT reverse-proxy, cookie scraping, or unofficial connectors
- Cloudflare / ngrok / public tunnels as a product feature
- Dashboard or API fields that accept filesystem paths from the browser
- Spawning Codex, Claude Code, Grok, OpenCode, Kiro, or ChatGPT from C2X

## Hardening already locked

Optional `c2x mcp` binds **127.0.0.1** only. No Cloudflare tunnel, no OAuth,
no public URL, no write tools. First-run does not start MCP.

- Dashboard `dev` / `start` bind **`127.0.0.1`** only
- HTTP bodies must not carry `cwd` / `workspaceRoot` — the process cwd is the repo
- Control messages stay tiny (no file bodies, no full diffs, no logs)
- `.env*` and `/data/*` (except `.gitkeep`) stay out of git
- `npm test` must not require planner API keys
