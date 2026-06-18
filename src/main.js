// ゲームマネージャ
// 全モジュールを import して各種 init・接続するだけで、それ自身はロジックを持たない。
// TextAlive の onTimeUpdate がここに集約され、各モジュールへ振り分ける。

// ===============モジュール集約================
import { Player } from "textalive-app-api";
import * as scene from "./three/scene.js";
import * as game from "./game.js";
import * as canvas from "./canvas/canvas.js";
import * as ui from "./ui/ui.js";
import * as keyboard from "./ui/keyboard.js";
import * as selection from "./screens/selection.js";
import * as loading from "./screens/loading.js";
import * as result from "./screens/result.js";
import { startFpsMeter } from "./debug-fps.js"; // 完成前に消す

// ===============ステートマシン===============
const STATE = {
  SELECTION: "selection",
  LOADING: "loading",
  PLAYING: "playing",
  RESULT: "result",
};
// 選曲シーンがエントリ
let state = STATE.SELECTION;
let currentSong = null; // 現在プレイ中の曲（ハイスコア保存に使う）
let lastBeatIndex = -1; // 直近に検知したビートの通し番号（拍の切り替わり検知に使う）
let endRequested = false; // 終端で requestStop を多重発火させないためのフラグ
let endArmed = false; // 本編内の正常な再生位置を観測したら true。これが立つまで onTimeUpdate を捨てる

// 終端検知のマージン[ms]
const END_DETECT_MARGIN_MS = 250;

// state遷移のトリガー
// (遷移先, 遷移時に必要な情報(引数なしでは空オブジェクト))
function transition(to, ctx = {}) {
  exit(state);
  state = to;
  enter(to, ctx);
}

// 次ステートに入る時に実行する関数呼び出し
function enter(s, ctx) {
  switch (s) {
    case STATE.SELECTION:
      selection.showSelectionScreen(); // 選曲画面の描画
      break;
    case STATE.LOADING:
      selection.hideSelectionScreen();
      loading.showLoadingScreen();
      ui.preloadUI(); // ロード画面の裏でプログレスバー素材を読み込み
      currentSong = ctx.song;
      lastBeatIndex = -1; // ビート検知をリセット
      endRequested = false; // 終端検知フラグをリセット
      endArmed = false; // 再生開始時の position 張り付き対策
      game.resetGame();
      player.createFromSongUrl(ctx.song.url, { video: ctx.song.video });
      break;
    case STATE.PLAYING:
      initPlayScene();
      scene.registerLyricTimeline(game.getLyricTimeline()); // gameロジックで作ったタイムラインをlyric.jsまで飛ばす
      ui.initUI(currentSong?.title);
      canvas.startCanvasLoop();
      keyboard.showKeyboard();
      break;
    case STATE.RESULT: {
      const score = game.getScore();
      if (currentSong) {
        const key = `highscore_${currentSong.id}`;
        const prev = Number(localStorage.getItem(key)) || 0;
        if (score > prev) {
          localStorage.setItem(key, score);
          console.log(`db書き込み: ${score} (${currentSong.title})`);
        }
      }
      result.showResultScreen({
        score,
        maxScore: game.getMaxScore(),
        ratingCounts: game.getRatingCounts(),
        collectedLyrics: game.getCollectedLyrics(),
        title: currentSong?.title,
        artist: currentSong?.artist,
      });
      break;
    }
  }
}

// 現在ステートから出る時に実行する関数呼び出し
function exit(s) {
  switch (s) {
    case STATE.LOADING:
      loading.hideLoadingScreen();
      break;
    case STATE.PLAYING:
      canvas.stopCanvasLoop();
      keyboard.hideKeyboard();
      break;
    case STATE.RESULT:
      result.hideResultScreen();
      break;
    default:
      break;
  }
}
// ===========================================

// Three.js・Canvas・Keyboard は PLAYING 遷移時に初めてinitする
let playSceneInitialized = false;

function initPlayScene() {
  if (playSceneInitialized) return;
  scene.initScene();
  canvas.initCanvas();
  keyboard.initKeyboard();
  playSceneInitialized = true;
}

// 選曲画面を初期化（SVGフェッチ完了まで await。表示は onAppReady → transition(SELECTION) のタイミング）
// selection.js の onSongSelectedCallbackに曲が決まったら呼ぶ関数を渡す
await selection.initSelection((song) => transition(STATE.LOADING, { song }));

// ロード画面を初期化
// ロード完了画面のタップにrequestPlayをコールバックとして仕込むため
loading.initLoading(() => {
  player.requestPlay();
  transition(STATE.PLAYING);
});

// リザルト画面を初期化
// タップで選曲画面に戻るコールバックを渡す
result.initResult(() => transition(STATE.SELECTION));

// 歌詞フォントを起動時から並行読込（プレイ開始までに揃える）。失敗時はフォールバック
const fontReady = scene
  .loadLyricFont()
  .catch((e) => console.warn("歌詞フォント読込失敗（フォールバック）", e));

// TextAlive のイニシャライズ
const player = new Player({
  app: { token: "test" }, // TODO: 本番トークンに差し替える
  vocalAmplitudeEnabled: true,
});

// =======デバッグ用後で消す（曲の90%地点にシーク）=====================
window.__debugSkip = () => {
  if (player.video?.duration) player.requestMediaSeek(player.video.duration * 0.9);
};
// ==============================================================

// ★一時的なFPS計測用
startFpsMeter();
player.addListener({
  // TextAlive の準備ができたら呼ばれる
  onAppReady(app) {
    if (!app.songUrl) {
      transition(STATE.SELECTION);
    }
  },
  // 歌詞・タイミングデータの読み込みが完了したら呼ばれる
  onVideoReady() {
    game.buildWordBlocks(player); // 単語単位の声量ブロックを事前構築
  },
  // 音声（Songleタイマー）の準備が完了したら呼ばれる
  onTimerReady() {
    // 曲とフォントの両方が揃ったらタップ受付
    fontReady.then(() => loading.setLoadingReady());
  },

  // 終端検知で自分が requestStop した時だけリザルトへ遷移する。
  onStop() {
    if (state === STATE.PLAYING && endRequested) {
      transition(STATE.RESULT);
    }
  },

  // =====20fps毎に呼ばれる楽曲情報周りのゲームループ=====
  onTimeUpdate(position) {
    // プレイシーン以外ではスキップ
    if (state !== STATE.PLAYING) return;

    const duration = player.video?.duration ?? 0;

    // iPad で再生開始直後の数フレーム position が duration に張り付き、終端と誤判定してリザルトへ誤遷移する(詳細は#31)ので
    // 本編内（先頭〜終端margin手前）の正常位置を観測するまでフレームを捨てることで対処
    if (!endArmed) {
      if (duration > END_DETECT_MARGIN_MS && position < duration - END_DETECT_MARGIN_MS) {
        endArmed = true; // 正常な再生位置を観測 → 以降は通常処理
      } else {
        return; // 張り付き期間（position≈duration）はこのフレームを無視
      }
    }

    // 終端検知: 本来の終端へ到達したら requestStop → onStop でリザルトへ
    if (!endRequested && position >= duration - END_DETECT_MARGIN_MS) {
      endRequested = true;
      player.requestStop(); // onStopを発火させる
      return;
    }

    const touchedY = canvas.getTouchedY(); // 正規化済みY座標（上=1, 下=0）を取得
    const { isOnBeat, normalizedY: touchNormalizedY } = game.updateGame(position, touchedY); // スコア計算・ブロック評価

    // canvas描画用の状態のみ更新
    canvas.updateCanvasState({
      position,
      wordBlocks: game.getWordBlocks(),
      effects: game.popPendingEffects(),
      isOnBeat,
      touchNormalizedY,
    });

    // ビート検知：通し番号が変わった最初のフレームだけ isNewBeat を立てる
    const beat = player.findBeat(position);
    let isNewBeat = false;
    if (beat && beat.index !== lastBeatIndex) {
      isNewBeat = true;
      lastBeatIndex = beat.index;
    }
    // 曲の進捗(0..1)
    const progress = position / player.video.duration;
    // findChorus が非nullならサビ区間
    const inChorus = !!player.findChorus(position);

    // threeレイヤー描画用の状態のみ更新
    scene.updateScene({
      position,
      progress,
      isNewBeat,
      beat,
      lyricRatings: game.popLyricEvents(), // 歌詞ビルボードの判定結果
      inChorus,
    });
    // HUD一式を現在の状態で更新（score / rating ＋ 進捗バー）
    ui.updateUI({
      score: game.getScore(),
      rating: game.getLatestRating(),
      progress,
    });
  },
  // ==========================================
});
