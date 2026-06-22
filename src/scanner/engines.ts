/** Engine ids handled by the Salesforce Code Analyzer (`sf code-analyzer`, v5). */
export const SF_ENGINE_IDS = [
  "pmd",
  "eslint",
  "retire-js",
  "regex",
  "cpd",
  "sfge",
  "flow",
] as const;

/** Built-in regex fallback engine id. */
export const LITE_ENGINE_ID = "orglens-lite";

const SF_ENGINE_SET = new Set<string>(SF_ENGINE_IDS);

export function isSfEngine(id: string): boolean {
  return SF_ENGINE_SET.has(id);
}
