// camera.js
// サビ/それ以外でのプリセット(position・target・五線譜位置)切り替えを行う。
//

import * as THREE from "three";

// デバッグようなので構図が確定したら false にしてね。
const DEBUG_CAMERA = false;

const CAM_PRESETS = {
  // 曲頭の構図(ミクを映さない画角に)
  // ライブの導入間を出しつつ1拍目から2拍目がくるまでアニメーションの再生速度が安定するまでの区間を隠蔽する
  intro: {
    position: [-0.17, 0.42, 6.77],
    target: [1.1, 2.17, 2.26],
    staffPos: [2.37, 7.31, -7.11],
  },
  // Aメロなどサビ以外の構図
  verse: {
    position: [-0.17, 0.23, 6.77],
    target: [1.19, 0.36, 1.96],
    staffPos: [2.76, 1.96, -7.11],
  },
  // サビの構図
  chorus: {
    position: [-2.39, -0.12, 6.84],
    target: [2.25, 0.38, 5.04],
    staffPos: [11.05, 1.95, 3.95],
  },
};

const EASE_MS = 1500; // プリセット切替の補間時間
const INTRO_REVEAL_MS = 2500; // イントロ → 通常構図への切り替え時間

// デバッグ操作速度
const MOVE = 0.01; // カメラ移動(WASD/QE)
const ROT = 0.001; // 視点回転(矢印)
const STAFF_MOVE = 0.01; // 五線譜移動(IJKL/UO)

let camera = null;

// 補間の現在値（本番は毎フレーム更新、デバッグでは 五線譜 を IJKLUO で直接動かす）
const posCurrent = new THREE.Vector3();
const targetCurrent = new THREE.Vector3();
const staffCurrent = new THREE.Vector3(0, 1.4, -3.0); // 初期化前に lyric が読んでも破綻しない既定値
// 補間の from(起点)/to(目標)
const posFrom = new THREE.Vector3();
const posTo = new THREE.Vector3();
const targetFrom = new THREE.Vector3();
const targetTo = new THREE.Vector3();
const staffFrom = new THREE.Vector3();
const staffTo = new THREE.Vector3();

let transStart = -Infinity; // 補間開始時刻(ms)。-Infinity なら補間完了済み(=to に張り付き)
let transDur = EASE_MS;
let curPreset = "verse";
let isIntroHold = false; // イントロ遷移中のフラグtrue の間はサビ判定での切替を抑止する

let debug = null; // デバッグ自由飛行の状態（DEBUG_CAMERA 時のみ）

// ── public ──────────────────────────────

// scene.js から1回だけ。camera を受け取り verse プリセットを初期状態として適用する。
export function initCamera(sceneCamera, controls) {
  camera = sceneCamera;
  controls.enabled = false; // カメラはスクリプト駆動するので OrbitControls は止める

  const v = CAM_PRESETS.verse;
  posCurrent.fromArray(v.position);
  targetCurrent.fromArray(v.target);
  staffCurrent.fromArray(v.staffPos);
  // 起点・目標とも verse に揃えておく
  posFrom.copy(posCurrent);
  posTo.copy(posCurrent);
  targetFrom.copy(targetCurrent);
  targetTo.copy(targetCurrent);
  staffFrom.copy(staffCurrent);
  staffTo.copy(staffCurrent);

  camera.position.copy(posCurrent);
  camera.lookAt(targetCurrent);

  if (DEBUG_CAMERA) initDebug();
}

// scene.updateScene からonTimeUpdate駆動でサビ判定でプリセット切替トリガーを打つ
export function updateCamera({ isInChorus }) {
  if (DEBUG_CAMERA) return; // デバッグ中はプリセット駆動しない
  if (isIntroHold) return; // イントロは通常構図へ切り替えない

  const wantPreset = isInChorus ? "chorus" : "verse";
  if (wantPreset !== curPreset) startTransition(wantPreset);
}

// イントロアングルの制御
export function applyIntro() {
  if (DEBUG_CAMERA) return;
  const p = CAM_PRESETS.intro;
  posCurrent.fromArray(p.position);
  targetCurrent.fromArray(p.target);
  staffCurrent.fromArray(p.staffPos);
  posFrom.copy(posCurrent);
  posTo.copy(posCurrent);
  targetFrom.copy(targetCurrent);
  targetTo.copy(targetCurrent);
  staffFrom.copy(staffCurrent);
  staffTo.copy(staffCurrent);
  transStart = -Infinity;
  curPreset = "intro";
  isIntroHold = true;
  if (camera) {
    camera.position.copy(posCurrent);
    camera.lookAt(targetCurrent);
  }
}

// 導入ショットから通常構図へパン
// テンポ安定後に呼ぶ
export function revealFromIntro(isInChorus = false) {
  if (DEBUG_CAMERA) return;
  if (!isIntroHold) return;
  isIntroHold = false;
  startTransition(isInChorus ? "chorus" : "verse", INTRO_REVEAL_MS); // 現在の状態に合わせて遷移
}

// sceneRenderLoop の RAF から毎フレーム。プリセット補間を実際の camera に適用する
export function tickCamera() {
  if (!camera) return;
  const now = performance.now();

  if (DEBUG_CAMERA) {
    tickDebug();
    return;
  }

  // プリセット補間（現在値=from→to を ease で進める）
  const e = easeInOutSine(clamp01((now - transStart) / transDur));
  posCurrent.lerpVectors(posFrom, posTo, e);
  targetCurrent.lerpVectors(targetFrom, targetTo, e);
  staffCurrent.lerpVectors(staffFrom, staffTo, e);

  camera.position.copy(posCurrent);
  camera.lookAt(targetCurrent);
}

// lyric.js が現在の五線譜位置（補間途中値）を読むためのゲッターメソッド
export function getStaffTarget() {
  return staffCurrent;
}

// ── internal ────────────────────────────

// プリセット切替を開始
// 現在の補間途中値を起点にして新プリセットへ向かう
function startTransition(name, durationMs = EASE_MS) {
  const p = CAM_PRESETS[name];
  posFrom.copy(posCurrent);
  targetFrom.copy(targetCurrent);
  staffFrom.copy(staffCurrent);
  posTo.fromArray(p.position);
  targetTo.fromArray(p.target);
  staffTo.fromArray(p.staffPos);
  transStart = performance.now();
  transDur = durationMs;
  curPreset = name;
}

// ============================================================
// 　★デバッグ用
//   WASD=前後左右 / Q,E=下上 / 矢印=視点回転
//   I,K=五線譜の上下 / J,L=五線譜の左右 / U,O=五線譜の奥手前
//   P=現在のカメラ＋五線譜をプリセット形式でコンソール出力（CAM_PRESETS にそのまま貼れる）
//   構図が確定したら DEBUG_CAMERA を false にする
// ============================================================
function initDebug() {
  const keys = {};
  const handled = ["w", "a", "s", "d", "q", "e", "arrowup", "arrowdown", "arrowleft", "arrowright", "i", "j", "k", "l", "u", "o", "p"]; // prettier-ignore
  window.addEventListener("keydown", (e) => {
    const k = e.key.toLowerCase();
    if (handled.includes(k)) e.preventDefault(); // 矢印でのページスクロール等を抑制
    keys[k] = true;
  });
  window.addEventListener("keyup", (e) => (keys[e.key.toLowerCase()] = false));

  // 現在の向きから yaw/pitch を初期化
  const f0 = targetCurrent.clone().sub(posCurrent).normalize();
  debug = {
    keys,
    yaw: Math.atan2(-f0.x, -f0.z),
    pitch: Math.asin(THREE.MathUtils.clamp(f0.y, -1, 1)),
    forward: new THREE.Vector3(),
    right: new THREE.Vector3(),
    logged: false,
  };
}

function tickDebug() {
  const d = debug;
  const k = d.keys;

  // 視点回転
  if (k["arrowleft"]) d.yaw += ROT;
  if (k["arrowright"]) d.yaw -= ROT;
  if (k["arrowup"]) d.pitch += ROT;
  if (k["arrowdown"]) d.pitch -= ROT;
  d.pitch = THREE.MathUtils.clamp(d.pitch, -1.5, 1.5);

  d.forward.set(
    -Math.sin(d.yaw) * Math.cos(d.pitch),
    Math.sin(d.pitch),
    -Math.cos(d.yaw) * Math.cos(d.pitch)
  );
  d.right.set(Math.cos(d.yaw), 0, -Math.sin(d.yaw));

  // カメラ移動
  if (k["w"]) posCurrent.addScaledVector(d.forward, MOVE);
  if (k["s"]) posCurrent.addScaledVector(d.forward, -MOVE);
  if (k["d"]) posCurrent.addScaledVector(d.right, MOVE);
  if (k["a"]) posCurrent.addScaledVector(d.right, -MOVE);
  if (k["e"]) posCurrent.y += MOVE;
  if (k["q"]) posCurrent.y -= MOVE;

  camera.position.copy(posCurrent);
  targetCurrent.copy(posCurrent).addScaledVector(d.forward, 5); // 5先を注視点に（P出力にも使う）
  camera.lookAt(targetCurrent);

  // 五線譜移動（IJKL=XY平面、U/O=Z）
  if (k["l"]) staffCurrent.x += STAFF_MOVE; // L: 右
  if (k["j"]) staffCurrent.x -= STAFF_MOVE; // J: 左
  if (k["i"]) staffCurrent.y += STAFF_MOVE; // I: 上
  if (k["k"]) staffCurrent.y -= STAFF_MOVE; // K: 下
  if (k["o"]) staffCurrent.z += STAFF_MOVE; // O: 前
  if (k["u"]) staffCurrent.z -= STAFF_MOVE; // U: 後

  // P でプリセット形式の座標を出力
  if (k["p"] && !d.logged) {
    d.logged = true;
    const f = (n) => +n.toFixed(2);
    const arr = (v) => `[${f(v.x)}, ${f(v.y)}, ${f(v.z)}]`;
    console.log(
      `{ position: ${arr(posCurrent)}, target: ${arr(targetCurrent)}, staffPos: ${arr(staffCurrent)} },`
    );
  }
  if (!k["p"]) d.logged = false;
}

// イージング（滑らかな出入り）
function easeInOutSine(t) {
  return -(Math.cos(Math.PI * t) - 1) / 2;
}

// 0..1 にクランプ
function clamp01(t) {
  return Math.max(0, Math.min(1, t));
}
