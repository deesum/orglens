import fs from "node:fs";
import path from "node:path";

export function walkFiles(rootPath: string, extensions: string[]): string[] {
  const out: string[] = [];

  function visit(current: string): void {
    const entries = fs.readdirSync(current, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.name.startsWith(".git") || entry.name === "node_modules") {
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
