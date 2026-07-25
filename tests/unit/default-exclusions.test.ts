import { describe, expect, it } from "vitest";
import { isDefaultExcludedDirectory } from "../../src/discovery/default-exclusions.js";

describe("default exclusions", () => {
  it.each(["node_modules", ".git", "dist", "build", "out", "coverage", ".nyc_output"])(
    "excludes %s by default",
    (directoryName) => {
      expect(isDefaultExcludedDirectory(directoryName)).toBe(true);
    },
  );

  it.each(["src", "lib", "test", "tests", "packages"])(
    "does not exclude %s by default",
    (directoryName) => {
      expect(isDefaultExcludedDirectory(directoryName)).toBe(false);
    },
  );
});
