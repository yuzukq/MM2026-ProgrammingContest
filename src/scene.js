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

// 起動時に1回だけ呼ぶ。Three.js の初期化・アニメーションループの開始を行う。
export function initScene() {
  // =============シーン初期化=================
  scene = new THREE.Scene();

  renderer = new THREE.WebGLRenderer({ antialias: true });
  camera = new THREE.PerspectiveCamera(30, window.innerWidth / window.innerHeight, 0.1, 100000); //FOV,アスペクト比,near,far
  vrm = null;

  renderer.setSize(window.innerWidth, window.innerHeight);
  // モバイル(タッチ端末)は塗る画素数(fillrate)が重いので解像度上限を下げる。
  // 1.5でまだカクつくなら 1 にすると60fpsに張り付く（鮮明さとのトレードオフ）
  const maxPixelRatio = window.matchMedia("(pointer: coarse)").matches ? 1.5 : 2;
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, maxPixelRatio));
  // Sky のHDRな明るさを破綻なく表示するためのトーンマッピング
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 0.25; // 露出（全体の明るさ。GUIのexposure）
  renderer.domElement.style.cssText = "position:fixed;top:0;left:0;z-index:0;";
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

  // =============オブジェクト（仮）=================
  /*
  // ミクだよー（仮：シリンダー）
  const cylinderGeometry = new THREE.CylinderGeometry(1, 1, 3);
  const cylinderMaterial = new THREE.MeshStandardMaterial({ color: 0x00cabc });
  const cylinder = new THREE.Mesh(cylinderGeometry, cylinderMaterial);
  cylinder.position.set(4, 0, 0);
  scene.add(cylinder);
  */
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
  // ポストプロセスは使わず renderer 直描画（トーンマッピングは renderer.toneMapping で適用される）
  function loop() {
    requestAnimationFrame(loop);
    controls.update();
    water.updateWater(sky.getSunDirection()); // 法線スクロール＋太陽方向を空と同期
    renderer.render(scene, camera);
  }
  loop();
}

// TextAlive の毎フレームコールバック(内部メインループ)から呼ばれる（main.js の onTimeUpdate 経由）
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

  // TODO: ひまわりの密度をスコアで変えるなど この辺は相談だな...
  // setFlowerDensity(score);
}
