import { createTimerController, type TimerViewModel } from "./core/timerController";
import { createRemainingSectorPath } from "./core/timerGeometry";

const app = document.querySelector<HTMLDivElement>("#app");

if (!app) {
  throw new Error("Popup root element #app was not found.");
}

const timerController = createTimerController();
const initialView = timerController.getView();

app.innerHTML = `
  <main class="timer-shell" aria-label="みえるタイマー">
    <section class="time-card" aria-labelledby="time-settings-title">
      <h2 id="time-settings-title">時間</h2>
      <div class="time-inputs">
        <label>
          <span>分</span>
          <input id="minutesInput" type="number" min="0" max="99" step="1" inputmode="numeric" value="${initialView.durationMinutes}" />
        </label>
        <label>
          <span>秒</span>
          <input id="secondsInput" type="number" min="0" max="59" step="1" inputmode="numeric" value="${initialView.durationSeconds}" />
        </label>
      </div>
    </section>

    <section class="timer-face" aria-label="残り時間">
      <svg class="timer-ring" viewBox="0 0 120 120" role="img" aria-labelledby="timerTitle">
        <title id="timerTitle">残り時間の円表示</title>
        <circle class="timer-ring__track" cx="60" cy="60" r="54"></circle>
        <path id="remainingSector" class="timer-ring__value"></path>
      </svg>
      <output id="remainingTime" class="remaining-time" aria-live="polite">${initialView.remainingLabel}</output>
      <p id="finishMessage" class="finish-message" aria-live="polite">おわり</p>
    </section>

    <section class="controls" aria-label="操作">
      <button id="startButton" type="button">開始</button>
      <button id="pauseButton" type="button">一時停止</button>
      <button id="resetButton" type="button">リセット</button>
    </section>
  </main>
`;

const style = document.createElement("style");
style.textContent = `
  :root {
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
    fill: #dbe4ea;
  }

  .timer-ring__value {
    fill: #2f80ed;
    transition: d 160ms ease;
  }

  .timer-face.is-finished {
    background: #fff2cc;
  }

  .timer-face.is-finished .timer-ring__track {
    fill: #f8d66d;
  }

  .timer-face.is-finished .timer-ring__value {
    fill: #f2994a;
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

  button {
    min-height: 40px;
    border: 0;
    border-radius: 8px;
    color: #ffffff;
    background: #2364aa;
    font: inherit;
    font-size: 13px;
    font-weight: 700;
    cursor: pointer;
  }

  button:hover {
    background: #1c568f;
  }
`;
document.head.append(style);

const minutesInput = document.querySelector<HTMLInputElement>("#minutesInput");
const secondsInput = document.querySelector<HTMLInputElement>("#secondsInput");
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

function syncTimerFromInputs(): void {
  stopTicking();
  updateTimerDisplay(timerController.setDurationFromInputValues(readTimerInputValues()));
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
  updateTimerDisplay(timerController.resetFromInputValues(readTimerInputValues()));
});

updateTimerDisplay(initialView);
