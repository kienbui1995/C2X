import { describe, expect, it } from "vitest";
import { isSensitivePath } from "@/core/sensitive";

describe("isSensitivePath", () => {
  it("blocks env, npm, netrc, git credentials, and ecdsa keys", () => {
    expect(isSensitivePath(".envrc")).toBe(true);
    expect(isSensitivePath("app/.envrc")).toBe(true);
    expect(isSensitivePath(".npmrc")).toBe(true);
    expect(isSensitivePath("home/.npmrc")).toBe(true);
    expect(isSensitivePath(".netrc")).toBe(true);
    expect(isSensitivePath(".git-credentials")).toBe(true);
    expect(isSensitivePath("keys/id_ecdsa")).toBe(true);
    expect(isSensitivePath("id_ecdsa")).toBe(true);
    expect(isSensitivePath(".env.example")).toBe(false);
    expect(isSensitivePath("src/config.ts")).toBe(false);
  });
});
