import {
  DEFAULT_TIMER_SECONDS,
  createTimerState,
  createTimerStateFromParts,
  formatDuration,
  getRemainingRatio,
  type TimerState,
} from "./timer";

export interface TimerInputValues {
  readonly minutes: string;
  readonly seconds: string;
}

export interface TimerViewModel {
  readonly totalSeconds: number;
  readonly remainingSeconds: number;
  readonly remainingLabel: string;
  readonly remainingRatio: number;
  readonly durationMinutes: number;
  readonly durationSeconds: number;
  readonly status: TimerStatus;
  readonly isRunning: boolean;
}

export interface TimerController {
  getView(): TimerViewModel;
  setDurationFromInputValues(input: TimerInputValues): TimerViewModel;
  startFromInputValues(input: TimerInputValues): TimerViewModel;
  pause(): TimerViewModel;
  resetFromInputValues(input: TimerInputValues): TimerViewModel;
  tick(elapsedSeconds?: number): TimerViewModel;
}

export type TimerStatus = "idle" | "running" | "paused" | "finished";

function parseInputNumber(value: string): number {
  return Number.parseInt(value, 10) || 0;
}

function toViewModel(state: TimerState, status: TimerStatus): TimerViewModel {
  return {
    totalSeconds: state.totalSeconds,
    remainingSeconds: state.remainingSeconds,
    remainingLabel: formatDuration(state.remainingSeconds),
    remainingRatio: getRemainingRatio(state),
    durationMinutes: Math.floor(state.totalSeconds / 60),
    durationSeconds: state.totalSeconds % 60,
    status,
    isRunning: status === "running",
  };
}

export function createTimerController(initialTotalSeconds = DEFAULT_TIMER_SECONDS): TimerController {
  let state = createTimerState(initialTotalSeconds);
  let status: TimerStatus = "idle";

  function setDurationFromInputValues(input: TimerInputValues): TimerViewModel {
    state = createTimerStateFromParts(parseInputNumber(input.minutes), parseInputNumber(input.seconds));
    status = "idle";
    return toViewModel(state, status);
  }

  return {
    getView() {
      return toViewModel(state, status);
    },
    setDurationFromInputValues,
    startFromInputValues(input: TimerInputValues) {
      if (status === "idle" || status === "finished") {
        state = createTimerStateFromParts(parseInputNumber(input.minutes), parseInputNumber(input.seconds));
      }

      if (state.remainingSeconds > 0) {
        status = "running";
      }

      return toViewModel(state, status);
    },
    pause() {
      if (status === "running") {
        status = "paused";
      }

      return toViewModel(state, status);
    },
    resetFromInputValues(input: TimerInputValues) {
      return setDurationFromInputValues(input);
    },
    tick(elapsedSeconds = 1) {
      if (status !== "running") {
        return toViewModel(state, status);
      }

      const normalizedElapsedSeconds = Math.max(0, Math.trunc(elapsedSeconds));
      state = {
        ...state,
        remainingSeconds: Math.max(0, state.remainingSeconds - normalizedElapsedSeconds),
      };

      if (state.remainingSeconds === 0) {
        status = "finished";
      }

      return toViewModel(state, status);
    },
  };
}
