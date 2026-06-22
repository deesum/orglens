import fs from "node:fs";
import os from "node:os";
import path from "node:path";
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
import { adapterEngineInfos, adapterRules } from "./adapters/registry.js";

// Salesforce Code Analyzer v5 (`sf code-analyzer rules`) JSON output shape.
interface V5Rule {
  name?: string;
  description?: string;
  engine?: string;
  severity?: number;
  tags?: string[];
  resources?: string[];
}

interface EngineMeta {
  id: string;
  name: string;
  description: string;
  languages: string[];
  requiresJava: boolean;
}

const SCANNER_INSTALL_HINT =
  "Install Salesforce Code Analyzer v5: sf plugins install code-analyzer";
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
    description: "Lightning (LWC/Aura) JavaScript & TypeScript linting.",
    languages: ["javascript", "typescript"],
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
    id: "regex",
    name: "Regex",
    description:
      "Built-in pattern checks (trailing whitespace, TODOs, naming, etc.).",
    languages: ["apex", "javascript"],
    requiresJava: false,
  },
  {
    id: "cpd",
    name: "Copy/Paste Detector",
    description: "Finds duplicated code blocks across the codebase.",
    languages: ["apex", "javascript", "visualforce"],
    requiresJava: true,
  },
  {
    id: "sfge",
    name: "Salesforce Graph Engine",
    description: "Data-flow (DFA) security analysis for Apex.",
    languages: ["apex"],
    requiresJava: true,
  },
  {
    id: "flow",
    name: "Flow",
    description: "Static analysis for Salesforce Flows.",
    languages: ["flow"],
    requiresJava: false,
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

/** v5 severity is 1 (highest) .. 5 (info). */
function mapSeverity(value: number | undefined): Severity {
  switch (value) {
    case 1:
      return "critical";
    case 2:
      return "high";
    case 3:
      return "medium";
    default:
      return "low";
  }
}

function categoryFromTags(tags: string[]): string {
  const set = tags.map((t) => t.toLowerCase());
  if (set.some((t) => t.includes("security"))) return "Security";
  if (set.some((t) => t.includes("performance"))) return "Performance";
  if (set.some((t) => t.includes("errorprone") || t.includes("correctness")))
    return "Error Prone";
  if (set.some((t) => t.includes("design"))) return "Design";
  if (set.some((t) => t.includes("bestpractices"))) return "Best Practices";
  if (set.some((t) => t.includes("documentation"))) return "Documentation";
  if (set.some((t) => t.includes("codestyle"))) return "Code Style";
  return "Best Practices";
}

function engineToMetadataType(
  engine: string,
  tags: string[],
): MetadataType {
  if (engine === "eslint" || engine === "retire-js")
    return "LightningComponentBundle";
  if (engine === "flow") return "Flow";
  if (tags.some((t) => t.toLowerCase().includes("javascript")))
    return "LightningComponentBundle";
  return "ApexClass";
}

interface RuleListResult {
  rules: V5Rule[];
  kind: "ok" | "needs_java" | "not_installed";
}

function runRuleList(): RuleListResult {
  const env = javaAwareEnv();
  const outFile = path.join(
    os.tmpdir(),
    `orglens-rules-${process.pid}-${Date.now()}.json`,
  );
  const result = runCommand(
    "sf",
    ["code-analyzer", "rules", "--rule-selector", "all", "--output-file", outFile],
    process.cwd(),
    env,
  );
  const combined = `${result.stderr}\n${result.stdout}`;

  if (!fs.existsSync(outFile)) {
    if (
      /Unable to locate a Java Runtime|Could not fetch Java version/i.test(
        combined,
      )
    ) {
      return { rules: [], kind: "needs_java" };
    }
    return { rules: [], kind: "not_installed" };
  }

  try {
    const parsed = JSON.parse(fs.readFileSync(outFile, "utf8")) as {
      rules?: V5Rule[];
    };
    return { rules: parsed.rules ?? [], kind: "ok" };
  } catch {
    return { rules: [], kind: "not_installed" };
  } finally {
    try {
      fs.unlinkSync(outFile);
    } catch {
      /* best effort cleanup */
    }
  }
}

function toAvailableRule(raw: V5Rule): AvailableRule | undefined {
  if (!raw.name || !raw.engine) return undefined;
  const tags = raw.tags ?? [];
  const category = categoryFromTags(tags);
  const docUrl =
    (raw.resources ?? []).find((r) => /^https?:\/\//.test(r)) ??
    ruleDocUrl({
      ruleName: raw.name,
      metadataType: engineToMetadataType(raw.engine, tags),
      engine: raw.engine,
    });
  return {
    ruleName: raw.name,
    engine: raw.engine,
    category,
    categories: tags,
    languages: tags.filter((t) =>
      ["apex", "javascript", "typescript", "visualforce", "flow"].includes(
        t.toLowerCase(),
      ),
    ),
    defaultSeverity: mapSeverity(raw.severity),
    defaultEnabled: tags.includes("Recommended"),
    isPilot: false,
    url: docUrl,
  };
}

/**
 * Lists every rule available across the installed scan engines (Salesforce
 * Code Analyzer v5 + pluggable adapters), plus the built-in lightweight engine.
 * Reports engine availability and install directions for missing engines.
 */
export function listAvailableRules(): RuleCatalogResult {
  const { rules: raw, kind } = runRuleList();

  const scannerRules = raw
    .map(toAvailableRule)
    .filter((r): r is AvailableRule => Boolean(r));

  const externalRules = adapterRules();

  const rules = [...scannerRules, ...LITE_RULES, ...externalRules].sort(
    (a, b) =>
      a.engine.localeCompare(b.engine) || a.ruleName.localeCompare(b.ruleName),
  );

  const countByEngine = new Map<string, number>();
  for (const r of scannerRules)
    countByEngine.set(r.engine, (countByEngine.get(r.engine) ?? 0) + 1);

  const javaOk = kind === "ok";
  const javaHome = resolveJavaHome();

  const sfEngines: EngineInfo[] = ENGINE_REGISTRY.map((meta) => {
    if (meta.id === "orglens-lite") {
      return {
        ...meta,
        status: "available" as EngineStatus,
        available: true,
        ruleCount: LITE_RULES.length,
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

  const engines: EngineInfo[] = [...sfEngines, ...adapterEngineInfos()];

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
