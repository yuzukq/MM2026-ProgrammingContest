// lyric.js
// 歌詞ビルボード演出。フレーズごとに「波打つ五線譜 + 歌詞テキスト」を出し入れする。
// 時間軸は2系統に分離している：

import * as THREE from "three";
import STAFF_VERT from "./staff.vert.glsl?raw";
import STAFF_FRAG from "./staff.frag.glsl?raw";

// ── 五線譜──
const STAFF_LINE_COUNT = 5; // 線の本数
const STAFF_WIDTH = 6.0; // 五線譜の横幅（ワールド単位）
const STAFF_LINE_GAP = 0.1; // 線と線の間隔
const STAFF_LINE_THICKNESS = 0.01; // 線の太さ
const STAFF_SEGMENTS = 48; // 横方向の分割数（多いほど波が滑らか）
const STAFF_COLOR = 0xeaf6ff;
// 五線譜のsin揺れ
const WAVE_AMP = 0.05; // 波の振幅
const WAVE_FREQ = 1.0; // 周波数
const WAVE_SPEED = 0.5; // 波のスクロール速度
// 右→左へ徐々に描き出すドローオン
const REVEAL_MAX = 1.02; // 描画範囲の最大値（左端 xr=1 を確実に含むよう 1 より少し大きく）

// ── テキスト（スロット）──
const TEXT_HEIGHT = 0.5;
const TEXT_COLOR = "#00fff2";
const OUTLINE_COLOR = "#ffffff";
const OUTLINE_WIDTH = 6; // 見えるフチの太さ(px)
const FONT_FAMILY = "Mochiy Pop One";
const FONT_URL = "/assets/fonts/MochiyPopOne-subset.woff2";
const TEXT_FONT = `84px '${FONT_FAMILY}', sans-serif`;
const TEXT_RESOLUTION = 128; // Canvas の縦解像度（px）
const TEXT_GAP = 0.05; // 単語ないでの文字の隙間
const MAX_ROW_WIDTH = STAFF_WIDTH * 0.95; // 9.5割埋まったら折り返す
const LINE_SPACING = 1.0; // 五線譜同士の感覚
const PLACEHOLDER_OPACITY = 0.08; // 未判定の薄さ
const SEMI_OPACITY = 0.2; // PERFECT 以外（GOOD/BAD/取り逃し）の半透明度
const SLOT_FADE_TAU = 0.12; // 単語の色のフェードイン速度

// 五線譜の出現位置
const SPAWN_POSITION = new THREE.Vector3(0, 1.4, -3.0); // カメラワーク策定時にアングルごとに変更するのがいいと思う

// 五線譜はフレーズの startTime - LEAD で出る
const LEAD = 200;

// ── ライフサイクル（実時間秒）──
const ENTER_DUR = 0.2; // 登場（右→左に徐々に描き出す）
const EXIT_DUR = 0.5; // 退場（フェードアウト）
const EXIT_RISE = 0.2; // 退場時に上へ昇る距離

let scene = null;
let camera = null;

let timeline = []; // [{ startTime, endTime, words:[text,...] }]（添字=phraseIndex）
let cursor = 0; // 次に spawn 判定するフレーズ番号
const instances = []; // シーンに出ている五線譜ビュー群
let lastNow = 0; // 直近フレームの実時間（dt 算出用）

// ── public ──────────────────────────────

export function initLyric(parentScene, sceneCamera) {
  scene = parentScene;
  camera = sceneCamera;
}

// 歌詞フォントを読み込む。プレイ開始前に await して、テキスト生成がフォールバックで描かれるのを防ぐ。
let fontPromise = null;
export function loadFont() {
  if (fontPromise) return fontPromise;
  const face = new FontFace(FONT_FAMILY, `url(${FONT_URL})`);
  fontPromise = face.load().then((loaded) => {
    document.fonts.add(loaded); // Canvas2Dでフォントを使うため
    return loaded;
  });
  return fontPromise;
}

// video-ready 後にフレーズ等のタイムラインを登録する
export function registerTimeline(newTimeline) {
  for (const inst of instances) {
    if (scene) scene.remove(inst.group);
    disposeGroup(inst.group);
  }
  instances.length = 0;
  timeline = newTimeline || [];
  cursor = 0;
  lastNow = 0;
}

// 楽曲再生位置(position)を見て spawn/退場のトリガーを打つ
export function schedule(position) {
  if (!scene) return;

  // startTime - LEAD まで来たフレーズを spawn（歌詞なし・通過済みは出さずカーソルだけ進める）
  while (cursor < timeline.length && position >= timeline[cursor].startTime - LEAD) {
    const ph = timeline[cursor];
    if (ph.words.length > 0 && ph.endTime > position) spawnPhrase(cursor);
    cursor++;
  }

  // endTime を過ぎたフレーズを退場させる
  for (const inst of instances) {
    if (inst.exitAt === null && position >= inst.endTime) {
      inst.exitAt = performance.now() / 1000;
    }
  }
}

// 判定確定したスロットの透明度を更新する。
export function applyRatings(ratings) {
  for (const r of ratings) {
    if (r.type !== "rating") continue;
    const slot = instances.find((x) => x.phraseIndex === r.phraseIndex)?.slots[r.slotIndex];
    if (slot) slot.targetOpacity = r.rating === "PERFECT" ? 1.0 : SEMI_OPACITY;
  }
}

// 波の進行・登場/退場アニメの更新, 退場し終えたものの後始末
export function updateLyric() {
  const now = performance.now() / 1000;
  const dt = lastNow ? now - lastNow : 0;
  lastNow = now;

  for (let i = instances.length - 1; i >= 0; i--) {
    const inst = instances[i];

    // 退場アニメが終わった → シーンから除去して破棄
    if (inst.exitAt !== null && now - inst.exitAt >= EXIT_DUR) {
      scene.remove(inst.group);
      disposeGroup(inst.group);
      instances.splice(i, 1);
      continue;
    }

    updateInstance(inst, now, dt);
  }
}

// ── internal ────────────────────────────

// 指定フレーズの五線譜をまるごと実体化してsceneに追加する
function spawnPhrase(phraseIndex) {
  const words = timeline[phraseIndex].words;
  // メッシュ長で単語を並べた長さをとれんのでcanvasテキスト化して測ってくる
  const widths = words.map((text) => textPlaneWidth(text));
  const lines = wrapIntoLines(widths); // [[slotIndex,...], ...] 段ごと
  const { lineYs, placements } = buildLayout(lines, widths);

  const group = new THREE.Group();
  group.position.copy(SPAWN_POSITION);

  const slots = []; // slotIndex で引けるよう疎なく詰める
  for (const pl of placements) {
    const mesh = buildText(words[pl.slotIndex]);
    mesh.position.set(pl.x, pl.y, 0.05); // 五線譜のわずかに手前
    group.add(mesh);
    // スロットの初期状態。
    // updateInstance で0からtargetへあげてじんわりフェードインする
    slots[pl.slotIndex] = {
      material: mesh.material,
      targetOpacity: PLACEHOLDER_OPACITY,
      displayOpacity: 0,
    };
  }

  const staff = buildStaff(lineYs);
  group.add(staff.mesh);

  scene.add(group);
  instances.push({
    phraseIndex,
    group,
    staffMaterial: staff.material,
    slots,
    endTime: timeline[phraseIndex].endTime, // position がこれを過ぎたら退場
    bornAt: performance.now() / 1000,
    exitAt: null, // schedule の退場で now をセット → 退場開始
  });
}

// 単語幅の配列を各段に入る単語インデックスの配列に分ける
function wrapIntoLines(widths) {
  const lines = [];
  let current = [];
  let lineWidth = 0;
  for (let i = 0; i < widths.length; i++) {
    const gap = current.length === 0 ? 0 : TEXT_GAP;
    // 段に1語以上あり、足すと最大幅を超えるなら改段（1語だけで超える場合は割れないのでそのまま置く）
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

// 段の配列から各段のy・各単語のローカル配置を決める
function buildLayout(lines, widths) {
  const blockHeight = (lines.length - 1) * LINE_SPACING;
  const lineYs = lines.map((_, row) => blockHeight / 2 - row * LINE_SPACING); // 上→下
  const lineStartX = -MAX_ROW_WIDTH / 2; // 全段を同じ左端から

  const placements = []; // { slotIndex, x, y }
  lines.forEach((line, row) => {
    let cursorX = lineStartX;
    for (const slotIndex of line) {
      placements.push({ slotIndex, x: cursorX + widths[slotIndex] / 2, y: lineYs[row] });
      cursorX += widths[slotIndex] + TEXT_GAP;
    }
  });

  return { lineYs, placements };
}

// 1インスタンス（フレーズ）の登場/保持/退場アニメを1フレーム進める
function updateInstance(inst, now, dt) {
  const age = now - inst.bornAt;
  const enterE = easeOutSine(clamp01(age / ENTER_DUR)); // 登場の進捗

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

  // 各単語スロットのdisplayOpacity をtargetOpacityへ時定数追従させ退場フェードを掛ける
  const k = 1 - Math.exp(-dt / SLOT_FADE_TAU);
  for (const slot of inst.slots) {
    slot.displayOpacity += (slot.targetOpacity - slot.displayOpacity) * k;
    slot.material.opacity = slot.displayOpacity * exitFade;
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
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  const cx = canvas.width / 2;
  const cy = canvas.height / 2;
  // 縁取り
  if (OUTLINE_WIDTH > 0) {
    ctx.lineJoin = "round"; // 角のトゲを防ぐため
    ctx.lineWidth = OUTLINE_WIDTH * 2;
    ctx.strokeStyle = OUTLINE_COLOR;
    ctx.strokeText(text, cx, cy);
  }
  ctx.fillStyle = TEXT_COLOR;
  ctx.fillText(text, cx, cy);

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
    toneMapped: false, // 背景に沈むのを回避
  });
  // 位置・スケールは spawnPhrase 側でスロットに合わせて設定する
  return new THREE.Mesh(geometry, material);
}

// メッシュ長で測れんのでbuildText と同じ式でテキスト平面の幅を返す
let measureCtx = null;
function textPlaneWidth(text) {
  if (!measureCtx) measureCtx = document.createElement("canvas").getContext("2d");
  measureCtx.font = TEXT_FONT;
  const padding = TEXT_RESOLUTION * 0.3;
  const canvasWidth = Math.ceil(measureCtx.measureText(text).width + padding * 2);
  return TEXT_HEIGHT * (canvasWidth / TEXT_RESOLUTION);
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
