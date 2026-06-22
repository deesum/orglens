import { AnalyzerFinding, Severity } from "../../types/models.js";
import { runCommand } from "../../utils/process.js";
import { inferComponentName, inferMetadataType } from "../inferMetadata.js";

/** Returns true when `command` responds to a version probe (i.e. is installed). */
export function toolAvailable(command: string, args: string[]): boolean {
  const result = runCommand(command, args, process.cwd());
  if (result.ok) return true;
  // Some CLIs print version to stderr but still exit non-zero; accept any
  // output that looks like a version string.
  const combined = `${result.stdout}${result.stderr}`;
  return /\d+\.\d+/.test(combined);
}

/** Build a normalized finding from an adapter, inferring metadata from the path. */
export function buildFinding(params: {
  id: string;
  engine: string;
  ruleName: string;
  message: string;
  severity: Severity;
  category: string;
  filePath: string;
  line?: number;
  url?: string;
}): AnalyzerFinding {
  const metadataType = inferMetadataType(params.filePath);
  return {
    id: params.id,
    ruleName: params.ruleName,
    message: params.message.trim(),
    severity: params.severity,
    category: params.category,
    filePath: params.filePath,
    componentName: inferComponentName(params.filePath, metadataType),
    line: params.line,
    metadataType,
    references: [],
    url: params.url,
    engine: params.engine,
  };
}
