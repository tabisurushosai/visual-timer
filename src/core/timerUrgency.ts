import type { TimerStatus } from "./timerController";

export type TimerUrgency = "safe" | "warning" | "urgent" | "finished";

export function getTimerUrgency(remainingRatio: number, status: TimerStatus): TimerUrgency {
  if (status === "finished" || remainingRatio <= 0) {
    return "finished";
  }

  if (!Number.isFinite(remainingRatio)) {
    return "safe";
  }

  if (remainingRatio <= 0.25) {
    return "urgent";
  }

  if (remainingRatio <= 0.5) {
    return "warning";
  }

  return "safe";
}
