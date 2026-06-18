import { Grade } from "../types/models.js";

export function computeGrade(score: number): Grade {
  if (score >= 90) return { letter: "A", label: "Excellent" };
  if (score >= 80) return { letter: "B", label: "Good" };
  if (score >= 70) return { letter: "C", label: "Fair" };
  if (score >= 60) return { letter: "D", label: "Poor" };
  return { letter: "F", label: "Critical" };
}
