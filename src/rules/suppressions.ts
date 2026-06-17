import { AgentConfig } from "../config/schema.js";
import { AnalyzerFinding } from "../types/models.js";

export interface SuppressionAudit {
  findingId: string;
  rationale: string;
}

export function applySuppressions(
  findings: AnalyzerFinding[],
  config: AgentConfig,
): { activeFindings: AnalyzerFinding[]; audit: SuppressionAudit[] } {
  const audit: SuppressionAudit[] = [];
  const activeFindings = findings.filter((finding) => {
    for (const rule of config.suppression.rules) {
      const ruleMatch = !rule.ruleName || finding.ruleName === rule.ruleName;
      const fileMatch =
        !rule.filePathPattern || new RegExp(rule.filePathPattern).test(finding.filePath);
      if (ruleMatch && fileMatch) {
        audit.push({
          findingId: finding.id,
          rationale: rule.rationale ?? "Suppressed by config",
        });
        return false;
      }
    }
    return true;
  });

  return { activeFindings, audit };
}
