export type Severity = "critical" | "high" | "medium" | "low";
export type MetadataType = "ApexClass" | "LightningComponentBundle" | "Flow" | "Unknown";
export type OutputFormat = "json" | "md" | "html";
export type RunMode = "local" | "ci" | "governance";

export interface AnalyzerFinding {
  id: string;
  ruleName: string;
  message: string;
  severity: Severity;
  category: string;
  filePath: string;
  componentName?: string;
  line?: number;
  metadataType: MetadataType;
  references: string[];
}

export interface MetadataNode {
  id: string;
  name: string;
  type: MetadataType;
  path: string;
  references: string[];
}

export interface DependencyGraph {
  nodes: MetadataNode[];
  edges: Array<{ from: string; to: string }>;
}

export interface ScoringBreakdown {
  security: number;
  maintainability: number;
  reliability: number;
  performance: number;
  operability: number;
}

export interface ScoreResult {
  overall: number;
  confidence: number;
  breakdown: ScoringBreakdown;
}

export interface PrioritizedDebt {
  findingId: string;
  priorityScore: number;
  effort: "S" | "M" | "L";
  blastRadius: number;
  fixNowReason: string;
}

export interface Recommendation {
  title: string;
  rationale: string;
  impactedArtifacts: string[];
  evidenceFindingIds: string[];
  effort: "S" | "M" | "L";
  deferredRisk: string;
}

export interface PlaybookGuidance {
  findingId: string;
  domain: "Apex" | "LWC" | "Flow" | "General";
  ruleName: string;
  whyPriority: string;
  fixSteps: string[];
  verificationSteps: string[];
}

export interface TrendDelta {
  previousSnapshotFile?: string;
  previousScore?: number;
  scoreDelta?: number;
  previousFindingCount?: number;
  findingDelta?: number;
  status: "no_baseline" | "improved" | "regressed" | "unchanged";
}

export interface BacklogItem {
  key: string;
  title: string;
  description: string;
  severity: Severity;
  priorityScore: number;
  effort: "S" | "M" | "L";
  ownerTeam: string;
  releaseTrain: string;
  componentPath: string;
  recommendation: string;
  jiraLabels: string[];
}

export interface AnalysisResult {
  score: ScoreResult;
  topDebts: PrioritizedDebt[];
  graph: DependencyGraph;
  findings: AnalyzerFinding[];
  recommendations: Recommendation[];
  playbooks: PlaybookGuidance[];
  trend: TrendDelta;
  backlog: BacklogItem[];
  scannerStatus: "ok" | "failed" | "not_run";
  scannerMessage?: string;
  timestamp: string;
}

export interface AnalyzeOptions {
  repo: string;
  packagePath?: string;
  targetOrg?: string;
  format: OutputFormat;
  out?: string;
  mode: RunMode;
  configPath?: string;
  provider?: "openai" | "anthropic";
  threshold?: number;
  team?: string;
  releaseTrain?: string;
  backlogOut?: string;
  componentTypes?: MetadataType[];
  components?: string[];
}
