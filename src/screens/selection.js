// selection.js
// 選曲画面のカード表示・スクロール・選択確定を担当する
// 曲が確定したら onSongSelectedCallback(song) を呼び、main.js がローディングへ遷移する

import { SONGS } from "../data/songs.js";
import { inlineSvg } from "../inline-svg.js"; // インライン展開のヘルパー

const CARD_SVG_SRC = "/assets/selectcard.svg";
const TOP_UI_SRC = "/assets/topui.svg";
const CARD_STEP = 170; // 隣カードまでの縦オフセット(px)
const SELECTED_SCALE = 1.3; // 選択状態のカードスケール
const SWIPE_THRESHOLD = 10; // スワイプ判定の最小移動量(px)
const WHEEL_COOLDOWN = 300; // ホイール連続スクロール抑制(ms)

let selectedIndex = 0;
let cardElements = [];
let screenEl = null;
let cardsContainerEl = null;
let selTopUiEl = null;
let selTopScoreEl = null;
let selTopTitleEl = null;
let onSongSelectedCallback = null;

// ── public ──────────────────────────────

// main.js から await で呼ぶ。
// SVG フェッチが完了してから DOM を構築する
export async function initSelection(onSelected) {
  onSongSelectedCallback = onSelected;
  const [cardSvg, topUiSvg] = await Promise.all([
    fetch(CARD_SVG_SRC).then((r) => r.text()),
    fetch(TOP_UI_SRC).then((r) => r.text()),
  ]);
  buildDOM(cardSvg);
  buildSelectionTopUI(topUiSvg);
  bindEvents();
}

export function showSelectionScreen() {
  updateSelectionTopUI();
  screenEl.style.display = "flex";

  // カードを左からスライドイン
  cardsContainerEl.style.transition = "none";
  cardsContainerEl.style.transform = "translateX(-620px)";
  void cardsContainerEl.offsetWidth;
  cardsContainerEl.style.transition = "transform 0.45s cubic-bezier(0.25, 0.46, 0.45, 0.94)";
  cardsContainerEl.style.transform = "translateX(0)";

  // 上部バーを上からスライドイン
  selTopUiEl.style.transition = "none";
  selTopUiEl.style.transform = "translateY(-10vh)";
  void selTopUiEl.offsetWidth;
  selTopUiEl.style.transition = "transform 0.4s cubic-bezier(0.25, 0.46, 0.45, 0.94)";
  selTopUiEl.style.transform = "translateY(0)";
}

export function hideSelectionScreen() {
  screenEl.style.display = "none";
}

// ── internal ────────────────────────────

function updateSelectionTopUI() {
  if (!selTopScoreEl || !selTopTitleEl) return;
  const song = SONGS[selectedIndex];
  selTopScoreEl.textContent = `HighScore: ${getHighScore(song.id)}`;
  selTopTitleEl.textContent = song.title;
}

// ======== DOM構築 ========

function buildSelectionTopUI(svgText) {
  selTopUiEl = document.createElement("div");
  selTopUiEl.id = "selection-top-ui";

  const svgEl = inlineSvg(selTopUiEl, svgText);
  svgEl.setAttribute("preserveAspectRatio", "none");

  // rating は静的テキスト
  const ratingEl = svgEl.querySelector("#rating");
  if (ratingEl) ratingEl.textContent = "Track selection";

  // score・title は動的更新用に参照を保持
  selTopScoreEl = svgEl.querySelector("#score");
  selTopTitleEl = svgEl.querySelector("#title");
  if (selTopTitleEl) selTopTitleEl.setAttribute("text-anchor", "end");

  screenEl.appendChild(selTopUiEl);
}

function buildDOM(svgTemplate) {
  screenEl = document.createElement("div");
  screenEl.id = "selection-screen";

  cardsContainerEl = document.createElement("div");
  cardsContainerEl.id = "selection-cards";

  SONGS.forEach((song, i) => {
    const card = document.createElement("div");
    card.className = "song-card";

    //  <style> をスコープ化してSVGテンプレートをカードに埋め込む
    const svg = inlineSvg(card, svgTemplate);

    svg.querySelector("#title").innerHTML =
      `<tspan x="0" y="0">SONG NAME</tspan><tspan x="0" dy="1.2em" font-size="34px" font-weight="bold">${song.title}</tspan>`;
    svg.querySelector("#artist").innerHTML =
      `<tspan x="0" y="0">ARTIST</tspan><tspan x="0" dy="1.2em" font-size="34px" font-weight="bold">${song.artist}</tspan>`;
    svg.querySelector("#score").innerHTML =
      `<tspan x="0" y="0">HIGH SCORE</tspan><tspan x="0" dy="1.2em" font-size="34px" font-weight="bold">${getHighScore(song.id)}</tspan>`;

    const holder = svg.querySelector("#image_holder");
    holder.innerHTML = `<image href="${song.jacket}" x="0" y="0" width="303.28" height="303.28" preserveAspectRatio="xMidYMid slice"/>`;

    card.addEventListener("click", () => {
      if (i === selectedIndex) {
        confirmSelection();
      } else {
        moveTo(i);
      }
    });

    cardsContainerEl.appendChild(card);
    cardElements.push(card);
  });

  screenEl.appendChild(cardsContainerEl);
  document.body.appendChild(screenEl);
  updateCards();
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
      if (delta > SWIPE_THRESHOLD) move(1);
      else if (delta < -SWIPE_THRESHOLD) move(-1);
    },
    { passive: true }
  );

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
  const n = SONGS.length;
  selectedIndex = ((index % n) + n) % n; // 循環インデックス
  updateCards();
  updateSelectionTopUI();
}

function confirmSelection() {
  onSongSelectedCallback?.(SONGS[selectedIndex]);
}

// 循環距離に基づいてスケールを更新する
function updateCards() {
  const n = SONGS.length;
  const HALF = n / 2;
  cardElements.forEach((card, i) => {
    const raw = (((i - selectedIndex) % n) + n) % n;
    const dist = raw > HALF ? raw - n : raw;
    const absDist = Math.abs(dist);

    const scale = absDist === 0 ? SELECTED_SCALE : 1;
    const opacity = absDist >= HALF ? 0 : 1;

    card.style.transform = `translateY(${dist * CARD_STEP}px) scale(${scale})`;
    card.style.opacity = String(opacity);
  });
}

function getHighScore(songId) {
  const stored = localStorage.getItem(`highscore_${songId}`);
  return stored !== null ? Math.floor(Number(stored)) : "---";
}
