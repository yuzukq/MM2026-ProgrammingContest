// result.js
// リザルト画面：封筒(envelope.svg)を開封→歌詞カード(lyriccard.svg)が登場し、
// 回収できた歌詞を判定の不透明度付きで刻む

const ENVELOPE_SRC = "/assets/envelope.svg";
const LYRICCARD_SRC = "/assets/lyriccard.svg";

// 判定→不透明度（PERFECT=くっきり、未判定/BAD=薄く）
const RATING_OPACITY = { PERFECT: 1.0, GOOD: 0.5, BAD: 0.2 };
const MISS_OPACITY = 0.2; // 未判定(null)

const WORD_STAGGER_MS = 40; // 1語ごとの刻み間隔
const OPEN_MS = 900; // flap透過＋flapinner展開の所要（CSSと合わせること）
const CARD_MS = 550; // カード登場の所要（CSSと合わせること）

let screenEl = null;
let cardEl = null;
let titleTextEl = null; // SVG <text id="title">
let artistTextEl = null; // SVG <text id="artist">
let scoreTextEl = null; // SVG <text id="score">
let lyricEl = null; // 歌詞表示部分のHTMLオーバーレイ（スクロール用）
let hintEl = null; // 「タップして選曲に戻る」
let onRestartCallback = null;
let canReturn = false; // スクロール最下到達で解禁するため
let timers = []; // 演出の setTimeout

// ── public ──────────────────────────────

export function initResult(onRestart) {
  onRestartCallback = onRestart;
  buildDOM(); // 非同期で SVG を fetch・展開
}

export function showResultScreen({ score, ratingCounts, collectedLyrics, title, artist }) {
  if (!cardEl) return;
  clearTimers();

  // テキスト反映
  if (titleTextEl) titleTextEl.textContent = title ?? "";
  if (artistTextEl) artistTextEl.textContent = artist ?? "";
  if (scoreTextEl) scoreTextEl.textContent = String(Math.floor(score));
  renderLyrics(collectedLyrics ?? []);

  // 状態を「封筒閉じ・カード未登場」に戻す
  canReturn = false;
  hintEl.classList.remove("show");
  lyricEl.classList.remove("inscribe");
  lyricEl.scrollTop = 0;
  screenEl.classList.remove("opened", "card-in");
  screenEl.style.display = "flex";

  // reflow を挟んでからクラス付与＝transition を発火させる
  void screenEl.offsetWidth;
  screenEl.classList.add("opened"); // 1) flap透過＋flapinner展開
  timers.push(
    setTimeout(() => {
      screenEl.classList.add("card-in"); // 2) カードが拡大登場
      timers.push(
        setTimeout(() => {
          lyricEl.classList.add("inscribe"); // 3) 歌詞を刻む
          setupScrollGate(); // 4) スクロール最下で復帰解禁
        }, CARD_MS)
      );
    }, OPEN_MS)
  );
}

export function hideResultScreen() {
  clearTimers();
  if (screenEl) screenEl.style.display = "none";
}

// ── internal ────────────────────────────

async function buildDOM() {
  screenEl = document.createElement("div");
  screenEl.id = "result-screen";

  const envelopeEl = document.createElement("div");
  envelopeEl.id = "result-envelope";

  cardEl = document.createElement("div");
  cardEl.id = "result-card";

  lyricEl = document.createElement("div");
  lyricEl.id = "card-lyric";

  hintEl = document.createElement("p");
  hintEl.id = "result-hint";
  hintEl.textContent = "タップして選曲に戻る";

  screenEl.append(envelopeEl, cardEl, hintEl);
  document.body.appendChild(screenEl);

  // タップで復帰（解禁後のみ）
  screenEl.addEventListener("click", handleReturn);
  screenEl.addEventListener(
    "touchend",
    (e) => {
      // 歌詞スクロール中の誤タップ防止、解禁前は何もしない
      if (canReturn) e.preventDefault();
      handleReturn();
    },
    { passive: false }
  );

  // 2枚の SVG を並行 fetch・インライン展開
  const [envSvg, cardSvg] = await Promise.all([
    fetch(ENVELOPE_SRC).then((r) => r.text()),
    fetch(LYRICCARD_SRC).then((r) => r.text()),
  ]);
  envelopeEl.innerHTML = envSvg;
  scopeSvgStyles(envelopeEl, "#result-envelope");
  cardEl.innerHTML = cardSvg;
  scopeSvgStyles(cardEl, "#result-card");
  cardEl.appendChild(lyricEl); // 歌詞オーバーレイはカードSVGの上に重ねる

  // カードSVGの text 参照を取得し、#lyric プレースホルダは除去（HTMLで描くので）
  const cardSvgEl = cardEl.querySelector("svg");
  titleTextEl = cardSvgEl.querySelector("#title");
  artistTextEl = cardSvgEl.querySelector("#artist");
  scoreTextEl = cardSvgEl.querySelector("#score");
  cardSvgEl.querySelector("#lyric")?.remove();
}

// インライン展開した SVG の <style> を scope 配下へ限定する。
// イラレ書き出しの .cls-* はファイル間で同名衝突し、グローバルに漏れて他の素材を汚染してるので各セレクタを書き換えて暫定対処。
function scopeSvgStyles(containerEl, scope) {
  const styleEl = containerEl.querySelector("svg style");
  if (!styleEl) return;
  styleEl.textContent = styleEl.textContent.replace(
    /([^{}]+)(\{[^}]*\})/g,
    (_, selectors, body) =>
      selectors
        .split(",")
        .map((s) => `${scope} ${s.trim()}`)
        .join(", ") + body
  );
}

// 回収歌詞をフレーズ×単語で描く
function renderLyrics(collected) {
  lyricEl.replaceChildren();
  let order = 0;
  for (const phrase of collected) {
    const line = document.createElement("p");
    line.className = "lyric-line";
    for (const { text, rating } of phrase.words) {
      const span = document.createElement("span");
      span.className = "lyric-word";
      span.textContent = text;
      span.style.setProperty("--op", rating ? RATING_OPACITY[rating] : MISS_OPACITY); // 単語ごとに rating に応じて不透明度を載せる
      span.style.animationDelay = `${order * WORD_STAGGER_MS}ms`;
      line.appendChild(span);
      order++;
    }
    lyricEl.appendChild(line);
  }
}

// スクロール最下で復帰を解禁
function setupScrollGate() {
  const needsScroll = lyricEl.scrollHeight > lyricEl.clientHeight + 4;
  if (!needsScroll) {
    enableReturn(); // 収まりきってたら即解禁
    return;
  }
  lyricEl.addEventListener("scroll", onLyricScroll);
}

function onLyricScroll() {
  if (lyricEl.scrollTop + lyricEl.clientHeight >= lyricEl.scrollHeight - 4) {
    enableReturn();
    lyricEl.removeEventListener("scroll", onLyricScroll);
  }
}

function enableReturn() {
  canReturn = true;
  hintEl.classList.add("show");
}

function handleReturn() {
  if (canReturn) onRestartCallback?.();
}

function clearTimers() {
  timers.forEach(clearTimeout);
  timers = [];
}
