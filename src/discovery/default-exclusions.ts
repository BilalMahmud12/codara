/**
 * Directory names excluded by default anywhere in the tree, unless the
 * caller's include patterns explicitly pull a path back in.
 */
export const DEFAULT_EXCLUDED_DIRECTORIES: readonly string[] = [
  ".git",
  "node_modules",
  "dist",
  "build",
  "out",
  "coverage",
  ".nyc_output",
  ".cache",
  ".turbo",
  ".next",
  ".codara",
  "tmp",
  "temp",
];

export function isDefaultExcludedDirectory(directoryName: string): boolean {
  return DEFAULT_EXCLUDED_DIRECTORIES.includes(directoryName);
}
