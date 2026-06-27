// result.js
// リザルト画面：封筒(envelope.svg)を開封→歌詞カード(lyriccard.svg)が登場し、
// 回収できた歌詞を判定の不透明度付きで刻む

import * as InlineSvgHelper from "../inline-svg-helper.js";

const ENVELOPE_SRC = "/assets/envelope.svg";
const LYRICCARD_SRC = "/assets/lyriccard.svg";
const MIKU_HAPPY_SRC = "/assets/result_miku_happy.png";
const MIKU_NORMAL_SRC = "/assets/result_miku_normal.png";

const SCORE_HAPPY_THRESHOLD = 400;

// 判定→不透明度（PERFECT=くっきり、BAD=薄く）。触れられなかった単語も game 側で BAD 判定される
const RATING_OPACITY = { PERFECT: 1.0, GOOD: 0.4, BAD: 0.2 };

const WORD_STAGGER_MS = 40; // 1語ごとの刻み間隔
const OPEN_MS = 2000; // flap透過＋flapinner展開の所要（CSSと合わせること）
const CARD_MS = 550; // カード登場の所要（CSSと合わせること）
const CARD_W = 595.24; // lyriccard の viewBox 幅（テキスト中央寄せ／縮小の基準）
const TEXT_MAX_W = 520; // 1行テキスト(title / artist-score)の最大幅(user units)。超えたら縮小
const AUTO_SCROLL_PX_PER_SEC = 50; // 歌詞の自動スクロール速度

let screenEl = null;
let mikuEl = null;
let cardEl = null;
let titleTextEl = null; // SVG <text id="title">
let artistScoreEl = null; // SVG <text id="artist-score">（artist と score を1行に統合）
let lyricEl = null; // 歌詞表示部分のHTMLオーバーレイ（スクロール用）
let hintEl = null; // 「タップして選曲に戻る」
let onRestartCallback = null;
let canReturn = false; // スクロール最下到達で解禁するため
let timers = []; // 演出の setTimeout
let scrollRaf = 0; // 自動スクロールの requestAnimationFrame ハンドル
let scrollCtl = null; // 自動スクロール関連リスナの一括解除用 AbortController

// ── public ──────────────────────────────

export function initResult(onRestart) {
  onRestartCallback = onRestart;
  buildDOM(); // 非同期で SVG を fetch・展開
}

export function showResultScreen({ score, collectedLyrics, title, artist }) {
  if (!cardEl) return;
  clearTimers();

  // スコアに応じて表情差分を切り替え
  if (mikuEl) mikuEl.src = score >= SCORE_HAPPY_THRESHOLD ? MIKU_HAPPY_SRC : MIKU_NORMAL_SRC;

  // テキスト反映
  if (titleTextEl) titleTextEl.textContent = title ?? "";
  if (artistScoreEl)
    artistScoreEl.textContent = `Artist: ${artist ?? ""}　Score: ${Math.floor(score)}`;
  renderLyrics(collectedLyrics ?? []);

  // 状態を「封筒閉じ・カード未登場」に戻す
  canReturn = false;
  hintEl.classList.remove("show");
  lyricEl.classList.remove("inscribe");
  lyricEl.scrollTop = 0;
  screenEl.classList.remove("opened", "card-in");
  screenEl.style.display = "flex";
  // 表示後に測って、はみ出す1行テキストはフォント縮小して収める
  fitText(titleTextEl, TEXT_MAX_W);
  fitText(artistScoreEl, TEXT_MAX_W);

  // reflow を挟んでからクラス付与＝transition を発火させる
  void screenEl.offsetWidth;
  screenEl.classList.add("opened"); // 1) flap透過＋flapinner展開
  timers.push(
    setTimeout(() => {
      screenEl.classList.add("card-in"); // 2) カードが拡大登場
      timers.push(
        setTimeout(() => {
          lyricEl.classList.add("inscribe"); // 3) 歌詞を刻む
          autoScrollLyrics(); // 4) 固定速度で自動スクロール（最下で復帰解禁・手動でも可）
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

  mikuEl = document.createElement("img");
  mikuEl.id = "result-miku";
  mikuEl.alt = "";

  screenEl.append(mikuEl, envelopeEl, cardEl, hintEl);
  document.body.appendChild(screenEl);

  // タップで復帰（解禁後のみ）。click はスクロールのドラッグでは発火しないので
  // 「歌詞をスクロールしただけで戻ってしまう」誤爆が起きない（手動で見返せる）。
  screenEl.addEventListener("click", handleReturn);

  // 2枚の SVG を並行 fetch・インライン展開
  const [envSvg, cardSvg] = await Promise.all([
    fetch(ENVELOPE_SRC).then((r) => r.text()),
    fetch(LYRICCARD_SRC).then((r) => r.text()),
  ]);
  InlineSvgHelper.inlineSvg(envelopeEl, envSvg);
  const cardSvgEl = InlineSvgHelper.inlineSvg(cardEl, cardSvg); // スタイルのスコープ限定
  cardEl.appendChild(lyricEl); // 歌詞オーバーレイはカードSVGの上に重ねる

  // カードSVGの text 参照を取得し、#lyric プレースホルダは除去（HTMLで描くので）
  titleTextEl = cardSvgEl.querySelector("#title");
  artistScoreEl = cardSvgEl.querySelector("#artist-score");
  cardSvgEl.querySelector("#lyric")?.remove();

  // 1行テキストはカード中央へ中央寄せ
  recenterX(titleTextEl, CARD_W / 2);
  recenterX(artistScoreEl, CARD_W / 2);
}

// SVG <text> の transform の x をカード中心に揃える
function recenterX(el, cx) {
  if (!el) return;
  const ty =
    (/translate\([\d.]+[ ,]+([\d.]+)/.exec(el.getAttribute("transform") || "") || [])[1] ?? "0";
  el.setAttribute("transform", `translate(${cx} ${ty})`);
}

// 1行テキストの幅を測り、maxW を超えていたらフォントを縮小して収める
function fitText(el, maxW) {
  if (!el) return;
  el.style.fontSize = ""; // 既定サイズに戻して測る
  const w = el.getBBox().width;
  if (w > maxW) {
    const base = parseFloat(getComputedStyle(el).fontSize) || 0;
    if (base) el.style.fontSize = `${(base * maxW) / w}px`;
  }
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
      span.style.setProperty("--op", RATING_OPACITY[rating] ?? RATING_OPACITY.BAD); // rating で不透明度（未判定は BAD 扱い）
      span.style.animationDelay = `${order * WORD_STAGGER_MS}ms`;
      line.appendChild(span);
      order++;
    }
    lyricEl.appendChild(line);
  }
}

// 歌詞を固定速度で最下まで自動スクロール
function autoScrollLyrics() {
  scrollCtl?.abort();
  scrollCtl = new AbortController();
  const sig = scrollCtl.signal;

  const maxScroll = lyricEl.scrollHeight - lyricEl.clientHeight;
  if (maxScroll <= 4) {
    enableReturn(); // 収まりきってたら即解禁
    return;
  }

  // 最下到達で解禁（自動・手動どちらのスクロールでも）
  lyricEl.addEventListener(
    "scroll",
    () => {
      if (lyricEl.scrollTop + lyricEl.clientHeight >= lyricEl.scrollHeight - 4) enableReturn();
    },
    { signal: sig }
  );
  // ユーザー操作で自動スクロールを停止し手動に委ねる
  const stopAuto = () => cancelAnimationFrame(scrollRaf);
  lyricEl.addEventListener("wheel", stopAuto, { signal: sig, passive: true });
  lyricEl.addEventListener("touchstart", stopAuto, { signal: sig, passive: true });

  let last = performance.now();
  const step = (now) => {
    lyricEl.scrollTop += (AUTO_SCROLL_PX_PER_SEC * (now - last)) / 1000;
    last = now;
    if (lyricEl.scrollTop < maxScroll - 1) scrollRaf = requestAnimationFrame(step);
  };
  scrollRaf = requestAnimationFrame(step);
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
  if (scrollRaf) cancelAnimationFrame(scrollRaf);
  scrollRaf = 0;
  scrollCtl?.abort();
  scrollCtl = null;
}
