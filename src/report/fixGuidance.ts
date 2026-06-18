import { AnalyzerFinding } from "../types/models.js";

export function recommendedFixForFinding(finding: AnalyzerFinding): string {
  const rule = finding.ruleName.toLowerCase();
  const category = finding.category.toLowerCase();

  if (rule.includes("naming")) {
    return "Rename the symbol to match the naming convention expected by the rule, then rerun scanner.";
  }
  if (rule.includes("soql") || rule.includes("dml")) {
    return "Bulkify logic: move SOQL/DML outside loops, batch records, and add a bulk test case.";
  }
  if (
    rule.includes("crud") ||
    rule.includes("fls") ||
    category.includes("security")
  ) {
    return "Add explicit CRUD/FLS checks and enforce sharing/security guards before data access.";
  }
  if (category.includes("performance")) {
    return "Reduce expensive operations, cache reusable values, and avoid repeated work in loops.";
  }
  if (category.includes("reliability")) {
    return "Add null/edge handling and targeted tests for failure paths.";
  }
  return "Apply the rule guidance in scanner docs, fix the flagged code location, and validate with unit tests.";
}
