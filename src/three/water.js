// water.js
// 湖（three.js の Water addon ）を担当する。
// ビートをもらい法線移動による波紋を進行させる

import * as THREE from "three";
import { Water } from "three/addons/objects/Water.js";
import RIPPLE_GLSL from "./ripple.glsl?raw"; // 波紋シェーダー
// 湖本体
const LAKE_RADIUS = 60; // 湖の半径
const LAKE_SEGMENTS = 96; // 円周の分割数
const LAKE_Y = -1.2; // 水面の高さ（ミク足元に合わせること）
const WATER_COLOR = 0x0092b7;
const FLOW_SPEED = 0.002; // 鏡面の法線スクロール速度
const REFLECTION_RES = 256; // 反射用テクスチャ解像度。重ければ下げる

// ビート波紋
const MAX_RIPPLES = 6; // 同時に存在できる波紋数
const RIPPLE_CENTER = new THREE.Vector2(0.8, 5.0); // 波紋中心のワールドXZ（ミク足元に合わせること）
const RIPPLE_AMP = 0.1; // 通常拍の波紋の強さ（法線の傾き量）
const RIPPLE_AMP_DOWNBEAT = 0.2; // 小節頭は強く

let water = null;
let rippleCursor = 0; // uRipples 配列への書き込み位置

// ── public ──────────────────────────────

export function initWater(scene, sunDirection) {
  const geometry = new THREE.CircleGeometry(LAKE_RADIUS, LAKE_SEGMENTS);
  water = new Water(geometry, {
    textureWidth: REFLECTION_RES,
    textureHeight: REFLECTION_RES,
    waterNormals: makeFlatNormalTexture(),
    sunDirection: sunDirection.clone().normalize(),
    sunColor: 0xffffff,
    waterColor: WATER_COLOR,
    distortionScale: 2.0, // 水面の歪み
    fog: false,
  });
  water.rotation.x = -Math.PI / 2; // 水平に倒す
  water.position.set(0, LAKE_Y, 0);
  injectRippleShader(water.material); // ビート波紋をシェーダーに仕込む
  scene.add(water);
}

// ミク足元に波紋を1つ発生させる
export function spawnRipple(isDownbeat) {
  if (!water) return;
  const u = water.material.uniforms;
  const now = performance.now() / 1000;
  const amp = isDownbeat ? RIPPLE_AMP_DOWNBEAT : RIPPLE_AMP;
  // 最古スロットを上書き
  u.uRipples.value[rippleCursor].set(RIPPLE_CENTER.x, RIPPLE_CENTER.y, now, amp);
  rippleCursor = (rippleCursor + 1) % MAX_RIPPLES;
  u.uRippleCount.value = Math.min(u.uRippleCount.value + 1, MAX_RIPPLES);
}

// 法線スクロールの更新, 波紋の時刻と太陽方向更新
export function updateWater(sunDirection) {
  if (!water) return;
  water.material.uniforms.time.value += FLOW_SPEED;
  water.material.uniforms.uTime.value = performance.now() / 1000; // 波紋の経過時間の基準
  if (sunDirection) {
    water.material.uniforms.sunDirection.value.copy(sunDirection).normalize();
  }
}

// ── internal ────────────────────────────

// normal生成
function makeFlatNormalTexture() {
  const data = new Uint8Array([128, 128, 255, 255]); // RGB=(128,128,255) → 法線(0,0,1)
  const tex = new THREE.DataTexture(data, 1, 1, THREE.RGBAFormat);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.needsUpdate = true;
  return tex;
}

// Water のフラグメントシェーダーにモンキーパッチ（surfaceNormal を輪状に揺らす）。
function injectRippleShader(material) {
  material.uniforms.uTime = { value: 0 };
  material.uniforms.uRippleCount = { value: 0 };
  material.uniforms.uRipples = {
    value: Array.from({ length: MAX_RIPPLES }, () => new THREE.Vector4()),
  };
  material.fragmentShader = material.fragmentShader
    .replace("uniform vec3 waterColor;", "uniform vec3 waterColor;\n" + RIPPLE_GLSL)
    .replace(
      "vec3 surfaceNormal = normalize( noise.xzy * vec3( 1.5, 1.0, 1.5 ) );",
      "vec3 surfaceNormal = normalize( noise.xzy * vec3( 1.5, 1.0, 1.5 ) );\n\t\t\t\t\tsurfaceNormal = applyRipples( surfaceNormal, worldPosition.xz );"
    );
  material.needsUpdate = true;
}
