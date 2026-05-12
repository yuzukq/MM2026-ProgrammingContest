// canvas.js
// Canvas 2D への描画のみ。ロジックや状態は持たず、受け取ったデータを描くだけ。

let canvas, ctx;
let touchedY = 0; // 正規化済みY座標（上=1, 下=0)

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

  // マウス/タッチ入力でtouchedYを更新するイベントリスナー
  canvas.addEventListener("mousemove", (e) => {
    touchedY = toNormalizedY(e.clientY); // 座標変換,正規化して代入
  });
  canvas.addEventListener("touchmove", (e) => {
    touchedY = toNormalizedY(e.touches[0].clientY);
  });
}

// 正規化済みのtouchedYを返す
export function getTouchedY() {
  return touchedY;
}

// 正規化座標（上=1, 下=0）をcanvasピクセルY座標(左上が原点)に変換する
// 触れている位置のフィードバック描画やブロック描画時に使う
export function toCanvasY(normalizedY) {
  return (1 - normalizedY) * canvas.height;
}

// タッチ座標系を声量座標系と揃える。入力検出時に内部で使う
export function toNormalizedY(canvasY) {
  return 1 - canvasY / canvas.height;
}

// 1フレーム分の描画　メインループonTimeUpdateで毎フレーム呼び出す
export function drawFrame({ position, wordBlocks, touchedY }) {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  // TODO: 単語ブロックのスクロール描画（過去・現在・先読みゴースト）
  // TODO: プレイヤーのカーソル/指の位置を描画
}
