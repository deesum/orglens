import { AnalyzerFinding, MetadataType, Severity } from "../types/models.js";

interface RawFinding {
  rule?: string;
  message?: string;
  severity?: number | string;
  category?: string;
  fileName?: string;
  line?: number;
}

function normalizeSeverity(value: number | string | undefined): Severity {
  if (typeof value === "number") {
    if (value >= 4) return "critical";
    if (value >= 3) return "high";
    if (value >= 2) return "medium";
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

export function normalizeFindings(rawFindings: RawFinding[]): AnalyzerFinding[] {
  return rawFindings.map((f, index) => {
    const filePath = f.fileName ?? "unknown";
    return {
      id: `finding-${index + 1}`,
      ruleName: f.rule ?? "UnknownRule",
      message: f.message ?? "No message provided",
      severity: normalizeSeverity(f.severity),
      category: f.category ?? "maintainability",
      filePath,
      line: f.line,
      metadataType: inferMetadataType(filePath),
      references: [],
    };
  });
}
