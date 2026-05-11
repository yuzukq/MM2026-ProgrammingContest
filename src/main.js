// main.js
// ゲームマネージャ（Unityでいうシングルトン的な立ち位置）
// 全モジュールを import して各種 init・接続するだけで、それ自身はロジックを持たない。
// TextAlive の onTimeUpdate がここに集約され、各モジュールへ振り分ける。

import { Player } from "textalive-app-api";
import { initScene, updateScene } from "./scene.js";
import { buildWordBlocks, updateGame, getWordBlocks, getNormalizedScore } from "./game.js";
import { initCanvas, drawFrame } from "./canvas.js";
import { initUI, updateUI } from "./ui.js";

initScene();
initCanvas();

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
    const touchedY = 0.5; // TODO: マウス/タッチのY座標を 0〜1 に正規化した値

    updateGame(position, touchedY); // game.js：スコア計算
    drawFrame({ position, wordBlocks: getWordBlocks(), touchedY }); // canvas.js：Canvas描画
    updateScene({
      position,
      duration: player.video.duration,
      score: getNormalizedScore(),
    }); // scene.js：3D更新
    updateUI(getNormalizedScore()); // ui.js：スコア表示更新
  },
});
