import { describe, expect, it } from "vitest";
import { defaultConfig } from "../config/schema.js";
import {
  applyRuleOverrides,
  buildRuleCatalog,
  resolveRuleOverrides,
} from "../rules/ruleOverrides.js";
import { AnalyzerFinding } from "../types/models.js";

function finding(
  over: Partial<AnalyzerFinding> & { id: string },
): AnalyzerFinding {
  return {
    ruleName: "RuleA",
    message: "x",
    severity: "high",
    category: "security",
    filePath: "force-app/main/default/classes/Foo.cls",
    metadataType: "ApexClass",
    references: [],
    ...over,
  };
}

describe("ruleOverrides", () => {
  it("merges config and option overrides, options win", () => {
    const config = {
      ...defaultConfig,
      ruleOverrides: {
        disabled: ["RuleX"],
        severity: { RuleA: "low" as const },
      },
    };
    const resolved = resolveRuleOverrides(config, {
      disabledRules: ["RuleY"],
      severityOverrides: { RuleA: "critical" },
    });
    expect(resolved.disabled.has("RuleX")).toBe(true);
    expect(resolved.disabled.has("RuleY")).toBe(true);
    expect(resolved.severity.get("RuleA")).toBe("critical");
  });

  it("ignores invalid severity values", () => {
    const resolved = resolveRuleOverrides(defaultConfig, {
      severityOverrides: { RuleA: "bogus" },
    });
    expect(resolved.severity.has("RuleA")).toBe(false);
  });

  it("drops disabled rules and remaps severities", () => {
    const findings = [
      finding({ id: "1", ruleName: "RuleA", severity: "high" }),
      finding({ id: "2", ruleName: "RuleB", severity: "medium" }),
    ];
    const out = applyRuleOverrides(findings, {
      disabled: new Set(["RuleB"]),
      severity: new Map([["RuleA", "critical"]]),
    });
    expect(out).toHaveLength(1);
    expect(out[0].ruleName).toBe("RuleA");
    expect(out[0].severity).toBe("critical");
  });

  it("builds a catalog sorted by count with the most severe default", () => {
    const findings = [
      finding({ id: "1", ruleName: "RuleA", severity: "medium" }),
      finding({ id: "2", ruleName: "RuleA", severity: "critical" }),
      finding({ id: "3", ruleName: "RuleB", severity: "low" }),
    ];
    const catalog = buildRuleCatalog(findings);
    expect(catalog[0].ruleName).toBe("RuleA");
    expect(catalog[0].count).toBe(2);
    expect(catalog[0].defaultSeverity).toBe("critical");
    expect(catalog[1].ruleName).toBe("RuleB");
  });
});
