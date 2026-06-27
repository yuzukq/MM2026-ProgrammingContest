// title.js
// タイトル画面：アプリ起動後に最初に表示される画面の制御

let screenEl = null;
let logoEl = null;
let onTapCallback = null;

// ── public ──────────────────────────────

export function initTitle(onTap) {
  onTapCallback = onTap;
  buildDOM();
}

export function showTitleScreen() {
  logoEl.style.transition = "none";
  logoEl.style.opacity = "1";
  screenEl.style.display = "flex";
}

export function hideTitleScreen() {
  screenEl.style.display = "none";
}

// ロゴのみフェードアウトし、完了後に画面全体を隠す
export function startLogoFadeOut(ms = 400) {
  logoEl.style.transition = `opacity ${ms}ms ease`;
  logoEl.style.opacity = "0";
  setTimeout(() => hideTitleScreen(), ms);
}

// ── internal ────────────────────────────

function buildDOM() {
  screenEl = document.createElement("div");
  screenEl.id = "title-screen";

  logoEl = document.createElement("img");
  logoEl.id = "title-logo";
  logoEl.src = "/assets/title_logo.png";
  logoEl.alt = "初音シンセサイザー";

  screenEl.appendChild(logoEl);
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
