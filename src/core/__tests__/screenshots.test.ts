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
