// game.js
// ブロック生成やTextAlive のデータ処理とスコア計算，ゲームの内部ロジック周りを担当

// 判定調整まわり
const POINTS_PER_BLOCK = () => maxScore / wordBlocks.length;
const RATING_THRESHOLDS = { PERFECT: 0.95, GOOD: 0.8 }; // GOODの値以下はBAD
const RATING_MULTIPLIER = { PERFECT: 1.0, GOOD: 0.6, BAD: 0 }; // 精度ごとのスコア加算の重み

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

// canvas へ渡す演出のキュー
let pendingEffects = [];

// 直近のレーティング（UI 表示用）
let latestRating = null;

// 判定カウンタ
const ratingCounts = { PERFECT: 0, GOOD: 0, BAD: 0 };

// 『こたえて』のコーラス区間の1msダミーワードを除外する閾値
const CHORUS_NOISE_THRESHOLD = 50;

export function resetGame() {
  wordBlocks = [];
  score = 0;
  maxScore = 0;
  activeBlock = null;
  accumAccuracy = 0;
  accumFrames = 0;
  hitBlockIds.clear();
  pendingEffects = [];
  latestRating = null;
  ratingCounts.PERFECT = 0;
  ratingCounts.GOOD = 0;
  ratingCounts.BAD = 0;
}

// 声量ブロックを事前構築 main側からonVideoReady1回呼ぶ
// 毎フレーム getVocalAmplitude を呼ぶと波形がぶれるため、単語の先頭時刻で固定
export function buildWordBlocks(player) {
  maxAmp = player.getMaxVocalAmplitude() || 1;
  let word = player.video.firstWord;
  while (word) {
    if (word.endTime - word.startTime >= CHORUS_NOISE_THRESHOLD) {
      wordBlocks.push({
        startTime: word.startTime,
        endTime: word.endTime,
        text: word.text,
        normalizedAmp: player.getVocalAmplitude(word.startTime) / maxAmp,
      });
    }
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
    ratingCounts[rating]++;
    // ========デバッグ用=========
    console.log("Rating counts:", { ...ratingCounts });
    pendingEffects.push({ normalizedY: activeBlock.normalizedAmp, rating });
    // ==========================

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
    }

    const distance = Math.abs(touchedY - block.normalizedAmp);
    const frameAccuracy = 1 - distance; // 1=ピッタリ, 0=最大ズレ
    accumAccuracy += frameAccuracy;
    accumFrames++;
    return {
      isOnBeat: frameAccuracy >= RATING_THRESHOLDS.PERFECT,
      normalizedY: block.normalizedAmp,
    };
  }
  return { isOnBeat: false, normalizedY: null };
}

// ==========ゲッターメソッド系========
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
export function getRatingCounts() {
  return { ...ratingCounts };
}
