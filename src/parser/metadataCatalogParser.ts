import path from "node:path";
import { MetadataNode, MetadataType } from "../types/models.js";
import { walkFiles } from "../utils/fileWalker.js";

function fileToMetadataType(filePath: string): MetadataType {
  if (filePath.endsWith(".cls")) return "ApexClass";
  if (filePath.endsWith(".trigger")) return "ApexTrigger";
  if (filePath.includes(`${path.sep}lwc${path.sep}`)) return "LightningComponentBundle";
  if (filePath.includes(`${path.sep}aura${path.sep}`)) return "AuraDefinitionBundle";
  if (filePath.endsWith(".flow-meta.xml")) return "Flow";
  if (filePath.includes(`${path.sep}objects${path.sep}`) && filePath.endsWith(".object-meta.xml")) return "CustomObject";
  if (filePath.includes(`${path.sep}objects${path.sep}`) && filePath.endsWith(".field-meta.xml")) return "CustomField";
  if (filePath.includes(`${path.sep}permissionsets${path.sep}`)) return "PermissionSet";
  if (filePath.includes(`${path.sep}flexipages${path.sep}`)) return "FlexiPage";
  if (filePath.includes(`${path.sep}labels${path.sep}`)) return "CustomLabel";
  if (filePath.includes(`${path.sep}staticresources${path.sep}`)) return "StaticResource";
  if (filePath.includes(`${path.sep}pages${path.sep}`)) return "VisualforcePage";
  return "Unknown";
}

function componentName(filePath: string, metadataType: MetadataType): string {
  const base = path.basename(filePath);
  if (metadataType === "LightningComponentBundle" || metadataType === "AuraDefinitionBundle") {
    const parts = filePath.split(path.sep);
    const folder = metadataType === "LightningComponentBundle" ? "lwc" : "aura";
    const idx = parts.lastIndexOf(folder);
    return idx >= 0 && parts[idx + 1] ? parts[idx + 1] : base;
  }
  return base
    .replace(/\.cls$/, "")
    .replace(/\.trigger$/, "")
    .replace(/\.flow-meta\.xml$/, "")
    .replace(/\.object-meta\.xml$/, "")
    .replace(/\.field-meta\.xml$/, "")
    .replace(/\.permissionset-meta\.xml$/, "")
    .replace(/\.flexipage-meta\.xml$/, "")
    .replace(/\.labels-meta\.xml$/, "")
    .replace(/\.resource-meta\.xml$/, "")
    .replace(/\.page$/, "");
}

export function parseMetadataCatalog(rootPath: string): MetadataNode[] {
  const files = walkFiles(rootPath, [".cls", ".trigger", ".js", ".html", ".xml", ".page", ".cmp"]);
  const nodes: MetadataNode[] = [];
  const seen = new Set<string>();
  for (const filePath of files) {
    const type = fileToMetadataType(filePath);
    if (type === "Unknown") continue;
    const name = componentName(filePath, type);
    const id = `${type}:${name}`;
    if (seen.has(id)) continue;
    seen.add(id);
    nodes.push({ id, name, type, path: filePath, references: [] });
  }
  return nodes;
}
