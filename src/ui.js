// ui.js
// ボタンのイベント登録とスコア表示の更新のみ。

// onVideoReady で1回呼ぶ：ボタンにイベントを登録する
export function initUI(player) {
  const btn = document.querySelector("#play-btn");
  btn.addEventListener("click", () => {
    if (player.isPlaying) {
      player.requestPause();
      btn.textContent = "▶ Play";
    } else {
      player.requestPlay();
      btn.textContent = "⏸ Pause";
    }
  });
}

// onTimeUpdate で毎フレーム呼ぶ：スコア表示を更新する
export function updateUI(score) {
  document.querySelector("#score").textContent = `score: ${Math.floor(score)}`;
}
