// title.js
// タイトル画面：アプリ起動後に最初に表示される画面の制御

import { asset } from "../asset-url.js";

let screenEl = null;
let logoEl = null;
let hintEl = null;
let onTapCallback = null;

// ── public ──────────────────────────────

export function initTitle(onTap) {
  onTapCallback = onTap;
  buildDOM();
}

export function showTitleScreen() {
  logoEl.style.transition = "none";
  logoEl.style.opacity = "1";
  hintEl.style.transition = "none";
  hintEl.style.opacity = "1";
  screenEl.style.display = "flex";
}

export function hideTitleScreen() {
  screenEl.style.display = "none";
}

// ロゴ＋ヒントをフェードアウトし、完了後に画面全体を隠す
export function startLogoFadeOut(ms = 400) {
  logoEl.style.transition = `opacity ${ms}ms ease`;
  logoEl.style.opacity = "0";
  hintEl.style.transition = `opacity ${ms}ms ease`;
  hintEl.style.opacity = "0";
  setTimeout(() => hideTitleScreen(), ms);
}

// ── internal ────────────────────────────

function buildDOM() {
  screenEl = document.createElement("div");
  screenEl.id = "title-screen";

  logoEl = document.createElement("img");
  logoEl.id = "title-logo";
  logoEl.src = asset("/assets/title_logo.png");
  logoEl.alt = "初音シンセサイザー";

  // タップ誘導ヒント
  hintEl = document.createElement("p");
  hintEl.id = "title-hint";
  hintEl.className = "tap-hint";
  hintEl.textContent = "Tap to Start";

  // 横長前提のため、3:4より縦長の端末では注意オーバーレイ（media query 側で判定）
  const warningEl = document.createElement("div");
  warningEl.id = "orientation-warning";
  warningEl.innerHTML =
    '<p class="ow-title">画面を横向きにしてください</p>' +
    '<p class="ow-sub">この作品はPCまたはタブレット横向きでのプレイを想定しています</p>';
  // 縦長で警告中の誤タップで選曲へ進ませない
  warningEl.addEventListener("click", (e) => e.stopPropagation());
  warningEl.addEventListener("touchend", (e) => e.stopPropagation());

  screenEl.append(logoEl, hintEl, warningEl);
  document.body.appendChild(screenEl);

  screenEl.addEventListener("click", () => onTapCallback?.());
  screenEl.addEventListener(
    "touchend",
    (e) => {
      e.preventDefault();
      onTapCallback?.();
    },
    { passive: false }
  );
}
