// canvas.js
// Canvas 2D への描画のみ。ロジックや状態は持たず、受け取ったデータを描くだけ。

const PIXELS_PER_MS = 0.4; // 1ms あたりのピクセル数（スクロール倍率）
const JUDGMENT_X_RATIO = 0.2; // 判定ラインのX位置（canvas幅の何割かで）
const BLOCK_HEIGHT_RATIO = 0.03; // ブロックの高さ(縦幅,canvas高さの何割か）

let canvas, ctx;
let touchedY = 0; // 正規化済みY座標（上=1, 下=0）

// RAFループ用
let lastPosition = 0; // 曲の開始を0とした再生時刻
let lastReceivedAt = 0; // ブラウザ起動を0とした壁時計時刻
let storedWordBlocks = [];
let effectsQueue = []; // game.js から渡されたブロック評価エフェクトPERFECT/GOOD/BADのキュー

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

  // mainの方のonTimeUpdate(~20fps)とは独立した描画ループ(16ms間隔60FPS程度)
  function canvasRenderLoop() {
    requestAnimationFrame(canvasRenderLoop);
    // (前回の曲の再生位置ms) + (その後の経過時間ms)でポジション補完
    const estimatedPosition = lastPosition + (performance.now() - lastReceivedAt);
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    drawWordBlocks(estimatedPosition, storedWordBlocks);
    // TODO: effectsQueue を消費して火花エフェクトを描画（{ normalizedY, rating } を使う）
    effectsQueue = []; // 演出を描画したらからにする
    // TODO: プレイヤーのカーソル/指の位置(touchedY)を描画
    // メモ: touchedYはこのスコープの範囲内なので誤ってmainからupdateCanvasStateに渡してくるみたいなことをしないように。
    // 現状pauseしても補完が回り続けるのでブロック描画が止まらないのでここも後々対応してね。
  }
  canvasRenderLoop();
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

// ワードブロックを描画する（drawFrame 内部からのみ呼ぶ）
function drawWordBlocks(position, wordBlocks) {
  const judgmentX = canvas.width * JUDGMENT_X_RATIO;
  const blockHeight = canvas.height * BLOCK_HEIGHT_RATIO;

  // ======== 判定ラインから右端までの矩形を書き込み可能な領域としてクリップ ======
  ctx.save();
  ctx.beginPath();
  ctx.rect(judgmentX, 0, canvas.width - judgmentX, canvas.height);
  ctx.clip();

  ctx.fillStyle = "#20B2AA";
  ctx.font = `${blockHeight * 0.7}px sans-serif`;
  ctx.textBaseline = "middle";

  // クリップ内で画面内に映る全ブロックを取得後描画
  // Ruby: wordBlocks.each do | block | {}
  for (const block of wordBlocks) {
    // startTime は固定値, position は増加し続けるためx座標は減少(左に移動)していく
    const blockPosX = judgmentX + (block.startTime - position) * PIXELS_PER_MS;
    const blockWidth = (block.endTime - block.startTime) * PIXELS_PER_MS;
    // 右端が判定ラインより左 or 左端が画面右端より右はスキップ
    if (blockPosX + blockWidth < judgmentX || blockPosX > canvas.width) continue;

    const blockPosY = toCanvasY(block.normalizedAmp) - blockHeight / 2;
    ctx.beginPath();
    ctx.roundRect(blockPosX, blockPosY, blockWidth, blockHeight, 4);
    ctx.fill();

    const textWidth = ctx.measureText(block.text).width;
    if (textWidth < blockWidth - 16) {
      ctx.fillStyle = "white";
      ctx.fillText(block.text, blockPosX + 8, blockPosY + blockHeight / 2);
      ctx.fillStyle = "#20B2AA";
    }
  }

  ctx.restore(); // クリップ解放
}

// onTimeUpdateから呼び、描画せず状態だけ保存する（描画はcanvasRenderLoopに集約）
export function updateCanvasState({ position, wordBlocks, effects = [] }) {
  lastPosition = position; // 曲の再生位置(ms)
  lastReceivedAt = performance.now(); // ブラウザ内でのグローバル到達時刻(ms)
  storedWordBlocks = wordBlocks; // 描画対象のブロック特定用
  effectsQueue.push(...effects); // renderLoop が消費するまでキューに積む
}
