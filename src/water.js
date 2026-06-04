// water.js
// リアルな湖（three.js の Water addon を流用）を担当する。
// シングルトンなのでモジュールスコープ変数＋関数エクスポート（呼び出し側は import * as water）。
// 段階1: 空を反射する「凪いだ鏡面の湖」を立てる（細かい揺れ・波紋は段階2でシェーダーに数式で足す）。
// 法線マップは配布素材を避けるためコードで生成（外部テクスチャ不要）。

import * as THREE from "three";
import { Water } from "three/addons/objects/Water.js";

// 湖本体
const LAKE_SIZE = 50; // 湖の広さ
const LAKE_Y = -1.2; // 水面の高さ（ミク足元に合わせること）
const WATER_COLOR = 0x0092b7;
const DISTORTION_SCALE = 1.0; // 反射の歪み。下げるほど凪いだ鏡面
const FLOW_SPEED = 0.002; // 鏡面の法線スクロール速度
const REFLECTION_RES = 256; // 反射用テクスチャ解像度。重ければ下げる

// ビート波紋
const MAX_RIPPLES = 8; // 同時に存在できる波紋数（GLSL側の配列長と一致させること）
const RIPPLE_CENTER = new THREE.Vector2(0.8, 5.0); // 波紋中心のワールドXZ（ミク足元に合わせること）
const RIPPLE_AMP = 0.1; // 通常拍の波紋の強さ（法線の傾き量）
const RIPPLE_AMP_DOWNBEAT = 0.5; // 小節頭は強く

// Water のフラグメントシェーダーに差し込むsl
const RIPPLE_GLSL = /* glsl */ `
  #define MAX_RIPPLES ${MAX_RIPPLES}
  // 波面が広がる速さ(単位/秒) / 輪の太さ / 時間減衰(大きいほど早く消える)
  #define RIPPLE_SPEED 10.0
  #define RIPPLE_WIDTH 1.0
  #define RIPPLE_DECAY 1.6
  uniform float uTime;
  uniform int uRippleCount;
  uniform vec4 uRipples[ MAX_RIPPLES ]; // xy=中心XZ, z=発生時刻, w=振幅

  vec3 applyRipples( vec3 n, vec2 posXZ ) {
    vec2 perturb = vec2( 0.0 );
    for ( int i = 0; i < MAX_RIPPLES; i ++ ) {
      if ( i >= uRippleCount ) break;
      vec4 rp = uRipples[ i ];
      float age = uTime - rp.z;
      if ( age < 0.0 ) continue;
      vec2 toC = posXZ - rp.xy;
      float d = length( toC );
      float r = age * RIPPLE_SPEED;            // 波面の現在半径
      float x = ( d - r ) / RIPPLE_WIDTH;
      float band = exp( - x * x );             // 波面付近だけ
      float slope = - 2.0 * x / RIPPLE_WIDTH * band; // 波面の傾き＝法線の揺れ
      float decay = exp( - age * RIPPLE_DECAY );
      vec2 dir = d > 0.0001 ? toC / d : vec2( 0.0 );
      perturb += dir * slope * rp.w * decay;
    }
    n.xz += perturb;
    return normalize( n );
  }
`;

let water = null;
let rippleCursor = 0; // uRipples 配列への書き込み位置

// normal生成(時間があれば自前で作るかも)
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
