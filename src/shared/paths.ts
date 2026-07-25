import { relative } from "node:path";

/**
 * Converts an absolute path to a project-relative, POSIX-style path.
 * Output never begins with "./" and always uses forward slashes,
 * regardless of host platform.
 */
export function toProjectRelativePath(rootPath: string, absolutePath: string): string {
  const relativePath = relative(rootPath, absolutePath);
  return toPosixPath(relativePath);
}

/**
 * Normalizes any backslash path separators to forward slashes so
 * output is byte-identical across host platforms, independent of the
 * current process's path separator.
 */
export function toPosixPath(inputPath: string): string {
  return inputPath.split("\\").join("/");
}
