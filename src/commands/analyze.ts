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

export async function analyzeCommand(options: AnalyzeOptions): Promise<void> {
  const repoPath = path.resolve(options.repo);
  const config = loadConfig(options.configPath);
  if (options.provider) {
    config.llm.provider = options.provider;
  }

  const scannerFindings = runCodeAnalyzer(repoPath);
  const parsedNodes = [...parseApex(repoPath), ...parseLwc(repoPath), ...parseFlows(repoPath)];
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

  const recommendations = await generateRecommendations(activeFindings, topDebts, config, options.provider);
  const result: AnalysisResult = {
    score,
    topDebts,
    graph,
    findings: activeFindings,
    recommendations,
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
