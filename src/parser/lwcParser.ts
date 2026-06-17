import fs from "node:fs";
import path from "node:path";
import { MetadataNode } from "../types/models.js";
import { walkFiles } from "../utils/fileWalker.js";

const apexImportRegex = /@salesforce\/apex\/([A-Za-z0-9_.]+)/g;
const schemaImportRegex = /@salesforce\/schema\/([A-Za-z0-9_.]+)/g;

export function parseLwc(repoPath: string): MetadataNode[] {
  const files = walkFiles(repoPath, [".js", ".html"]);
  const lwcFiles = files.filter((f) => f.includes(`${path.sep}lwc${path.sep}`));

  return lwcFiles.map((filePath) => {
    const content = fs.readFileSync(filePath, "utf8");
    const refs = new Set<string>();
    for (const match of content.matchAll(apexImportRegex)) {
      refs.add(match[1]);
    }
    for (const match of content.matchAll(schemaImportRegex)) {
      refs.add(match[1]);
    }
    return {
      id: `lwc:${path.basename(filePath)}`,
      name: path.basename(filePath),
      type: "LightningComponentBundle",
      path: filePath,
      references: [...refs],
    };
  });
}
