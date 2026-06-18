import { AnalyzerFinding, MetadataType, Severity } from "../types/models.js";

interface RawFinding {
  ruleName?: string;
  rule?: string;
  message?: string;
  severity?: number | string;
  category?: string;
  fileName?: string;
  line?: number;
  url?: string;
}

function normalizeSeverity(value: number | string | undefined): Severity {
  if (typeof value === "number") {
    // PMD uses 1..5 where 1 is highest priority.
    if (value <= 1) return "critical";
    if (value === 2) return "high";
    if (value === 3) return "medium";
    return "low";
  }

  const normalized = `${value ?? ""}`.toLowerCase();
  if (normalized.includes("critical")) return "critical";
  if (normalized.includes("high")) return "high";
  if (normalized.includes("medium")) return "medium";
  return "low";
}

function inferMetadataType(filePath: string): MetadataType {
  if (filePath.endsWith(".cls")) return "ApexClass";
  if (filePath.includes("/lwc/")) return "LightningComponentBundle";
  if (filePath.endsWith(".flow-meta.xml")) return "Flow";
  return "Unknown";
}

function inferComponentName(
  filePath: string,
  metadataType: MetadataType,
): string | undefined {
  if (metadataType === "ApexClass") {
    return filePath
      .split("/")
      .pop()
      ?.replace(/\.cls$/, "");
  }
  if (metadataType === "Flow") {
    return filePath
      .split("/")
      .pop()
      ?.replace(/\.flow-meta\.xml$/, "");
  }
  if (metadataType === "LightningComponentBundle") {
    const parts = filePath.split("/");
    const lwcIndex = parts.lastIndexOf("lwc");
    if (lwcIndex >= 0 && parts[lwcIndex + 1]) {
      return parts[lwcIndex + 1];
    }
  }
  return undefined;
}

export function normalizeFindings(
  rawFindings: RawFinding[],
): AnalyzerFinding[] {
  return rawFindings.map((f, index) => {
    const filePath = f.fileName ?? "unknown";
    const metadataType = inferMetadataType(filePath);
    return {
      id: `finding-${index + 1}`,
      ruleName: f.ruleName ?? f.rule ?? "UnknownRule",
      message: (f.message ?? "No message provided").trim(),
      severity: normalizeSeverity(f.severity),
      category: f.category ?? "maintainability",
      filePath,
      componentName: inferComponentName(filePath, metadataType),
      line: f.line,
      metadataType,
      references: [],
      url: f.url,
    };
  });
}
