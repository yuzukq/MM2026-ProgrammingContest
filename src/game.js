// game.js
// ブロック生成やTextAlive のデータ処理とスコア計算，ゲームの内部ロジック周りを担当

import { LANE_COUNT, toLane, laneCenterY } from "./lane.js"; // レーンの量子化用

// 判定調整まわり
const POINTS_PER_BLOCK = () => maxScore / wordBlocks.length;
const LANE_TOLERANCE = { PERFECT: 1.5, GOOD: 2.5 }; // 平均レーン距離の許容値。±1.0レーンずれは PERFECT・±2は GOOD・超過はBAD
const RATING_MULTIPLIER = { PERFECT: 1.0, GOOD: 0.6, BAD: 0 }; // 精度ごとのスコア加算の重み

let wordBlocks = [];
let score = 0;
let maxScore = 0; // ブロック数確定後に設定（曲が変わっても理論最大値に収束させるため）

// ブロック単位の精度追跡
let activeBlock = null; // 現在判定中のブロック
let accumLaneDist = 0; // ブロックがアクティブな間の |playerLane - blockLane| の累積
let accumFrames = 0; // 累積フレーム数（平均算出に使う）

// 到着済みブロックの管理（startTime イベントの二重発火防止）
const hitBlockIds = new Set();

// canvas へ渡す演出のキュー
let pendingEffects = [];

// 歌詞ビルボード（lyric.js）へ渡す判定結果のキュー（rating のみ。spawn/退場は lyric が時刻から自前で決める）
// { type: "rating", phraseIndex, slotIndex, rating }
let pendingLyricEvents = [];
let phrases = []; // フレーズ単位のタイムライン {roster, startTime, endTime}。lyric への登録元

// VRMワンショットアニメーションのキュー
let pendingAnimEvents = [];

// 直近のレーティング（UI 表示用）
let latestRating = null;
let latestRatingSeq = 0; // 判定が確定するたびに++。同値連続(PERFECT→PERFECT)でも"新しい判定"を検知できる

// リザルト歌詞カード用：phraseRatings[phraseIndex][slotIndex] = "PERFECT"|"GOOD"|"BAD"
const phraseRatings = [];

// 『こたえて』のコーラス区間の1msダミーワードを除外する閾値
const CHORUS_NOISE_THRESHOLD = 50;

export function resetGame() {
  wordBlocks = [];
  score = 0;
  maxScore = 0;
  activeBlock = null;
  accumLaneDist = 0;
  accumFrames = 0;
  hitBlockIds.clear();
  pendingEffects = [];
  pendingLyricEvents = [];
  pendingAnimEvents = [];
  phrases = [];
  latestRating = null;
  latestRatingSeq = 0;
  phraseRatings.length = 0;
}

// 声量ブロックを事前構築 main側からonVideoReady1回呼ぶ
// 毎フレーム getVocalAmplitude を呼ぶと波形がぶれるため、単語の先頭時刻で固定
export function buildWordBlocks(player) {
  // フレーズ→単語の順に走査し、各ブロックに phraseIndex / slotIndex を貼る
  let phrase = player.video.firstPhrase;
  let phraseIndex = 0;

  while (phrase) {
    const roster = []; // このフレーズで採用された単語テキスト
    let word = phrase.firstWord;
    // 単語ブロックの形成，1フレーズごとに属する単語のロースター格納していく
    while (word) {
      // 「こたえて」のコーラス部分だけは除外
      if (word.endTime - word.startTime >= CHORUS_NOISE_THRESHOLD) {
        wordBlocks.push({
          startTime: word.startTime,
          endTime: word.endTime,
          text: word.text,
          rawAmp: player.getVocalAmplitude(word.startTime),
          phraseIndex,
          slotIndex: roster.length, // フレーズ内での位置＝現在の配列長
        });
        roster.push(word.text);
      }
      if (word === phrase.lastWord) break;
      word = word.next;
    }
    // startTime〜endTimeで五線譜の入退場を行う
    phrases.push({ roster, startTime: phrase.startTime, endTime: phrase.endTime });
    phrase = phrase.next;
    phraseIndex++;
  }

  // ブロック内の声量 min/max で 0-1 にストレッチしてからレーンへ量子化する
  let min = Infinity;
  let max = -Infinity;
  for (const b of wordBlocks) {
    if (b.rawAmp < min) min = b.rawAmp; // 各単語startTimeでの最小声量
    if (b.rawAmp > max) max = b.rawAmp; // 各単語startTimeでの最大声量
  }
  const range = max - min || 1; // 全単語同声量（または0件）の保険
  for (const b of wordBlocks) {
    const stretched = (b.rawAmp - min) / range;
    b.lane = toLane(stretched); // 判定で使うレーン番号
    b.laneY = laneCenterY(b.lane); // 描画で使うレーン中心Y(0-1)
  }

  maxScore = wordBlocks.length * RATING_MULTIPLIER.PERFECT; // 全ブロック PERFECT 時の理論最大値
}

// onTimeUpdate で毎フレーム呼ぶ
export function updateGame(position, touchedY) {
  // 再生位置にかかってるブロックを探す（見つからない場合は null に統一）
  const block = wordBlocks.find((b) => b.startTime <= position && position < b.endTime) ?? null;
  const playerLane = toLane(touchedY); // タッチ位置のレーン

  // アクティブブロックが切り替わった（前ブロック終了 or ブロックなし区間に入った）タイミングの検出
  if (activeBlock !== null && activeBlock !== block) {
    const avgLaneDist = accumFrames > 0 ? accumLaneDist / accumFrames : LANE_COUNT; // ゼロ除算防止

    let rating = "BAD";
    if (avgLaneDist <= LANE_TOLERANCE.PERFECT) rating = "PERFECT";
    else if (avgLaneDist <= LANE_TOLERANCE.GOOD) rating = "GOOD";

    score += POINTS_PER_BLOCK() * RATING_MULTIPLIER[rating];
    latestRating = rating;
    latestRatingSeq++; // 判定確定 → seq を進める（UI の pop トリガー）
    // リザルト歌詞カード用に該当単語の判定を記録（phraseIndex / slotIndex で歌詞へ復元）
    (phraseRatings[activeBlock.phraseIndex] ??= [])[activeBlock.slotIndex] = rating;

    const pi = activeBlock.phraseIndex;
    const phraseLen = phrases[pi]?.roster.length ?? 0;
    // フレーズ最後の単語が確定したとき
    if (phraseLen > 0 && activeBlock.slotIndex === phraseLen - 1) {
      const perfectCount = phraseRatings[pi].filter((r) => r === "PERFECT").length;
      // フレーズ全単語が PERFECT なら VRM ワンショットを要求
      if (perfectCount === phraseLen) pendingAnimEvents.push({ type: "perfectPhrase" });
    }
    pendingEffects.push({ normalizedY: activeBlock.laneY, rating });
    // 歌詞ビルボードへ判定確定を通知（該当スロットの不透明度が上がる）
    pendingLyricEvents.push({
      type: "rating",
      phraseIndex: activeBlock.phraseIndex,
      slotIndex: activeBlock.slotIndex,
      rating,
    });

    // 次のブロックに備えてリセット
    accumLaneDist = 0;
    accumFrames = 0;
  }

  // 切り替わりなく続投なら続投
  activeBlock = block;

  if (block) {
    // ブロック到着イベント（startTime が判定ラインに乗った初回のみ）
    if (!hitBlockIds.has(block.startTime)) {
      hitBlockIds.add(block.startTime);
    }

    const laneDist = Math.abs(playerLane - block.lane); // 同じレーンなら 0
    accumLaneDist += laneDist;
    accumFrames++;
    return {
      isOnBeat: laneDist <= 1, // 同じ or 隣レーンに居る間はタッチフラッシュ
      normalizedY: block.laneY,
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

// 歌詞ビルボード（lyric.js）が消費する rating イベントを取り出す
export function popLyricEvents() {
  const events = pendingLyricEvents;
  pendingLyricEvents = [];
  return events;
}

// VRMワンショットアニメの要求を取り出す（scene 経由で animator が再生）
export function popAnimEvents() {
  const events = pendingAnimEvents;
  pendingAnimEvents = [];
  return events;
}

// 歌詞ビルボード（lyric.js）へ video-ready 時に1回渡すフレーズ単位のタイムライン
export function getLyricTimeline() {
  return phrases.map((p) => ({ startTime: p.startTime, endTime: p.endTime, words: p.roster }));
}

export function getWordBlocks() {
  return wordBlocks;
}

// リザルト歌詞カード用：全フレーズの全単語と、その単語が取れたか(rating)を結合して返す。
// rating は "PERFECT"|"GOOD"|"BAD"、未判定（曲終了時にアクティブ等）は null。空フレーズは除外。
export function getCollectedLyrics() {
  return phrases
    .map((p, phraseIndex) => ({
      words: p.roster.map((text, slotIndex) => ({
        text,
        rating: phraseRatings[phraseIndex]?.[slotIndex] ?? null,
      })),
    }))
    .filter((p) => p.words.length > 0);
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
export function getLatestRatingSeq() {
  return latestRatingSeq;
}
