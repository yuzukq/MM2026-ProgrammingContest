// keyboard.js
// インラインSVG鍵盤の初期化・タッチハイライト更新を担当する
// main.js 経由では 20fpsに制限されうるので鍵盤ハイライトは別途RAFループ60fpsを使う

import * as canvas from "../canvas/canvas.js";
import { LANE_COUNT, toLane } from "../lane.js"; // gameで使うレーン量子化を共有する

const HIGHLIGHT_COLOR = "#20B2AA";
// キー内の高さがこの割合ぶん境界に寄っていたら、近い側の隣接キーも点灯（指の太さ対策で直感性UP）
const BOUNDARY_THRESHOLD = 0.4;

let svgEl = null;
let lastKeyIndex = -1;
let lastNeighborIndex = -1; // 前フレームで隣接点灯したキー（なければ-1）

// ── public ──────────────────────────────

export function showKeyboard() {
  document.getElementById("keyboard-wrapper")?.style.setProperty("display", "");
}

export function hideKeyboard() {
  document.getElementById("keyboard-wrapper")?.style.setProperty("display", "none");
}

export async function initKeyboard() {
  // SVGファイルをテキストとして取得
  const res = await fetch("/assets/keyboard.svg");
  const svgText = await res.text();

  // 取得したSVGをDOMに直接埋め込み
  const wrapper = document.createElement("div");
  wrapper.id = "keyboard-wrapper";
  wrapper.innerHTML = svgText;
  document.body.appendChild(wrapper);
  svgEl = wrapper.querySelector("svg");
  // デフォルトのアスペクト比維持を無効化しコンテナいっぱいに引き伸ばす
  svgEl.setAttribute("preserveAspectRatio", "none");

  // ===============描画更新ループ==================
  function keyboardRenderLoop() {
    requestAnimationFrame(keyboardRenderLoop);
    if (!svgEl) return;

    // タッチ位置(0-1)を判定と同じ量子化でレーン化＝光らせるキーのindex
    const y = canvas.getPlayAreaY();
    const keyIndex = toLane(y);
    const fraction = y * LANE_COUNT - Math.floor(y * LANE_COUNT); // キー内の高さ(0-1)

    // 境界に寄っている側の隣接キーを点灯（キー高さの BOUNDARY_THRESHOLD 以内）
    let neighborIndex = -1;
    if (fraction > 1 - BOUNDARY_THRESHOLD && keyIndex < LANE_COUNT - 1) {
      neighborIndex = keyIndex + 1; // 上の隣
    } else if (fraction < BOUNDARY_THRESHOLD && keyIndex > 0) {
      neighborIndex = keyIndex - 1; // 下の隣
    }

    if (keyIndex === lastKeyIndex && neighborIndex === lastNeighborIndex) return;

    // 前フレームのハイライトをリセットして新しいキー＋隣接を点灯
    resetKey(lastKeyIndex);
    resetKey(lastNeighborIndex);
    highlightKey(keyIndex);
    if (neighborIndex !== -1) highlightKey(neighborIndex);

    lastKeyIndex = keyIndex;
    lastNeighborIndex = neighborIndex;
  }
  keyboardRenderLoop();
}

// ── internal ────────────────────────────

// SVGの #white グループ内から指定インデックスの rect 要素を返す
function getKeyRect(index) {
  return svgEl.querySelector(`#white [data-name="${index}"] rect`);
}

// キーの色をデフォルトに戻す
function resetKey(index) {
  getKeyRect(index)?.removeAttribute("style");
}

// キーをハイライト色に変える
function highlightKey(index) {
  getKeyRect(index)?.setAttribute("style", `fill: ${HIGHLIGHT_COLOR}`);
}
