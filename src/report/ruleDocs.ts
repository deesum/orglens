import { AnalyzerFinding } from "../types/models.js";

const PMD_DOCS_BASE = "https://docs.pmd-code.org/latest";
const CA_GUIDE_BASE =
  "https://developer.salesforce.com/docs/platform/salesforce-code-analyzer/guide";

/** Salesforce Code Analyzer v5 per-engine documentation pages. */
const ENGINE_DOCS: Record<string, string> = {
  regex: `${CA_GUIDE_BASE}/engine-regex.html`,
  eslint: `${CA_GUIDE_BASE}/engine-eslint.html`,
  cpd: `${CA_GUIDE_BASE}/engine-cpd.html`,
  pmd: `${CA_GUIDE_BASE}/engine-pmd.html`,
  sfge: `${CA_GUIDE_BASE}/engine-sfge.html`,
  flow: `${CA_GUIDE_BASE}/engine-flow.html`,
};

/**
 * Complete map of PMD Apex rule names (lowercased) to their documentation
 * category. PMD groups Apex rules into 7 category pages and the in-page anchor
 * is the lowercased rule name, so this lets us deep-link to the exact rule.
 * Source: https://docs.pmd-code.org/latest/pmd_rules_apex.html
 */
const PMD_APEX_CATEGORY: Record<string, string> = {
  // ── bestpractices ──
  apexassertionsshouldincludemessage: "bestpractices",
  apexunittestclassshouldhaveasserts: "bestpractices",
  apexunittestclassshouldhaverunas: "bestpractices",
  apexunittestshouldnotuseseealldatatrue: "bestpractices",
  avoidglobalmodifier: "bestpractices",
  avoidlogicintrigger: "bestpractices",
  debugsshoulduselogginglevel: "bestpractices",
  queueablewithoutfinalizer: "bestpractices",
  unusedlocalvariable: "bestpractices",
  // ── codestyle ──
  annotationsnamingconventions: "codestyle",
  classnamingconventions: "codestyle",
  fielddeclarationsshouldbeatstart: "codestyle",
  fieldnamingconventions: "codestyle",
  forloopsmustusebraces: "codestyle",
  formalparameternamingconventions: "codestyle",
  ifelsestmtsmustusebraces: "codestyle",
  ifstmtsmustusebraces: "codestyle",
  localvariablenamingconventions: "codestyle",
  methodnamingconventions: "codestyle",
  onedeclarationperline: "codestyle",
  propertynamingconventions: "codestyle",
  whileloopsmustusebraces: "codestyle",
  // ── design ──
  avoiddeeplynestedifstmts: "design",
  cognitivecomplexity: "design",
  cyclomaticcomplexity: "design",
  excessiveclasslength: "design",
  excessiveparameterlist: "design",
  excessivepubliccount: "design",
  ncssconstructorcount: "design",
  ncssmethodcount: "design",
  ncsstypecount: "design",
  stdcyclomaticcomplexity: "design",
  toomanyfields: "design",
  unusedmethod: "design",
  // ── documentation ──
  apexdoc: "documentation",
  // ── errorprone ──
  apexcsrf: "errorprone",
  avoiddirectaccesstriggermap: "errorprone",
  avoidhardcodingid: "errorprone",
  avoidnonexistentannotations: "errorprone",
  emptycatchblock: "errorprone",
  emptyifstmt: "errorprone",
  emptystatementblock: "errorprone",
  emptytryorfinallyblock: "errorprone",
  emptywhilestmt: "errorprone",
  inaccessibleauraenabledgetter: "errorprone",
  methodwithsamenameasenclosingclass: "errorprone",
  overridebothequalsandhashcode: "errorprone",
  testmethodsmustbeintestclasses: "errorprone",
  typeshadowsbuiltinnamespace: "errorprone",
  // ── performance ──
  avoiddmlstatementsinloops: "performance",
  avoidsoqlinloops: "performance",
  avoidsoslinloops: "performance",
  eagerlyloadeddescribesobjectresult: "performance",
  operationwithlimitsinloop: "performance",
  // ── security ──
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
};

/** PMD Visualforce rules (security only at present). */
const PMD_VF_CATEGORY: Record<string, string> = {
  vfcsrf: "security",
  vfhtmlstyletagxss: "security",
  vfunescapeel: "security",
};

/** Custom rules emitted by the lightweight fallback scanner. */
const FALLBACK_RULE_DOCS: Record<string, string> = {
  noeval: "https://eslint.org/docs/latest/rules/no-eval",
  noinnerhtml:
    "https://developer.salesforce.com/docs/platform/lwc/guide/security-lwsec-intro.html",
  todocomment: `${PMD_DOCS_BASE}/pmd_rules_apex_errorprone.html`,
};

function isEslintRule(ruleName: string): boolean {
  // ESLint rules are lowercase, dash-separated (e.g. no-undef, no-unused-vars)
  // and may be namespaced (e.g. @lwc/lwc/no-async-operation).
  return (
    /^[a-z@][a-z0-9@/-]*-[a-z0-9/-]+$/.test(ruleName) &&
    ruleName === ruleName.toLowerCase()
  );
}

/**
 * Resolves a best-effort, rule-specific documentation URL for a finding.
 * Returns undefined only when no sensible link can be derived.
 */
export function ruleDocUrl(
  finding: Pick<AnalyzerFinding, "ruleName" | "metadataType"> & {
    engine?: string;
  },
): string | undefined {
  const raw = finding.ruleName?.trim();
  if (!raw || raw === "UnknownRule") return undefined;
  const key = raw.toLowerCase();

  if (FALLBACK_RULE_DOCS[key]) return FALLBACK_RULE_DOCS[key];

  // ESLint / LWC ESLint rules (JavaScript, LWC)
  if (isEslintRule(raw)) {
    if (raw.startsWith("@lwc/lwc/")) {
      const short = raw.replace("@lwc/lwc/", "");
      return `https://github.com/salesforce/eslint-plugin-lwc/blob/master/docs/rules/${short}.md`;
    }
    // Other Salesforce/scoped plugin rules → the Code Analyzer ESLint engine docs.
    if (raw.startsWith("@")) {
      return ENGINE_DOCS.eslint;
    }
    return `https://eslint.org/docs/latest/rules/${raw}`;
  }

  // PMD Apex rules (deep link to specific rule anchor)
  const apexCategory = PMD_APEX_CATEGORY[key];
  if (apexCategory) {
    return `${PMD_DOCS_BASE}/pmd_rules_apex_${apexCategory}.html#${key}`;
  }

  // PMD Visualforce rules
  const vfCategory = PMD_VF_CATEGORY[key];
  if (vfCategory) {
    return `${PMD_DOCS_BASE}/pmd_rules_visualforce_${vfCategory}.html#${key}`;
  }

  // Engine-specific fallback (regex, cpd, sfge, flow, ...) so every finding
  // links to the relevant Code Analyzer engine guide rather than nothing.
  if (finding.engine && ENGINE_DOCS[finding.engine]) {
    return ENGINE_DOCS[finding.engine];
  }

  // Unknown Apex-style rule (PascalCase): link to the Apex rule index so the
  // user can still search, rather than returning nothing.
  if (finding.metadataType === "ApexClass" || /^[A-Z][A-Za-z0-9]+$/.test(raw)) {
    return `${PMD_DOCS_BASE}/pmd_rules_apex.html`;
  }

  return undefined;
}
