// scene.js
// Three.js シーン一式。3D背景・ミクモデル・演出を管理する。
// TextAlive の処理・ゲームロジックは別スクリプトに分離している。

import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";

let scene, camera, renderer;
// updateScene から操作するオブジェクトはここに宣言する
// let sunMesh, flowerInstancedMesh;

// 起動時に1回だけ呼ぶ。Three.js の初期化・アニメーションループの開始を行う。
export function initScene() {
  // =============シーン初期化=================
  scene = new THREE.Scene();
  renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true }); // 透過：HTML/UI層を重ねるため
  camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);

  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.domElement.style.cssText = "position:fixed;top:0;left:0;z-index:0;";
  document.body.appendChild(renderer.domElement);

  // =============カメラ=================
  scene.add(camera);
  camera.position.set(0, 0, 7); // 横, 縦, 距離

  // =============ライト=================
  const ambientLight = new THREE.AmbientLight(0xf5fffa, 4); // 色, 強さ
  scene.add(ambientLight);

  // =============オブジェクト（仮）=================
  // ミクだよー（仮：シリンダー）
  const cylinderGeometry = new THREE.CylinderGeometry(1, 1, 3);
  const cylinderMaterial = new THREE.MeshStandardMaterial({ color: 0x00cabc });
  const cylinder = new THREE.Mesh(cylinderGeometry, cylinderMaterial);
  cylinder.position.set(4, 0, 0);
  scene.add(cylinder);

  // =============コントロール=================
  // 動的なカメラ制御（参考: https://ics.media/tutorial-three/camera_orbitcontrols/）
  const controls = new OrbitControls(camera, renderer.domElement);

  // =============リサイズ対応=================
  // ウィンドウリサイズ時にアスペクト比を再計算（カメラ比率も変えないと物体が伸びて見える）
  window.addEventListener("resize", () => {
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
  });

  // =============描画ループ=================
  // 演出やモデルの状態を毎フレーム画面に反映させるループ
  function loop() {
    requestAnimationFrame(loop);
    controls.update();
    renderer.render(scene, camera);
  }
  loop();
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
