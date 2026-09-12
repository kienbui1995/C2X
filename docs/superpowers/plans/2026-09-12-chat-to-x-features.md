# chat-to-x Features Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Đóng vòng C2X thật — chat web làm PLAN *và* REVIEW, harness chỉ execute packet của mình, có bản ghi git/test local — mà không fork OAuth/tunnel của C2C. Cầu harness↔ChatGPT phải **nhanh** (dán/brief local ms); không lấy đường chậm C2C làm mặc định.

**Architecture:** Mặt điều khiển vẫn là khối `[C2X]` ngắn (≤ ~1–2k token). Slice R khóa **một** catalog registry (`HARNESS_BY_ID` / `PROVIDER_BY_ID` `satisfies Record<…>`) và trần tốc độ vibe-coding — UI/CLI/router/mock splitter không nhân 5 switch. Slice F khóa cầu nhanh: tái sử dụng pack giữa iteration, planner API timeout+budget fail-fast, dashboard localhost, không spawn ChatGPT/harness. Slice 1 thêm prompt + import REVIEW cho planner dán. Slice 2 thêm `ExecutionRecord` từ `git status` / `git diff --stat` (dashboard = cwd process; CLI `--cwd`; EXECUTED = metadata). Slice 3 thêm adapter detect/ghi brief đọc **catalog.binaries** (**không** spawn, không switch binary thứ hai). Next latency (không build v1): drop `.c2x/briefs/<harness>.md`. Public MIT: không publish `c2x`, không path từ browser, không marketplace plugin, không public tunnel.

**Tech Stack:** TypeScript, Next.js 16 (dashboard + `src/app/api/*`), Commander CLI `src/cli/c2x.ts`, vitest (`src/core/__tests__/**/*.test.ts`), JSON store `data/` (`FRUGAL_DATA_DIR` / `C2X_DATA_DIR`).

## Global Constraints

- Node.js 20+. Không thêm dependency npm trừ khi một task nói rõ.
- Imports luôn ở đầu file. Switch trên union/enum phải có `default: assertNever(...)`.
- `routeRole("plan"|"review")` không được trả `HarnessId`. Không phá test trong `packets.test.ts` / `router-savings.test.ts`.
- Không OAuth, không Cloudflare tunnel, không cookie, không reverse-proxy ChatGPT, không MCP ghi. MCP loopback không nằm trong v1. **First-run không bao giờ public tunnel.** Không lấy tunnel / OAuth pairing / Computer Use làm mặc định “cho nhanh”.
- Dashboard / `PUT /api/config` / body API **không** nhận filesystem path. `repo` = `process.cwd()` của process user mở. CLI: `--cwd` rồi `C2X_WORKSPACE`. `dev`/`start` bind **`127.0.0.1`**.
- **Cấm spawn** `codex` / `claude` / `opencode` / `kiro` / `grok` / `grok-build` **và** ChatGPT / Computer Use / Playwright chat trong mọi task của plan này. Không thêm `--spawn`. Spawn `git` (metadata) thì được.
- Không publish npm tên `c2x` (đã là CSS→XPath). `package.json` `"name": "chat-to-x"`, giữ `"private": true` đến hết slice 5. Docs stranger: `npx chat-to-x` / `npm run c2x`.
- `npm test` không được đòi API key hay mạng planner. `.env.example` không chứa secret. `/data/*` gitignore (trừ `.gitkeep`).
- Copy UI/docs mặc định tiếng Việt; id protocol (`[C2X]`, `OWNER`, `HARNESS_IDS`) giữ English.
- Session JSON cũ phải `normalizeSession` được (field mới có default).
- Control message không chứa thân file / diff đầy đủ / log. **Không dump file/diff sang ChatGPT.** `CONTROL_BUDGET_DEFAULT = 1200`, `CONTROL_BUDGET_MAX = 2000`. Dùng `assertControlBudget` khi encode `EXECUTED` / brief / PLAN.
- Packet: planner `PACKETS` thắng; không smart-split im lặng.
- **Registry:** một module `src/core/providers/catalog.ts` là nguồn sự thật. `HARNESS_BY_ID satisfies Record<HarnessId, HarnessCatalogEntry>` (planner: `PROVIDER_BY_ID`). `getHarness` / `getProvider` = lookup, không `find` + switch 5 case. Cấm thêm `case "codex":` mới vào studio / CLI / router / `packets.ts`. Không marketplace / `plugins.json` / dynamic `import()`.
- **Tốc độ (packer/UI):** `packWorkspace` sync; `DEFAULT_IGNORE` gồm `node_modules` / `.git` / `.next`; walk `repo` ≤ 80 file / 120 KB / 250 ms; workspace mặc định `demo`; mock + prompt dán local (ms); `planToBriefs` một lần lúc PLAN; không spawn harness; cache detect/`doctor` theo `PATH`; catalog import trên server — cấm `fetch("/api/providers")` mỗi click; `npm test` không key.
- **Cầu nhanh (harness↔planner, spec §20):** paste/brief sinh local ms; brief precompute lúc PLAN; `EXECUTED` = metadata (`c2x record`); **tái sử dụng `session.pack`** giữa iteration (cấm `loadWorkspaceFiles` trên import/review); planner API `PLANNER_API_TIMEOUT_MS = 8000` + `PLANNER_API_MAX_TOKENS = 1200`, fail-fast; dashboard/API localhost. Slice L (`.c2x/briefs/<harness>.md`) **không implement v1**.

Spec: [docs/superpowers/specs/2026-09-12-chat-to-x-features-design.md](../specs/2026-09-12-chat-to-x-features-design.md) — §17 registry, §18 tốc độ, §19 thêm harness 10 phút, **§20 cầu nhanh**.

---

## File structure (khóa trước khi làm)

**Slice 1 — giữ, chỉ mở rộng**

- `src/core/types.ts` — thêm `reviewPastePrompt` trên `SessionRecord`
- `src/core/session.ts` — default + normalize field mới
- `src/core/planner.ts` — `buildReviewPastePrompt`
- `src/core/review-import.ts` — **mới**: parse/apply khối REVIEW; không đụng store
- `src/core/run-loop.ts` — `importControlMessage`; `runReview` không `mockReview` khi planner là paste
- `src/core/index.ts` — export module mới
- `src/app/api/import-plan/route.ts` — gọi `importControlMessage`
- `src/app/api/review/route.ts` — paste → gắn prompt, chưa DONE
- `src/cli/c2x.ts` — `import`, `review-prompt`
- `src/components/studio-client.tsx` + `src/lib/i18n.ts` — copy/import REVIEW
- `src/core/__tests__/review-paste.test.ts` — **mới**

**Slice 2**

- `src/core/types.ts` — `ExecutionRecord` trên session (**không** `AppConfig.workspaceRoot` từ HTTP)
- `src/core/git-meta.ts` — **mới**: porcelain + diff --stat
- `src/core/records.ts` — **mới**: merge record vào session
- `src/core/workspace.ts` — `resolveWorkspaceRoot` (CLI/env/cwd) + `.c2xignore`
- `src/core/sensitive.ts` — đọc extra ignore
- `src/core/store.ts` — `C2X_DATA_DIR`
- `src/app/api/plan/route.ts` + `record/route.ts` — **bỏ** mọi `cwd` / `workspaceRoot` từ body
- `src/app/api/record/route.ts` — **mới**
- `src/cli/c2x.ts` — `record`
- `src/core/__tests__/records.test.ts`, `workspace-root.test.ts` — **mới**

**Slice R — registry + tốc độ (trước hoặc cùng slice 3; không chặn slice 1)**

- `src/core/providers/catalog.ts` — `HARNESS_BY_ID` / `PROVIDER_BY_ID` `satisfies Record<…>`; `binaries` trên harness entry; derive arrays; `getHarness`/`getProvider` lookup
- `src/core/providers/router.ts` — `executeDecision` không liệt kê 5 id
- `src/core/workspace.ts` — export `MAX_FILES` / `MAX_BYTES` / `MAX_WALK_MS`; cắt walk theo thời gian
- `src/core/__tests__/catalog-registry.test.ts` — **mới**
- `src/core/__tests__/workspace-walk.test.ts` — **mới** (trần 80 / 120 KB / 250 ms)

**Slice F — cầu nhanh harness↔planner (cùng slice 1 hoặc ngay sau; spec §20)**

- `src/core/session.ts` — `reusedPack(session)` (ném nếu chưa pack; **không** walk)
- `src/core/run-loop.ts` — `importPlan` / `importControlMessage` / `runReview` dùng `reusedPack`; cấm `loadWorkspaceFiles` trên iteration
- `src/core/protocol.ts` — `CONTROL_BUDGET_DEFAULT` / `CONTROL_BUDGET_MAX`; `encodeControlMessage` assert trần 2000
- `src/core/providers/complete.ts` — `PLANNER_API_TIMEOUT_MS` / `PLANNER_API_MAX_TOKENS`; `AbortSignal`; `max_tokens` trên OpenAI-compat
- `src/core/__tests__/fast-link.test.ts` — **mới**

**Slice L — next latency, không làm v1:** `.c2x/briefs/<harness>.md` + skill đọc. Chi tiết Chunk L.

**Slice 3**

- `src/core/harness.ts` — **mới**: detect + write brief; `binaries` từ `getHarness(id)`, **không** switch binary thứ hai; cache Map theo `PATH`
- `src/cli/c2x.ts` — `doctor`, `brief`
- `src/core/__tests__/harness-detect.test.ts` — **mới**

**Slice 4–7:** `src/core/packets.ts`, `src/core/protocol.ts`, `package.json` `bin` (`chat-to-x` + alias local `c2x`), checkpoint. Chi tiết ở Chunk 4.

**Slice 0 (song song, không chặn Chunk 1):** `NOTICE`, `CONTRIBUTING.md`, `CODE_OF_CONDUCT.md`, `SECURITY.md`, `.gitignore` `/data/*`.

---

## Chunk 0: Slice 0 — vệ sinh OSS (không chặn Slice 1)

Public MIT. Có thể làm trước, cùng lúc, hoặc ngay trước khi maintainers flip visibility. **Không** được trì hoãn Task 1 vì slice này.

### Task 0: NOTICE, community files, ignore `data/`

**Files:**
- Create: `NOTICE`
- Create: `CONTRIBUTING.md`
- Create: `CODE_OF_CONDUCT.md` (Contributor Covenant 2.1, không tự bịa điều khoản)
- Create: `SECURITY.md`
- Modify: `.gitignore` — `/data/*` và `!/data/.gitkeep` (thay `/data/*.json`)
- Modify: `.env.example` — thêm `C2X_WORKSPACE=` và `C2X_DATA_DIR=`; giữ key rỗng; không `sk-`
- Modify: `README.md` — badge MIT + Node 20; attribution C2C; `npm test` không cần key; cảnh báo không `npx c2x` (package CSS)

**Interfaces:** không có API runtime. `NOTICE` phải chứa đoạn English sau (copy nguyên):

```text
chat-to-x (C2X) is inspired by XiaoDuoYa/codex-with-chatgpt
(https://github.com/XiaoDuoYa/codex-with-chatgpt), MIT License.
That project’s idea — ChatGPT (or another web chat) plans and reviews;
the coding harness only executes; control messages stay tiny — is reused
in spirit. This repository is not a fork of its OAuth bridge, Cloudflare
tunnel, or ChatGPT connector. No unofficial ChatGPT reverse-proxy.
```

`SECURITY.md` (rút gọn, bilingual được): báo cáo qua GitHub Security Advisory; **không** mở issue public cho RCE/LFI; từ chối PR thêm reverse-proxy / cookie / tunnel ChatGPT; dashboard bind `127.0.0.1`; không nhận path từ browser.

`CONTRIBUTING.md`: `npm install && npm test && npm run typecheck` không key; planner ≠ harness; không smart-split `PACKETS`; không spawn harness **hay ChatGPT**; cầu mặc định = dán/brief local (spec §20) — **cấm** PR tunnel/OAuth/Computer Use “cho nhanh”; **How to add a harness (10 min)** — copy nguyên §19 spec (id → một entry `HARNESS_BY_ID` → adapter hiếm → không đụng UI/CLI/router/splitter).

- [x] **Step 1: Write a failing check that data briefs would be tracked**

Không cần test runtime. Fail hữu hình: `.gitignore` hiện là `/data/*.json`. Tạo file tạm không commit:

```bash
mkdir -p data/briefs
echo leak > data/briefs/should-not-be-public.c2x.md
git check-ignore -v data/briefs/should-not-be-public.c2x.md
```

Expected hiện tại: không in gì (file **không** bị ignore) — đó là fail của slice 0.

- [x] **Step 2: Confirm ignore fails**

Run lệnh trên. Expected: empty → briefs sẽ lọt nếu public.

- [x] **Step 3: Write the files; fix gitignore**

`.gitignore`:

```gitignore
# local C2X state (sessions, keys, briefs)
/data/*
!/data/.gitkeep
```

Xóa `data/briefs/should-not-be-public.c2x.md` sau khi verify. Không commit `sessions.json`.

- [x] **Step 4: Verify**

```bash
git check-ignore -v data/sessions.json data/briefs/x.c2x.md
# both ignored
test ! -s .env.example || ! grep -E 'sk-|sk-proj-|-----BEGIN' .env.example
npx vitest run
```

Expected: ignore khớp; `.env.example` không chứa secret; tests PASS.

- [x] **Step 5: Commit**

```bash
git add NOTICE CONTRIBUTING.md CODE_OF_CONDUCT.md SECURITY.md .gitignore .env.example README.md
git commit -m "docs: add MIT OSS hygiene and ignore all local C2X data"
```

---

## Chunk R: Slice R — catalog registry + khóa tốc độ

Làm trước slice 3 (adapter). Có thể song song slice 0/1. Mục tiêu: thêm harness = một entry; vibe-coding không walk cả monorepo.

### Task R1: `HARNESS_BY_ID` / `PROVIDER_BY_ID` `satisfies Record`

**Files:**
- Modify: `src/core/providers/catalog.ts`
- Modify: `src/core/providers/router.ts` (`executeDecision`)
- Modify: `src/core/__tests__/packets.test.ts` (catalog describe — assert `HARNESS_BY_ID` + `binaries`)
- Test: `src/core/__tests__/catalog-registry.test.ts`

**Interfaces:**
- Consumes: `HARNESS_IDS`, `PROVIDER_IDS`, `HarnessCatalogEntry` (thêm `binaries: readonly string[]`)
- Produces:

```ts
export const HARNESS_BY_ID: Record<HarnessId, HarnessCatalogEntry>;
export const PROVIDER_BY_ID: Record<ProviderId, ProviderCatalogEntry>;
export const HARNESS_CATALOG: readonly HarnessCatalogEntry[];
export const PROVIDER_CATALOG: readonly ProviderCatalogEntry[];
export function getHarness(id: HarnessId): HarnessCatalogEntry;
export function getProvider(id: ProviderId): ProviderCatalogEntry;
```

`HARNESS_CATALOG = HARNESS_IDS.map((id) => HARNESS_BY_ID[id])` — thứ tự = `HARNESS_IDS`.  
`getHarness` / `getProvider` **không** `find` trên mảng, **không** switch 5/12 case.  
`executeDecision`: `const entry = getHarness(harness); return { role: "execute", provider: harness, reason: \`${entry.name} is the execution harness only: …\`, reasonVi: \`${entry.nameVi} chỉ là harness chạy: …\` };` — TypeScript đã hẹp `HarnessId`; không liệt kê 5 `case`.

`binaries` khóa (copy vào object, không vào `harness.ts`):

- `codex` → `["codex"]`
- `claude-code` → `["claude"]`
- `grok-build` → `["grok", "grok-build"]`
- `opencode` → `["opencode"]`
- `kiro-cli` → `["kiro"]`

- [x] **Step 1: Write the failing test**

`src/core/__tests__/catalog-registry.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import {
  getHarness,
  getProvider,
  HARNESS_BY_ID,
  HARNESS_CATALOG,
  PROVIDER_BY_ID,
  PROVIDER_CATALOG,
} from "@/core/providers/catalog";
import { HARNESS_IDS, PROVIDER_IDS } from "@/core/types";
import { routeExecuteTeam, routeRole } from "@/core/providers/router";
import { mergeConfig } from "@/core/config";
import { assignPacketRoles, splitWorkPackets } from "@/core/packets";

describe("catalog registry", () => {
  it("covers every HarnessId and ProviderId without a second list", () => {
    expect(HARNESS_CATALOG.map((entry) => entry.id)).toEqual([...HARNESS_IDS]);
    expect(PROVIDER_CATALOG.map((entry) => entry.id)).toEqual([...PROVIDER_IDS]);
    for (const id of HARNESS_IDS) {
      expect(getHarness(id)).toBe(HARNESS_BY_ID[id]);
      expect(HARNESS_BY_ID[id].id).toBe(id);
      expect(HARNESS_BY_ID[id].binaries.length).toBeGreaterThan(0);
    }
    for (const id of PROVIDER_IDS) {
      expect(getProvider(id)).toBe(PROVIDER_BY_ID[id]);
      expect(PROVIDER_BY_ID[id].id).toBe(id);
    }
    expect(HARNESS_BY_ID["grok-build"].binaries).toEqual(["grok", "grok-build"]);
    expect(HARNESS_BY_ID["kiro-cli"].binaries).toEqual(["kiro"]);
  });

  it("routes execute from catalog names and never lists harnesses as planners", () => {
    const config = mergeConfig({
      enabledProviders: ["mock", "chatgpt-web"],
      defaultHarnessTeam: [...HARNESS_IDS],
    });
    for (const id of HARNESS_IDS) {
      const decision = routeRole({
        role: "execute",
        choice: "auto",
        harness: id,
        config,
        hasKey: () => false,
      });
      expect(decision.provider).toBe(id);
      expect(decision.reason).toContain(getHarness(id).name);
    }
    expect(routeExecuteTeam([...HARNESS_IDS]).map((item) => item.provider)).toEqual([
      ...HARNESS_IDS,
    ]);
    for (const role of ["plan", "review"] as const) {
      const decision = routeRole({
        role,
        choice: "auto",
        config,
        hasKey: () => false,
      });
      expect(HARNESS_IDS).not.toContain(decision.provider);
    }
  });

  it("splits packets by team position, not by named harness id", () => {
    const files = ["src/a.ts", "src/a.test.ts"];
    const packets = splitWorkPackets({
      team: ["opencode", "kiro-cli"],
      files,
      goal: "Add a dark mode toggle",
      taskId: "c2x_reg",
    });
    expect(packets.map((packet) => packet.owner)).toEqual(["opencode", "kiro-cli"]);
    expect(assignPacketRoles(["kiro-cli"])).toEqual([{ owner: "kiro-cli", role: "general" }]);
    expect(packets[0]?.actions.join(" ")).not.toMatch(/createTask/i);
  });
});
```

- [x] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/core/__tests__/catalog-registry.test.ts`

Expected: FAIL — `HARNESS_BY_ID` / `binaries` chưa export.

- [x] **Step 3: Write minimal implementation**

1. Đổi `HarnessCatalogEntry` thêm `binaries: readonly string[]`.
2. Thay mảng `HARNESS_CATALOG = [` bằng:

```ts
export const HARNESS_BY_ID = {
  // existing fields + binaries per spec §17.2
} satisfies Record<HarnessId, HarnessCatalogEntry>;

export const HARNESS_CATALOG: readonly HarnessCatalogEntry[] = HARNESS_IDS.map(
  (id) => HARNESS_BY_ID[id],
);
```

Cùng pattern `PROVIDER_BY_ID` / `PROVIDER_CATALOG` từ các object hiện có (không đổi copy blurb).

3. `getHarness`:

```ts
export function getHarness(id: HarnessId): HarnessCatalogEntry {
  return HARNESS_BY_ID[id];
}
```

`getProvider` tương tự. Xóa `switch (id) { case "codex": … find … }`.

4. `isWebSubscriptionPlanner`: `return getProvider(id).kind === "subscription";` (vẫn hẹp type bằng `id is WebSubscriptionPlanner` — nếu `kind` chưa đủ, giữ switch **planner** nhưng không liệt kê harness).

5. `executeDecision`: bỏ 5 `case`; dùng `getHarness(harness)` cho reason.

Import `HARNESS_IDS` / `PROVIDER_IDS` ở **đầu** `catalog.ts`.

- [x] **Step 4: Run tests**

```bash
npx vitest run src/core/__tests__/catalog-registry.test.ts src/core/__tests__/packets.test.ts src/core/__tests__/router-savings.test.ts
npx tsc --noEmit
```

Expected: PASS. `packets.test.ts` "lists five first-class…" vẫn đúng vì `HARNESS_CATALOG.map` theo `HARNESS_IDS`.

- [x] **Step 5: Commit**

```bash
git add src/core/providers/catalog.ts src/core/providers/router.ts src/core/__tests__/catalog-registry.test.ts src/core/__tests__/packets.test.ts
git commit -m "refactor: make harness and planner catalogs a typed Record registry"
```

### Task R2: Trần walk + hằng số tốc độ

**Files:**
- Modify: `src/core/workspace.ts`
- Test: `src/core/__tests__/workspace-walk.test.ts`

**Interfaces:**

```ts
export const MAX_FILES = 80;
export const MAX_BYTES = 120_000;
export const MAX_WALK_MS = 250;

export async function loadWorkspaceFiles(
  source: WorkspaceSource,
  now?: () => number,
): Promise<WorkspaceFile[]>;
```

`now` chỉ để test (mặc định `Date.now`). Walk `repo`: nếu `now() - started >= MAX_WALK_MS` thì `return` (giữ file đã thu). Vẫn skip `isIgnoredPath` (`node_modules` / `.git` / `.next`). `demo` **không** walk đĩa — trả `DEMO_FILES`. Không đổi `packWorkspace` thành async.

- [x] **Step 1: Write the failing test**

```ts
import { describe, expect, it } from "vitest";
import { DEMO_FILES } from "@/core/fixtures/demo-workspace";
import {
  loadWorkspaceFiles,
  MAX_BYTES,
  MAX_FILES,
  MAX_WALK_MS,
} from "@/core/workspace";
import { isIgnoredPath } from "@/core/sensitive";

describe("workspace speed caps", () => {
  it("exports hard caps and keeps demo off disk", async () => {
    expect(MAX_FILES).toBe(80);
    expect(MAX_BYTES).toBe(120_000);
    expect(MAX_WALK_MS).toBe(250);
    expect(isIgnoredPath("node_modules/foo/index.js")).toBe(true);
    expect(isIgnoredPath(".git/config")).toBe(true);
    expect(isIgnoredPath(".next/cache/x")).toBe(true);
    const files = await loadWorkspaceFiles("demo");
    expect(files).toEqual(DEMO_FILES);
  });

  it("stops a repo walk when the clock hits MAX_WALK_MS", async () => {
    let t = 0;
    const files = await loadWorkspaceFiles("repo", () => {
      t += 300;
      return t;
    });
    expect(files.length).toBeLessThanOrEqual(MAX_FILES);
    expect(files.length).toBeLessThanOrEqual(8);
  });
});
```

(Assert `length <= 8` vì clock nhảy 300ms ngay entry đầu — walk phải dừng sớm, không đọc cả cwd Cloud Agent.)

- [x] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/core/__tests__/workspace-walk.test.ts`

Expected: FAIL — `MAX_WALK_MS` / `now` chưa có.

- [x] **Step 3: Write minimal implementation**

Export 3 hằng (thay `const MAX_FILES` / `MAX_BYTES` hiện tại). `walk` nhận `started` + `now`:

```ts
async function walk(
  dir: string,
  root: string,
  acc: string[],
  started: number,
  now: () => number,
): Promise<void> {
  if (acc.length >= MAX_FILES || now() - started >= MAX_WALK_MS) {
    return;
  }
  // existing readdir loop; same early-return checks before each entry
}
```

`loadWorkspaceFiles`: `const clock = now ?? Date.now`; `demo` → `DEMO_FILES`; `repo` → `walk(..., Date.now(), clock)`.

- [x] **Step 4: Run tests**

```bash
npx vitest run src/core/__tests__/workspace-walk.test.ts src/core/__tests__/packer.test.ts
npx tsc --noEmit
```

Expected: PASS. Packer test không đụng walk.

- [x] **Step 5: Commit**

```bash
git add src/core/workspace.ts src/core/__tests__/workspace-walk.test.ts
git commit -m "perf: cap repo walks at 80 files, 120KB, and 250ms"
```

---

## Chunk F: Slice F — cầu nhanh harness↔planner (spec §20)

Giữ triết lý C2C (`[C2X]` nhỏ, planner nghĩ, harness chạy). **Không** lấy tunnel / OAuth / Computer Use làm mặc định. Làm trước hoặc cùng Slice 1 (`reusedPack` được Task 3 dùng). Không spawn ChatGPT hay harness.

### Task F1: `reusedPack` — iteration không walk repo

**Files:**
- Modify: `src/core/session.ts` (`reusedPack`)
- Modify: `src/core/run-loop.ts` (`importPlan` dùng `reusedPack`)
- Test: `src/core/__tests__/fast-link.test.ts`

**Interfaces:**
- Consumes: `SessionRecord.pack`
- Produces:

```ts
export function reusedPack(session: SessionRecord): ContextPack;
```

Ném `Error` có chữ `pack` / `reuse` nếu `session.pack` null. **Không** gọi `loadWorkspaceFiles` hay `packWorkspace`.  
`importPlan` đổi `const pack = existing?.pack` thành `reusedPack(existing)` sau khi đã có `existing`.

- [x] **Step 1: Write the failing test**

`src/core/__tests__/fast-link.test.ts`:

```ts
import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { reusedPack } from "@/core/session";
import { importPlan, runPlan } from "@/core/run-loop";
import * as workspace from "@/core/workspace";

let dataDir = "";

beforeEach(async () => {
  dataDir = await mkdtemp(path.join(os.tmpdir(), "c2x-fast-"));
  process.env.FRUGAL_DATA_DIR = dataDir;
});

afterEach(async () => {
  delete process.env.FRUGAL_DATA_DIR;
  await rm(dataDir, { recursive: true, force: true });
  vi.restoreAllMocks();
});

describe("reusedPack", () => {
  it("returns the existing pack and importPlan does not walk the repo", async () => {
    const session = await runPlan({
      goal: "Sửa createTask",
      plannerChoice: "chatgpt-web",
      harnessTeam: ["codex"],
      budgetTokens: 2000,
      workspaceSource: "demo",
    });
    expect(session.pack).not.toBeNull();
    expect(reusedPack(session)).toBe(session.pack);

    const walk = vi.spyOn(workspace, "loadWorkspaceFiles");
    const next = await importPlan({
      sessionId: session.id,
      raw: `[C2X]
STATE: PLAN
TASK_ID: ${session.id}
ITERATION: 1

GOAL:
Sửa createTask

RATIONALE:
Reuse the packed tree.

ACTIONS:
1. Fix createTask persistence.

FILES_LIKELY_INVOLVED:
- src/lib/tasks.ts

TESTS:
- unit

SUCCESS_CRITERIA:
- tasks persist

RISKS:
- none

PACKETS:
  ## owner=codex role=general
  ACTIONS:
  1. Fix createTask persistence.
  FILES:
  - src/lib/tasks.ts
  TESTS:
  - unit
  SUCCESS_CRITERIA:
  - persist
`,
    });
    expect(walk).not.toHaveBeenCalled();
    expect(next.pack).toBe(session.pack);
    expect(next.pack?.tree).toBe(session.pack?.tree);
    expect(next.pack?.packedTokens).toBe(session.pack?.packedTokens);
  });

  it("throws when the session was never packed", async () => {
    const session = await runPlan({
      goal: "Sửa createTask",
      plannerChoice: "chatgpt-web",
      harnessTeam: ["codex"],
      budgetTokens: 2000,
      workspaceSource: "demo",
    });
    expect(() => reusedPack({ ...session, pack: null })).toThrow(/pack|reuse/i);
  });
});
```

Nếu `vi.spyOn` không chặn ESM import đã bind, `expect(next.pack).toBe(session.pack)` vẫn là hợp đồng — đừng bỏ assertion đó.

- [x] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/core/__tests__/fast-link.test.ts`

Expected: FAIL — `reusedPack` chưa export.

- [x] **Step 3: Write minimal implementation**

Trong `src/core/session.ts` thêm `ContextPack` vào import type từ `@/core/types` ở **đầu** file:

```ts
export function reusedPack(session: SessionRecord): ContextPack {
  if (!session.pack) {
    throw new Error("Session has no pack to reuse; do not walk the repo.");
  }
  return session.pack;
}
```

Trong `importPlan` (`run-loop.ts`), import `reusedPack` ở **đầu** file (cùng import `createSession` / `applyPlan`):

```ts
  const existing = input.sessionId ? await getSession(input.sessionId) : null;
  if (!existing) {
    throw new Error("Import needs an existing packed session. Run plan first.");
  }
  const pack = reusedPack(existing);
```

Xóa nhánh `existing?.pack` / `if (!existing || !pack)`. Không thêm `loadWorkspaceFiles`.

Export `reusedPack` từ `src/core/index.ts` nếu file đó re-export session.

- [x] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/core/__tests__/fast-link.test.ts src/core/__tests__/router-savings.test.ts`

Expected: PASS

- [x] **Step 5: Commit**

```bash
git add src/core/session.ts src/core/run-loop.ts src/core/index.ts src/core/__tests__/fast-link.test.ts
git commit -m "perf: reuse the packed workspace between C2X iterations"
```

### Task F2: Planner API timeout + budget, fail-fast

**Files:**
- Modify: `src/core/providers/complete.ts`
- Test: `src/core/__tests__/fast-link.test.ts`

**Interfaces:**
- Consumes: `completePlanner`, `fetch`
- Produces:

```ts
export const PLANNER_API_TIMEOUT_MS = 8_000;
export const PLANNER_API_MAX_TOKENS = 1_200;

export async function completePlanner(input: {
  provider: ProviderId;
  config: AppConfig;
  messages: ChatMessage[];
  allowFallback?: boolean;
  timeoutMs?: number;
}): Promise<CompletionResult>;
```

Mọi `fetch` planner (OpenAI-compat, Anthropic, Gemini) dùng `signal: AbortSignal.timeout(input.timeoutMs ?? PLANNER_API_TIMEOUT_MS)`.  
Body OpenAI-compat thêm `max_tokens: PLANNER_API_MAX_TOKENS` (Anthropic đổi literal `1200` → hằng số).  
Treo → abort; `allowFallback` (mặc định true) → `usedFallback: true`, `fallbackReason` khớp `/timeout|abort/i`; `allowFallback: false` → throw.  
Paste/mock **không** `fetch`.

- [x] **Step 1: Write the failing test**

Thêm vào `fast-link.test.ts`:

```ts
import { mergeConfig } from "@/core/config";
import {
  PLANNER_API_MAX_TOKENS,
  PLANNER_API_TIMEOUT_MS,
  completePlanner,
} from "@/core/providers/complete";

describe("planner API fail-fast", () => {
  it("exports an 8s timeout and 1200-token completion budget", () => {
    expect(PLANNER_API_TIMEOUT_MS).toBe(8_000);
    expect(PLANNER_API_MAX_TOKENS).toBe(1_200);
  });

  it("aborts a hung OpenAI-compatible fetch instead of waiting", async () => {
    const prev = globalThis.fetch;
    globalThis.fetch = () => new Promise(() => {});
    const started = Date.now();
    const result = await completePlanner({
      provider: "openai",
      config: mergeConfig({ keys: { openai: "sk-test" } }),
      messages: [{ role: "user", content: "ping" }],
      allowFallback: true,
      timeoutMs: 40,
    });
    globalThis.fetch = prev;
    expect(Date.now() - started).toBeLessThan(800);
    expect(result.usedFallback).toBe(true);
    expect(result.fallbackReason ?? "").toMatch(/timeout|abort/i);
  });

  it("does not fetch for paste planners", async () => {
    const prev = globalThis.fetch;
    let called = 0;
    globalThis.fetch = async () => {
      called += 1;
      return new Response("{}");
    };
    const result = await completePlanner({
      provider: "chatgpt-web",
      config: mergeConfig(),
      messages: [{ role: "user", content: "ping" }],
    });
    globalThis.fetch = prev;
    expect(called).toBe(0);
    expect(result.text).toBe("");
    expect(result.usedFallback).toBe(false);
  });
});
```

- [x] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/core/__tests__/fast-link.test.ts`

Expected: FAIL — hằng số / `timeoutMs` chưa có; hung `fetch` không abort.

- [x] **Step 3: Write minimal implementation**

Đầu `complete.ts`:

```ts
export const PLANNER_API_TIMEOUT_MS = 8_000;
export const PLANNER_API_MAX_TOKENS = 1_200;
```

`completeOpenAiCompat` nhận `timeoutMs: number`. `fetch`:

```ts
  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...headers,
    },
    signal: AbortSignal.timeout(timeoutMs),
    body: JSON.stringify({
      model: modelFor(id, config),
      temperature: 0.2,
      max_tokens: PLANNER_API_MAX_TOKENS,
      messages,
    }),
  });
```

Cùng `signal` trên `completeAnthropic` / `completeGemini`. Anthropic: `max_tokens: PLANNER_API_MAX_TOKENS`.  
`completePlanner` truyền `const timeoutMs = input.timeoutMs ?? PLANNER_API_TIMEOUT_MS` vào các helper. Import helper ở **đầu** file; không inline import.

- [x] **Step 4: Run tests**

Run: `npx vitest run src/core/__tests__/fast-link.test.ts src/core/__tests__/router-savings.test.ts`

Expected: PASS. Không gọi mạng thật.

- [x] **Step 5: Commit**

```bash
git add src/core/providers/complete.ts src/core/__tests__/fast-link.test.ts
git commit -m "perf: fail-fast API planners with timeout and token budget"
```

### Task F3: Trần control token + dashboard localhost

**Files:**
- Modify: `src/core/protocol.ts`
- Test: `src/core/__tests__/fast-link.test.ts`

**Interfaces:**

```ts
export const CONTROL_BUDGET_DEFAULT = 1200;
export const CONTROL_BUDGET_MAX = 2000;

export function assertControlBudget(
  raw: string,
  limit = CONTROL_BUDGET_DEFAULT,
): void;
```

`encodeControlMessage` gọi `assertControlBudget(raw, CONTROL_BUDGET_MAX)` trước khi return (PLAN+PACKETS được tới 2000; vẫn cấm dump file).  
`assertControlBudget` mặc định 1200 như cũ.  
Không đổi `package.json` scripts trừ khi chúng mất `127.0.0.1` — **giữ** `--hostname 127.0.0.1`.

- [x] **Step 1: Write the failing test**

```ts
import { readFileSync } from "node:fs";
import {
  CONTROL_BUDGET_DEFAULT,
  CONTROL_BUDGET_MAX,
  assertControlBudget,
  executedMessage,
} from "@/core/protocol";

describe("control budget and localhost", () => {
  it("keeps EXECUTED metadata-only and under 1200 tokens", () => {
    expect(CONTROL_BUDGET_DEFAULT).toBe(1200);
    expect(CONTROL_BUDGET_MAX).toBe(2000);
    const raw = executedMessage({
      taskId: "c2x_fast",
      iteration: 1,
      changedFiles: 2,
      tests: "codex: recorded",
      team: ["codex"],
    });
    expect(raw).not.toContain("@@");
    expect(raw).not.toMatch(/-----BEGIN/);
    expect(raw).not.toContain("export function");
    assertControlBudget(raw);
  });

  it("rejects a 3k-token control dump", () => {
    const dump = `[C2X]\nSTATE: PLAN\nTASK_ID: c2x_big\nITERATION: 1\n\nGOAL:\n${"dump ".repeat(3000)}\n`;
    expect(() => assertControlBudget(dump, CONTROL_BUDGET_MAX)).toThrow(/token/i);
  });

  it("binds next dev and start to loopback", () => {
    const pkg = JSON.parse(
      readFileSync(path.join(process.cwd(), "package.json"), "utf8"),
    ) as { scripts: Record<string, string> };
    expect(pkg.scripts.dev).toMatch(/127\.0\.0\.1/);
    expect(pkg.scripts.start).toMatch(/127\.0\.0\.1/);
    expect(pkg.scripts.dev).not.toMatch(/0\.0\.0\.0/);
  });
});
```

Import `path` đã có ở đầu file test.

- [x] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/core/__tests__/fast-link.test.ts`

Expected: FAIL — `CONTROL_BUDGET_*` chưa export.

- [x] **Step 3: Write minimal implementation**

Trong `protocol.ts`:

```ts
export const CONTROL_BUDGET_DEFAULT = 1200;
export const CONTROL_BUDGET_MAX = 2000;

export function assertControlBudget(
  raw: string,
  limit = CONTROL_BUDGET_DEFAULT,
): void {
  const tokens = estimateTokens(raw);
  if (tokens > limit) {
    throw new Error(`Control message is ${tokens} tokens; keep it under ${limit}.`);
  }
}
```

Cuối `encodeControlMessage`: `assertControlBudget(raw, CONTROL_BUDGET_MAX); return raw;`

Không sửa script `dev`/`start` nếu đã có `127.0.0.1`.

- [x] **Step 4: Run tests**

```bash
npx vitest run src/core/__tests__/fast-link.test.ts src/core/__tests__/protocol.test.ts
npx tsc --noEmit
```

Expected: PASS. Nếu `encodeControlMessage` làm gãy PLAN fixture vì > 2000 token — rút `PACKETS` mock, **không** nới trần.

- [x] **Step 5: Commit**

```bash
git add src/core/protocol.ts src/core/__tests__/fast-link.test.ts
git commit -m "fix: cap C2X control messages and keep the dashboard on localhost"
```

---

## Chunk 1: Slice 1 — vòng dán PLAN + REVIEW

Đóng mục tiêu 2. Planner `chatgpt-web` / `claude-web` / `gemini-web` phải có lượt REVIEW thật (copy prompt, dán `[C2X]` về). Không được gọi `mockReview` rồi đánh `DONE`.

### Task 1: `reviewPastePrompt` trên session

**Files:**
- Modify: `src/core/types.ts` (`SessionRecord`)
- Modify: `src/core/session.ts` (`createSession`, `normalizeSession`)
- Test: `src/core/__tests__/review-paste.test.ts`

**Interfaces:**
- Consumes: `SessionRecord` hiện tại (`pastePrompt: string | null`)
- Produces: `SessionRecord.reviewPastePrompt: string | null` — luôn có sau `createSession` / `normalizeSession`

- [x] **Step 1: Write the failing test**

Tạo `src/core/__tests__/review-paste.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { createSession, normalizeSession } from "@/core/session";
import type { SessionRecord } from "@/core/types";

describe("session.reviewPastePrompt", () => {
  it("starts null on a new session and survives normalize of legacy JSON", () => {
    const session = createSession({
      goal: "Sửa createTask",
      planner: "chatgpt-web",
      plannerChoice: "chatgpt-web",
      harnessTeam: ["codex", "claude-code"],
      budgetTokens: 4000,
      workspaceSource: "demo",
    });
    expect(session.reviewPastePrompt).toBeNull();

    const { reviewPastePrompt: _dropped, ...legacy } = session;
    const restored = normalizeSession(legacy as SessionRecord);
    expect(restored.reviewPastePrompt).toBeNull();
  });
});
```

- [x] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/core/__tests__/review-paste.test.ts`

Expected: FAIL — `reviewPastePrompt` không tồn tại trên type/object.

- [x] **Step 3: Write minimal implementation**

Trong `SessionRecord` (sau `pastePrompt`) thêm:

```ts
  pastePrompt: string | null;
  reviewPastePrompt: string | null;
```

`createSession`: `reviewPastePrompt: null`.

`normalizeSession` return thêm:

```ts
    reviewPastePrompt: raw.reviewPastePrompt ?? null,
```

- [x] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/core/__tests__/review-paste.test.ts`

Expected: PASS

- [x] **Step 5: Commit**

```bash
git add src/core/types.ts src/core/session.ts src/core/__tests__/review-paste.test.ts
git commit -m "feat: add reviewPastePrompt on C2X sessions"
```

### Task 2: `buildReviewPastePrompt`

**Files:**
- Modify: `src/core/planner.ts` (sau `buildReviewUserPrompt`)
- Test: `src/core/__tests__/review-paste.test.ts`

**Interfaces:**
- Consumes: `ContextPack`, `taskId`, `iteration`, `changedFiles: string[]`, `tests: string`, `diffStat?: string`
- Produces:

```ts
export function buildReviewPastePrompt(input: {
  pack: ContextPack;
  taskId: string;
  iteration: number;
  changedFiles: string[];
  tests: string;
  diffStat?: string;
}): string;
```

Hàm phải nhúng `PLANNER_SYSTEM_PROMPT`, `TASK_ID`, `CHANGED_FILES`, `TESTS`, `PACKED TREE`. Không được chứa `-----BEGIN` hay nội dung kiểu thân file (`export function`). Được phép có `DIFF_STAT` một khối ngắn.

- [x] **Step 1: Write the failing test**

Thêm vào `review-paste.test.ts`:

```ts
import { DEMO_FILES } from "@/core/fixtures/demo-workspace";
import { packWorkspace } from "@/core/packer";
import { PLANNER_SYSTEM_PROMPT, buildReviewPastePrompt } from "@/core/planner";

describe("buildReviewPastePrompt", () => {
  it("asks the web planner for DONE|PLAN|BLOCKED without dumping file bodies", () => {
    const pack = packWorkspace({
      goal: "Sửa createTask",
      files: DEMO_FILES,
      budgetTokens: 2000,
    });
    const prompt = buildReviewPastePrompt({
      pack,
      taskId: "c2x_rev1",
      iteration: 1,
      changedFiles: ["src/lib/tasks.ts"],
      tests: "codex: not run\nclaude-code: 12 passed",
      diffStat: "1 file changed, 8 insertions(+)",
    });

    expect(prompt).toContain(PLANNER_SYSTEM_PROMPT);
    expect(prompt).toContain("TASK_ID: c2x_rev1");
    expect(prompt).toContain("src/lib/tasks.ts");
    expect(prompt).toContain("12 passed");
    expect(prompt).toContain("1 file changed, 8 insertions(+)");
    expect(prompt).toMatch(/STATE:\s*DONE\|PLAN\|BLOCKED|DONE, PLAN, or BLOCKED|DONE\|PLAN\|BLOCKED/);
    expect(prompt).not.toMatch(/-----BEGIN/);
    expect(prompt).not.toContain("function createTask");
  });
});
```

- [x] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/core/__tests__/review-paste.test.ts`

Expected: FAIL — `buildReviewPastePrompt` is not exported.

- [x] **Step 3: Write minimal implementation**

Thêm vào `src/core/planner.ts`:

```ts
export function buildReviewPastePrompt(input: {
  pack: ContextPack;
  taskId: string;
  iteration: number;
  changedFiles: string[];
  tests: string;
  diffStat?: string;
}): string {
  const files =
    input.changedFiles.map((path) => `- ${path}`).join("\n") || "- (none)";
  const diff = input.diffStat?.trim()
    ? `\nDIFF_STAT:\n${input.diffStat.trim()}\n`
    : "";
  return `${PLANNER_SYSTEM_PROMPT}

GOAL:
${input.pack.goal}

CHANGED_FILES:
${files}

TESTS:
${input.tests}
${diff}
PACKED TREE:
${input.pack.tree}

Reply with a single [C2X] control message. STATE must be DONE, PLAN, or BLOCKED.
TASK_ID: ${input.taskId}
ITERATION: ${input.iteration}

[C2X]
STATE: DONE|PLAN|BLOCKED
TASK_ID: ${input.taskId}
ITERATION: ${input.iteration}

SUMMARY:
...
`;
}
```

Không nối `pack.excerpts[].content` vào prompt review (tránh dump thân file). Tree + metadata là đủ cho slice 1.

- [x] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/core/__tests__/review-paste.test.ts`

Expected: PASS

- [x] **Step 5: Commit**

```bash
git add src/core/planner.ts src/core/__tests__/review-paste.test.ts
git commit -m "feat: build web-chat REVIEW paste prompts"
```

### Task 3: `applyImportedReview` thuần

**Files:**
- Create: `src/core/review-import.ts`
- Modify: `src/core/index.ts`
- Test: `src/core/__tests__/review-paste.test.ts`

**Interfaces:**
- Consumes: `parseControlMessage`, `extractControlBlock`, `messageToReview`, `applyPlan` / `planToBriefs` / `parsePlannerOutput`, `touchSession`
- Produces:

```ts
export function applyImportedReview(session: SessionRecord, raw: string): SessionRecord;
```

Quy tắc (khớp spec §6.1):

- `DONE` | `BLOCKED` khi `session.state` là `EXECUTED` hoặc `REVIEW` → ghi `review`, `state` = verdict.
- `PLAN` khi session đã `EXECUTED`/`REVIEW` → iteration mới qua `parsePlannerOutput` + `applyPlan` (reset runs).
- `PLAN` khi chưa có plan (`INIT`) → không dùng hàm này (vẫn `importPlan`).
- State khác → throw `Error` có chữ `REVIEW` hoặc `PLAN`.

- [x] **Step 1: Write the failing test**

```ts
import { planToBriefs } from "@/core/brief";
import { mockPlanFromPack } from "@/core/planner";
import { applyImportedReview } from "@/core/review-import";
import { createSession } from "@/core/session";

function sessionAfterExecute() {
  const pack = packWorkspace({
    goal: "Sửa createTask",
    files: DEMO_FILES,
    budgetTokens: 2000,
  });
  const plan = mockPlanFromPack(pack, "c2x_rev1", ["codex"]);
  const briefs = planToBriefs(plan);
  let session = createSession({
    goal: pack.goal,
    planner: "chatgpt-web",
    plannerChoice: "chatgpt-web",
    harnessTeam: ["codex"],
    budgetTokens: 2000,
    workspaceSource: "demo",
  });
  session = {
    ...session,
    state: "EXECUTED",
    pack,
    plan,
    briefs,
    brief: briefs[0] ?? null,
    harnessRuns: [
      {
        owner: "codex",
        state: "executed",
        changedFiles: ["src/lib/tasks.ts"],
        tests: "12 passed",
      },
    ],
  };
  return session;
}

describe("applyImportedReview", () => {
  it("accepts a web-chat DONE block after EXECUTED", () => {
    const next = applyImportedReview(
      sessionAfterExecute(),
      `[C2X]
STATE: DONE
TASK_ID: c2x_rev1
ITERATION: 1

SUMMARY:
Changed files match the brief.
`,
    );
    expect(next.state).toBe("DONE");
    expect(next.review?.state).toBe("DONE");
    expect(next.review?.summary).toMatch(/match/i);
  });

  it("rejects INIT as a review import", () => {
    expect(() =>
      applyImportedReview(
        sessionAfterExecute(),
        `[C2X]
STATE: INIT
TASK_ID: c2x_rev1
ITERATION: 0

GOAL:
nope
`,
      ),
    ).toThrow(/DONE|PLAN|BLOCKED|REVIEW/i);
  });
});
```

- [x] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/core/__tests__/review-paste.test.ts`

Expected: FAIL — Cannot find module `@/core/review-import`.

- [x] **Step 3: Write minimal implementation**

`src/core/review-import.ts`:

```ts
import { planToBriefs } from "@/core/brief";
import { extractControlBlock, parsePlannerOutput } from "@/core/planner";
import { messageToReview, parseControlMessage } from "@/core/protocol";
import { applyPlan, reusedPack, touchSession } from "@/core/session";
import { estimateSavings } from "@/core/savings";
import type { SessionRecord } from "@/core/types";

export function applyImportedReview(session: SessionRecord, raw: string): SessionRecord {
  if (session.state !== "EXECUTED" && session.state !== "REVIEW") {
    throw new Error("Review import needs EXECUTED or REVIEW.");
  }
  const message = parseControlMessage(extractControlBlock(raw));
  if (message.state === "DONE" || message.state === "BLOCKED") {
    const review = messageToReview(message);
    return touchSession({ ...session, review }, {
      state: review.state,
      actor: "user",
      note: review.summary || `Imported ${review.state} from a web chat.`,
    });
  }
  if (message.state === "PLAN") {
    const pack = reusedPack(session);
    const fallback = session.plan;
    if (!fallback) {
      throw new Error("Review PLAN import needs an existing PLAN.");
    }
    const plan = parsePlannerOutput(raw, fallback);
    const briefs = planToBriefs(plan);
    return applyPlan(
      touchSession(session, {
        state: "PLAN",
        actor: "user",
        note: "Imported next-iteration [C2X] PLAN from a web chat.",
      }),
      {
        plan,
        briefs,
        brief: briefs[0] ?? null,
        review: null,
        savings: estimateSavings({
          pack,
          brief: briefs[0] ?? null,
          briefs,
          planner: session.planner,
        }),
      },
    );
  }
  throw new Error(`Review import must be DONE, PLAN, or BLOCKED (got ${message.state}).`);
}
```

Export từ `src/core/index.ts`: `export * from "@/core/review-import";`

- [x] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/core/__tests__/review-paste.test.ts`

Expected: PASS

- [x] **Step 5: Commit**

```bash
git add src/core/review-import.ts src/core/index.ts src/core/__tests__/review-paste.test.ts
git commit -m "feat: import DONE/PLAN/BLOCKED from web-chat review"
```

### Task 4: `importControlMessage` + `runReview` cho planner dán

**Files:**
- Modify: `src/core/run-loop.ts`
- Test: `src/core/__tests__/review-paste.test.ts`

**Interfaces:**
- Consumes: `importPlan`, `applyImportedReview`, `buildReviewPastePrompt`, `mergedExecutionReport`
- Produces:

```ts
export async function importControlMessage(input: {
  sessionId?: string;
  raw: string;
}): Promise<SessionRecord>;

export async function runReview(input: {
  sessionId: string;
  changedFiles: string[];
  tests: string;
  importedRaw?: string;
}): Promise<SessionRecord>;
```

`importControlMessage`: nếu `parseControlMessage` → `PLAN` và session chưa `EXECUTED`/`REVIEW` thì gọi `importPlan`; nếu không thì `applyImportedReview` rồi `upsertSession`.

`runReview` khi `isPastePlanner(session.planner)` và không có `importedRaw`:

1. Hoàn tất runs nếu cần (như hiện tại).
2. Gắn `reviewPastePrompt = buildReviewPastePrompt(...)`.
3. `state: "REVIEW"`, `review` giữ `null`.
4. **Không** gọi `mockReview`.

Khi `importedRaw` có mặt: `applyImportedReview`.

Planner `mock` / API giữ hành vi cũ (`mockReview` / `completePlanner`).

- [x] **Step 1: Write the failing test**

Dùng `FRUGAL_DATA_DIR` tạm vì `run-loop` ghi store:

```ts
import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach } from "vitest";
import { importControlMessage, runPlan, runReview } from "@/core/run-loop";
import { upsertSession } from "@/core/store";

let dataDir = "";

beforeEach(async () => {
  dataDir = await mkdtemp(path.join(os.tmpdir(), "c2x-"));
  process.env.FRUGAL_DATA_DIR = dataDir;
});

afterEach(async () => {
  delete process.env.FRUGAL_DATA_DIR;
  await rm(dataDir, { recursive: true, force: true });
});

describe("runReview paste planner", () => {
  it("does not mark DONE until a web-chat review block is imported", async () => {
    let session = await runPlan({
      goal: "Sửa createTask",
      plannerChoice: "chatgpt-web",
      harnessTeam: ["codex"],
      budgetTokens: 2000,
      workspaceSource: "demo",
    });
    session = await importControlMessage({
      sessionId: session.id,
      raw: `[C2X]
STATE: PLAN
TASK_ID: ${session.id}
ITERATION: 1

GOAL:
Sửa createTask

RATIONALE:
Packed excerpts show the defect.

ACTIONS:
1. Fix createTask persistence.

FILES_LIKELY_INVOLVED:
- src/lib/tasks.ts

TESTS:
- unit

SUCCESS_CRITERIA:
- tasks persist

RISKS:
- none

PACKETS:
  ## owner=codex role=general
  ACTIONS:
  1. Fix createTask persistence.
  FILES:
  - src/lib/tasks.ts
  TESTS:
  - unit
  SUCCESS_CRITERIA:
  - persist
`,
    });
    await upsertSession({
      ...session,
      state: "EXECUTED",
      harnessRuns: session.harnessTeam.map((owner) => ({
        owner,
        state: "executed" as const,
        changedFiles: ["src/lib/tasks.ts"],
        tests: "12 passed",
      })),
    });

    const waiting = await runReview({
      sessionId: session.id,
      changedFiles: ["src/lib/tasks.ts"],
      tests: "12 passed",
    });
    expect(waiting.state).toBe("REVIEW");
    expect(waiting.review).toBeNull();
    expect(waiting.reviewPastePrompt).toContain(session.id);
    expect(waiting.reviewPastePrompt).toContain("src/lib/tasks.ts");

    const done = await importControlMessage({
      sessionId: session.id,
      raw: `[C2X]
STATE: DONE
TASK_ID: ${session.id}
ITERATION: 1

SUMMARY:
Looks good.
`,
    });
    expect(done.state).toBe("DONE");
    expect(done.review?.state).toBe("DONE");
  });
});
```

Lưu ý: `importPlan` hiện yêu cầu session đã pack — `runPlan` với `chatgpt-web` đã pack và để `INIT`. Test dựa vào điều đó.

- [x] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/core/__tests__/review-paste.test.ts`

Expected: FAIL — `importControlMessage` chưa export, hoặc `runReview` gọi `mockReview` → `DONE`.

- [x] **Step 3: Write minimal implementation**

Trong `src/core/run-loop.ts`:

1. Import `applyImportedReview`, `buildReviewPastePrompt`, `reusedPack` (đã có từ Task F1) ở **đầu** `run-loop.ts`.
2. Thêm `importControlMessage`:

```ts
export async function importControlMessage(input: {
  sessionId?: string;
  raw: string;
}): Promise<SessionRecord> {
  const message = parseControlMessage(extractControlBlock(input.raw));
  const existing = input.sessionId ? await getSession(input.sessionId) : null;
  if (
    existing &&
    (existing.state === "EXECUTED" || existing.state === "REVIEW") &&
    (message.state === "DONE" || message.state === "BLOCKED" || message.state === "PLAN")
  ) {
    return upsertSession(applyImportedReview(existing, input.raw));
  }
  return importPlan(input);
}
```

3. Đổi đầu `runReview` (sau khi merge execute) với planner dán:

```ts
  if (isPastePlanner(existing.planner) && !input.importedRaw) {
    const reviewPastePrompt = buildReviewPastePrompt({
      pack: reusedPack(existing),
      taskId: existing.id,
      iteration: existing.plan.iteration,
      changedFiles,
      tests,
    });
    return upsertSession(
      touchSession(
        { ...reviewing, review: null, reviewPastePrompt },
        {
          state: "REVIEW",
          actor: "planner",
          note: `${existing.planner}: copy the review prompt into that web chat, paste DONE|PLAN|BLOCKED back.`,
        },
      ),
    );
  }
  if (input.importedRaw) {
    return upsertSession(applyImportedReview(reviewing, input.importedRaw));
  }
```

Giữ nhánh `mock` / API bên dưới. `importPlan` **không** xóa; `importControlMessage` ủy quyền.

- [x] **Step 4: Run tests**

Run: `npx vitest run src/core/__tests__/review-paste.test.ts src/core/__tests__/router-savings.test.ts src/core/__tests__/packets.test.ts`

Expected: PASS

- [x] **Step 5: Commit**

```bash
git add src/core/run-loop.ts src/core/__tests__/review-paste.test.ts
git commit -m "feat: keep paste-planner review on the web chat"
```

### Task 5: API + CLI import / review-prompt

**Files:**
- Modify: `src/app/api/import-plan/route.ts`
- Modify: `src/app/api/review/route.ts`
- Modify: `src/cli/c2x.ts`
- Test: `src/core/__tests__/review-paste.test.ts` (không cần HTTP test; CLI logic trích hàm thuần nếu cần — gọi `importControlMessage` đã cover)

**Interfaces:**
- `POST /api/import-plan` body `{ sessionId?, raw }` → `importControlMessage`
- `POST /api/review` giữ `{ sessionId, changedFiles?, tests? }` → `runReview` (paste sẽ trả `review: null` + `reviewPastePrompt`)
- CLI:

```text
c2x import --session <id> --raw-file <path>
c2x review-prompt --session <id>
```

`review-prompt` load session, nếu thiếu `reviewPastePrompt` thì gọi `runReview` rồi in prompt.

- [x] **Step 1: Write the failing CLI smoke via unit-level parse**

Không bắt buộc parse Commander. Thêm test rằng `importControlMessage` là entry duy nhất (đã có). Verify tay CLI sau Step 3.

Thêm assertion file-level: sau khi sửa route, grep trong đầu bạn — `import-plan/route.ts` phải import `importControlMessage`.

Viết test store-level cho `runReview` đã có. Bước fail của task này: đổi route trước khi implement CLI sẽ làm `npx tsx src/cli/c2x.ts import --help` FAIL (unknown command).

- [x] **Step 2: Run to verify CLI fails**

Run: `npx tsx src/cli/c2x.ts import --help`

Expected: FAIL / unknown command `import`.

- [x] **Step 3: Write minimal implementation**

`src/app/api/import-plan/route.ts`: thay `importPlan` bằng `importControlMessage`.

`src/app/api/review/route.ts`: không đổi contract; hành vi mới đến từ `runReview`.

Cuối `src/cli/c2x.ts`, trước `program.parseAsync`:

```ts
import { readFile } from "node:fs/promises";
import { importControlMessage, runReview } from "@/core/run-loop";
import { getSession } from "@/core/store";

program
  .command("import")
  .requiredOption("--session <id>")
  .requiredOption("--raw-file <path>", "path to a [C2X] block, or - for stdin")
  .action(async (opts: { session: string; rawFile: string }) => {
    const raw =
      opts.rawFile === "-"
        ? await new Promise<string>((resolve, reject) => {
            const chunks: Buffer[] = [];
            process.stdin.on("data", (chunk) => chunks.push(Buffer.from(chunk)));
            process.stdin.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
            process.stdin.on("error", reject);
          })
        : await readFile(opts.rawFile, "utf8");
    const session = await importControlMessage({ sessionId: opts.session, raw });
    process.stdout.write(`${session.id} ${session.state}\n`);
  });

program
  .command("review-prompt")
  .requiredOption("--session <id>")
  .action(async (opts: { session: string }) => {
    const existing = await getSession(opts.session);
    if (!existing) {
      throw new Error(`unknown session: ${opts.session}`);
    }
    const session =
      existing.reviewPastePrompt && existing.state === "REVIEW"
        ? existing
        : await runReview({
            sessionId: opts.session,
            changedFiles: [],
            tests: "not run",
          });
    if (!session.reviewPastePrompt) {
      throw new Error("No review paste prompt. Use a web/subscription planner.");
    }
    process.stdout.write(session.reviewPastePrompt);
    process.stdout.write("\n");
  });
```

`readFile` import ở **đầu file** `c2x.ts`, không import trong action.

- [x] **Step 4: Run tests + CLI help**

Run:

```bash
npx vitest run
npx tsx src/cli/c2x.ts import --help
npx tsx src/cli/c2x.ts review-prompt --help
```

Expected: tests PASS; help in `session` và `raw-file` / `session`.

- [x] **Step 5: Commit**

```bash
git add src/app/api/import-plan/route.ts src/app/api/review/route.ts src/cli/c2x.ts
git commit -m "feat: accept imported REVIEW via API and c2x CLI"
```

### Task 6: Dashboard + i18n vòng REVIEW

**Files:**
- Modify: `src/lib/i18n.ts` — thêm key, không xóa key cũ
- Modify: `src/components/studio-client.tsx` — tab Review: copy `reviewPastePrompt`, ô nhập dùng lại `importRaw` (đã gọi `/api/import-plan`)

**Interfaces:**
- Consumes: `session.reviewPastePrompt`, `POST /api/import-plan`, `POST /api/review`
- Produces: key i18n (thêm, không rename hàng loạt):

```ts
copyReview: string;
importAny: string;
importAnyPlaceholder: string;
waitingWebReview: string;
```

vi:

```ts
copyReview: "Sao chép prompt review",
importAny: "Nhập [C2X] PLAN hoặc REVIEW",
importAnyPlaceholder: "Dán khối [C2X] / [C2C] STATE: PLAN|DONE|BLOCKED …",
waitingWebReview: "Copy prompt review sang chat web. Đừng giả lập DONE.",
```

en:

```ts
copyReview: "Copy review prompt",
importAny: "Import [C2X] PLAN or REVIEW",
importAnyPlaceholder: "Paste a [C2X] / [C2C] STATE: PLAN|DONE|BLOCKED block…",
waitingWebReview: "Copy the review prompt into the web chat. Do not fake DONE.",
```

`onSimulateAll`: vẫn execute-all + `POST /api/review`. Với planner dán, response sẽ `REVIEW` + prompt — UI phải hiện prompt, không giả summary DONE. Với `mock`, giữ `mockReview`.

`onImport` đã POST `/api/import-plan` — không đổi URL.

- [x] **Step 1: Write the failing test**

Không có test component runner. Fail = typecheck nếu thiếu key (copy `as const` — thêm cả `vi` và `en`).

Chạy sau khi sửa i18n một phía: `npx tsc --noEmit` sẽ fail nếu studio reference key chưa có.

Thêm vào studio tab `review` (trước khi có key) đoạn `t.waitingWebReview` để Step 2 fail.

- [x] **Step 2: Run typecheck to verify it fails**

Run: `npx tsc --noEmit`

Expected: FAIL trên `waitingWebReview` nếu mới chỉ sửa tsx.

- [x] **Step 3: Write minimal implementation**

1. Thêm 4 key vào **cả** `copy.vi` và `copy.en`.
2. Tab Review trong `studio-client.tsx`:

- Nếu `session.reviewPastePrompt`: `<pre>` + nút copy (`copyReview`).
- Nếu `session.review`: badge + summary như hiện tại.
- Nếu paste planner, đã `EXECUTED`/`REVIEW`, chưa review: hiện `t.waitingWebReview` + nút “Chuẩn bị review” gọi `POST /api/review` (không gọi execute giả nếu user đã record).
- Ô import: đổi label sang `t.importAny` / `t.importAnyPlaceholder`.

Đừng xóa nút “Giả lập đã chạy” — vẫn dùng cho demo/`mock`.

- [x] **Step 4: Verify**

```bash
npx tsc --noEmit
npx vitest run
```

Expected: PASS

Tay (khi có browser): Phòng điều khiển → planner `chatgpt-web` → Đóng gói → dán PLAN mẫu → Giả lập lane → tab Review có prompt → dán DONE → state `DONE`.

- [x] **Step 5: Commit**

```bash
git add src/lib/i18n.ts src/components/studio-client.tsx
git commit -m "feat: show web-chat REVIEW paste in the control room"
```

---

## Chunk 2: Slice 2 — workspace root + execution records

Mục tiêu 1 có số thật. `EXECUTED` control message vẫn metadata-only. Diff body không được đưa vào `[C2X]`.

### Task 7: Kiểu `ExecutionRecord`

**Files:**
- Modify: `src/core/types.ts`
- Modify: `src/core/session.ts`
- Test: `src/core/__tests__/records.test.ts`

**Interfaces:**
- Produces:

```ts
export const EXECUTION_EXIT_STATUSES = ["ok", "fail", "unknown"] as const;
export type ExecutionExitStatus = (typeof EXECUTION_EXIT_STATUSES)[number];

export function isExecutionExitStatus(value: string): value is ExecutionExitStatus;

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

`SessionRecord.records: ExecutionRecord[]`  
Không thêm `AppConfig.workspaceRoot` (tránh `PUT /api/config` thành LFI).

- [x] **Step 1: Write the failing test**

```ts
import { describe, expect, it } from "vitest";
import { createSession, normalizeSession } from "@/core/session";
import { isExecutionExitStatus, type SessionRecord } from "@/core/types";

describe("ExecutionRecord on session", () => {
  it("normalizes missing records to an empty array", () => {
    expect(isExecutionExitStatus("ok")).toBe(true);
    expect(isExecutionExitStatus("nope")).toBe(false);
    const session = createSession({
      goal: "x",
      planner: "mock",
      plannerChoice: "mock",
      harnessTeam: ["codex"],
      budgetTokens: 4000,
      workspaceSource: "demo",
    });
    expect(session.records).toEqual([]);
    const { records: _r, ...legacy } = session;
    expect(normalizeSession(legacy as SessionRecord).records).toEqual([]);
  });
});
```

- [x] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/core/__tests__/records.test.ts`

Expected: FAIL — module/types missing fields.

- [x] **Step 3: Write minimal implementation**

Thêm types + `isExecutionExitStatus` (so với `EXECUTION_EXIT_STATUSES`).  
`createSession`: `records: []`.  
`normalizeSession`: `records: raw.records ?? []`.  
Không đụng `AppConfig` / `mergeConfig` cho path.

- [x] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/core/__tests__/records.test.ts`

Expected: PASS

- [x] **Step 5: Commit**

```bash
git add src/core/types.ts src/core/session.ts src/core/__tests__/records.test.ts
git commit -m "feat: add ExecutionRecord fields on C2X sessions"
```

### Task 8: `collectGitMetadata`

**Files:**
- Create: `src/core/git-meta.ts`
- Test: `src/core/__tests__/records.test.ts`

**Interfaces:**
- Produces:

```ts
export async function collectGitMetadata(root: string): Promise<{
  changedFiles: string[];
  diffStat: string;
  isGit: boolean;
}>;
```

Chạy (không shell string):

```ts
import { spawn } from "node:child_process";
```

`git -C <root> rev-parse --is-inside-work-tree` → nếu fail, `{ changedFiles: [], diffStat: "", isGit: false }`.  
`git -C <root> status --porcelain` → lấy path cột cuối.  
`git -C <root> diff --stat HEAD` → `diffStat` (trim, cắt 2000 ký tự).

Không trả nội dung hunk.

- [x] **Step 1: Write the failing test**

```ts
import { mkdir, writeFile } from "node:fs/promises";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { collectGitMetadata } from "@/core/git-meta";

const execFileAsync = promisify(execFile);

describe("collectGitMetadata", () => {
  it("reads porcelain paths and a stat line from a temp repo", async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), "c2x-git-"));
    await execFileAsync("git", ["-C", root, "init"]);
    await execFileAsync("git", ["-C", root, "config", "user.email", "c2x@example.com"]);
    await execFileAsync("git", ["-C", root, "config", "user.name", "c2x"]);
    await writeFile(path.join(root, "README.md"), "one\n", "utf8");
    await execFileAsync("git", ["-C", root, "add", "README.md"]);
    await execFileAsync("git", ["-C", root, "commit", "-m", "init"]);
    await writeFile(path.join(root, "README.md"), "two\n", "utf8");
    await writeFile(path.join(root, "src-new.ts"), "export const x = 1;\n", "utf8");

    const meta = await collectGitMetadata(root);
    expect(meta.isGit).toBe(true);
    expect(meta.changedFiles.some((item) => item.endsWith("README.md"))).toBe(true);
    expect(meta.diffStat.length).toBeGreaterThan(0);
    expect(meta.diffStat).not.toContain("export const x");

    await rm(root, { recursive: true, force: true });
  });

  it("returns isGit false outside a repository", async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), "c2x-nogit-"));
    const meta = await collectGitMetadata(root);
    expect(meta.isGit).toBe(false);
    expect(meta.changedFiles).toEqual([]);
    await rm(root, { recursive: true, force: true });
  });
});
```

- [x] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/core/__tests__/records.test.ts`

Expected: FAIL — `@/core/git-meta` missing.

- [x] **Step 3: Write minimal implementation**

`src/core/git-meta.ts`: helper `runGit(root, args): Promise<{ ok: boolean; stdout: string }>` dùng `spawn` + `cwd` không cần nếu đã `-C`. Parse porcelain: mỗi dòng non-empty, path = phần sau cột status (`line.slice(3).replace(/^"|"$/g, "").split(" -> ").at(-1)`).

- [x] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/core/__tests__/records.test.ts`

Expected: PASS (`git` phải có trên PATH của agent — môi trường Cloud có git).

- [x] **Step 5: Commit**

```bash
git add src/core/git-meta.ts src/core/__tests__/records.test.ts
git commit -m "feat: collect local git status and diff --stat"
```

### Task 9: `applyExecutionRecord` + ignore + workspace root

**Files:**
- Create: `src/core/records.ts`
- Modify: `src/core/workspace.ts`
- Modify: `src/core/sensitive.ts`
- Modify: `src/core/store.ts` (`C2X_DATA_DIR`)
- Modify: `src/core/run-loop.ts` (`runRecord`)
- Create: `src/app/api/record/route.ts`
- Modify: `src/cli/c2x.ts`
- Test: `src/core/__tests__/records.test.ts`, `src/core/__tests__/workspace-root.test.ts`

**Interfaces:**
- Produces:

```ts
export function applyExecutionRecord(
  session: SessionRecord,
  record: ExecutionRecord,
): SessionRecord;

export async function runRecord(input: {
  sessionId: string;
  owner: HarnessId;
  changedFiles?: string[];
  tests?: string;
  exitStatus?: ExecutionExitStatus;
  /** CLI `--cwd` only. HTTP callers omit this. */
  cwd?: string;
}): Promise<SessionRecord>;

export function resolveWorkspaceRoot(input?: {
  cwd?: string;
  env?: NodeJS.ProcessEnv;
}): string;

export async function loadC2xIgnore(root: string): Promise<string[]>;
```

`applyExecutionRecord` gọi `completeHarnessRun` với `record.changedFiles` / `record.tests`, đồng thời `records = [...session.records.filter(not same owner+iteration), record]`.

`runRecord`:

1. Load session; `owner` phải ∈ `harnessTeam`.
2. `root = resolveWorkspaceRoot({ cwd: input.cwd, env: process.env })`. API `POST /api/record` **không** truyền `cwd`.
3. `meta = await collectGitMetadata(root)` trừ khi caller truyền `changedFiles`.
4. Nếu `changedFiles` trống và không git: lấy `packet.files` của owner.
5. Lọc path khỏi packet teammate khác (không ghi nhận file của owner khác).
6. `tests` mặc định `exitStatus === "fail" ? "failed" : meta.isGit ? "recorded" : "unknown"`.
7. `upsertSession(applyExecutionRecord(...))`.

`resolveWorkspaceRoot`: `input.cwd` (CLI) → `env.C2X_WORKSPACE` → `process.cwd()`. Không có `configRoot`.

`loadWorkspaceFiles("repo")` dùng `resolveWorkspaceRoot` + `loadC2xIgnore` đưa vào `isIgnoredPath(rel, extra)`.

`dataDir()`: `process.env.C2X_DATA_DIR || process.env.FRUGAL_DATA_DIR || <cwd>/data`.

`POST /api/record` và `POST /api/plan` body: không đọc `workspaceRoot` / `cwd`. Nếu client gửi, **bỏ qua**.

CLI: `c2x record --session <id> --owner <id> [--cwd <path>] [--tests <text>] [--exit-status ok|fail|unknown]`

- [x] **Step 1: Write the failing tests**

`workspace-root.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { resolveWorkspaceRoot } from "@/core/workspace";

describe("resolveWorkspaceRoot", () => {
  it("prefers CLI cwd, then C2X_WORKSPACE, then process.cwd — never a config path", () => {
    expect(resolveWorkspaceRoot({ cwd: "/tmp/a", env: { C2X_WORKSPACE: "/tmp/b" } })).toBe("/tmp/a");
    expect(resolveWorkspaceRoot({ env: { C2X_WORKSPACE: "/tmp/b" } })).toBe("/tmp/b");
    expect(resolveWorkspaceRoot({ env: {} })).toBe(process.cwd());
  });
});
```

Trong `records.test.ts`: session PLAN 2 harness; `applyExecutionRecord` cho `codex` → state `EXECUTING`; record không chứa `diffStat` trong `encodeControlMessage` EXECUTED — gọi `executedMessage` và `expect(raw).not.toContain("@@")`.

- [x] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/core/__tests__/workspace-root.test.ts src/core/__tests__/records.test.ts`

Expected: FAIL — exports missing.

- [x] **Step 3: Write minimal implementation**

Đúng chữ ký trên. `executedMessage` không thêm field `DIFF`. `diffStat` chỉ sống trên `ExecutionRecord` và đi vào `buildReviewPastePrompt({ diffStat })` khi gộp:

```ts
const diffStat = session.records.map((item) => `${item.owner}: ${item.diffStat}`).filter((line) => !line.endsWith(": ")).join("\n");
```

Nối vào `runReview` paste prompt.

`.c2xignore`: đọc file nếu tồn tại, mỗi dòng non-empty không bắt đầu `#`.

`loadWorkspaceFiles`: truyền extra ignore.

API `src/app/api/record/route.ts` — validate `sessionId` + `isHarnessId(owner)`.

- [x] **Step 4: Run tests**

```bash
npx vitest run
npx tsc --noEmit
```

Expected: PASS

- [x] **Step 5: Commit**

```bash
git add src/core/records.ts src/core/workspace.ts src/core/sensitive.ts src/core/store.ts src/core/run-loop.ts src/app/api/record/route.ts src/cli/c2x.ts src/core/__tests__/records.test.ts src/core/__tests__/workspace-root.test.ts src/core/index.ts
git commit -m "feat: record per-harness git metadata for review"
```

### Task 10: Dashboard ghi nhận + prompt review có DIFF_STAT

**Files:**
- Modify: `src/components/studio-client.tsx`
- Modify: `src/lib/i18n.ts`
- Modify: `src/core/run-loop.ts` (`runReview` truyền `diffStat` gộp)

**Interfaces:**
- Nút trên mỗi lane: `POST /api/record` `{ sessionId, owner }` label `recordFromGit` / `recordFromGitEn`.
- Không thêm input path.

vi: `recordFromGit: "Ghi nhận từ git"`  
en: `recordFromGit: "Record from git"`

- [ ] **Step 1: Reference the new i18n key in studio before adding it**

(TDD typecheck như Task 6.)

- [ ] **Step 2: `npx tsc --noEmit` fails**

Expected: FAIL trên `t.recordFromGit`.

- [ ] **Step 3: Add keys + button**

`onRecord(owner)` → `/api/record`. Sau record, nếu cả đội `executed` thì `POST /api/review` để tạo `reviewPastePrompt` (paste) hoặc `mockReview` (mock).

- [ ] **Step 4: `npx tsc --noEmit && npx vitest run`**

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/components/studio-client.tsx src/lib/i18n.ts src/core/run-loop.ts
git commit -m "feat: record harness lanes from git in the control room"
```

---

## Chunk 3: Slice 3 — adapter harness (detect + ghi brief)

Mục tiêu 3–4: catalog → runtime. Không spawn.

### Task 11: `detectHarness` exhaustive

**Files:**
- Create: `src/core/harness.ts`
- Test: `src/core/__tests__/harness-detect.test.ts`

**Interfaces:**

```ts
export type HarnessDetectResult = {
  id: HarnessId;
  ok: boolean;
  binary: string | null;
  hintVi: string;
  hintEn: string;
};

export function binariesForHarness(id: HarnessId): string[];
export async function detectHarness(id: HarnessId): Promise<HarnessDetectResult>;
export async function detectHarnessTeam(
  team: readonly HarnessId[],
): Promise<HarnessDetectResult[]>;
```

`binariesForHarness(id)` = `[...getHarness(id).binaries]` — **cấm** switch 5 case trong `harness.ts`. Slice R đã ghi `binaries` trên registry.

Detect: `which`/`where` không dùng. Dùng `existsSync` trên `PATH` split (`process.env.PATH`, delimiter `path.delimiter`) + `pathext` Windows nếu có. Cache process-lifetime: `Map` key = `${id}\0${process.env.PATH ?? ""}`. Test không phụ thuộc máy có `codex`: test `binariesForHarness` + detect với `PATH` trỏ vào dir tạm chứa file executable giả tên `claude`. Gọi `detectHarness("claude-code")` hai lần trên cùng PATH — lần hai không cần file biến mất (cache); test cache: đổi PATH giữa hai lần thì miss.

- [ ] **Step 1: Write the failing test**

```ts
import { chmod, mkdir, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { binariesForHarness, detectHarness } from "@/core/harness";
import { getHarness } from "@/core/providers/catalog";
import { HARNESS_IDS } from "@/core/types";

describe("binariesForHarness", () => {
  it("lists at least one binary name for every harness id", () => {
    for (const id of HARNESS_IDS) {
      expect(binariesForHarness(id).length).toBeGreaterThan(0);
    }
    expect(binariesForHarness("grok-build")).toEqual([...getHarness("grok-build").binaries]);
    expect(binariesForHarness("kiro-cli")).toEqual(["kiro"]);
  });
});

describe("detectHarness", () => {
  it("finds a fake claude binary on PATH and stays ok:false when missing", async () => {
    const dir = await mkdtemp(path.join(os.tmpdir(), "c2x-bin-"));
    const fake = path.join(dir, "claude");
    await writeFile(fake, "#!/bin/sh\necho ok\n", "utf8");
    await chmod(fake, 0o755);
    const prev = process.env.PATH;
    process.env.PATH = dir;
    const found = await detectHarness("claude-code");
    process.env.PATH = "/nonexistent-c2x-path";
    const missing = await detectHarness("claude-code");
    process.env.PATH = prev;
    expect(found.ok).toBe(true);
    expect(found.binary).toBe(fake);
    expect(missing.ok).toBe(false);
    expect(missing.binary).toBeNull();
    expect(missing.hintVi.length).toBeGreaterThan(10);
    await rm(dir, { recursive: true, force: true });
  });
});
```

Import `mkdtemp`/`rm` từ `node:fs/promises` ở đầu file test.

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/core/__tests__/harness-detect.test.ts`

Expected: FAIL — module missing.

- [ ] **Step 3: Write minimal implementation**

`src/core/harness.ts`: `binariesForHarness` ủy quyền catalog; scan PATH; cache Map; hint vi/en: “Không thấy {binary}. Sao chép brief `{id}` vào tool đó — C2X không spawn harness.” Không `switch (id)` liệt kê roster.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/core/__tests__/harness-detect.test.ts`

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/core/harness.ts src/core/__tests__/harness-detect.test.ts src/core/index.ts
git commit -m "feat: detect Codex/Claude/Grok/OpenCode/Kiro binaries"
```

### Task 12: `writeHarnessBrief` + CLI `brief` / `doctor`

**Files:**
- Modify: `src/core/harness.ts`
- Modify: `src/cli/c2x.ts`
- Test: `src/core/__tests__/harness-detect.test.ts`

**Interfaces:**

```ts
export async function writeHarnessBrief(input: {
  session: SessionRecord;
  owner: HarnessId;
  dataDir: string;
}): Promise<string>;
```

Path: `path.join(dataDir, "briefs", `${session.id}.${owner}.c2x.md`)`.  
Nội dung: `renderCodexBrief` của brief `owner`. Throw nếu owner không có brief.

CLI:

```text
c2x doctor [--team a,b]
c2x brief --session <id> --owner <id>
```

`doctor` in `id\tok|missing\tbinary-or-hint`.  
`brief` ghi file, in absolute path.

- [ ] **Step 1: Write the failing test**

```ts
import { readFile } from "node:fs/promises";
import { writeHarnessBrief } from "@/core/harness";
import { mockPlanFromPack } from "@/core/planner";
import { planToBriefs, renderCodexBrief } from "@/core/brief";

it("writes only that owner brief under data/briefs", async () => {
  const pack = packWorkspace({
    goal: "Sửa createTask",
    files: DEMO_FILES,
    budgetTokens: 2000,
  });
  const plan = mockPlanFromPack(pack, "c2x_b1", ["codex", "claude-code"]);
  const session = {
    ...createSession({
      goal: pack.goal,
      planner: "mock",
      plannerChoice: "mock",
      harnessTeam: ["codex", "claude-code"],
      budgetTokens: 2000,
      workspaceSource: "demo",
    }),
    plan,
    briefs: planToBriefs(plan),
  };
  const dir = await mkdtemp(path.join(os.tmpdir(), "c2x-data-"));
  const briefPath = await writeHarnessBrief({ session, owner: "codex", dataDir: dir });
  expect(briefPath).toBe(path.join(dir, "briefs", "c2x_b1.codex.c2x.md"));
  const text = await readFile(briefPath, "utf8");
  expect(text).toBe(renderCodexBrief(session.briefs[0]!));
  expect(text).toMatch(/OWNER:\s*codex/);
  expect(text).not.toMatch(/OWNER:\s*claude-code/);
  await rm(dir, { recursive: true, force: true });
});
```

Dùng `taskId` từ `createSession` — **không** hard-code `c2x_b1` trong expect path. Sửa test: `mockPlanFromPack(pack, session.id, ...)` sau khi tạo session, hoặc expect `path.join(dir, "briefs", `${session.id}.codex.c2x.md`)`.

Bản đúng:

```ts
  const created = createSession({ /* ... */ });
  const plan = mockPlanFromPack(pack, created.id, ["codex", "claude-code"]);
  const session = { ...created, plan, briefs: planToBriefs(plan), brief: planToBriefs(plan)[0] ?? null };
  const briefPath = await writeHarnessBrief({ session, owner: "codex", dataDir: dir });
  expect(briefPath).toBe(path.join(dir, "briefs", `${session.id}.codex.c2x.md`));
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/core/__tests__/harness-detect.test.ts`

Expected: FAIL — `writeHarnessBrief` missing.

- [ ] **Step 3: Write minimal implementation**

`mkdir(..., { recursive: true })` rồi `writeFile`. CLI commands như trên; `doctor` map `detectHarnessTeam(teamFromOpts(opts) or HARNESS_IDS)` — dùng cache detect; không spawn `which`.

- [ ] **Step 4: Run tests + help**

```bash
npx vitest run
npx tsx src/cli/c2x.ts doctor
npx tsx src/cli/c2x.ts brief --help
```

Expected: tests PASS; `doctor` in 5 dòng (ok hoặc missing).

- [ ] **Step 5: Commit**

```bash
git add src/core/harness.ts src/cli/c2x.ts src/core/__tests__/harness-detect.test.ts
git commit -m "feat: write per-harness briefs and c2x doctor"
```

### Task 13: Skill path + dashboard hint detect

**Files:**
- Modify: `skill/SKILL.md` — thay “replace-with-absolute-path” instruction: `c2x skill-install` (lệnh thật).
- Modify: `src/cli/c2x.ts` — `skill-install`
- Modify: `src/components/studio-client.tsx` — dưới mỗi lane, nếu muốn, chỉ hiện text tĩnh “Brief: copy hoặc `c2x brief --session … --owner …`”. Không gọi detect từ browser (tránh lệ PATH server).

`skill-install` copy `skill/SKILL.md` → `path.join(os.homedir(), ".codex/skills/chat-to-x/SKILL.md")`, replace dòng checkout bằng `process.cwd()`.

- [ ] **Step 1: Test skill-install vào homedir giả**

Đừng ghi `~` thật trong test. Export:

```ts
export async function installSkill(input: {
  repoRoot: string;
  skillHome: string;
}): Promise<string>;
```

Test: `skillHome` tạm, file chứa `repoRoot`.

- [ ] **Step 2: Run test — fail missing export**

- [ ] **Step 3: Implement `installSkill` in `src/core/harness.ts`; CLI wraps it với `os.homedir()`**

- [ ] **Step 4: `npx vitest run && npx tsc --noEmit`**

- [ ] **Step 5: Commit**

```bash
git add skill/SKILL.md src/cli/c2x.ts src/core/harness.ts src/core/__tests__/harness-detect.test.ts src/components/studio-client.tsx
git commit -m "feat: install the chat-to-x skill with the real repo path"
```

---

## Chunk 4: Slice 4–7 (làm sau khi 1–3 xanh)

Mỗi slice dưới đây vẫn là một đơn vị review riêng. Đừng làm trước khi user duyệt spec và 1–3 xong.

### Task 14: Slice 4 — heuristic packet generic

**Files:**
- Modify: `src/core/packets.ts` (`packetActions`, `packetTests`, `packetCriteria`)
- Modify: `src/core/__tests__/packets.test.ts`

**Interfaces:** giữ `splitWorkPackets(...)` **chỉ** khi planner không gửi `PACKETS`. Bỏ nhánh `/createTask|create|thêm/` sinh câu “Fix createTask so new rows persist…”. Thay bằng câu gắn `goal` (cắt 120 ký tự) + vai trò.

**Cấm** hàm “smart-split” tự đổi `owner`/cắt file khi `PACKETS` đã có. Cảnh báo chồng file: `export function packetOverlapWarning(packets: WorkPacket[]): string | null` — `null` nếu `packetsHaveDisjointFiles`; import vẫn giữ packet planner.

- [ ] **Step 1: Đổi test demo**

`packets.test.ts` hiện expect file `tasks.ts` / test paths — **giữ** (vẫn đúng vì fixture Nhiệm vụ). Thêm test:

```ts
  it("does not mention createTask when the goal is unrelated", () => {
    const packets = splitWorkPackets({
      team: ["codex"],
      files: ["src/theme.ts"],
      goal: "Add a dark mode toggle",
      taskId: "c2x_dark",
    });
    expect(packets[0]?.actions.join(" ")).not.toMatch(/createTask/i);
    expect(packets[0]?.actions.join(" ")).toMatch(/dark mode/i);
  });
```

- [ ] **Step 2: Run — fail vì action vẫn nói createTask / persist store**

- [ ] **Step 3: Generic actions; `packetOverlapWarning`**

- [ ] **Step 4: `npx vitest run src/core/__tests__/packets.test.ts`**

- [ ] **Step 5: Commit** `fix: stop hard-coding Nhiệm vụ actions into every packet`

### Task 15: Slice 5 — `bin` `chat-to-x` + lệnh `sessions`

**Files:**
- Modify: `package.json` — `"name": "chat-to-x"` giữ; `"private": true` giữ; `"bin": { "chat-to-x": "src/cli/c2x.ts", "c2x": "src/cli/c2x.ts" }`
- Modify: `src/cli/c2x.ts` — `sessions` in `id state planner team`
- Modify: `README.md` — stranger chạy `npx chat-to-x` / `npm run c2x -- …`. Một dòng: **không** `npx c2x` (npm `c2x` là CSS→XPath).

- [ ] **Step 1: Assert package.json will not publish as `c2x`**

Thêm test hoặc check trong `src/core/__tests__/harness-detect.test.ts` (hoặc file nhỏ `package-meta.test.ts`):

```ts
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

describe("npm package identity", () => {
  it("stays chat-to-x and private so we never squat the CSS c2x package", () => {
    const pkg = JSON.parse(
      readFileSync(path.join(process.cwd(), "package.json"), "utf8"),
    ) as { name: string; private?: boolean; bin?: Record<string, string> };
    expect(pkg.name).toBe("chat-to-x");
    expect(pkg.private).toBe(true);
    expect(pkg.name).not.toBe("c2x");
  });
});
```

Sau khi thêm `bin`, cập nhật test: `expect(pkg.bin?.["chat-to-x"]).toBe("src/cli/c2x.ts")`.

- [ ] **Step 2: Run test — `bin.chat-to-x` missing (fail sau Step 3 kỳ vọng pass)**

Run: `npx vitest run src/core/__tests__/package-meta.test.ts`

Expected lần đầu: FAIL nếu file chưa có; sau Step 3: `private` true, name `chat-to-x`.

- [ ] **Step 3: Implement `sessions` + `bin`; không `npm publish`**

- [ ] **Step 4:**

```bash
npx tsx src/cli/c2x.ts sessions
npx vitest run src/core/__tests__/package-meta.test.ts
```

Expected: exit 0; `name` vẫn `chat-to-x`.

- [ ] **Step 5: Commit** `feat: expose chat-to-x bin alias and list sessions`

Không `npm publish`. Không đổi `"name"` thành `c2x`.

### Task 16: Slice 6 — checkpoint + HANDOFF + maxIterations

**Files:**
- Modify: `src/core/types.ts` — `iterationLimit: number` trên session (default 12)
- Modify: `src/core/protocol.ts` — `handoffMessage(...)`
- Modify: `src/core/run-loop.ts` — từ chối PLAN mới khi `iteration >= iterationLimit` → `BLOCKED` với `NEEDS: confirm continue`
- Test: `src/core/__tests__/protocol.test.ts`

**Interfaces:**

```ts
export function handoffMessage(input: {
  taskId: string;
  iteration: number;
  originalGoal: string;
  progress: string;
  currentState: ProtocolState;
  knownIssues: string;
  nextExpectedStep: string;
}): string;
```

Sections đúng C2C: `ORIGINAL_GOAL`, `PROGRESS`, `CURRENT_STATE`, `KNOWN_ISSUES`, `NEXT_EXPECTED_STEP`. Tag `[C2X]`. `assertControlBudget`.

- [ ] **Step 1: Test round-trip parse `HANDOFF` + budget < 1200**

- [ ] **Step 2: Fail — helper missing**

- [ ] **Step 3: Implement encode; CLI `c2x handoff --session <id>` in message**

- [ ] **Step 4: vitest protocol + review-paste vẫn PASS**

- [ ] **Step 5: Commit** `feat: emit [C2X] HANDOFF from a local checkpoint`

### Task 17: Slice 7 — không code trừ khi user xin plan riêng

MCP loopback (không Cloudflare, không cookie, không reverse-proxy ChatGPT) là subsystem riêng. **Không** fork OAuth/tunnel C2C vào repo này. **Không** thêm file trong v1. **Không bao giờ** public tunnel cho first-run. Thứ tự latency: dán v1 (đã khóa) → drop file (Task L, chưa làm) → loopback MCP (chỉ khi user xin). Nếu user xin MCP: plan mới `docs/superpowers/plans/YYYY-MM-DD-c2x-loopback-mcp.md` với ràng buộc bind `127.0.0.1` only.

---

## Chunk L: Slice L — next latency (không implement v1)

**Không làm trong pass này / v1.** Agent đọc plan **không** được commit code Task L trừ khi user xin rõ. Vẫn ghi task đủ TDD để làm sau — nhanh hơn dán browser, **vẫn không tunnel**.

### Task L1: Drop `.c2x/briefs/<harness>.md` + skill đọc

**Files (khi được phép làm):**
- Modify: `src/core/harness.ts` — `writeWorkspaceBriefDrop`
- Modify: `src/core/run-loop.ts` — gọi lúc `applyPlan` / import PLAN
- Modify: `skill/SKILL.md` — đọc drop của **chính** harness
- Modify: `.gitignore` — `.c2x/briefs/`
- Test: `src/core/__tests__/workspace-brief-drop.test.ts`

**Interfaces:**

```ts
export async function writeWorkspaceBriefDrop(input: {
  workspaceRoot: string;
  session: SessionRecord;
  owner: HarnessId;
}): Promise<string>;
```

Path: `path.join(input.workspaceRoot, ".c2x", "briefs", `${input.owner}.md`)`.  
Nội dung: `renderCodexBrief` đúng `OWNER`. Throw nếu không có brief owner.  
Khác `dataDir/briefs/<taskId>.<owner>.c2x.md` (Slice 3, kho session).  
Khi team đổi: ghi owner còn lại; `rm` file owner không còn trong `harnessTeam`.  
Skill: nếu `.c2x/briefs/<id-của-mình>.md` tồn tại thì đọc nó thay vì chờ paste; **cấm** đọc brief owner khác; **cấm** plan/review.  
`.gitignore`: `.c2x/briefs/`. Không spawn, không MCP, không path từ browser.

- [ ] **Step 1: Write the failing test** (chỉ khi user xin Slice L)

```ts
import { mkdtemp, readFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { planToBriefs, renderCodexBrief } from "@/core/brief";
import { writeWorkspaceBriefDrop } from "@/core/harness";
import { DEMO_FILES } from "@/core/fixtures/demo-workspace";
import { packWorkspace } from "@/core/packer";
import { mockPlanFromPack } from "@/core/planner";
import { createSession } from "@/core/session";

describe("workspace brief drop", () => {
  it("writes only that owner brief under .c2x/briefs/<harness>.md", async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), "c2x-ws-"));
    const pack = packWorkspace({
      goal: "Sửa createTask",
      files: DEMO_FILES,
      budgetTokens: 2000,
    });
    const created = createSession({
      goal: pack.goal,
      planner: "mock",
      plannerChoice: "mock",
      harnessTeam: ["codex", "claude-code"],
      budgetTokens: 2000,
      workspaceSource: "demo",
    });
    const plan = mockPlanFromPack(pack, created.id, ["codex", "claude-code"]);
    const briefs = planToBriefs(plan);
    const session = { ...created, plan, briefs, brief: briefs[0] ?? null, pack };
    const briefPath = await writeWorkspaceBriefDrop({
      workspaceRoot: root,
      session,
      owner: "codex",
    });
    expect(briefPath).toBe(path.join(root, ".c2x", "briefs", "codex.md"));
    const text = await readFile(briefPath, "utf8");
    expect(text).toBe(renderCodexBrief(session.briefs[0]!));
    expect(text).toMatch(/OWNER:\s*codex/);
    expect(text).not.toMatch(/OWNER:\s*claude-code/);
    await rm(root, { recursive: true, force: true });
  });
});
```

- [ ] **Step 2–5:** Fail missing export → implement `mkdir` + `writeFile` → `npx vitest run src/core/__tests__/workspace-brief-drop.test.ts` PASS → commit `feat: drop per-harness briefs for local skills` **chỉ khi user xin**.

---

## Thứ tự implement và verify

Tính năng: **F1–F3** (cầu nhanh) rồi Task 1 → 13 (Slice 1 đầu tiên về tính năng paste). Slice 0 (Task 0) và Slice R (Task R1–R2) song song, không chặn Slice 1; **R1 trước Task 11** (adapter đọc catalog); **F1 trước Task 3** (`reusedPack`). Sau mỗi chunk: `npx vitest run && npx tsc --noEmit`. **Không làm Task L / 17** trong v1.

Verify tích lũy (không phải một screenshot):

1. `chatgpt-web` + 2 harness: import PLAN → 2 brief `OWNER` khác file. Prompt/brief sinh local (không spawn ChatGPT).
2. Import `DONE` trước execute → lỗi. Sau execute + `runReview` → prompt, `review === null`. Import `DONE` → `DONE`.
3. Repo git tạm: `c2x record` điền `changedFiles`; `[C2X] EXECUTED` không có hunk.
4. `c2x doctor` / `c2x brief` không spawn process harness.
5. `routeRole` plan/review vẫn không phải harness (`router-savings.test.ts`).
6. `HARNESS_CATALOG.map(e => e.id)` === `HARNESS_IDS`; bật/tắt harness trên UI không `fetch` catalog.
7. `demo` + `mock` không walk `node_modules`; walk `repo` cắt 80 / 120 KB / 250 ms.
8. Import PLAN lần 2: `loadWorkspaceFiles` không được gọi; `pack` cùng reference. Hung planner API abort < 1s với `timeoutMs: 40`.
9. `npm run dev` / `start` chứa `127.0.0.1`. Control dump 3k token bị `assertControlBudget` từ chối.

## Coverage vs spec

| Spec | Task |
| --- | --- |
| §15 + §15.3 OSS hygiene | 0 |
| §17 catalog registry `Record<HarnessId, …>` | R1 (`catalog-registry.test.ts`) |
| §18 tốc độ (walk 250 ms, packer sync, demo default) | R2 + ràng buộc mọi task |
| §19 thêm harness 10 phút | Task 0 `CONTRIBUTING.md` (copy §19) |
| §20.2 cầu v1 (reuse pack, budget, localhost) | F1–F3 (`fast-link.test.ts`) |
| §20.2 planner API fail-fast | F2 |
| §20.3 drop `.c2x/briefs/` | L1 (cố ý không code v1) |
| §6 vòng dán REVIEW | 2–6 |
| §6.1 importControlMessage | 4–5 |
| §6.2 buildReviewPastePrompt | 2 |
| §6.3 reviewPastePrompt | 1 |
| §7 records + git + CLI `--cwd` | 7–10 |
| §8 adapter + doctor + skill | 11–13 (binaries từ catalog; cache PATH) |
| §9 packet planner thắng | 14 |
| §10 bin `chat-to-x` / HANDOFF | 15–16 |
| §11 / MCP không làm; không marketplace; không public tunnel | 17 (cố ý không code) |
| §15.1 cấm publish `c2x` | 15 (`package-meta.test.ts`) |
| Router/catalog giữ; không nhân switch | mọi task; R1 + regression |

## Self-review (plan)

- Không còn bước “add validation” / “TBD” / “similar to Task N”.
- Tên hàm nhất quán: `reusedPack`, `buildReviewPastePrompt`, `applyImportedReview`, `importControlMessage`, `collectGitMetadata`, `applyExecutionRecord`, `runRecord`, `resolveWorkspaceRoot`, `detectHarness`, `writeHarnessBrief`, `writeWorkspaceBriefDrop` (L, chưa làm), `installSkill`, `handoffMessage`.
- Hằng số nhất quán: `CONTROL_BUDGET_DEFAULT = 1200`, `CONTROL_BUDGET_MAX = 2000`, `PLANNER_API_TIMEOUT_MS = 8000`, `PLANNER_API_MAX_TOKENS = 1200`.
- `SessionRecord.reviewPastePrompt` và `records` xuất hiện từ Task 1 và 7; Task 4/9 tiêu thụ đúng tên đó.
- `import-plan` URL giữ để dashboard cũ không gãy; hành vi mở rộng.
- Registry: `HARNESS_BY_ID` / `getHarness` / `binaries` — Task R1 định nghĩa; Task 11 chỉ đọc, không copy roster.
- Tốc độ packer/UI: `MAX_WALK_MS = 250` Task R2; packer vẫn sync; không task nào được thêm `--spawn` hay `fetch` catalog mỗi click.
- Cầu planner: F1 tái sử dụng pack; F2 abort hung fetch; F3 localhost + trần token. Không task v1 được thêm tunnel / Computer Use / spawn ChatGPT.
- Task 3 dùng `reusedPack` — F1 phải trước. Task L không chạy trong v1.
