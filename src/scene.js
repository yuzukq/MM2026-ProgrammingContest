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

let scene, camera, renderer, vrm;
let composer, glitchPass;
let glitchTimer = null;
// updateScene から操作するオブジェクトはここに宣言する
// let sunMesh, flowerInstancedMesh;

// 起動時に1回だけ呼ぶ。Three.js の初期化・アニメーションループの開始を行う。
export function initScene() {
  // =============シーン初期化=================
  scene = new THREE.Scene();
  renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true }); // 透過：HTML/UI層を重ねるため
  camera = new THREE.PerspectiveCamera(30, window.innerWidth / window.innerHeight, 0.1, 1000); //FOV,アスペクト比,near,far,near
  vrm = null;

  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.domElement.style.cssText = "position:fixed;top:0;left:0;z-index:0;";
  document.body.appendChild(renderer.domElement);

  // =============カメラ=================
  scene.add(camera);
  camera.position.set(0, 0, 7); // 横, 縦, 距離

  // =============ライト=================
  //環境光
  //const ambientLight = new THREE.AmbientLight(0xf5fffa, 4); // 色, 強さ
  //scene.add(ambientLight);

  //太陽光
  const directionalLight = new THREE.DirectionalLight(0xffffff, 6); // 色, 強さ
  directionalLight.position.set(-5.0, 3.0, 1.0);
  scene.add(directionalLight);
  //ヘルパー
  //const directionalHelper = new THREE.DirectionalLightHelper(directionalLight, 1);
  //scene.add(directionalHelper);

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
  // Three.jsキャンバスの透過を維持する（HTML/UIレイヤーを重ねるため）
  renderPass.clearAlpha = 0;
  glitchPass = new GlitchPass(1); // 変位テクスチャのサイズ(デフォルト64)
  glitchPass.enabled = false;
  composer.addPass(renderPass);
  composer.addPass(glitchPass);

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
  // TODO: 太陽を東→南中→西へ動かす、ひまわりの密度をスコアで変えるなど
  // const progress = position / duration; // 曲の進行率（0=開始, 1=終わり）
  // sunMesh.position.x = Math.cos(progress * Math.PI) * 10;
  // sunMesh.position.y = Math.sin(progress * Math.PI) * 8;
  // setFlowerDensity(score);
}
