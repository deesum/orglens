import fs from "node:fs";
import path from "node:path";
import { loadConfig } from "../config/loadConfig.js";
import { buildDependencyGraph } from "../deps/dependencyGraph.js";
import { computeBlastRadius } from "../deps/impactScorer.js";
import { generateRecommendations } from "../llm/providerClient.js";
import { evaluateCiGate } from "../modes/ciGate.js";
import { writeGovernanceSnapshot } from "../modes/governanceSnapshot.js";
import { parseApex } from "../parser/apexParser.js";
import { parseFlows } from "../parser/flowParser.js";
import { parseLwc } from "../parser/lwcParser.js";
import { filterFindingsByPackage, filterNodesByPackage } from "../parser/packageXmlScope.js";
import { rankDebts } from "../ranking/priorityRanker.js";
import { renderHtml } from "../report/renderHtml.js";
import { renderJson } from "../report/renderJson.js";
import { renderMarkdown } from "../report/renderMarkdown.js";
import { applySuppressions } from "../rules/suppressions.js";
import { computeConfidence } from "../scoring/confidence.js";
import { computeScore } from "../scoring/scoreModel.js";
import { runCodeAnalyzer } from "../scanner/codeAnalyzerRunner.js";
import { AnalysisResult, AnalyzeOptions, OutputFormat } from "../types/models.js";

function resolveOutputPath(repoPath: string, requested?: string, format: OutputFormat = "json"): string {
  if (requested) return path.resolve(requested);
  return path.resolve(repoPath, `cre-report.${format === "md" ? "md" : format}`);
}

function toFormat(result: AnalysisResult, format: OutputFormat): string {
  if (format === "html") return renderHtml(result);
  if (format === "md") return renderMarkdown(result);
  return renderJson(result);
}

function buildFallbackRecommendations(result: {
  topDebts: AnalysisResult["topDebts"];
  findings: AnalysisResult["findings"];
}): AnalysisResult["recommendations"] {
  const findingsById = new Map(result.findings.map((f) => [f.id, f]));
  return result.topDebts.slice(0, 5).map((debt) => {
    const finding = findingsById.get(debt.findingId);
    return {
      title: finding ? `Fix ${finding.ruleName}` : `Fix ${debt.findingId}`,
      rationale: finding
        ? `${finding.severity.toUpperCase()} issue in ${finding.category}: ${finding.message}`
        : debt.fixNowReason,
      impactedArtifacts: finding ? [finding.filePath] : [],
      evidenceFindingIds: [debt.findingId],
      effort: debt.effort,
      deferredRisk: finding
        ? `Continued ${finding.category} debt can increase maintenance and reliability risk.`
        : "Deferred debt may degrade quality over time.",
    };
  });
}

export async function analyzeCommand(options: AnalyzeOptions): Promise<void> {
  const repoPath = path.resolve(options.repo);
  const packagePath = options.packagePath ? path.resolve(options.packagePath) : undefined;
  const config = loadConfig(options.configPath);
  if (options.provider) {
    config.llm.provider = options.provider;
  }

  const scannerRun = runCodeAnalyzer(repoPath);
  const parsedNodes = filterNodesByPackage(
    [...parseApex(repoPath), ...parseLwc(repoPath), ...parseFlows(repoPath)],
    packagePath,
  );
  const scannerFindings = filterFindingsByPackage(scannerRun.findings, parsedNodes, packagePath);
  const graph = buildDependencyGraph(parsedNodes);
  const { activeFindings } = applySuppressions(scannerFindings, config);
  const confidence = computeConfidence(activeFindings, graph);
  const score = computeScore(activeFindings, config, confidence);

  const nodeBlastRadius = computeBlastRadius(graph);
  const findingBlastRadius = new Map<string, number>();
  for (const finding of activeFindings) {
    const linkedNode = graph.nodes.find((node) => finding.filePath.endsWith(path.basename(node.path)));
    findingBlastRadius.set(finding.id, linkedNode ? nodeBlastRadius.get(linkedNode.id) ?? 0 : 0);
  }
  const topDebts = rankDebts(activeFindings, findingBlastRadius, config).slice(0, 10);

  let recommendations = await generateRecommendations(activeFindings, topDebts, config, options.provider);
  if (recommendations.length === 0 && topDebts.length > 0) {
    recommendations = buildFallbackRecommendations({ topDebts, findings: activeFindings });
  }
  const result: AnalysisResult = {
    score,
    topDebts,
    graph,
    findings: activeFindings,
    recommendations,
    scannerStatus: scannerRun.status,
    scannerMessage: scannerRun.message,
    timestamp: new Date().toISOString(),
  };

  const output = toFormat(result, options.format);
  const outputPath = resolveOutputPath(repoPath, options.out, options.format);
  fs.writeFileSync(outputPath, output, "utf8");
  console.log(`Report written to ${outputPath}`);

  if (options.mode === "governance") {
    const snapshotPath = writeGovernanceSnapshot(result, config, repoPath);
    console.log(`Governance snapshot written to ${snapshotPath}`);
  }

  if (options.mode === "ci") {
    const gate = evaluateCiGate(score, config, options.threshold);
    console.log(gate.message);
    process.exitCode = gate.exitCode;
  }
}
