// ui.js
// プレイ中の HTML UI レイヤーを担当する。
//   - 画面上部: スコア / レーティング
//   - 画面下部: プログレスバー（進捗でフィル＋先端に蝶）
//
// 方針: selection.js と同じ「インラインSVGを fetch → 必要な箇所だけ JS で差し替え／更新」方式を取ります。
//   見た目は SVG 素材に持たせ、動く値（score / rating / 曲名 / バーのフィル / 蝶の位置など）だけ JS が触る。
//   詳しい手順は Notion「各種2D素材の引き込み方法」を参照。
//   URL:　https://app.notion.com/p/2D-37d1989ac26480ffafa6e37864a35a0b?source=copy_link
//
// ※ SVG 素材の到着待ちスケルトン。TODO を素材到着後に埋める形でいくが、レイヤー次第で変わるのでそこは柔軟に。
//   現状 updateUI は index.html の静的 span をそのまま更新しており、素材導入までは残している。

// 素材パス（public/assets/ に置く → /assets/ で配信される）
const TOP_UI_SVG_SRC = "/assets/top-ui.svg"; // TODO: 上部UI(score/rating)の実ファイル名に合わせる
const PROGRESS_SVG_SRC = "/assets/progress-bar.svg"; // TODO: 下部バー(フィル+蝶)の実ファイル名に合わせる

// SVG 内で JS が掴む要素の id（素材側の id に合わせる）
const SEL = {
  title: "#title", // 上部UIの曲名（曲開始時に main から渡る）
  score: "#score", // TODO: 素材の id に合わせる
  rating: "#rating",
  progressFill: "#progress-fill", // 進捗で伸びるフィル
  butterfly: "#butterfly", // フィル先端に乗る蝶
};

let topUiEl = null; // 上部UIのSVGを包むラッパ
let progressEl = null; // 下部バーのSVGを包むラッパ

// ── public ──────────────────────────────

// 曲開始時（main の PLAYING 遷移）に呼ぶ。初回だけ SVG を構築し、上部UIに曲名をセットする。
// fetch が非同期なので async（selection.initSelection が手本）。songTitle は main から渡る（currentSong.title）。
export async function initUI(songTitle) {
  // 初回だけ SVG を fetch して構築
  if (!topUiEl) {
    // TODO: 素材が来たら有効化。selection.js の initSelection / buildDOM と同じ構造。
    // const [topSvg, progressSvg] = await Promise.all([
    //   fetch(TOP_UI_SVG_SRC).then((r) => r.text()),
    //   fetch(PROGRESS_SVG_SRC).then((r) => r.text()),
    // ]);
    // topUiEl = mountSvg(topSvg, "ui-top");
    // progressEl = mountSvg(progressSvg, "ui-progress");
  }
  // 二回目のプレイ以降、曲名だけは変える必要があるので例外実装すること
  // TODO: topUiEl.querySelector(SEL.title).textContent = songTitle;
}

// onTimeUpdate で毎フレーム：HUD一式（score / rating / 進捗バー）を現在の状態で更新する。
export function updateUI({ score, rating, progress }) {
  // TODO: SVG 導入後は topUiEl.querySelector(SEL.score) などに切り替える。
  // ↓素材が乗ったらhtmlレイヤーへの直書きは不要なので消す: index.html の静的 span を更新
  document.querySelector("#score").textContent = `score: ${Math.floor(score)}`;
  if (rating) document.querySelector("#rating").textContent = rating;
  updateProgress(progress); // やっぱ内部メソッドを呼ぶ形で
}

// ── internal ────────────────────────────

// 進捗 ratio(0..1) でバーをフィルし、先端の蝶を移動させる（updateUI から毎フレーム委譲される）
function updateProgress(progressRa) {
  if (!progressEl) return; // 素材未導入のうちは何もしない
  // TODO: フィルの伸長＋蝶の移動を実装する。手法は Notion 参照。
}

// SVG文字列を <div> に入れて #ui 配下にマウントし、そのラッパを返す
// （selection.js は card.innerHTML = svg と同じ要領。今回は複数展開しないので id 衝突の心配はなし）
// function mountSvg(svgText, wrapperId) {
//   const el = document.createElement("div");
//   el.id = wrapperId;
//   el.innerHTML = svgText;
//   document.getElementById("ui").appendChild(el);
//   return el;
// }
