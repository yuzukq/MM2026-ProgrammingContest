// vowel.js
// 文字 → 母音口形（VRM表情プリセット aa/ih/ou/ee/oh）を引く純関数
//
// 経路: かな（コード内テーブル）/ 漢字（vowel-map.json）→ 母音字(a/i/u/e/o) → VRM の口プリセット名
// 引けない文字（記号・促音・撥音・英字など）は null で返し呼び出し側でフォールバックする

import KANJI_VOWEL from "./data/vowel-map.json";

// 母音字 → VRM 標準表情プリセット名
const VOWEL_SHAPE = { a: "aa", i: "ih", u: "ou", e: "ee", o: "oh" };

// かな（ひらがな＋カタカナ・濁音/半濁音/小書き）→ 母音字。段ごとに文字を列挙して Map 化。
const VOWEL_GROUPS = {
  a: "あかさたなはまやらわがざだばぱぁゃアカサタナハマヤラワガザダバパァャ",
  i: "いきしちにひみりぎじぢびぴぃイキシチニヒミリギジヂビピィ",
  u: "うくすつぬふむゆるぐずづぶぷぅゅゔウクスツヌフムユルグズヅブプゥュヴ",
  e: "えけせてねへめれげぜでべぺぇエケセテネヘメレゲゼデベペェ",
  o: "おこそとのほもよろをごぞどぼぽぉょオコソトノホモヨロヲゴゾドボポォョ",
};
const KANA_VOWEL = new Map();
for (const [vowel, chars] of Object.entries(VOWEL_GROUPS)) {
  for (const ch of chars) KANA_VOWEL.set(ch, vowel);
}

// 文字列の先頭文字から口形プリセット名を返す。引けなければ nullでフォールバックする
// char.text は基本1文字、複数でも先頭の母音を代表として採用する
export function vowelOf(text) {
  if (!text) return null;
  const ch = text[0];
  const vowel = KANA_VOWEL.get(ch) ?? KANJI_VOWEL[ch] ?? null;
  return vowel ? VOWEL_SHAPE[vowel] : null;
}
