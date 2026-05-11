// ui.js
// ボタンのイベント登録とスコア表示の更新のみ。

// onVideoReady で1回呼ぶ：ボタンにイベントを登録する
export function initUI(player) {
  document.querySelector("#play-btn").addEventListener("click", () => {
    player.isPlaying ? player.requestPause() : player.requestPlay();
  });
  // その他ボタンなど増えれば...
}

// onTimeUpdate で毎フレーム呼ぶ：スコア表示を更新する
export function updateUI(score) {
  document.querySelector("#score").textContent = Math.floor(score);
}
