/**
 * Minimal glob matcher for user include/exclude patterns. Supports
 * "*" (any run of characters except "/"), "**" (any run of characters
 * including "/"), and "?" (a single non-"/" character). Patterns are
 * matched against POSIX-style project-relative paths.
 */
export function matchesGlob(pattern: string, relativePath: string): boolean {
  const regex = globToRegExp(pattern);
  return regex.test(relativePath);
}

const regexCache = new Map<string, RegExp>();

function globToRegExp(pattern: string): RegExp {
  const cached = regexCache.get(pattern);
  if (cached) {
    return cached;
  }

  let source = "^";
  for (let index = 0; index < pattern.length; index += 1) {
    const char = pattern[index];
    if (char === "*") {
      if (pattern[index + 1] === "*") {
        source += ".*";
        index += 1;
      } else {
        source += "[^/]*";
      }
    } else if (char === "?") {
      source += "[^/]";
    } else if (".+^${}()|[]\\".includes(char!)) {
      source += `\\${char}`;
    } else {
      source += char;
    }
  }
  source += "$";

  const regex = new RegExp(source);
  regexCache.set(pattern, regex);
  return regex;
}
