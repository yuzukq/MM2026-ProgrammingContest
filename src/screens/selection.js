// selection.js
// 選曲画面のカード表示・スクロール・選択確定を担当する
// 曲が確定したら onSongSelectedCallback(song) を呼び、main.js がローディングへ遷移する

import { SONGS } from "../data/songs.js";
import { inlineSvg } from "../inline-svg.js"; // インライン展開のヘルパー

const CARD_SVG_SRC = "/assets/selectcard.svg";
const CARD_STEP = 140; // 隣カードまでの縦オフセット(px)
const SCALE_STEP = 0.15; // 1段離れるごとのスケール減少量
const MIN_SCALE = 0.55; // スケールの下限
const SWIPE_THRESHOLD = 50; // スワイプ判定の最小移動量(px)
const WHEEL_COOLDOWN = 200; // ホイール連続スクロール抑制(ms)

let selectedIndex = 0;
let cardElements = [];
let screenEl = null;
let onSongSelectedCallback = null;

// ── public ──────────────────────────────

// main.js から await で呼ぶ。SVGフェッチが完了してからDOMを構築する
export async function initSelection(onSelected) {
  onSongSelectedCallback = onSelected;
  const res = await fetch(CARD_SVG_SRC);
  const svgTemplate = await res.text();
  buildDOM(svgTemplate);
  bindEvents();
}

export function showSelectionScreen() {
  refreshHighScores();
  screenEl.style.display = "flex";
}

export function hideSelectionScreen() {
  screenEl.style.display = "none";
}

// ── internal ────────────────────────────

function refreshHighScores() {
  cardElements.forEach((card, i) => {
    card.querySelector("#score").innerHTML =
      `<tspan x="0" y="0">HIGH SCORE</tspan><tspan x="0" dy="1.2em" font-size="34px" font-weight="bold">${getHighScore(SONGS[i].id)}</tspan>`;
  });
}

// ======== DOM構築 ========
function buildDOM(svgTemplate) {
  screenEl = document.createElement("div");
  screenEl.id = "selection-screen";

  const cardsContainer = document.createElement("div");
  cardsContainer.id = "selection-cards";

  SONGS.forEach((song, i) => {
    const card = document.createElement("div");
    card.className = "song-card";

    //  <style> をスコープ化してSVGテンプレートをカードに埋め込む
    const svg = inlineSvg(card, svgTemplate);

    // tspan分割して属性と値で改行
    svg.querySelector("#title").innerHTML =
      `<tspan x="0" y="0">SONG NAME</tspan><tspan x="0" dy="1.2em" font-size="34px" font-weight="bold">${song.title}</tspan>`;
    svg.querySelector("#artist").innerHTML =
      `<tspan x="0" y="0">ARTIST</tspan><tspan x="0" dy="1.2em" font-size="34px" font-weight="bold">${song.artist}</tspan>`;
    svg.querySelector("#score").innerHTML =
      `<tspan x="0" y="0">HIGH SCORE</tspan><tspan x="0" dy="1.2em" font-size="34px" font-weight="bold">${getHighScore(song.id)}</tspan>`;

    // image_holder の rect をジャケット画像に差し替え
    const holder = svg.querySelector("#image_holder");
    holder.innerHTML = `<image href="${song.jacket}" x="0" y="0" width="303.28" height="303.28" preserveAspectRatio="xMidYMid slice"/>`;

    card.addEventListener("click", () => {
      if (i === selectedIndex) {
        confirmSelection(); // フォーカス中のカードをタップ→確定
      } else {
        moveTo(i); // 別カードをタップ→フォーカス移動
      }
    });

    cardsContainer.appendChild(card);
    cardElements.push(card);
  });

  screenEl.appendChild(cardsContainer);
  document.body.appendChild(screenEl);
  updateCards(); // 初期配置を適用
}

// ======== イベント登録 ========
function bindEvents() {
  let touchStartY = 0;
  screenEl.addEventListener(
    "touchstart",
    (e) => {
      touchStartY = e.touches[0].clientY;
    },
    { passive: true }
  );
  screenEl.addEventListener(
    "touchend",
    (e) => {
      const delta = touchStartY - e.changedTouches[0].clientY;
      if (delta > SWIPE_THRESHOLD)
        move(1); // 上スワイプ → 次曲
      else if (delta < -SWIPE_THRESHOLD) move(-1); // 下スワイプ → 前曲
    },
    { passive: true }
  );

  // ホイールは連続スクロールを抑制して1段ずつ動かす
  let wheelCooldown = false;
  screenEl.addEventListener(
    "wheel",
    (e) => {
      e.preventDefault();
      if (wheelCooldown) return;
      wheelCooldown = true;
      setTimeout(() => (wheelCooldown = false), WHEEL_COOLDOWN);
      move(e.deltaY > 0 ? 1 : -1);
    },
    { passive: false }
  );

  // キーボード操作（デバッグ・PC操作用）
  window.addEventListener("keydown", (e) => {
    if (screenEl.style.display === "none") return;
    if (e.key === "ArrowDown") move(1);
    else if (e.key === "ArrowUp") move(-1);
    else if (e.key === "Enter") confirmSelection();
  });
}

// ======== 内部ロジック ========
function move(delta) {
  moveTo(selectedIndex + delta);
}

function moveTo(index) {
  selectedIndex = Math.max(0, Math.min(SONGS.length - 1, index));
  updateCards();
}

// 確定時にコールバックとして入れておいたmainのtransitionを呼び出す
// transition(STATE.LOADING, { song: SONGS[selectedIndex] });
function confirmSelection() {
  onSongSelectedCallback?.(SONGS[selectedIndex]);
}

// selectedIndex からの距離に応じてスケール・位置・透明度を更新する
function updateCards() {
  cardElements.forEach((card, i) => {
    const distance = i - selectedIndex;
    const scale = Math.max(MIN_SCALE, 1 - Math.abs(distance) * SCALE_STEP);
    card.style.transform = `translateY(${distance * CARD_STEP}px) scale(${scale})`;
    card.style.opacity = String(Math.max(0.4, scale));
  });
}

function getHighScore(songId) {
  const stored = localStorage.getItem(`highscore_${songId}`);
  return stored !== null ? Math.floor(Number(stored)) : "---";
}
