# Contributing to chat-to-x

## Dev loop

```bash
npm install
npm test
npm run typecheck
```

No planner API key and no network are required. `npm test` is the contract:
router never sends `plan` / `review` to a harness.

## Product rules

- **Planner ≠ harness.** `routeRole("plan"|"review")` must not return a `HarnessId`.
- Planner `PACKETS` win. Do not add a silent “smart-split” that rewrites owner or files when `PACKETS` is present.
- **Do not spawn** `codex` / `claude` / `opencode` / `kiro` / `grok` / `grok-build` **or** ChatGPT / Computer Use / Playwright chat.
- The default link is local paste / brief (spec §20). **Do not** open PRs that add a Cloudflare tunnel, OAuth pairing, or Computer Use “for speed.”
- Dashboard / `PUT /api/config` must not accept filesystem paths. CLI may use `--cwd` then `C2X_WORKSPACE`.
- Keep `package.json` `"name": "chat-to-x"` and `"private": true`. Do not publish npm as `c2x` (that name is already a CSS→XPath tool).
- Imports stay at the top of the file. Switches over unions/enums need `default: assertNever(...)`.

## How to add a harness (10 min)

Copy of spec §19. No marketplace.

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

## Code of conduct

See [CODE_OF_CONDUCT.md](CODE_OF_CONDUCT.md).
