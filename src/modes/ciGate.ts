import { AgentConfig } from "../config/schema.js";
import { ScoreResult } from "../types/models.js";

export interface CiGateResult {
  status: "pass" | "warn" | "fail";
  message: string;
  exitCode: number;
}

export function evaluateCiGate(
  score: ScoreResult,
  config: AgentConfig,
  thresholdOverride?: number,
): CiGateResult {
  const failBelow = thresholdOverride ?? config.scoring.ciGate.failBelow;
  const warnBelow = config.scoring.ciGate.warnBelow;

  if (score.overall < failBelow) {
    return {
      status: "fail",
      message: `Health score ${score.overall} is below fail threshold ${failBelow}.`,
      exitCode: 2,
    };
  }
  if (score.overall < warnBelow) {
    return {
      status: "warn",
      message: `Health score ${score.overall} is below warn threshold ${warnBelow}.`,
      exitCode: 0,
    };
  }
  return {
    status: "pass",
    message: `Health score ${score.overall} passed CI gate.`,
    exitCode: 0,
  };
}
