import { describe, expect, it } from "vitest";
import { defaultConfig } from "../config/schema.js";
import { evaluateCiGate } from "../modes/ciGate.js";
import { computeScore } from "../scoring/scoreModel.js";
import { AnalyzerFinding } from "../types/models.js";

describe("score model", () => {
  it("decreases score when severe findings increase", () => {
    const findings: AnalyzerFinding[] = [
      {
        id: "f1",
        ruleName: "SecurityRule",
        message: "Potential injection",
        severity: "critical",
        category: "security",
        filePath: "force-app/main/default/classes/Foo.cls",
        metadataType: "ApexClass",
        references: [],
      },
    ];

    const result = computeScore(findings, defaultConfig, 80);
    expect(result.overall).toBeLessThan(100);
    expect(result.breakdown.security).toBeLessThan(100);
  });

  it("fails ci gate when score is below fail threshold", () => {
    const gate = evaluateCiGate(
      {
        overall: 60,
        confidence: 85,
        breakdown: {
          security: 60,
          maintainability: 60,
          reliability: 60,
          performance: 60,
          operability: 60,
        },
      },
      defaultConfig,
    );
    expect(gate.status).toBe("fail");
  });
});
