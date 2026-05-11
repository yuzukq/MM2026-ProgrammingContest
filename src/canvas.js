// canvas.js
// Canvas 2D への描画のみ。ロジックや状態は持たず、受け取ったデータを描くだけ。

let canvas, ctx;

// canvasを生成してDOMに挿入する main側でinit呼び出し
export function initCanvas() {
  canvas = document.createElement("canvas");
  canvas.style.cssText = "position:fixed;top:0;left:0;z-index:1;pointer-events:auto;";
  document.body.appendChild(canvas);
  ctx = canvas.getContext("2d"); // 描画ツール

  function onResize() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
  }
  window.addEventListener("resize", onResize);
  onResize();
}

// 1フレーム分の描画　メインループonTimeUpdateで毎フレーム呼び出す
export function drawFrame({ position, wordBlocks, touchedY }) {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  // TODO: 単語ブロックのスクロール描画（過去・現在・先読みゴースト）
  // TODO: プレイヤーのカーソル/指の位置を描画
}
