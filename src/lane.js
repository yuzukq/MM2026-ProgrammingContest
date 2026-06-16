// lane.js
// 声量/タッチ位置のレーン量子化に関する純関数とレーン数の管理
// game.jsの判定・ブロック配置と keyboard.jsのキーのハイライトでレーン定義を共有する

export const LANE_COUNT = 24; // 鍵盤のキー数と一致させること

// 正規化値(0-1) をレーン番号(0..LANE_COUNT-1)へ量子化する
export const toLane = (v01) => Math.max(0, Math.min(LANE_COUNT - 1, Math.floor(v01 * LANE_COUNT))); // 範囲外はクランプ

// レーン番号 → そのレーン中心の正規化Y(0-1)
export const laneCenterY = (lane) => (lane + 0.5) / LANE_COUNT;
