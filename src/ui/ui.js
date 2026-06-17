// ui.js
// プレイ中の HTML UI レイヤーを担当する。
//   - 画面上部: スコア / レーティング（現状は index.html の静的 span を更新。top-ui 素材は未到着）
//   - 画面下部: プログレスバー（茎レイヤー常時表示＋開花レイヤーを progress でクリップ開花、先端に蝶）

// 素材パス（public/assets/ に置く → /assets/ で配信）
const PROGRESS_STEM_SRC = "/assets/progressbar-stem.svg"; // 下レイヤー（茎）
const PROGRESS_BLOOM_SRC = "/assets/progressbar.svg"; // 上レイヤー（開花）
const PROGRESS_BUTTERFLY_SRC = "/assets/progressIndicator.svg"; // 蝶（先端）

let progressBarEl = null; // 下部バーのラッパ（初回のみ構築）
let bloomEl = null; // 開花レイヤー（clip-path を更新）
let butterflyEl = null; // 蝶（left を更新）

// ── public ──────────────────────────────

// LOADING 中素材読み込み
// オーバーレイ(z20)に隠れるので見た目への影響はなし
export function preloadUI() {
  if (!progressBarEl) buildProgressBar();
}

// 初回だけ DOM を構築し、毎回 progress を曲頭にリセットする
export function initUI(songTitle) {
  if (!progressBarEl) buildProgressBar(); // preloadUI で構築済みならスキップ
  updateProgress(0); // 新しい曲の頭にリセット
  // TODO: top-ui 素材到着後に曲名(songTitle)をセット。現状は index.html に title 要素なし。
}

// onTimeUpdate で毎フレーム：HUD一式（score / rating / 進捗バー）を更新する。
export function updateUI({ score, rating, progress }) {
  // top-ui 素材未導入のうちは index.html の静的 span を直接更新
  document.querySelector("#score").textContent = `score: ${Math.floor(score)}`;
  if (rating) document.querySelector("#rating").textContent = rating;
  updateProgress(progress);
}

// ── internal ────────────────────────────

// 下部プログレスバーを構築（茎・開花・蝶の3枚を重ねる）
function buildProgressBar() {
  progressBarEl = document.createElement("div");
  progressBarEl.id = "progress-bar";

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
