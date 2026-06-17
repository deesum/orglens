import fs from "node:fs";
import path from "node:path";
import { MetadataNode } from "../types/models.js";
import { walkFiles } from "../utils/fileWalker.js";

const referenceRegex = /\b([A-Za-z_][A-Za-z0-9_]*(?:__c|__r)?)\b/g;

export function parseApex(repoPath: string): MetadataNode[] {
  const files = walkFiles(repoPath, [".cls"]);
  return files.map((filePath) => {
    const content = fs.readFileSync(filePath, "utf8");
    const refs = new Set<string>();
    for (const match of content.matchAll(referenceRegex)) {
      refs.add(match[1]);
    }
    return {
      id: `apex:${path.basename(filePath)}`,
      name: path.basename(filePath, ".cls"),
      type: "ApexClass",
      path: filePath,
      references: [...refs].slice(0, 100),
    };
  });
}
