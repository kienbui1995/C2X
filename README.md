# chat-to-x (C2X)

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
[![Node.js 20+](https://img.shields.io/badge/node-20%2B-brightgreen)](https://nodejs.org/)

Chat web nghĩ. Nhiều harness chạy cùng phiên. Đừng đốt một hạn mức Codex,
Claude Code, Grok Build, OpenCode hay Kiro CLI cho phần nghĩ — **gộp** chúng.
Chọn bất kỳ tập hợp nào trong năm harness.

Vấn đề thật: một harness làm hết (nghĩ + sửa + test + review) thì hạn mức hết
nhanh. **ChatGPT web**, **Gemini web** và **Claude web** đã có nhiều lượt chat
kèm theo gói bạn đang trả. chat-to-x tách vai và **chia việc giữa các harness**:

| Vai | Ai | Hạn mức |
| --- | --- | --- |
| Plan + review | `chatgpt-web`, `claude-web`, `gemini-web` (rồi mới tới API) | Quota chat lớn / subscription |
| Execute | Bất kỳ tập hợp `codex` \| `claude-code` \| `grok-build` \| `opencode` \| `kiro-cli` | Mỗi tool chỉ chạy packet của mình |

Planner chia PLAN thành **work packet** (file không chồng khi có thể). Ví dụ:
Codex sửa `createTask`; Claude Code viết test empty-state. Mỗi harness chỉ thấy
brief của mình — tiết kiệm đúng hạn mức khan đó.

Base lấy ý tưởng từ [XiaoDuoYa/codex-with-chatgpt](https://github.com/XiaoDuoYa/codex-with-chatgpt):
não nghĩ tách khỏi harness. chat-to-x thêm packer token, router đa nhà cung cấp,
đội harness, và mô hình **tách hạn mức**.

Đây không phải bản fork OAuth + tunnel. Không reverse-proxy, không lấy cookie.

## Cài và dùng

Node.js 20+, Codex đã login trên PATH. **Không** `npx c2x` (đó là tool khác).

**Không clone git C2X vào từng app.** Một lệnh — `install.sh` tự `npm install`,
ghi `c2x` vào `~/.local/bin`, và `c2x init --harness codex`:

```bash
curl -fsSL https://raw.githubusercontent.com/kienbui1995/chat-to-x/main/install.sh | bash
```

Đã có thư mục chat-to-x trên máy:

```bash
./install.sh
```

Repo: [github.com/kienbui1995/chat-to-x](https://github.com/kienbui1995/chat-to-x).
npm vẫn `"private": true` — khi publish `chat-to-x` mới đổi sang
`npm i -g chat-to-x && c2x init`. **Không** `npx c2x`.

`init` đọc skill USER Codex (`$HOME/.agents/skills/chat-to-x`), skill cũ
(`~/.codex/skills`), khối C2X trong `~/.codex/AGENTS.md`, và plugin MCP
(`[mcp_servers.chat-to-x]` trong `~/.codex/config.toml`) từ package đã cài —
không cần `cwd` là git C2X.

C2X **không** hiện banner trong Codex. Cài trên **máy đang chạy Codex** (cài
trên VM khác thì laptop không thấy). Mở lại Codex rồi kiểm:

- `$chat-to-x` hoặc `/skills` — skill USER
- `/mcp` hoặc `codex mcp list` — server `chat-to-x`
- `c2x doctor` — bốn dòng `codex-skill` / `codex-agents` / `codex-mcp` phải `ok`

Sau đó **chỉ làm việc trong Codex** trên app của bạn:

```bash
cd <project-cần-sửa>
codex
```

```text
Dùng C2X, tự làm hết: Sửa createTask để persist khi reload
```

Chỉ cần mô tả. Codex gọi `c2x_start` (planner mặc định `mock`, không dán chat),
làm brief, rồi `c2x_record` đến DONE. Không mở terminal thứ hai, không đẻ
Codex lần nữa.

Muốn ChatGPT web nghĩ: nói thêm “dán ChatGPT”. Codex hiện prompt; bạn dán
khối `[C2X]` **lại chat Codex** (`c2x_submit`).

CLI tương đương: `c2x "Sửa createTask" --planner mock --no-spawn`.

Dashboard (tuỳ): `npm run dev` → [http://127.0.0.1:45217](http://127.0.0.1:45217).
Trong repo này, chưa link: `npx chat-to-x "Sửa createTask"`. **Không** `npx c2x`.

### `.c2xignore`

Khi `--workspace repo`, packer đọc `.c2xignore` ở root workspace (một dòng một
tên/path; `#` là comment). `node_modules`, `.git`, `.next`, `.c2x` đã bị bỏ mặc
định. Workspace **demo** không đọc file này (0 I/O). Dashboard không nhận path —
chỉ CLI `--cwd` hoặc `C2X_WORKSPACE`.

```gitignore
# extra packer ignores (path segment or relative path)
vendor
fixtures/huge
```

## Cách tách hạn mức

1. Viết mục tiêu trong **Phòng điều khiển**.
2. Chọn planner: `auto` (ưu tiên chat web / subscription đang bật), `chatgpt-web`,
   `claude-web`, `gemini-web`, hoặc API nếu bạn muốn.
3. Chọn **đội harness** (multi-select): `codex`, `claude-code`, `grok-build`,
   `opencode`, `kiro-cli` — một cái hoặc vài cái. Router **không bao giờ** gửi
   plan/review sang harness.
4. **Đóng gói & lập kế hoạch** — dashboard hiện token, packet / làn việc theo
   từng harness, lượt harness giữ lại / lượt chat web.
5. Sao chép **brief từng harness**. Dán đúng tool đó. Đừng dán repo, đừng đưa
   hết plan cho một harness.
6. **Giả lập đã chạy** từng lane hoặc tất cả. Review vẫn về planner chat web.
   `POST /api/execute` rồi `POST /api/review`.

### Chat web (0 API, quota chat lớn)

Chọn `chatgpt-web`, `claude-web`, hoặc `gemini-web`. Sao chép prompt đã nén, dán
vào trang chat bạn đã đăng nhập, dán khối `[C2X] PLAN` (kèm `PACKETS`) trở lại
ô nhập. Không reverse-proxy, không lấy cookie.

`gemini` (API) vẫn còn — khác với `gemini-web` (dán). `anthropic` (API) khác với
`claude-web` (dán) và `claude-code` (harness).

### Nhà cung cấp API

Đặt key trong trang **Nhà cung cấp** hoặc file `.env`. Router chỉ chọn API khi
không còn planner chat web nào đang bật và sẵn sàng.

```bash
GROQ_API_KEY=
GEMINI_API_KEY=
DEEPSEEK_API_KEY=
OPENROUTER_API_KEY=
OPENAI_API_KEY=
ANTHROPIC_API_KEY=
OLLAMA_BASE_URL=http://127.0.0.1:11434
CUSTOM_OPENAI_API_KEY=
```

Nếu API lỗi, vòng lặp fallback về planner giả lập để bạn vẫn lấy được packet.

## Giao thức

```
INIT → PLAN (packets) → EXECUTING (per harness) → EXECUTED (merge) → REVIEW → PLAN | DONE | BLOCKED
```

Mặt điều khiển dùng `[C2X]` (vẫn đọc được `[C2C]` của repo gốc). Không nhét
diff / log / thân file vào tin nhắn điều khiển. Execute là đội harness; mỗi
brief có `OWNER`. Thêm harness mới: **một** entry trong registry
`src/core/providers/catalog.ts` (`HARNESS_BY_ID satisfies Record<HarnessId, …>`).
UI / CLI / router / mock splitter `map` catalog — không nhân 5 `switch`.
Hướng dẫn 10 phút: [spec §19](docs/superpowers/specs/2026-09-12-chat-to-x-features-design.md).
Không plugin marketplace.

## Cấu trúc

```
src/core/providers/catalog.ts   registry harness + planner (nguồn sự thật)
src/core/                       packer sync, packets, protocol, router, savings
src/app/                        dashboard Next.js (import catalog, không refetch mỗi click)
src/cli/c2x.ts                  CLI
skill/SKILL.md                  skill cho đội harness trong catalog
```

## Tốc độ (mặc định)

Vibe-coding không được chậm. Khóa: packer **sync**; bỏ `node_modules` / `.git` / `.next`;
workspace mặc định **demo**; walk `repo` ≤ 80 file / 120 KB / 250 ms; mock + prompt dán
web sinh **local (ms)**; brief tính **một lần** lúc PLAN; **không spawn** harness;
cache `doctor`/`PATH`; `npm test` không cần API key. Chi tiết:
[spec §18](docs/superpowers/specs/2026-09-12-chat-to-x-features-design.md).

Attribution MIT: ý tưởng protocol từ
[XiaoDuoYa/codex-with-chatgpt](https://github.com/XiaoDuoYa/codex-with-chatgpt)
— không fork OAuth / tunnel / cookie. Xem [NOTICE](NOTICE).

## Public / npm

GitHub: [https://github.com/kienbui1995/chat-to-x](https://github.com/kienbui1995/chat-to-x).
Clone: `git clone https://github.com/kienbui1995/chat-to-x.git`.

npm: giữ `"private": true` đến khi publish **`chat-to-x`**. Không publish `c2x`.

## License

MIT. Dự án cộng đồng, không liên kết OpenAI hay Anthropic.

English notes live in [docs/architecture.md](docs/architecture.md).

Kế hoạch phase 2 (Slice L + P đã ship; M + O trong file):
[docs/superpowers/plans/2026-09-12-chat-to-x-next.md](docs/superpowers/plans/2026-09-12-chat-to-x-next.md).

Baseline v1 đã ship:
[thiết kế](docs/superpowers/specs/2026-09-12-chat-to-x-features-design.md) ·
[plan 2026-09-12](docs/superpowers/plans/2026-09-12-chat-to-x-features.md).
