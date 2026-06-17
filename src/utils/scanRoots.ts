import fs from "node:fs";
import path from "node:path";

function isDir(p: string): boolean {
  try {
    return fs.statSync(p).isDirectory();
  } catch {
    return false;
  }
}

export function detectMetadataRoots(projectPath: string): string[] {
  const roots = new Set<string>();
  const absolute = path.resolve(projectPath);

  // If user already points to metadata root, keep it.
  if (isDir(absolute) && absolute.endsWith(path.join("main", "default"))) {
    roots.add(absolute);
  }

  // Standard SFDX structure.
  const standard = path.join(absolute, "force-app", "main", "default");
  if (isDir(standard)) roots.add(standard);

  // Multi-app mono repo style.
  const appsDir = path.join(absolute, "apps");
  if (isDir(appsDir)) {
    for (const app of fs.readdirSync(appsDir)) {
      const candidate = path.join(appsDir, app, "force-app", "main", "default");
      if (isDir(candidate)) roots.add(candidate);
    }
  }

  // If nothing detected, fallback to given path.
  if (roots.size === 0 && isDir(absolute)) {
    roots.add(absolute);
  }

  return [...roots];
}
