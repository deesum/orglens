export type Severity = "critical" | "high" | "medium" | "low";
export type MetadataType =
  | "ApexClass"
  | "ApexTrigger"
  | "LightningComponentBundle"
  | "AuraDefinitionBundle"
  | "Flow"
  | "CustomObject"
  | "CustomField"
  | "PermissionSet"
  | "FlexiPage"
  | "CustomLabel"
  | "StaticResource"
  | "VisualforcePage"
  | "Unknown";
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
  url?: string;
  /** Scan engine that produced this finding (e.g. "pmd", "semgrep", "gitleaks"). */
  engine?: string;
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
  owner: string;
  releaseTrain: string;
  componentPath: string;
  recommendation: string;
  jiraLabels: string[];
}

export interface RuleCatalogEntry {
  ruleName: string;
  category: string;
  defaultSeverity: Severity;
  count: number;
  metadataTypes: string[];
  url?: string;
}

export type EngineStatus = "available" | "needs_java" | "not_installed";

export interface EngineInfo {
  id: string;
  name: string;
  description: string;
  languages: string[];
  requiresJava: boolean;
  status: EngineStatus;
  available: boolean;
  ruleCount: number;
  installHint?: string;
}

export interface AvailableRule {
  ruleName: string;
  engine: string;
  category: string;
  categories: string[];
  languages: string[];
  defaultSeverity: Severity;
  defaultEnabled: boolean;
  isPilot: boolean;
  url?: string;
}

export interface RuleCatalogResult {
  engines: EngineInfo[];
  rules: AvailableRule[];
  javaHome?: string;
  scannerStatus: "ok" | "needs_java" | "not_installed";
  message?: string;
}

export type GradeLetter = "A" | "B" | "C" | "D" | "F";

export interface Grade {
  letter: GradeLetter;
  label: string;
}

export interface WhatIfOpportunity {
  kind: "rule" | "component" | "severity";
  label: string;
  findingsResolved: number;
  effortPoints: number;
  projectedScore: number;
  scoreLift: number;
}

export interface RoadmapSprint {
  name: string;
  findingIds: string[];
  itemCount: number;
  effortPoints: number;
  severity: { critical: number; high: number; medium: number; low: number };
  projectedScoreAfter: number;
}

export interface OwnershipBucket {
  owner: string;
  findingCount: number;
  critical: number;
  high: number;
  effortPoints: number;
  topRules: Array<{ rule: string; count: number }>;
}

export interface HistoryPoint {
  timestamp: string;
  score: number;
  findingCount: number;
}

export interface AnalysisResult {
  score: ScoreResult;
  grade: Grade;
  topDebts: PrioritizedDebt[];
  graph: DependencyGraph;
  findings: AnalyzerFinding[];
  recommendations: Recommendation[];
  playbooks: PlaybookGuidance[];
  trend: TrendDelta;
  history: HistoryPoint[];
  whatIf: WhatIfOpportunity[];
  roadmap: RoadmapSprint[];
  ownership: OwnershipBucket[];
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
  componentTypes?: string[];
  components?: string[];
  summaryOut?: string;
  createJira?: boolean;
  jiraExecute?: boolean;
  disabledRules?: string[];
  severityOverrides?: Record<string, string>;
  engines?: string[];
}
