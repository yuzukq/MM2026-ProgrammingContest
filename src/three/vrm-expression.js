// vrm-expression.js
// VRM ブレンドシェイプを制御するヘルパー

let exprMgr = null;

// ── 口チャンネル ──
const MOUTH_KEYS = ["aa", "ih", "ou", "ee", "oh"];
const mouthWeights = { aa: 0, ih: 0, ou: 0, ee: 0, oh: 0 };
let mouthTarget = null; // "aa".."oh"(母音) | "_pak"(母音不明=口パク) | null(発声なし=口閉じ)
let pakPhase = 0;
const MOUTH_LERP = 0.3; // 口形の追従速度（0-1）
const MOUTH_OPEN = 0.7; // 母音時の開き
const PAK_SPEED = 9; // 口パク速度 [rad/s]
const PAK_OPEN = 0.5; // 口パクの開き

// ── 感情チャンネル ──
let emoteName = null;
let emoteElapsed = 0;
let emoteDuration = 0;
const EMOTE_PEAK = 0.85; // 感情ピーク weight

// ── public ──────────────────────────────

export function initExpression(vrm) {
  exprMgr = vrm.expressionManager ?? null;
}

// 口形のセットする
export function setMouthVowel(shape) {
  mouthTarget = shape;
}

// 一時表情を再生する
export function emote(name, ms) {
  emoteName = name;
  emoteDuration = ms;
  emoteElapsed = 0;
}

// 曲頭リセット（口閉じ・感情クリア）
export function resetExpression() {
  for (const k of MOUTH_KEYS) mouthWeights[k] = 0;
  mouthTarget = null;
  emoteName = null;
}

// weight を計算して setValue するだけ
export function update(delta) {
  if (!exprMgr) return;
  updateMouth(delta);
  updateEmote(delta);
}

// ── internal ────────────────────────────

function updateMouth(delta) {
  const targets = { aa: 0, ih: 0, ou: 0, ee: 0, oh: 0 };
  if (mouthTarget === "_pak") {
    pakPhase += delta * PAK_SPEED;
    targets.aa = (Math.sin(pakPhase) * 0.5 + 0.5) * PAK_OPEN; // 「あ」を揺らす素朴な口パク
  } else if (mouthTarget) {
    targets[mouthTarget] = MOUTH_OPEN; // 母音の口形を開く
  }
  // 各母音 weight を目標へ補間してセット
  for (const k of MOUTH_KEYS) {
    mouthWeights[k] += (targets[k] - mouthWeights[k]) * MOUTH_LERP;
    exprMgr.setValue(k, mouthWeights[k]);
  }
}

function updateEmote(delta) {
  if (!emoteName) return;
  emoteElapsed += delta * 1000;
  const t = Math.min(1, emoteElapsed / emoteDuration);
  exprMgr.setValue(emoteName, Math.sin(t * Math.PI) * EMOTE_PEAK); // 0→ピーク→0
  if (t >= 1) {
    exprMgr.setValue(emoteName, 0);
    emoteName = null;
  }
}
