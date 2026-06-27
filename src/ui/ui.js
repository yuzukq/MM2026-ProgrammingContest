// ui.js
// 画面上部: DAW ステータスUI（曲名・スコア表示・判定）
// 画面下部: プログレスバー（茎レイヤー常時表示＋開花レイヤーを progress でクリップ開花、先端に蝶）

import { inlineSvg } from "../inline-svg.js";

const TOP_UI_SRC = "/assets/topui.svg";
const TITLE_MAX_W = 1150;
const RATING_COLOR = { PERFECT: "#ce206e", GOOD: "#20ce3d", BAD: "#888888" };
const PROGRESS_STEM_SRC = "/assets/progressbar-stem.svg"; // 下レイヤー（茎）
const PROGRESS_BLOOM_SRC = "/assets/progressbar.svg"; // 上レイヤー（開花）
const PROGRESS_BUTTERFLY_SRC = "/assets/progressIndicator.svg"; // 蝶（先端）

let topUiEl = null; // 上部UIのラッパ（初回のみ構築）
let topTitleEl = null; // SVG <text id="title">
let topScoreEl = null; // SVG <text id="score">
let topRatingEl = null; // SVG <text id="rating">
let lastRatingSeq = 0; // 直近に pop した判定の seq（新しい判定ごとに pop。同値連続でも鳴る）
let ratingAnim = null; // 進行中の pop アニメ（連続変化時に積み重ねない）
let progressBarEl = null; // 下部バーのラッパ（初回のみ構築）
let bloomEl = null; // 開花レイヤー（clip-path を更新）
let butterflyEl = null; // 蝶（left を更新）

// ── public ──────────────────────────────

// LOADING 中素材読み込み
// オーバーレイ(z20)に隠れるので見た目への影響はなし
export function preloadUI() {
  if (!progressBarEl) buildProgressBar();
  if (!topUiEl) buildTopUI();
}

// 初回だけ DOM を構築し、毎回 progress を曲頭・曲名・スコアをリセットする
export function initUI(songTitle) {
  if (!progressBarEl) buildProgressBar();
  if (!topUiEl) buildTopUI();
  updateProgress(0);
  if (topScoreEl) topScoreEl.textContent = "Score: 0";
  if (topRatingEl) topRatingEl.textContent = "";
  lastRatingSeq = 0; // 新しい曲：seq がリセットされるので合わせる
  if (topTitleEl) {
    topTitleEl.textContent = songTitle ?? "";
    fitTopTitle();
  }
}

export function showUI() {
  if (topUiEl) topUiEl.style.display = "";
  if (progressBarEl) progressBarEl.style.display = "";
}

export function hideUI() {
  if (topUiEl) topUiEl.style.display = "none";
  if (progressBarEl) progressBarEl.style.display = "none";
}

// onTimeUpdate で毎フレーム：HUD一式を更新する。
export function updateUI({ score, rating, ratingSeq, progress }) {
  if (topScoreEl) topScoreEl.textContent = `Score: ${Math.floor(score)}`;
  // 「新しい判定が確定した瞬間」だけ差し替えて pop
  if (rating && ratingSeq !== lastRatingSeq && topRatingEl) {
    // 同値連続でも鳴る／毎フレームは鳴らさない
    lastRatingSeq = ratingSeq;
    topRatingEl.textContent = rating;
    topRatingEl.style.fill = RATING_COLOR[rating] ?? RATING_COLOR.BAD;
    popRating(topRatingEl);
  }
  updateProgress(progress);
}

// 判定テキストを「パッと跳ねる」ように1回再生する。
// WA-API の composite:"add" で scale だけを位置の上に重ねる
// https://developer.mozilla.org/ja/docs/Web/API/Web_Animations_API/
function popRating(el) {
  ratingAnim?.cancel(); // 連続変化時に scale を積み重ねない
  ratingAnim = el.animate(
    [
      { transform: "scale(0.4)" },
      { transform: "scale(1.25)", offset: 0.55 },
      { transform: "scale(1)" },
    ],
    { duration: 280, easing: "cubic-bezier(0.34, 1.56, 0.64, 1)", composite: "add" }
  );
}

// ── internal ────────────────────────────

async function buildTopUI() {
  topUiEl = document.createElement("div");
  topUiEl.id = "top-ui";
  topUiEl.style.display = "none";
  document.body.appendChild(topUiEl);
  const svgText = await fetch(TOP_UI_SRC).then((r) => r.text());
  const svgEl = inlineSvg(topUiEl, svgText);
  svgEl.setAttribute("preserveAspectRatio", "none");
  topTitleEl = svgEl.querySelector("#title");
  topTitleEl.setAttribute("text-anchor", "end");
  topScoreEl = svgEl.querySelector("#score");
  topRatingEl = svgEl.querySelector("#rating");
}

// 曲名が TITLE_MAX_W を超えていたらフォントを縮小して収める
function fitTopTitle() {
  if (!topTitleEl) return;
  topTitleEl.style.fontSize = "";
  const w = topTitleEl.getBBox().width;
  if (w > TITLE_MAX_W) {
    const base = parseFloat(getComputedStyle(topTitleEl).fontSize) || 0;
    if (base) topTitleEl.style.fontSize = `${(base * TITLE_MAX_W) / w}px`;
  }
}

// 下部プログレスバーを構築（茎・開花・蝶の3枚を重ねる）
function buildProgressBar() {
  progressBarEl = document.createElement("div");
  progressBarEl.id = "progress-bar";
  progressBarEl.style.display = "none";

  const stem = document.createElement("img");
  stem.className = "stem";
  stem.src = PROGRESS_STEM_SRC;
  stem.alt = "";

  bloomEl = document.createElement("img");
  bloomEl.className = "bloom";
  bloomEl.src = PROGRESS_BLOOM_SRC;
  bloomEl.alt = "";

  butterflyEl = document.createElement("img");
  butterflyEl.className = "butterfly";
  butterflyEl.src = PROGRESS_BUTTERFLY_SRC;
  butterflyEl.alt = "";

  progressBarEl.append(stem, bloomEl, butterflyEl);
  document.body.appendChild(progressBarEl);
}

// 進捗 ratio(0..1) で開花レイヤーをクリップし、先端の蝶を移動させる。
function updateProgress(ratio) {
  if (!bloomEl) return;
  const r = Math.max(0, Math.min(1, ratio || 0));
  bloomEl.style.clipPath = `inset(0 ${(1 - r) * 100}% 0 0)`; // 右側を隠す＝左→右に開花
  butterflyEl.style.left = `${r * 100}%`; // バー幅基準（CSS の translateX(-50%) で先端中央）
}
