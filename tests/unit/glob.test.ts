import { describe, expect, it } from "vitest";
import { matchesGlob } from "../../src/discovery/glob.js";

describe("matchesGlob", () => {
  it("matches a single-segment wildcard", () => {
    expect(matchesGlob("src/*.ts", "src/index.ts")).toBe(true);
    expect(matchesGlob("src/*.ts", "src/nested/index.ts")).toBe(false);
  });

  it("matches a recursive wildcard across directories", () => {
    expect(matchesGlob("src/**/*.ts", "src/nested/deep/index.ts")).toBe(true);
    expect(matchesGlob("**/*.test.ts", "src/wallet/wallet.test.ts")).toBe(true);
  });

  it("does not match unrelated paths", () => {
    expect(matchesGlob("src/**/*.ts", "docs/readme.md")).toBe(false);
  });
});
