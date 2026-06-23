// scene.js
// Three.js シーン一式。3D背景・ミクモデル・演出を管理する。
// TextAlive の処理・ゲームロジックは別スクリプトに分離している。

import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { VRMLoaderPlugin } from "@pixiv/three-vrm";
import { VRMAnimationLoaderPlugin, createVRMAnimationClip } from "@pixiv/three-vrm-animation";
import * as sky from "./sky.js";
import * as water from "./water.js";
import * as lyric from "./lyric.js";
import * as cameraRig from "./camera.js"; // 命名被るから名前空間わけた
import * as animator from "./vrm-animator.js"; // VRMアニメの再生制御（ボーン）
import * as expression from "./vrm-expression.js"; // VRM表情（リップシンク・感情）

let scene, camera, renderer, vrm;
let clock; // VRMアニメ更新用の delta 取得

// 基本ループの位相駆動用
let beatPhaseRaw = 0; // 小節内の連続拍位置 (= beat.position-1 + beat.progress)
let beatDurMs = 0; // 現在のビート間隔[ms]（補間の分母）
let beatPhaseAt = 0; // 上記を観測した時刻（performance.now）

// イベントのシンボル定義 { ボーンのワンショット名, 感情表情 }
const ANIM_MAP = {
  perfectPhrase: { oneShot: "perfect-phrase", emote: { name: "happy", ms: 900 } },
};

// ── public ──────────────────────────────

// 起動時に1回だけ呼ぶ。Three.js の初期化・アニメーションループの開始を行う。
export function initScene() {
  // =============シーン初期化=================
  scene = new THREE.Scene();

  renderer = new THREE.WebGLRenderer({ antialias: true });
  camera = new THREE.PerspectiveCamera(30, window.innerWidth / window.innerHeight, 0.1, 100000); //FOV,アスペクト比,near,far
  vrm = null;
  clock = new THREE.Clock();

  renderer.setSize(window.innerWidth, window.innerHeight);
  // モバイル(タッチ端末)は塗る画素数(fillrate)が重いので解像度上限を下げる。
  // 1.5でまだカクつくなら 1 にすると60fpsに張り付くと思う
  const maxPixelRatio = window.matchMedia("(pointer: coarse)").matches ? 1.5 : 2;
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, maxPixelRatio));
  // Sky のHDRな明るさを破綻なく表示するためのトーンマッピング
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 0.25; // 露出（全体の明るさ。GUIのexposure）
  // width/height:100% を明示（cssText が setSize 設定のCSSサイズを上書きするため。
  renderer.domElement.style.cssText =
    "position:fixed;top:0;left:0;width:100%;height:100%;z-index:0;";
  document.body.appendChild(renderer.domElement);

  // =============カメラ=================
  scene.add(camera);
  camera.position.set(-0.45, -0.15, 9.1); // 横, 縦, 距離

  // =============ライト=================
  // ミク専用キーライト（暫定）Mtoonの調整の兼ね合いもあるのでこの辺はテクスチャ来てから調整
  // 前方やや上・右から当てる。角度・強さはテクスチャ適用後に詰める想定
  const keyLight = new THREE.DirectionalLight(0xffffff, 4.0);
  keyLight.position.set(3, 4, 10); // カメラ側(前方)・上・右 → ミクの正面を照らす方向
  scene.add(keyLight);

  // =============空＋太陽=================
  sky.initSky(scene); // 空ドームと太陽光を追加

  // =============湖（リアル水面）=================
  water.initWater(scene, sky.getSunDirection());

  // =============歌詞ビルボード=================
  lyric.initLyric(scene, camera);

  // VRMローダー（VRM本体＋VRMAアニメの両対応）
  const loader = new GLTFLoader();
  loader.register((parser) => new VRMLoaderPlugin(parser));
  loader.register((parser) => new VRMAnimationLoaderPlugin(parser));

  loader.load("/assets/vrm/miku/miku.vrm", (gltf) => {
    vrm = gltf.userData.vrm;
    vrm.scene.position.set(0.8, -1.12, 5.0);
    vrm.scene.rotation.set(0, THREE.MathUtils.degToRad(-50), 0);
    scene.add(vrm.scene);
    animator.initAnimator(vrm);
    expression.initExpression(vrm);
    loadVrmAnimations(loader); // VRMA を読み込んで animator に登録
  });

  // =============カメラワーク=================
  // OrbitControls は initCamera 内で無効化される（カメラはプリセット駆動するため）。
  const controls = new OrbitControls(camera, renderer.domElement);
  controls.target.set(-0.45, 0.15, 4.11);
  cameraRig.initCamera(camera, controls); // サビ/それ以外のプリセット切替＋デバッグ操作

  // =============リサイズ対応=================
  // ウィンドウリサイズ時にアスペクト比を再計算（カメラ比率も変えないと物体が伸びて見える）
  window.addEventListener("resize", () => {
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, maxPixelRatio));
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
  });

  // =============描画ループ開始=================
  sceneRenderLoop();
}

// lyric.js へタイムラインを渡す中継ぎ用．
// 4モジュール伝搬(game → main → scene → lyric)が初なんでまどろっこしい気もするが一旦これで許して...
export function registerLyricTimeline(timeline) {
  lyric.registerTimeline(timeline);
}

// 歌詞フォントの先読み（起動時に呼んでプレイ開始前に await する）
export function loadLyricFont() {
  return lyric.loadFont();
}

// "3D オブジェクト（位置・色・密度など）の状態を更新する
export function updateScene({
  position,
  progress,
  isNewBeat,
  beat,
  lyricRatings,
  isInChorus,
  animEvents,
  mouthVowel,
}) {
  // 曲の進行に合わせて空の状況を動かす
  sky.updateSky(progress);

  // サビ判定でカメラワークプリセット切替
  cameraRig.updateCamera({ isInChorus });

  // ビートに合わせて水面に波紋生成
  if (isNewBeat && beat) {
    water.spawnRipple(beat.position === 1); // ダウンビートはデカく
  }

  // 現在ビートの間隔(位相)をアンカーする
  if (beat) {
    beatPhaseRaw = beat.position - 1 + beat.progress(position);
    beatDurMs = beat.duration;
    beatPhaseAt = performance.now();
  }

  // 歌詞ビルボードの更新
  lyric.schedule(position);
  // 判定確定したスロットの不透明度を反映
  if (lyricRatings && lyricRatings.length) {
    lyric.applyRatings(lyricRatings);
  }

  // 現在発声中の文字の母音口形
  expression.setMouthVowel(mouthVowel ?? null);

  // game の意味イベントに応じて VRMA＋ブレンドシェイプを発火
  if (animEvents) {
    for (const e of animEvents) {
      const m = ANIM_MAP[e.type];
      if (!m) continue;
      if (m.oneShot) animator.playOneShot(m.oneShot);
      if (m.emote) expression.emote(m.emote.name, m.emote.ms);
    }
  }
}

// ── internal ────────────────────────────

// VRMA アニメをロードして animator に登録する
// TODO: アニメーション追加、基本ループは animator.setBaseLoop(name) で起動する
function loadVrmAnimations(loader) {
  // 基本ループ: 手振りジャンプ（2拍ループ・位相0=着地手左） : TODO 後でこいつはサビ区間のループに
  loader.load("/assets/vrm/miku/animations/Loop_HandWave_dammy.vrma", (gltf) => {
    const vrmAnim = gltf.userData.vrmAnimations?.[0];
    if (!vrmAnim) return;
    const clip = createVRMAnimationClip(vrmAnim, vrm);
    animator.register("jump", clip, { loop: true, beatsPerCycle: 2 });
    animator.setBaseLoop("jump");
  });
  // ワンショット: フレーズ完走
  loader.load("/assets/vrm/miku/animations/perfect-phrase.vrma", (gltf) => {
    const vrmAnim = gltf.userData.vrmAnimations?.[0];
    if (!vrmAnim) return;
    const clip = createVRMAnimationClip(vrmAnim, vrm);
    animator.register("perfect-phrase", clip, { loop: false });
  });
}

// 演出やモデルの状態を毎フレーム画面に反映させる描画ループ
function sceneRenderLoop() {
  requestAnimationFrame(sceneRenderLoop);
  const delta = clock.getDelta();
  cameraRig.tickCamera(); // カメラのプリセット補間（またはデバッグ自由飛行）を camera に適用
  water.updateWater(sky.getSunDirection()); // 法線スクロール＋太陽方向を空と同期
  lyric.updateLyric(); // 歌詞ビルボードの波・ライフサイクル更新

  // VRMの見た目反映まわり
  // 基本ループの位相を最後のビートアンカーから時間補間して 60fps で滑らかに進める
  const phaseRaw =
    beatDurMs > 0 ? beatPhaseRaw + (performance.now() - beatPhaseAt) / beatDurMs : beatPhaseRaw;
  animator.applyFrame(phaseRaw); // 位相駆動のループアニメーションのフレーム指定
  //animator.updateAnimator(delta); // mixer を進める
  expression.update(delta);
  vrm?.update(delta); // ボーン正規化・スプリングボーン・表情を一括反映
  renderer.render(scene, camera);
}
