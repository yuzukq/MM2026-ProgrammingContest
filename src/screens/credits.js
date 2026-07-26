// credits.js
// タイトル画面右上のボタンとクレジットモーダルを管理する

import * as InlineSvgHelper from "../inline-svg-helper.js";
import { asset } from "../asset-url.js";

const LYRICCARD_SRC = asset("/assets/lyriccard.svg");

const GAME_TITLE = "初音シンセサイザー";

const CARD_W = 595.24;

// ── クレジット本文 ────────────────────────────────────────────────
// HTML タグ使用可
const CREDITS_HTML = `
<p><b>この作品について</b></p>
<p>
  本作品は初音ミク「マジカルミライ2026」<br>
  プログラミング・コンテスト応募作品です。
</p>
<br>
<p>
  今回のテーマ「湖のソナーレ」をモチーフに、ミクが声を奏でるためのツールであるボーカロイドスタジオから着想を得たリリックゲームです。
  湖の情景をイメージしたセカイで、ミクと音楽を通じて共鳴できる空間。そんな体験を目指して作成しました。
</p>
<br>
<p>
  流れてくるMIDIノートを正しいピッチでなぞると、歌詞が3D空間上の五線譜へと浮かび上がます。
  同時に、ミクが歌詞に合わせて歌いながら、ビートに乗って踊ってくれます。
  正しく回収できた歌詞に応じてミクの表情や動きが変化し、曲の終わりにはミクが奏でた歌が刻まれた歌詞カードが作られます。
</p>
<br>
<p>
  ミクと一緒に歌を奏でる新しい音楽体験を、ぜひお楽しみください！
</p>
<br>
<p><b>クレジット</b></p>
<p>
  プログラム / モーション撮影：Yuzu<br>
  イラスト / UIデザイン：k4geri<br>
  3Dモデリング / モーション修正：らだー
</p>
<br>
<p>
  この作品はピアプロ・キャラクター・ライセンスに基づいて<br>
  クリプトン・フューチャー・メディア株式会社のキャラクター「初音ミク」を描いたものです。
</p>
<br>
<p><b>楽曲・サムネイル利用承諾（順不同・敬称略）</b></p>
<p>
  こたえて／imie<br>
  アフター・ザ・カーテン／Rulmry<br>
  シャッターチャンス／夜未アガリ<br>
  世界最後の音楽隊／夏山よつぎ×ど～ぱみん<br>
  トリツクロジー／鶴三<br>
  TEKEOVER／Twinfield
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
  const svgEl = InlineSvgHelper.inlineSvg(cardEl, svgText);

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
