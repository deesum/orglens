import { z } from "zod";

export const configSchema = z.object({
  scoring: z.object({
    weights: z.object({
      security: z.number().min(0),
      maintainability: z.number().min(0),
      reliability: z.number().min(0),
      performance: z.number().min(0),
      operability: z.number().min(0),
    }),
    severityPoints: z.object({
      critical: z.number().min(0),
      high: z.number().min(0),
      medium: z.number().min(0),
      low: z.number().min(0),
    }),
    ciGate: z.object({
      failBelow: z.number().min(0).max(100),
      warnBelow: z.number().min(0).max(100),
    }),
  }),
  priority: z.object({
    blastRadiusWeight: z.number().min(0),
    severityWeight: z.number().min(0),
    effortWeight: z.number().min(0),
  }),
  suppression: z.object({
    rules: z.array(
      z.object({
        ruleName: z.string().optional(),
        filePathPattern: z.string().optional(),
        rationale: z.string().optional(),
      }),
    ),
  }),
  llm: z.object({
    enabled: z.boolean(),
    provider: z.enum(["openai", "anthropic"]),
    openaiModel: z.string(),
    anthropicModel: z.string(),
    maxRecommendations: z.number().min(1).max(50),
    redactionEnabled: z.boolean(),
  }),
  governance: z.object({
    snapshotDir: z.string().min(1),
  }),
});

export type AgentConfig = z.infer<typeof configSchema>;

export const defaultConfig: AgentConfig = {
  scoring: {
    weights: {
      security: 0.3,
      maintainability: 0.25,
      reliability: 0.2,
      performance: 0.15,
      operability: 0.1,
    },
    severityPoints: {
      critical: 25,
      high: 15,
      medium: 8,
      low: 3,
    },
    ciGate: {
      failBelow: 70,
      warnBelow: 80,
    },
  },
  priority: {
    blastRadiusWeight: 0.5,
    severityWeight: 0.35,
    effortWeight: 0.15,
  },
  suppression: {
    rules: [],
  },
  llm: {
    enabled: true,
    provider: "openai",
    openaiModel: "gpt-4.1-mini",
    anthropicModel: "claude-3-5-sonnet-latest",
    maxRecommendations: 10,
    redactionEnabled: true,
  },
  governance: {
    snapshotDir: ".cre-snapshots",
  },
};
