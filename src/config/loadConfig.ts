import fs from "node:fs";
import path from "node:path";
import yaml from "js-yaml";
import { AgentConfig, configSchema, defaultConfig } from "./schema.js";

function deepMerge<T>(base: T, override: Partial<T>): T {
  const output = { ...base } as Record<string, unknown>;
  for (const [key, value] of Object.entries(override as Record<string, unknown>)) {
    if (
      value &&
      typeof value === "object" &&
      !Array.isArray(value) &&
      output[key] &&
      typeof output[key] === "object" &&
      !Array.isArray(output[key])
    ) {
      output[key] = deepMerge(output[key] as Record<string, unknown>, value as Record<string, unknown>);
    } else if (value !== undefined) {
      output[key] = value;
    }
  }
  return output as T;
}

export function loadConfig(configPath?: string): AgentConfig {
  if (!configPath) {
    return defaultConfig;
  }

  const absolutePath = path.resolve(configPath);
  if (!fs.existsSync(absolutePath)) {
    throw new Error(`Config file not found: ${absolutePath}`);
  }

  const content = fs.readFileSync(absolutePath, "utf8");
  const parsed = (yaml.load(content) ?? {}) as Partial<AgentConfig>;
  const merged = deepMerge(defaultConfig, parsed);
  return configSchema.parse(merged);
}
