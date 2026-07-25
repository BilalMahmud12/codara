import { basename } from "node:path";
import type { FileClassification, SourceLanguage } from "../model/project.js";

const SOURCE_EXTENSION_LANGUAGE: Record<string, SourceLanguage> = {
  ".js": "js",
  ".mjs": "js",
  ".cjs": "js",
  ".jsx": "jsx",
  ".ts": "ts",
  ".mts": "ts",
  ".cts": "ts",
  ".tsx": "tsx",
};

const CONFIGURATION_FILENAMES = new Set([
  "package.json",
  "package-lock.json",
  ".eslintrc",
  ".eslintrc.json",
  ".eslintrc.js",
  ".eslintrc.cjs",
  ".prettierrc",
  ".prettierrc.json",
  ".editorconfig",
  ".gitignore",
  ".npmignore",
  ".nvmrc",
]);

const CONFIGURATION_NAME_PATTERN =
  /(^|\.)(tsconfig|jsconfig|eslint\.config|vitest\.config|jest\.config|babel\.config|webpack\.config|rollup\.config|vite\.config|tsup\.config|prettier\.config|postcss\.config)\.[a-z]+$/i;

const CONFIGURATION_EXTENSIONS = new Set([".json", ".yaml", ".yml", ".toml", ".ini"]);

export interface FileClassificationResult {
  classification: FileClassification;
  language?: SourceLanguage;
  shouldParse: boolean;
}

export function classifyFile(relativePath: string, extension: string): FileClassificationResult {
  const fileName = basename(relativePath);
  const segments = relativePath.split("/");
  const language = SOURCE_EXTENSION_LANGUAGE[extension.toLowerCase()];

  if (fileName.endsWith(".d.ts") || fileName.endsWith(".d.mts") || fileName.endsWith(".d.cts")) {
    return { classification: "declaration", language: "ts", shouldParse: false };
  }

  if (segments.some((segment) => segment === "dist" || segment === "build" || segment === "out")) {
    return { classification: "buildOutput", language, shouldParse: false };
  }

  if (segments.some((segment) => /^(fixtures|__fixtures__|__mocks__)$/.test(segment))) {
    return { classification: "fixture", language, shouldParse: false };
  }

  if (/\.generated\./.test(fileName) || segments.includes("generated")) {
    return { classification: "generated", language, shouldParse: false };
  }

  if (
    segments.some((segment) => /^(test|tests|__tests__)$/.test(segment)) ||
    /\.(test|spec)\.[^.]+$/.test(fileName)
  ) {
    return {
      classification: "testSource",
      language,
      shouldParse: language !== undefined,
    };
  }

  if (
    CONFIGURATION_FILENAMES.has(fileName) ||
    CONFIGURATION_NAME_PATTERN.test(fileName) ||
    (CONFIGURATION_EXTENSIONS.has(extension.toLowerCase()) && !language)
  ) {
    return { classification: "configuration", language, shouldParse: false };
  }

  if (segments.some((segment) => /^(scripts|bin)$/.test(segment))) {
    return {
      classification: "script",
      language,
      shouldParse: language !== undefined,
    };
  }

  if (language) {
    return { classification: "productionSource", language, shouldParse: true };
  }

  return { classification: "unknown", language, shouldParse: false };
}
