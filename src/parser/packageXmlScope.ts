import fs from "node:fs";
import { AnalyzerFinding, MetadataNode, MetadataType } from "../types/models.js";

interface PackageScope {
  entries: Map<string, Set<string>>;
}

const metadataTypeToManifestType: Record<MetadataType, string> = {
  ApexClass: "ApexClass",
  LightningComponentBundle: "LightningComponentBundle",
  Flow: "Flow",
  Unknown: "Unknown",
};

function parsePackageXml(packagePath: string): PackageScope | null {
  if (!packagePath || !fs.existsSync(packagePath)) {
    return null;
  }
  const xml = fs.readFileSync(packagePath, "utf8");
  const typeBlocks = [...xml.matchAll(/<types>([\s\S]*?)<\/types>/g)];
  if (typeBlocks.length === 0) {
    return null;
  }

  const entries = new Map<string, Set<string>>();
  for (const [, block] of typeBlocks) {
    const nameMatch = block.match(/<name>([^<]+)<\/name>/);
    if (!nameMatch) continue;
    const typeName = nameMatch[1].trim();
    const members = [...block.matchAll(/<members>([^<]+)<\/members>/g)].map((m) => m[1].trim());
    entries.set(typeName, new Set(members));
  }
  return { entries };
}

function inScope(typeName: string, componentName: string, scope: PackageScope): boolean {
  const members = scope.entries.get(typeName);
  if (!members) return false;
  return members.has("*") || members.has(componentName);
}

export function filterNodesByPackage(nodes: MetadataNode[], packagePath?: string): MetadataNode[] {
  if (!packagePath) return nodes;
  const scope = parsePackageXml(packagePath);
  if (!scope) return nodes;

  return nodes.filter((node) => inScope(metadataTypeToManifestType[node.type] ?? "Unknown", node.name, scope));
}

export function filterFindingsByPackage(
  findings: AnalyzerFinding[],
  nodes: MetadataNode[],
  packagePath?: string,
): AnalyzerFinding[] {
  if (!packagePath) return findings;
  const scope = parsePackageXml(packagePath);
  if (!scope) return findings;

  const nodePathSet = new Set(nodes.map((n) => n.path));
  return findings.filter((finding) => {
    if (finding.componentName) {
      const manifestType = metadataTypeToManifestType[finding.metadataType] ?? "Unknown";
      if (inScope(manifestType, finding.componentName, scope)) {
        return true;
      }
    }
    return nodePathSet.has(finding.filePath);
  });
}
