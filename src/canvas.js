// canvas.js
// Canvas 2D への描画のみ。ロジックや状態は持たず、受け取ったデータを描くだけ。

import { particleSystem } from "./particles.js";

const PIXELS_PER_MS = 0.65; // 1ms あたりのピクセル数（スクロール倍率）
const JUDGMENT_X_RATIO = 0.2; // 判定ラインのX位置（canvas幅の何割かで）
const BLOCK_HEIGHT_RATIO = 0.04; // ブロックの高さ(縦幅,canvas高さの何割か）

// プレイエリアの上下境界（canvas高さに対する比率）
// SVG UI が入った時はここだけ調整する
const PLAY_AREA_TOP = 0.1; // 上端から10%はUI領域
const PLAY_AREA_BOTTOM = 0.9; // 下端から10%は操作しにくい領域

let canvas, ctx;
let touchedY = 0;
let rafId = null; // 正規化済みY座標（上=1, 下=0）

// RAFループ用
let lastPosition = 0; // 曲の開始を0とした再生時刻
let lastReceivedAt = 0; // ブラウザ起動を0とした壁時計時刻
let storedWordBlocks = [];
let effectsQueue = []; // game.js から渡されたブロック評価エフェクトPERFECT/GOOD/BADのキュー
let storedIsOnBeat = false; // 現フレームでブロックに正確に触れているか（game.js が判定）
let storedTouchNormalizedY = null; // 接触中ブロックのY座標
let judgmentX = 0; // onResize で更新

// canvasを生成してDOMに挿入する main側でinit呼び出し
export function initCanvas() {
  canvas = document.createElement("canvas");
  canvas.style.cssText = "position:fixed;top:0;left:0;z-index:2;pointer-events:auto;";
  document.body.appendChild(canvas);
  ctx = canvas.getContext("2d"); // 描画ツール

  function onResize() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    judgmentX = canvas.width * JUDGMENT_X_RATIO;
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
    rafId = requestAnimationFrame(canvasRenderLoop);
    // (前回の曲の再生位置ms) + (その後の経過時間ms)でポジション補完
    const estimatedPosition = lastPosition + (performance.now() - lastReceivedAt);
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    drawWordBlocks(estimatedPosition, storedWordBlocks);

    // エフェクト1: ブロックに正確に触れている間のフラッシュ
    if (storedIsOnBeat && storedTouchNormalizedY !== null) {
      particleSystem.spawnTouchingFlash(toPlayAreaCanvasY(storedTouchNormalizedY), judgmentX);
    }
    // エフェクト2: ブロック判定確定時の結果パーティクル
    for (const effect of effectsQueue) {
      particleSystem.spawnResult(toPlayAreaCanvasY(effect.normalizedY), effect.rating, judgmentX);
    }
    effectsQueue = [];

    particleSystem.update(ctx);
    // TODO: プレイヤーのカーソル/指の位置(touchedY)を描画
    // メモ: touchedYはこのスコープの範囲内なので誤ってmainからupdateCanvasStateに渡してくるみたいなことをしないように。
    // 現状pauseしても補完が回り続けるのでブロック描画が止まらないのでここも後々対応してね。
  }
  canvasRenderLoop();
}

export function stopCanvasLoop() {
  if (rafId) cancelAnimationFrame(rafId);
}

// 正規化済みのtouchedYを返す
export function getTouchedY() {
  return touchedY;
}

// touchedY をプレイエリア内（0-1）にクランプして返す
// keyboard.js など「エリア外を考慮しなくていいモジュール」向け
export function getPlayAreaY() {
  return Math.max(0, Math.min(1, touchedY));
}

// normalizedAmp(0-1) をプレイエリア内のcanvasピクセルY座標に変換する
// ブロック描画・パーティクル生成時に使う
function toPlayAreaCanvasY(normalizedAmp) {
  const range = PLAY_AREA_BOTTOM - PLAY_AREA_TOP;
  return (PLAY_AREA_TOP + (1 - normalizedAmp) * range) * canvas.height;
}

// canvasピクセルY座標をプレイエリア内の正規化座標（上=1, 下=0）に変換する
// touchedY の取得時に使う。プレイエリア外は0未満・1超えになる
export function toNormalizedY(canvasY) {
  const range = PLAY_AREA_BOTTOM - PLAY_AREA_TOP;
  return 1 - (canvasY / canvas.height - PLAY_AREA_TOP) / range;
}

// ワードブロックを描画する（drawFrame 内部からのみ呼ぶ）
function drawWordBlocks(position, wordBlocks) {
  const blockHeight = canvas.height * BLOCK_HEIGHT_RATIO;

  // ======== 判定ラインから右端までの矩形を書き込み可能な領域としてクリップ ======
  ctx.save();
  ctx.beginPath();
  ctx.rect(judgmentX, 0, canvas.width - judgmentX, canvas.height);
  ctx.clip();

  ctx.strokeStyle = "#20B2AA"; // 淵色
  ctx.fillStyle = "#17605b"; // 塗り
  ctx.lineWidth = 1.8;
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

    const blockPosY = toPlayAreaCanvasY(block.normalizedAmp) - blockHeight / 2;
    ctx.beginPath();
    ctx.roundRect(blockPosX, blockPosY, blockWidth, blockHeight, 4);
    ctx.fill();
    ctx.stroke();

    const textWidth = ctx.measureText(block.text).width;
    // 鬼ヒューリスティックでPIXELS_PER_MS = 0.65環境下,一単語duration60msくらいまでは入り切りそうだったので変更するときは要注意
    if (textWidth < blockWidth - 2) {
      ctx.fillStyle = "white";
      ctx.fillText(block.text, blockPosX + 4, blockPosY + blockHeight / 2);
      ctx.fillStyle = "#17605b"; // 次のブロックのために塗り色を戻す
    }
  }

  ctx.restore(); // クリップ解放
}

// onTimeUpdateから呼び、描画せず状態だけ保存する（描画はcanvasRenderLoopに集約）
export function updateCanvasState({
  position,
  wordBlocks,
  effects = [],
  isOnBeat = false,
  touchNormalizedY = null,
}) {
  lastPosition = position; // 曲の再生位置(ms)
  lastReceivedAt = performance.now(); // ブラウザ内でのグローバル到達時刻(ms)
  storedWordBlocks = wordBlocks; // 描画対象のブロック特定用
  effectsQueue.push(...effects); // renderLoop が消費するまでキューに積む
  storedIsOnBeat = isOnBeat ?? false; // 現フレームでブロックに正確に触れているか
  storedTouchNormalizedY = touchNormalizedY; // 接触中ブロックのY座標
}
