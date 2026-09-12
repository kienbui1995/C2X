# chat-to-x — thiết kế tính năng tiếp theo

Ngày: 2026-09-12  
Trạng thái: chờ người dùng duyệt trước khi code  
Phạm vi: đóng vòng C2X hiện có. Không fork XiaoDuoYa/codex-with-chatgpt. Không triển khai trong pass này.

## 1. Sản phẩm (không đổi)

chat-to-x (C2X) là mặt điều khiển nhỏ: **chat web nghĩ, harness chạy**.

| Vai | Ai | Hạn mức |
| --- | --- | --- |
| Plan + review | `chatgpt-web`, `claude-web`, `gemini-web` (rồi API / `ollama` / `mock`) | Quota chat lớn / subscription, hoặc token rẻ |
| Execute | Bất kỳ tập hợp `codex` \| `claude-code` \| `grok-build` \| `opencode` \| `kiro-cli` | Mỗi tool chỉ chạy packet `OWNER` của mình |

Lấy ý tưởng từ [XiaoDuoYa/codex-with-chatgpt](https://github.com/XiaoDuoYa/codex-with-chatgpt): não nghĩ ≠ harness. C2C gốc = ChatGPT web + Codex + cầu MCP chỉ-đọc + OAuth + Cloudflare tunnel + Computer Use.

chat-to-x **không** phải bản fork đó. README đã khóa: không reverse-proxy, không lấy cookie, không tunnel. Repo này thêm packer token, router đa planner, đội harness, và mô hình **tách hạn mức**.

Mục tiêu người dùng đã nêu (giữ nguyên):

1. Tiết kiệm hạn mức Codex / Claude Code (và harness khác).
2. Dùng hạn mức chat lớn của ChatGPT / Gemini / Claude web để nghĩ.
3. Ghép nhiều harness trên một PLAN.
4. Chọn bất kỳ tập hợp: Codex, Claude Code, Grok Build, OpenCode, Kiro CLI.
5. OSS MIT.

## 2. Đã có — không lập kế hoạch lại

Các phần sau đã chạy (core + dashboard + CLI + test). Slice mới phải tái sử dụng, không viết lại:

- Catalog planner: `mock`, `chatgpt-web`, `claude-web`, `gemini-web`, `openai`, `anthropic`, `gemini`, `groq`, `openrouter`, `deepseek`, `ollama`, `openai-compatible`.
- Catalog harness `HARNESS_IDS` (5 id), default team `codex` + `claude-code`, `toggleHarnessInTeam` giữ ít nhất một.
- Router: `plan` / `review` **không bao giờ** về harness; `auto` ưu tiên `subscription` → `local` → `api`.
- Packer token + chặn file nhạy cảm (`.env*`, key, SSH).
- Protocol `[C2X]` (đọc được `[C2C]`), state machine `INIT → PLAN → EXECUTING → EXECUTED → REVIEW → PLAN | DONE | BLOCKED`.
- `PACKETS` trong PLAN, brief từng `OWNER`, file không chồng khi packer tách được.
- Session JSON (`data/sessions.json`), merge metadata khi cả đội `EXECUTED`.
- Dashboard Next.js (Phòng điều khiển, Nhà cung cấp, Phiên, Giao thức, Tiết kiệm), i18n vi/en.
- CLI `npm run c2x --` (`providers`, `pack`, `estimate`, `route`, `plan`).
- Skill `skill/SKILL.md`, license MIT, docs `docs/architecture.md`.
- Test vitest: packets, protocol, packer, router, savings, tokens.

`npm test` hiện là hợp đồng không được phá: router không gửi plan/review sang harness; packet 1/2/4/5 harness vẫn tách file.

## 3. Khoảng trống (lý do có spec này)

Repo đã **mô hình hóa** mục tiêu 1–5. Vòng thật vẫn hở:

| Mục tiêu | Đã có | Còn thiếu |
| --- | --- | --- |
| 1. Giữ hạn mức harness | Brief ngắn, router cấm plan/review trên harness, sổ tiết kiệm ước tính | Execute dashboard/CLI chỉ **giả lập**; chưa ghi nhận git/test thật |
| 2. Chat web nghĩ | Prompt dán PLAN cho 3 planner web | Review paste **chưa có**. `runReview` với planner dán gọi `mockReview` local — sổ `webChatTurns = 2` đang nói dối |
| 3. Ghép nhiều harness | Packet + brief + lane | Không ghi brief ra file, không detect CLI, không `record` theo `OWNER` |
| 4. Chọn 5 harness | Catalog + UI + CLI flags | Adapter runtime = 0. `grok-build` có thể không có binary public |
| 5. MIT OSS | `LICENSE` MIT | `package.json` `"private": true`, không có `bin`, CLI chưa `import` / `review` / `record` / `doctor` |

Các hở kỹ thuật khác (không làm hết trong 3 slice đầu):

- Workspace `repo` = `process.cwd()` của server Next, tối đa 80 file / 120 KB; không có `--cwd`, không có `.c2xignore`.
- `packetActions` / `packetCriteria` đang hard-code demo Nhiệm vụ (`createTask`, filter URL).
- `HANDOFF` có trong state machine nhưng không có checkpoint hay lệnh handoff.
- Review **tin** chuỗi `tests` do người dùng/giả lập đưa — trái nguyên tắc C2C “không tin claim”.
- Skill chưa cài vào `~/.codex/skills` (hay thư mục tương đương).

## 4. Ba hướng — khuyến nghị B

### A. Fork C2C đầy đủ (OAuth + tunnel + Computer Use)

Một cầu MCP public, OAuth 2.1, Cloudflare Quick/Named Tunnel, ChatGPT connector, Skill điều khiển trình duyệt có sẵn của Codex.

- Cộng: review độc lập qua `git_diff` đúng như C2C; UX “một câu cài”.
- Trừ: trái README (“không phải bản fork OAuth + tunnel”); khóa ChatGPT + một harness; surface auth/tunnel lớn; dễ đụng ToS / cookie / trình duyệt.

**Loại.** chat-to-x không trở thành C2C.

### B. Mặt điều khiển dán + mặt dữ liệu local (khuyến nghị)

Giữ paste / API / mock. Đóng vòng PLAN **và** REVIEW trên chat web. Thêm bản ghi thực thi local (`git status`, `git diff --stat`, test metadata). Brief từng harness ra file. Không spawn mặc định.

- Cộng: đúng 5 mục tiêu; không cookie/tunnel; đa planner + đa harness; từng slice ra phần mềm chạy được.
- Trừ: planner không tự kéo file như MCP; người dùng vẫn copy/paste; review độc lập yếu hơn C2C trừ khi prompt dán chứa stat/diff đã lọc.

**Chọn B cho slice 1–3.**

### C. Lai: B ngay, MCP loopback (không tunnel) sau

Giống B, cộng tùy chọn MCP chỉ `127.0.0.1` (không Cloudflare, không cookie) cho người đã có ChatGPT connector.

- Cộng: gần data plane C2C mà không public URL.
- Trừ: OAuth + 9 tool là một subsystem riêng.

**C = slice 7 tùy chọn**, không nằm trong 3 slice đầu. Chỉ làm khi người dùng hỏi.

## 5. Nguyên tắc bất biến

1. Planner ≠ harness. `routeRole("plan"|"review")` không được trả `HarnessId`.
2. Tin nhắn điều khiển `[C2X]` / `[C2C]` không chứa thân file, diff đầy đủ, hay log. Ngân sách ~1 KB / ~1200 token (`assertControlBudget`).
3. Mặt dữ liệu = packer (PLAN) + bản ghi local / prompt dán đã lọc (REVIEW). Không MCP ghi. Không cookie. Không reverse-proxy.
4. Harness là writer duy nhất (edit / shell / test / git). C2X không sửa repo hộ.
5. Đội = tập hợp khác rỗng của `HARNESS_IDS`. Một harness vẫn hợp lệ.
6. Brief của harness A không được đưa cho harness B.
7. Thêm harness = thêm id vào `HARNESS_IDS` + catalog + `never` switch. Không có plugin động trong các slice này.
8. Dashboard không nhận path tùy ý từ trình duyệt (tránh đọc ổ đĩa qua Next). Workspace root chỉ từ `cwd` process, `C2X_WORKSPACE`, `--cwd` CLI, hoặc `AppConfig.workspaceRoot` trên server.
9. Tiếng Việt là ngôn ngữ UI/docs mặc định; id protocol và catalog giữ English.

## 6. Vòng lặp đầy đủ (sau slice 1–2)

```
INIT
  → (paste) copy pastePrompt → chat web → dán [C2X] PLAN
  → (api/mock) completePlanner / mockPlanFromPack
PLAN + PACKETS + briefs[OWNER]
  → mỗi harness chỉ nhận brief của mình (clipboard hoặc file)
  → người dùng chạy tool thật
  → c2x record | dashboard “Ghi nhận từ git”
EXECUTING (từng OWNER) → EXECUTED (gộp metadata)
  → (paste) copy reviewPastePrompt → cùng chat web → dán DONE|PLAN|BLOCKED
  → (api) completePlanner review
  → (mock) mockReview từ metadata
REVIEW → PLAN | DONE | BLOCKED
```

`webChatTurns = 2` chỉ đúng khi cả PLAN và REVIEW đi qua chat web. Slice 1 bắt buộc sửa `runReview` cho planner dán: **không** `mockReview` lặng lẽ.

### 6.1 Import một khối điều khiển

Thêm `importControlMessage({ sessionId, raw })` trong `src/core/run-loop.ts`:

| STATE nhập | Session hiện tại | Hành vi |
| --- | --- | --- |
| `PLAN` | `INIT` hoặc chưa có `plan` | như `importPlan` hiện tại |
| `DONE` / `BLOCKED` | `EXECUTED` hoặc `REVIEW` | ghi `review`, chuyển state |
| `PLAN` | `EXECUTED` hoặc `REVIEW` | iteration mới: `applyPlan`, reset `harnessRuns` về `pending` |
| khác | — | lỗi rõ |

`POST /api/import-plan` gọi hàm mới (giữ URL). Dashboard: **một** ô nhập chấp nhận mọi khối `[C2X]`.

### 6.2 Prompt review (mặt dữ liệu, không phải control message)

`buildReviewPastePrompt` (mới, cạnh `buildWebPastePrompt`):

- `PLANNER_SYSTEM_PROMPT` + `GOAL` + `CHANGED_FILES` + `TESTS` + `DIFF_STAT` (nếu có) + `PACKED TREE`
- Không nhét thân file hay `git diff` đầy đủ vào khối `[C2X]` mẫu
- Yêu cầu trả đúng `[C2X]` với `STATE: DONE|PLAN|BLOCKED`, cùng `TASK_ID`

Prompt này được phép dài hơn 1 KB (đây là mặt dữ liệu, giống `pastePrompt` lúc PLAN). Khối trả về vẫn phải qua `assertControlBudget`.

### 6.3 Trường session mới (slice 1)

```ts
reviewPastePrompt: string | null;
```

`createSession` / `normalizeSession`: mặc định `null`. Session JSON cũ không có field này vẫn load được.

## 7. Workspace và bản ghi thực thi (slice 2)

Mặt dữ liệu local thay MCP. Control message `EXECUTED` chỉ giữ số file + chuỗi test + `HARNESS_TEAM` như hiện tại.

```ts
export const EXECUTION_EXIT_STATUSES = ["ok", "fail", "unknown"] as const;
export type ExecutionExitStatus = (typeof EXECUTION_EXIT_STATUSES)[number];

export type ExecutionRecord = {
  taskId: string;
  iteration: number;
  owner: HarnessId;
  changedFiles: string[];
  tests: string;
  exitStatus: ExecutionExitStatus;
  recordedAt: string;
  diffStat: string;
};
```

- Lưu trên `SessionRecord.records: ExecutionRecord[]` (và mirror vào `harnessRuns`).
- `c2x record --session <id> --owner <HarnessId>` đọc git trong workspace root:
  - `git -C <root> status --porcelain`
  - `git -C <root> diff --stat HEAD`
- Nếu không phải git repo: `changedFiles` lấy từ packet của `OWNER` khi user không truyền `--changed-files`; `diffStat` rỗng; `exitStatus` mặc định `unknown`.
- `completeHarnessRun` nhận record thật, không hard-code `"simulated pass"` khi record có mặt.
- Review paste dùng `mergedExecutionReport` + `diffStat` đã gộp.

Workspace root (thứ tự): `--cwd` CLI → `process.env.C2X_WORKSPACE` → `config.workspaceRoot` → `process.cwd()`.  
`loadWorkspaceFiles("demo")` giữ fixture Nhiệm vụ. `"repo"` đi qua root đã resolve.  
Đọc `.c2xignore` (cú pháp một dòng / glob đơn giản, tái sử dụng `isIgnoredPath`).  
Alias env: `C2X_DATA_DIR` và `FRUGAL_DATA_DIR` (giữ tên cũ).

`collectGitMetadata(root)` spawn `git`; test dùng repo tạm (`mkdtemp` + `git init`). Không mock network.

Dashboard **không** có ô path. Nút “Ghi nhận từ git” gọi `POST /api/record` trên server root. An toàn hơn picker từ browser.

## 8. Adapter harness (slice 3)

Không phải runner tự sửa code. Adapter chỉ **detect + ghi brief + gợi ý lệnh**.

```ts
export type HarnessDetectResult = {
  id: HarnessId;
  ok: boolean;
  binary: string | null;
  hintVi: string;
  hintEn: string;
};

export function detectHarness(id: HarnessId): Promise<HarnessDetectResult>;
export function writeHarnessBrief(
  session: SessionRecord,
  owner: HarnessId,
  dataDir: string,
): Promise<string>; // absolute path
```

Binary dò trên `PATH` (theo thứ tự, dừng khi thấy):

| `HarnessId` | Binary |
| --- | --- |
| `codex` | `codex` |
| `claude-code` | `claude` |
| `grok-build` | `grok`, `grok-build` |
| `opencode` | `opencode` |
| `kiro-cli` | `kiro` |

Nếu không thấy binary: `ok: false`, hint “sao chép brief vào tool đó”. `grok-build` được phép mãi `ok: false` — vẫn là harness hợp lệ.

Ghi file: `<dataDir>/briefs/<taskId>.<owner>.c2x.md` với `renderCodexBrief`.  
Mặc định **không** `spawn` Codex/Claude/Grok/OpenCode/Kiro từ process C2X (Next server không được đẻ harness). `--spawn` không nằm trong slice 3.

`c2x doctor` in 5 dòng detect.  
`c2x brief --session <id> --owner <id>` ghi file và in path.  
`c2x skill install` copy `skill/SKILL.md` → `~/.codex/skills/chat-to-x/SKILL.md` và thay dòng `replace-with-absolute-path`. Không tự cài vào thư mục Claude/OpenCode/Kiro trừ khi user duyệt thêm sau.

## 9. Packet tổng quát (slice 4 — sau 3 slice đầu)

`packetActions` / `packetTests` / `packetCriteria` trong `src/core/packets.ts` đang nói `createTask` và empty-state. Fallback mock phải thành generic:

- `implement`: sửa nhỏ nhất đúng goal; không đụng file test của owner khác.
- `test`: chỉ module test trong packet; chạy test hẹp.
- `general`: goal + file trong packet.

Packet do planner web/API trả về **thắng** heuristic. `parsePlannerOutput` đã fallback packet mock khi `PACKETS` trống — giữ. Thêm `assertPacketsForTeam(plan, team)`:

- mọi `owner` ∈ team;
- file không chồng (`packetsHaveDisjointFiles`);
- mỗi packet có ≥1 action.

Nếu planner trả packet chồng file: C2X không tự merge thầm. Import vẫn nhận PLAN, gắn `risks` thêm một dòng, dashboard hiện cảnh báo. Harness vẫn chỉ thấy brief của mình.

## 10. CLI, bin, checkpoint (slice 5–6)

Slice 5: `package.json` thêm `"bin": { "c2x": "src/cli/c2x.ts" }` (shebang `tsx` đã có). Giữ `"private": true` cho đến khi user quyết định publish npm. Lệnh mới: `import`, `review-prompt`, `record`, `brief`, `doctor`, `sessions`.

Slice 6: `maxIterations` mặc định 12 trên session; `HANDOFF` encode từ checkpoint local (`goal`, `state`, `iteration`, `issues`, `next step`) — không dump log. Ngoài 3 slice đầu.

## 11. Không làm (YAGNI cho đợt này)

- OAuth, pairing code, Cloudflare tunnel, ChatGPT connector, Computer Use.
- MCP ghi / shell / commit.
- Spawn harness mặc định từ dashboard.
- Path picker trong browser.
- Plugin harness động / marketplace.
- Đo token nhà cung cấp thật (sổ vẫn là ước tính).
- Đổi visibility GitHub.
- Viết lại packer hay router.

## 12. Thứ tự slice

Mỗi slice ra phần mềm chạy + test. Không “làm platform một lần”.

| # | Slice | Vì sao trước |
| --- | --- | --- |
| 1 | Đóng vòng dán PLAN + REVIEW | Mục tiêu 2 đang hở; `webChatTurns` sai; ít phụ thuộc |
| 2 | Workspace root + `record` + git metadata | Review không tin claim; mục tiêu 1 có số thật |
| 3 | Adapter detect + ghi brief + `doctor` | Mục tiêu 3–4 từ catalog → runtime; không spawn |
| 4 | Packet heuristic generic + cảnh báo chồng file | Bỏ hard-code demo |
| 5 | CLI đủ vòng + `bin` | OSS dùng được ngoài `npm run` |
| 6 | Checkpoint + `HANDOFF` + `maxIterations` | Protocol đủ, resume |
| 7 | MCP loopback tùy chọn | Chỉ khi user muốn connector local |

Phụ thuộc: 2 cần session/import của 1; 3 cần brief đã có (đã có) và `dataDir` của 2; 4 độc lập nhưng nên sau khi vòng dán ổn; 5 gói CLI của 1–3; 6 sau session ổn định.

## 13. Kiểm thử

Giữ vitest `src/core/__tests__/**/*.test.ts`. Mỗi slice thêm file test riêng, không nới lỏng test router/packets.

- Slice 1: `review-paste.test.ts` — prompt có `TASK_ID`, không có thân file; paste planner không `DONE` nếu chưa import; import `DONE` đổi state.
- Slice 2: `records.test.ts` + `workspace-root.test.ts` — repo git tạm; `.c2xignore`; control `EXECUTED` không chứa diff body.
- Slice 3: `harness-detect.test.ts` — exhaustive `HARNESS_IDS`; brief path; thiếu binary không throw.

Dashboard: không bắt buộc Playwright trong 3 slice đầu. Verify tay: dán PLAN, dán REVIEW, ghi nhận lane. CLI: lệnh mới in ra stdout.

## 14. Rủi ro

| Rủi ro | Cách giữ |
| --- | --- |
| Làm đợt này thành fork C2C | Spec đã loại A; slice 7 không tự làm |
| Dashboard đọc path client | Cấm; chỉ server root |
| Spawn harness từ Next | Cấm trong slice 3 |
| Packet demo làm hỏng goal thật | Slice 4; mock fallback generic |
| `grok-build` không có CLI | Detect fail vẫn hợp lệ |
| Session JSON cũ | `normalizeSession` default field mới |
| Review paste quá dài | Lọc diff; chỉ `diff --stat` + tree trong prompt; control message vẫn ngắn |

## 15. Câu hỏi đã khóa mặc định

Người dùng có thể đổi trước khi implement. Nếu không nói gì, giữ:

1. **Publish npm:** chưa. `private: true`, chỉ thêm `bin` ở slice 5.
2. **Workspace UI:** không path picker. CLI `--cwd` / `C2X_WORKSPACE`.
3. **Launch harness:** copy + file brief. Không spawn.
4. **MCP:** không trong slice 1–3.
5. **Repo GitHub:** không đổi Private/Public trong plan này.
6. **Packet:** planner thắng; heuristic chỉ fallback; slice 4 mới bỏ copy createTask.

## 16. Tiêu chí xong (sau khi user duyệt và agent implement)

Một người dùng Việt Nam, không cần API key:

1. Chọn `chatgpt-web` (hoặc Claude/Gemini web) + đội ≥2 harness.
2. Copy prompt PLAN, dán `[C2X] PLAN` về, thấy brief từng `OWNER`.
3. Copy đúng một brief vào đúng tool; tool kia không thấy file của đồng đội.
4. `c2x record` (hoặc nút dashboard) ghi file/test theo lane; session `EXECUTING` rồi `EXECUTED`.
5. Copy prompt REVIEW, dán `DONE`/`PLAN`/`BLOCKED` về — **không** bị `mockReview` tự DONE.
6. `c2x doctor` báo harness nào có trên `PATH`.
7. `npm test` xanh; router vẫn cấm plan/review trên harness.

Kế hoạch triển khai: [docs/superpowers/plans/2026-09-12-chat-to-x-features.md](../plans/2026-09-12-chat-to-x-features.md).
