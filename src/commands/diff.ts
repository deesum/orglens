import fs from "node:fs";
import path from "node:path";
import { AnalysisResult, AnalyzerFinding } from "../types/models.js";

export interface DiffOptions {
  baseline: string;
  current: string;
  out?: string;
}

function loadResult(filePath: string): AnalysisResult {
  const resolved = path.resolve(filePath);
  if (!fs.existsSync(resolved))
    throw new Error(`Report not found: ${resolved}`);
  return JSON.parse(fs.readFileSync(resolved, "utf8")) as AnalysisResult;
}

function signature(f: AnalyzerFinding): string {
  return `${f.ruleName}|${f.filePath.replaceAll("\\", "/")}|${f.line ?? 0}|${f.message}`;
}

export function diffCommand(options: DiffOptions): void {
  const baseline = loadResult(options.baseline);
  const current = loadResult(options.current);

  const baseSigs = new Map(baseline.findings.map((f) => [signature(f), f]));
  const currSigs = new Map(current.findings.map((f) => [signature(f), f]));

  const introduced = [...currSigs.entries()]
    .filter(([sig]) => !baseSigs.has(sig))
    .map(([, f]) => f);
  const resolved = [...baseSigs.entries()]
    .filter(([sig]) => !currSigs.has(sig))
    .map(([, f]) => f);

  const scoreDelta = current.score.overall - baseline.score.overall;
  const fmtList = (items: AnalyzerFinding[]): string =>
    items.length
      ? items
          .slice(0, 25)
          .map(
            (f) =>
              `- **${f.ruleName}** (${f.severity}) — \`${path.basename(f.filePath)}\`${f.line ? `:${f.line}` : ""}`,
          )
          .join("\n")
      : "_None_";

  const md = [
    `# OrgLens Diff Report`,
    "",
    `- Baseline score: **${baseline.score.overall}** (grade ${baseline.grade?.letter ?? "?"})`,
    `- Current score: **${current.score.overall}** (grade ${current.grade?.letter ?? "?"})`,
    `- Score delta: **${scoreDelta > 0 ? "+" : ""}${scoreDelta}**`,
    `- Findings: ${baseline.findings.length} → ${current.findings.length}`,
    `- 🔴 Introduced: **${introduced.length}** · 🟢 Resolved: **${resolved.length}**`,
    "",
    `## Newly introduced findings`,
    fmtList(introduced),
    "",
    `## Resolved findings`,
    fmtList(resolved),
  ].join("\n");

  console.log(md);
  if (options.out) {
    const outPath = path.resolve(options.out);
    fs.writeFileSync(outPath, md, "utf8");
    console.log(`\nDiff report written to ${outPath}`);
  }

  if (scoreDelta < 0 || introduced.length > resolved.length) {
    process.exitCode = 1;
  }
}
