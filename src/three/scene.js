// scene.js
// Three.js シーン一式。3D背景・ミクモデル・演出を管理する。
// TextAlive の処理・ゲームロジックは別スクリプトに分離している。

import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { VRMLoaderPlugin } from "@pixiv/three-vrm";
import * as sky from "./sky.js";
import * as water from "./water.js";
import * as lyric from "./lyric.js";
import * as cameraRig from "./camera.js"; // 命名被るから名前空間わけた

let scene, camera, renderer, vrm;
// updateScene から操作するオブジェクトはここに宣言する
// let sunMesh, flowerInstancedMesh;

// ── public ──────────────────────────────

// 起動時に1回だけ呼ぶ。Three.js の初期化・アニメーションループの開始を行う。
export function initScene() {
  // =============シーン初期化=================
  scene = new THREE.Scene();

  renderer = new THREE.WebGLRenderer({ antialias: true });
  camera = new THREE.PerspectiveCamera(30, window.innerWidth / window.innerHeight, 0.1, 100000); //FOV,アスペクト比,near,far
  vrm = null;

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

  // VRMローダー
  const loader = new GLTFLoader();

  loader.register((parser) => new VRMLoaderPlugin(parser));

  loader.load("./assets/models/MMmiku/MMmiku.vrm", (gltf) => {
    vrm = gltf.userData.vrm;
    vrm.scene.position.set(0.8, -1.12, 5.0);
    vrm.scene.rotation.set(0, THREE.MathUtils.degToRad(-50), 0);
    scene.add(vrm.scene);
    console.log(vrm);
  });

  // =============カメラワーク=================
  // OrbitControls は initCamera 内で無効化される（カメラはプリセット駆動するため）。
  // 参考: https://ics.media/tutorial-three/camera_orbitcontrols/
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

// "3D オブジェクト（位置・色・密度など）の状態を更新するだけで、renderer.render() は呼ばない！"
// "レンダリングは sceneRenderLoop() が毎フレーム行う！"
export function updateScene({ position, progress, isNewBeat, beat, lyricRatings, inChorus }) {
  // 曲の進行に合わせて空の状況を動かす
  sky.updateSky(progress);

  // サビ判定でカメラワークプリセット切替
  cameraRig.updateCamera({ inChorus });

  // ビートに合わせて水面に波紋生成
  if (isNewBeat && beat) {
    water.spawnRipple(beat.position === 1); // ダウンビートはデカく
  }

  // 歌詞ビルボードの更新（描画は sceneRenderLoop() の updateLyric が担当）
  lyric.schedule(position);
  // 判定確定したスロットの不透明度を反映
  if (lyricRatings && lyricRatings.length) {
    lyric.applyRatings(lyricRatings);
  }
}

// ── internal ────────────────────────────

// 演出やモデルの状態を毎フレーム画面に反映させる描画ループ（initScene から起動）
function sceneRenderLoop() {
  requestAnimationFrame(sceneRenderLoop);
  cameraRig.tickCamera(); // カメラ補間＋FOVブレス（またはデバッグ自由飛行）を camera に適用
  water.updateWater(sky.getSunDirection()); // 法線スクロール＋太陽方向を空と同期
  lyric.updateLyric(); // 歌詞ビルボードの波・ライフサイクル更新
  renderer.render(scene, camera);
}
