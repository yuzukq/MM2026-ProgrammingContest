// game.js
// TextAlive のデータ処理とスコア計算を担当する。描画は持たない。

let wordBlocks = [];
let maxAmp = 1;
let score = 0;

// 声量ブロックを事前構築 main側からonVideoReady1ど呼ぶ
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
}

// スコア加算 onTimeUpdate で毎フレーム呼ぶ
export function updateGame(position, touchedY) {
  // 今の再生位置にかかっている単語ブロックを探す
  const block = wordBlocks.find((b) => b.startTime <= position && position < b.endTime);
  if (block) {
    const distance = Math.abs(touchedY - block.normalizedAmp); // 0=ピッタリ, 1=最大ズレ
    score += 1 - distance; // 近いほど加点
  }
  // ブロックの外（無音区間）は block が見つからないので加点なし
}

export function getWordBlocks() {
  return wordBlocks;
}

export function getNormalizedScore() {
  return score; // 正規化は別途検討(notion 7-5参照)
}
