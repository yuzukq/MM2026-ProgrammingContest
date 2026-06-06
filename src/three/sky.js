// sky.js
// 太陽は曲の進行に合わせて 朝→昼→夕方 と動き、空の色も自動で追従する。
// 太陽方向は Sky の色・DirectionalLight・（将来の）水面反射で共有する単一の光源。

import * as THREE from "three";
import { Sky } from "three/addons/objects/Sky.js";

// 空の見た目パラメータ（Sky シェーダの uniform）
// Ref: https://threejs.org/examples/#webgl_shaders_sky
const TURBIDITY = 1; // 大気の濁り
const RAYLEIGH = 1; // レイリー散乱(高いほど青が濃く、低空で赤みが増す）あまりいじるな
const MIE_COEFFICIENT = 0.005; // 太陽周りのもやの量
const MIE_DIRECTIONAL_G = 0.3; // 太陽周りのもやの指向性

// 太陽の軌道（曲進行 0→1 に対する高度・方角）
const SUN_ELEVATION_MIN = 5; // 朝/夕の高度[度]（地平線すれすれ）
const SUN_ELEVATION_MAX = 50; // 南中時の高度[度]（高すぎると空が白飛びし青が消えるので抑える）
const SUN_AZIMUTH_START = 90; // 朝の方角[度]（東）
const SUN_AZIMUTH_SWEEP = 180; // 終曲までに動く方角の幅（東→西）

// 太陽光の強さ
const SUN_LIGHT_MIN = 1.0; // 低い太陽でも残す最低光量
const SUN_LIGHT_RANGE = 3.0; // 高度に応じて加算される光量

let sky = null;
let sunLight = null;
// 毎フレーム使い回してアロケーションを避けるため
const sunVec = new THREE.Vector3();

export function initSky(scene) {
  sky = new Sky();
  sky.scale.setScalar(10000); // カメラの far(scene.js) より内側に収める
  sky.material.uniforms.turbidity.value = TURBIDITY;
  sky.material.uniforms.rayleigh.value = RAYLEIGH;
  sky.material.uniforms.mieCoefficient.value = MIE_COEFFICIENT;
  sky.material.uniforms.mieDirectionalG.value = MIE_DIRECTIONAL_G;
  scene.add(sky);

  sunLight = new THREE.DirectionalLight(0xffffff, SUN_LIGHT_RANGE);
  scene.add(sunLight);

  updateSky(0); // 初期は朝
}

// 曲のprogress(0→1) に応じて空と太陽を朝→昼→夕方へ遷移
export function updateSky(progress) {
  if (!sky) return;

  // 高度低→高→低を三角波0→1→0で等速に描く
  const arc = 1 - Math.abs(progress * 2 - 1); // progress 0→0.5→1 で 0→1→0
  const elevation = SUN_ELEVATION_MIN + arc * (SUN_ELEVATION_MAX - SUN_ELEVATION_MIN);
  // 方角東→西へ定速度移動
  const azimuth = SUN_AZIMUTH_START + progress * SUN_AZIMUTH_SWEEP;

  // 高度・方角から太陽方向の単位ベクトルを作る（phi=天頂からの角, theta=方位角）
  const phi = THREE.MathUtils.degToRad(90 - elevation);
  const theta = THREE.MathUtils.degToRad(azimuth);
  sunVec.setFromSphericalCoords(1, phi, theta);

  // 太陽位置を更新と空の色の再計算
  sky.material.uniforms.sunPosition.value.copy(sunVec);

  // 太陽光を同じ方向へ。高度が高いほど明るく、低いほど暖色にする
  const sinElev = Math.sin(THREE.MathUtils.degToRad(elevation));
  sunLight.position.copy(sunVec).multiplyScalar(100);
  // 他物体に対する光強度
  sunLight.intensity = SUN_LIGHT_MIN + sinElev * SUN_LIGHT_RANGE;
  const warmth = 1 - sinElev; // 0(高い太陽=白) → ~0.9(低い太陽=暖色)
  sunLight.color.setRGB(1, 1 - warmth * 0.35, 1 - warmth * 0.6);
}

// 現在の太陽方向（単位ベクトル）を返す。水面の反射など、空と同じ太陽を共有する用途で使う。
// 返すのは内部の live な Vector3 なので、呼び出し側で書き換えないこと（copyして使う）。
export function getSunDirection() {
  return sunVec;
}
