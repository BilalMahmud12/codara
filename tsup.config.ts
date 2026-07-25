import { defineConfig } from "tsup";

export default defineConfig({
  entry: {
    index: "src/index.ts",
    "cli/index": "src/cli/index.ts",
  },
  format: ["esm"],
  target: "node18",
  platform: "node",
  tsconfig: "tsconfig.build.json",
  dts: true,
  sourcemap: true,
  clean: true,
  splitting: false,
  shims: false,
});
