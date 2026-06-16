// keyboard.js
// インラインSVG鍵盤の初期化・タッチハイライト更新を担当する
// main.js 経由では 20fpsに制限されうるので鍵盤ハイライトは別途RAFループ60fpsを使う

import * as canvas from "../canvas/canvas.js";

const KEY_COUNT = 24;
const HIGHLIGHT_COLOR = "#20B2AA";

let svgEl = null;
let lastKeyIndex = -1;

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

    // プレイエリア内（0-1）を KEY_COUNT 分割して、触れているキーのindexを計算
    const keyIndex = Math.min(KEY_COUNT - 1, Math.floor(canvas.getPlayAreaY() * KEY_COUNT));

    if (keyIndex === lastKeyIndex) return;

    // 前フレームのハイライトをリセットして新しいキーを点灯
    resetKey(lastKeyIndex);
    highlightKey(keyIndex);

    lastKeyIndex = keyIndex;
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
