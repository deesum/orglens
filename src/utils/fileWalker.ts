import fs from "node:fs";
import path from "node:path";

export function walkFiles(rootPath: string, extensions: string[]): string[] {
  const out: string[] = [];
  const ignoredDirectories = new Set([
    ".git",
    ".sfdx",
    ".sf",
    "node_modules",
    "dist",
    ".cre-snapshots",
  ]);

  function visit(current: string): void {
    const entries = fs.readdirSync(current, { withFileTypes: true });
    for (const entry of entries) {
      if (ignoredDirectories.has(entry.name)) {
        continue;
      }
      const fullPath = path.join(current, entry.name);
      if (entry.isDirectory()) {
        visit(fullPath);
      } else {
        const ext = path.extname(entry.name);
        if (extensions.includes(ext)) {
          out.push(fullPath);
        }
      }
    }
  }

  visit(rootPath);
  return out;
}
