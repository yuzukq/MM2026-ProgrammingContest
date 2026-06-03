// water.js
// リアルな湖（three.js の Water addon を流用）を担当する。
// シングルトンなのでモジュールスコープ変数＋関数エクスポート（呼び出し側は import * as water）。
// 段階1: 空を反射する「凪いだ鏡面の湖」を立てる（細かい揺れ・波紋は段階2でシェーダーに数式で足す）。
// 法線マップは配布素材を避けるためコードで生成（外部テクスチャ不要）。

import * as THREE from "three";
import { Water } from "three/addons/objects/Water.js";

const LAKE_SIZE = 10; // 湖の広さ
const LAKE_Y = -1.2; // 水面の高さ（ミク足元に合わせる）
const WATER_COLOR = 0x0a6075;
const DISTORTION_SCALE = 0.8; // 反射の歪み。海は3.7。下げるほど凪いだ鏡面
const FLOW_SPEED = 0.002; // 法線スクロール速度（穏やか）
const REFLECTION_RES = 512; // 反射用テクスチャ解像度。重ければ下げる（モバイル対策）

let water = null;

// ほぼ平らな法線(0,0,1)の1x1テクスチャ。
function makeFlatNormalTexture() {
  const data = new Uint8Array([128, 128, 255, 255]); // RGB=(128,128,255) → 法線(0,0,1)
  const tex = new THREE.DataTexture(data, 1, 1, THREE.RGBAFormat);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.needsUpdate = true;
  return tex;
}

export function initWater(scene, sunDirection) {
  const geometry = new THREE.PlaneGeometry(LAKE_SIZE, LAKE_SIZE);
  water = new Water(geometry, {
    textureWidth: REFLECTION_RES,
    textureHeight: REFLECTION_RES,
    waterNormals: makeFlatNormalTexture(),
    sunDirection: sunDirection.clone().normalize(),
    sunColor: 0xffffff,
    waterColor: WATER_COLOR,
    distortionScale: DISTORTION_SCALE,
    fog: false,
  });
  water.rotation.x = -Math.PI / 2; // 水平に倒す
  water.position.set(0, LAKE_Y, 0);
  scene.add(water);
}

// 法線スクロールを進め、太陽方向を空と同期させる。
export function updateWater(sunDirection) {
  if (!water) return;
  water.material.uniforms.time.value += FLOW_SPEED;
  if (sunDirection) {
    water.material.uniforms.sunDirection.value.copy(sunDirection).normalize();
  }
}
