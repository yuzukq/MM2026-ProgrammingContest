// canvas.js
// Canvas 2D への描画のみ。ロジックや状態は持たず、受け取ったデータを描くだけ。

const PIXELS_PER_MS = 0.4; // 1ms あたりのピクセル数（スクロール倍率）
const JUDGMENT_X_RATIO = 0.2; // 判定ラインのX位置（canvas幅の何割かで）
const BLOCK_HEIGHT_RATIO = 0.03; // ブロックの高さ(縦幅,canvas高さの何割か）

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

// ワードブロックをスクロール描画する（drawFrame 内部からのみ呼ぶ）
function drawWordBlocks(position, wordBlocks) {
  const judgmentX = canvas.width * JUDGMENT_X_RATIO;
  const blockHeight = canvas.height * BLOCK_HEIGHT_RATIO;

  ctx.fillStyle = "#20B2AA";
  for (const block of wordBlocks) {
    // startTime は固定値, position は増加し続けるためx座標は減少(左に移動)していく
    const blockPosX = judgmentX + (block.startTime - position) * PIXELS_PER_MS;
    const blockWidth = (block.endTime - block.startTime) * PIXELS_PER_MS;
    // 画面外はスキップ
    if (blockPosX + blockWidth < 0 || blockPosX > canvas.width) continue;

    const blockPosY = toCanvasY(block.normalizedAmp) - blockHeight / 2;
    ctx.beginPath();
    ctx.roundRect(blockPosX, blockPosY, blockWidth, blockHeight, 4); // 左上X,左上Y,横幅,縦幅,角丸4px
    ctx.fill();
  }
}

// 1フレーム分の描画　メインループonTimeUpdateで毎フレーム呼び出す
export function drawFrame({ position, wordBlocks, touchedY }) {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  drawWordBlocks(position, wordBlocks);
  // TODO: プレイヤーのカーソル/指の位置(touchedY)を描画
}
