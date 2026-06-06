// result.js
// リザルト画面のDOM構築と表示/非表示を担当する
// スコア・判定数の表示のみ（後でSVG差し替え前提のため最小スタイル）

let screenEl = null;
let scoreEl = null;
let perfectEl = null;
let goodEl = null;
let badEl = null;
let onRestartCallback = null;

export function initResult(onRestart) {
  onRestartCallback = onRestart;
  buildDOM();
}

export function showResultScreen({ score, maxScore, ratingCounts }) {
  scoreEl.textContent = `SCORE: ${Math.floor(score)} / ${Math.floor(maxScore)}`;
  perfectEl.textContent = `PERFECT: ${ratingCounts.PERFECT}`;
  goodEl.textContent = `GOOD: ${ratingCounts.GOOD}`;
  badEl.textContent = `BAD: ${ratingCounts.BAD}`;
  screenEl.style.display = "flex";
}

export function hideResultScreen() {
  screenEl.style.display = "none";
}

function buildDOM() {
  screenEl = document.createElement("div");
  screenEl.id = "result-screen";

  const content = document.createElement("div");
  content.id = "result-content";

  scoreEl = document.createElement("p");
  perfectEl = document.createElement("p");
  goodEl = document.createElement("p");
  badEl = document.createElement("p");

  const hint = document.createElement("p");
  hint.id = "result-hint";
  hint.textContent = "タップして選曲に戻る";

  content.append(scoreEl, perfectEl, goodEl, badEl, hint);
  screenEl.appendChild(content);
  document.body.appendChild(screenEl);

  screenEl.addEventListener("click", () => onRestartCallback?.());
  screenEl.addEventListener(
    "touchend",
    (e) => {
      e.preventDefault();
      onRestartCallback?.();
    },
    { passive: false }
  );
}
