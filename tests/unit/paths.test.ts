import { describe, expect, it } from "vitest";
import { join } from "node:path";
import { toPosixPath, toProjectRelativePath } from "../../src/shared/paths.js";

describe("path normalization", () => {
  it("converts an absolute path under the root into a relative posix path", () => {
    const root = "/repo/project";
    const absolute = join(root, "src", "index.ts");
    expect(toProjectRelativePath(root, absolute)).toBe("src/index.ts");
  });

  it("never produces a leading ./ prefix", () => {
    const root = "/repo/project";
    const absolute = join(root, "index.ts");
    expect(toProjectRelativePath(root, absolute).startsWith("./")).toBe(false);
  });

  it("normalizes windows-style separators to forward slashes", () => {
    expect(toPosixPath("src\\wallet\\wallet.service.ts")).toBe("src/wallet/wallet.service.ts");
  });

  it("leaves already-posix paths untouched", () => {
    expect(toPosixPath("src/wallet/wallet.service.ts")).toBe("src/wallet/wallet.service.ts");
  });
});
