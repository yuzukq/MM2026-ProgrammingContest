// main.js
// ゲームマネージャ（Unityでいうシングルトン的な立ち位置）
// 全モジュールを import して各種 init・接続するだけで、それ自身はロジックを持たない。
// TextAlive の onTimeUpdate がここに集約され、各モジュールへ振り分ける。

import { Player } from "textalive-app-api";
import { initScene, updateScene } from "./scene.js";
import { buildWordBlocks, updateGame, getWordBlocks, getNormalizedScore } from "./game.js";
import { initCanvas, updateCanvasState, getTouchedY } from "./canvas.js";
import { initUI, updateUI } from "./ui.js";

initScene();
initCanvas();

// =============デバッグ用=========
// let lastUpdateTime = null;
// =============================

// TextAlive のイニシャライズ
const player = new Player({
  app: { token: "test" }, // TODO: 本番トークンに差し替える
  vocalAmplitudeEnabled: true,
});

player.addListener({
  // TextAlive の準備ができたら呼ばれる
  onAppReady(app) {
    if (!app.songUrl) {
      // 「こたえて」
      player.createFromSongUrl("https://piapro.jp/t/6W2N/20251215164617", {
        video: {
          beatId: 4827293,
          chordId: 2963754,
          repetitiveSegmentId: 3086261,
          lyricId: 126519,
          lyricDiffId: 28645,
        },
      });
    }
  },
  // 楽曲データの読み込みが完了したら呼ばれる
  onVideoReady() {
    buildWordBlocks(player); // game.js：単語単位の声量ブロックを事前構築
    initUI(player); // ui.js：ボタンにイベントを登録
  },
  // 毎フレーム呼ばれるメインのゲームループ
  onTimeUpdate(position) {
    const touchedY = getTouchedY(); // canvas.js：正規化済みY座標（上=1, 下=0）

    // ---デバッグ表示---
    // const now = performance.now();
    // const interval = lastUpdateTime !== null ? now - lastUpdateTime : 0;
    // lastUpdateTime = now;
    // console.log(`[debug] interval: ${interval.toFixed(1)}ms | touchedY: ${touchedY.toFixed(3)}`);
    // ---------------

    updateGame(position, touchedY); // game.js：スコア計算
    updateCanvasState({ position, wordBlocks: getWordBlocks() }); // canvas.js：描画用の状態を更新
    updateScene({
      position,
      duration: player.video.duration,
      score: getNormalizedScore(),
    }); // scene.js：3D更新
    updateUI(getNormalizedScore()); // ui.js：スコア表示更新
  },
});
