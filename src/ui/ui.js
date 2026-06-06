// ui.js
// スコア表示の更新のみ。

// onTimeUpdate で毎フレーム呼ぶ：スコア・レーティング表示を更新する
export function updateUI(score, rating) {
  document.querySelector("#score").textContent = `score: ${Math.floor(score)}`;
  if (rating) document.querySelector("#rating").textContent = rating;
}
