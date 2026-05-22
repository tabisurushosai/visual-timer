import { createTimerController, type TimerViewModel } from "./core/timerController";
import { createRemainingSectorPath } from "./core/timerGeometry";
import { addTimerPreset, type TimerPreset } from "./core/presets";
import {
  getPresetLimit,
  getPremiumStatus,
  startPremiumTrial,
  STRIPE_CHECKOUT_URL,
  type PremiumAccess,
  type PremiumStatus,
} from "./core/premium";
import { getTimerTheme, TIMER_THEMES, type TimerThemeId } from "./core/themes";
import {
  getLastTimerDurationSeconds,
  getPremiumAccess,
  getTimerPresets,
  getTimerThemeId,
  setLastTimerDurationSeconds,
  setPremiumAccess,
  setTimerPresets,
  setTimerThemeId,
} from "./storage";

const app = document.querySelector<HTMLDivElement>("#app");

if (!app) {
  throw new Error("Popup root element #app was not found.");
}

const timerController = createTimerController();
const initialView = timerController.getView();
const getMessage = (key: string, fallback: string): string => chrome.i18n.getMessage(key) || fallback;
const messages = {
  appName: getMessage("extName", "みえるタイマー"),
  timeSettingsTitle: getMessage("timeSettingsTitle", "時間"),
  minutesLabel: getMessage("minutesLabel", "分"),
  secondsLabel: getMessage("secondsLabel", "秒"),
  presetsTitle: getMessage("presetsTitle", "プリセット"),
  savePresetButton: getMessage("savePresetButton", "保存"),
  savedTimesLabel: getMessage("savedTimesLabel", "保存した時間"),
  remainingTimeLabel: getMessage("remainingTimeLabel", "残り時間"),
  remainingTimeChartTitle: getMessage("remainingTimeChartTitle", "残り時間の円表示"),
  finishMessage: getMessage("finishMessage", "おわり"),
  controlsLabel: getMessage("controlsLabel", "操作"),
  startButton: getMessage("startButton", "開始"),
  pauseButton: getMessage("pauseButton", "一時停止"),
  resetButton: getMessage("resetButton", "リセット"),
  premiumTitle: getMessage("premiumTitle", "Premium"),
  premiumTrialButton: getMessage("premiumTrialButton", "7日間トライアル"),
  premiumCheckoutButton: getMessage("premiumCheckoutButton", "購入"),
  premiumFreeStatus: getMessage("premiumFreeStatus", "無料: 保存できるプリセットは1つです"),
  premiumTrialStatus: getMessage("premiumTrialStatus", "トライアル中: 残り $DAYS$ 日"),
  premiumActiveStatus: getMessage("premiumActiveStatus", "Premium 有効"),
  premiumExpiredStatus: getMessage("premiumExpiredStatus", "トライアルは終了しました"),
  premiumPresetLimitMessage: getMessage("premiumPresetLimitMessage", "複数プリセットはPremiumで使えます"),
  themeTitle: getMessage("themeTitle", "テーマ"),
  themeLockedLabel: getMessage("themeLockedLabel", "Premiumで色テーマを変更できます"),
  themeSky: getMessage("themeSky", "そら"),
  themeLeaf: getMessage("themeLeaf", "はっぱ"),
  themeBerry: getMessage("themeBerry", "ベリー"),
};

const themeLabels: Record<TimerThemeId, string> = {
  sky: messages.themeSky,
  leaf: messages.themeLeaf,
  berry: messages.themeBerry,
};

document.documentElement.lang = chrome.i18n.getUILanguage();
document.title = messages.appName;

app.innerHTML = `
  <main class="timer-shell" aria-label="${messages.appName}">
    <section class="time-card" aria-labelledby="time-settings-title">
      <h2 id="time-settings-title">${messages.timeSettingsTitle}</h2>
      <div class="time-inputs">
        <label>
          <span>${messages.minutesLabel}</span>
          <input id="minutesInput" type="number" min="0" max="99" step="1" inputmode="numeric" value="${initialView.durationMinutes}" />
        </label>
        <label>
          <span>${messages.secondsLabel}</span>
          <input id="secondsInput" type="number" min="0" max="59" step="1" inputmode="numeric" value="${initialView.durationSeconds}" />
        </label>
      </div>
    </section>

    <section class="preset-card" aria-labelledby="preset-title">
      <div class="preset-card__header">
        <h2 id="preset-title">${messages.presetsTitle}</h2>
        <button id="savePresetButton" class="secondary-button" type="button">${messages.savePresetButton}</button>
      </div>
      <p id="presetLimitMessage" class="notice" hidden>${messages.premiumPresetLimitMessage}</p>
      <div id="presetList" class="preset-list" role="list" aria-label="${messages.savedTimesLabel}"></div>
    </section>

    <section class="premium-card" aria-labelledby="premium-title">
      <div class="premium-card__header">
        <h2 id="premium-title">${messages.premiumTitle}</h2>
        <a id="premiumCheckoutLink" class="link-button" href="${STRIPE_CHECKOUT_URL}" target="_blank" rel="noreferrer">${messages.premiumCheckoutButton}</a>
      </div>
      <p id="premiumStatus" class="notice"></p>
      <button id="startTrialButton" class="secondary-button" type="button">${messages.premiumTrialButton}</button>
    </section>

    <section class="theme-card" aria-labelledby="theme-title">
      <h2 id="theme-title">${messages.themeTitle}</h2>
      <p id="themeLockedLabel" class="notice">${messages.themeLockedLabel}</p>
      <div id="themeList" class="theme-list" role="list"></div>
    </section>

    <section class="timer-face" aria-label="${messages.remainingTimeLabel}">
      <svg class="timer-ring" viewBox="0 0 120 120" role="img" aria-labelledby="timerTitle">
        <title id="timerTitle">${messages.remainingTimeChartTitle}</title>
        <circle class="timer-ring__track" cx="60" cy="60" r="54"></circle>
        <path id="remainingSector" class="timer-ring__value"></path>
      </svg>
      <output id="remainingTime" class="remaining-time" aria-live="polite">${initialView.remainingLabel}</output>
      <p id="finishMessage" class="finish-message" aria-live="polite">${messages.finishMessage}</p>
    </section>

    <section class="controls" aria-label="${messages.controlsLabel}">
      <button id="startButton" type="button">${messages.startButton}</button>
      <button id="pauseButton" type="button">${messages.pauseButton}</button>
      <button id="resetButton" type="button">${messages.resetButton}</button>
    </section>
  </main>
`;

const style = document.createElement("style");
style.textContent = `
  :root {
    --timer-accent: #2f80ed;
    --timer-track: #dbe4ea;
    --timer-finish: #f2994a;
    color: #1f2933;
    background: #f8fafc;
    font-family: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
  }

  body {
    width: 320px;
    margin: 0;
    background: #f8fafc;
  }

  .timer-shell {
    display: grid;
    gap: 14px;
    padding: 14px;
  }

  .time-card {
    display: grid;
    gap: 10px;
  }

  .preset-card {
    display: grid;
    gap: 8px;
  }

  .premium-card,
  .theme-card {
    display: grid;
    gap: 8px;
  }

  .preset-card__header,
  .premium-card__header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
  }

  h2 {
    margin: 0;
    font-size: 14px;
    font-weight: 700;
  }

  .time-inputs {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 10px;
  }

  label {
    display: grid;
    gap: 6px;
    font-size: 12px;
    font-weight: 700;
  }

  input {
    box-sizing: border-box;
    width: 100%;
    min-height: 40px;
    border: 1px solid #ccd5df;
    border-radius: 8px;
    padding: 8px 10px;
    color: #111827;
    background: #ffffff;
    font: inherit;
    font-size: 16px;
  }

  .preset-list {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
  }

  .notice {
    margin: 0;
    color: #52616f;
    font-size: 12px;
    line-height: 1.4;
  }

  .theme-list {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 8px;
  }

  .timer-face {
    display: grid;
    place-items: center;
    position: relative;
    min-height: 190px;
    border-radius: 8px;
    transition: background 160ms ease;
  }

  .timer-ring {
    width: 184px;
    height: 184px;
  }

  .timer-ring__track {
    fill: var(--timer-track);
  }

  .timer-ring__value {
    fill: var(--timer-accent);
    transition: d 160ms ease;
  }

  .timer-face.is-finished {
    background: #fff2cc;
  }

  .timer-face.is-finished .timer-ring__track {
    fill: #f8d66d;
  }

  .timer-face.is-finished .timer-ring__value {
    fill: var(--timer-finish);
  }

  .remaining-time {
    position: absolute;
    font-size: 34px;
    font-weight: 800;
    line-height: 1;
    color: #111827;
  }

  .finish-message {
    position: absolute;
    margin: 0;
    transform: translateY(46px);
    color: #9a3412;
    font-size: 32px;
    font-weight: 900;
    line-height: 1;
    opacity: 0;
    pointer-events: none;
  }

  .timer-face.is-finished .finish-message {
    opacity: 1;
  }

  .controls {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 8px;
  }

  button,
  .link-button {
    display: inline-grid;
    place-items: center;
    box-sizing: border-box;
    min-height: 40px;
    border: 0;
    border-radius: 8px;
    padding: 0 10px;
    color: #ffffff;
    background: #2364aa;
    font: inherit;
    font-size: 13px;
    font-weight: 700;
    text-decoration: none;
    cursor: pointer;
  }

  button:hover,
  .link-button:hover {
    background: #1c568f;
  }

  button:disabled {
    cursor: default;
    opacity: 0.55;
  }

  .secondary-button,
  .preset-button,
  .theme-button {
    min-height: 34px;
    color: #12355b;
    background: #dbeafe;
  }

  .secondary-button:hover,
  .preset-button:hover,
  .theme-button:hover {
    background: #bfdbfe;
  }

  .preset-button {
    min-width: 58px;
    padding: 0 10px;
  }

  .theme-button {
    gap: 5px;
    min-width: 0;
    padding: 6px;
  }

  .theme-button[aria-pressed="true"] {
    outline: 2px solid #2364aa;
    outline-offset: 1px;
  }

  .theme-swatch {
    width: 18px;
    height: 18px;
    border-radius: 999px;
    border: 2px solid #ffffff;
    box-shadow: 0 0 0 1px #ccd5df;
  }
`;
document.head.append(style);

const minutesInput = document.querySelector<HTMLInputElement>("#minutesInput");
const secondsInput = document.querySelector<HTMLInputElement>("#secondsInput");
const presetList = document.querySelector<HTMLDivElement>("#presetList");
const savePresetButton = document.querySelector<HTMLButtonElement>("#savePresetButton");
const presetLimitMessage = document.querySelector<HTMLParagraphElement>("#presetLimitMessage");
const premiumStatusLabel = document.querySelector<HTMLParagraphElement>("#premiumStatus");
const startTrialButton = document.querySelector<HTMLButtonElement>("#startTrialButton");
const themeList = document.querySelector<HTMLDivElement>("#themeList");
const themeLockedLabel = document.querySelector<HTMLParagraphElement>("#themeLockedLabel");
const timerFace = document.querySelector<HTMLElement>(".timer-face");
const remainingSector = document.querySelector<SVGPathElement>("#remainingSector");
const remainingTime = document.querySelector<HTMLOutputElement>("#remainingTime");
const finishMessage = document.querySelector<HTMLParagraphElement>("#finishMessage");
const startButton = document.querySelector<HTMLButtonElement>("#startButton");
const pauseButton = document.querySelector<HTMLButtonElement>("#pauseButton");
const resetButton = document.querySelector<HTMLButtonElement>("#resetButton");
let tickIntervalId: number | null = null;

const timerGeometry = {
  centerX: 60,
  centerY: 60,
  radius: 54,
};

let presets: TimerPreset[] = [];
let premiumAccess: PremiumAccess | null = null;
let premiumStatus: PremiumStatus = getPremiumStatus(
  {
    entitlement: "free",
    trialStartedAtMs: null,
    purchasedAtMs: null,
  },
  Date.now(),
);
let selectedThemeId: TimerThemeId = "sky";

function readTimerInputValues() {
  return {
    minutes: minutesInput?.value ?? "",
    seconds: secondsInput?.value ?? "",
  };
}

function updateTimerDisplay(view: TimerViewModel): void {
  const isFinished = view.status === "finished";

  timerFace?.classList.toggle("is-finished", isFinished);

  if (remainingTime) {
    remainingTime.value = view.remainingLabel;
    remainingTime.textContent = view.remainingLabel;
  }

  if (finishMessage) {
    finishMessage.hidden = !isFinished;
  }

  if (remainingSector) {
    remainingSector.setAttribute("d", createRemainingSectorPath(timerGeometry, view.remainingRatio));
  }

  if (startButton) {
    startButton.disabled = view.isRunning;
  }

  if (pauseButton) {
    pauseButton.disabled = !view.isRunning;
  }
}

function writeDurationInputs(view: TimerViewModel): void {
  if (minutesInput) {
    minutesInput.value = String(view.durationMinutes);
  }

  if (secondsInput) {
    secondsInput.value = String(view.durationSeconds);
  }
}

function renderPresets(): void {
  if (!presetList) {
    return;
  }

  presetList.replaceChildren(
    ...presets.map((preset) => {
      const button = document.createElement("button");
      button.className = "preset-button";
      button.type = "button";
      button.textContent = preset.label;
      button.dataset.totalSeconds = String(preset.totalSeconds);

      return button;
    }),
  );
}

function applyTheme(themeId: TimerThemeId): void {
  const theme = getTimerTheme(themeId);

  document.documentElement.style.setProperty("--timer-accent", theme.accentColor);
  document.documentElement.style.setProperty("--timer-track", theme.trackColor);
  document.documentElement.style.setProperty("--timer-finish", theme.finishColor);
}

function getPremiumStatusText(): string {
  if (premiumStatus.access.entitlement === "premium") {
    return messages.premiumActiveStatus;
  }

  if (premiumStatus.isTrialActive) {
    return messages.premiumTrialStatus.replace("$DAYS$", String(premiumStatus.trialDaysRemaining));
  }

  if (premiumStatus.access.trialStartedAtMs !== null) {
    return messages.premiumExpiredStatus;
  }

  return messages.premiumFreeStatus;
}

function renderPremiumGate(): void {
  const presetLimit = getPresetLimit(premiumStatus);
  const isPresetLimitReached = presets.length >= presetLimit;

  if (premiumStatusLabel) {
    premiumStatusLabel.textContent = getPremiumStatusText();
  }

  if (startTrialButton) {
    startTrialButton.hidden = premiumStatus.access.entitlement === "premium" || premiumStatus.access.trialStartedAtMs !== null;
  }

  if (savePresetButton) {
    savePresetButton.disabled = !premiumStatus.isPremium && isPresetLimitReached;
  }

  if (presetLimitMessage) {
    presetLimitMessage.hidden = premiumStatus.isPremium || !isPresetLimitReached;
  }

  if (themeLockedLabel) {
    themeLockedLabel.hidden = premiumStatus.isPremium;
  }
}

function renderThemes(): void {
  if (!themeList) {
    return;
  }

  themeList.replaceChildren(
    ...TIMER_THEMES.map((theme) => {
      const button = document.createElement("button");
      const swatch = document.createElement("span");
      const label = document.createElement("span");

      swatch.className = "theme-swatch";
      swatch.style.background = theme.accentColor;
      label.textContent = themeLabels[theme.id];

      button.className = "theme-button";
      button.type = "button";
      button.dataset.themeId = theme.id;
      button.disabled = !premiumStatus.isPremium;
      button.setAttribute("aria-pressed", String(theme.id === selectedThemeId));
      button.append(swatch, label);

      return button;
    }),
  );
}

function refreshPremiumUi(): void {
  premiumStatus = getPremiumStatus(
    premiumAccess ?? {
      entitlement: "free",
      trialStartedAtMs: null,
      purchasedAtMs: null,
    },
    Date.now(),
  );

  renderPremiumGate();
  renderThemes();
}

function syncTimerFromInputs(): void {
  stopTicking();
  const view = timerController.setDurationFromInputValues(readTimerInputValues());

  void setLastTimerDurationSeconds(view.totalSeconds);
  updateTimerDisplay(view);
}

function stopTicking(): void {
  if (tickIntervalId === null) {
    return;
  }

  window.clearInterval(tickIntervalId);
  tickIntervalId = null;
}

function startTicking(): void {
  if (tickIntervalId !== null) {
    return;
  }

  tickIntervalId = window.setInterval(() => {
    const view = timerController.tick();
    updateTimerDisplay(view);

    if (!view.isRunning) {
      stopTicking();
    }
  }, 1000);
}

minutesInput?.addEventListener("input", syncTimerFromInputs);
secondsInput?.addEventListener("input", syncTimerFromInputs);
startButton?.addEventListener("click", () => {
  const view = timerController.startFromInputValues(readTimerInputValues());

  void setLastTimerDurationSeconds(view.totalSeconds);
  updateTimerDisplay(view);

  if (view.isRunning) {
    startTicking();
  }
});
pauseButton?.addEventListener("click", () => {
  stopTicking();
  updateTimerDisplay(timerController.pause());
});
resetButton?.addEventListener("click", () => {
  stopTicking();
  const view = timerController.resetFromInputValues(readTimerInputValues());

  void setLastTimerDurationSeconds(view.totalSeconds);
  updateTimerDisplay(view);
});
presetList?.addEventListener("click", (event) => {
  const presetButton = (event.target as Element).closest<HTMLButtonElement>(".preset-button");

  if (!presetButton) {
    return;
  }

  const totalSeconds = Number(presetButton.dataset.totalSeconds);
  const view = timerController.setDurationFromInputValues({
    minutes: String(Math.floor(totalSeconds / 60)),
    seconds: String(totalSeconds % 60),
  });

  stopTicking();
  void setLastTimerDurationSeconds(view.totalSeconds);
  writeDurationInputs(view);
  updateTimerDisplay(view);
});
savePresetButton?.addEventListener("click", async () => {
  const view = timerController.setDurationFromInputValues(readTimerInputValues());

  stopTicking();
  if (!premiumStatus.isPremium && presets.length >= getPresetLimit(premiumStatus)) {
    refreshPremiumUi();
    return;
  }

  presets = addTimerPreset(presets, view.totalSeconds, getPresetLimit(premiumStatus));
  await setLastTimerDurationSeconds(view.totalSeconds);
  await setTimerPresets(presets);
  renderPresets();
  refreshPremiumUi();
  writeDurationInputs(view);
  updateTimerDisplay(view);
});
startTrialButton?.addEventListener("click", async () => {
  const nextAccess = startPremiumTrial(
    premiumAccess ?? {
      entitlement: "free",
      trialStartedAtMs: null,
      purchasedAtMs: null,
    },
    Date.now(),
  );

  premiumAccess = nextAccess;
  await setPremiumAccess(nextAccess);
  refreshPremiumUi();
});
themeList?.addEventListener("click", async (event) => {
  const themeButton = (event.target as Element).closest<HTMLButtonElement>(".theme-button");
  const themeId = themeButton?.dataset.themeId as TimerThemeId | undefined;

  if (!themeButton || !themeId || !premiumStatus.isPremium) {
    return;
  }

  selectedThemeId = themeId;
  applyTheme(selectedThemeId);
  await setTimerThemeId(selectedThemeId);
  renderThemes();
});

updateTimerDisplay(initialView);
refreshPremiumUi();
void getLastTimerDurationSeconds().then((lastTimerDurationSeconds) => {
  if (lastTimerDurationSeconds === null) {
    return;
  }

  const view = timerController.setDurationFromInputValues({
    minutes: String(Math.floor(lastTimerDurationSeconds / 60)),
    seconds: String(lastTimerDurationSeconds % 60),
  });

  writeDurationInputs(view);
  updateTimerDisplay(view);
});
void getTimerPresets().then((storedPresets) => {
  presets = storedPresets;
  renderPresets();
  refreshPremiumUi();
});
void getPremiumAccess().then((storedPremiumAccess) => {
  premiumAccess = storedPremiumAccess;
  refreshPremiumUi();
});
void getTimerThemeId().then((storedThemeId) => {
  selectedThemeId = storedThemeId;
  applyTheme(selectedThemeId);
  renderThemes();
});
