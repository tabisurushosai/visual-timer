export interface TimerState {
  readonly totalSeconds: number;
  readonly remainingSeconds: number;
}

export const DEFAULT_TIMER_SECONDS = 3 * 60;

export function createTimerState(totalSeconds = DEFAULT_TIMER_SECONDS): TimerState {
  const normalizedSeconds = normalizeDurationSeconds(totalSeconds);

  return {
    totalSeconds: normalizedSeconds,
    remainingSeconds: normalizedSeconds,
  };
}

export function createTimerStateFromParts(minutes: number, seconds: number): TimerState {
  return createTimerState(minutes * 60 + seconds);
}

export function normalizeDurationSeconds(totalSeconds: number): number {
  if (!Number.isFinite(totalSeconds)) {
    return DEFAULT_TIMER_SECONDS;
  }

  return Math.max(1, Math.min(99 * 60 + 59, Math.trunc(totalSeconds)));
}

export function formatDuration(totalSeconds: number): string {
  const normalizedSeconds = Math.max(0, Math.trunc(totalSeconds));
  const minutes = Math.floor(normalizedSeconds / 60);
  const seconds = normalizedSeconds % 60;

  return `${minutes}:${seconds.toString().padStart(2, "0")}`;
}

export function getRemainingRatio(state: TimerState): number {
  if (state.totalSeconds <= 0) {
    return 0;
  }

  return Math.max(0, Math.min(1, state.remainingSeconds / state.totalSeconds));
}
