# Security / Bảo mật

## Reporting a vulnerability / Báo cáo lỗ hổng

Please report security issues through **GitHub Security Advisory (GHSA)** on
this repository. Do **not** open a public issue for RCE, LFI, path traversal,
or credential leaks.

Báo cáo lỗ hổng qua **GitHub Security Advisory (GHSA)**. **Không** mở issue
công khai cho RCE / LFI / lộ credential.

Do **not** use Security Advisory for Code of Conduct reports. CoC goes to
GitHub Issues or Discussions. See [CODE_OF_CONDUCT.md](CODE_OF_CONDUCT.md).

## Trust model / Mô hình tin cậy

Local, single-user. The dashboard has no login and no database. Localhost
CSRF is accepted: if you browse untrusted sites while `127.0.0.1:45217` is
up, a page can rewrite `data/config.json` keys. Treat the dashboard as
your machine.

Pasting a `[C2X]` block is you approving that plan. stdio `c2x mcp` runs
with Codex privileges. Keys live in `data/config.json` (chmod 600; dir
700). Prefer `git clone` + `./install.sh`, or pin a commit, instead of
piping `main`. Harness spawn is CLI `c2x drive --spawn` only — never
dashboard or HTTP `/api/drive`.

Máy local, một người. Dashboard không auth, không DB. CSRF localhost được
chấp nhận. Dán `[C2X]` = bạn duyệt plan đó. MCP stdio = quyền Codex. Key
trong `data/config.json`. Ưu tiên clone hoặc pin, đừng pipe `main` nếu
chưa đọc `install.sh`. Spawn chỉ CLI `drive --spawn`.

## What we will reject / PR bị từ chối

Pull requests that add any of the following are out of scope and will be closed:

- ChatGPT reverse-proxy, cookie scraping, or unofficial connectors
- Cloudflare / ngrok / public tunnels as a product feature
- Dashboard or API fields that accept filesystem paths from the browser
- Spawning Codex, Claude Code, Grok, OpenCode, Kiro, or ChatGPT from HTTP
  or the dashboard (CLI `--spawn` is the only allowed spawn path)

## Hardening already locked

`c2x mcp` default is **stdio** — a local chat-to-x MCP control plane (same
local trust as the CLI). It is not an official Codex plugin. It never
opens a port, never tunnels, never OAuth, never spawns a harness.
Optional HTTP `c2x mcp --session` still binds **127.0.0.1** only, stays
read-only, pins that session id, and caps bodies at ~1MB. First-run does
not start the HTTP server.

- Dashboard `dev` / `start` bind **`127.0.0.1`** only and have **no login**.
  Treat as single-user. Do not expose the port. Do not browse untrusted sites
  while it is running (CSRF can rewrite `data/config.json` keys).
- HTTP bodies must not carry `cwd` / `workspaceRoot` — the process cwd is the repo
- Control messages stay tiny (no file bodies, no full diffs, no logs)
- `.env*` and `/data/*` (except `.gitkeep`) stay out of git
- `npm test` must not require planner API keys
