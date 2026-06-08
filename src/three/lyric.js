// lyric.js
// 歌詞ビルボード演出。フレーズごとに「波打つ五線譜 + 歌詞テキスト」を出し入れする。

import * as THREE from "three";
import STAFF_VERT from "./staff.vert.glsl?raw";
import STAFF_FRAG from "./staff.frag.glsl?raw";

// ── 五線譜（波打つ5本線）──
const STAFF_LINE_COUNT = 5; // 線の本数
const STAFF_WIDTH = 4.0; // 五線譜の横幅（ワールド単位）
const STAFF_LINE_GAP = 0.18; // 線の間隔
const STAFF_LINE_THICKNESS = 0.02; // 線の太さ
const STAFF_SEGMENTS = 48; // 横方向の分割数（多いほど波が滑らか）
const STAFF_COLOR = 0xeaf6ff;
// 五線譜のsin揺れ
const WAVE_AMP = 0.06; // 波の振幅
const WAVE_FREQ = 1.6; // 周波数
const WAVE_SPEED = 1.2; // 波のスクロール速度
// 右→左へ徐々に描き出すドローオン
const REVEAL_MAX = 1.02; // 描画範囲の最大値（左端 xr=1 を確実に含むよう 1 より少し大きく）

// ── テキスト ──
const TEXT_HEIGHT = 0.5; // テキスト平面の高さ（横幅は文字数で決まる）
const TEXT_COLOR = "#ffffff";
const TEXT_FONT = "bold 96px sans-serif";
const TEXT_RESOLUTION = 128; // Canvas の縦解像度（px）

// ── 配置（仮。カメラワーク確定後に調整）──
const SPAWN_POSITION = new THREE.Vector3(0, 1.4, 2.0); // 五線譜の出現位置

// ── ライフサイクル（秒）──
const ENTER_DUR = 0.4; // 登場（右→左に徐々に描き出す）
const HOLD_DUR = 3.0; // 保持（Phase 0 の確認用。Phase 1 ではフレーズ長に合わせる）
const EXIT_DUR = 0.5; // 退場（フェードアウト）
const EXIT_RISE = 0.2; // 退場時に上へ昇る距離

let scene = null;
let camera = null;
const instances = []; // 出現中のビルボード群

// ── public ──────────────────────────────

export function initLyric(parentScene, sceneCamera) {
  scene = parentScene;
  camera = sceneCamera;
}

// フレーズ1つぶんの五線譜＋テキストを出現させる
export function spawnPhrase(text, { hold = HOLD_DUR } = {}) {
  if (!scene) return;

  const group = new THREE.Group();
  group.position.copy(SPAWN_POSITION);

  const staff = buildStaff();
  const textMesh = buildText(text);
  group.add(staff.mesh, textMesh);
  scene.add(group);

  instances.push({
    group,
    staffMaterial: staff.material,
    textMaterial: textMesh.material,
    bornAt: performance.now() / 1000,
    holdDur: hold,
    totalDur: ENTER_DUR + hold + EXIT_DUR,
  });
}

// scene描画のRAFから呼ぶ呼ぶ
// 波の進行・ライフサイクル（登場/保持/退場）の更新と後始末
export function updateLyric() {
  const now = performance.now() / 1000;

  for (let i = instances.length - 1; i >= 0; i--) {
    const inst = instances[i];
    const age = now - inst.bornAt;

    // 寿命切れ：シーンから除去して破棄
    if (age >= inst.totalDur) {
      scene.remove(inst.group);
      disposeGroup(inst.group);
      instances.splice(i, 1);
      continue;
    }

    // 現在のフェーズの状態を求めてビルボードに適用
    applyState(inst, phaseState(age, inst.holdDur), now);
  }
}

// ── internal ────────────────────────────

// 経過時間(age)から表示状態 { reveal, opacity, textOpacity, rise, scale } を返す
function phaseState(age, holdDur) {
  // 出現
  if (age < ENTER_DUR) {
    return enterState(age / ENTER_DUR);
  }
  const heldFor = age - ENTER_DUR;
  // 保持
  if (heldFor < holdDur) {
    return holdState(heldFor);
  }
  // 退場
  return exitState((heldFor - holdDur) / EXIT_DUR);
}

// 出現時：
// 右端から左へ徐々に描き出す（reveal を伸ばす）→ 五線譜が引かれてからテキスト
function enterState(t) {
  const e = easeOutSine(t);
  return {
    reveal: e * REVEAL_MAX,
    opacity: 1,
    textOpacity: smoothstep(0.45, 1.0, t),
    rise: 0,
    scale: 0.96 + 0.04 * e,
  };
}

// 保持：完全表示, 微かに上下に漂わせる
function holdState(elapsed) {
  return {
    reveal: REVEAL_MAX,
    opacity: 1,
    textOpacity: 1,
    rise: Math.sin(elapsed * 1.2) * 0.02,
    scale: 1,
  };
}

// 退場時：全体フェードアウトしつつ、少し上へ
function exitState(t) {
  const e = easeInSine(t);
  return {
    reveal: REVEAL_MAX,
    opacity: 1 - e,
    textOpacity: 1 - e,
    rise: e * EXIT_RISE,
    scale: 1 + 0.04 * e,
  };
}

// 表示状態をビルボード（五線譜＋テキスト）に反映する
function applyState(inst, s, now) {
  inst.group.position.y = SPAWN_POSITION.y + s.rise;
  inst.group.scale.setScalar(s.scale);
  inst.staffMaterial.uniforms.uTime.value = now; // 波は常に進行
  inst.staffMaterial.uniforms.uReveal.value = s.reveal;
  inst.staffMaterial.uniforms.uOpacity.value = s.opacity;
  inst.textMaterial.opacity = s.textOpacity;
  if (camera) inst.group.quaternion.copy(camera.quaternion); // カメラ向きにビルボード
}

// 波打つ五線譜を生成
function buildStaff() {
  const geometry = new THREE.PlaneGeometry(STAFF_WIDTH, STAFF_LINE_THICKNESS, STAFF_SEGMENTS, 1);
  // 5本ぶんに複製し y をずらして1ジオメトリに統合
  const geometries = [];
  for (let i = 0; i < STAFF_LINE_COUNT; i++) {
    const g = geometry.clone();
    g.translate(0, (i - (STAFF_LINE_COUNT - 1) / 2) * STAFF_LINE_GAP, 0);
    geometries.push(g);
  }
  const merged = mergeGeometries(geometries);
  geometry.dispose();
  geometries.forEach((g) => g.dispose());

  const material = new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    uniforms: {
      uTime: { value: 0 },
      uOpacity: { value: 1 }, // 全体フェード（退場用）
      uReveal: { value: 0 }, // 描画範囲（右→左）。0=未描画, REVEAL_MAX=全描画
      uAmp: { value: WAVE_AMP },
      uFreq: { value: WAVE_FREQ },
      uSpeed: { value: WAVE_SPEED },
      uWidth: { value: STAFF_WIDTH }, // x→0..1正規化用
      uColor: { value: new THREE.Color(STAFF_COLOR) },
    },
    vertexShader: STAFF_VERT,
    fragmentShader: STAFF_FRAG,
  });

  return { mesh: new THREE.Mesh(merged, material), material };
}

// テキストを Canvas2D で描いてテクスチャ化し、Plane に貼る
function buildText(text) {
  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d");
  ctx.font = TEXT_FONT;
  const metrics = ctx.measureText(text);
  const padding = TEXT_RESOLUTION * 0.3;
  canvas.width = Math.ceil(metrics.width + padding * 2);
  canvas.height = TEXT_RESOLUTION;

  // measureText 後に canvas をリサイズすると font がリセットされるので再設定
  ctx.font = TEXT_FONT;
  ctx.fillStyle = TEXT_COLOR;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(text, canvas.width / 2, canvas.height / 2);

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.minFilter = THREE.LinearFilter;

  const aspect = canvas.width / canvas.height;
  const geometry = new THREE.PlaneGeometry(TEXT_HEIGHT * aspect, TEXT_HEIGHT);
  const material = new THREE.MeshBasicMaterial({
    map: texture,
    transparent: true,
    opacity: 0,
    depthWrite: false,
  });
  const mesh = new THREE.Mesh(geometry, material);
  mesh.position.z = 0.05; // 五線譜のわずかに手前
  return mesh;
}

// group 配下のジオメトリ・マテリアル・テクスチャを破棄
function disposeGroup(group) {
  group.traverse((obj) => {
    if (obj.geometry) obj.geometry.dispose();
    if (obj.material) {
      obj.material.map?.dispose();
      obj.material.dispose();
    }
  });
}

// 複数 BufferGeometry を1つに統合
function mergeGeometries(geometries) {
  const merged = new THREE.BufferGeometry();
  const position = [];
  const uv = [];
  const index = [];
  let vertexOffset = 0;
  for (const g of geometries) {
    const pos = g.attributes.position.array;
    const u = g.attributes.uv.array;
    position.push(...pos);
    uv.push(...u);
    const idx = g.index.array;
    for (let i = 0; i < idx.length; i++) index.push(idx[i] + vertexOffset);
    vertexOffset += pos.length / 3;
  }
  merged.setAttribute("position", new THREE.Float32BufferAttribute(position, 3));
  merged.setAttribute("uv", new THREE.Float32BufferAttribute(uv, 2));
  merged.setIndex(index);
  return merged;
}

// イージング
function easeOutSine(t) {
  return Math.sin((t * Math.PI) / 2);
}
function easeInSine(t) {
  return 1 - Math.cos((t * Math.PI) / 2);
}

// GLSL の smoothstep と同等（edge0→edge1 を滑らかに 0→1）
function smoothstep(edge0, edge1, x) {
  const t = Math.max(0, Math.min(1, (x - edge0) / (edge1 - edge0)));
  return t * t * (3 - 2 * t);
}
