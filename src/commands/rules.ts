import { listAvailableRules } from "../scanner/ruleCatalog.js";
import { RuleCatalogResult } from "../types/models.js";

export interface RulesOptions {
  repo?: string;
  packagePath?: string;
  json?: boolean;
}

/** Returns the full catalog of available rules plus engine availability. */
export function collectRuleCatalog(): RuleCatalogResult {
  return listAvailableRules();
}

export function rulesCommand(options: RulesOptions): void {
  const catalog = collectRuleCatalog();

  if (options.json) {
    console.log(JSON.stringify(catalog, null, 2));
    return;
  }

  console.log("Scan engines:");
  for (const e of catalog.engines) {
    const badge =
      e.status === "available"
        ? "[available]"
        : e.status === "needs_java"
          ? "[needs Java]"
          : "[not installed]";
    console.log(
      `  ${badge.padEnd(16)} ${e.name} (${e.id}) — ${e.ruleCount} rules`,
    );
    if (e.installHint) console.log(`        → ${e.installHint}`);
  }

  console.log(`\nAvailable rules: ${catalog.rules.length}\n`);
  console.log(`${"ENGINE".padEnd(18)}${"SEVERITY".padEnd(9)}RULE  [CATEGORY]`);
  for (const r of catalog.rules) {
    console.log(
      `${r.engine.padEnd(18)}${r.defaultSeverity.toUpperCase().padEnd(9)}${r.ruleName}  [${r.category}]${r.isPilot ? " (pilot)" : ""}`,
    );
  }

  if (catalog.message) console.log(`\n${catalog.message}`);
}
