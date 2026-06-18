import { AnalyzerFinding } from "../types/models.js";

export function deriveComponentName(finding: AnalyzerFinding): string {
  if (finding.componentName) return finding.componentName;
  const parts = finding.filePath.replaceAll("\\", "/").split("/");
  const file = parts[parts.length - 1] ?? "";
  return file.replace(
    /\.(cls|trigger|js|html|css|flow-meta\.xml|object-meta\.xml|field-meta\.xml)$/,
    "",
  );
}
