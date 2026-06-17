import { AnalysisResult } from "../types/models.js";

export function renderJson(result: AnalysisResult): string {
  return JSON.stringify(result, null, 2);
}
