// transition.js
// 全画面オーバーレイによるフェードイン/アウト。ステート遷移の視覚ギャップを隠蔽する。

let el = null;

// ── public ──────────────────────────────

export function initTransition() {
  el = document.createElement("div");
  el.id = "transition-overlay";
  document.body.appendChild(el);
}

// 即時幕下ろし（T ポーズ隠蔽など、フレーム間に差し込む用途）
export function cover() {
  el.style.transition = "none";
  el.style.opacity = "1";
  el.style.pointerEvents = "auto";
}

// ms かけて不透明に。完了を Promise で通知する
export function fadeIn(ms = 400) {
  return new Promise((resolve) => {
    el.style.transition = `opacity ${ms}ms ease`;
    el.style.opacity = "1";
    el.style.pointerEvents = "auto";
    setTimeout(resolve, ms);
  });
}

// ms かけて透明に。完了後 pointerEvents を none に戻す
export function fadeOut(ms = 400) {
  return new Promise((resolve) => {
    el.style.transition = `opacity ${ms}ms ease`;
    el.style.opacity = "0";
    setTimeout(() => {
      el.style.pointerEvents = "none";
      resolve();
    }, ms);
  });
}
