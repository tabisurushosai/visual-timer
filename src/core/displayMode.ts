export type TimerDisplayMode = "standard" | "large";

export function toggleTimerDisplayMode(mode: TimerDisplayMode): TimerDisplayMode {
  return mode === "large" ? "standard" : "large";
}
