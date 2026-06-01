// scene.js
// Three.js シーン一式。3D背景・ミクモデル・演出を管理する。
// TextAlive の処理・ゲームロジックは別スクリプトに分離している。

import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { VRMLoaderPlugin } from "@pixiv/three-vrm";
import { EffectComposer } from "three/addons/postprocessing/EffectComposer.js";
import { RenderPass } from "three/addons/postprocessing/RenderPass.js";
// https://threejs.org/docs/#GlitchPass
import { GlitchPass } from "three/addons/postprocessing/GlitchPass.js";
import { OutputPass } from "three/addons/postprocessing/OutputPass.js"; // トーンマッピング/色空間を最終段で適用
import * as sky from "./sky.js";

let scene, camera, renderer, vrm;
let composer, glitchPass;
let glitchTimer = null;
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
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
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

  // =============ポストプロセス=================
  composer = new EffectComposer(renderer);
  const renderPass = new RenderPass(scene, camera);
  glitchPass = new GlitchPass(1); // 変位テクスチャのサイズ(デフォルト64)
  glitchPass.enabled = false;
  composer.addPass(renderPass);
  composer.addPass(glitchPass);
  // 最終段でトーンマッピング＋sRGB変換を行う
  composer.addPass(new OutputPass());

  // =============リサイズ対応=================
  // ウィンドウリサイズ時にアスペクト比を再計算（カメラ比率も変えないと物体が伸びて見える）
  window.addEventListener("resize", () => {
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    composer.setSize(window.innerWidth, window.innerHeight);
  });

  // =============描画ループ=================
  // 演出やモデルの状態を毎フレーム画面に反映させるループ
  function loop() {
    requestAnimationFrame(loop);
    controls.update();
    composer.render();
  }
  loop();
}

// プレイ開始時などに呼ぶ。duration(デフォルト300) ms 激しくグリッチした後フェードアウトして停止する
export function triggerGlitch(duration = 300) {
  if (!glitchPass) return;
  if (glitchTimer) clearTimeout(glitchTimer);

  glitchPass.enabled = true;

  // duration 後に完全停止
  glitchTimer = setTimeout(() => {
    glitchPass.enabled = false;
    glitchTimer = null;
  }, duration);
}

// TextAlive の毎フレームコールバック(内部メインループ)から呼ばれる（main.js の onTimeUpdate 経由）
// "3D オブジェクト（位置・色・密度など）の状態を更新するだけで、renderer.render() は呼ばない！"
// "レンダリングは loop() が毎フレーム行う！"
export function updateScene({ position, duration, score }) {
  // 曲の進行に合わせて空の状況を動かす
  const progress = duration ? position / duration : 0; // 0=開始, 1=終わり
  sky.updateSky(progress);

  // TODO: ひまわりの密度をスコアで変えるなど
  // setFlowerDensity(score);
}
