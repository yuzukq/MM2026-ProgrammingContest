// main.js
// ゲームマネージャ（Unityでいうシングルトン的な立ち位置）
// 全モジュールを import して各種 init・接続するだけで、それ自身はロジックを持たない。
// TextAlive の onTimeUpdate がここに集約され、各モジュールへ振り分ける。

import { Player } from "textalive-app-api";
import { initScene, updateScene } from "./scene.js";
import {
  buildWordBlocks,
  updateGame,
  getWordBlocks,
  getScore,
  getLatestRating,
  popPendingEffects,
} from "./game.js";
import { initCanvas, updateCanvasState, getTouchedY } from "./canvas.js";
import { updateUI } from "./ui.js";
import { initKeyboard } from "./keyboard.js";
import { initSelection, showSelectionScreen, hideSelectionScreen } from "./selection.js";
import { initLoading, showLoadingScreen, hideLoadingScreen, setLoadingReady } from "./loading.js";

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
      player.createFromSongUrl(ctx.song.url, { video: ctx.song.video });
      break;
    case STATE.PLAYING:
      initPlayScene();
      break;
    case STATE.RESULT:
      break;
  }
}

function exit(s) {
  switch (s) {
    case STATE.LOADING:
      hideLoadingScreen();
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

// TextAlive のイニシャライズ
const player = new Player({
  app: { token: "test" }, // TODO: 本番トークンに差し替える
  vocalAmplitudeEnabled: true,
});

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
      console.log("[song end] position:", position, "duration:", player.video.duration);
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
