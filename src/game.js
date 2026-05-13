// game.js
// TextAlive のデータ処理とスコア計算を担当する。描画は持たない。

let wordBlocks = [];
let maxAmp = 1;
let score = 0;
let maxScore = 0; // ブロック数確定後に設定（曲が変わっても理論最大値に収束させるため）

// ブロック単位の精度追跡
let activeBlock = null; // 現在判定中のブロック
let accumAccuracy = 0; // ブロックがアクティブな間の (1-distance) の累積
let accumFrames = 0; // 累積フレーム数（平均算出に使う）

// 到着済みブロックの管理（startTime イベントの二重発火防止）
const hitBlockIds = new Set();

// canvas へ渡す演出イベントのキュー
let pendingEffects = [];

const POINTS_PER_BLOCK = () => maxScore / wordBlocks.length;
const RATING_THRESHOLDS = { PERFECT: 0.95, GOOD: 0.7 };
const RATING_MULTIPLIER = { PERFECT: 1.0, GOOD: 0.6, BAD: 0 };

// 直近のレーティング（UI 表示用）
let latestRating = null;

// 声量ブロックを事前構築 main側からonVideoReady1回呼ぶ
// （毎フレーム getVocalAmplitude を呼ぶと波形がぶれるため、単語の先頭時刻で固定する）
export function buildWordBlocks(player) {
  maxAmp = player.getMaxVocalAmplitude() || 1;
  let word = player.video.firstWord;
  while (word) {
    wordBlocks.push({
      startTime: word.startTime, // 単語開始時刻
      endTime: word.endTime, // 単語終了時刻
      text: word.text, // 単語の文字列
      normalizedAmp: player.getVocalAmplitude(word.startTime) / maxAmp, // 単語開始時の声量(1単語を声量ブロックの変化の区切りとするため)
    });
    word = word.next;
  }
  maxScore = wordBlocks.length * RATING_MULTIPLIER.PERFECT; // 全ブロック PERFECT 時の理論最大値
}

// onTimeUpdate で毎フレーム呼ぶ
export function updateGame(position, touchedY) {
  // 再生位置にかかってるブロックを探す（見つからない場合は null に統一）
  const block = wordBlocks.find((b) => b.startTime <= position && position < b.endTime) ?? null;

  // アクティブブロックが切り替わった（前ブロック終了 or ブロックなし区間に入った）タイミングの検出
  if (activeBlock !== null && activeBlock !== block) {
    const avgAccuracy = accumFrames > 0 ? accumAccuracy / accumFrames : 0; // ゼロ除算防止

    let rating = "BAD";
    if (avgAccuracy >= RATING_THRESHOLDS.PERFECT) rating = "PERFECT";
    else if (avgAccuracy >= RATING_THRESHOLDS.GOOD) rating = "GOOD";

    score += POINTS_PER_BLOCK() * RATING_MULTIPLIER[rating];
    latestRating = rating;
    pendingEffects.push({ normalizedY: activeBlock.normalizedAmp, rating });

    // 次のブロックに備えてリセット
    accumAccuracy = 0;
    accumFrames = 0;
  }

  // 切り替わりなく続投なら続投
  activeBlock = block;

  if (block) {
    // ブロック到着イベント（startTime が判定ラインに乗った初回のみ）
    if (!hitBlockIds.has(block.startTime)) {
      hitBlockIds.add(block.startTime);
      // TODO: 到着エフェクト（startTime 通過時の演出）
    }

    const distance = Math.abs(touchedY - block.normalizedAmp);
    accumAccuracy += 1 - distance; // 1=ピッタリ, 0=最大ズレ
    accumFrames++;
  }
}

// =====ゲッターメソッド系=====
// canvas.js の renderLoop が毎フレーム呼んでエフェクトを消費する
export function popPendingEffects() {
  const effects = [...pendingEffects];
  pendingEffects = [];
  return effects;
}

export function getWordBlocks() {
  return wordBlocks;
}
export function getScore() {
  return score;
}
export function getMaxScore() {
  return maxScore;
}
export function getLatestRating() {
  return latestRating;
}
