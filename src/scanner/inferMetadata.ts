import { MetadataType } from "../types/models.js";

function toPosix(filePath: string): string {
  return filePath.replace(/\\/g, "/");
}

export function inferMetadataType(filePath: string): MetadataType {
  const p = toPosix(filePath);
  if (p.endsWith(".cls")) return "ApexClass";
  if (p.endsWith(".trigger")) return "ApexTrigger";
  if (p.includes("/lwc/")) return "LightningComponentBundle";
  if (p.includes("/aura/")) return "AuraDefinitionBundle";
  if (p.endsWith(".flow-meta.xml")) return "Flow";
  if (p.endsWith(".page")) return "VisualforcePage";
  return "Unknown";
}

export function inferComponentName(
  filePath: string,
  metadataType: MetadataType,
): string | undefined {
  const p = toPosix(filePath);
  if (metadataType === "ApexClass") {
    return p
      .split("/")
      .pop()
      ?.replace(/\.cls$/, "");
  }
  if (metadataType === "ApexTrigger") {
    return p
      .split("/")
      .pop()
      ?.replace(/\.trigger$/, "");
  }
  if (metadataType === "Flow") {
    return p
      .split("/")
      .pop()
      ?.replace(/\.flow-meta\.xml$/, "");
  }
  if (
    metadataType === "LightningComponentBundle" ||
    metadataType === "AuraDefinitionBundle"
  ) {
    const parts = p.split("/");
    const folder = metadataType === "LightningComponentBundle" ? "lwc" : "aura";
    const index = parts.lastIndexOf(folder);
    if (index >= 0 && parts[index + 1]) {
      return parts[index + 1];
    }
  }
  return undefined;
}
