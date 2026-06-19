import { ruleDocUrl } from "../report/ruleDocs.js";
import {
  AvailableRule,
  EngineInfo,
  EngineStatus,
  MetadataType,
  RuleCatalogResult,
  Severity,
} from "../types/models.js";
import { javaAwareEnv, resolveJavaHome } from "../utils/javaHome.js";
import { runCommand } from "../utils/process.js";

interface RawRule {
  engine?: string;
  name?: string;
  categories?: string[];
  languages?: string[];
  isPilot?: boolean;
  defaultEnabled?: boolean;
}

interface EngineMeta {
  id: string;
  name: string;
  description: string;
  languages: string[];
  requiresJava: boolean;
}

const SCANNER_INSTALL_HINT =
  "Install Salesforce Code Analyzer: sf plugins install @salesforce/sfdx-scanner";
const JAVA_INSTALL_HINT =
  "Requires a JDK 11+. Install one (macOS: 'brew install openjdk@17', or see https://adoptium.net) — OrgLens auto-detects it; no PATH setup needed.";

const ENGINE_REGISTRY: EngineMeta[] = [
  {
    id: "pmd",
    name: "PMD",
    description:
      "Apex & Visualforce static analysis (best practices, security, design).",
    languages: ["apex", "visualforce"],
    requiresJava: true,
  },
  {
    id: "eslint",
    name: "ESLint",
    description: "Lightning (LWC/Aura) JavaScript linting.",
    languages: ["javascript"],
    requiresJava: false,
  },
  {
    id: "eslint-lwc",
    name: "ESLint LWC",
    description: "Salesforce LWC-specific ESLint rules.",
    languages: ["javascript"],
    requiresJava: false,
  },
  {
    id: "eslint-typescript",
    name: "ESLint (TypeScript)",
    description: "TypeScript linting for custom tooling.",
    languages: ["typescript"],
    requiresJava: false,
  },
  {
    id: "retire-js",
    name: "RetireJS",
    description: "Detects JavaScript libraries with known vulnerabilities.",
    languages: ["javascript"],
    requiresJava: false,
  },
  {
    id: "sfge",
    name: "Salesforce Graph Engine",
    description: "Data-flow (DFA) security analysis for Apex.",
    languages: ["apex"],
    requiresJava: true,
  },
  {
    id: "orglens-lite",
    name: "OrgLens Lightweight",
    description:
      "Built-in regex checks for Apex/LWC — always available, no Java required.",
    languages: ["apex", "javascript"],
    requiresJava: false,
  },
];

const LITE_RULES: AvailableRule[] = [
  {
    ruleName: "LocalVariableNamingConventions",
    engine: "orglens-lite",
    category: "Code Style",
    categories: ["Code Style"],
    languages: ["apex"],
    defaultSeverity: "medium",
    defaultEnabled: true,
    isPilot: false,
  },
  {
    ruleName: "TodoComment",
    engine: "orglens-lite",
    category: "maintainability",
    categories: ["maintainability"],
    languages: ["apex"],
    defaultSeverity: "low",
    defaultEnabled: true,
    isPilot: false,
  },
  {
    ruleName: "NoEval",
    engine: "orglens-lite",
    category: "security",
    categories: ["security"],
    languages: ["javascript"],
    defaultSeverity: "high",
    defaultEnabled: true,
    isPilot: false,
  },
  {
    ruleName: "NoInnerHTML",
    engine: "orglens-lite",
    category: "security",
    categories: ["security"],
    languages: ["javascript"],
    defaultSeverity: "high",
    defaultEnabled: true,
    isPilot: false,
  },
];

function severityFromCategories(categories: string[]): Severity {
  const set = categories.map((c) => c.toLowerCase());
  if (set.some((c) => c.includes("security"))) return "high";
  if (set.some((c) => c.includes("error prone") || c.includes("errorprone")))
    return "high";
  if (set.some((c) => c.includes("performance"))) return "medium";
  if (set.some((c) => c.includes("design") || c.includes("best practice")))
    return "medium";
  if (set.some((c) => c.includes("style") || c.includes("documentation")))
    return "low";
  return "medium";
}

function engineToMetadataType(
  engine: string,
  languages: string[],
): MetadataType {
  if (engine.startsWith("eslint") || engine === "retire-js")
    return "LightningComponentBundle";
  if (languages.includes("visualforce")) return "Unknown";
  return "ApexClass";
}

interface RuleListResult {
  rules: RawRule[];
  kind: "ok" | "needs_java" | "not_installed";
}

function runRuleList(engines?: string[]): RuleListResult {
  const env = javaAwareEnv();
  const args = ["scanner", "rule", "list", "--json"];
  if (engines && engines.length > 0) {
    args.push("--engine", engines.join(","));
  }
  const result = runCommand("sf", args, process.cwd(), env);
  const combined = `${result.stderr}\n${result.stdout}`;

  if (!result.ok) {
    if (
      /Unable to locate a Java Runtime|Could not fetch Java version/i.test(
        combined,
      )
    ) {
      return { rules: [], kind: "needs_java" };
    }
    if (
      /is not a [\w.]*\s*command|command not found|Cannot find module|No plugin found/i.test(
        combined,
      )
    ) {
      return { rules: [], kind: "not_installed" };
    }
    return { rules: [], kind: "not_installed" };
  }

  try {
    const parsed = JSON.parse(result.stdout) as unknown;
    const rules = (
      Array.isArray(parsed)
        ? parsed
        : ((parsed as { result?: RawRule[] }).result ?? [])
    ) as RawRule[];
    return { rules, kind: "ok" };
  } catch {
    return { rules: [], kind: "not_installed" };
  }
}

function toAvailableRule(raw: RawRule): AvailableRule | undefined {
  if (!raw.name || !raw.engine) return undefined;
  const categories = raw.categories ?? [];
  const languages = raw.languages ?? [];
  return {
    ruleName: raw.name,
    engine: raw.engine,
    category: categories[0] ?? "Uncategorized",
    categories,
    languages,
    defaultSeverity: severityFromCategories(categories),
    defaultEnabled: raw.defaultEnabled !== false,
    isPilot: raw.isPilot === true,
    url: ruleDocUrl({
      ruleName: raw.name,
      metadataType: engineToMetadataType(raw.engine, languages),
    }),
  };
}

/**
 * Lists every rule available across the installed scan engines, plus the
 * built-in lightweight engine. Reports engine availability and install
 * directions for engines that are missing or need Java.
 */
export function listAvailableRules(): RuleCatalogResult {
  let { rules: raw, kind } = runRuleList();

  // If the full listing failed because Java is missing, we can still enumerate
  // the JavaScript engines that don't need a JVM.
  if (kind === "needs_java") {
    const jsOnly = runRuleList([
      "eslint",
      "eslint-lwc",
      "eslint-typescript",
      "retire-js",
    ]);
    if (jsOnly.kind === "ok") raw = jsOnly.rules;
  }

  const scannerRules = raw
    .map(toAvailableRule)
    .filter((r): r is AvailableRule => Boolean(r));

  const rules = [...scannerRules, ...LITE_RULES].sort(
    (a, b) =>
      a.engine.localeCompare(b.engine) || a.ruleName.localeCompare(b.ruleName),
  );

  const countByEngine = new Map<string, number>();
  for (const r of rules)
    countByEngine.set(r.engine, (countByEngine.get(r.engine) ?? 0) + 1);

  const javaOk = kind === "ok";
  const javaHome = resolveJavaHome();

  const engines: EngineInfo[] = ENGINE_REGISTRY.map((meta) => {
    if (meta.id === "orglens-lite") {
      return {
        ...meta,
        status: "available" as EngineStatus,
        available: true,
        ruleCount: countByEngine.get(meta.id) ?? LITE_RULES.length,
      };
    }

    const ruleCount = countByEngine.get(meta.id) ?? 0;
    let status: EngineStatus;
    let installHint: string | undefined;

    if (kind === "not_installed") {
      status = "not_installed";
      installHint = SCANNER_INSTALL_HINT;
    } else if (meta.requiresJava && !javaOk) {
      status = "needs_java";
      installHint = JAVA_INSTALL_HINT;
    } else {
      status = "available";
    }

    return {
      ...meta,
      status,
      available: status === "available",
      ruleCount,
      installHint,
    };
  }).filter(
    (e) =>
      e.ruleCount > 0 || e.status !== "available" || e.id === "orglens-lite",
  );

  const scannerStatus = kind;
  const message =
    kind === "not_installed"
      ? `Salesforce Code Analyzer not detected. ${SCANNER_INSTALL_HINT}`
      : kind === "needs_java"
        ? "Java not found — PMD/Graph Engine rules are unavailable. " +
          JAVA_INSTALL_HINT
        : `Loaded ${scannerRules.length} scanner rules${javaHome ? ` (Java: ${javaHome})` : ""}.`;

  return { engines, rules, javaHome, scannerStatus, message };
}
