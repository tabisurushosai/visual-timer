import { createTimerController, type TimerViewModel } from "./core/timerController";
import { createRemainingSectorPath } from "./core/timerGeometry";
import { shouldPlayFinishChime } from "./core/chime";
import { addTimerPreset, removeTimerPreset, type TimerPreset } from "./core/presets";
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
  getFinishChimeEnabled,
  getPremiumAccess,
  getTimerPresets,
  getTimerThemeId,
  setFinishChimeEnabled,
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
  savePresetLabel: getMessage("savePresetLabel", "今の時間をプリセットに保存"),
  savedTimesLabel: getMessage("savedTimesLabel", "保存した時間"),
  presetButtonLabel: getMessage("presetButtonLabel", "$TIME$に設定"),
  quickStartPresetsLabel: getMessage("quickStartPresetsLabel", "すぐ開始"),
  quickStartPresetButtonLabel: getMessage("quickStartPresetButtonLabel", "$TIME$をすぐ開始"),
  emptyPresetsMessage: getMessage("emptyPresetsMessage", "保存した時間はまだありません。よく使う時間を保存できます。"),
  deletePresetButton: getMessage("deletePresetButton", "削除"),
  deletePresetLabel: getMessage("deletePresetLabel", "$TIME$を削除"),
  confirmDeletePresetButton: getMessage("confirmDeletePresetButton", "もう一度で削除"),
  undoDeletePresetButton: getMessage("undoDeletePresetButton", "取り消し"),
  presetDeletedMessage: getMessage("presetDeletedMessage", "$TIME$を削除しました"),
  remainingTimeLabel: getMessage("remainingTimeLabel", "残り時間"),
  remainingTimeChartTitle: getMessage("remainingTimeChartTitle", "残り時間の円表示"),
  remainingTimeStatus: getMessage("remainingTimeStatus", "残り時間 $TIME$"),
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
  themeButtonLabel: getMessage("themeButtonLabel", "$THEME$テーマ"),
  selectedThemeLabel: getMessage("selectedThemeLabel", "選択中"),
  chimeTitle: getMessage("chimeTitle", "チャイム"),
  chimeToggleLabel: getMessage("chimeToggleLabel", "終了時にやさしいチャイムを鳴らす"),
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
    <header class="app-header">
      <span class="app-header__emoji" aria-hidden="true">🌈</span>
      <h1>${messages.appName}</h1>
    </header>

    <section class="time-card" aria-labelledby="time-settings-title">
      <h2 id="time-settings-title"><span aria-hidden="true">⏱️</span>${messages.timeSettingsTitle}</h2>
      <div class="time-inputs">
        <label>
          <span>${messages.minutesLabel}</span>
          <input id="minutesInput" type="number" min="0" max="99" step="1" inputmode="numeric" aria-label="${messages.minutesLabel}" value="${initialView.durationMinutes}" />
        </label>
        <label>
          <span>${messages.secondsLabel}</span>
          <input id="secondsInput" type="number" min="0" max="59" step="1" inputmode="numeric" aria-label="${messages.secondsLabel}" value="${initialView.durationSeconds}" />
        </label>
      </div>
    </section>

    <section class="preset-card" aria-labelledby="preset-title">
      <div class="preset-card__header">
        <h2 id="preset-title"><span aria-hidden="true">⭐</span>${messages.presetsTitle}</h2>
        <button id="savePresetButton" class="secondary-button" type="button" aria-label="${messages.savePresetLabel}" aria-describedby="presetLimitMessage">${messages.savePresetButton}</button>
      </div>
      <p id="presetLimitMessage" class="notice" hidden>${messages.premiumPresetLimitMessage}</p>
      <div id="quickStartPresetList" class="quick-start-list" role="group" aria-label="${messages.quickStartPresetsLabel}"></div>
      <div id="presetList" class="preset-list" role="group" aria-label="${messages.savedTimesLabel}"></div>
      <p id="emptyPresetsMessage" class="empty-message" hidden>${messages.emptyPresetsMessage}</p>
      <p id="presetActionMessage" class="notice preset-action" aria-live="polite" hidden></p>
    </section>

    <section class="premium-card" aria-labelledby="premium-title">
      <div class="premium-card__header">
        <h2 id="premium-title"><span aria-hidden="true">🎁</span>${messages.premiumTitle}</h2>
        <a id="premiumCheckoutLink" class="link-button" href="${STRIPE_CHECKOUT_URL}" target="_blank" rel="noreferrer">${messages.premiumCheckoutButton}</a>
      </div>
      <p id="premiumStatus" class="notice"></p>
      <button id="startTrialButton" class="secondary-button" type="button">${messages.premiumTrialButton}</button>
    </section>

    <section class="theme-card" aria-labelledby="theme-title">
      <h2 id="theme-title"><span aria-hidden="true">🎨</span>${messages.themeTitle}</h2>
      <p id="themeLockedLabel" class="notice">${messages.themeLockedLabel}</p>
      <div id="themeList" class="theme-list" role="group" aria-label="${messages.themeTitle}"></div>
    </section>

    <section class="chime-card" aria-labelledby="chime-title">
      <h2 id="chime-title"><span aria-hidden="true">🔔</span>${messages.chimeTitle}</h2>
      <label class="chime-toggle">
        <input id="finishChimeToggle" type="checkbox" />
        <span>${messages.chimeToggleLabel}</span>
      </label>
    </section>

    <section class="timer-face" aria-label="${messages.remainingTimeLabel}">
      <svg class="timer-ring" viewBox="0 0 120 120" role="img" aria-labelledby="timerTitle">
        <title id="timerTitle">${messages.remainingTimeChartTitle}</title>
        <circle class="timer-ring__track" cx="60" cy="60" r="54"></circle>
        <path id="remainingSector" class="timer-ring__value"></path>
      </svg>
      <output id="remainingTime" class="remaining-time" aria-live="polite">${initialView.remainingLabel}</output>
      <p id="timerStatus" class="sr-only" aria-live="polite">${messages.remainingTimeStatus.replace("$TIME$", initialView.remainingLabel)}</p>
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
    --timer-accent: #2684ff;
    --timer-track: #d9f0ff;
    --timer-finish: #ff9f43;
    --surface: #ffffff;
    --surface-soft: #fff7d6;
    --border-soft: #cfe7ff;
    color: #243447;
    background: #f7fbff;
    font-family: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
  }

  .sr-only {
    position: absolute;
    width: 1px;
    height: 1px;
    padding: 0;
    margin: -1px;
    overflow: hidden;
    clip: rect(0, 0, 0, 0);
    white-space: nowrap;
    border: 0;
  }

  [hidden] {
    display: none !important;
  }

  body {
    width: 320px;
    margin: 0;
    background: #f7fbff;
  }

  .timer-shell {
    display: grid;
    gap: 12px;
    padding: 14px;
  }

  .app-header {
    display: grid;
    grid-template-columns: auto 1fr;
    align-items: center;
    gap: 10px;
    padding: 10px 12px;
    border: 1px solid var(--border-soft);
    border-radius: 8px;
    background: #eaf7ff;
  }

  .app-header__emoji {
    display: grid;
    place-items: center;
    width: 42px;
    height: 42px;
    border-radius: 8px;
    background: #ffffff;
    font-size: 28px;
  }

  h1 {
    margin: 0;
    color: #12355b;
    font-size: 20px;
    font-weight: 900;
    line-height: 1.15;
  }

  .time-card,
  .preset-card,
  .premium-card,
  .theme-card,
  .chime-card {
    display: grid;
    gap: 10px;
    padding: 12px;
    border: 1px solid var(--border-soft);
    border-radius: 8px;
    background: var(--surface);
  }

  .preset-card__header,
  .premium-card__header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
  }

  h2 {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    margin: 0;
    color: #12355b;
    font-size: 15px;
    font-weight: 800;
  }

  .time-inputs {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 10px;
  }

  label {
    display: grid;
    gap: 6px;
    color: #334e68;
    font-size: 13px;
    font-weight: 800;
  }

  input {
    box-sizing: border-box;
    width: 100%;
    min-height: 48px;
    border: 2px solid #b9dcff;
    border-radius: 8px;
    padding: 8px 12px;
    color: #111827;
    background: #fafdff;
    font: inherit;
    font-size: 18px;
    font-weight: 800;
  }

  input:focus-visible,
  button:focus-visible,
  .link-button:focus-visible {
    outline: 3px solid #7c3aed;
    outline-offset: 3px;
  }

  .preset-list {
    display: grid;
    gap: 8px;
  }

  .quick-start-list {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
  }

  .preset-item {
    display: grid;
    grid-template-columns: 1fr auto;
    gap: 8px;
  }

  .empty-message {
    margin: 0;
    border: 2px dashed #b9dcff;
    border-radius: 8px;
    padding: 10px;
    color: #486581;
    background: #fafdff;
    font-size: 13px;
    font-weight: 700;
    line-height: 1.4;
  }

  .notice {
    margin: 0;
    color: #486581;
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
    min-height: 206px;
    border: 1px solid #ffe08a;
    border-radius: 8px;
    background: var(--surface-soft);
    transition: background 160ms ease;
  }

  .timer-ring {
    width: 196px;
    height: 196px;
  }

  .timer-ring__track {
    fill: var(--timer-track);
  }

  .timer-ring__value {
    fill: var(--timer-accent);
    transition: d 160ms ease;
  }

  .timer-face.is-finished {
    background: #fff0c2;
  }

  .timer-face.is-finished .timer-ring__track {
    fill: #f8d66d;
  }

  .timer-face.is-finished .timer-ring__value {
    fill: var(--timer-finish);
  }

  .remaining-time {
    position: absolute;
    font-size: 38px;
    font-weight: 800;
    line-height: 1;
    color: #102a43;
  }

  .finish-message {
    position: absolute;
    margin: 0;
    transform: translateY(46px);
    color: #9a3412;
    font-size: 34px;
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
    min-height: 48px;
    border: 0;
    border-radius: 8px;
    padding: 0 12px;
    color: #ffffff;
    background: #1f73d1;
    font: inherit;
    font-size: 14px;
    font-weight: 800;
    text-decoration: none;
    cursor: pointer;
  }

  button:hover,
  .link-button:hover {
    background: #1557a6;
  }

  button:disabled {
    cursor: default;
    color: #4b5563;
    background: #eef2f7;
    opacity: 1;
  }

  .secondary-button,
  .quick-start-button,
  .preset-button,
  .preset-delete-button,
  .undo-button,
  .theme-button {
    min-height: 44px;
    color: #12355b;
    background: #e3f2ff;
  }

  .secondary-button:hover,
  .quick-start-button:hover,
  .preset-button:hover,
  .preset-delete-button:hover,
  .undo-button:hover,
  .theme-button:hover {
    background: #bfdbfe;
  }

  .preset-button {
    min-width: 0;
    padding: 0 10px;
  }

  .quick-start-button {
    flex: 1 1 calc(50% - 4px);
    min-width: 92px;
    padding: 0 10px;
    color: #ffffff;
    background: var(--timer-accent);
  }

  .quick-start-button:hover {
    background: #1557a6;
  }

  .preset-delete-button {
    min-width: 82px;
    padding: 0 10px;
    color: #7c2d12;
    background: #fff0c2;
  }

  .preset-delete-button.is-confirming {
    color: #ffffff;
    background: #c2410c;
  }

  .preset-delete-button.is-confirming:hover {
    background: #9a3412;
  }

  .preset-action {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
  }

  .undo-button {
    min-height: 36px;
    padding: 0 10px;
  }

  .theme-button {
    gap: 6px;
    min-width: 0;
    padding: 8px 6px;
  }

  .theme-button[aria-pressed="true"] {
    box-shadow: inset 0 0 0 3px #2364aa;
  }

  .theme-selected-mark {
    min-width: 1em;
    font-weight: 900;
  }

  .theme-swatch {
    width: 20px;
    height: 20px;
    border-radius: 999px;
    border: 2px solid #ffffff;
    box-shadow: 0 0 0 1px #ccd5df;
  }

  .chime-toggle {
    grid-template-columns: auto 1fr;
    align-items: center;
    gap: 10px;
    color: #334e68;
    font-size: 13px;
    font-weight: 800;
    line-height: 1.35;
  }

  .chime-toggle input {
    width: 22px;
    min-height: 22px;
    margin: 0;
    border: 0;
    padding: 0;
    accent-color: #1f73d1;
  }
`;
document.head.append(style);

const minutesInput = document.querySelector<HTMLInputElement>("#minutesInput");
const secondsInput = document.querySelector<HTMLInputElement>("#secondsInput");
const quickStartPresetList = document.querySelector<HTMLDivElement>("#quickStartPresetList");
const presetList = document.querySelector<HTMLDivElement>("#presetList");
const savePresetButton = document.querySelector<HTMLButtonElement>("#savePresetButton");
const presetLimitMessage = document.querySelector<HTMLParagraphElement>("#presetLimitMessage");
const emptyPresetsMessage = document.querySelector<HTMLParagraphElement>("#emptyPresetsMessage");
const presetActionMessage = document.querySelector<HTMLParagraphElement>("#presetActionMessage");
const premiumStatusLabel = document.querySelector<HTMLParagraphElement>("#premiumStatus");
const startTrialButton = document.querySelector<HTMLButtonElement>("#startTrialButton");
const themeList = document.querySelector<HTMLDivElement>("#themeList");
const themeLockedLabel = document.querySelector<HTMLParagraphElement>("#themeLockedLabel");
const finishChimeToggle = document.querySelector<HTMLInputElement>("#finishChimeToggle");
const timerFace = document.querySelector<HTMLElement>(".timer-face");
const remainingSector = document.querySelector<SVGPathElement>("#remainingSector");
const remainingTime = document.querySelector<HTMLOutputElement>("#remainingTime");
const timerStatus = document.querySelector<HTMLParagraphElement>("#timerStatus");
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
let pendingDeletePresetId: string | null = null;
let undoPresetsSnapshot: TimerPreset[] | null = null;
let undoTimeoutId: number | null = null;
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
let isFinishChimeEnabled = false;
let latestTimerView = initialView;
let audioContext: AudioContext | null = null;

type AudioContextWindow = Window &
  typeof globalThis & {
    webkitAudioContext?: typeof AudioContext;
  };

function readTimerInputValues() {
  return {
    minutes: minutesInput?.value ?? "",
    seconds: secondsInput?.value ?? "",
  };
}

function formatMessage(template: string, replacements: Record<string, string>): string {
  return Object.entries(replacements).reduce((message, [key, value]) => message.replace(`$${key}$`, value), template);
}

function updateTimerDisplay(view: TimerViewModel): void {
  const isFinished = view.status === "finished";
  const shouldPlayChime = shouldPlayFinishChime(latestTimerView.status, view.status, isFinishChimeEnabled);

  timerFace?.classList.toggle("is-finished", isFinished);

  if (remainingTime) {
    remainingTime.value = view.remainingLabel;
    remainingTime.textContent = view.remainingLabel;
    remainingTime.setAttribute("aria-label", formatMessage(messages.remainingTimeStatus, { TIME: view.remainingLabel }));
  }

  if (timerStatus) {
    timerStatus.textContent = isFinished ? messages.finishMessage : formatMessage(messages.remainingTimeStatus, { TIME: view.remainingLabel });
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

  latestTimerView = view;

  if (shouldPlayChime) {
    playFinishChime();
  }
}

function playFinishChime(): void {
  const audioWindow = window as AudioContextWindow;
  const AudioContextConstructor = audioWindow.AudioContext || audioWindow.webkitAudioContext;

  if (!AudioContextConstructor) {
    return;
  }

  audioContext ??= new AudioContextConstructor();

  const context = audioContext;
  void context.resume();
  const startAt = context.currentTime;
  const gain = context.createGain();

  gain.gain.setValueAtTime(0.0001, startAt);
  gain.gain.exponentialRampToValueAtTime(0.08, startAt + 0.02);
  gain.gain.exponentialRampToValueAtTime(0.0001, startAt + 0.55);
  gain.connect(context.destination);

  [523.25, 659.25, 783.99].forEach((frequency, index) => {
    const oscillator = context.createOscillator();
    const noteStart = startAt + index * 0.12;

    oscillator.type = "sine";
    oscillator.frequency.setValueAtTime(frequency, noteStart);
    oscillator.connect(gain);
    oscillator.start(noteStart);
    oscillator.stop(noteStart + 0.18);
  });

  window.setTimeout(() => {
    gain.disconnect();
  }, 700);
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

  if (emptyPresetsMessage) {
    emptyPresetsMessage.hidden = presets.length > 0;
  }

  quickStartPresetList?.replaceChildren(
    ...presets.map((preset) => {
      const button = document.createElement("button");

      button.className = "quick-start-button";
      button.type = "button";
      button.textContent = preset.label;
      button.dataset.totalSeconds = String(preset.totalSeconds);
      button.setAttribute("aria-label", formatMessage(messages.quickStartPresetButtonLabel, { TIME: preset.label }));

      return button;
    }),
  );

  if (quickStartPresetList) {
    quickStartPresetList.hidden = presets.length === 0;
  }

  presetList.replaceChildren(
    ...presets.map((preset) => {
      const item = document.createElement("span");
      const button = document.createElement("button");
      const deleteButton = document.createElement("button");
      const isConfirmingDelete = pendingDeletePresetId === preset.id;

      item.className = "preset-item";
      button.className = "preset-button";
      button.type = "button";
      button.textContent = preset.label;
      button.dataset.action = "select";
      button.dataset.totalSeconds = String(preset.totalSeconds);
      button.setAttribute("aria-label", formatMessage(messages.presetButtonLabel, { TIME: preset.label }));

      deleteButton.className = `preset-delete-button${isConfirmingDelete ? " is-confirming" : ""}`;
      deleteButton.type = "button";
      deleteButton.textContent = isConfirmingDelete ? messages.confirmDeletePresetButton : messages.deletePresetButton;
      deleteButton.dataset.action = "delete";
      deleteButton.dataset.presetId = preset.id;
      deleteButton.setAttribute("aria-label", formatMessage(messages.deletePresetLabel, { TIME: preset.label }));

      item.append(button, deleteButton);

      return item;
    }),
  );
}

function renderPresetAction(message = ""): void {
  if (!presetActionMessage) {
    return;
  }

  presetActionMessage.replaceChildren();
  presetActionMessage.hidden = message.length === 0;

  if (message.length === 0) {
    return;
  }

  const text = document.createElement("span");
  const undoButton = document.createElement("button");

  text.textContent = message;
  undoButton.className = "undo-button";
  undoButton.type = "button";
  undoButton.textContent = messages.undoDeletePresetButton;
  undoButton.dataset.action = "undo-delete";
  presetActionMessage.append(text, undoButton);
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
      const selectedMark = document.createElement("span");
      const isSelected = theme.id === selectedThemeId;

      swatch.className = "theme-swatch";
      swatch.style.background = theme.accentColor;
      label.textContent = themeLabels[theme.id];
      selectedMark.className = "theme-selected-mark";
      selectedMark.textContent = isSelected ? "✓" : "";
      selectedMark.setAttribute("aria-hidden", "true");

      button.className = "theme-button";
      button.type = "button";
      button.dataset.themeId = theme.id;
      button.disabled = !premiumStatus.isPremium;
      button.setAttribute("aria-pressed", String(isSelected));
      button.setAttribute(
        "aria-label",
        `${formatMessage(messages.themeButtonLabel, { THEME: themeLabels[theme.id] })}${isSelected ? ` ${messages.selectedThemeLabel}` : ""}`,
      );
      button.append(swatch, label, selectedMark);

      return button;
    }),
  );
}

function focusSiblingButton(buttons: HTMLButtonElement[], currentButton: HTMLButtonElement, direction: 1 | -1): void {
  const currentIndex = buttons.indexOf(currentButton);

  if (currentIndex < 0) {
    return;
  }

  const nextButton = buttons[(currentIndex + direction + buttons.length) % buttons.length];
  nextButton?.focus();
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

function startPresetImmediately(totalSeconds: number): void {
  stopTicking();
  const view = timerController.startFromTotalSeconds(totalSeconds);

  void setLastTimerDurationSeconds(view.totalSeconds);
  writeDurationInputs(view);
  updateTimerDisplay(view);
  startTicking();
}

async function deletePresetWithUndo(presetId: string): Promise<void> {
  const deletedPreset = presets.find((preset) => preset.id === presetId);

  if (!deletedPreset) {
    pendingDeletePresetId = null;
    renderPresets();
    return;
  }

  if (undoTimeoutId !== null) {
    window.clearTimeout(undoTimeoutId);
    undoTimeoutId = null;
  }

  undoPresetsSnapshot = presets;
  pendingDeletePresetId = null;
  presets = removeTimerPreset(presets, presetId);
  await setTimerPresets(presets);
  renderPresets();
  refreshPremiumUi();
  renderPresetAction(formatMessage(messages.presetDeletedMessage, { TIME: deletedPreset.label }));

  undoTimeoutId = window.setTimeout(() => {
    undoPresetsSnapshot = null;
    undoTimeoutId = null;
    renderPresetAction();
  }, 5000);
}

async function undoPresetDelete(): Promise<void> {
  if (!undoPresetsSnapshot) {
    renderPresetAction();
    return;
  }

  if (undoTimeoutId !== null) {
    window.clearTimeout(undoTimeoutId);
    undoTimeoutId = null;
  }

  presets = undoPresetsSnapshot;
  undoPresetsSnapshot = null;
  await setTimerPresets(presets);
  renderPresetAction();
  renderPresets();
  refreshPremiumUi();
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
quickStartPresetList?.addEventListener("click", (event) => {
  const quickStartButton = (event.target as Element).closest<HTMLButtonElement>(".quick-start-button");

  if (!quickStartButton) {
    return;
  }

  startPresetImmediately(Number(quickStartButton.dataset.totalSeconds));
});
presetList?.addEventListener("click", (event) => {
  const clickedButton = (event.target as Element).closest<HTMLButtonElement>("button");

  if (!clickedButton) {
    return;
  }

  if (clickedButton.dataset.action === "delete") {
    const presetId = clickedButton.dataset.presetId;

    if (!presetId) {
      return;
    }

    if (pendingDeletePresetId === presetId) {
      void deletePresetWithUndo(presetId);
      return;
    }

    pendingDeletePresetId = presetId;
    renderPresets();
    return;
  }

  const presetButton = clickedButton.closest<HTMLButtonElement>(".preset-button");

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
presetActionMessage?.addEventListener("click", (event) => {
  const undoButton = (event.target as Element).closest<HTMLButtonElement>('[data-action="undo-delete"]');

  if (!undoButton) {
    return;
  }

  void undoPresetDelete();
});
quickStartPresetList?.addEventListener("keydown", (event) => {
  if (event.key !== "ArrowRight" && event.key !== "ArrowLeft") {
    return;
  }

  const quickStartButton = (event.target as Element).closest<HTMLButtonElement>(".quick-start-button");
  const quickStartButtons = Array.from(quickStartPresetList.querySelectorAll<HTMLButtonElement>(".quick-start-button"));

  if (!quickStartButton || quickStartButtons.length === 0) {
    return;
  }

  event.preventDefault();
  focusSiblingButton(quickStartButtons, quickStartButton, event.key === "ArrowRight" ? 1 : -1);
});
presetList?.addEventListener("keydown", (event) => {
  if (event.key !== "ArrowRight" && event.key !== "ArrowLeft") {
    return;
  }

  const presetButton = (event.target as Element).closest<HTMLButtonElement>(".preset-button");
  const presetButtons = Array.from(presetList.querySelectorAll<HTMLButtonElement>(".preset-button"));

  if (!presetButton || presetButtons.length === 0) {
    return;
  }

  event.preventDefault();
  focusSiblingButton(presetButtons, presetButton, event.key === "ArrowRight" ? 1 : -1);
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
themeList?.addEventListener("keydown", (event) => {
  if (event.key !== "ArrowRight" && event.key !== "ArrowLeft") {
    return;
  }

  const themeButton = (event.target as Element).closest<HTMLButtonElement>(".theme-button");
  const themeButtons = Array.from(themeList.querySelectorAll<HTMLButtonElement>(".theme-button:not(:disabled)"));

  if (!themeButton || themeButtons.length === 0) {
    return;
  }

  event.preventDefault();
  focusSiblingButton(themeButtons, themeButton, event.key === "ArrowRight" ? 1 : -1);
});
finishChimeToggle?.addEventListener("change", async () => {
  isFinishChimeEnabled = finishChimeToggle.checked;
  await setFinishChimeEnabled(isFinishChimeEnabled);
});

updateTimerDisplay(initialView);
refreshPremiumUi();
void getFinishChimeEnabled().then((storedFinishChimeEnabled) => {
  isFinishChimeEnabled = storedFinishChimeEnabled;

  if (finishChimeToggle) {
    finishChimeToggle.checked = storedFinishChimeEnabled;
  }
});
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
