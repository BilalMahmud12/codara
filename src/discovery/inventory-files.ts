import { readdir, stat } from "node:fs/promises";
import { extname, join } from "node:path";
import type { Diagnostic } from "../model/diagnostic.js";
import type { SourceFileRecord } from "../model/project.js";
import { toProjectRelativePath } from "../shared/paths.js";
import { isDefaultExcludedDirectory } from "./default-exclusions.js";
import { classifyFile } from "./classify-file.js";
import { createFileId } from "../identity/entity-id.js";
import { matchesGlob } from "./glob.js";

export interface InventoryFilesOptions {
  include?: string[];
  exclude?: string[];
  maxFileSizeBytes?: number;
  maxFiles?: number;
}

export interface InventoryFilesResult {
  files: SourceFileRecord[];
  diagnostics: Diagnostic[];
}

const DEFAULT_MAX_FILE_SIZE_BYTES = 5 * 1024 * 1024;
const DEFAULT_MAX_FILES = 20000;

export async function inventoryFiles(
  rootPath: string,
  projectId: string,
  options: InventoryFilesOptions = {},
): Promise<InventoryFilesResult> {
  const maxFileSizeBytes = options.maxFileSizeBytes ?? DEFAULT_MAX_FILE_SIZE_BYTES;
  const maxFiles = options.maxFiles ?? DEFAULT_MAX_FILES;
  const include = options.include ?? [];
  const exclude = options.exclude ?? [];

  const files: SourceFileRecord[] = [];
  const diagnostics: Diagnostic[] = [];
  let truncated = false;

  await walk(rootPath, rootPath);

  async function walk(currentDir: string, root: string): Promise<void> {
    if (truncated) {
      return;
    }
    let entries;
    try {
      entries = await readdir(currentDir, { withFileTypes: true });
    } catch (error) {
      diagnostics.push({
        code: "directory-read-error",
        severity: "warning",
        message: `Failed to read directory: ${(error as Error).message}`,
        filePath: toProjectRelativePath(root, currentDir),
        recoverable: true,
      });
      return;
    }

    entries.sort((a, b) => a.name.localeCompare(b.name));

    for (const entry of entries) {
      if (entry.isSymbolicLink()) {
        continue;
      }

      const absolutePath = join(currentDir, entry.name);

      if (entry.isDirectory()) {
        if (isDefaultExcludedDirectory(entry.name)) {
          continue;
        }
        const relativeDirPath = toProjectRelativePath(root, absolutePath);
        if (exclude.some((pattern) => matchesGlob(pattern, relativeDirPath))) {
          continue;
        }
        await walk(absolutePath, root);
        continue;
      }

      if (!entry.isFile()) {
        continue;
      }

      if (files.length >= maxFiles) {
        if (!truncated) {
          truncated = true;
          diagnostics.push({
            code: "file-count-limit-reached",
            severity: "warning",
            message: `File inventory truncated after reaching the configured limit of ${maxFiles} files.`,
            recoverable: true,
          });
        }
        return;
      }

      const relativePath = toProjectRelativePath(root, absolutePath);

      if (exclude.some((pattern) => matchesGlob(pattern, relativePath))) {
        continue;
      }
      if (include.length > 0 && !include.some((pattern) => matchesGlob(pattern, relativePath))) {
        continue;
      }

      const extension = extname(entry.name);
      let sizeBytes: number;
      try {
        const stats = await stat(absolutePath);
        sizeBytes = stats.size;
      } catch (error) {
        diagnostics.push({
          code: "file-stat-error",
          severity: "warning",
          message: `Failed to stat file: ${(error as Error).message}`,
          filePath: relativePath,
          recoverable: true,
        });
        continue;
      }

      const { classification, language, shouldParse } = classifyFile(relativePath, extension);
      const tooLarge = sizeBytes > maxFileSizeBytes;

      if (tooLarge) {
        diagnostics.push({
          code: "file-too-large",
          severity: "warning",
          message: `Skipped parsing file larger than ${maxFileSizeBytes} bytes.`,
          filePath: relativePath,
          recoverable: true,
        });
      }

      files.push({
        id: createFileId(relativePath),
        projectId,
        relativePath,
        extension,
        sizeBytes,
        classification,
        language,
        shouldParse: shouldParse && !tooLarge,
        exclusionReason: tooLarge ? "file-too-large" : undefined,
      });
    }
  }

  files.sort((a, b) => a.relativePath.localeCompare(b.relativePath));

  return { files, diagnostics };
}
