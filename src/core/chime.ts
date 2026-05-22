import type { TimerStatus } from "./timerController";

export function normalizeChimeEnabled(value: unknown): boolean {
  return value === true;
}

export function shouldPlayFinishChime(previousStatus: TimerStatus, nextStatus: TimerStatus, isChimeEnabled: boolean): boolean {
  return isChimeEnabled && previousStatus !== "finished" && nextStatus === "finished";
}
