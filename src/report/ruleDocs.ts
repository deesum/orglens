import { AnalyzerFinding } from "../types/models.js";

/**
 * Maps known PMD Apex rule names to their documentation category so we can
 * build a deep link into the official PMD rule reference.
 */
const PMD_APEX_CATEGORY: Record<string, string> = {
  // codestyle
  classnamingconventions: "codestyle",
  fieldnamingconventions: "codestyle",
  formalparameternamingconventions: "codestyle",
  localvariablenamingconventions: "codestyle",
  methodnamingconventions: "codestyle",
  propertynamingconventions: "codestyle",
  ifelsestmtsmustusebraces: "codestyle",
  ifstmtsmustusebraces: "codestyle",
  forloopsmustusebraces: "codestyle",
  whileloopsmustusebraces: "codestyle",
  onedeclarationperline: "codestyle",
  fielddeclarationsshouldbeatstart: "codestyle",
  // design
  excessiveclasslength: "design",
  excessiveparameterlist: "design",
  excessivepubliccount: "design",
  cyclomaticcomplexity: "design",
  cognitivecomplexity: "design",
  toomanyfields: "design",
  ncssconstructorcount: "design",
  ncssmethodcount: "design",
  ncsstypecount: "design",
  stdcyclomaticcomplexity: "design",
  avoiddeeplynestedifstmts: "design",
  // errorprone
  apexcsrf: "errorprone",
  avoidhardcodingid: "errorprone",
  avoidnonexistentannotations: "errorprone",
  emptycatchblock: "errorprone",
  emptyifstmt: "errorprone",
  emptystatementblock: "errorprone",
  emptytrystmt: "errorprone",
  emptywhilestmt: "errorprone",
  methodwithsamenameasenclosingclass: "errorprone",
  overridebothequalsandhashcode: "errorprone",
  testmethodsmustbeinpublicclass: "errorprone",
  // performance
  avoiddmlstatementsinloops: "performance",
  avoidsoqlinloops: "performance",
  avoidsoslinloops: "performance",
  operationwithlimitsinloop: "performance",
  eagerlyloadeddescribesobjectresult: "performance",
  // security
  apexbadcrypto: "security",
  apexcrudviolation: "security",
  apexdangerousmethods: "security",
  apexinsecureendpoint: "security",
  apexopenredirect: "security",
  apexsharingviolations: "security",
  apexsoqlinjection: "security",
  apexsuggestusingnamedcred: "security",
  apexxssfromescapefalse: "security",
  apexxssfromurlparam: "security",
  // bestpractices
  apexassertionsshouldincludemessage: "bestpractices",
  apexunittestclassshouldhaveasserts: "bestpractices",
  apexunittestclassshouldhaverunas: "bestpractices",
  apexunittestmethodshouldhaveisrunas: "bestpractices",
  apexunittestshouldnotuseseealldatatrue: "bestpractices",
  avoidglobalmodifier: "bestpractices",
  avoidlogicintrigger: "bestpractices",
  debugsshoulduselogginglevel: "bestpractices",
  unusedlocalvariable: "bestpractices",
  // documentation
  apexdoc: "documentation",
};

const FALLBACK_RULE_DOCS: Record<string, string> = {
  noeval: "https://eslint.org/docs/latest/rules/no-eval",
  noinnerhtml:
    "https://developer.salesforce.com/docs/platform/lwc/guide/security-lwsec-intro.html",
  todocomment:
    "https://pmd.github.io/pmd/pmd_rules_apex_errorprone.html#avoidtodocomment",
};

function isEslintRule(ruleName: string): boolean {
  // ESLint rules are lowercase, dash-separated (e.g. no-undef, no-unused-vars)
  // and may be namespaced (e.g. @lwc/lwc/no-async-operation).
  return /^[a-z@][a-z0-9@/-]*-[a-z0-9/-]+$/.test(ruleName) && ruleName === ruleName.toLowerCase();
}

/**
 * Resolves a best-effort documentation URL for a given finding's rule.
 * Returns undefined when no sensible link can be derived.
 */
export function ruleDocUrl(finding: Pick<AnalyzerFinding, "ruleName" | "metadataType">): string | undefined {
  const raw = finding.ruleName?.trim();
  if (!raw || raw === "UnknownRule") return undefined;
  const key = raw.toLowerCase();

  if (FALLBACK_RULE_DOCS[key]) return FALLBACK_RULE_DOCS[key];

  // ESLint / LWC ESLint rules
  if (isEslintRule(raw)) {
    if (raw.startsWith("@lwc/lwc/")) {
      const short = raw.replace("@lwc/lwc/", "");
      return `https://github.com/salesforce/eslint-plugin-lwc/blob/master/docs/rules/${short}.md`;
    }
    if (raw.startsWith("@salesforce/")) {
      return "https://github.com/salesforce/eslint-plugin-lwc";
    }
    if (raw.startsWith("@")) {
      return `https://www.google.com/search?q=eslint+rule+${encodeURIComponent(raw)}`;
    }
    return `https://eslint.org/docs/latest/rules/${raw}`;
  }

  // PMD Apex rules (PascalCase, no dashes)
  const category = PMD_APEX_CATEGORY[key];
  if (category) {
    return `https://pmd.github.io/pmd/pmd_rules_apex_${category}.html#${key}`;
  }
  if (finding.metadataType === "ApexClass" || /^[A-Z][A-Za-z0-9]+$/.test(raw)) {
    // Unknown Apex rule — link to the Apex rule index.
    return "https://pmd.github.io/pmd/pmd_rules_apex.html";
  }

  return undefined;
}
