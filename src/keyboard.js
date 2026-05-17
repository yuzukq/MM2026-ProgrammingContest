// keyboard.js
// インラインSVG鍵盤の初期化・タッチハイライト更新を担当する

import { getTouchedY } from "./canvas.js";

const KEY_COUNT = 12;
const HIGHLIGHT_COLOR = "#20B2AA";

let svgEl = null;
let lastKeyIndex = -1;

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
    // touchedY（0-1）を12分割して対応するキーインデックス（0-11）に変換
    const rawIndex = Math.floor(getTouchedY() * KEY_COUNT);
    // プレイエリア外（touchedYが0未満・1超え）でも0-11に収まるようクランプ
    const keyIndex = Math.max(0, Math.min(KEY_COUNT - 1, rawIndex));
    if (keyIndex === lastKeyIndex) return; // 変化がなければDOM操作をスキップ
    resetKey(lastKeyIndex);
    highlightKey(keyIndex);
    lastKeyIndex = keyIndex; // 現ループのキーindexを保存
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
