// keyboard.js
// インラインSVG鍵盤の初期化・タッチハイライト更新を担当する
// タッチ入力の起点は canvas.js のため、main.js を経由せず直接 getPlayAreaY を参照する
// （main.js 経由では 20fpsに制限されうるので鍵盤ハイライトは RAFループ60fps の応答性を重視）

import { getPlayAreaY } from "./canvas.js";

const KEY_COUNT = 12;
const HIGHLIGHT_COLOR = "#20B2AA";
// キー幅に対する割合。この値以内なら隣接キーも点灯させる
const BOUNDARY_THRESHOLD = 0.35;

let svgEl = null;
let lastKeyIndex = -1;
let lastNeighborIndex = -1; // 前フレームで隣接ハイライトしたキー（なければ-1）

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

  // プレイエリア下部に鍵盤をリピート配置
  const bg = document.createElement("div");
  bg.id = "keyboard-bg";
  document.body.appendChild(bg);

  // ===============描画更新ループ==================
  function loop() {
    requestAnimationFrame(loop);
    if (!svgEl) return;

    // プレイエリア内（0-1）を12分割
    const exactPos = getPlayAreaY() * KEY_COUNT;
    // 少数切り捨ててメインのindexを計算
    const keyIndex = Math.min(KEY_COUNT - 1, Math.floor(exactPos));
    const fraction = exactPos - Math.floor(exactPos); // 少数部: キーの中での高さ

    // 境界に近い側の隣接キーを計算（キー幅の BOUNDARY_THRESHOLD 以内なら点灯）
    let neighborIndex = -1;
    if (fraction > 1 - BOUNDARY_THRESHOLD && keyIndex < KEY_COUNT - 1) {
      neighborIndex = keyIndex + 1; // 上の隣
    } else if (fraction < BOUNDARY_THRESHOLD && keyIndex > 0) {
      neighborIndex = keyIndex - 1; // 下の隣
    }

    if (keyIndex === lastKeyIndex && neighborIndex === lastNeighborIndex) return;

    // 前フレームのハイライトをリセット
    resetKey(lastKeyIndex);
    resetKey(lastNeighborIndex);

    // 新しいハイライトを適用
    highlightKey(keyIndex);
    if (neighborIndex !== -1) highlightKey(neighborIndex);

    lastKeyIndex = keyIndex;
    lastNeighborIndex = neighborIndex;
  }
  loop();
}

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
