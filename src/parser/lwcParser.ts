import fs from "node:fs";
import path from "node:path";
import { MetadataNode } from "../types/models.js";
import { walkFiles } from "../utils/fileWalker.js";

const apexImportRegex = /@salesforce\/apex\/([A-Za-z0-9_.]+)/g;
const schemaImportRegex = /@salesforce\/schema\/([A-Za-z0-9_.]+)/g;

export function parseLwc(repoPath: string): MetadataNode[] {
  const files = walkFiles(repoPath, [".js", ".html"]);
  const lwcFiles = files.filter((f) => f.includes(`${path.sep}lwc${path.sep}`));
  const bundles = new Map<string, { path: string; references: Set<string> }>();

  for (const filePath of lwcFiles) {
    const parts = filePath.split(path.sep);
    const lwcIndex = parts.lastIndexOf("lwc");
    if (lwcIndex < 0 || !parts[lwcIndex + 1]) {
      continue;
    }
    const bundleName = parts[lwcIndex + 1];
    const bundlePath = parts.slice(0, lwcIndex + 2).join(path.sep);
    const current = bundles.get(bundleName) ?? { path: bundlePath, references: new Set<string>() };
    const content = fs.readFileSync(filePath, "utf8");
    for (const match of content.matchAll(apexImportRegex)) {
      current.references.add(match[1]);
    }
    for (const match of content.matchAll(schemaImportRegex)) {
      current.references.add(match[1]);
    }
    bundles.set(bundleName, current);
  }

  return [...bundles.entries()].map(([bundleName, bundle]) => ({
    id: `lwc:${bundleName}`,
    name: bundleName,
    type: "LightningComponentBundle",
    path: bundle.path,
    references: [...bundle.references],
  }));
}
