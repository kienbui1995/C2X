# Frugal Codex (C2X)

Planner nghĩ. Codex làm. Token không bị đốt.

Base lấy ý tưởng từ [XiaoDuoYa/codex-with-chatgpt](https://github.com/XiaoDuoYa/codex-with-chatgpt):
ChatGPT (hoặc planner khác) chịu phần lập kế hoạch và review; Codex chỉ
nhận brief ngắn rồi sửa file / chạy test / git.

Đây không phải bản fork nguyên OAuth + tunnel của repo gốc. C2X giữ giao thức
và mô hình hai não, rồi thêm:

- **Router đa nhà cung cấp** — ChatGPT web, Groq, Gemini, DeepSeek, OpenRouter, Ollama, OpenAI, Anthropic, endpoint tương thích OpenAI, planner giả lập
- **Packer token** — chỉ đưa file liên quan, chặn `.env` và khóa
- **Sổ tiết kiệm** — so Codex phải đọc cả workspace với Codex chỉ đọc brief

## Chạy local

Cần Node.js 20+.

```bash
npm install
npm run dev
```

Mở [http://127.0.0.1:45217](http://127.0.0.1:45217). Không cần API key để dùng
planner giả lập và chế độ dán ChatGPT web.

```bash
npm test
npx tsx src/cli/c2x.ts plan --goal "Sửa createTask" --planner mock
```

## Cách dùng để tiết kiệm Codex

1. Viết mục tiêu trong **Phòng điều khiển**.
2. Chọn planner: `auto` (rẻ nhất sẵn sàng), `chatgpt-web` (dùng hạn mức Plus/Pro), hoặc API.
3. **Đóng gói & lập kế hoạch** — dashboard hiện token thô / đã nén / % Codex đỡ phải đọc.
4. Sao chép **brief cho Codex**. Dán brief đó vào phiên Codex. Đừng dán repo.
5. Sau khi Codex chạy xong, **Giả lập Codex đã chạy** hoặc `POST /api/review` để planner review.

### ChatGPT web (0 API)

Chọn `chatgpt-web`, sao chép prompt đã nén, dán vào chatgpt.com, dán khối
`[C2X] PLAN` trở lại ô nhập. Không reverse-proxy, không lấy cookie.

### Nhà cung cấp khác

Đặt key trong trang **Nhà cung cấp** hoặc file `.env`:

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
diff / log / thân file vào tin nhắn điều khiển.

## Cấu trúc

```
src/core/          packer, protocol, router, savings, providers
src/app/           dashboard Next.js
src/cli/c2x.ts     CLI
skill/SKILL.md     skill cho Codex
```

## License

MIT. Dự án cộng đồng, không liên kết OpenAI.

English notes live in [docs/architecture.md](docs/architecture.md).
