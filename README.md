# Frugal Codex (C2X)

Chat web nghĩ. Nhiều harness chạy cùng phiên. Đừng đốt một hạn mức Codex,
Claude Code, Grok Build, OpenCode hay Kiro CLI cho phần nghĩ — **gộp** chúng.
Chọn bất kỳ tập hợp nào trong năm harness.

Vấn đề thật: một harness làm hết (nghĩ + sửa + test + review) thì hạn mức hết
nhanh. **ChatGPT web**, **Gemini web** và **Claude web** đã có nhiều lượt chat
kèm theo gói bạn đang trả. C2X tách vai và **chia việc giữa các harness**:

| Vai | Ai | Hạn mức |
| --- | --- | --- |
| Plan + review | `chatgpt-web`, `claude-web`, `gemini-web` (rồi mới tới API) | Quota chat lớn / subscription |
| Execute | Bất kỳ tập hợp `codex` \| `claude-code` \| `grok-build` \| `opencode` \| `kiro-cli` | Mỗi tool chỉ chạy packet của mình |

Planner chia PLAN thành **work packet** (file không chồng khi có thể). Ví dụ:
Codex sửa `createTask`; Claude Code viết test empty-state. Mỗi harness chỉ thấy
brief của mình — tiết kiệm đúng hạn mức khan đó.

Base lấy ý tưởng từ [XiaoDuoYa/codex-with-chatgpt](https://github.com/XiaoDuoYa/codex-with-chatgpt):
não nghĩ tách khỏi harness. C2X thêm packer token, router đa nhà cung cấp,
đội harness, và mô hình **tách hạn mức**.

Đây không phải bản fork OAuth + tunnel. Không reverse-proxy, không lấy cookie.

## Chạy local

Cần Node.js 20+.

```bash
npm install
npm run dev
```

Mở [http://127.0.0.1:45217](http://127.0.0.1:45217). Không cần API key để dùng
planner giả lập và chế độ dán ChatGPT / Claude / Gemini web.

```bash
npm test
npx tsx src/cli/c2x.ts plan --goal "Sửa createTask" --planner mock
npx tsx src/cli/c2x.ts plan --goal "Sửa createTask" --planner mock --harness codex
npx tsx src/cli/c2x.ts route --choice auto --team codex,claude-code,grok-build,opencode,kiro-cli
npx tsx src/cli/c2x.ts plan --goal "Sửa createTask" --planner mock --harness kiro-cli
```

Mặc định CLI dùng đội `codex,claude-code`. `--harness kiro-cli` (hoặc `codex`)
vẫn là một harness. `--team` chọn bất kỳ tập hợp nào trong năm id.

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
brief có `OWNER`. Thêm harness mới: mở rộng `HARNESS_IDS` + catalog (switch
`never` sẽ bắt các chỗ chưa xử lý).

## Cấu trúc

```
src/core/          packer, packets, protocol, router, savings, providers
src/app/           dashboard Next.js
src/cli/c2x.ts     CLI
skill/SKILL.md     skill cho Codex / Claude Code / Grok Build / OpenCode / Kiro CLI
```

## License

MIT. Dự án cộng đồng, không liên kết OpenAI hay Anthropic.

English notes live in [docs/architecture.md](docs/architecture.md).
