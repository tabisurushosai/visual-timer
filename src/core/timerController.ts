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
}

export interface TimerController {
  getView(): TimerViewModel;
  setDurationFromInputValues(input: TimerInputValues): TimerViewModel;
  resetFromInputValues(input: TimerInputValues): TimerViewModel;
}

function parseInputNumber(value: string): number {
  return Number.parseInt(value, 10) || 0;
}

function toViewModel(state: TimerState): TimerViewModel {
  return {
    totalSeconds: state.totalSeconds,
    remainingSeconds: state.remainingSeconds,
    remainingLabel: formatDuration(state.remainingSeconds),
    remainingRatio: getRemainingRatio(state),
    durationMinutes: Math.floor(state.totalSeconds / 60),
    durationSeconds: state.totalSeconds % 60,
  };
}

export function createTimerController(initialTotalSeconds = DEFAULT_TIMER_SECONDS): TimerController {
  let state = createTimerState(initialTotalSeconds);

  function setDurationFromInputValues(input: TimerInputValues): TimerViewModel {
    state = createTimerStateFromParts(parseInputNumber(input.minutes), parseInputNumber(input.seconds));
    return toViewModel(state);
  }

  return {
    getView() {
      return toViewModel(state);
    },
    setDurationFromInputValues,
    resetFromInputValues(input: TimerInputValues) {
      return setDurationFromInputValues(input);
    },
  };
}
