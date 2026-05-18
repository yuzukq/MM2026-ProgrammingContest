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
import { initUI, updateUI } from "./ui.js";
import { initKeyboard } from "./keyboard.js";
import { SONGS } from "./songs.js";

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
function transition(to, ctx = {}) {
  exit(state);
  state = to;
  enter(to, ctx);
}

function enter(s, ctx) {
  switch (s) {
    case STATE.SELECTION:
      // TODO: selection.js の showSelectionScreen() に差し替える
      // 暫定：先頭曲で直接ロードへ遷移
      transition(STATE.LOADING, { song: SONGS[0] });
      break;
    case STATE.LOADING:
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
  // 楽曲データの読み込みが完了したら呼ばれる
  onVideoReady() {
    buildWordBlocks(player); // game.js：単語単位の声量ブロックを事前構築
    initUI(player); // ui.js：ボタンにイベントを登録
    transition(STATE.PLAYING); // 状態更新
  },
  // 毎フレーム呼ばれるメインのゲームループ
  onTimeUpdate(position) {
    // プレイシーン以外ではスキップ
    if (state !== STATE.PLAYING) return;

    // ---デバッグ表示---
    // const now = performance.now();
    // const interval = lastUpdateTime !== null ? now - lastUpdateTime : 0;
    // lastUpdateTime = now;
    // console.log(`[debug] interval: ${interval.toFixed(1)}ms | touchedY: ${touchedY.toFixed(3)}`);
    // ---------------

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
});
