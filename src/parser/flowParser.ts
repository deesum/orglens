import fs from "node:fs";
import path from "node:path";
import { MetadataNode } from "../types/models.js";
import { walkFiles } from "../utils/fileWalker.js";

const apexActionRegex = /<apexClass>([^<]+)<\/apexClass>/g;
const objectRefRegex = /<object>([^<]+)<\/object>/g;
const subflowRegex = /<flowName>([^<]+)<\/flowName>/g;

export function parseFlows(repoPath: string): MetadataNode[] {
  const files = walkFiles(repoPath, [".xml"]).filter((f) =>
    f.endsWith(".flow-meta.xml"),
  );
  return files.map((filePath) => {
    const content = fs.readFileSync(filePath, "utf8");
    const refs = new Set<string>();
    for (const match of content.matchAll(apexActionRegex)) refs.add(match[1]);
    for (const match of content.matchAll(objectRefRegex)) refs.add(match[1]);
    for (const match of content.matchAll(subflowRegex)) refs.add(match[1]);
    return {
      id: `flow:${path.basename(filePath)}`,
      name: path.basename(filePath, ".flow-meta.xml"),
      type: "Flow",
      path: filePath,
      references: [...refs],
    };
  });
}
