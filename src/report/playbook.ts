import { AnalyzerFinding, PlaybookGuidance } from "../types/models.js";

function domainForFinding(
  finding: AnalyzerFinding,
): PlaybookGuidance["domain"] {
  if (finding.metadataType === "ApexClass") return "Apex";
  if (finding.metadataType === "LightningComponentBundle") return "LWC";
  if (finding.metadataType === "Flow") return "Flow";
  return "General";
}

export function buildPlaybook(findings: AnalyzerFinding[]): PlaybookGuidance[] {
  return findings.slice(0, 20).map((finding) => {
    const domain = domainForFinding(finding);
    const fixSteps: string[] = [];
    const verifySteps: string[] = [];
    const rule = finding.ruleName.toLowerCase();

    if (domain === "Apex") {
      fixSteps.push(
        "Refactor the flagged Apex block to follow Salesforce coding standards and PMD guidance.",
      );
      verifySteps.push(
        "Run Apex tests for impacted classes and validate no regression in business logic.",
      );
    } else if (domain === "LWC") {
      fixSteps.push(
        "Update JavaScript/HTML implementation to align with LWC security and maintainability rules.",
      );
      verifySteps.push(
        "Run LWC Jest tests and confirm UI behavior/accessibility remains intact.",
      );
    } else if (domain === "Flow") {
      fixSteps.push(
        "Update flow element configuration and naming to remove anti-patterns and improve supportability.",
      );
      verifySteps.push(
        "Run flow in debug mode with realistic records and validate expected path behavior.",
      );
    } else {
      fixSteps.push(
        "Apply metadata rule guidance and align with project conventions.",
      );
      verifySteps.push(
        "Re-run scanner and validate findings no longer appear.",
      );
    }

    if (rule.includes("soql") || rule.includes("dml")) {
      fixSteps.unshift(
        "Bulkify logic by removing SOQL/DML from loops and grouping record operations.",
      );
      verifySteps.unshift(
        "Execute bulk test scenario to confirm governor-limit resilience.",
      );
    } else if (rule.includes("naming")) {
      fixSteps.unshift(
        "Rename the flagged symbol to satisfy naming conventions.",
      );
    } else if (
      rule.includes("crud") ||
      rule.includes("fls") ||
      finding.category.toLowerCase().includes("security")
    ) {
      fixSteps.unshift(
        "Add CRUD/FLS checks and sharing-aware access controls before data operations.",
      );
      verifySteps.unshift(
        "Validate restricted-profile behavior to confirm security enforcement.",
      );
    }

    return {
      findingId: finding.id,
      domain,
      ruleName: finding.ruleName,
      whyPriority: `${finding.severity.toUpperCase()} severity in ${finding.category} at ${finding.filePath}.`,
      fixSteps,
      verificationSteps: verifySteps,
    };
  });
}
