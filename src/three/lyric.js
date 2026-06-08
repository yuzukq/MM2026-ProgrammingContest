// lyric.js
// 歌詞ビルボード演出。フレーズごとに「波打つ五線譜 + 歌詞テキスト」を出し入れする。

import * as THREE from "three";

// ── 五線譜（波打つ5本線）──
const STAFF_LINE_COUNT = 5; // 線の本数
const STAFF_WIDTH = 4.0; // 五線譜の横幅（ワールド単位）
const STAFF_LINE_GAP = 0.18; // 線の間隔
const STAFF_LINE_THICKNESS = 0.012; // 線の太さ
const STAFF_SEGMENTS = 48; // 横方向の分割数（多いほど波が滑らか）
const STAFF_COLOR = 0xeaf6ff;
// 五線譜のsin揺れ
const WAVE_AMP = 0.06; // 波の振幅
const WAVE_FREQ = 1.6; // 周波数
const WAVE_SPEED = 1.2; // 波のスクロール速度

// ── テキスト ──
const TEXT_HEIGHT = 0.5; // テキスト平面の高さ（横幅は文字数で決まる）
const TEXT_COLOR = "#ffffff";
const TEXT_FONT = "bold 96px sans-serif";
const TEXT_RESOLUTION = 128; // Canvas の縦解像度（px）

// ── 配置（仮。カメラワーク確定後に調整）──
const SPAWN_POSITION = new THREE.Vector3(0, 1.4, 2.0); // 五線譜の出現位置

// ── ライフサイクル（秒）──
const ENTER_DUR = 0.8; // 登場
const HOLD_DUR = 3.0; // 保持（Phase 0 の確認用。Phase 1 ではフレーズ長に合わせる）
const EXIT_DUR = 1.0; // 退場
const ENTER_RISE = 0.4; // 登場時に下から浮上する距離
const EXIT_RISE = 0.6; // 退場時に上へ昇る距離

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

    // 波は常に進行
    inst.staffMaterial.uniforms.uTime.value = now;

    // ライフサイクルの各フェーズで opacity / 浮上 / scale / 波の振幅を制御
    let opacity, rise, scale, waveGrow;
    if (age < ENTER_DUR) {
      // 登場：easeOutSine（最初速く→優しく減速）。直線から波打ち始める
      const t = easeOutSine(age / ENTER_DUR);
      opacity = t;
      rise = (1 - t) * -ENTER_RISE; // 下から上へ
      scale = 0.9 + 0.1 * t;
      waveGrow = t;
    } else if (age < ENTER_DUR + inst.holdDur) {
      // 保持：完全表示。微かに上下に漂わせる
      opacity = 1;
      rise = Math.sin((age - ENTER_DUR) * 1.2) * 0.02;
      scale = 1;
      waveGrow = 1;
    } else {
      // 退場：easeInSine（優しく加速）。上へ昇って霧散
      const t = easeInSine((age - ENTER_DUR - inst.holdDur) / EXIT_DUR);
      opacity = 1 - t;
      rise = t * EXIT_RISE;
      scale = 1 + 0.08 * t;
      waveGrow = 1;
    }

    inst.group.position.y = SPAWN_POSITION.y + rise;
    inst.group.scale.setScalar(scale);
    inst.staffMaterial.uniforms.uOpacity.value = opacity;
    inst.staffMaterial.uniforms.uWaveGrow.value = waveGrow;
    inst.textMaterial.opacity = opacity;

    // ビルボード
    if (camera) inst.group.quaternion.copy(camera.quaternion);
  }
}

// ── internal ────────────────────────────

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
      uOpacity: { value: 0 },
      uWaveGrow: { value: 0 }, // 0=直線, 1=波MAX（登場で立ち上げる）
      uAmp: { value: WAVE_AMP },
      uFreq: { value: WAVE_FREQ },
      uSpeed: { value: WAVE_SPEED },
      uColor: { value: new THREE.Color(STAFF_COLOR) },
    },
    vertexShader: /* glsl */ `
      uniform float uTime;
      uniform float uWaveGrow;
      uniform float uAmp;
      uniform float uFreq;
      uniform float uSpeed;
      void main() {
        vec3 p = position;
        // 横方向(x)に沿って縦(y)を sin で揺らす＝五線譜が波打つ
        p.y += sin(p.x * uFreq + uTime * uSpeed) * uAmp * uWaveGrow;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
      }
    `,
    fragmentShader: /* glsl */ `
      uniform vec3 uColor;
      uniform float uOpacity;
      void main() {
        gl_FragColor = vec4(uColor, uOpacity);
      }
    `,
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

// 複数 BufferGeometry を1つに統合（addons の mergeGeometries 相当の最小実装）
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
