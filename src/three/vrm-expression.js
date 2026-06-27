// vrm-expression.js
// VRM ブレンドシェイプを制御するヘルパー

let exprMgr = null;

// ── 口チャンネル ──
const MOUTH_KEYS = ["aa", "ih", "ou", "ee", "oh"];
const mouthWeights = { aa: 0, ih: 0, ou: 0, ee: 0, oh: 0 };
let mouthTarget = null; // "aa".."oh"(母音) | "_pak"(母音不明=口パク) | null(発声なし=口閉じ)
let pakPhase = 0;
const MOUTH_LERP = 0.2; // 口形の追従速度（0-1）
const MOUTH_OPEN = 0.7; // 母音時の開き
const PAK_SPEED = 5; // 口パク速度 [rad/s]
const PAK_OPEN = 1.0; // 口パクの開き

// 表情シェイプ制御 ──
let moodTarget = null; // 目標表情名（"kirakira"/"happy"/"neutral"/"hau" など）
const moodWeights = {};
const MOOD_LERP = 0.08; // 切替を補間
const MOOD_OPEN = 1.0; // 持続表情の強さ

// ── blink 周り ──
let blinkTimer = 0;
let nextBlinkAt = 0;
let blinkProgress = -1;
const BLINK_MIN = 4; // 瞬き間隔の下限[s]
const BLINK_MAX = 6; // 瞬き間隔の上限[s]
const BLINK_DUR = 0.12; // 1回の瞬き所要[s]

// ── public ──────────────────────────────

export function initExpression(vrm) {
  exprMgr = vrm.expressionManager ?? null;
  scheduleNextBlink();
}

// 口形のセットする
export function setMouthVowel(shape) {
  mouthTarget = shape;
  // ======================================================
  // console.log("母音のシェイプをセット", mouthTarget);
  // ======================================================
}

// 持続表情を切り替える
export function setMood(name) {
  moodTarget = name;
  if (name && !(name in moodWeights)) moodWeights[name] = 0; // 初出の表情を管理対象に追加
}

// 曲頭リセット（口閉じ・表情クリア）
export function resetExpression() {
  for (const k of MOUTH_KEYS) mouthWeights[k] = 0;
  mouthTarget = null;
  moodTarget = null;
  for (const k in moodWeights) moodWeights[k] = 0;
  blinkProgress = -1;
  scheduleNextBlink();
}

// weight を計算して setValue するだけ
export function update(delta) {
  if (!exprMgr) return;
  updateMouth(delta);
  updateMood();
  updateBlink(delta);
}

// ── internal ────────────────────────────

function updateMouth(delta) {
  const targets = { aa: 0, ih: 0, ou: 0, ee: 0, oh: 0 };
  if (mouthTarget === "_pak") {
    pakPhase += delta * PAK_SPEED;
    targets.aa = (Math.sin(pakPhase) * 0.5 + 0.5) * PAK_OPEN; // 「あ」を揺らす素朴な口パク
    //console.log(`口パク中`);
  } else if (mouthTarget) {
    targets[mouthTarget] = MOUTH_OPEN; // 母音の口形を開く
    // console.log(`口形変更: ${mouthTarget}`);
  }
  // 各母音 weight を目標へ補間してセット
  for (const k of MOUTH_KEYS) {
    mouthWeights[k] += (targets[k] - mouthWeights[k]) * MOUTH_LERP;
    exprMgr.setValue(k, mouthWeights[k]);
    // console.log(`シェイプ: ${k}, mouthWeights[k]: ${mouthWeights[k]}`);
  }
}

// 持続表情目標表情を 1 へ、他を 0 へ補間して setValue する
function updateMood() {
  for (const name in moodWeights) {
    const target = name === moodTarget ? MOOD_OPEN : 0;
    moodWeights[name] += (target - moodWeights[name]) * MOOD_LERP;
    exprMgr.setValue(name, moodWeights[name]);
  }
}

// 自動瞬き4-6秒のランダム間隔で blink を0→1→0
function updateBlink(delta) {
  // hauが出ている間は瞳が細められているので瞬きをスキップ
  if ((moodWeights.hau ?? 0) >= 0.9) {
    // 進行中の瞬きは中断して開いた状態（blink=0）へ戻す
    if (blinkProgress >= 0) {
      exprMgr.setValue("blink", 0);
      blinkProgress = -1;
      scheduleNextBlink();
    }
    return;
  }
  if (blinkProgress >= 0) {
    blinkProgress += delta / BLINK_DUR;
    if (blinkProgress >= 1) {
      exprMgr.setValue("blink", 0);
      blinkProgress = -1; // 瞬き終了
      scheduleNextBlink();
    } else {
      exprMgr.setValue("blink", Math.sin(blinkProgress * Math.PI)); // 0→1→0
    }
  } else {
    blinkTimer += delta;
    if (blinkTimer >= nextBlinkAt) blinkProgress = 0; // 瞬き開始
  }
}

function scheduleNextBlink() {
  blinkTimer = 0;
  nextBlinkAt = BLINK_MIN + Math.random() * (BLINK_MAX - BLINK_MIN);
}
