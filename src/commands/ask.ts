import fs from "node:fs";
import path from "node:path";
import { loadConfig } from "../config/loadConfig.js";
import { chatComplete } from "../llm/providerClient.js";
import { AnalysisResult } from "../types/models.js";

export interface AskOptions {
  question: string;
  report: string;
  configPath?: string;
  provider?: "openai" | "anthropic";
}

function buildContext(result: AnalysisResult): string {
  const findingsById = new Map(result.findings.map((f) => [f.id, f]));
  const ruleCounts = new Map<string, number>();
  for (const f of result.findings)
    ruleCounts.set(f.ruleName, (ruleCounts.get(f.ruleName) ?? 0) + 1);
  const topRules = [...ruleCounts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 15)
    .map(([rule, count]) => `- ${rule}: ${count}`)
    .join("\n");
  const topDebts = result.topDebts
    .slice(0, 20)
    .map((d) => {
      const f = findingsById.get(d.findingId);
      return `- [${f?.severity ?? "?"}/${d.effort}] ${f?.ruleName ?? d.findingId} in ${f ? path.basename(f.filePath) : "?"} (priority ${d.priorityScore})`;
    })
    .join("\n");

  return [
    `Health score: ${result.score.overall}/100 (grade ${result.grade?.letter ?? "?"}), confidence ${result.score.confidence}%.`,
    `Total findings: ${result.findings.length}. Components: ${result.graph.nodes.length}.`,
    `Score breakdown: ${JSON.stringify(result.score.breakdown)}.`,
    "",
    "Top rules by occurrence:",
    topRules,
    "",
    "Top prioritized debt:",
    topDebts,
  ].join("\n");
}

export async function askCommand(options: AskOptions): Promise<void> {
  const reportPath = path.resolve(options.report);
  if (!fs.existsSync(reportPath)) {
    console.error(
      `Report JSON not found: ${reportPath}. Run 'orglens analyze --format json' first.`,
    );
    process.exitCode = 1;
    return;
  }
  const result = JSON.parse(
    fs.readFileSync(reportPath, "utf8"),
  ) as AnalysisResult;
  const config = loadConfig(options.configPath);

  const prompt = [
    "You are OrgLens, a Salesforce technical-debt advisor. Answer the user's question using ONLY the analysis context below.",
    "Be concise, specific, and evidence-based. If the context does not contain the answer, say so.",
    "",
    "=== ANALYSIS CONTEXT ===",
    buildContext(result),
    "=== END CONTEXT ===",
    "",
    `Question: ${options.question}`,
  ].join("\n");

  const answer = await chatComplete(prompt, config, options.provider);
  console.log(answer.text);
  if (!answer.ok) process.exitCode = 1;
}
