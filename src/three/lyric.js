// lyric.js
// 歌詞ビルボード演出。フレーズごとに「波打つ五線譜 + 歌詞テキスト」を出し入れする。

import * as THREE from "three";
import STAFF_VERT from "./staff.vert.glsl?raw";
import STAFF_FRAG from "./staff.frag.glsl?raw";

// ── 五線譜（波打つ5本線）──
const STAFF_LINE_COUNT = 5; // 線の本数
const STAFF_WIDTH = 6.0; // 五線譜の横幅（ワールド単位）
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

// ── テキスト（スロット）──
const TEXT_HEIGHT = 0.5; // テキスト平面の高さ（横幅は文字数で決まる）
const TEXT_COLOR = "#ff0000"; // 検証用：後で調整
const TEXT_FONT = "bold 96px sans-serif";
const TEXT_RESOLUTION = 128; // Canvas の縦解像度（px）
const TEXT_GAP = 0.1; // 単語間の隙間（ワールド単位）
const MAX_ROW_WIDTH = STAFF_WIDTH * 0.9; // 9.5割埋まったら折り返す
const LINE_SPACING = 1.0; // 折り返した行（五線譜の段）の縦間隔
const SEMI_OPACITY = 0.2; // PERFECT 以外（GOOD/BAD/取り逃し）の半透明度
const SLOT_FADE = 0.1; // 単語が出現するときのフェードイン時間（秒）

// ── 配置（仮。カメラワーク確定後に調整）──
const SPAWN_POSITION = new THREE.Vector3(0, 1.4, 2.0); // 五線譜の出現位置

// ── ライフサイクル（秒）──
const ENTER_DUR = 0.2; // 登場（右→左に徐々に描き出す）
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

// game.js が発行する start / word / end イベントを受けて反映する
export function applyLyricEvents(events) {
  for (const e of events) {
    if (e.type === "start") spawnPhrase(e.phraseIndex, e.roster);
    else if (e.type === "word") revealWord(e.phraseIndex, e.slotIndex, e.rating);
    else if (e.type === "end") exitPhrase(e.phraseIndex);
  }
}

// scene描画のRAFから呼ぶ。波の進行・登場/退場アニメの更新と、退場し終えたものの後始末。
export function updateLyric() {
  const now = performance.now() / 1000;

  for (let i = instances.length - 1; i >= 0; i--) {
    const inst = instances[i];

    // 退場アニメが終わった → シーンから除去して破棄
    if (inst.exitAt !== null && now - inst.exitAt >= EXIT_DUR) {
      scene.remove(inst.group);
      disposeGroup(inst.group);
      instances.splice(i, 1);
      continue;
    }

    updateInstance(inst, now);
  }
}

// ── internal ────────────────────────────

// start: 空の五線譜をスポーンし roster からスロットを予約・配置する
function spawnPhrase(phraseIndex, roster) {
  if (!scene) return;

  const group = new THREE.Group();
  group.position.copy(SPAWN_POSITION);

  // 各単語をテキスト化し幅を測定
  const meshes = roster.map((text) => buildText(text));
  const widths = meshes.map((m) => m.geometry.parameters.width);

  // MAX_ROW_WIDTH を超えたら次の行へ送る
  const lines = wrapIntoLines(widths);

  // 行を縦に積んで配置 各行は同じ中心 y を共有する
  // 見切れ対策が要るときは、ここで lines 全体の高さ((lines.length-1)*LINE_SPACING)が上限を超えたら group.scale.setScalar(...) で全体を縮める処理を足す
  const blockHeight = (lines.length - 1) * LINE_SPACING;
  const lineYs = lines.map((_, row) => blockHeight / 2 - row * LINE_SPACING); // 上→下

  const lineStartX = -MAX_ROW_WIDTH / 2; // 全行を同じ左端から
  lines.forEach((line, row) => {
    let cursor = lineStartX;
    for (const i of line) {
      meshes[i].position.set(cursor + widths[i] / 2, lineYs[row], 0.05); // 五線譜のわずかに手前
      cursor += widths[i] + TEXT_GAP;
      group.add(meshes[i]);
    }
  });

  // 全段を1メッシュに統合し1マテリアルで揺らす/描き出す
  const staff = buildStaff(lineYs);
  group.add(staff.mesh);

  // 各行スロットは rosterのslotIndex 順にソート
  const slots = meshes.map((mesh) => ({
    material: mesh.material,
    targetOpacity: 0,
    revealedAt: null, // 未判定は非表示
  }));

  scene.add(group);
  instances.push({
    phraseIndex,
    group,
    staffMaterial: staff.material,
    slots,
    bornAt: performance.now() / 1000,
    exitAt: null, // end イベントで now をセット → 退場開始
  });
}

// 単語幅の配列を各行に入る単語インデックスの配列に分ける
function wrapIntoLines(widths) {
  const lines = [];
  let current = [];
  let lineWidth = 0;
  for (let i = 0; i < widths.length; i++) {
    const gap = current.length === 0 ? 0 : TEXT_GAP;
    // 行に1語以上あり、足すと最大幅を超えるなら改行（1語だけで超える場合は割れないのでそのまま置く）
    if (current.length > 0 && lineWidth + gap + widths[i] > MAX_ROW_WIDTH) {
      lines.push(current);
      current = [];
      lineWidth = 0;
    }
    lineWidth += (current.length === 0 ? 0 : TEXT_GAP) + widths[i];
    current.push(i);
  }
  if (current.length > 0) lines.push(current);
  return lines;
}

// word: 判定確定した単語をスロットに出現させる（PERFECT=不透明 / それ以外=半透明）
function revealWord(phraseIndex, slotIndex, rating) {
  const slot = activeInstance(phraseIndex)?.slots[slotIndex];
  if (!slot) return;
  slot.targetOpacity = rating === "PERFECT" ? 1.0 : SEMI_OPACITY;
  slot.revealedAt = performance.now() / 1000;
}

// end: 五線譜ごと退場を開始する
function exitPhrase(phraseIndex) {
  const inst = activeInstance(phraseIndex);
  if (inst) inst.exitAt = performance.now() / 1000;
}

// 退場中でない、指定フレーズのインスタンスを返す
function activeInstance(phraseIndex) {
  return instances.find((x) => x.phraseIndex === phraseIndex && x.exitAt === null);
}

// 1インスタンス（フレーズ）の登場/保持/退場アニメを1フレーム進める
function updateInstance(inst, now) {
  const age = now - inst.bornAt;
  const enterE = easeOutSine(clamp01(age / ENTER_DUR)); // 登場の進捗（描き出し）

  // 退場フェード：exitAt がセットされてから EXIT_DUR で 1→0
  let exitFade = 1;
  let rise = 0;
  let scale = 0.96 + 0.04 * enterE;
  if (inst.exitAt !== null) {
    const exitE = easeInSine(clamp01((now - inst.exitAt) / EXIT_DUR));
    exitFade = 1 - exitE;
    rise = exitE * EXIT_RISE;
    scale = 1 + 0.04 * exitE;
  } else if (age >= ENTER_DUR) {
    rise = Math.sin((age - ENTER_DUR) * 1.2) * 0.02; // 保持：微かに漂う
    scale = 1;
  }

  // 五線譜：登場の描き出し(uReveal)＋退場フェード(uOpacity)＋波の進行(uTime)
  const u = inst.staffMaterial.uniforms;
  u.uTime.value = now;
  u.uReveal.value = enterE * REVEAL_MAX;
  u.uOpacity.value = exitFade;

  // スロット：出現済みのものだけ「フェードイン × 退場フェード」で不透明度を更新
  for (const slot of inst.slots) {
    if (slot.revealedAt === null) continue; // 未判定は非表示のまま
    const fadeIn = clamp01((now - slot.revealedAt) / SLOT_FADE);
    slot.material.opacity = slot.targetOpacity * fadeIn * exitFade;
  }

  inst.group.position.y = SPAWN_POSITION.y + rise;
  inst.group.scale.setScalar(scale);
  if (camera) inst.group.quaternion.copy(camera.quaternion); // カメラ向きにビルボード
}

// 五線譜を生成
function buildStaff(lineYs) {
  const geometry = new THREE.PlaneGeometry(STAFF_WIDTH, STAFF_LINE_THICKNESS, STAFF_SEGMENTS, 1);
  // 段(lineY)ごとに5本、y をずらして1ジオメトリに統合
  const geometries = [];
  for (const lineY of lineYs) {
    for (let i = 0; i < STAFF_LINE_COUNT; i++) {
      const g = geometry.clone();
      g.translate(0, lineY + (i - (STAFF_LINE_COUNT - 1) / 2) * STAFF_LINE_GAP, 0);
      geometries.push(g);
    }
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
  // 位置・スケールは spawnPhrase 側でスロットに合わせて設定する
  return new THREE.Mesh(geometry, material);
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

// 0..1 にクランプ
function clamp01(t) {
  return Math.max(0, Math.min(1, t));
}
