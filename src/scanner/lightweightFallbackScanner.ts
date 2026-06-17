import fs from "node:fs";
import path from "node:path";
import { AnalyzerFinding } from "../types/models.js";
import { walkFiles } from "../utils/fileWalker.js";

function finding(
  id: string,
  ruleName: string,
  message: string,
  severity: AnalyzerFinding["severity"],
  category: string,
  filePath: string,
  line?: number,
  metadataType: AnalyzerFinding["metadataType"] = "Unknown",
  componentName?: string,
): AnalyzerFinding {
  return {
    id,
    ruleName,
    message,
    severity,
    category,
    filePath,
    line,
    metadataType,
    componentName,
    references: [],
  };
}

export function runLightweightFallbackScanner(repoPath: string): AnalyzerFinding[] {
  const findings: AnalyzerFinding[] = [];
  let idCounter = 1;

  const apexFiles = walkFiles(repoPath, [".cls"]);
  for (const filePath of apexFiles) {
    const content = fs.readFileSync(filePath, "utf8");
    const lines = content.split(/\r?\n/);
    for (let i = 0; i < lines.length; i += 1) {
      const line = lines[i];
      const namingMatch = line.match(/\bfinal\s+\w+\s+([A-Z0-9_]+)\s*=/);
      if (namingMatch) {
        findings.push(
          finding(
            `fallback-${idCounter++}`,
            "LocalVariableNamingConventions",
            `Constant '${namingMatch[1]}' uses all-caps local variable naming.`,
            "medium",
            "Code Style",
            filePath,
            i + 1,
            "ApexClass",
            path.basename(filePath, ".cls"),
          ),
        );
      }
      if (/\bTODO\b/i.test(line)) {
        findings.push(
          finding(
            `fallback-${idCounter++}`,
            "TodoComment",
            "TODO comment found in source.",
            "low",
            "maintainability",
            filePath,
            i + 1,
            "ApexClass",
            path.basename(filePath, ".cls"),
          ),
        );
      }
    }
  }

  const jsFiles = walkFiles(repoPath, [".js"]);
  for (const filePath of jsFiles) {
    const content = fs.readFileSync(filePath, "utf8");
    const lines = content.split(/\r?\n/);
    for (let i = 0; i < lines.length; i += 1) {
      const line = lines[i];
      if (line.includes("eval(")) {
        findings.push(
          finding(
            `fallback-${idCounter++}`,
            "NoEval",
            "Use of eval() detected.",
            "high",
            "security",
            filePath,
            i + 1,
            filePath.includes(`${path.sep}lwc${path.sep}`) ? "LightningComponentBundle" : "Unknown",
          ),
        );
      }
      if (line.includes("innerHTML")) {
        findings.push(
          finding(
            `fallback-${idCounter++}`,
            "NoInnerHTML",
            "Use of innerHTML detected; prefer template-safe rendering.",
            "high",
            "security",
            filePath,
            i + 1,
            filePath.includes(`${path.sep}lwc${path.sep}`) ? "LightningComponentBundle" : "Unknown",
          ),
        );
      }
    }
  }

  return findings;
}
