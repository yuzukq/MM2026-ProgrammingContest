// credits.js
// タイトル画面右上のボタンとクレジットモーダルを管理する

import { inlineSvg } from "../inline-svg.js";

const LYRICCARD_SRC = "/assets/lyriccard.svg";

// TODO: 後で差し替え
const GAME_TITLE = "- TITLE -";

const CARD_W = 595.24;

// ── クレジット本文 ────────────────────────────────────────────────
// HTML タグ使用可
const CREDITS_HTML = `
<p><b>このゲームについて</b></p>
<p>
  Magical Mirai 2026 プログラミングコンテスト応募作品。<br>
  TextAlive App API を使ったリリックゲームです。
</p>

<p><b>クレジット</b></p>
<p>
  プログラム/モーション撮影: Yuzu<br>
  イラスト/UIデザイン: <br>
  3Dモデリング/モーションビルダー:
</p>
`;
// ─────────────────────────────────────────────────────────────────

let btnEl = null;
let overlayEl = null;

// ── public ──────────────────────────────

export function initCredits() {
  buildButton();
  buildModal();
}

export function showCreditsBtn() {
  if (btnEl) btnEl.style.display = "flex";
}

export function hideCreditsBtn() {
  if (btnEl) btnEl.style.display = "none";
}

// ── internal ────────────────────────────

function buildButton() {
  btnEl = document.createElement("button");
  btnEl.id = "credits-btn";
  btnEl.setAttribute("aria-label", "クレジット");
  btnEl.textContent = "I";
  btnEl.style.display = "none";
  document.body.appendChild(btnEl);

  btnEl.addEventListener("click", (e) => {
    e.stopPropagation();
    openModal();
  });
  btnEl.addEventListener(
    "touchend",
    (e) => {
      e.stopPropagation();
      e.preventDefault();
      openModal();
    },
    { passive: false }
  );
}

async function buildModal() {
  overlayEl = document.createElement("div");
  overlayEl.id = "credits-overlay";
  overlayEl.style.display = "none";

  const cardEl = document.createElement("div");
  cardEl.id = "credits-card";
  overlayEl.appendChild(cardEl);
  document.body.appendChild(overlayEl);

  // オーバーレイ背景タップで閉じる（カード内タップは伝播させない）
  overlayEl.addEventListener("click", (e) => {
    if (e.target === overlayEl) closeModal();
  });
  overlayEl.addEventListener(
    "touchend",
    (e) => {
      if (e.target === overlayEl) {
        e.preventDefault();
        closeModal();
      }
    },
    { passive: false }
  );
  cardEl.addEventListener("click", (e) => e.stopPropagation());

  const svgText = await fetch(LYRICCARD_SRC).then((r) => r.text());
  const svgEl = inlineSvg(cardEl, svgText);

  // タイトルテキストを設定して中央揃え
  const titleEl = svgEl.querySelector("#title");
  if (titleEl) {
    titleEl.textContent = GAME_TITLE;
    const ty =
      (/translate\([\d.]+[ ,]+([\d.]+)/.exec(titleEl.getAttribute("transform") || "") || [])[1] ??
      "0";
    titleEl.setAttribute("transform", `translate(${CARD_W / 2} ${ty})`);
  }

  // artist-score は使わないので非表示
  svgEl.querySelector("#artist-score")?.setAttribute("display", "none");

  // lyric プレースホルダを除去して HTML コンテンツで置き換え
  svgEl.querySelector("#lyric")?.remove();

  const contentEl = document.createElement("div");
  contentEl.id = "credits-content";
  contentEl.innerHTML = CREDITS_HTML;
  cardEl.appendChild(contentEl);
}

function openModal() {
  if (overlayEl) overlayEl.style.display = "flex";
}

function closeModal() {
  if (overlayEl) overlayEl.style.display = "none";
}
