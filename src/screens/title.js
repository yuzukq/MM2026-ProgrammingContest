// title.js
// タイトル画面：アプリ起動後に最初に表示される画面の制御

let screenEl = null;
let onTapCallback = null;

// ── public ──────────────────────────────

export function initTitle(onTap) {
  onTapCallback = onTap;
  buildDOM();
}

export function showTitleScreen() {
  screenEl.style.display = "block";
}

export function hideTitleScreen() {
  screenEl.style.display = "none";
}

// ── internal ────────────────────────────

function buildDOM() {
  screenEl = document.createElement("div");
  screenEl.id = "title-screen";
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
