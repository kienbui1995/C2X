# Frugal Codex (C2X)

Chat web nghĩ. Harness chạy. Đừng đốt hạn mức Codex/Claude Code cho phần nghĩ.

Vấn đề thật: nếu bạn chỉ dùng **một** harness (Codex *hoặc* Claude Code), hạn mức
chạy sẽ hết nhanh. Trong khi đó **ChatGPT web**, **Gemini web** và **Claude web**
đã có nhiều lượt chat kèm theo gói bạn đang trả (hoặc tầng miễn phí). C2X tách
vai:

| Vai | Ai | Hạn mức |
| --- | --- | --- |
| Plan + review | `chatgpt-web`, `claude-web`, `gemini-web` (rồi mới tới API) | Quota chat lớn / subscription |
| Execute | `codex` hoặc `claude-code` | Hạn mức harness khan hiếm |

Base lấy ý tưởng từ [XiaoDuoYa/codex-with-chatgpt](https://github.com/XiaoDuoYa/codex-with-chatgpt):
não nghĩ tách khỏi harness. C2X thêm packer token, router đa nhà cung cấp, và
mô hình **tách hạn mức** (không chỉ tiết kiệm token).

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
npx tsx src/cli/c2x.ts plan --goal "Sửa createTask" --planner mock --harness codex
npx tsx src/cli/c2x.ts route --choice auto --harness claude-code
```

## Cách tách hạn mức

1. Viết mục tiêu trong **Phòng điều khiển**.
2. Chọn planner: `auto` (ưu tiên chat web / subscription đang bật), `chatgpt-web`,
   `claude-web`, `gemini-web`, hoặc API nếu bạn muốn.
3. Chọn harness chạy: `codex` hoặc `claude-code`. Router **không bao giờ** gửi
   plan/review sang hai harness này.
4. **Đóng gói & lập kế hoạch** — dashboard hiện token thô / đã nén / lượt harness
   giữ lại / lượt chat web.
5. Sao chép **brief cho harness**. Dán vào phiên Codex hoặc Claude Code. Đừng dán repo.
6. Sau khi harness chạy xong, **Giả lập harness đã chạy** hoặc `POST /api/review`.

### Chat web (0 API, quota chat lớn)

Chọn `chatgpt-web`, `claude-web`, hoặc `gemini-web`. Sao chép prompt đã nén, dán
vào trang chat bạn đã đăng nhập, dán khối `[C2X] PLAN` trở lại ô nhập. Không
reverse-proxy, không lấy cookie.

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

Nếu API lỗi, vòng lặp fallback về planner giả lập để bạn vẫn lấy được brief.

## Giao thức

```
INIT → PLAN → EXECUTING → EXECUTED → REVIEW → PLAN | DONE | BLOCKED
```

Mặt điều khiển dùng `[C2X]` (vẫn đọc được `[C2C]` của repo gốc). Không nhét
diff / log / thân file vào tin nhắn điều khiển. Execute là `codex` hoặc
`claude-code`.

## Cấu trúc

```
src/core/          packer, protocol, router, savings, providers
src/app/           dashboard Next.js
src/cli/c2x.ts     CLI
skill/SKILL.md     skill cho Codex / Claude Code
```

## License

MIT. Dự án cộng đồng, không liên kết OpenAI hay Anthropic.

English notes live in [docs/architecture.md](docs/architecture.md).
