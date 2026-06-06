// scene.js
// Three.js シーン一式。3D背景・ミクモデル・演出を管理する。
// TextAlive の処理・ゲームロジックは別スクリプトに分離している。

import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { VRMLoaderPlugin } from "@pixiv/three-vrm";
import * as sky from "./sky.js";
import * as water from "./water.js";

let scene, camera, renderer, vrm;
// updateScene から操作するオブジェクトはここに宣言する
// let sunMesh, flowerInstancedMesh;

// ── public ──────────────────────────────

// 起動時に1回だけ呼ぶ。Three.js の初期化・アニメーションループの開始を行う。
export function initScene() {
  // =============シーン初期化=================
  scene = new THREE.Scene();

  renderer = new THREE.WebGLRenderer({ antialias: true });
  camera = new THREE.PerspectiveCamera(30, window.innerWidth / window.innerHeight, 0.1, 100000); //FOV,アスペクト比,near,far
  vrm = null;

  renderer.setSize(window.innerWidth, window.innerHeight);
  // モバイル(タッチ端末)は塗る画素数(fillrate)が重いので解像度上限を下げる。
  // 1.5でまだカクつくなら 1 にすると60fpsに張り付くと思う
  const maxPixelRatio = window.matchMedia("(pointer: coarse)").matches ? 1.5 : 2;
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, maxPixelRatio));
  // Sky のHDRな明るさを破綻なく表示するためのトーンマッピング
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 0.25; // 露出（全体の明るさ。GUIのexposure）
  // width/height:100% を明示（cssText が setSize 設定のCSSサイズを上書きするため。
  renderer.domElement.style.cssText =
    "position:fixed;top:0;left:0;width:100%;height:100%;z-index:0;";
  document.body.appendChild(renderer.domElement);

  // =============カメラ=================
  scene.add(camera);
  camera.position.set(0, 0, 7); // 横, 縦, 距離

  // =============ライト=================
  // ミク専用キーライト（暫定）Mtoonの調整の兼ね合いもあるのでこの辺はテクスチャ来てから調整
  // 前方やや上・右から当てる。角度・強さはテクスチャ適用後に詰める想定
  const keyLight = new THREE.DirectionalLight(0xffffff, 4.0);
  keyLight.position.set(3, 4, 10); // カメラ側(前方)・上・右 → ミクの正面を照らす方向
  scene.add(keyLight);

  // =============空＋太陽=================
  sky.initSky(scene); // 空ドームと太陽光を追加

  // =============湖（リアル水面）=================
  water.initWater(scene, sky.getSunDirection());

  // VRMローダー
  const loader = new GLTFLoader();

  loader.register((parser) => new VRMLoaderPlugin(parser));

  loader.load("./assets/models/MMmiku/MMmiku.vrm", (gltf) => {
    vrm = gltf.userData.vrm;
    vrm.scene.position.set(0.8, -1.12, 5.0);
    vrm.scene.rotation.set(0, THREE.MathUtils.degToRad(-50), 0);
    scene.add(vrm.scene);
    console.log(vrm);
  });

  // =============コントロール=================
  // 動的なカメラ制御（参考: https://ics.media/tutorial-three/camera_orbitcontrols/）
  const controls = new OrbitControls(camera, renderer.domElement);
  controls.target.set(0, 0, 0);

  // ★デバッグ用フリーカメラ（使い捨て）。構図が決まったらこの行とループ内の呼び出し・関数本体を消す
  const updateDebugCamera = initDebugCamera(camera, controls);

  // =============リサイズ対応=================
  // ウィンドウリサイズ時にアスペクト比を再計算（カメラ比率も変えないと物体が伸びて見える）
  window.addEventListener("resize", () => {
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, maxPixelRatio));
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
  });

  // =============描画ループ=================
  // 演出やモデルの状態を毎フレーム画面に反映させるループ
  function loop() {
    requestAnimationFrame(loop);
    updateDebugCamera(); // ★デバッグ用（確定後は controls.update() に戻す）
    water.updateWater(sky.getSunDirection()); // 法線スクロール＋太陽方向を空と同期
    renderer.render(scene, camera);
  }
  loop();
}

// "3D オブジェクト（位置・色・密度など）の状態を更新するだけで、renderer.render() は呼ばない！"
// "レンダリングは loop() が毎フレーム行う！"
export function updateScene({ position, duration, score, isNewBeat, beat }) {
  // 曲の進行に合わせて空の状況を動かす
  const progress = duration ? position / duration : 0; // 0=開始, 1=終わり
  sky.updateSky(progress);

  // ビートに合わせて水面に波紋生成
  if (isNewBeat && beat) {
    water.spawnRipple(beat.position === 1); // ダウンビートはデカく
  }
}

// ── internal ────────────────────────────

// ============================================================
// ★デバッグ用フリーカメラ
//   WASD=前後左右 / Q,E=下上 / 矢印=視点回転 / P=現在のカメラ値をコンソール出力
//   構図が決まったら出力値を camera.position.set / controls.target.set に貼り、このブロックを削除してね
// ============================================================
function initDebugCamera(camera, controls) {
  controls.enabled = false; // OrbitControls を止めて手動制御に

  const keys = {};
  const handled = ["w", "a", "s", "d", "q", "e", "arrowup", "arrowdown", "arrowleft", "arrowright", "p"]; // prettier-ignore
  window.addEventListener("keydown", (e) => {
    const k = e.key.toLowerCase();
    if (handled.includes(k)) e.preventDefault(); // 矢印でのページスクロール等を抑制
    keys[k] = true;
  });
  window.addEventListener("keyup", (e) => (keys[e.key.toLowerCase()] = false));

  // 現在の向きから yaw/pitch を初期化
  const f0 = controls.target.clone().sub(camera.position).normalize();
  let yaw = Math.atan2(-f0.x, -f0.z);
  let pitch = Math.asin(THREE.MathUtils.clamp(f0.y, -1, 1));

  const MOVE = 0.15; // 移動速度
  const ROT = 0.02; // 回転速度
  const forward = new THREE.Vector3();
  const right = new THREE.Vector3();
  let logged = false;

  return function updateDebugCamera() {
    if (keys["arrowleft"]) yaw += ROT;
    if (keys["arrowright"]) yaw -= ROT;
    if (keys["arrowup"]) pitch += ROT;
    if (keys["arrowdown"]) pitch -= ROT;
    pitch = THREE.MathUtils.clamp(pitch, -1.5, 1.5);

    forward.set(
      -Math.sin(yaw) * Math.cos(pitch),
      Math.sin(pitch),
      -Math.cos(yaw) * Math.cos(pitch)
    );
    right.set(Math.cos(yaw), 0, -Math.sin(yaw));

    if (keys["w"]) camera.position.addScaledVector(forward, MOVE);
    if (keys["s"]) camera.position.addScaledVector(forward, -MOVE);
    if (keys["d"]) camera.position.addScaledVector(right, MOVE);
    if (keys["a"]) camera.position.addScaledVector(right, -MOVE);
    if (keys["e"]) camera.position.y += MOVE;
    if (keys["q"]) camera.position.y -= MOVE;

    camera.lookAt(
      camera.position.x + forward.x,
      camera.position.y + forward.y,
      camera.position.z + forward.z
    );

    // P で現在値をコピペ用に出力
    if (keys["p"] && !logged) {
      logged = true;
      const p = camera.position;
      const t = camera.position.clone().addScaledVector(forward, 5); // 5先を注視点に
      const f = (n) => n.toFixed(2);
      console.log(`camera.position.set(${f(p.x)}, ${f(p.y)}, ${f(p.z)});`);
      console.log(`controls.target.set(${f(t.x)}, ${f(t.y)}, ${f(t.z)});`);
    }
    if (!keys["p"]) logged = false;
  };
}
