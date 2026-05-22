import { normalizeTimerPresets, type TimerPreset } from "./core/presets";
import { normalizeDurationSeconds } from "./core/timer";

// storage.ts : 保存アダプタ。拡張では chrome.storage.local。将来のPWAは localStorage 等に差し替えるだけ。
// 画面/ロジックは必ずこの store 経由で保存し、chrome.storage を直接散在させない。
export interface Store {
  get<T>(key: string): Promise<T | null>;
  set<T>(key: string, value: T): Promise<void>;
  remove(key: string): Promise<void>;
}

const PRESETS_KEY = "timerPresets";
const LAST_TIMER_DURATION_KEY = "lastTimerDurationSeconds";

export const store: Store = {
  get<T>(key: string) {
    return new Promise<T | null>((resolve) => chrome.storage.local.get(key, (items) => resolve((items[key] as T | undefined) ?? null)));
  },
  set<T>(key: string, value: T) {
    return new Promise<void>((resolve) => chrome.storage.local.set({ [key]: value }, () => resolve()));
  },
  remove(key: string) {
    return new Promise<void>((resolve) => chrome.storage.local.remove(key, () => resolve()));
  },
};

export async function getTimerPresets(): Promise<TimerPreset[]> {
  const presets = await store.get<unknown>(PRESETS_KEY);

  return normalizeTimerPresets(presets);
}

export async function setTimerPresets(presets: readonly TimerPreset[]): Promise<void> {
  await store.set(
    PRESETS_KEY,
    normalizeTimerPresets(presets).map((preset) => ({
      totalSeconds: preset.totalSeconds,
    })),
  );
}

export async function getLastTimerDurationSeconds(): Promise<number | null> {
  const totalSeconds = await store.get<unknown>(LAST_TIMER_DURATION_KEY);

  return typeof totalSeconds === "number" && Number.isFinite(totalSeconds) ? normalizeDurationSeconds(totalSeconds) : null;
}

export async function setLastTimerDurationSeconds(totalSeconds: number): Promise<void> {
  await store.set(LAST_TIMER_DURATION_KEY, normalizeDurationSeconds(totalSeconds));
}
