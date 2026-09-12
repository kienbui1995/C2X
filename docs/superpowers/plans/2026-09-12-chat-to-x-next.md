# chat-to-x Next Phase Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [x]`) syntax for tracking.

**Goal:** Làm cầu harness↔planner **nhanh hơn dán clipboard** bằng drop brief local (Slice L), rồi đánh bóng tốc độ dashboard / doctor / empty-error / “thêm harness 10 phút”, rồi (tuỳ chọn) MCP loopback `127.0.0.1`, rồi checklist OSS — không fork C2C, không tunnel, không publish `c2x`.

**Architecture:** Baseline v1 đã ship (plan 2026-09-12). Phase này **không** viết lại packer / router / registry. Slice L ghi `.c2x/briefs/<harness>.md` lúc PLAN (cùng `planToBriefs`, tái sử dụng pack), skill/Codex chỉ đọc file `OWNER` của mình. Polish tách PATH-scan khỏi first paint. MCP (nếu user xin) là JSON-RPC HTTP bind cứng `127.0.0.1`, chỉ đọc, không OAuth. OSS launch = docs + việc người maintain bật Public — không bịa GitHub URL.

**Tech Stack:** TypeScript, Next.js 16, Commander CLI `src/cli/c2x.ts`, vitest (`src/core/__tests__/**/*.test.ts`), JSON store `data/` (`C2X_DATA_DIR` / `FRUGAL_DATA_DIR`). **Không** thêm dependency npm trừ khi một task nói rõ (không task nào trong plan này thêm package).

## Global Constraints

- Node.js 20+. Imports ở đầu file. Switch union/enum phải `default: assertNever(...)`.
- `routeRole("plan"|"review")` không được trả `HarnessId`. Không phá `packets.test.ts` / `router-savings.test.ts` / `fast-link.test.ts` / `package-meta.test.ts`.
- Không OAuth, không Cloudflare tunnel, không cookie, không reverse-proxy ChatGPT, không MCP ghi, không spawn harness / ChatGPT. **First-run không bao giờ public tunnel.**
- Dashboard / `PUT /api/config` / body API **không** nhận filesystem path. Drop brief dùng `resolveWorkspaceRoot({ cwd, env })` — HTTP **không** truyền `cwd`. `dev`/`start` bind `127.0.0.1`.
- `package.json` `"name": "chat-to-x"`, giữ `"private": true`. Cấm publish npm `c2x`. Docs stranger: `npx chat-to-x` / `npm run c2x`. **Không** `npx c2x`.
- `npm test` không đòi API key hay mạng planner. Control message: `CONTROL_BUDGET_DEFAULT = 1200`, `CONTROL_BUDGET_MAX = 2000`.
- Copy UI/docs mặc định tiếng Việt; id protocol / catalog / hàm giữ English.
- Registry: một entry `HARNESS_BY_ID`. Cấm `case "codex":` mới trong studio / CLI / router / `packets.ts`.
- Tái sử dụng `session.pack` giữa iteration. Cấm `loadWorkspaceFiles` trên import/review. Slice L chỉ thêm I/O ghi brief, không walk repo.
- Origin/GitHub **Private → Public** là settings, không phải slice code. Không commit URL repo giả.

Spec (đã khóa): [docs/superpowers/specs/2026-09-12-chat-to-x-features-design.md](../specs/2026-09-12-chat-to-x-features-design.md) — §17 registry, §18 tốc độ, §19 thêm harness 10 phút, **§20.3 drop local**.

Baseline đã ship (không lập lại như việc mới): [docs/superpowers/plans/2026-09-12-chat-to-x-features.md](./2026-09-12-chat-to-x-features.md) — Slice 0, R, F, 1–6. Tests hiện **71**. Leftover L + 7 trên plan đó đã **chuyển sang file này**.

---

## Baseline đã ship (2026-09-12) — đừng làm lại

| Đã có | Chứng |
| --- | --- |
| Registry `HARNESS_BY_ID` / `PROVIDER_BY_ID` | `catalog-registry.test.ts` |
| Trần walk 80 / 120 KB / 250 ms | `workspace-walk.test.ts` |
| `reusedPack`, planner timeout 8s / 1200 token, control budget, localhost | `fast-link.test.ts` |
| Vòng dán PLAN + REVIEW | `review-paste.test.ts` |
| `record` + git metadata + `--cwd` | `records.test.ts`, `workspace-root.test.ts` |
| `doctor` / `brief` (dataDir) / `skill-install` | `harness-detect.test.ts` |
| Packet generic, planner thắng | `packets.test.ts` |
| `bin` `chat-to-x` + `c2x`, `sessions`, `private: true` | `package-meta.test.ts` |
| `HANDOFF` + `iterationLimit` | `protocol.test.ts` |
| OSS hygiene | `NOTICE`, `CONTRIBUTING.md`, `CODE_OF_CONDUCT.md`, `SECURITY.md`, `/data/*` ignore |

**Phase này:** L + P + M + O đã ship. Việc người còn lại: bật Public trên Origin/Settings; chụp screenshot thật; không `npm publish` trừ khi chủ động publish `chat-to-x`.

---

## File structure (khóa trước khi làm)

**Slice L**

- `src/core/harness.ts` — `workspaceBriefPath`, `writeWorkspaceBriefDrop`, `syncWorkspaceBriefDrops`, `persistWorkspaceBriefs`
- `src/core/run-loop.ts` — gọi persist lúc session `PLAN` (sau `applyPlan` / import PLAN)
- `src/cli/c2x.ts` — `brief --drop` + `--cwd`
- `skill/SKILL.md` — đọc đúng `.c2x/briefs/<id-của-mình>.md`
- `.gitignore` — `.c2x/briefs/`
- Create: `.c2x/README.md` (giải thích thư mục; không chứa brief)
- `src/lib/i18n.ts` + `src/components/studio-client.tsx` — hint drop
- Test: `src/core/__tests__/workspace-brief-drop.test.ts`

**Slice P**

- `src/core/harness.ts` — TTL cache + `clearDetectCache`
- `src/app/page.tsx` — **không** `await getDoctorStatus()`
- `src/components/studio-client.tsx` + `src/lib/i18n.ts` — fetch `/api/doctor` sau paint; empty/error
- `CONTRIBUTING.md` — checklist 10 phút
- Test: `src/core/__tests__/harness-detect.test.ts`, `src/core/__tests__/dashboard-latency.test.ts`

**Slice M (tuỳ chọn, sau)**

- Create: `src/core/mcp-loopback.ts` — bind assert + tool thuần (không dep mới)
- `src/cli/c2x.ts` — `mcp`
- `SECURITY.md` — một đoạn loopback
- Test: `src/core/__tests__/mcp-loopback.test.ts`

**Slice O**

- `README.md`, `docs/architecture.md`
- Create: `docs/screenshots/README.md` (danh sách ảnh cần chụp; **không** commit ảnh giả)
- Không thêm URL `github.com/<ai-đó>/chat-to-x`

---

## Thứ tự slice (OSS + vibe-coding + thêm harness dễ)

| # | Id | Làm khi nào | Chặn first-run? |
| --- | --- | --- | --- |
| 1 | **L** | **Đầu tiên** khi user nói triển khai | Không — nhanh hơn dán |
| 2 | **P** | Ngay sau L | Không |
| 3 | **M** | Chỉ khi user xin MCP | Không; không chặn L/P |
| 4 | **O** | Sau P (docs); Public = tay maintain | Không |
| — | YAGNI | Không làm: tunnel, OAuth, spawn, publish `c2x`, quota API thật, `--repack`, marketplace | — |

**Slice đầu tiên khi triển khai: L (Task L1).**

---

## Chunk L: Slice L — drop brief workspace (cầu nhanh)

### Vì sao

Dán browser vẫn là điểm chậm còn lại. Drop file local **nhanh hơn clipboard**, skill/Codex đọc ngay, **vẫn không tunnel / không spawn**. Khác `data/briefs/<taskId>.<owner>.c2x.md` (kho session, Slice 3 đã ship): drop là `.c2x/briefs/<harness>.md` trong cwd workspace để harness đang mở repo đọc được.

Khóa spec §20.3: path `OWNER.md`; nội dung `renderCodexBrief` đúng owner; xoá file owner không còn trong team; skill **cấm** đọc brief đồng đội; gitignore; HTTP không gửi path.

### Rủi ro

| Rủi ro | Cách giữ |
| --- | --- |
| Test `runPlan` ghi `.c2x/briefs/` vào `/workspace` | `persistWorkspaceBriefs` dùng `resolveWorkspaceRoot`; mọi test gọi `runPlan` / `importPlan` phải set `C2X_WORKSPACE` = tmp |
| Skill đọc cả thư mục | SKILL.md: chỉ đúng một file id; cấm `ls` rồi đọc hết |
| Brief đồng đội lọt | `writeWorkspaceBriefDrop` throw nếu không có brief owner; assert `OWNER:` khớp |
| Walk repo lúc drop | Chỉ `writeFile` / `readdir` thư mục brief; không `loadWorkspaceFiles` |
| Path từ browser | Không đọc body `cwd` / `workspaceRoot` |

### Task L1: `writeWorkspaceBriefDrop`

**Files:**
- Modify: `src/core/harness.ts`
- Modify: `src/core/index.ts` (đã `export * from harness` — không cần dòng mới nếu export named từ harness)
- Test: `src/core/__tests__/workspace-brief-drop.test.ts`

**Interfaces:**
- Consumes: `renderCodexBrief`, `SessionRecord.briefs`, `HarnessId`
- Produces:

```ts
export function workspaceBriefPath(workspaceRoot: string, owner: HarnessId): string;

export async function writeWorkspaceBriefDrop(input: {
  workspaceRoot: string;
  session: SessionRecord;
  owner: HarnessId;
}): Promise<string>;
```

`workspaceBriefPath` = `path.join(workspaceRoot, ".c2x", "briefs", `${owner}.md`)`.  
Nội dung = `renderCodexBrief` của brief `owner`. Throw `Error` có chữ `brief` / `owner` nếu không có brief. **Không** ghi brief đồng đội vào file này.

- [x] **Step 1: Write the failing test**

Tạo `src/core/__tests__/workspace-brief-drop.test.ts`:

```ts
import { mkdtemp, readFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { planToBriefs, renderCodexBrief } from "@/core/brief";
import { DEMO_FILES } from "@/core/fixtures/demo-workspace";
import {
  workspaceBriefPath,
  writeWorkspaceBriefDrop,
} from "@/core/harness";
import { packWorkspace } from "@/core/packer";
import { mockPlanFromPack } from "@/core/planner";
import { createSession } from "@/core/session";

function sessionWithTeam(team: readonly ("codex" | "claude-code")[]) {
  const pack = packWorkspace({
    goal: "Sửa createTask",
    files: DEMO_FILES,
    budgetTokens: 2000,
  });
  const created = createSession({
    goal: pack.goal,
    planner: "mock",
    plannerChoice: "mock",
    harnessTeam: team,
    budgetTokens: 2000,
    workspaceSource: "demo",
  });
  const plan = mockPlanFromPack(pack, created.id, team);
  const briefs = planToBriefs(plan);
  return { ...created, plan, briefs, brief: briefs[0] ?? null, pack };
}

describe("writeWorkspaceBriefDrop", () => {
  it("writes only that owner brief under .c2x/briefs/<harness>.md", async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), "c2x-ws-"));
    const session = sessionWithTeam(["codex", "claude-code"]);
    const briefPath = await writeWorkspaceBriefDrop({
      workspaceRoot: root,
      session,
      owner: "codex",
    });
    expect(briefPath).toBe(path.join(root, ".c2x", "briefs", "codex.md"));
    expect(briefPath).toBe(workspaceBriefPath(root, "codex"));
    const text = await readFile(briefPath, "utf8");
    expect(text).toBe(renderCodexBrief(session.briefs[0]!));
    expect(text).toMatch(/OWNER:\s*codex/);
    expect(text).not.toMatch(/OWNER:\s*claude-code/);
    await rm(root, { recursive: true, force: true });
  });

  it("throws when the owner has no precomputed brief", async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), "c2x-ws-"));
    const session = sessionWithTeam(["codex"]);
    await expect(
      writeWorkspaceBriefDrop({
        workspaceRoot: root,
        session,
        owner: "claude-code",
      }),
    ).rejects.toThrow(/brief|owner/i);
    await rm(root, { recursive: true, force: true });
  });
});
```

- [x] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/core/__tests__/workspace-brief-drop.test.ts`

Expected: FAIL — `writeWorkspaceBriefDrop` / `workspaceBriefPath` chưa export.

- [x] **Step 3: Write minimal implementation**

Đầu `src/core/harness.ts` đã có `mkdir`, `writeFile`, `path`, `renderCodexBrief`. Thêm (cùng file, import sẵn):

```ts
export function workspaceBriefPath(workspaceRoot: string, owner: HarnessId): string {
  return path.join(workspaceRoot, ".c2x", "briefs", `${owner}.md`);
}

export async function writeWorkspaceBriefDrop(input: {
  workspaceRoot: string;
  session: SessionRecord;
  owner: HarnessId;
}): Promise<string> {
  const brief =
    input.session.briefs.find((item) => item.owner === input.owner) ??
    (input.session.brief?.owner === input.owner ? input.session.brief : null);
  if (!brief) {
    throw new Error(`No precomputed brief for owner ${input.owner}.`);
  }
  const dest = workspaceBriefPath(input.workspaceRoot, input.owner);
  await mkdir(path.dirname(dest), { recursive: true });
  await writeFile(dest, renderCodexBrief(brief), "utf8");
  return dest;
}
```

Không `switch (owner)`. Không spawn.

- [x] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/core/__tests__/workspace-brief-drop.test.ts`

Expected: PASS

- [x] **Step 5: Commit**

```bash
git add src/core/harness.ts src/core/__tests__/workspace-brief-drop.test.ts
git commit -m "feat: write per-harness workspace brief drops"
```

### Task L2: `syncWorkspaceBriefDrops` — ghi đội, xoá leftover

**Files:**
- Modify: `src/core/harness.ts`
- Test: `src/core/__tests__/workspace-brief-drop.test.ts`

**Interfaces:**
- Consumes: `writeWorkspaceBriefDrop`, `isHarnessId`, `session.harnessTeam`
- Produces:

```ts
export async function syncWorkspaceBriefDrops(input: {
  workspaceRoot: string;
  session: SessionRecord;
}): Promise<string[]>;
```

Với mỗi `owner` ∈ `session.harnessTeam`: gọi `writeWorkspaceBriefDrop`.  
`readdir` `.c2x/briefs/`: nếu tên là `<id>.md` và `isHarnessId(id)` và id **không** còn trong team → `rm` file đó.  
File không phải harness id (ví dụ `notes.md`) **giữ nguyên**.

Import `readdir`, `rm` từ `node:fs/promises` và `isHarnessId` từ `@/core/types` ở **đầu** `harness.ts`.

- [x] **Step 1: Write the failing test**

Thêm vào `workspace-brief-drop.test.ts`:

```ts
import { mkdir, writeFile } from "node:fs/promises";
import { syncWorkspaceBriefDrops } from "@/core/harness";

describe("syncWorkspaceBriefDrops", () => {
  it("writes every teammate and removes leftover harness files only", async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), "c2x-sync-"));
    const dir = path.join(root, ".c2x", "briefs");
    await mkdir(dir, { recursive: true });
    await writeFile(path.join(dir, "kiro-cli.md"), "stale", "utf8");
    await writeFile(path.join(dir, "notes.md"), "keep", "utf8");
    const session = sessionWithTeam(["codex", "claude-code"]);
    const written = await syncWorkspaceBriefDrops({ workspaceRoot: root, session });
    expect(written).toEqual([
      path.join(dir, "codex.md"),
      path.join(dir, "claude-code.md"),
    ]);
    expect(await readFile(path.join(dir, "codex.md"), "utf8")).toMatch(/OWNER:\s*codex/);
    expect(await readFile(path.join(dir, "claude-code.md"), "utf8")).toMatch(
      /OWNER:\s*claude-code/,
    );
    await expect(readFile(path.join(dir, "kiro-cli.md"), "utf8")).rejects.toMatchObject({
      code: "ENOENT",
    });
    expect(await readFile(path.join(dir, "notes.md"), "utf8")).toBe("keep");
    await rm(root, { recursive: true, force: true });
  });
});
```

- [x] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/core/__tests__/workspace-brief-drop.test.ts`

Expected: FAIL — `syncWorkspaceBriefDrops` chưa export.

- [x] **Step 3: Write minimal implementation**

```ts
import { existsSync } from "node:fs";
import { mkdir, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { isHarnessId, type HarnessId, type SessionRecord } from "@/core/types";

export async function syncWorkspaceBriefDrops(input: {
  workspaceRoot: string;
  session: SessionRecord;
}): Promise<string[]> {
  const written: string[] = [];
  for (const owner of input.session.harnessTeam) {
    written.push(
      await writeWorkspaceBriefDrop({
        workspaceRoot: input.workspaceRoot,
        session: input.session,
        owner,
      }),
    );
  }
  const dir = path.join(input.workspaceRoot, ".c2x", "briefs");
  let names: string[] = [];
  try {
    names = await readdir(dir);
  } catch {
    return written;
  }
  const keep = new Set(input.session.harnessTeam.map((id) => `${id}.md`));
  for (const name of names) {
    const id = name.endsWith(".md") ? name.slice(0, -3) : "";
    if (isHarnessId(id) && !keep.has(name)) {
      await rm(path.join(dir, name), { force: true });
    }
  }
  return written;
}
```

Gộp import `readdir` / `rm` / `isHarnessId` vào dòng import **đầu file** (không import trong hàm). `existsSync` / `readFile` đã có.

- [x] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/core/__tests__/workspace-brief-drop.test.ts`

Expected: PASS

- [x] **Step 5: Commit**

```bash
git add src/core/harness.ts src/core/__tests__/workspace-brief-drop.test.ts
git commit -m "feat: sync workspace brief drops when the harness team changes"
```

### Task L3: `persistWorkspaceBriefs` + hook PLAN

**Files:**
- Modify: `src/core/harness.ts` (`persistWorkspaceBriefs`)
- Modify: `src/core/run-loop.ts` (`runPlan`, `importPlan`, `importControlMessage`)
- Modify: `src/core/__tests__/fast-link.test.ts` — `C2X_WORKSPACE` tmp
- Modify: `src/core/__tests__/review-paste.test.ts` — `C2X_WORKSPACE` tmp
- Test: `src/core/__tests__/workspace-brief-drop.test.ts`

**Interfaces:**
- Consumes: `resolveWorkspaceRoot`, `syncWorkspaceBriefDrops`, `SessionRecord.state` / `briefs`
- Produces:

```ts
export async function persistWorkspaceBriefs(
  session: SessionRecord,
  cwd?: string,
): Promise<string[]>;
```

Quy tắc:

- Nếu `session.state !== "PLAN"` **hoặc** `session.briefs.length === 0` → `return []` (planner dán lúc `INIT` chưa có brief).
- `root = resolveWorkspaceRoot({ cwd, env: process.env })`.
- `return syncWorkspaceBriefDrops({ workspaceRoot: root, session })`.
- HTTP `runPlan` / `import*` **không** truyền `cwd`.

Hook (sau `upsertSession`, trước `return`):

1. `runPlan` — nhánh mock/API đã `applyPlan` (state `PLAN`).
2. `importPlan` — luôn sau PLAN import.
3. `importControlMessage` — sau `applyImportedReview` nếu `next.state === "PLAN"`.

**Cấm** gọi `loadWorkspaceFiles` trong persist.  
**Bắt buộc:** `beforeEach` của `fast-link.test.ts` và `review-paste.test.ts` set `process.env.C2X_WORKSPACE` = cùng tmp với data (hoặc tmp riêng) và `afterEach` `delete process.env.C2X_WORKSPACE` — nếu không, `npm test` sẽ ghi `.c2x/briefs/` vào checkout.

- [x] **Step 1: Write the failing test**

Thêm vào `workspace-brief-drop.test.ts`:

```ts
import { afterEach, beforeEach, vi } from "vitest";
import { persistWorkspaceBriefs } from "@/core/harness";
import { importControlMessage, importPlan, runPlan } from "@/core/run-loop";
import * as workspace from "@/core/workspace";

let dataDir = "";
let wsRoot = "";

beforeEach(async () => {
  dataDir = await mkdtemp(path.join(os.tmpdir(), "c2x-drop-data-"));
  wsRoot = await mkdtemp(path.join(os.tmpdir(), "c2x-drop-ws-"));
  process.env.FRUGAL_DATA_DIR = dataDir;
  process.env.C2X_WORKSPACE = wsRoot;
});

afterEach(async () => {
  delete process.env.FRUGAL_DATA_DIR;
  delete process.env.C2X_WORKSPACE;
  await rm(dataDir, { recursive: true, force: true });
  await rm(wsRoot, { recursive: true, force: true });
  vi.restoreAllMocks();
});

describe("persistWorkspaceBriefs", () => {
  it("is a no-op until the session is PLAN with briefs", async () => {
    const session = sessionWithTeam(["codex"]);
    const paths = await persistWorkspaceBriefs({ ...session, state: "INIT", briefs: [] }, wsRoot);
    expect(paths).toEqual([]);
  });

  it("drops briefs on mock runPlan and importPlan without walking the repo", async () => {
    const session = await runPlan({
      goal: "Sửa createTask",
      plannerChoice: "mock",
      harnessTeam: ["codex", "claude-code"],
      budgetTokens: 2000,
      workspaceSource: "demo",
    });
    expect(session.state).toBe("PLAN");
    const codexText = await readFile(path.join(wsRoot, ".c2x", "briefs", "codex.md"), "utf8");
    expect(codexText).toMatch(/OWNER:\s*codex/);
    expect(codexText).not.toMatch(/OWNER:\s*claude-code/);

    const walk = vi.spyOn(workspace, "loadWorkspaceFiles");
    await importPlan({
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
    expect(await readFile(path.join(wsRoot, ".c2x", "briefs", "codex.md"), "utf8")).toMatch(
      /OWNER:\s*codex/,
    );
  });
});
```

Trong `fast-link.test.ts` và `review-paste.test.ts`, mở rộng `beforeEach` / `afterEach` hiện có:

```ts
  process.env.C2X_WORKSPACE = dataDir; // cùng tmp; hoặc mkdtemp riêng
```

và `delete process.env.C2X_WORKSPACE` trong `afterEach`.

- [x] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/core/__tests__/workspace-brief-drop.test.ts`

Expected: FAIL — `persistWorkspaceBriefs` chưa export; `runPlan` chưa ghi drop.

- [x] **Step 3: Write minimal implementation**

Trong `harness.ts`:

```ts
import { resolveWorkspaceRoot } from "@/core/workspace";

export async function persistWorkspaceBriefs(
  session: SessionRecord,
  cwd?: string,
): Promise<string[]> {
  if (session.state !== "PLAN" || session.briefs.length === 0) {
    return [];
  }
  const workspaceRoot = resolveWorkspaceRoot({ cwd, env: process.env });
  return syncWorkspaceBriefDrops({ workspaceRoot, session });
}
```

Import `resolveWorkspaceRoot` ở **đầu** file.

Trong `run-loop.ts`, import `persistWorkspaceBriefs` ở đầu. Helper **cùng file** (không export nếu không cần):

```ts
async function persistPlanDrops(session: SessionRecord, cwd?: string): Promise<SessionRecord> {
  await persistWorkspaceBriefs(session, cwd);
  return session;
}
```

`runPlan`: `return persistPlanDrops(await upsertSession(session));` trên **mọi** nhánh return (INIT paste cũng gọi — persist no-op).  
`importPlan`: `return persistPlanDrops(await upsertSession(next));`  
`importControlMessage`:

```ts
    const next = await upsertSession(applyImportedReview(existing, input.raw));
    return persistPlanDrops(next);
```

và `return persistPlanDrops(await importPlan(input));` **hoặc** để `importPlan` tự persist — **không persist hai lần hại**, nhưng persist hai lần chỉ overwrite: chấp nhận nếu `importControlMessage` chỉ `return importPlan(input)` (đã persist trong `importPlan`). Nhánh review PLAN: phải gọi `persistPlanDrops` vì **không** đi `importPlan`.

- [x] **Step 4: Run tests**

```bash
npx vitest run src/core/__tests__/workspace-brief-drop.test.ts src/core/__tests__/fast-link.test.ts src/core/__tests__/review-paste.test.ts
npx tsc --noEmit
```

Expected: PASS. `git status` không có `.c2x/briefs/*.md` mới trong checkout.

- [x] **Step 5: Commit**

```bash
git add src/core/harness.ts src/core/run-loop.ts src/core/__tests__/workspace-brief-drop.test.ts src/core/__tests__/fast-link.test.ts src/core/__tests__/review-paste.test.ts
git commit -m "feat: persist workspace brief drops when a PLAN lands"
```

### Task L4: CLI `brief --drop` + `--cwd`

**Files:**
- Modify: `src/cli/c2x.ts`
- Test: `src/core/__tests__/workspace-brief-drop.test.ts` (hàm thuần đã cover; CLI gọi đúng hàm)

**Interfaces:**

```text
c2x brief --session <id> --owner <id> [--drop] [--cwd <path>]
```

Không `--drop`: giữ hành vi Slice 3 (`writeHarnessBrief` → `dataDir/briefs/<taskId>.<owner>.c2x.md`), in path đó.  
Có `--drop`: **thêm** `writeWorkspaceBriefDrop` với `resolveWorkspaceRoot({ cwd: opts.cwd })`, in path drop ở dòng hai (hoặc in cả hai, mỗi path một dòng).  
`--cwd` chỉ CLI. Không thêm flag path trên HTTP.

- [x] **Step 1: Write the failing CLI help check**

Sau Step 3 kỳ vọng `npx tsx src/cli/c2x.ts brief --help` chứa `drop` và `cwd`. Bước fail: chạy help **trước** khi sửa — không có `--drop`.

- [x] **Step 2: Run to verify CLI help fails the new contract**

Run: `npx tsx src/cli/c2x.ts brief --help`

Expected hiện tại: không có `--drop` / `--cwd`.

- [x] **Step 3: Write minimal implementation**

Đầu `c2x.ts` thêm import `writeWorkspaceBriefDrop` (cùng dòng import harness) và `resolveWorkspaceRoot` từ `@/core/workspace`.

Sửa command `brief`:

```ts
program
  .command("brief")
  .requiredOption("--session <id>")
  .requiredOption("--owner <id>")
  .option("--drop", "also write .c2x/briefs/<owner>.md in the workspace", false)
  .option("--cwd <path>", "workspace root for --drop (CLI only)")
  .action(async (opts: { session: string; owner: string; drop?: boolean; cwd?: string }) => {
    if (!isHarnessId(opts.owner)) {
      throw new Error(`unknown harness: ${opts.owner}`);
    }
    const session = await getSession(opts.session);
    if (!session) {
      throw new Error(`unknown session: ${opts.session}`);
    }
    const briefPath = await writeHarnessBrief({
      session,
      owner: opts.owner,
      dataDir: dataDir(),
    });
    process.stdout.write(`${briefPath}\n`);
    if (opts.drop) {
      const dropPath = await writeWorkspaceBriefDrop({
        workspaceRoot: resolveWorkspaceRoot({ cwd: opts.cwd, env: process.env }),
        session,
        owner: opts.owner,
      });
      process.stdout.write(`${dropPath}\n`);
    }
  });
```

- [x] **Step 4: Verify**

```bash
npx tsx src/cli/c2x.ts brief --help
npx vitest run src/core/__tests__/workspace-brief-drop.test.ts src/core/__tests__/harness-detect.test.ts
```

Expected: help có `drop` và `cwd`; tests PASS.

- [x] **Step 5: Commit**

```bash
git add src/cli/c2x.ts
git commit -m "feat: add c2x brief --drop for the workspace skill path"
```

### Task L5: Skill đọc drop + gitignore + `.c2x/README.md`

**Files:**
- Modify: `skill/SKILL.md`
- Modify: `.gitignore`
- Create: `.c2x/README.md`
- Test: `src/core/__tests__/workspace-brief-drop.test.ts` (đọc file skill / gitignore)

**Interfaces:** không có runtime API. Hợp đồng skill (English trong SKILL.md, vì Codex skill là English):

```text
After PLAN, if `.c2x/briefs/<your-harness-id>.md` exists, read THAT file
and execute it. Do not read other files in `.c2x/briefs/`.
Do not plan or review.

Harness id map:
- Codex → codex
- Claude Code → claude-code
- Grok Build → grok-build
- OpenCode → opencode
- Kiro CLI → kiro-cli
```

`.gitignore` thêm:

```gitignore
.c2x/briefs/
```

`.c2x/README.md` (commit được): giải thích thư mục; brief bị ignore; C2X không spawn.

Cập nhật `installSkill` test hiện có: file cài vẫn chứa `c2x skill-install`. Thêm assert skill source có `.c2x/briefs/` và “Do not read other”.

- [x] **Step 1: Write the failing test**

```ts
import { readFileSync } from "node:fs";

describe("skill and gitignore for workspace drops", () => {
  it("tells each harness to read only its own drop path", () => {
    const skill = readFileSync(path.join(process.cwd(), "skill", "SKILL.md"), "utf8");
    expect(skill).toMatch(/\.c2x\/briefs\/<your-harness-id>\.md|\.c2x\/briefs\/<id/);
    expect(skill).toMatch(/Do not read other files/i);
    expect(skill).toMatch(/Do not plan or review/i);
    expect(skill).toContain("claude-code");
    const gi = readFileSync(path.join(process.cwd(), ".gitignore"), "utf8");
    expect(gi).toMatch(/\.c2x\/briefs\//);
  });
});
```

- [x] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/core/__tests__/workspace-brief-drop.test.ts`

Expected: FAIL — skill / gitignore chưa có drop path.

- [x] **Step 3: Write the files**

Trong `skill/SKILL.md`, sau `## Rules` thêm rule 7:

```markdown
7. After a PLAN exists, read **only** `.c2x/briefs/<your-harness-id>.md` if
   that file exists (Codex=`codex`, Claude Code=`claude-code`,
   Grok Build=`grok-build`, OpenCode=`opencode`, Kiro CLI=`kiro-cli`).
   Do not read other files in `.c2x/briefs/`. Do not plan or review.
   If the drop is missing, use the copied brief / `c2x brief --session … --owner …`.
```

Trong `## Commands` thêm:

```bash
npx tsx src/cli/c2x.ts doctor
npx tsx src/cli/c2x.ts brief --session <id> --owner <your-id> --drop
npx tsx src/cli/c2x.ts record --session <id> --owner <your-id>
npx tsx src/cli/c2x.ts review-prompt --session <id>
```

`.c2x/README.md`:

```markdown
# `.c2x/`

`briefs/<harness-id>.md` is written by chat-to-x when a PLAN lands.
Each harness reads **only** its own file. Do not commit briefs.

See `skill/SKILL.md` and spec §20.3.
```

- [x] **Step 4: Verify**

```bash
git check-ignore -v .c2x/briefs/codex.md
npx vitest run src/core/__tests__/workspace-brief-drop.test.ts src/core/__tests__/harness-detect.test.ts
```

Expected: `codex.md` bị ignore; `.c2x/README.md` **không** bị ignore; tests PASS.

- [x] **Step 5: Commit**

```bash
git add skill/SKILL.md .gitignore .c2x/README.md src/core/__tests__/workspace-brief-drop.test.ts
git commit -m "docs: teach skills to read the local workspace brief drop"
```

### Task L6: Dashboard hint drop

**Files:**
- Modify: `src/lib/i18n.ts` — thêm key **cả** `vi` và `en`
- Modify: `src/components/studio-client.tsx` — dưới hint `briefCliHint`

**Interfaces:** key mới:

```ts
dropHint: string;
```

vi: `dropHint: "Skill đọc `.c2x/briefs/<harness>.md` — đừng dán brief đồng đội."`  
en: `dropHint: "The skill reads `.c2x/briefs/<harness>.md`. Do not paste a teammate's brief."`

Hiện dưới mỗi lane brief (cạnh `briefCliHint`). Không gọi detect từ browser. Không ô path.

- [x] **Step 1: Reference `t.dropHint` in studio before adding the key**

Thêm `{t.dropHint}` cạnh `t.briefCliHint`.

- [x] **Step 2: `npx tsc --noEmit` fails**

Expected: FAIL trên `dropHint` nếu mới sửa tsx.

- [x] **Step 3: Add both i18n keys + render**

- [x] **Step 4:** `npx tsc --noEmit && npx vitest run`

Expected: PASS

- [x] **Step 5: Commit**

```bash
git add src/lib/i18n.ts src/components/studio-client.tsx
git commit -m "feat: hint the workspace brief drop in the control room"
```

### Slice L — verify tích luỹ

```bash
npx vitest run && npx tsc --noEmit
npx tsx src/cli/c2x.ts brief --help
git check-ignore -v .c2x/briefs/codex.md
```

Tay (khi triển khai, có browser): mock PLAN 2 harness → hai file `.c2x/briefs/codex.md` + `claude-code.md` → đổi team còn `codex` + PLAN lại → `claude-code.md` biến mất. Không spawn, không tunnel.

---

## Chunk P: Slice P — polish tốc độ + empty/error + CONTRIBUTING

### Vì sao

Homepage hiện `await getDoctorStatus()` → quét PATH **trước** first paint. Cache doctor là process-lifetime, không TTL — cài `claude` giữa chừng vẫn “thiếu” đến khi restart. Nút Retry trên lỗi luôn gọi `onPlan` dù lỗi là import. CONTRIBUTING đã có §19 nhưng thiếu checklist PR 10 phút.

### Rủi ro

| Rủi ro | Cách giữ |
| --- | --- |
| Fetch `/api/providers` mỗi toggle | Test đọc `studio-client.tsx`: không có chuỗi đó |
| Cache TTL làm test flaky | `clearDetectCache()` + `now` inject |
| Doctor client fetch chậm | Badge “đang dò PATH”; UI vẫn bật/tắt harness |
| Sửa copy phá i18n | Thêm key, không rename hàng loạt |

### Task P1: Doctor cache TTL + `clearDetectCache`

**Files:**
- Modify: `src/core/harness.ts`
- Test: `src/core/__tests__/harness-detect.test.ts`

**Interfaces:**

```ts
export const DETECT_CACHE_TTL_MS = 30_000;

export function clearDetectCache(): void;

export async function detectHarness(
  id: HarnessId,
  now?: () => number,
): Promise<HarnessDetectResult>;
```

Entry cache: `{ result, at }`. Hit khi `now() - at < DETECT_CACHE_TTL_MS`. Key vẫn `${id}\0${PATH}`.  
`detectHarnessTeam(team, now?)` truyền `now` xuống.  
`clearDetectCache()` xoá Map.

- [x] **Step 1: Write the failing test**

Thêm vào `harness-detect.test.ts`:

```ts
import {
  DETECT_CACHE_TTL_MS,
  clearDetectCache,
  detectHarness,
} from "@/core/harness";

describe("detectHarness cache", () => {
  it("reuses a PATH hit inside TTL and misses after expiry or clear", async () => {
    clearDetectCache();
    const dir = await mkdtemp(path.join(os.tmpdir(), "c2x-cache-"));
    const fake = path.join(dir, "claude");
    await writeFile(fake, "#!/bin/sh\necho ok\n", "utf8");
    await chmod(fake, 0o755);
    const prev = process.env.PATH;
    process.env.PATH = dir;
    const t0 = 1_000;
    const found = await detectHarness("claude-code", () => t0);
    await rm(dir, { recursive: true, force: true });
    const cached = await detectHarness("claude-code", () => t0 + 100);
    expect(DETECT_CACHE_TTL_MS).toBe(30_000);
    expect(cached.ok).toBe(true);
    expect(cached.binary).toBe(found.binary);
    const expired = await detectHarness("claude-code", () => t0 + DETECT_CACHE_TTL_MS + 1);
    expect(expired.ok).toBe(false);
    process.env.PATH = dir;
    const dir2 = await mkdtemp(path.join(os.tmpdir(), "c2x-cache2-"));
    await writeFile(path.join(dir2, "claude"), "#!/bin/sh\n", "utf8");
    await chmod(path.join(dir2, "claude"), 0o755);
    process.env.PATH = dir2;
    clearDetectCache();
    const again = await detectHarness("claude-code", () => t0);
    expect(again.ok).toBe(true);
    process.env.PATH = prev;
    await rm(dir2, { recursive: true, force: true });
  });
});
```

- [x] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/core/__tests__/harness-detect.test.ts`

Expected: FAIL — `DETECT_CACHE_TTL_MS` / `clearDetectCache` / `now` chưa có; cache hiện tại không hết hạn.

- [x] **Step 3: Write minimal implementation**

Đổi `detectCache` thành `Map<string, { result: HarnessDetectResult; at: number }>`.  
`detectHarness`: `const clock = now ?? Date.now`; nếu entry và `clock() - entry.at < DETECT_CACHE_TTL_MS` thì return `entry.result`. Sau compute: `detectCache.set(key, { result, at: clock() })`.

```ts
export const DETECT_CACHE_TTL_MS = 30_000;

export function clearDetectCache(): void {
  detectCache.clear();
}
```

- [x] **Step 4: Run tests**

Run: `npx vitest run src/core/__tests__/harness-detect.test.ts`

Expected: PASS. Test cũ “found then missing” vẫn đúng vì **đổi PATH** đổi cache key.

- [x] **Step 5: Commit**

```bash
git add src/core/harness.ts src/core/__tests__/harness-detect.test.ts
git commit -m "perf: expire harness doctor cache after 30s"
```

### Task P2: Dashboard không block first paint

**Files:**
- Modify: `src/app/page.tsx` — bỏ `await getDoctorStatus()`
- Modify: `src/components/studio-client.tsx` — `useEffect` một lần `GET /api/doctor`
- Test: `src/core/__tests__/dashboard-latency.test.ts`

**Interfaces:**
- Consumes: `GET /api/doctor` (đã có)
- Produces: `StudioClient` tự chứa `doctor` state; `page.tsx` **sync**, không import `getDoctorStatus`

Cấm `fetch("/api/providers")` trong studio (catalog đã import). Toggle harness = React state.

- [x] **Step 1: Write the failing test**

Tạo `src/core/__tests__/dashboard-latency.test.ts`:

```ts
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

describe("dashboard first paint", () => {
  it("does not block the home page on PATH detect", () => {
    const page = readFileSync(path.join(process.cwd(), "src/app/page.tsx"), "utf8");
    expect(page).not.toMatch(/getDoctorStatus/);
    expect(page).toMatch(/StudioClient/);
  });

  it("does not refetch the catalog on every harness toggle", () => {
    const studio = readFileSync(
      path.join(process.cwd(), "src/components/studio-client.tsx"),
      "utf8",
    );
    expect(studio).not.toMatch(/\/api\/providers/);
    expect(studio).toMatch(/\/api\/doctor/);
    expect(studio).toMatch(/HARNESS_CATALOG/);
  });
});
```

- [x] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/core/__tests__/dashboard-latency.test.ts`

Expected: FAIL — `page.tsx` vẫn import `getDoctorStatus`.

- [x] **Step 3: Write minimal implementation**

`src/app/page.tsx`:

```tsx
import { StudioClient } from "@/components/studio-client";

export default function HomePage() {
  return <StudioClient />;
}
```

Trong `studio-client.tsx`: import `useEffect`. Đổi props `doctor` thành state:

```ts
  const [doctor, setDoctor] = useState<HarnessDetectResult[]>([]);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/doctor")
      .then((response) => response.json() as Promise<{ doctor?: HarnessDetectResult[] }>)
      .then((body) => {
        if (!cancelled && Array.isArray(body.doctor)) {
          setDoctor(body.doctor);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setDoctor([]);
        }
      });
    return () => {
      cancelled = true;
    };
  }, []);
```

Xoá prop `doctor = []` bắt buộc (hoặc giữ optional override cho test, mặc định `[]`). Khi chưa có `detect`, UI đã có nhánh `{detect ? … : null}` — thêm `t.doctorLoading` nếu muốn (Task P3).

- [x] **Step 4: Run tests**

```bash
npx vitest run src/core/__tests__/dashboard-latency.test.ts
npx tsc --noEmit
```

Expected: PASS

- [x] **Step 5: Commit**

```bash
git add src/app/page.tsx src/components/studio-client.tsx src/core/__tests__/dashboard-latency.test.ts
git commit -m "perf: load harness doctor after the control room paints"
```

### Task P3: Empty / error / quota reminder

**Files:**
- Modify: `src/lib/i18n.ts`
- Modify: `src/components/studio-client.tsx`
- Modify: `src/components/sessions-client.tsx` — subtitle list ≠ empty copy
- Test: typecheck (cả hai lang) + `dashboard-latency.test.ts` đọc key nếu cần

**Interfaces:** key mới (thêm, không rename):

```ts
importEmpty: string;
dismissError: string;
doctorLoading: string;
quotaSingleTeam: string;
sessionsLead: string;
```

vi:

```ts
importEmpty: "Dán một khối [C2X] trước khi nhập.",
dismissError: "Đóng",
doctorLoading: "đang dò PATH…",
quotaSingleTeam: "Một harness vẫn hợp lệ — thêm teammate để gộp hạn mức khan.",
sessionsLead: "Các phiên C2X trên máy này. Planner nghĩ; đội harness chỉ chạy.",
```

en:

```ts
importEmpty: "Paste a [C2X] block before importing.",
dismissError: "Dismiss",
doctorLoading: "checking PATH…",
quotaSingleTeam: "A single harness is valid — add a teammate to split scarce quota.",
sessionsLead: "C2X sessions on this machine. Planners think; the harness team only executes.",
```

Hành vi:

- `onImport` khi `!importRaw.trim()` → `setError(t.importEmpty)` (không `return` im lặng).
- Banner lỗi: nút `t.dismissError` → `setError(null)`; nút `t.retry` gọi **hành động cuối** (`plan` \| `import` \| `review` \| `execute` \| `record`), **không** luôn `onPlan`.
- Khi `harnessTeam.length === 1` hiện `t.quotaSingleTeam` dưới toggle đội.
- Lane chưa có `detect`: hiện `t.doctorLoading`.
- Trang Phiên: empty giữ `t.sessionsEmpty`; list header dùng `t.sessionsLead` (hiện list đang dùng `sessionsEmpty` — sửa).

**Không** gọi API quota nhà cung cấp. Sổ `session.savings` đã ship.

- [x] **Step 1: Reference the new keys in tsx so typecheck fails**

- [x] **Step 2: `npx tsc --noEmit` fails**

Expected: FAIL trên key mới.

- [x] **Step 3: Add keys + behavior**

`lastAction` state:

```ts
  const [lastAction, setLastAction] = useState<
    "plan" | "import" | "review" | "execute" | "record" | null
  >(null);
```

Mỗi handler set `lastAction` trước khi gọi API. Retry:

```ts
  async function onRetry() {
    switch (lastAction) {
      case "plan":
        return onPlan();
      case "import":
        return onImport();
      case "review":
        return onPrepareReview(); // hàm hiện có POST /api/review — dùng đúng tên trong file
      case "execute":
        return onSimulateAll();
      case "record":
        return;
      case null:
        return onPlan();
      default:
        return assertNever(lastAction, `Unknown lastAction: ${lastAction}`);
    }
  }
```

Nếu studio chưa tách `onPrepareReview`, retry `review` gọi đúng hàm đang `POST /api/review`. `record` không có “last owner” → dismiss + message; **không** bịa owner.

- [x] **Step 4:** `npx tsc --noEmit && npx vitest run`

Expected: PASS

- [x] **Step 5: Commit**

```bash
git add src/lib/i18n.ts src/components/studio-client.tsx src/components/sessions-client.tsx
git commit -m "fix: surface empty import, dismissable errors, and quota copy"
```

### Task P4: CONTRIBUTING — thêm harness trong 10 phút

**Files:**
- Modify: `CONTRIBUTING.md`
- Test: `src/core/__tests__/dashboard-latency.test.ts` (đọc file)

**Interfaces:** không API. CONTRIBUTING phải có các chuỗi:

- `10 phút` hoặc `10 min`
- `HARNESS_BY_ID`
- `catalog-registry.test.ts`
- `Không đụng` (studio / `c2x.ts` / `router.ts` / `packets.ts`)
- Checklist PR: `npm test` + `npm run typecheck` không key

Không thêm marketplace. Không đổi spec §19.

- [x] **Step 1: Write the failing test**

```ts
  it("keeps a 10-minute harness checklist for contributors", () => {
    const text = readFileSync(path.join(process.cwd(), "CONTRIBUTING.md"), "utf8");
    expect(text).toMatch(/10 phút|10 min/i);
    expect(text).toContain("HARNESS_BY_ID");
    expect(text).toContain("catalog-registry.test.ts");
    expect(text).toMatch(/Không đụng/);
    expect(text).toContain("npm test");
    expect(text).toContain("npm run typecheck");
  });
```

(`CONTRIBUTING.md` hiện **thiếu** `catalog-registry.test.ts` — test fail thật.)

- [x] **Step 2: Run — fail missing catalog-registry mention**

Run: `npx vitest run src/core/__tests__/dashboard-latency.test.ts`

- [x] **Step 3: Add a PR checklist box at the top of the 10-min section**

Chèn ngay dưới heading `## How to add a harness (10 min)`:

```markdown
### Checklist PR (10 phút)

1. `HARNESS_IDS` + đúng một object `HARNESS_BY_ID` (`binaries` khác rỗng).
2. Adapter chỉ khi detect/ghi brief khác mặc định.
3. **Không đụng** `studio-client.tsx`, `src/cli/c2x.ts` help, `router.ts`, `packets.ts` để “hiện” id mới.
4. `npx tsc --noEmit && npx vitest run` — `catalog-registry.test.ts` phải xanh; không cần binary thật trên máy.
5. Drop workspace (Slice L) và `c2x doctor` lấy `binaries` từ catalog — không switch thứ hai.

Reviewer từ chối PR thêm `case "foo":` vào UI/CLI/router/splitter.
```

- [x] **Step 4:** `npx vitest run src/core/__tests__/dashboard-latency.test.ts`

Expected: PASS

- [x] **Step 5: Commit**

```bash
git add CONTRIBUTING.md src/core/__tests__/dashboard-latency.test.ts
git commit -m "docs: make the 10-minute harness checklist reviewable"
```

### Slice P — verify

```bash
npx vitest run && npx tsc --noEmit
```

Tay: mở `/` — form hiện **trước** khi badge doctor đổi “đang dò PATH” → ready/missing. Toggle harness không có request `/api/providers` (DevTools). Import trống → `importEmpty`. Lỗi import + Retry không chạy Plan mới.

---

## Chunk M: Slice M — MCP loopback (tuỳ chọn, không chặn)

### Vì sao

Spec §4C / §20.3: sau dán và **sau drop file**, MCP chỉ `127.0.0.1` cho người đã có connector. **Không** OAuth, **không** Cloudflare, **không** cookie, **không** tool ghi/shell/commit. First-run OSS không cần slice này.

**Không bắt đầu Chunk M trừ khi user xin rõ** (“làm MCP” / “triển khai slice M”). L + P vẫn xong được.

### Rủi ro

| Rủi ro | Cách giữ |
| --- | --- |
| Bind `0.0.0.0` / `localhost` (IPv6) | Không có `--host`. Host cứng `127.0.0.1` |
| Tool đọc brief đồng đội | `c2x_get_brief` bắt `owner` ∈ team, chỉ một brief |
| Dep nặng `@modelcontextprotocol/sdk` | **Không** thêm npm dep — JSON-RPC HTTP thuần |
| Lộ pack excerpts | `c2x_get_session` chỉ id / state / team / goal |

### Task M1: Handler thuần (chưa listen)

**Files:**
- Create: `src/core/mcp-loopback.ts`
- Test: `src/core/__tests__/mcp-loopback.test.ts`

**Interfaces:**

```ts
export const MCP_LOOPBACK_HOST = "127.0.0.1";
export const MCP_LOOPBACK_PORT = 45218;

export type McpToolName = "c2x_get_brief" | "c2x_get_session";

export function assertLoopbackBind(host: string): void;

export function handleMcpTool(input: {
  name: McpToolName;
  owner?: string;
  session: SessionRecord;
}): { ok: true; text: string } | { ok: false; error: string };
```

`assertLoopbackBind`: throw `/127\.0\.0\.1/` nếu `host !== "127.0.0.1"` (cấm `0.0.0.0`, cấm `localhost`).  
`c2x_get_brief`: `owner` phải `isHarnessId` và ∈ `session.harnessTeam`; text = `renderCodexBrief`; error nếu thiếu brief.  
`c2x_get_session`: JSON `{ id, state, planner, harnessTeam, goal }` — **không** `pack.excerpts`, không thân file.  
`default` trên `name`: `assertNever`.

- [x] **Step 1: Write the failing test**

```ts
import { describe, expect, it } from "vitest";
import { planToBriefs, renderCodexBrief } from "@/core/brief";
import { DEMO_FILES } from "@/core/fixtures/demo-workspace";
import {
  MCP_LOOPBACK_HOST,
  MCP_LOOPBACK_PORT,
  assertLoopbackBind,
  handleMcpTool,
} from "@/core/mcp-loopback";
import { packWorkspace } from "@/core/packer";
import { mockPlanFromPack } from "@/core/planner";
import { createSession } from "@/core/session";

function sessionTwo() {
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
  return { ...created, plan, briefs, brief: briefs[0] ?? null, pack };
}

describe("mcp loopback handlers", () => {
  it("rejects non-loopback binds and hides teammate briefs", () => {
    expect(MCP_LOOPBACK_HOST).toBe("127.0.0.1");
    expect(MCP_LOOPBACK_PORT).toBe(45218);
    expect(() => assertLoopbackBind("127.0.0.1")).not.toThrow();
    expect(() => assertLoopbackBind("0.0.0.0")).toThrow(/127\.0\.0\.1/);
    expect(() => assertLoopbackBind("localhost")).toThrow(/127\.0\.0\.1/);
    const session = sessionTwo();
    const brief = handleMcpTool({ name: "c2x_get_brief", owner: "codex", session });
    expect(brief.ok).toBe(true);
    if (brief.ok) {
      expect(brief.text).toBe(renderCodexBrief(session.briefs[0]!));
      expect(brief.text).not.toMatch(/OWNER:\s*claude-code/);
    }
    const leak = handleMcpTool({ name: "c2x_get_brief", owner: "kiro-cli", session });
    expect(leak.ok).toBe(false);
    const meta = handleMcpTool({ name: "c2x_get_session", session });
    expect(meta.ok).toBe(true);
    if (meta.ok) {
      expect(meta.text).toContain(session.id);
      expect(meta.text).not.toContain("export function");
      expect(meta.text).not.toContain("@@");
    }
  });
});
```

- [x] **Step 2:** `npx vitest run src/core/__tests__/mcp-loopback.test.ts` → FAIL missing module.

- [x] **Step 3: Implement `src/core/mcp-loopback.ts`** (import đầu file: `assertNever`, `isHarnessId`, `renderCodexBrief`). Không `http.listen` trong task này.

- [x] **Step 4:** test PASS + `npx tsc --noEmit`

- [x] **Step 5: Commit** `feat: add read-only loopback MCP handlers`

### Task M2: CLI `c2x mcp` listen `127.0.0.1`

**Files:**
- Modify: `src/core/mcp-loopback.ts` — `createMcpLoopbackServer`
- Modify: `src/cli/c2x.ts`
- Modify: `src/core/index.ts` nếu cần export
- Test: `src/core/__tests__/mcp-loopback.test.ts`

**Interfaces:**

```ts
import type { Server } from "node:http";

export function createMcpLoopbackServer(input: {
  getSession: (id: string) => Promise<SessionRecord | null>;
}): Server;
```

`createServer` + `listen` **không** gọi trong factory — factory chỉ trả server. CLI:

```text
c2x mcp --session <id> [--port 45218]
```

CLI gọi `assertLoopbackBind(MCP_LOOPBACK_HOST)` rồi `server.listen(port, MCP_LOOPBACK_HOST)`. **Không** option `--host`.  
POST `/` JSON `{ "name": "c2x_get_brief", "owner": "codex" }` → `handleMcpTool`. Session load từ `--session`. 400 nếu thiếu session.

Test listen: `createMcpLoopbackServer` + `listen(0, "127.0.0.1")` + `fetch(http://127.0.0.1:${port})` + `server.close()`. Không listen `0.0.0.0`.

- [x] **Step 1:** test HTTP trên 127.0.0.1 (port 0).

- [x] **Step 2:** FAIL missing `createMcpLoopbackServer`.

- [x] **Step 3:** implement bằng `node:http` (không dep). Import `createServer` ở đầu file.

- [x] **Step 4:** vitest + `npx tsx src/cli/c2x.ts mcp --help` có `session` / `port`, không có `--host`.

- [x] **Step 5: Commit** `feat: serve read-only C2X MCP on 127.0.0.1`

### Task M3: SECURITY + README một đoạn

**Files:** `SECURITY.md`, `README.md` (một đoạn, không URL giả)

Copy (bilingual được):

```text
Optional `c2x mcp` binds 127.0.0.1 only. No Cloudflare tunnel, no OAuth,
no public URL, no write tools. First-run does not start MCP.
```

- [x] **Step 1–5:** test đọc `SECURITY.md` chứa `127.0.0.1` và `tunnel`; commit `docs: warn that MCP stays loopback-only`

### Slice M — verify

```bash
npx vitest run src/core/__tests__/mcp-loopback.test.ts src/core/__tests__/package-meta.test.ts
npx tsx src/cli/c2x.ts mcp --help
```

Không `npm install` thêm package. Không mở port trên LAN.

---

## Chunk O: Slice O — OSS launch checklist

### Vì sao

v1 đủ vòng để stranger clone + `npm test` + dán PLAN/REVIEW. Public visibility là **settings** (Origin/GitHub), không PR code. npm **vẫn private** đến khi maintainers chủ động publish `chat-to-x` (không bao giờ `c2x`).

### Rủi ro

| Rủi ro | Cách giữ |
| --- | --- |
| Badge trỏ `github.com/foo/chat-to-x` bịa | README giữ `git clone <this-repo>`; comment HTML giải thích “sau Public, dán URL thật” |
| Screenshot giả / stock | `docs/screenshots/README.md` liệt kê ảnh — **không** commit PNG giả |
| `npm publish` nhầm `c2x` | `package-meta.test.ts` đã khóa; Slice O không đổi `name` / `private` |

### Task O1: Pointer + danh sách screenshot + ghi chú Public

**Files:**
- Modify: `README.md`
- Modify: `docs/architecture.md` (đã trỏ plan này — giữ)
- Create: `docs/screenshots/README.md`
- Test: `src/core/__tests__/package-meta.test.ts` (giữ) + assert README không chứa `npx c2x` như lệnh khuyến nghị (đã có copy “Không chạy `npx c2x`”)

**Interfaces:** không API.

`docs/screenshots/README.md`:

```markdown
# Screenshots (chụp tay sau khi repo Public)

Chụp thật từ `npm run dev` (127.0.0.1:45217). Không commit ảnh stock.

1. `control-room.png` — Phòng điều khiển, đội ≥2 harness, empty rồi có PLAN
2. `paste-plan.png` — prompt dán + ô import `[C2X]`
3. `briefs.png` — hai lane OWNER khác nhau + hint `.c2x/briefs/`
4. `review.png` — `reviewPastePrompt` (không giả DONE)

README: thêm ảnh **sau** khi có file thật. Đừng bịa URL GitHub/Origin.
```

README — thêm mục ngắn **trước** License:

```markdown
## Public / npm

Repo Origin vẫn có thể Private — bật Public là việc maintainers (Settings),
không phải lệnh trong repo. Clone: `git clone <this-repo>`.

npm: giữ `"private": true` đến khi publish **`chat-to-x`**. Không publish `c2x`.

Sau khi Public: có thể thêm badge CI **từ URL repo thật**. Không commit badge
trỏ domain hoặc owner bịa.
```

- [x] **Step 1:** test đọc `README.md` chứa `private` / `chat-to-x` / `Không` + `npx c2x`; chứa `Settings` hoặc `Public`; **không** match `/github\.com\/[A-Za-z0-9_.-]+\/chat-to-x/`.

```ts
  it("does not invent a public GitHub URL and stays private as chat-to-x", () => {
    const readme = readFileSync(path.join(process.cwd(), "README.md"), "utf8");
    expect(readme).toMatch(/npx chat-to-x/);
    expect(readme).toMatch(/Không[\s\S]*npx c2x/);
    expect(readme).not.toMatch(/github\.com\/[A-Za-z0-9_.-]+\/chat-to-x/);
    expect(readme).toMatch(/private/);
  });
```

Thêm vào `package-meta.test.ts`.

- [x] **Step 2:** FAIL nếu README chưa có mục Public.

- [x] **Step 3:** viết mục + `docs/screenshots/README.md`.

- [x] **Step 4:** `npx vitest run src/core/__tests__/package-meta.test.ts`

- [x] **Step 5: Commit** `docs: add OSS launch notes without a fake repo URL`

### Việc người (không phải task agent)

1. Origin/GitHub → change visibility **Public** (khi sẵn sàng).
2. (Tuỳ) thêm badge shields từ URL **thật**.
3. Chụp 4 screenshot, commit PNG thật, nhúng README.
4. **Không** `npm publish` trong phase này. Khi publish: `npm publish` package `chat-to-x` only.

### Slice O — verify

```bash
npx vitest run src/core/__tests__/package-meta.test.ts
grep -n "github.com/" README.md docs/architecture.md || true
```

Expected: không có URL owner/repo bịa.

---

## Khe còn lại vs mục tiêu user — đã cover hoặc YAGNI

| Mục tiêu user | Trạng thái | Làm trong phase này? |
| --- | --- | --- |
| 1. Tiết kiệm hạn mức harness | Router + brief + sổ `savings` đã ship | P3: copy `quotaSingleTeam` thôi. **Cấm** poll quota API thật (cần key, chậm, ngoài spec §11) |
| 2. Chat web nghĩ (PLAN+REVIEW) | Slice 1 đã ship | Không làm lại. L làm brief tới harness nhanh hơn |
| 3. Ghép nhiều harness | Packet + team đã ship | L: N file drop, skill không đọc đồng đội |
| 4. Chọn 5 harness / thêm harness | Registry + §19 | P4: checklist 10 phút |
| 5. OSS MIT | NOTICE + private npm | O: checklist Public; npm vẫn private |
| Skill nhà khác (Claude/OpenCode/Kiro) | `skill-install` chỉ `~/.codex/skills` | L5 docs copy tay; **không** ghi nhiều `$HOME` |
| `--repack` | Cấm v1 (§20.2) | Vẫn YAGNI |
| Tunnel / OAuth / Computer Use | Cấm | Vẫn cấm |
| Publish `c2x` | Cấm | Vẫn cấm |

Không còn slice “platform” khác. Nếu user muốn spawn harness: plan **mới**, không nhét vào đây.

---

## Coverage vs spec

| Spec | Task phase này |
| --- | --- |
| §20.3 drop `.c2x/briefs/<harness>.md` | L1–L6 |
| §20.3 skill đọc đúng OWNER | L5 |
| §20.3 gitignore drop | L5 |
| §18 cache doctor / không block vibe-coding | P1–P2 |
| §19 thêm harness 10 phút | P4 |
| §15.1 npm `chat-to-x` private, không `c2x` | O1 + test cũ |
| §15.3 flip Public = maintainers | O (việc người) |
| §4C / §11 / §20.3 MCP loopback only | M1–M3 (tuỳ chọn) |
| §8 không spawn | mọi task |
| Mục tiêu 1–5 (§1) | bảng khe ở trên |

Baseline §6–10, §17, §18 packer, §20.2: **đã xong** trên [2026-09-12-chat-to-x-features.md](./2026-09-12-chat-to-x-features.md).

---

## Self-review (plan)

- Không còn “TBD” / “similar to Task N” / “add validation”.
- Tên hàm: `workspaceBriefPath`, `writeWorkspaceBriefDrop`, `syncWorkspaceBriefDrops`, `persistWorkspaceBriefs`, `clearDetectCache`, `DETECT_CACHE_TTL_MS`, `assertLoopbackBind`, `handleMcpTool`, `createMcpLoopbackServer`.
- `persistWorkspaceBriefs` no-op khi `INIT` / không brief — khớp planner dán.
- Test isolation: `C2X_WORKSPACE` tmp trên mọi `runPlan` test hiện có.
- MCP không thêm npm dep; host cứng `127.0.0.1`.
- README/O1 cấm URL GitHub bịa.

---

## Handoff triển khai

Plan lưu tại `docs/superpowers/plans/2026-09-12-chat-to-x-next.md`.

Khi user nói **triển khai**: bắt đầu **Task L1**. Hai cách chạy:

1. **Subagent-Driven (khuyến nghị)** — một subagent / task, review giữa các task (`superpowers:subagent-driven-development`).
2. **Inline** — `superpowers:executing-plans`, checkpoint sau mỗi commit.

Không làm Task M1+ trừ khi user xin MCP. Không `npm publish`. Không flip visibility hộ.
