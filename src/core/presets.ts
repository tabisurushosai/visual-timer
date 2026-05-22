import { DEFAULT_TIMER_SECONDS, formatDuration, normalizeDurationSeconds } from "./timer";

export interface TimerPreset {
  readonly id: string;
  readonly totalSeconds: number;
  readonly label: string;
}

export const DEFAULT_PRESET_SECONDS = [60, 180, 300, 600] as const;

const MAX_PRESET_COUNT = 8;

function createPresetId(totalSeconds: number): string {
  return `preset-${totalSeconds}`;
}

export function createTimerPreset(totalSeconds: number): TimerPreset {
  const normalizedSeconds = normalizeDurationSeconds(totalSeconds);

  return {
    id: createPresetId(normalizedSeconds),
    totalSeconds: normalizedSeconds,
    label: formatDuration(normalizedSeconds),
  };
}

export function getDefaultTimerPresets(): TimerPreset[] {
  return DEFAULT_PRESET_SECONDS.map(createTimerPreset);
}

export function normalizeTimerPresets(value: unknown): TimerPreset[] {
  const secondsList = Array.isArray(value)
    ? value.map((item) => {
        if (typeof item === "number") {
          return item;
        }

        if (typeof item === "object" && item !== null && "totalSeconds" in item) {
          return Number(item.totalSeconds);
        }

        return DEFAULT_TIMER_SECONDS;
      })
    : DEFAULT_PRESET_SECONDS;

  const uniqueSeconds = Array.from(new Set(secondsList.map(normalizeDurationSeconds)));
  const limitedSeconds = uniqueSeconds.slice(0, MAX_PRESET_COUNT);

  return limitedSeconds.length > 0 ? limitedSeconds.map(createTimerPreset) : getDefaultTimerPresets();
}

export function addTimerPreset(presets: readonly TimerPreset[], totalSeconds: number): TimerPreset[] {
  const nextPreset = createTimerPreset(totalSeconds);
  const withoutDuplicate = presets.filter((preset) => preset.totalSeconds !== nextPreset.totalSeconds);

  return normalizeTimerPresets([nextPreset, ...withoutDuplicate]);
}
