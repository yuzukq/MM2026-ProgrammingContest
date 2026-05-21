// main.js
// ゲームマネージャ（Unityでいうシングルトン的な立ち位置）
// 全モジュールを import して各種 init・接続するだけで、それ自身はロジックを持たない。
// TextAlive の onTimeUpdate がここに集約され、各モジュールへ振り分ける。

// ===============モジュール集約================
import { Player } from "textalive-app-api";
import { initScene, updateScene } from "./scene.js";
import {
  buildWordBlocks,
  resetGame,
  updateGame,
  getWordBlocks,
  getScore,
  getMaxScore,
  getLatestRating,
  getRatingCounts,
  popPendingEffects,
} from "./game.js";
import { initCanvas, startCanvasLoop, stopCanvasLoop, updateCanvasState, getTouchedY } from "./canvas.js";
import { updateUI } from "./ui.js";
import { initKeyboard, showKeyboard, hideKeyboard } from "./keyboard.js";
import { initSelection, showSelectionScreen, hideSelectionScreen } from "./selection.js";
import { initLoading, showLoadingScreen, hideLoadingScreen, setLoadingReady } from "./loading.js";
import { initResult, showResultScreen, hideResultScreen } from "./result.js";

// ===============ステートマシン===============
const STATE = {
  SELECTION: "selection",
  LOADING: "loading",
  PLAYING: "playing",
  RESULT: "result",
};
// 選曲シーンがエントリ
let state = STATE.SELECTION;

// state遷移のトリガー
// (遷移先, 遷移時に必要な情報(引数なしでは空オブジェクト))
function transition(to, ctx = {}) {
  exit(state);
  state = to;
  enter(to, ctx);
}

function enter(s, ctx) {
  // ステートに合わせてinit
  switch (s) {
    case STATE.SELECTION:
      showSelectionScreen(); // 選曲画面の描画
      break;
    case STATE.LOADING:
      hideSelectionScreen();
      showLoadingScreen();
      resetGame();
      player.createFromSongUrl(ctx.song.url, { video: ctx.song.video });
      break;
    case STATE.PLAYING:
      initPlayScene();
      startCanvasLoop();
      showKeyboard();
      break;
    case STATE.RESULT:
      showResultScreen({
        score: getScore(),
        maxScore: getMaxScore(),
        ratingCounts: getRatingCounts(),
      });
      break;
  }
}

function exit(s) {
  switch (s) {
    case STATE.LOADING:
      hideLoadingScreen();
      break;
    case STATE.PLAYING:
      stopCanvasLoop();
      hideKeyboard();
      break;
    case STATE.RESULT:
      hideResultScreen();
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
  initScene();
  initCanvas();
  initKeyboard();
  playSceneInitialized = true;
}

// 選曲画面を初期化（SVGフェッチ完了まで await。表示は onAppReady → transition(SELECTION) のタイミング）
// selection.js の onSongSelectedCallbackに曲が決まったら呼ぶ関数を渡す
await initSelection((song) => transition(STATE.LOADING, { song }));

// ロード画面を初期化
// ロード完了画面のタップにrequestPlayをコールバックとして仕込むため
initLoading(() => {
  player.requestPlay();
  transition(STATE.PLAYING);
});

// リザルト画面を初期化
// タップで選曲画面に戻るコールバックを渡す
initResult(() => transition(STATE.SELECTION));

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
player.addListener({
  // TextAlive の準備ができたら呼ばれる
  onAppReady(app) {
    if (!app.songUrl) {
      transition(STATE.SELECTION);
    }
  },
  // 歌詞・タイミングデータの読み込みが完了したら呼ばれる
  onVideoReady() {
    buildWordBlocks(player); // game.js：単語単位の声量ブロックを事前構築
  },
  // 音声（Songleタイマー）の準備が完了したら呼ばれる
  onTimerReady() {
    setLoadingReady();
  },

  // =====毎フレーム呼ばれるメインのゲームループ=====
  onTimeUpdate(position) {
    // プレイシーン以外ではスキップ
    if (state !== STATE.PLAYING) return;

    // onStopは自然終了で発火しないようなので再生位置と終端比較で検知
    if (position >= player.video.duration) {
      console.log("自然終了", position, player.video.duration);
      transition(STATE.RESULT);
      return;
    }

    const touchedY = getTouchedY(); // canvas.js：正規化済みY座標（上=1, 下=0）
    const { isOnBeat, normalizedY: touchNormalizedY } = updateGame(position, touchedY); // game.js：スコア計算・ブロック評価
    updateCanvasState({
      position,
      wordBlocks: getWordBlocks(),
      effects: popPendingEffects(),
      isOnBeat,
      touchNormalizedY,
    }); // canvas.js：描画用の状態を更新
    updateScene({
      position,
      duration: player.video.duration,
      score: getScore(),
    }); // scene.js：3D更新
    updateUI(getScore(), getLatestRating()); // ui.js：スコア・レーティング表示更新
  },
  // ==========================================
});
