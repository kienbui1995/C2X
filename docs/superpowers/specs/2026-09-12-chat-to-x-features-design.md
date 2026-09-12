# chat-to-x — thiết kế tính năng tiếp theo

Ngày: 2026-09-12  
Trạng thái: **đã khóa** (public MIT + cầu nhanh). **v1 đã ship** (plan 2026-09-12). Phần còn lại — Slice L drop `.c2x/briefs/`, polish, MCP loopback tuỳ chọn, OSS launch — một nguồn sự thật: [docs/superpowers/plans/2026-09-12-chat-to-x-next.md](../plans/2026-09-12-chat-to-x-next.md).  
Phạm vi spec: đóng vòng C2X. Không fork XiaoDuoYa/codex-with-chatgpt. Không đổi lựa chọn đã khóa.

## 1. Sản phẩm (không đổi)

chat-to-x (C2X) là mặt điều khiển nhỏ: **chat web nghĩ, harness chạy**.

| Vai | Ai | Hạn mức |
| --- | --- | --- |
| Plan + review | `chatgpt-web`, `claude-web`, `gemini-web` (rồi API / `ollama` / `mock`) | Quota chat lớn / subscription, hoặc token rẻ |
| Execute | Bất kỳ tập hợp `codex` \| `claude-code` \| `grok-build` \| `opencode` \| `kiro-cli` | Mỗi tool chỉ chạy packet `OWNER` của mình |

Lấy ý tưởng từ [XiaoDuoYa/codex-with-chatgpt](https://github.com/XiaoDuoYa/codex-with-chatgpt): não nghĩ ≠ harness. C2C gốc = ChatGPT web + Codex + cầu MCP chỉ-đọc + OAuth + Cloudflare tunnel + Computer Use.

chat-to-x **không** phải bản fork đó. README đã khóa: không reverse-proxy, không lấy cookie, không tunnel. **Giữ triết lý C2C** (`[C2X]` nhỏ, planner nghĩ, harness chạy) — **không** lấy đường chậm của C2C (tunnel Cloudflare, OAuth pairing, Computer Use gõ chat) làm mặc định. Cầu v1 = pack/dán **local, ms**. Xem §20. Repo này thêm packer token, router đa planner, đội harness, và mô hình **tách hạn mức**.

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

**Chọn B cho slice 1–3.** Cầu mặc định = dán local (ms). Không tunnel / OAuth / Computer Use để “cho nhanh” — các thứ đó làm first-run chậm hơn.

### C. Lai: B ngay, MCP loopback (không tunnel) sau

Giống B, cộng tùy chọn MCP chỉ `127.0.0.1` (không Cloudflare, không cookie) cho người đã có ChatGPT connector.

- Cộng: gần data plane C2C mà không public URL.
- Trừ: OAuth + 9 tool là một subsystem riêng.

**C = không nằm trong v1.** First-run OSS **không bao giờ** public tunnel. Nếu sau này có plan riêng: MCP **chỉ loopback** (`127.0.0.1`), không bắt Cloudflare/OAuth/tunnel của C2C. Không fork bridge vào repo này. Bước latency *trước* MCP: drop brief local (§20.3), vẫn không tunnel.

## 5. Nguyên tắc bất biến

1. Planner ≠ harness. `routeRole("plan"|"review")` không được trả `HarnessId`.
2. Tin nhắn điều khiển `[C2X]` / `[C2C]` không chứa thân file, diff đầy đủ, hay log. **Không dump file/diff sang ChatGPT.** Ngân sách **≤ ~1–2k token** (`assertControlBudget` mặc định **1200**, trần cứng `CONTROL_BUDGET_MAX = 2000`). Prompt dán (mặt dữ liệu) dùng pack đã cắt — không đọc thêm file lúc dán.
3. Mặt dữ liệu = packer (PLAN) + bản ghi local / prompt dán đã lọc (REVIEW). Không MCP ghi. Không cookie. Không reverse-proxy.
4. Harness là writer duy nhất (edit / shell / test / git). C2X không sửa repo hộ.
5. Đội = tập hợp khác rỗng của `HARNESS_IDS`. Một harness vẫn hợp lệ.
6. Brief của harness A không được đưa cho harness B.
7. Thêm harness = **một** entry registry (`HARNESS_BY_ID` + `HARNESS_IDS`) + adapter tùy chọn. UI, CLI, router, mock splitter **không** được có 5 danh sách `switch` trùng. `satisfies Record<HarnessId, …>` (hoặc tương đương) để thiếu variant là lỗi type. Không plugin marketplace / loader động trong v1. Xem §17 và §19.
8. Dashboard **không** nhận filesystem path từ trình duyệt và **không** ghi `workspaceRoot` qua `PUT /api/config`. `repo` = `process.cwd()` của process Next/`c2x` mà người dùng tự mở. CLI mới được `--cwd` / `C2X_WORKSPACE`.
9. Tiếng Việt là ngôn ngữ UI/docs mặc định; id protocol và catalog giữ English.
10. Public MIT: không secret trong git; `npm test` không cần key; không publish tên npm `c2x`; không spawn harness mặc định.
11. **Nhanh (vibe-coding):** packer sync, trần cứng, mặc định workspace demo, mock/planner-dán local (ms), brief tính một lần lúc PLAN, không spawn harness, cache `doctor`/`which`, catalog import trên server — không refetch mỗi click. Xem §18.
12. **Cầu harness↔planner phải nhanh** (vibe-coding không chờ bridge chậm): dán/brief local ms; brief từng harness precompute lúc PLAN; `EXECUTED` = metadata (`c2x record`); **tái sử dụng pack** giữa các iteration (không walk repo lại); không spawn ChatGPT hay harness CLI; dashboard/API **chỉ localhost**. Planner API: timeout + budget, fail-fast. Đường chậm C2C không phải mặc định. Xem §20.

## 6. Vòng lặp đầy đủ (sau slice 1–2)

```
INIT
  → (paste) copy pastePrompt → chat web → dán [C2X] PLAN
  → (api/mock) completePlanner / mockPlanFromPack
PLAN + PACKETS + briefs[OWNER]   ← brief precompute một lần; không spawn ChatGPT/harness
  → mỗi harness chỉ nhận brief của mình (clipboard v1; file drop = §20.3)
  → người dùng chạy tool thật
  → c2x record | dashboard “Ghi nhận từ git”   ← EXECUTED = metadata only
EXECUTING (từng OWNER) → EXECUTED (gộp metadata)
  → (paste) copy reviewPastePrompt → cùng chat web → dán DONE|PLAN|BLOCKED
  → (api) completePlanner review   ← timeout + budget, fail-fast
  → (mock) mockReview từ metadata
REVIEW → PLAN | DONE | BLOCKED
      ↑ iteration mới **tái sử dụng session.pack** — không loadWorkspaceFiles / packWorkspace lại
```

`webChatTurns = 2` chỉ đúng khi cả PLAN và REVIEW đi qua chat web. Slice 1 bắt buộc sửa `runReview` cho planner dán: **không** `mockReview` lặng lẽ.

### 6.1 Import một khối điều khiển

Thêm `importControlMessage({ sessionId, raw })` trong `src/core/run-loop.ts`:

| STATE nhập | Session hiện tại | Hành vi |
| --- | --- | --- |
| `PLAN` | `INIT` hoặc chưa có `plan` | như `importPlan` hiện tại |
| `DONE` / `BLOCKED` | `EXECUTED` hoặc `REVIEW` | ghi `review`, chuyển state |
| `PLAN` | `EXECUTED` hoặc `REVIEW` | iteration mới: `applyPlan`, reset `harnessRuns` về `pending`, **giữ nguyên `session.pack`** (không walk repo) |
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

Mặt dữ liệu local thay MCP. Control message `EXECUTED` chỉ giữ số file + chuỗi test + `HARNESS_TEAM` như hiện tại — **metadata only** (`c2x record`). Không thân file, không hunk, không log. Pack cũ trên session được **tái sử dụng** cho REVIEW và PLAN iteration kế (không rewalk).

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

Ghi file: `<dataDir>/briefs/<taskId>.<owner>.c2x.md` với `renderCodexBrief` (kho session C2X, gitignore). Đây **không** phải drop workspace — drop `.c2x/briefs/<harness>.md` là bước latency kế (§20.3), không làm trong v1.  
**Không spawn** Codex / Claude Code / Grok / OpenCode / Kiro **và không spawn ChatGPT** (trình duyệt, Computer Use, `chatgpt` CLI, Playwright vào chat.openai.com) từ C2X trong mọi slice của plan này — kể cả flag `--spawn`. Next.js không được đẻ harness hay chat. Slice sau (ngoài v1) chỉ được cân nhắc spawn harness nếu vừa `C2X_ALLOW_HARNESS_SPAWN=1` **và** flag CLI tường minh, **không** bao giờ từ HTTP. Không bao giờ spawn ChatGPT.

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

- OAuth, pairing code, Cloudflare tunnel, ChatGPT connector, Computer Use, reverse-proxy ChatGPT. **Không** lấy các thứ này làm mặc định “cho nhanh”.
- Fork code bridge C2C vào repo này.
- MCP ghi / shell / commit. MCP đọc loopback: không trong v1. First-run **không** public tunnel.
- Spawn `codex` / `claude` / `opencode` / `kiro` / `grok` từ C2X (kể cả `--spawn`).
- Spawn ChatGPT / trình duyệt / Computer Use / Playwright vào chat web. C2X không tự mở planner.
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
| F | Cầu nhanh: tái sử dụng pack + timeout planner API | Không | Iteration không rewalk; API fail-fast. Cùng slice 1 hoặc ngay sau. Xem §20 |
| 1 | Đóng vòng dán PLAN + REVIEW | — | **Làm trước về tính năng.** Mục tiêu 2 hở; `webChatTurns` sai |
| 2 | `record` + git metadata; CLI `--cwd` | Không | Review không tin claim; EXECUTED = metadata |
| 3 | Adapter detect + ghi brief + `doctor` | Không | Catalog → runtime; không spawn ChatGPT/harness |
| 4 | Packet heuristic generic; planner thắng | Không | Bỏ hard-code demo; không smart-split |
| 5 | CLI đủ vòng + `bin` `chat-to-x`; vẫn `private: true` | Không | Stranger chạy `npx chat-to-x` sau này |
| 6 | Checkpoint + `HANDOFF` + `maxIterations` | Không | Resume |
| L | Drop brief workspace `.c2x/briefs/<harness>.md` + skill đọc | Không | **Next latency — đã chuyển** sang [plan 2026-09-12-next](../plans/2026-09-12-chat-to-x-next.md). Nhanh hơn dán; vẫn không tunnel. §20.3 |
| 7 | MCP loopback (plan riêng) | Không | **Moved** → plan next Chunk M. Chỉ khi user xin; **chỉ** `127.0.0.1`; **không bao giờ** public tunnel cho first-run |

Phụ thuộc: 0 độc lập với 1. **R** độc lập với 1; nên trước 3 (adapter đọc catalog). **F** cùng 1 hoặc ngay sau (import PLAN đã có; timeout API độc lập). 2 cần import của 1. 3 cần `dataDir` + registry. L sau 3, không chặn v1. 5 gói CLI của 1–3. Publish npm **sau** slice 5 + NOTICE, không trước.

## 13. Kiểm thử

Giữ vitest `src/core/__tests__/**/*.test.ts`. Mỗi slice thêm file test riêng, không nới lỏng test router/packets.

- Slice 1: `review-paste.test.ts` — prompt có `TASK_ID`, không có thân file; paste planner không `DONE` nếu chưa import; import `DONE` đổi state.
- Slice 2: `records.test.ts` + `workspace-root.test.ts` — repo git tạm; `.c2xignore`; control `EXECUTED` không chứa diff body.
- Slice 3: `harness-detect.test.ts` — exhaustive `HARNESS_IDS`; brief path; thiếu binary không throw; `binaries` lấy từ catalog, không switch riêng.
- Slice R: `catalog-registry.test.ts` — `HARNESS_CATALOG` / `PROVIDER_CATALOG` khớp `HARNESS_IDS` / `PROVIDER_IDS`; `getHarness` không `find` trên mảng; mock splitter không `switch` theo id cứng.
- Slice F: `fast-link.test.ts` — `importPlan` / import PLAN iteration giữ **cùng** `session.pack` (không walk); `EXECUTED` encode < 1200 token, không hunk; `completePlanner` abort khi hung fetch (`timeoutMs` nhỏ); `package.json` `dev`/`start` chứa `127.0.0.1`.
- Slice L: **không test trong v1.** Khi làm: ghi `.c2x/briefs/<id>.md`, skill đọc, `.gitignore` drop.

Dashboard: không bắt buộc Playwright trong 3 slice đầu. Verify tay: dán PLAN, dán REVIEW, ghi nhận lane. CLI: lệnh mới in ra stdout.

## 14. Rủi ro

| Rủi ro | Cách giữ |
| --- | --- |
| Làm đợt này thành fork C2C | Spec đã loại A; slice 7 không tự làm; §20 cấm tunnel/OAuth/Computer Use làm mặc định |
| “Tunnel cho nhanh” | First-run chậm hơn (OAuth + Cloudflare + Computer Use). Cầu v1 = dán local ms |
| Walk lại repo mỗi iteration | `importControlMessage` / REVIEW→PLAN **tái sử dụng** `session.pack` |
| Planner API treo vibe-coding | `PLANNER_API_TIMEOUT_MS` + `max_tokens`; fail-fast / fallback mock |
| Dump file/diff sang ChatGPT | Control ≤ 2k token; `c2x record` metadata; review paste không `excerpts.content` |
| Dashboard / API đọc path client | Cấm; `PUT /api/config` bỏ `workspaceRoot`; `repo` = cwd process |
| Spawn harness hoặc ChatGPT từ Next/CLI | Cấm mọi slice v1; không `--spawn`; không Computer Use |
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
| Spawn ChatGPT | Computer Use / Playwright / `chatgpt` CLI gõ hộ | **Không spawn** planner. Người dán vào tab đã mở. | Computer Use chậm và giòn; trái “cầu nhanh”; ToS / cookie. |
| Cầu mặc định | Cloudflare tunnel + OAuth pairing + MCP public | **Dán/brief local, ms.** Dashboard/API bind `127.0.0.1`. | Giữ triết lý C2C (`[C2X]` nhỏ) mà không lấy đường chậm. First-run = `npm i && npm test && npm run dev`. |
| Control → ChatGPT | Gửi file / `git diff` đầy đủ | Control **≤ ~1–2k token** (assert 1200, trần 2000). Không dump. Pack đã cắt là mặt dữ liệu PLAN. | ChatGPT phản hồi nhanh hơn; không đốt context; EXECUTED = `c2x record` metadata. |
| Pack iteration | `loadWorkspaceFiles` mỗi vòng REVIEW→PLAN | **Tái sử dụng** `session.pack`. `--repack` không nằm v1. | Vibe-coding iteration 2 không chờ walk monorepo. |
| Planner API | `fetch` không timeout, `max_tokens` bỏ trống | `PLANNER_API_TIMEOUT_MS = 8000`, `PLANNER_API_MAX_TOKENS = 1200`, fail-fast (abort → fallback mock nếu `allowFallback`) | API treo = chết vibe-coding. Paste/mock vẫn ms. |
| MCP | Fork C2C OAuth+Cloudflare | Không trong v1. **Trước MCP:** drop `.c2x/briefs/<harness>.md` (§20.3). Sau: plan riêng, **loopback only**, không bắt tunnel. **Cấm** public tunnel first-run. | First-run OSS phải `npm i && npm test && npm run dev` không Cloudflare/cookie. Đúng C2C: planner ≠ harness, không reverse-proxy ChatGPT. |
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
- `next dev` / `next start` giữ `--hostname 127.0.0.1` (đã có, port `45217`). Docs: đừng bind LAN trừ khi hiểu lỗ path/key. Không ngrok/Cloudflare tunnel như tính năng sản phẩm.
- `SECURITY.md`: báo cáo qua GitHub Security Advisory; cấm PR “proxy ChatGPT / lấy cookie”.
- `CONTRIBUTING.md`: `npm test` không key; planner ≠ harness; không smart-split `PACKETS`; không spawn ChatGPT/harness; cầu = dán local (§20); **How to add a harness (10 min)** (§19) — một entry registry, không marketplace.

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
13. Prompt PLAN/REVIEW và brief từng `OWNER` sinh **local, ms** — không spawn ChatGPT, không tunnel.
14. Import PLAN lần 2 (iteration) **cùng** `pack.tree` / `packedTokens`; không walk lại.
15. `[C2X] EXECUTED` không chứa hunk/`@@`; `c2x record` chỉ metadata.
16. `npm run dev` / `start` bind `127.0.0.1`. Planner API có timeout + `max_tokens` (test hung fetch fail-fast).

Kế hoạch v1 (đã ship): [docs/superpowers/plans/2026-09-12-chat-to-x-features.md](../plans/2026-09-12-chat-to-x-features.md).

Kế hoạch **tiếp theo** (Slice L đầu tiên): [docs/superpowers/plans/2026-09-12-chat-to-x-next.md](../plans/2026-09-12-chat-to-x-next.md).

Slice tính năng v1 **đã xong:** vòng dán PLAN + REVIEW, registry, cầu nhanh pack, `record`, doctor/brief. Slice L (drop `.c2x/briefs/`) **không** nằm v1 — implement trên plan next.

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
| Spawn harness / ChatGPT | **Không** mặc định. Không `--spawn`. Next không đẻ vendor CLI hay trình duyệt chat | §8, §11, §15.1, §20 |
| Tái sử dụng pack | Iteration REVIEW→PLAN và `importPlan` giữ `session.pack` — **cấm** `loadWorkspaceFiles` | `run-loop.ts` — §20.2 |
| Planner API | Timeout 8s + `max_tokens` 1200; abort = fail-fast | `complete.ts` — §20.2 |
| Localhost | `next dev` / `start` `--hostname 127.0.0.1` | `package.json` — §20.2 |
| Cache detect | `detectHarness` / `doctor` cache theo `id` + snapshot `PATH` trong process (Map). Không `which` mỗi click / mỗi lane | `harness.ts` |
| Catalog | Import module trên server / bundle client. Toggle harness = state React. **Cấm** `fetch("/api/providers")` mỗi click | `studio-client.tsx`, `server-data.ts` |
| Test | `npm test` = vitest unit, **không** key, **không** mạng planner. Không Playwright bắt buộc 3 slice đầu | `src/core/__tests__` |
| Cầu planner↔harness | Dán local + brief sẵn + pack tái sử dụng; **không** tunnel/OAuth/Computer Use | §20 (không đụng §18 packer) |

`loadWorkspaceFiles("demo")` phải nhanh hơn walk `repo`. Chọn `repo` trên dashboard = `process.cwd()` của server đã mở — vẫn bị 80 / 120 KB / 250 ms. CLI `--cwd` cùng trần.

Không làm “cho nhanh” bằng cách: index nền, file watcher, embed sqlite, spawn ripgrep, refetch catalog, recomputed briefs mỗi render, spawn harness để “preview”, hay bật Cloudflare tunnel / Computer Use.

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

---

## 20. Cầu nhanh harness ↔ ChatGPT (và planner khác)

Vibe-coding **không được chờ bridge chậm**. §18 khóa packer/UI. Mục này khóa **đường nối** planner (ChatGPT / Claude / Gemini web, rồi API) với đội harness.

### 20.1 Giữ C2C, bỏ đường chậm C2C

Triết lý giữ: khối `[C2X]` nhỏ, planner nghĩ, harness chạy, brief A không sang B.

**Không** lấy mặc định của C2C gốc:

| C2C (chậm / first-run nặng) | C2X v1 (nhanh) |
| --- | --- |
| Cloudflare tunnel (public URL, provision) | Dashboard/API **chỉ** `127.0.0.1` — đã có `next dev --hostname 127.0.0.1 --port 45217` |
| OAuth pairing + ChatGPT connector | Người dán vào tab chat **đã mở**. C2X không đăng nhập hộ |
| Computer Use gõ từng ký tự vào ChatGPT | `buildWebPastePrompt` / brief sinh **local, ms** — user paste một lần |
| MCP tools qua tunnel | Packer local + `c2x record` metadata. MCP loopback = sau, không first-run |

Loại A (§4) đã cấm fork bridge. Đây khóa thêm: **không** “tạm bật tunnel cho tiện”. Tiện thật sự của first-run OSS là `npm i && npm test && npm run dev` rồi copy/paste.

### 20.2 Cầu v1 (khóa — implement ở Slice F, không đổi triết lý)

Mọi hàng dưới là hợp đồng. Paste/brief **đã** pack được ở core; Slice F chốt reuse pack + API fail-fast + budget.

| Khóa | Hành vi | File |
| --- | --- | --- |
| Prompt / brief local, ms | `buildWebPastePrompt`, `buildReviewPastePrompt`, `planToBriefs` **không** gọi mạng, không spawn process. Pack đã có trên session trước khi user mở ChatGPT | `planner.ts`, `brief.ts` (đã có — giữ) |
| Control ≤ ~1–2k token | `[C2X]` / `[C2C]` không thân file, không `git diff` hunk, không log. `CONTROL_BUDGET_DEFAULT = 1200`, `CONTROL_BUDGET_MAX = 2000`. Import PLAN assert trần 2000; `EXECUTED` / brief / `HANDOFF` assert 1200 | `protocol.ts` |
| Không dump sang ChatGPT | Prompt dán PLAN = pack đã cắt (tree + excerpt trần). Review paste = GOAL + CHANGED_FILES + TESTS + DIFF_STAT + TREE — **không** `excerpts[].content`, không diff đầy đủ | `planner.ts` §6.2 |
| Brief precompute lúc PLAN | `planToBriefs` một lần khi `applyPlan` / import PLAN. UI/CLI/`c2x brief` chỉ đọc `session.briefs[OWNER]` | `brief.ts`, `run-loop.ts` |
| EXECUTED = metadata | `c2x record` / `POST /api/record`: porcelain paths + `diff --stat` trên `ExecutionRecord`. Khối `[C2X] EXECUTED` chỉ file count / test string / team — không hunk | §7, `git-meta.ts` |
| Tái sử dụng pack | `importPlan`, `importControlMessage` (PLAN lúc `EXECUTED`/`REVIEW`), `runReview` **cấm** gọi `loadWorkspaceFiles` / `packWorkspace`. Cùng `session.pack` object (hoặc cùng `tree` + `packedTokens` + `excerpts`). `runPlan` = session **mới** = walk một lần. Không `--repack` trong v1 | `run-loop.ts` |
| Không spawn | Không `chatgpt`, không Computer Use, không Playwright chat, không `codex`/`claude`/`opencode`/`kiro`/`grok`. Cầu = clipboard người dùng | §8, §11 |
| Localhost only | `package.json` `dev`/`start` giữ `--hostname 127.0.0.1`. Không bind `0.0.0.0` làm mặc định. Không ship ngrok/Cloudflare như feature | `package.json` |
| Planner API fail-fast | `PLANNER_API_TIMEOUT_MS = 8000`, `PLANNER_API_MAX_TOKENS = 1200` trên mọi `complete*` (`AbortSignal.timeout`, `max_tokens` / tương đương). Treo → abort; `allowFallback` thì mock + `fallbackReason` có `timeout`/`abort`; không thì throw. Paste/mock **không** đi nhánh này | `src/core/providers/complete.ts` |

`completePlanner` hiện không timeout và OpenAI-compat không gửi `max_tokens` — Slice F sửa. Anthropic đã `max_tokens: 1200` — giữ, dùng hằng số chung.

Hằng số khóa:

```ts
export const CONTROL_BUDGET_DEFAULT = 1200;
export const CONTROL_BUDGET_MAX = 2000;
export const PLANNER_API_TIMEOUT_MS = 8_000;
export const PLANNER_API_MAX_TOKENS = 1_200;
```

`assertControlBudget(raw, limit = CONTROL_BUDGET_DEFAULT)`.

### 20.3 Next latency (plan, không build v1)

Dán browser vẫn là điểm chậm còn lại (user ↔ Clipboard ↔ ChatGPT / harness). Bước tiếp **không** phải tunnel.

**Drop brief local** — nhanh hơn paste, vẫn không tunnel:

| Khóa | Giá trị |
| --- | --- |
| Path | `<workspace>/.c2x/briefs/<harness>.md` với `<harness>` ∈ `HARNESS_IDS` (ví dụ `.c2x/briefs/codex.md`) |
| Nội dung | Đúng `renderCodexBrief` của `OWNER` đó — không brief đồng đội |
| Khác `dataDir` | Slice 3 giữ `<dataDir>/briefs/<taskId>.<owner>.c2x.md` (kho session). Drop workspace là bản harness đọc được khi cwd = repo |
| Skill | `skill/SKILL.md` (Codex) và tương đương Claude: đọc `.c2x/briefs/<id-của-mình>.md` nếu có, **không** đọc brief owner khác, **không** plan/review |
| Gitignore | `.c2x/briefs/` (hoặc `.c2x/**` trừ README). Không commit brief |
| Khi ghi | Lúc PLAN / import PLAN (cùng lúc `planToBriefs`). Ghi đè file owner; xóa file owner không còn trong team |
| Không | Tunnel, MCP, spawn harness, path từ browser |

Optional **sau** drop: MCP **chỉ** loopback `127.0.0.1` (slice 7, plan riêng). **Không bao giờ** public tunnel cho first-run. Thứ tự latency: dán v1 → drop file → loopback MCP. Không nhảy cóc lên Cloudflare.

### 20.4 Không làm “cho cầu nhanh”

- OAuth pairing, Cloudflare Quick/Named Tunnel, ChatGPT connector, Computer Use.
- Gửi cả repo / patch đầy đủ vào ChatGPT “cho planner thấy hết”.
- `runPlan` trên session cũ để “refresh context” im lặng (rewalk).
- `fetch` planner không abort.
- Bind dashboard ra LAN/`0.0.0.0` làm mặc định.
- Marketplace plugin để “nối nhanh hơn”.
