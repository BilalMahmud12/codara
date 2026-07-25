import { describe, expect, it } from "vitest";
import { classifyFile } from "../../src/discovery/classify-file.js";

describe("classifyFile", () => {
  it("classifies a plain .ts file as production source", () => {
    const result = classifyFile("src/wallet/wallet.service.ts", ".ts");
    expect(result).toEqual({
      classification: "productionSource",
      language: "ts",
      shouldParse: true,
    });
  });

  it("classifies a .d.ts file as a declaration file that is not parsed", () => {
    const result = classifyFile("src/types/global.d.ts", ".ts");
    expect(result.classification).toBe("declaration");
    expect(result.shouldParse).toBe(false);
  });

  it("classifies files under a __tests__ directory as test source", () => {
    const result = classifyFile("src/wallet/__tests__/wallet.service.ts", ".ts");
    expect(result.classification).toBe("testSource");
    expect(result.shouldParse).toBe(true);
  });

  it("classifies *.test.ts files as test source regardless of directory", () => {
    const result = classifyFile("src/wallet/wallet.service.test.ts", ".ts");
    expect(result.classification).toBe("testSource");
  });

  it("classifies *.spec.tsx files as test source", () => {
    const result = classifyFile("src/components/Button.spec.tsx", ".tsx");
    expect(result.classification).toBe("testSource");
    expect(result.language).toBe("tsx");
  });

  it("classifies package.json as configuration", () => {
    const result = classifyFile("package.json", ".json");
    expect(result).toEqual({
      classification: "configuration",
      language: undefined,
      shouldParse: false,
    });
  });

  it("classifies tsconfig.json as configuration", () => {
    const result = classifyFile("tsconfig.json", ".json");
    expect(result.classification).toBe("configuration");
  });

  it("classifies files under dist/ as build output", () => {
    const result = classifyFile("dist/index.js", ".js");
    expect(result.classification).toBe("buildOutput");
    expect(result.shouldParse).toBe(false);
  });

  it("classifies files under a fixtures directory as fixtures", () => {
    const result = classifyFile("tests/fixtures/sample/index.ts", ".ts");
    expect(result.classification).toBe("fixture");
    expect(result.shouldParse).toBe(false);
  });

  it("classifies files under a scripts directory as scripts", () => {
    const result = classifyFile("scripts/build.js", ".js");
    expect(result.classification).toBe("script");
    expect(result.shouldParse).toBe(true);
  });

  it("classifies unrecognized extensions as unknown", () => {
    const result = classifyFile("README.md", ".md");
    expect(result).toEqual({ classification: "unknown", language: undefined, shouldParse: false });
  });

  it("classifies generated files as generated", () => {
    const result = classifyFile("src/api.generated.ts", ".ts");
    expect(result.classification).toBe("generated");
    expect(result.shouldParse).toBe(false);
  });
});
