import { describe, expect, it } from "vitest";
import { defaultConfig } from "../config/schema.js";
import { computeGrade } from "../scoring/grade.js";
import { computeScore } from "../scoring/scoreModel.js";
import { computeWhatIf } from "../analysis/whatIf.js";
import { buildRoadmap } from "../analysis/roadmap.js";
import { assignOwner, buildOwnership } from "../analysis/ownership.js";
import { rankDebts } from "../ranking/priorityRanker.js";
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

describe("grade", () => {
  it("maps scores to letters", () => {
    expect(computeGrade(95).letter).toBe("A");
    expect(computeGrade(82).letter).toBe("B");
    expect(computeGrade(71).letter).toBe("C");
    expect(computeGrade(61).letter).toBe("D");
    expect(computeGrade(40).letter).toBe("F");
  });
});

describe("what-if simulator", () => {
  it("returns opportunities with positive score lift", () => {
    const findings = [
      finding({ id: "f1", ruleName: "RuleA", severity: "critical" }),
      finding({ id: "f2", ruleName: "RuleA", severity: "critical" }),
      finding({
        id: "f3",
        ruleName: "RuleB",
        severity: "high",
        category: "performance",
      }),
    ];
    const score = computeScore(findings, defaultConfig, 50).overall;
    const debts = rankDebts(findings, new Map(), defaultConfig);
    const opps = computeWhatIf(findings, debts, score, 50, defaultConfig);
    expect(opps.length).toBeGreaterThan(0);
    expect(opps.every((o) => o.scoreLift > 0)).toBe(true);
    expect(opps[0].projectedScore).toBeGreaterThanOrEqual(score);
  });
});

describe("roadmap", () => {
  it("packs debt into sprints within capacity", () => {
    const findings = Array.from({ length: 6 }, (_, i) =>
      finding({ id: `f${i}`, severity: "high" }),
    );
    const debts = rankDebts(findings, new Map(), defaultConfig);
    const sprints = buildRoadmap(debts, findings, 50, defaultConfig);
    expect(sprints.length).toBeGreaterThan(0);
    for (const s of sprints) {
      expect(s.itemCount).toBe(s.findingIds.length);
      expect(s.effortPoints).toBeLessThanOrEqual(
        defaultConfig.roadmap.sprintCapacityPoints + 8,
      );
    }
  });
});

describe("ownership", () => {
  it("assigns owner from glob rules", () => {
    const config = {
      ...defaultConfig,
      ownership: {
        defaultOwner: "Unassigned",
        rules: [{ pattern: "**/classes/**", owner: "Platform Core" }],
      },
    };
    const owner = assignOwner(finding({ id: "f1" }), config);
    expect(owner).toBe("Platform Core");
    const unmatched = assignOwner(
      finding({ id: "f2", filePath: "force-app/main/default/lwc/x/x.js" }),
      config,
    );
    expect(unmatched).toBe("Unassigned");
  });

  it("aggregates findings by owner", () => {
    const findings = [
      finding({ id: "f1", severity: "critical" }),
      finding({ id: "f2", severity: "high" }),
    ];
    const debts = rankDebts(findings, new Map(), defaultConfig);
    const buckets = buildOwnership(findings, debts, defaultConfig);
    expect(buckets.length).toBe(1);
    expect(buckets[0].findingCount).toBe(2);
    expect(buckets[0].critical).toBe(1);
  });
});
