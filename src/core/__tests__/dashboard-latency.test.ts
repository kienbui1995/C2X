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
    expect(studio).toMatch(/\/api\/sessions/);
  });

  it("keeps a 10-minute harness checklist for contributors", () => {
    const text = readFileSync(path.join(process.cwd(), "CONTRIBUTING.md"), "utf8");
    expect(text).toMatch(/10 phút|10 min/i);
    expect(text).toContain("HARNESS_BY_ID");
    expect(text).toContain("catalog-registry.test.ts");
    expect(text).toMatch(/Không đụng/);
    expect(text).toContain("npm test");
    expect(text).toContain("npm run typecheck");
  });
});
