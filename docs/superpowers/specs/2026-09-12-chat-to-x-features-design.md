# chat-to-x — thiết kế tính năng tiếp theo

Ngày: 2026-09-12  
Trạng thái: **đã khóa lựa chọn OSS** (public MIT). Chờ duyệt rồi mới code tính năng.  
Phạm vi: đóng vòng C2X hiện có. Không fork XiaoDuoYa/codex-with-chatgpt. Không triển khai tính năng trong pass này.

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
- Catalog harness `HARNESS_IDS` (5 id) + mảng `HARNESS_CATALOG` / `getHarness` switch. Default team `codex` + `claude-code`, `toggleHarnessInTeam` giữ ít nhất một. **Chưa** phải registry `Record<HarnessId, …>` — UI/CLI đã `map` catalog, nhưng router/`getHarness` vẫn liệt kê 5 case; thêm harness vẫn dễ sót một switch. Xem §17.
- Router: `plan` / `review` **không bao giờ** về harness; `auto` ưu tiên `subscription` → `local` → `api`.
- Packer **đồng bộ** + chặn file nhạy cảm (`.env*`, key, SSH). Walk repo bỏ `node_modules` / `.git` / `.next` (và ignore list hiện có); trần 80 file / 120 KB. **Chưa** có trần thời gian walk. Xem §18.
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
| 4. Chọn 5 harness | Catalog + UI + CLI flags | Adapter runtime = 0. `grok-build` có thể không có binary public. Thêm harness thứ 6 vẫn phải sửa nhiều switch — §17 khóa registry |
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

**C = không nằm trong v1.** Nếu sau này có plan riêng: MCP **chỉ loopback** (`127.0.0.1`), không bắt Cloudflare/OAuth/tunnel của C2C. Không fork bridge vào repo này.

## 5. Nguyên tắc bất biến

1. Planner ≠ harness. `routeRole("plan"|"review")` không được trả `HarnessId`.
2. Tin nhắn điều khiển `[C2X]` / `[C2C]` không chứa thân file, diff đầy đủ, hay log. Ngân sách ~1 KB / ~1200 token (`assertControlBudget`).
3. Mặt dữ liệu = packer (PLAN) + bản ghi local / prompt dán đã lọc (REVIEW). Không MCP ghi. Không cookie. Không reverse-proxy.
4. Harness là writer duy nhất (edit / shell / test / git). C2X không sửa repo hộ.
5. Đội = tập hợp khác rỗng của `HARNESS_IDS`. Một harness vẫn hợp lệ.
6. Brief của harness A không được đưa cho harness B.
7. Thêm harness = **một** entry registry (`HARNESS_BY_ID` + `HARNESS_IDS`) + adapter tùy chọn. UI, CLI, router, mock splitter **không** được có 5 danh sách `switch` trùng. `satisfies Record<HarnessId, …>` (hoặc tương đương) để thiếu variant là lỗi type. Không plugin marketplace / loader động trong v1. Xem §17 và §19.
8. Dashboard **không** nhận filesystem path từ trình duyệt và **không** ghi `workspaceRoot` qua `PUT /api/config`. `repo` = `process.cwd()` của process Next/`c2x` mà người dùng tự mở. CLI mới được `--cwd` / `C2X_WORKSPACE`.
9. Tiếng Việt là ngôn ngữ UI/docs mặc định; id protocol và catalog giữ English.
10. Public MIT: không secret trong git; `npm test` không cần key; không publish tên npm `c2x`; không spawn harness mặc định.
11. **Nhanh (vibe-coding):** packer sync, trần cứng, mặc định workspace demo, mock/planner-dán local (ms), brief tính một lần lúc PLAN, không spawn harness, cache `doctor`/`which`, catalog import trên server — không refetch mỗi click. Xem §18.

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

Workspace root — hai lối, không trộn:

| Lối | Root |
| --- | --- |
| Dashboard / `POST /api/plan` / `POST /api/record` | `demo` → fixture. `repo` → **chỉ** `process.cwd()` của server. Body/query **bị bỏ** nếu có `cwd` / `workspaceRoot`. |
| CLI `c2x` | `--cwd` → `process.env.C2X_WORKSPACE` → `process.cwd()` |

Không thêm `AppConfig.workspaceRoot` settable từ UI (cùng lỗ LFI nếu `PUT /api/config` nhận path).

`loadWorkspaceFiles("demo")` giữ fixture Nhiệm vụ. `"repo"` đi qua root đã resolve như bảng.  
Đọc `.c2xignore` (một dòng / glob đơn giản, tái sử dụng `isIgnoredPath`).  
Alias env data: `C2X_DATA_DIR` rồi `FRUGAL_DATA_DIR` (tên cũ).

`collectGitMetadata(root)` được phép spawn **`git`** (metadata local). Test: repo tạm (`mkdtemp` + `git init`). Không mock network. Không spawn `codex` / `claude` / `opencode` / `kiro` / `grok`.

Dashboard **không** có ô path. Nút “Ghi nhận từ git” gọi `POST /api/record` trên cwd server.

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

Binary **không** sống ở switch thứ hai. `detectHarness` đọc `HARNESS_BY_ID[id].binaries` (thứ tự, dừng khi thấy trên `PATH`). Roster hiện tại (copy vào entry, không copy vào `harness.ts`):

| `HarnessId` | `binaries` |
| --- | --- |
| `codex` | `["codex"]` |
| `claude-code` | `["claude"]` |
| `grok-build` | `["grok", "grok-build"]` |
| `opencode` | `["opencode"]` |
| `kiro-cli` | `["kiro"]` |

Nếu không thấy binary: `ok: false`, hint “sao chép brief vào tool đó”. `grok-build` được phép mãi `ok: false` — vẫn là harness hợp lệ. Cache kết quả detect theo `PATH` (xem §18).

Ghi file: `<dataDir>/briefs/<taskId>.<owner>.c2x.md` với `renderCodexBrief`.  
**Không spawn** Codex / Claude Code / Grok / OpenCode / Kiro từ C2X trong mọi slice của plan này — kể cả flag `--spawn`. Next.js không được đẻ harness. Slice sau (ngoài v1) chỉ được cân nhắc nếu vừa `C2X_ALLOW_HARNESS_SPAWN=1` **và** flag CLI tường minh, **không** bao giờ từ HTTP.

`c2x doctor` in 5 dòng detect.  
`c2x brief --session <id> --owner <id>` ghi file và in path.  
`c2x skill install` copy `skill/SKILL.md` → `~/.codex/skills/chat-to-x/SKILL.md` và thay dòng `replace-with-absolute-path`. Không tự cài vào thư mục Claude/OpenCode/Kiro trừ khi user duyệt thêm sau.

## 9. Packet tổng quát (slice 4 — sau 3 slice đầu)

`packetActions` / `packetTests` / `packetCriteria` trong `src/core/packets.ts` đang nói `createTask` và empty-state. Fallback mock phải thành generic:

- `implement`: sửa nhỏ nhất đúng goal; không đụng file test của owner khác.
- `test`: chỉ module test trong packet; chạy test hẹp.
- `general`: goal + file trong packet.

Packet do planner web/API trả về **thắng** heuristic. Contributor **không** được thêm “smart-split” im lặng (tự cắt/đổi owner khi planner đã ghi `PACKETS`). `parsePlannerOutput` chỉ fallback heuristic khi `PACKETS` trống. Thêm `assertPacketsForTeam(plan, team)`:

- mọi `owner` ∈ team;
- file không chồng (`packetsHaveDisjointFiles`);
- mỗi packet có ≥1 action.

Nếu planner trả packet chồng file: C2X không tự merge thầm. Import vẫn nhận PLAN, gắn `risks` thêm một dòng, dashboard hiện cảnh báo. Harness vẫn chỉ thấy brief của mình.

## 10. CLI, bin, checkpoint (slice 5–6)

Slice 5: `package.json` thêm `"bin": { "chat-to-x": "src/cli/c2x.ts", "c2x": "src/cli/c2x.ts" }` (alias local sau `npm install`). Giữ `"name": "chat-to-x"`, `"private": true` cho đến khi CLI đủ vòng **và** lần publish đầu. **Không** publish unscoped `c2x` (đã có trên npm: CSS→XPath). Docs stranger: `npx chat-to-x` / `npm run c2x`, không `npx c2x`. Lệnh mới: `import`, `review-prompt`, `record`, `brief`, `doctor`, `sessions`.

Slice 6: `maxIterations` mặc định 12 trên session; `HANDOFF` encode từ checkpoint local (`goal`, `state`, `iteration`, `issues`, `next step`) — không dump log. Ngoài 3 slice đầu.

## 11. Không làm (YAGNI / an toàn OSS)

- OAuth, pairing code, Cloudflare tunnel, ChatGPT connector, Computer Use, reverse-proxy ChatGPT.
- Fork code bridge C2C vào repo này.
- MCP ghi / shell / commit. MCP đọc loopback: không trong v1.
- Spawn `codex` / `claude` / `opencode` / `kiro` / `grok` từ C2X (kể cả `--spawn`).
- Path picker / `workspaceRoot` từ browser hoặc `PUT /api/config`.
- Publish npm tên `c2x`.
- Plugin harness động / marketplace / npm plugin loader. Registry **trong repo** (§17) là đủ.
- Đo token nhà cung cấp thật (sổ vẫn ước tính).
- Agent tự flip Private→Public trên GitHub/Origin (người maintain bật tay).
- Viết lại packer hay router.

## 12. Thứ tự slice

Mỗi slice ra phần mềm chạy + test. Không “làm platform một lần”.

| # | Slice | Chặn vòng execute/review? | Vì sao |
| --- | --- | --- | --- |
| 0 | OSS hygiene (NOTICE, CONTRIBUTING, CoC, SECURITY, `.gitignore` `/data/`) | Không | Public MIT; làm song song hoặc trước khi flip visibility |
| R | Catalog registry `Record<HarnessId, …>` + khóa tốc độ walk/doctor | Không | Thêm harness 10 phút; vibe-coding không được chậm. Làm trước hoặc cùng slice 3 — **không** để slice 3 viết switch binary thứ hai |
| 1 | Đóng vòng dán PLAN + REVIEW | — | **Làm trước về tính năng.** Mục tiêu 2 hở; `webChatTurns` sai |
| 2 | `record` + git metadata; CLI `--cwd` | Không | Review không tin claim |
| 3 | Adapter detect + ghi brief + `doctor` | Không | Catalog → runtime; không spawn |
| 4 | Packet heuristic generic; planner thắng | Không | Bỏ hard-code demo; không smart-split |
| 5 | CLI đủ vòng + `bin` `chat-to-x`; vẫn `private: true` | Không | Stranger chạy `npx chat-to-x` sau này |
| 6 | Checkpoint + `HANDOFF` + `maxIterations` | Không | Resume |
| 7 | MCP loopback (plan riêng) | Không | Chỉ khi user xin; không Cloudflare |

Phụ thuộc: 0 độc lập với 1. **R** độc lập với 1; nên trước 3 (adapter đọc catalog). 2 cần import của 1. 3 cần `dataDir` + registry. 5 gói CLI của 1–3. Publish npm **sau** slice 5 + NOTICE, không trước.

## 13. Kiểm thử

Giữ vitest `src/core/__tests__/**/*.test.ts`. Mỗi slice thêm file test riêng, không nới lỏng test router/packets.

- Slice 1: `review-paste.test.ts` — prompt có `TASK_ID`, không có thân file; paste planner không `DONE` nếu chưa import; import `DONE` đổi state.
- Slice 2: `records.test.ts` + `workspace-root.test.ts` — repo git tạm; `.c2xignore`; control `EXECUTED` không chứa diff body.
- Slice 3: `harness-detect.test.ts` — exhaustive `HARNESS_IDS`; brief path; thiếu binary không throw; `binaries` lấy từ catalog, không switch riêng.
- Slice R: `catalog-registry.test.ts` — `HARNESS_CATALOG` / `PROVIDER_CATALOG` khớp `HARNESS_IDS` / `PROVIDER_IDS`; `getHarness` không `find` trên mảng; mock splitter không `switch` theo id cứng.

Dashboard: không bắt buộc Playwright trong 3 slice đầu. Verify tay: dán PLAN, dán REVIEW, ghi nhận lane. CLI: lệnh mới in ra stdout.

## 14. Rủi ro

| Rủi ro | Cách giữ |
| --- | --- |
| Làm đợt này thành fork C2C | Spec đã loại A; slice 7 không tự làm |
| Dashboard / API đọc path client | Cấm; `PUT /api/config` bỏ `workspaceRoot`; `repo` = cwd process |
| Spawn harness từ Next hoặc CLI mặc định | Cấm mọi slice v1; không có `--spawn` |
| `npx c2x` trúng package CSS | Không publish `c2x`; docs dùng `chat-to-x` |
| Lộ session/key khi public | `.gitignore` cả `/data/` trừ `.gitkeep`; `.env*` đã ignore |
| Packet demo làm hỏng goal thật | Slice 4; mock fallback generic |
| `grok-build` không có CLI | Detect fail vẫn hợp lệ |
| Session JSON cũ | `normalizeSession` default field mới |
| Review paste quá dài | Lọc diff; chỉ `diff --stat` + tree trong prompt; control message vẫn ngắn |

## 15. Lựa chọn đã khóa (public MIT OSS)

Nghiên cứu 2026-09-12. Mỗi hàng: phương án loại + **chọn** + vì sao đây là lựa chọn chất lượng cho repo MIT công khai.

### 15.1 Bảng khóa

| Chủ đề | Loại | **Khóa** | Vì sao (OSS) |
| --- | --- | --- | --- |
| Tên npm | Publish ngay; unscoped `c2x` | `"name": "chat-to-x"`, `"private": true` đến khi slice 5 xong. Publish sau: `chat-to-x` (registry 404, 2026-09-12). Fallback moniker: `@chat-to-x/cli`. **Cấm** publish `c2x`. | `c2x@1.0.2` đã là CLI CSS→XPath (BSD, 2015). `npx c2x` của stranger sẽ chạy nhầm tool. `private: true` tránh publish sớm khi CLI chưa đủ vòng. |
| `bin` | Chỉ `c2x` trên npm | Local: `"bin": { "chat-to-x": "src/cli/c2x.ts", "c2x": "src/cli/c2x.ts" }`. Docs: `npm run c2x` / `npx chat-to-x`. Không dạy `npx c2x`. | Alias `c2x` an toàn *sau* `npm install chat-to-x` (bin local). Unscoped `npx c2x` thì không. |
| Attribution | Bỏ qua C2C vì “không fork code” | `LICENSE` MIT (đã có). Thêm `NOTICE`: ý tưởng protocol từ [XiaoDuoYa/codex-with-chatgpt](https://github.com/XiaoDuoYa/codex-with-chatgpt) (MIT), **không** copy OAuth/tunnel. README giữ 1 đoạn attribution. | C2C cũng MIT; ghi nguồn là vệ sinh license, không phải copy bridge. |
| Path dashboard | `<input type=file>` / body `workspaceRoot` | Chỉ `demo` \| `repo`=`process.cwd()`. CLI: `--cwd` / `C2X_WORKSPACE`. HTTP **strip** path. | Footgun LFI: API Next đọc path từ browser = đọc ổ đĩa máy host. Bind `0.0.0.0` hoặc tab độc hại trên localhost đều đủ. Stranger OSS hay mở `next dev` rộng. |
| Spawn harness | Tự `spawn("codex")` khi bấm Execute | **Không spawn** vendor CLI trong v1. Copy brief + `c2x doctor`. Không `--spawn`. | PATH hijack / supply-chain; đốt quota người dùng không chủ ý; Next server đẻ agent. `git` spawn (stat) thì được — không phải harness. |
| MCP | Fork C2C OAuth+Cloudflare | Không trong v1. Sau này: plan riêng, **loopback only**, không bắt tunnel. | First-run OSS phải `npm i && npm test && npm run dev` không Cloudflare/cookie. Đúng C2C: planner ≠ harness, không reverse-proxy ChatGPT. |
| GitHub/Origin | Agent tự Public | Maintainers flip visibility. Slice 0: `CONTRIBUTING.md`, `CODE_OF_CONDUCT.md` (Contributor Covenant 2.1), `SECURITY.md`, badge README. | Community standards GitHub. Không chặn slice 1. |
| Packet | Core “smart-split” lại file planner | Planner (`PACKETS`) thắng. Heuristic **chỉ** khi `PACKETS` trống. Overlap → cảnh báo, không tự cắt. | Contributor dễ “tối ưu” nhầm: chồng file = hai harness sửa một chỗ, mất tính tách hạn mức. |

### 15.2 Mối đe dọa path (dashboard)

```
Browser  --POST /api/plan { workspaceRoot: "/etc" }-->  Next (user's machine)
```

C2X đóng gói file text trong root. Path từ client = đọc tùy ý (secret, SSH, repo khác). OSS public sẽ bị copy nguyên pattern này. **Khóa:** API không đọc field path; UI không có picker.

### 15.3 Vệ sinh repo (slice 0, không chặn slice 1)

- `.gitignore`: `/data/*` + `!/data/.gitkeep` (hiện chỉ `/data/*.json` — `data/briefs/*.c2x.md` sẽ lọt).
- `.env*` ignore; `.env.example` chỉ key rỗng + `OLLAMA_BASE_URL=http://127.0.0.1:11434`. Không `sk-...`.
- `npm test` / vitest: **cấm** đòi `OPENAI_API_KEY` hay mạng provider. Hợp đồng hiện tại giữ.
- `next dev` giữ `--hostname 127.0.0.1` (đã có). Docs: đừng bind LAN trừ khi hiểu lỗ path/key.
- `SECURITY.md`: báo cáo qua GitHub Security Advisory; cấm PR “proxy ChatGPT / lấy cookie”.
- `CONTRIBUTING.md`: `npm test` không key; planner ≠ harness; không smart-split `PACKETS`; **How to add a harness (10 min)** (§19) — một entry registry, không marketplace.

### 15.4 Bằng chứng npm (2026-09-12)

```text
npm view c2x  → name=c2x description="CSS selector to XPath" version=1.0.2
npm view chat-to-x → HTTP 404 (còn trống)
```

## 16. Tiêu chí xong (sau khi user duyệt và agent implement)

Một người dùng Việt Nam, không cần API key:

1. Chọn `chatgpt-web` (hoặc Claude/Gemini web) + đội ≥2 harness.
2. Copy prompt PLAN, dán `[C2X] PLAN` về, thấy brief từng `OWNER`.
3. Copy đúng một brief vào đúng tool; tool kia không thấy file của đồng đội.
4. `c2x record` (hoặc nút dashboard) ghi file/test theo lane; session `EXECUTING` rồi `EXECUTED`.
5. Copy prompt REVIEW, dán `DONE`/`PLAN`/`BLOCKED` về — **không** bị `mockReview` tự DONE.
6. `c2x doctor` báo harness nào có trên `PATH`.
7. `npm test` xanh **không** cần API key; router vẫn cấm plan/review trên harness.
8. Clone public: không có `data/*.json`, không key trong `.env.example`; có `NOTICE` + `SECURITY.md`.
9. Thiếu entry trên `HARNESS_BY_ID` thì `tsc` fail; UI/CLI/router/mock splitter không có `case` id cứng.
10. Bật/tắt harness trên Phòng điều khiển không gọi network (trừ lúc bấm Đóng gói).
11. `workspaceSource: "demo"` + planner `mock`: PLAN xong không đợi mạng; packer không đọc `node_modules`.
12. Walk repo cắt đúng trần 80 file / 120 KB / 250 ms (test unit).

Kế hoạch triển khai: [docs/superpowers/plans/2026-09-12-chat-to-x-features.md](../plans/2026-09-12-chat-to-x-features.md).

Slice tính năng **đầu tiên sau khi duyệt:** Slice 1 (vòng dán PLAN + REVIEW). Slice 0 (OSS hygiene) và Slice R (registry + tốc độ) làm song song, không chặn slice 1.

---

## 17. Catalog registry (trong repo — không marketplace)

Marketplace / plugin loader = chậm và thừa cho v1. Một **module catalog** là nguồn sự thật cho harness (và cùng pattern cho planner).

### 17.1 File — một chỗ ghi roster

| File | Việc |
| --- | --- |
| `src/core/types.ts` | `HARNESS_IDS` / `PROVIDER_IDS` (`as const` → union). `isHarnessId`, `toggleHarnessInTeam` duyệt `HARNESS_IDS`. |
| `src/core/providers/catalog.ts` | **`HARNESS_BY_ID`** + **`PROVIDER_BY_ID`**: `satisfies Record<HarnessId, HarnessCatalogEntry>` và `satisfies Record<ProviderId, ProviderCatalogEntry>`. Derive `HARNESS_CATALOG` / `PROVIDER_CATALOG` bằng `HARNESS_IDS.map((id) => HARNESS_BY_ID[id])`. `getHarness` / `getProvider` = lookup O(1), **không** `find` + switch 5 case. |
| `src/core/harness.ts` (slice 3) | `detectHarness` / `writeHarnessBrief` đọc `getHarness(id)`. Adapter tùy chọn: `src/core/harness-adapters/<id>.ts` chỉ khi detect/ghi brief khác mặc định. |
| `src/core/providers/router.ts` | `executeDecision(id)` gọi `getHarness(id)` — **xóa** `switch` liệt kê 5 id giống nhau. |
| `src/core/packets.ts` | Split theo `team: HarnessId[]` + vai trò theo **vị trí** (implement / middle / test). Cấm `switch (owner) { case "codex": … }`. |
| `src/core/planner.ts` | `mockPlanFromPack` / `buildWebPastePrompt` nhận `team`, stub packet từ team. |
| `src/cli/c2x.ts` | `providers` / `doctor` / `--team` help: `HARNESS_CATALOG.map`. |
| `src/components/studio-client.tsx` | Toggle: `HARNESS_CATALOG.map`. Import module, **không** `GET /api/providers` mỗi lần bật/tắt. |
| `src/components/providers-client.tsx` | Hàng harness từ props server (`getHarnessRows`), không refetch catalog khi toggle. |
| `src/lib/server-data.ts` | Import catalog trên server một lần / request render. |
| `src/app/api/providers/route.ts` | Map catalog + config; không phải nguồn sự thật thứ hai. |
| `src/lib/i18n.ts` | Copy chung (“đội harness”). **Tên** từng tool lấy từ `name` / `nameVi` trên catalog — không list 5 id trong i18n. |

Thiếu key trên `HARNESS_BY_ID` khi đã thêm `HARNESS_IDS` → lỗi TypeScript (`satisfies Record<…>`). Thừa key không thuộc `HarnessId` → lỗi. `never` / `assertNever` vẫn bắt switch **hành vi** (role, protocol state), không bắt roster.

### 17.2 Shape khóa

```ts
export type HarnessCatalogEntry = {
  id: HarnessId;
  name: string;
  nameVi: string;
  blurb: string;
  blurbVi: string;
  quotaVi: string;
  quotaEn: string;
  binaries: readonly string[];
};

export const HARNESS_BY_ID = {
  codex: { id: "codex", /* … */, binaries: ["codex"] },
  "claude-code": { id: "claude-code", /* … */, binaries: ["claude"] },
  "grok-build": { id: "grok-build", /* … */, binaries: ["grok", "grok-build"] },
  opencode: { id: "opencode", /* … */, binaries: ["opencode"] },
  "kiro-cli": { id: "kiro-cli", /* … */, binaries: ["kiro"] },
} satisfies Record<HarnessId, HarnessCatalogEntry>;

export const HARNESS_CATALOG: readonly HarnessCatalogEntry[] = HARNESS_IDS.map(
  (id) => HARNESS_BY_ID[id],
);

export function getHarness(id: HarnessId): HarnessCatalogEntry {
  return HARNESS_BY_ID[id];
}
```

Planner: cùng pattern — `PROVIDER_BY_ID satisfies Record<ProviderId, ProviderCatalogEntry>`. `isWebSubscriptionPlanner` có thể đọc `kind === "subscription"` từ entry thay vì liệt kê 3 id (vẫn được `assertNever` trên `kind`).

### 17.3 Contributor thêm harness

Một PR đủ khi: (1) id trong `HARNESS_IDS`, (2) một object trong `HARNESS_BY_ID`, (3) adapter chỉ nếu cần. Reviewer từ chối PR thêm `case "foo":` vào studio / CLI / router / mock splitter. Chi tiết 10 phút: §19.

---

## 18. Tốc độ (vibe-coding không được chậm)

C2X là mặt điều khiển lúc gõ. Mọi đường mặc định phải xong trong **chục–trăm ms** trên demo; walk repo thật phải **cắt** chứ không “index cả monorepo”.

| Khóa | Giá trị | File / hành vi |
| --- | --- | --- |
| Packer sync | `packWorkspace` **không** `async`, không worker, không spawn ripgrep | `src/core/packer.ts` (đã đúng — giữ) |
| Trần pack | excerpt ≤ 80 dòng; tree ≤ 400 token; budget `clampBudget` 800–16_000 (mặc định 4000) | `packer.ts`, `tokens.ts` |
| Bỏ thư mục nặng | `node_modules`, `.git`, `.next` (+ `dist`/`build`/`coverage`/lockfile như `DEFAULT_IGNORE`) | `src/core/sensitive.ts` |
| Trần walk repo | **80 file**, **120 KB / file**, **≤ 250 ms** wall (hết giờ → dừng, pack phần đã có) | `src/core/workspace.ts` — export `MAX_FILES`, `MAX_BYTES`, `MAX_WALK_MS` |
| Workspace mặc định | `demo` (fixture Nhiệm vụ, 0 I/O đĩa) | dashboard + `runPlan` khi user không chọn `repo` |
| Mock planner | `mockPlanFromPack` thuần, không mạng, không đĩa | `planner.ts` |
| Prompt dán web | `buildWebPastePrompt` / `buildReviewPastePrompt` **local, ms** — không gọi API | `planner.ts` |
| Brief | `planToBriefs` **một lần** lúc PLAN / import PLAN; session giữ `briefs[]`; UI/CLI chỉ đọc | `brief.ts`, `run-loop.ts` |
| Spawn harness | **Không** mặc định. Không `--spawn`. Next không đẻ vendor CLI | §8, §11, §15.1 |
| Cache detect | `detectHarness` / `doctor` cache theo `id` + snapshot `PATH` trong process (Map). Không `which` mỗi click / mỗi lane | `harness.ts` |
| Catalog | Import module trên server / bundle client. Toggle harness = state React. **Cấm** `fetch("/api/providers")` mỗi click | `studio-client.tsx`, `server-data.ts` |
| Test | `npm test` = vitest unit, **không** key, **không** mạng planner. Không Playwright bắt buộc 3 slice đầu | `src/core/__tests__` |

`loadWorkspaceFiles("demo")` phải nhanh hơn walk `repo`. Chọn `repo` trên dashboard = `process.cwd()` của server đã mở — vẫn bị 80 / 120 KB / 250 ms. CLI `--cwd` cùng trần.

Không làm “cho nhanh” bằng cách: index nền, file watcher, embed sqlite, spawn ripgrep, refetch catalog, recomputed briefs mỗi render, hay spawn harness để “preview”.

---

## 19. How to add a harness (10 phút)

Dành cho contributor OSS. Copy vào `CONTRIBUTING.md` (slice 0). Không cần marketplace.

1. **Id.** Thêm `"cursor-cli"` (ví dụ) vào `HARNESS_IDS` trong `src/core/types.ts`. `HarnessId` tự mở rộng.
2. **Một entry.** Trong `src/core/providers/catalog.ts` thêm key khớp id vào `HARNESS_BY_ID`:

   ```ts
   "cursor-cli": {
     id: "cursor-cli",
     name: "Cursor CLI",
     nameVi: "Cursor CLI",
     blurb: "Execution only — edit, shell, test, git. Never plan or review.",
     blurbVi: "Chỉ chạy: sửa file, shell, test, git. Không lập kế hoạch hay review.",
     quotaVi: "Hạn mức harness khan hiếm",
     quotaEn: "Scarce harness quota",
     binaries: ["cursor", "cursor-cli"],
   },
   ```

   `satisfies Record<HarnessId, HarnessCatalogEntry>` đỏ nếu thiếu field hoặc thiếu key.
3. **Adapter (hiếm).** Chỉ tạo `src/core/harness-adapters/cursor-cli.ts` nếu detect/ghi brief khác mặc định (`existsSync` trên `binaries` + `renderCodexBrief`). Default trong `src/core/harness.ts` phải đủ cho CLI thông thường.
4. **Không đụng.** `studio-client.tsx`, `c2x.ts` help, `router.ts`, `packets.ts`, `planner.ts` stub, `i18n` list tên — chúng `map` catalog. Nếu phải sửa các file đó để hiện harness mới → registry chưa xong, sửa registry chứ đừng nhân switch.
5. **Test.** `npx tsc --noEmit && npx vitest run`. Test catalog assert `HARNESS_CATALOG.map((e) => e.id)` === `[...HARNESS_IDS]`. Thêm 1–2 assert nếu binary/hint đặc biệt. Không đòi máy có binary thật.
6. **Docs user-facing (tùy).** README có thể kể tên mới trong bảng vai — không bắt buộc cho typecheck. `NOTICE` / attribution C2C không đổi.

Hết. Không `plugins.json`, không dynamic `import()`, không npm scope plugin.
