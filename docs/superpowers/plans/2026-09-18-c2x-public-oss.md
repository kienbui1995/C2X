# C2X Public OSS Trust Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the public `kienbui1995/C2X` repo trustworthy for strangers: GitHub Actions CI they can see, four real dashboard screenshots, and a README badge that points at the real repo — no new protocol, no new harness, no npm publish.

**Architecture:** Trust-only. Slice C adds `.github/workflows/ci.yml` (Node 20, `npm ci`, `npm test`, `npm run typecheck`) plus a README badge to `https://github.com/kienbui1995/C2X/actions`. Slice S captures PNGs from the already-shipped dashboard at `127.0.0.1:45217` and embeds them. Tests read files from disk; they do not start Actions or invent pixels.

**Tech Stack:** GitHub Actions (`ubuntu-latest`, `actions/checkout`, `actions/setup-node`), existing vitest (`src/core/__tests__/**/*.test.ts`), Next.js dashboard (`npm run dev` → `127.0.0.1:45217`). No new npm dependency.

## Global Constraints

- Node.js 20+. Imports at top of file. Switch on unions/enums must `default` a `never` check.
- `routeRole("plan"|"review")` must not return `HarnessId`. Do not break `packets.test.ts` / `router-savings.test.ts` / `fast-link.test.ts` / `package-meta.test.ts`.
- No OAuth, no Cloudflare tunnel, no cookie, no ChatGPT browser, no Computer Use as a product feature. Browser tools may only screenshot this repo's localhost dashboard.
- Dashboard / HTTP bodies never accept filesystem paths. `dev`/`start` bind `127.0.0.1`.
- `package.json` `"name": "chat-to-x"`, keep `"private": true`. Never publish npm. Never recommend `npx c2x`.
- Catalog is the source of truth. No new `case "codex":` in studio / CLI / router / `packets.ts`.
- Codex is never the reviewer. OpenDesign stays outside. Wiki is markdown outbox.
- Real GitHub URL only: `https://github.com/kienbui1995/C2X`. Do not invent owners. Do not use `chat-to-x` as a GitHub repo path.
- Do not rewrite git history. Do not write `PLACEHOLDER_USE_LOCAL`. Stay on `main`.
- Copy defaults to Vietnamese; protocol / catalog / function ids stay English.

Spec (locked): [docs/superpowers/specs/2026-09-18-c2x-public-oss-design.md](../specs/2026-09-18-c2x-public-oss-design.md).

Shipped (do not re-implement): [2026-09-12-chat-to-x-features.md](./2026-09-12-chat-to-x-features.md), [2026-09-12-chat-to-x-next.md](./2026-09-12-chat-to-x-next.md).

---

## File structure (locked before coding)

**Docs (this commit, before implementation)**

- Create: `docs/superpowers/specs/2026-09-18-c2x-public-oss-design.md`
- Create: `docs/superpowers/plans/2026-09-18-c2x-public-oss.md` (this file)
- Modify: `docs/architecture.md` — **Next features** points here; L/P/M/O stay shipped

**Slice C**

- Create: `.github/workflows/ci.yml`
- Modify: `README.md` — CI badge under the title, URL `kienbui1995/C2X`
- Test: `src/core/__tests__/ci-workflow.test.ts`

**Slice S**

- Create: `docs/screenshots/control-room.png`
- Create: `docs/screenshots/paste-plan.png`
- Create: `docs/screenshots/briefs.png`
- Create: `docs/screenshots/review.png`
- Modify: `README.md` — embed the four images after they exist
- Modify: `docs/screenshots/README.md` — note that the PNGs are real captures
- Test: `src/core/__tests__/screenshots.test.ts`

---

## Task 0: Spec + plan + architecture pointer

**Files:**
- Create: `docs/superpowers/specs/2026-09-18-c2x-public-oss-design.md`
- Create: `docs/superpowers/plans/2026-09-18-c2x-public-oss.md`
- Modify: `docs/architecture.md` (section **Next features**)

**Interfaces:**
- Consumes: locked 2026-09-12 spec + shipped L/P/M/O
- Produces: this plan's task list; architecture link to `2026-09-18-c2x-public-oss.md`

- [x] **Step 1: Point architecture at this plan**

Replace the **Next features** block in `docs/architecture.md` with:

```markdown
## Next features

v1 plus phase-2 Slice L (`.c2x/briefs/`), P (doctor/dashboard polish), M
(loopback MCP), and O (OSS notes) are **shipped**. Public visibility is done
(repo `https://github.com/kienbui1995/C2X`). Track the public-OSS trust
slice (CI + real screenshots) in:

- [docs/superpowers/plans/2026-09-18-c2x-public-oss.md](superpowers/plans/2026-09-18-c2x-public-oss.md)
- Locked design: [docs/superpowers/specs/2026-09-18-c2x-public-oss-design.md](superpowers/specs/2026-09-18-c2x-public-oss-design.md)

Shipped history (do not re-implement):

- [docs/superpowers/plans/2026-09-12-chat-to-x-next.md](superpowers/plans/2026-09-12-chat-to-x-next.md)
- Locked design: [docs/superpowers/specs/2026-09-12-chat-to-x-features-design.md](superpowers/specs/2026-09-12-chat-to-x-features-design.md)
- Completed v1 plan: [docs/superpowers/plans/2026-09-12-chat-to-x-features.md](superpowers/plans/2026-09-12-chat-to-x-features.md)

OSS locks (public MIT): publish as `chat-to-x` never `c2x`; Never `npx c2x`;
no browser workspace paths; no harness spawn; no C2C OAuth/tunnel fork.
How to add a harness: spec §19. Speed locks: spec §18. Fast planner link: spec §20.
```

- [x] **Step 2: Commit spec + plan + architecture only**

```bash
git add docs/superpowers/specs/2026-09-18-c2x-public-oss-design.md \
  docs/superpowers/plans/2026-09-18-c2x-public-oss.md \
  docs/architecture.md
git commit -m "docs: lock public OSS trust spec and plan (CI + screenshots)"
```

Do not add workflow or PNG files in this commit.

---

## Task 1: Slice C — failing CI contract tests

**Files:**
- Create: `src/core/__tests__/ci-workflow.test.ts`

**Interfaces:**
- Consumes: paths `.github/workflows/ci.yml`, `README.md`
- Produces: assertions later tasks must satisfy

- [x] **Step 1: Write the failing test**

```ts
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const root = process.cwd();
const workflowPath = path.join(root, ".github/workflows/ci.yml");

describe("GitHub Actions CI workflow", () => {
  it("exists and runs Node 20 test + typecheck without publishing", () => {
    expect(existsSync(workflowPath)).toBe(true);
    const yaml = readFileSync(workflowPath, "utf8");
    expect(yaml).toMatch(/node-version:\s*['"]?20['"]?/);
    expect(yaml).toMatch(/npm test/);
    expect(yaml).toMatch(/typecheck/);
    expect(yaml).not.toMatch(/npm publish/);
    expect(yaml).not.toMatch(/npx c2x/);
  });

  it("README CI badge points at github.com/kienbui1995/C2X", () => {
    const readme = readFileSync(path.join(root, "README.md"), "utf8");
    expect(readme).toMatch(
      /https:\/\/(github\.com\/kienbui1995\/C2X\/actions|img\.shields\.io\/github\/actions\/workflow\/status\/kienbui1995\/C2X)/,
    );
    expect(readme).not.toMatch(/github\.com\/(?!kienbui1995\/)[A-Za-z0-9_.-]+\/C2X\/actions/);
    expect(readme).not.toMatch(/github\.com\/[A-Za-z0-9_.-]+\/chat-to-x\/actions/);
  });
});
```

- [x] **Step 2: Run test to verify it fails**

```bash
npx vitest run src/core/__tests__/ci-workflow.test.ts
```

Expected: FAIL — `.github/workflows/ci.yml` missing, README has no Actions badge.

- [x] **Step 3: Do not implement yet**

Stop after RED. Task 2 writes the workflow.

---

## Task 2: Slice C — workflow + badge

**Files:**
- Create: `.github/workflows/ci.yml`
- Modify: `README.md` (badge lines under `# chat-to-x (C2X)`)

**Interfaces:**
- Consumes: Task 1 assertions
- Produces: `ci.yml` with Node 20, `npm ci`, `npm test`, `npm run typecheck`

- [x] **Step 1: Write `.github/workflows/ci.yml`**

```yaml
name: CI

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: npm
      - run: npm ci
      - run: npm test
      - run: npx next typegen
      - run: npm run typecheck
```

- [x] **Step 2: Add the README badge**

Insert immediately after the title, before the existing License / Node badges:

```markdown
[![CI](https://github.com/kienbui1995/C2X/actions/workflows/ci.yml/badge.svg)](https://github.com/kienbui1995/C2X/actions)
```

Keep the MIT and Node 20+ badges. Do not change clone / `install.sh` / `npx chat-to-x` copy.

- [x] **Step 3: Run tests**

```bash
npx vitest run src/core/__tests__/ci-workflow.test.ts src/core/__tests__/package-meta.test.ts
```

Expected: PASS.

- [x] **Step 4: Commit**

```bash
git add .github/workflows/ci.yml README.md src/core/__tests__/ci-workflow.test.ts
git commit -m "ci: add GitHub Actions for test and typecheck on main"
```

---

## Task 3: Slice S — failing screenshot contract tests

**Files:**
- Create: `src/core/__tests__/screenshots.test.ts`

**Interfaces:**
- Consumes: four paths under `docs/screenshots/`
- Produces: size + existence assertions

- [x] **Step 1: Write the failing test**

```ts
import { existsSync, statSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const MIN_REAL_PNG_BYTES = 10 * 1024;

const shots = [
  "control-room.png",
  "paste-plan.png",
  "briefs.png",
  "review.png",
] as const;

describe("real dashboard screenshots", () => {
  it("commits four PNGs larger than a 1x1 placeholder", () => {
    for (const name of shots) {
      const file = path.join(process.cwd(), "docs/screenshots", name);
      expect(existsSync(file), file).toBe(true);
      expect(statSync(file).size, file).toBeGreaterThan(MIN_REAL_PNG_BYTES);
    }
  });
});
```

- [x] **Step 2: Run test to verify it fails**

```bash
npx vitest run src/core/__tests__/screenshots.test.ts
```

Expected: FAIL — PNGs missing.

- [x] **Step 3: Do not invent placeholder PNGs**

A 1×1 or AI-generated fake UI would fail the 10 KB check or violate the spec. Capture from the running dashboard only.

---

## Task 4: Slice S — capture from the running dashboard

**Files:**
- Create: `docs/screenshots/control-room.png`
- Create: `docs/screenshots/paste-plan.png`
- Create: `docs/screenshots/briefs.png`
- Create: `docs/screenshots/review.png`
- Modify: `docs/screenshots/README.md`
- Modify: `README.md` (Screenshots section)

**Interfaces:**
- Consumes: `npm run dev` at `http://127.0.0.1:45217`
- Produces: four real PNGs; README `![...](docs/screenshots/...)` embeds

- [x] **Step 1: Start the dashboard and leave it running**

```bash
npm run dev
```

Expected: Next listens on `127.0.0.1:45217`. Do not bind `0.0.0.0`.

- [x] **Step 2: Drive the real UI (one session)**

Default team is already `codex` + `claude-code` (≥ 2). Planner must be `chatgpt-web` so paste + review prompts exist and review does **not** auto-`DONE`.

1. Open `/` — Phòng điều khiển, empty card, two harness switches on. Optional empty frame; committed `control-room.png` is after PLAN (step 4).
2. Set planner to ChatGPT web. Click the plan button. Session stays `INIT` with `pastePrompt`. Open tab **Dán / Paste**. Save `docs/screenshots/paste-plan.png` (prompt + import `[C2X]` box).
3. Paste a `[C2X] PLAN` with two packets (`owner=codex` and `owner=claude-code`) into the import box and import. Session becomes `PLAN`.
4. Scroll the control room so goal + team + PLAN/metrics are visible. Save `docs/screenshots/control-room.png`.
5. Scroll to work packets (`data-testid="work-packets"`). Two OWNER lanes + `.c2x/briefs/` hint (`dropHint`). Save `docs/screenshots/briefs.png`.
6. Click **Giả lập đã chạy** / simulate-all, or execute both lanes then review. State must be `REVIEW` with `reviewPastePrompt` set and `review` null. Open tab **Review**. Save `docs/screenshots/review.png`. Do not import `STATE: DONE`.

Import block (ids English, goal Vietnamese — matches demo fixture):

```text
[C2X]
STATE: PLAN
TASK_ID: shot1
ITERATION: 1

GOAL:
Sửa createTask để việc mới thật sự được lưu

RATIONALE:
Packed excerpts show persist + URL filter gaps.

ACTIONS:
1. Persist createTask.
2. Keep status filter on the URL.

FILES_LIKELY_INVOLVED:
- src/lib/tasks.ts
- src/app/page.tsx

TESTS:
- unit empty state

SUCCESS_CRITERIA:
- new tasks survive reload

RISKS:
- none

PACKETS:
  ## owner=codex role=fix
  ACTIONS:
  1. Add empty-state tests and fix persist.
  FILES:
  - src/lib/tasks.ts
  TESTS:
  - unit empty state
  SUCCESS_CRITERIA:
  - persist

  ## owner=claude-code role=implement
  ACTIONS:
  1. Keep status filter on the URL.
  FILES:
  - src/app/page.tsx
  TESTS:
  - unit empty state
  SUCCESS_CRITERIA:
  - filter stays on URL
```

If a state cannot be reached, keep only real captures (minimum `control-room.png` + one more) and shrink the test list to those files. Do not invent pixels.

- [x] **Step 3: Embed images in README**

Add before `## License`:

```markdown
## Screenshots / Ảnh thật

Từ dashboard `npm run dev` → [http://127.0.0.1:45217](http://127.0.0.1:45217). Không ảnh stock.

![Phòng điều khiển](docs/screenshots/control-room.png)

![Prompt dán PLAN](docs/screenshots/paste-plan.png)

![Hai lane OWNER + .c2x/briefs](docs/screenshots/briefs.png)

![reviewPastePrompt — chưa DONE](docs/screenshots/review.png)
```

Update `docs/screenshots/README.md` to say the four PNGs are committed captures from that dashboard, still no stock photos.

- [x] **Step 4: Run screenshot + docs tests**

```bash
npx vitest run src/core/__tests__/screenshots.test.ts src/core/__tests__/package-meta.test.ts src/core/__tests__/pipeline-docs.test.ts
```

Expected: PASS. Each PNG `>` 10 KB.

- [x] **Step 5: Commit**

```bash
git add docs/screenshots README.md src/core/__tests__/screenshots.test.ts
git commit -m "docs: add real C2X dashboard screenshots"
```

---

## Task 5: Full verify + push `main`

**Files:** none new.

**Interfaces:**
- Consumes: all tests in this plan
- Produces: green `vitest` + clean `tsc`; `main` pushed to `kienbui1995/C2X`

- [x] **Step 1: Typecheck (check-compiler-errors)**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [x] **Step 2: Full test suite**

```bash
npx vitest run
```

Expected: all green. Record the test count for the parent report.

- [x] **Step 3: Push `main`**

```bash
git push -u origin main
git push -u github main
```

Retry each push up to 4 times with backoff 4s / 8s / 16s / 32s. If git auth fails, use GitHub MCP `create_or_update_file` / `push_files` as user `kienbui1995` on owner `kienbui1995` repo `C2X`. Do not create a PR. Do not rewrite history.

---

## Coverage vs spec

| Spec | Task |
| --- | --- |
| Approach A cấm / B chọn / C loại | Task 0 spec text |
| Slice C workflow Node 20, `npm test`, typecheck, no publish | Task 1–2 |
| README badge `kienbui1995/C2X` | Task 2 |
| Slice S four real PNGs + README embed | Task 3–4 |
| Architecture Next features | Task 0 |
| Install URLs unchanged | Task 2/4 must not edit clone / curl / `npx chat-to-x` |
| `npx vitest run` + `tsc --noEmit` | Task 5 |

## Self-review (plan)

- No TBD / “similar to Task N” / “add validation”.
- Badge regex and workflow keys match Task 1 tests exactly (`node-version`, `npm test`, `typecheck`, no `npm publish`, no `npx c2x`).
- Screenshot names match `docs/screenshots/README.md` and Task 3.
- Install one-liner stays `raw.githubusercontent.com/kienbui1995/C2X/main/install.sh`.
- No product features beyond C + S.

## Handoff

Plan saved at `docs/superpowers/plans/2026-09-18-c2x-public-oss.md`.

This session executes **inline** (`executing-plans` + TDD) because the parent already chose approach B and said continue. Start at Task 0 commit, then Task 1 RED.
