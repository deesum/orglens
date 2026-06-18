import Anthropic from "@anthropic-ai/sdk";
import OpenAI from "openai";
import { AgentConfig } from "../config/schema.js";
import {
  AnalyzerFinding,
  PrioritizedDebt,
  Recommendation,
} from "../types/models.js";
import { buildRecommendationPrompt } from "./recommendationPrompt.js";
import { validateRecommendations } from "./responseValidator.js";

async function callOpenAI(prompt: string, model: string): Promise<string> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return "[]";
  const client = new OpenAI({ apiKey });
  const response = await client.responses.create({
    model,
    input: prompt,
    temperature: 0.1,
  });
  return response.output_text || "[]";
}

async function callAnthropic(prompt: string, model: string): Promise<string> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return "[]";
  const client = new Anthropic({ apiKey });
  const response = await client.messages.create({
    model,
    max_tokens: 1200,
    temperature: 0.1,
    messages: [{ role: "user", content: prompt }],
  });
  const first = response.content[0];
  return first && first.type === "text" ? first.text : "[]";
}

export interface ChatResult {
  ok: boolean;
  text: string;
}

/** Generic single-turn chat completion used by the `ask` command. */
export async function chatComplete(
  prompt: string,
  config: AgentConfig,
  providerOverride?: "openai" | "anthropic",
): Promise<ChatResult> {
  const provider = providerOverride ?? config.llm.provider;
  const hasKey =
    provider === "anthropic"
      ? Boolean(process.env.ANTHROPIC_API_KEY)
      : Boolean(process.env.OPENAI_API_KEY);
  if (!hasKey) {
    return {
      ok: false,
      text: `No API key found for ${provider}. Set ${provider === "anthropic" ? "ANTHROPIC_API_KEY" : "OPENAI_API_KEY"} to enable AI answers.`,
    };
  }
  const text =
    provider === "anthropic"
      ? await callAnthropic(prompt, config.llm.anthropicModel)
      : await callOpenAI(prompt, config.llm.openaiModel);
  return { ok: true, text: text.trim() || "(no answer returned)" };
}

export async function generateRecommendations(
  findings: AnalyzerFinding[],
  topDebts: PrioritizedDebt[],
  config: AgentConfig,
  providerOverride?: "openai" | "anthropic",
): Promise<Recommendation[]> {
  if (!config.llm.enabled) {
    return [];
  }

  const prompt = buildRecommendationPrompt(
    findings,
    topDebts,
    config.llm.maxRecommendations,
  );
  const provider = providerOverride ?? config.llm.provider;
  const rawText =
    provider === "anthropic"
      ? await callAnthropic(prompt, config.llm.anthropicModel)
      : await callOpenAI(prompt, config.llm.openaiModel);

  let parsed: unknown = [];
  try {
    parsed = JSON.parse(rawText);
  } catch {
    parsed = [];
  }
  return validateRecommendations(parsed, new Set(findings.map((f) => f.id)));
}
