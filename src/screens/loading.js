// loading.js
// 選曲後〜曲ロード完了までのロード画面を担当する
// ロード完了（setLoadingReady）後にタップされたら onStartCallback を呼ぶ

let screenEl = null;
let finishBgEl = null;
let hintEl = null;
let onStartCallback = null;
let isReady = false; // onVideoReady が来るまでタップを受け付けない
let inTransition = false;

// ── public ──────────────────────────────

// main.js から呼ぶ。onStart() はタップ確定時のコールバック
export function initLoading(onStart) {
  onStartCallback = onStart;
  buildDOM();
}

export function showLoadingScreen() {
  screenEl.style.display = "flex";
}

export function hideLoadingScreen() {
  screenEl.style.display = "none";
  finishBgEl.style.opacity = "0"; // 次回のために元に戻す
  isReady = false;
  inTransition = false;
  screenEl.style.pointerEvents = "";
}

// タップ確定後 onComplete を発火する
export function startPlayTransition(onComplete) {
  if (inTransition) return;
  inTransition = true;
  screenEl.style.pointerEvents = "none";
  onComplete();
}

// onVideoReady から呼ぶ：タップ受付を有効にしてヒントを切り替える
export function setLoadingReady() {
  isReady = true;
  screenEl.style.cursor = "pointer";
  finishBgEl.style.opacity = "1"; // loading_finish.png へクロスフェード
  hintEl.textContent = "Tap to Start";
  hintEl.style.opacity = "1";
}

// ── internal ────────────────────────────

function buildDOM() {
  screenEl = document.createElement("div");
  screenEl.id = "loading-screen";

  finishBgEl = document.createElement("div");
  finishBgEl.id = "loading-finish-bg";

  hintEl = document.createElement("p");
  hintEl.id = "loading-hint";
  hintEl.textContent = "";

  screenEl.appendChild(finishBgEl);
  screenEl.appendChild(hintEl);
  document.body.appendChild(screenEl);

  // isReady フラグでロード完了前のタップをガード
  screenEl.addEventListener("click", handleTap);
  screenEl.addEventListener(
    "touchend",
    (e) => {
      e.preventDefault();
      handleTap();
    },
    { passive: false }
  );
}

// player.requestPlay()とtransition(STATE.PLAYING)を実行
function handleTap() {
  if (!isReady || inTransition) return;
  onStartCallback?.();
}
