import { readdir } from "node:fs/promises";

export interface RootReconnaissance {
  entries: string[];
  hasPackageJson: boolean;
  hasTsConfig: boolean;
  hasJsConfig: boolean;
  lockfiles: string[];
  packageManager: "npm" | "yarn" | "pnpm" | "bun" | "unknown";
  notableDirectories: string[];
}

const LOCKFILE_TO_PACKAGE_MANAGER: Record<string, RootReconnaissance["packageManager"]> = {
  "package-lock.json": "npm",
  "npm-shrinkwrap.json": "npm",
  "yarn.lock": "yarn",
  "pnpm-lock.yaml": "pnpm",
  "bun.lock": "bun",
  "bun.lockb": "bun",
};

const NOTABLE_DIRECTORY_NAMES = [
  "src",
  "lib",
  "app",
  "packages",
  "apps",
  "test",
  "tests",
  "coverage",
];

/**
 * Cheap, non-recursive inspection of the root directory. Does not
 * construct a TypeScript Program or read file contents.
 */
export async function inspectRoot(rootPath: string): Promise<RootReconnaissance> {
  const dirents = await readdir(rootPath, { withFileTypes: true });
  const entries = dirents.map((entry) => entry.name);
  const entrySet = new Set(entries);

  const lockfiles = Object.keys(LOCKFILE_TO_PACKAGE_MANAGER).filter((name) => entrySet.has(name));
  const packageManager: RootReconnaissance["packageManager"] =
    lockfiles.length > 0 ? LOCKFILE_TO_PACKAGE_MANAGER[lockfiles[0] as string]! : "unknown";

  const notableDirectories = dirents
    .filter((entry) => entry.isDirectory() && NOTABLE_DIRECTORY_NAMES.includes(entry.name))
    .map((entry) => entry.name);

  return {
    entries,
    hasPackageJson: entrySet.has("package.json"),
    hasTsConfig: entrySet.has("tsconfig.json"),
    hasJsConfig: entrySet.has("jsconfig.json"),
    lockfiles,
    packageManager,
    notableDirectories,
  };
}
