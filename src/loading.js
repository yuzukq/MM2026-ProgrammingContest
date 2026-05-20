// loading.js
// 選曲後〜曲ロード完了までのロード画面を担当する
// ロード完了（setLoadingReady）後にタップされたら onStartCallback を呼ぶ
// 素材の差し替えは /assets/loading.png を置き換えるだけでOK

const IMG_SRC = "/assets/loading.png"; // TODO: デザイナー提供素材に差し替える

let screenEl = null;
let hintEl = null;
let onStartCallback = null;
let isReady = false; // onVideoReady が来るまでタップを受け付けない

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
}

// onVideoReady から呼ぶ：タップ受付を有効にしてヒントを切り替える
export function setLoadingReady() {
  isReady = true;
  screenEl.style.cursor = "pointer";
  hintEl.textContent = "タップしてスタート";
  hintEl.style.opacity = "1";
}

function buildDOM() {
  screenEl = document.createElement("div");
  screenEl.id = "loading-screen";

  const img = document.createElement("img");
  img.id = "loading-image";
  img.src = IMG_SRC;
  img.alt = "";

  hintEl = document.createElement("p");
  hintEl.id = "loading-hint";
  hintEl.textContent = "ロード中...";

  screenEl.appendChild(img);
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
  if (!isReady) return;
  onStartCallback?.();
}
