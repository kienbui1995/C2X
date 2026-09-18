# chat-to-x — Public OSS trust slice (Slice C + Slice S)

Ngày: 2026-09-18  
Trạng thái: **đã khóa** (approach B). Không thêm protocol, harness, hay npm publish.  
Spec cũ (đã khóa, đã ship): [2026-09-12-chat-to-x-features-design.md](./2026-09-12-chat-to-x-features-design.md).  
Plan v1 (đã ship): [2026-09-12-chat-to-x-features.md](../plans/2026-09-12-chat-to-x-features.md).  
Plan L+P+M+O (đã ship): [2026-09-12-chat-to-x-next.md](../plans/2026-09-12-chat-to-x-next.md).  
Plan triển khai spec này: [2026-09-18-c2x-public-oss.md](../plans/2026-09-18-c2x-public-oss.md).

Repo công khai thật: `https://github.com/kienbui1995/C2X`.  
npm name vẫn `chat-to-x`, `"private": true`. Cài: clone + `./install.sh`, hoặc `curl` raw `install.sh` sau khi đã đọc script.

## 1. Sản phẩm (không đổi)

chat-to-x (C2X) là mặt điều khiển nhỏ: **chat web nghĩ, harness chạy**.

v1 + Slice L (`.c2x/briefs/`) + P (doctor/dashboard polish) + M (loopback MCP) + O (OSS notes) **đã ship**. Người dùng đã bật Public. Việc còn lại của “việc người” trên plan 2026-09-12-next là: CI stranger thấy được, screenshot thật, badge trỏ repo thật — **không** `npm publish`.

Không viết lại packer, router, catalog, protocol, hay dashboard API.

## 2. Vì sao có spec này

Stranger clone `kienbui1995/C2X` thấy README + test local, nhưng:

| Lỗ | Ảnh hưởng |
| --- | --- |
| Không có GitHub Actions | Không có dấu hiệu xanh trên trang Actions; README không có badge CI |
| `docs/screenshots/README.md` liệt kê 4 PNG nhưng chưa commit ảnh | README không nhúng UI thật |
| Badge / URL giả bị cấm trên plan cũ | Phải dùng URL thật `github.com/kienbui1995/C2X`, không `chat-to-x` làm path repo |

Đây là **trust slice**, không phải feature slice.

## 3. Ba hướng — chọn B

### A. Sản phẩm mới (cấm)

Tunnel, OAuth, marketplace plugin, publish npm tên `c2x`, hay “Codex-as-reviewer”.

- Cộng: trông “platform” hơn.
- Trừ: phá khóa 2026-09-12; Codex không bao giờ review; `c2x` trên npm là CSS→XPath.

**Cấm.** Không protocol mới, không harness mới, không npm publish.

### B. Public OSS trust slice (chọn)

GitHub Actions CI + screenshot dashboard thật + badge README từ URL repo thật `kienbui1995/C2X`.

- Cộng: stranger thấy CI và UI thật; đúng việc người còn lại; không đụng core.
- Trừ: vẫn phải dán PLAN/REVIEW bằng tay (đã khóa từ v1).

**Chọn B.**

### C. Chỉ docs

Sửa chữ, không workflow, không PNG.

- Cộng: ít rủi ro.
- Trừ: yếu khi repo đã Public — stranger vẫn không thấy Actions hay ảnh thật.

**Loại.** Quá yếu.

## 4. Mục tiêu

Làm repo C2X public đáng tin với stranger:

1. **Slice C — GitHub Actions:** workflow `push` + `pull_request` vào `main`, Node 20, `npm ci` (lockfile đã có), `npm test`, `npm run typecheck`. Không secret, không deploy, không publish.
2. **Slice S — Screenshot thật:** bốn PNG từ dashboard đang chạy (`npm run dev` → `127.0.0.1:45217`). Không ảnh stock / AI giả UI.
3. **Badge:** shields hoặc GitHub Actions status trỏ `https://github.com/kienbui1995/C2X/actions` (owner/repo thật). Không owner giả, không path repo `chat-to-x`.
4. **Cài đặt không đổi:** `git clone https://github.com/kienbui1995/C2X.git` + `./install.sh`; `curl -fsSL https://raw.githubusercontent.com/kienbui1995/C2X/main/install.sh | bash` sau khi đọc script. npm vẫn `chat-to-x`. **Không** `npx c2x`.

## 5. Ngoài phạm vi (cấm)

- Protocol / packet / catalog / router / MCP tool mới.
- OAuth, Cloudflare tunnel, cookie, ChatGPT browser, Computer Use như tính năng sản phẩm (browser tool chỉ được dùng để chụp localhost dashboard của chính repo này).
- Dashboard / HTTP nhận filesystem path.
- `case "codex":` mới trong studio / CLI / router / `packets.ts`.
- `npm publish`. Recommend `npx c2x`.
- Codex làm reviewer. OpenDesign trong C2X. Wiki API (wiki vẫn markdown outbox).
- Viết lại git history. Commit chuỗi `PLACEHOLDER_USE_LOCAL`.

## 6. Slice C — GitHub Actions

### 6.1 File

Tạo `.github/workflows/ci.yml`.

### 6.2 Trigger

```yaml
on:
  push:
    branches: [main]
  pull_request:
    branches: [main]
```

### 6.3 Job

Một job trên `ubuntu-latest`:

1. `actions/checkout`
2. `actions/setup-node` với `node-version: 20` hoặc `node-version: '20'`
3. `npm ci` (vì `package-lock.json` tồn tại)
4. `npm test`
5. `npx next typegen` (sinh `LayoutProps` / route types — `next-env.d.ts` gitignore)
6. `npm run typecheck`

Không `npm publish`. Không `npx c2x`. Không env secret. Không deploy. Không cache ngoài npm của `setup-node`.

### 6.4 Badge README

Một badge CI trên README, ngay dưới title, trỏ repo thật. Một trong hai dạng đều đúng:

```markdown
[![CI](https://github.com/kienbui1995/C2X/actions/workflows/ci.yml/badge.svg)](https://github.com/kienbui1995/C2X/actions)
```

hoặc shields `github/actions/workflow/status` cho `kienbui1995/C2X`.

Cấm: owner khác `kienbui1995`; path repo `chat-to-x`; URL Actions bịa.

### 6.5 TDD

Mở rộng `src/core/__tests__/package-meta.test.ts` hoặc file nhỏ `src/core/__tests__/ci-workflow.test.ts`:

- File workflow tồn tại.
- Chứa `node-version: 20` hoặc `node-version: '20'`.
- Chứa `npm test` và `typecheck`.
- **Không** chứa `npm publish`.
- **Không** chứa `npx c2x`.
- README chứa badge CI trỏ `github.com/kienbui1995/C2X` (không owner giả, không `chat-to-x` làm path repo).

## 7. Slice S — Screenshot thật

### 7.1 Bốn file (đã liệt kê)

`docs/screenshots/README.md` giữ bốn tên này. Chụp từ dashboard **đang chạy**, không invent pixel:

| File | Nội dung |
| --- | --- |
| `docs/screenshots/control-room.png` | Phòng điều khiển, đội harness ≥ 2, được empty rồi PLAN |
| `docs/screenshots/paste-plan.png` | Prompt dán + ô import `[C2X]` |
| `docs/screenshots/briefs.png` | Hai lane `OWNER` + hint `.c2x/briefs/` |
| `docs/screenshots/review.png` | `reviewPastePrompt` — không giả `DONE` |

Cách: `npm run dev` bind `127.0.0.1:45217`. Dùng Playwright / Browser-use / computerUse để chạy UI rồi lưu PNG. Planner dán (`chatgpt-web`) để có paste + review prompt; import một khối `[C2X] PLAN` có hai packet (`codex` + `claude-code`); execute rồi `/api/review` để vào `REVIEW` với `reviewPastePrompt`, `review === null`.

Nếu browser không đủ 4 state: chụp những state thật có được (tối thiểu `control-room.png` + một ảnh nữa). Không bịa pixel. Ảnh stock / AI UI = cấm.

### 7.2 README embed

Sau khi PNG tồn tại, nhúng bốn ảnh vào `README.md` (mục Screenshots, trước License). Không nhúng URL ảnh ngoài.

### 7.3 TDD

Test file PNG: bốn path tồn tại; mỗi file lớn hơn ~10 KB (ảnh thật, không placeholder 1×1). Nếu chỉ chụp được subset, test assert đúng subset đã commit — không pass bằng file rỗng.

## 8. Docs

- Spec này: không placeholder, không mâu thuẫn, phạm vi chỉ C + S.
- Plan: `docs/superpowers/plans/2026-09-18-c2x-public-oss.md` — header writing-plans, task TDD nhỏ.
- `docs/architecture.md` mục **Next features**: trỏ plan mới; L/P/M/O vẫn “đã ship”.
- Copy mặc định tiếng Việt; id (`ci.yml`, `OWNER`, `reviewPastePrompt`, `kienbui1995/C2X`) giữ English.

## 9. Khóa toàn cục (không được phá)

- Node.js 20+. Import ở đầu file. `switch` union/enum có `default: never`.
- Không OAuth, không Cloudflare tunnel, không cookie, không ChatGPT browser, không Computer Use sản phẩm.
- Dashboard/HTTP không nhận filesystem path.
- Catalog là nguồn sự thật. Không `case "codex":` mới trong studio / CLI / router / `packets.ts`.
- npm `"name": "chat-to-x"`, `"private": true`. Không recommend `npx c2x`. Test cấm substring đó như lệnh cài.
- Không publish npm. Không bịa GitHub URL. URL thật: `https://github.com/kienbui1995/C2X`.
- Codex không bao giờ reviewer.
- OpenDesign ở ngoài C2X. Wiki = markdown outbox.
- Attribution: `NOTICE` + ý tưởng C2C only.
- Không rewrite git history. Không ghi `PLACEHOLDER_USE_LOCAL`.

## 10. Verify

- `npx vitest run` xanh.
- `npx tsc --noEmit` sạch.
- Nếu dashboard chạy: preview `http://127.0.0.1:45217`.

## 11. Self-review spec

| Kiểm | Kết quả |
| --- | --- |
| Placeholder / TBD | Không |
| Mâu thuẫn với spec 2026-09-12 | Không — không đụng protocol / catalog / npm name |
| Phạm vi | Chỉ Slice C + Slice S |
| Approach A | Cấm, ghi rõ |
| Approach B | Chọn |
| Approach C | Loại vì repo đã Public |
| URL repo | Chỉ `kienbui1995/C2X` |
| npm | `chat-to-x`, private, không publish |
