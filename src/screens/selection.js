// selection.js
// 選曲画面のカード表示・スクロール・選択確定を担当する
// 曲が確定したら onSongSelectedCallback(song) を呼び、main.js がローディングへ遷移する

import { SONGS } from "../data/songs.js";
import * as InlineSvgHelper from "../inline-svg-helper.js";

const CARD_SVG_SRC = "/assets/selectcard.svg";
const TOP_UI_SRC = "/assets/topui.svg";
const CARD_STEP = 170; // 隣カードまでの縦オフセット(px)
const SELECTED_SCALE = 1.3; // 選択状態のカードスケール

const SNAP_DURATION = 250; // スナップアニメーション時間(ms)
const FLICK_VEL = 0.5; // cards/sec  スナップの閾値

let selectedIndex = 0;
let cardElements = [];
let screenEl = null;
let cardsContainerEl = null;
let selTopUiEl = null;
let selTopScoreEl = null;
let selTopTitleEl = null;
let onSongSelectedCallback = null;

// 連続スクロール状態
let scrollOffset = 0; // float。整数値 = 対応カードが中央
let rafId = null;

// タッチ追跡
let touchLastY = 0;
let touchVelocity = 0; // cards/ms
let touchLastTime = 0;

// ── public ──────────────────────────────

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

export function showSelectionScreen(dur) {
  scrollOffset = selectedIndex; // 前回選択位置から再開
  updateCards();
  screenEl.style.display = "flex";

  // カードを左からスライドイン
  cardsContainerEl.style.transition = "none";
  cardsContainerEl.style.transform = "translateX(-620px)";
  void cardsContainerEl.offsetWidth;
  cardsContainerEl.style.transition = `transform ${dur}ms cubic-bezier(0.25, 0.46, 0.45, 0.94)`;
  cardsContainerEl.style.transform = "translateX(0)";

  // 上部バーを上からスライドイン
  selTopUiEl.style.transition = "none";
  selTopUiEl.style.transform = "translateY(-10vh)";
  void selTopUiEl.offsetWidth;
  selTopUiEl.style.transition = `transform ${dur}ms cubic-bezier(0.25, 0.46, 0.45, 0.94)`;
  selTopUiEl.style.transform = "translateY(0)";
}

export function hideSelectionScreen(dur) {
  const easing = "cubic-bezier(0.55, 0, 1, 0.45)"; // ease-in (スライドイン の逆)

  cardsContainerEl.style.transition = `transform ${dur}ms ${easing}`;
  cardsContainerEl.style.transform = "translateX(-620px)";

  selTopUiEl.style.transition = `transform ${dur - 40}ms ${easing}`;
  selTopUiEl.style.transform = "translateY(-10vh)";

  return new Promise((resolve) => {
    setTimeout(() => {
      screenEl.style.display = "none";
      resolve();
    }, dur);
  });
}

// ── internal ────────────────────────────

function updateSelectionTopUI() {
  if (!selTopTitleEl) return;
  selTopTitleEl.textContent = SONGS[selectedIndex].title;
}

// ======== DOM構築 ========

function buildSelectionTopUI(svgText) {
  selTopUiEl = document.createElement("div");
  selTopUiEl.id = "selection-top-ui";

  const svgEl = InlineSvgHelper.inlineSvg(selTopUiEl, svgText);
  svgEl.setAttribute("preserveAspectRatio", "none");

  // rating は静的テキスト
  const ratingEl = svgEl.querySelector("#rating");
  if (ratingEl) ratingEl.textContent = "Track selection";

  selTopScoreEl = svgEl.querySelector("#score");
  if (selTopScoreEl) selTopScoreEl.textContent = "";

  // title は動的更新用に参照を保持
  selTopTitleEl = svgEl.querySelector("#title");
  if (selTopTitleEl) {
    selTopTitleEl.setAttribute("text-anchor", "end");
    selTopTitleEl.textContent = "こたえて";
  }

  // 全幅引き伸ばし時も文字だけアスペクト比を維持する
  InlineSvgHelper.keepTextAspect(svgEl, [ratingEl, selTopScoreEl, selTopTitleEl]);

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
    const svg = InlineSvgHelper.inlineSvg(card, svgTemplate);

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
  // ──────── スワイプ操作: 1:1 で追従し離したらスナップ ────────
  screenEl.addEventListener(
    "touchstart",
    (e) => {
      touchLastY = e.touches[0].clientY;
      touchVelocity = 0;
      touchLastTime = performance.now();
      cancelAnim();
    },
    { passive: true }
  );

  screenEl.addEventListener(
    "touchmove",
    (e) => {
      const y = e.touches[0].clientY;
      const now = performance.now();
      const dt = now - touchLastTime;
      const dy = touchLastY - y; // dy > 0  = 下スクロール
      if (dt > 0) touchVelocity = dy / CARD_STEP / dt; // cards/ms
      scrollOffset += dy / CARD_STEP;
      touchLastY = y;
      touchLastTime = now;
      updateCards();
    },
    { passive: true }
  );

  screenEl.addEventListener(
    "touchend",
    () => {
      startSnapWithMomentum(touchVelocity * 1000); // cards/sec に変換
    },
    { passive: true }
  );

  // 離したら最寄りにスナップ
  screenEl.addEventListener("touchcancel", () => startSnap(), { passive: true });
  // ────────────────────────────────────────────────

  // ── ホイール(trackpad) の連続スクロール ──
  screenEl.addEventListener(
    "wheel",
    (e) => {
      e.preventDefault();
      cancelAnim();
      let delta = e.deltaY;
      if (e.deltaMode === 1) delta *= 30; // lines → px
      if (e.deltaMode === 2) delta *= 300; // pages → px
      scrollOffset += delta / CARD_STEP; // deltaY を累積して、イベントが止まったらスナップ
      updateCards();
      startSnap();
    },
    { passive: false }
  );

  // ── キーボード ──
  window.addEventListener("keydown", (e) => {
    if (screenEl.style.display === "none") return;
    const n = SONGS.length;
    if (e.key === "ArrowDown") moveTo((selectedIndex + 1) % n);
    else if (e.key === "ArrowUp") moveTo((selectedIndex - 1 + n) % n);
    else if (e.key === "Enter") confirmSelection();
  });
}

function moveTo(targetIdx) {
  const n = SONGS.length;
  const HALF = n / 2;
  // 現在の整数位置から近い側の targetIdx へ
  const currentInt = Math.round(scrollOffset);
  const currentMod = ((currentInt % n) + n) % n;
  let diff = targetIdx - currentMod;
  if (diff > HALF) diff -= n;
  if (diff < -HALF) diff += n;
  snapToOffset(currentInt + diff);
}

function confirmSelection() {
  onSongSelectedCallback?.(SONGS[selectedIndex]);
}

// ======== スクロール＆スナップ ========

function cancelAnim() {
  if (rafId !== null) {
    cancelAnimationFrame(rafId);
    rafId = null;
  }
}

// 最寄りカードへスナップする
function startSnap() {
  snapToOffset(Math.round(scrollOffset));
}

function startSnapWithMomentum(velocityCardsPerSec) {
  // フリックなら次カードへ
  if (Math.abs(velocityCardsPerSec) > FLICK_VEL) {
    snapToOffset(Math.round(scrollOffset) + Math.sign(velocityCardsPerSec));
  } // 停止で最寄りへスナップ
  else {
    startSnap();
  }
}

// 指定オフセットへイーズアウトで移動
function snapToOffset(target) {
  const n = SONGS.length;
  const startOffset = scrollOffset;
  const startTime = performance.now();

  cancelAnim();

  const animate = (ts) => {
    const t = Math.min((ts - startTime) / SNAP_DURATION, 1);
    const eased = 1 - Math.pow(1 - t, 3); // cubic ease-out
    scrollOffset = startOffset + (target - startOffset) * eased;
    updateCards();
    if (t < 1) {
      rafId = requestAnimationFrame(animate);
    } else {
      scrollOffset = ((target % n) + n) % n; // 正規化
      updateCards();
      rafId = null;
    }
  };

  rafId = requestAnimationFrame(animate);
}

// ======== カード描画 ========
// 左端固定でアスペクト比を維持してスケールするので相対的に右端が画面中央方向へ伸びる
function updateCards() {
  const n = SONGS.length;
  const HALF = n / 2;

  // 最寄り整数インデックスを選択カードとして扱う
  const newSelected = ((Math.round(scrollOffset) % n) + n) % n;
  if (newSelected !== selectedIndex) {
    selectedIndex = newSelected;
    updateSelectionTopUI();
  }

  cardElements.forEach((card, i) => {
    // i から scrollOffset までの循環距離 (-HALF .. +HALF)
    let rawDist = i - scrollOffset;
    rawDist = ((rawDist % n) + n) % n;
    if (rawDist > HALF) rawDist -= n;

    const scale = i === selectedIndex ? SELECTED_SCALE : 1;
    // 対向にある折り返しカードのみ非表示
    const opacity = Math.abs(rawDist) > HALF ? 0 : 1;

    card.style.transform = `translateY(${rawDist * CARD_STEP}px) scale(${scale})`;
    card.style.opacity = String(opacity);
  });
}

function getHighScore(songId) {
  const stored = localStorage.getItem(`highscore_${songId}`);
  return stored !== null ? Math.floor(Number(stored)) : "---";
}
