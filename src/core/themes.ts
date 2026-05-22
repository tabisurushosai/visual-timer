export type TimerThemeId = "sky" | "leaf" | "berry";

export interface TimerTheme {
  readonly id: TimerThemeId;
  readonly labelKey: string;
  readonly accentColor: string;
  readonly trackColor: string;
  readonly finishColor: string;
}

export const DEFAULT_THEME_ID: TimerThemeId = "sky";

export const TIMER_THEMES: readonly TimerTheme[] = [
  {
    id: "sky",
    labelKey: "themeSky",
    accentColor: "#2f80ed",
    trackColor: "#dbe4ea",
    finishColor: "#f2994a",
  },
  {
    id: "leaf",
    labelKey: "themeLeaf",
    accentColor: "#2f855a",
    trackColor: "#d8e8dd",
    finishColor: "#b7791f",
  },
  {
    id: "berry",
    labelKey: "themeBerry",
    accentColor: "#b83280",
    trackColor: "#ead7e4",
    finishColor: "#c05621",
  },
];

export function normalizeThemeId(value: unknown): TimerThemeId {
  return TIMER_THEMES.some((theme) => theme.id === value) ? (value as TimerThemeId) : DEFAULT_THEME_ID;
}

export function getTimerTheme(themeId: TimerThemeId): TimerTheme {
  return TIMER_THEMES.find((theme) => theme.id === themeId) ?? TIMER_THEMES[0];
}
