import fs from "node:fs";
import path from "node:path";
import { loadConfig } from "../config/loadConfig.js";
import { buildDependencyGraph } from "../deps/dependencyGraph.js";
import { computeBlastRadius } from "../deps/impactScorer.js";
import { generateRecommendations } from "../llm/providerClient.js";
import { evaluateCiGate } from "../modes/ciGate.js";
import { writeGovernanceSnapshot } from "../modes/governanceSnapshot.js";
import { computeTrendDelta } from "../modes/trendDelta.js";
import { parseApex } from "../parser/apexParser.js";
import { parseFlows } from "../parser/flowParser.js";
import { parseLwc } from "../parser/lwcParser.js";
import { parseMetadataCatalog } from "../parser/metadataCatalogParser.js";
import {
  filterFindingsByPackage,
  filterNodesByPackage,
} from "../parser/packageXmlScope.js";
import { rankDebts } from "../ranking/priorityRanker.js";
import { renderHtml } from "../report/renderHtml.js";
import { renderJson } from "../report/renderJson.js";
import { renderMarkdown } from "../report/renderMarkdown.js";
import { buildBacklogItems, writeBacklogCsv } from "../report/backlogExport.js";
import { buildPlaybook } from "../report/playbook.js";
import { applySuppressions } from "../rules/suppressions.js";
import {
  applyRuleOverrides,
  resolveRuleOverrides,
} from "../rules/ruleOverrides.js";
import { computeConfidence } from "../scoring/confidence.js";
import { computeScore } from "../scoring/scoreModel.js";
import { computeGrade } from "../scoring/grade.js";
import { computeWhatIf } from "../analysis/whatIf.js";
import { buildRoadmap } from "../analysis/roadmap.js";
import { buildOwnership } from "../analysis/ownership.js";
import { buildHistory } from "../modes/history.js";
import { renderSummary } from "../report/summaryReport.js";
import { createJiraIssues } from "../integrations/jira.js";
import { runCodeAnalyzer } from "../scanner/codeAnalyzerRunner.js";
import {
  AnalysisResult,
  AnalyzeOptions,
  OutputFormat,
} from "../types/models.js";
import { detectMetadataRoots } from "../utils/scanRoots.js";

function resolveOutputPath(
  repoPath: string,
  requested?: string,
  format: OutputFormat = "json",
): string {
  if (requested) return path.resolve(requested);
  return path.resolve(
    repoPath,
    `orglens-report.${format === "md" ? "md" : format}`,
  );
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

function filterByComponentSelection(
  nodes: AnalysisResult["graph"]["nodes"],
  findings: AnalysisResult["findings"],
  componentTypes?: AnalyzeOptions["componentTypes"],
  components?: AnalyzeOptions["components"],
): {
  nodes: AnalysisResult["graph"]["nodes"];
  findings: AnalysisResult["findings"];
} {
  const selectedTypes = new Set(componentTypes ?? []);
  const selectedComponents = new Set((components ?? []).filter(Boolean));
  const typeFilterOn = selectedTypes.size > 0;
  const componentFilterOn = selectedComponents.size > 0;

  if (!typeFilterOn && !componentFilterOn) {
    return { nodes, findings };
  }

  const filteredNodes = nodes.filter((node) => {
    const typeMatch = !typeFilterOn || selectedTypes.has(node.type);
    const componentMatch =
      !componentFilterOn || selectedComponents.has(node.name);
    return typeMatch && componentMatch;
  });

  const nodePaths = new Set(filteredNodes.map((n) => n.path));
  const nodeNames = new Set(filteredNodes.map((n) => n.name));
  const filteredFindings = findings.filter((finding) => {
    if (nodePaths.has(finding.filePath)) return true;
    if (finding.componentName && nodeNames.has(finding.componentName))
      return true;
    return false;
  });

  return { nodes: filteredNodes, findings: filteredFindings };
}

export async function analyzeCommand(options: AnalyzeOptions): Promise<void> {
  const repoPath = path.resolve(options.repo);
  const packagePath = options.packagePath
    ? path.resolve(options.packagePath)
    : undefined;
  const config = loadConfig(options.configPath);
  if (options.provider) {
    config.llm.provider = options.provider;
  }

  const scannerRun = runCodeAnalyzer(repoPath, { engines: options.engines });
  const roots = detectMetadataRoots(repoPath);
  const discoveredNodes = roots.flatMap((root) => {
    const core = [...parseApex(root), ...parseLwc(root), ...parseFlows(root)];
    const catalog = parseMetadataCatalog(root);
    return [...core, ...catalog];
  });
  const dedup = new Map(discoveredNodes.map((n) => [`${n.type}:${n.name}`, n]));
  const packageScopedNodes = filterNodesByPackage(
    [...dedup.values()],
    packagePath,
  );
  const packageScopedFindings = filterFindingsByPackage(
    scannerRun.findings,
    packageScopedNodes,
    packagePath,
  );
  const { nodes: parsedNodes, findings: scannerFindings } =
    filterByComponentSelection(
      packageScopedNodes,
      packageScopedFindings,
      options.componentTypes,
      options.components,
    );
  const graph = buildDependencyGraph(parsedNodes);
  const { activeFindings: suppressedFindings } = applySuppressions(
    scannerFindings,
    config,
  );
  const activeFindings = applyRuleOverrides(
    suppressedFindings,
    resolveRuleOverrides(config, {
      disabledRules: options.disabledRules,
      severityOverrides: options.severityOverrides,
    }),
  );
  const confidence = computeConfidence(activeFindings, graph);
  const score = computeScore(activeFindings, config, confidence);

  const nodeBlastRadius = computeBlastRadius(graph);
  const findingBlastRadius = new Map<string, number>();
  for (const finding of activeFindings) {
    const linkedNode = graph.nodes.find((node) =>
      finding.filePath.endsWith(path.basename(node.path)),
    );
    findingBlastRadius.set(
      finding.id,
      linkedNode ? (nodeBlastRadius.get(linkedNode.id) ?? 0) : 0,
    );
  }
  const topDebts = rankDebts(activeFindings, findingBlastRadius, config);

  let recommendations = await generateRecommendations(
    activeFindings,
    topDebts,
    config,
    options.provider,
  );
  if (recommendations.length === 0 && topDebts.length > 0) {
    recommendations = buildFallbackRecommendations({
      topDebts,
      findings: activeFindings,
    });
  }
  const playbooks = buildPlaybook(activeFindings);
  const trend = computeTrendDelta(
    { score, findings: activeFindings },
    config,
    repoPath,
  );
  const timestamp = new Date().toISOString();
  const grade = computeGrade(score.overall);
  const whatIf = computeWhatIf(
    activeFindings,
    topDebts,
    score.overall,
    confidence,
    config,
  );
  const roadmap = buildRoadmap(topDebts, activeFindings, confidence, config);
  const ownership = buildOwnership(activeFindings, topDebts, config);
  const history = buildHistory(
    { score, findings: activeFindings, timestamp },
    config,
    repoPath,
  );
  const backlog = buildBacklogItems(
    { topDebts, findings: activeFindings, recommendations },
    options.team ?? "Architecture",
    options.releaseTrain ?? "R1",
    config,
  );
  const result: AnalysisResult = {
    score,
    grade,
    topDebts,
    graph,
    findings: activeFindings,
    recommendations,
    playbooks,
    trend,
    history,
    whatIf,
    roadmap,
    ownership,
    backlog,
    scannerStatus: scannerRun.status,
    scannerMessage: scannerRun.message,
    timestamp,
  };

  const output = toFormat(result, options.format);
  const outputPath = resolveOutputPath(repoPath, options.out, options.format);
  fs.writeFileSync(outputPath, output, "utf8");
  console.log(`Report written to ${outputPath}`);

  // Default the backlog next to the report so a read-only scanned repo never
  // blocks the export (the report dir is always chosen to be writable).
  const backlogOutputPath =
    options.backlogOut ??
    path.resolve(path.dirname(outputPath), "orglens-backlog.csv");
  try {
    writeBacklogCsv(backlog, backlogOutputPath);
    console.log(`Backlog export written to ${backlogOutputPath}`);
  } catch (error) {
    console.warn(
      `Skipped backlog export (${backlogOutputPath}): ${error instanceof Error ? error.message : error}`,
    );
  }

  if (options.summaryOut) {
    try {
      const summaryPath = path.resolve(options.summaryOut);
      fs.writeFileSync(summaryPath, renderSummary(result), "utf8");
      console.log(`Summary written to ${summaryPath}`);
    } catch (error) {
      console.warn(
        `Skipped summary export: ${error instanceof Error ? error.message : error}`,
      );
    }
  }

  if (options.createJira) {
    const jira = await createJiraIssues(backlog, {
      execute: Boolean(options.jiraExecute),
    });
    console.log(jira.dryRun ? "Jira (dry run):" : "Jira:");
    for (const message of jira.messages) console.log(`  ${message}`);
  }

  if (options.mode === "governance") {
    try {
      const snapshotPath = writeGovernanceSnapshot(result, config, repoPath);
      console.log(`Governance snapshot written to ${snapshotPath}`);
    } catch (error) {
      console.warn(
        `Skipped governance snapshot: ${error instanceof Error ? error.message : error}`,
      );
    }
  }

  if (options.mode === "ci") {
    const gate = evaluateCiGate(score, config, options.threshold);
    console.log(gate.message);
    process.exitCode = gate.exitCode;
  }
}
