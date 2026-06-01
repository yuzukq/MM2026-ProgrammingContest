// lake.js
// 湖（水面＋ビートに連動した波紋）の生成・更新を担当する。
// シングルトンなのでモジュールスコープ変数＋関数エクスポート（呼び出し側は import * as lake）。
// scene への mesh 追加/削除のため初期化時に scene を受け取る。
// レンダリングは行わない（scene.js の loop が composer.render() で担当）。

import * as THREE from "three";

// 波紋の見た目パラメータ
const RIPPLE_ORIGIN = new THREE.Vector3(0.8, -1.19, 5.0); // ミク足元に合わせること
const RIPPLE_COLOR = 0xaaffff;
const RIPPLE_LIFETIME = 500; // 1リングの寿命[ms]
const RIPPLE_MAX_RADIUS = 9; // 通常拍の最大半径
const RIPPLE_MAX_RADIUS_DOWNBEAT = 27; // 小節頭の最大半径

let scene = null; // initLake で受け取る親シーン
let rippleGeometry = null; // 全リング共有の帯ジオメトリ
let ripples = []; // アクティブな波紋 { mesh, material, spawnTime, maxRadius }

export function initLake(parentScene) {
  scene = parentScene;

  // 静水面
  const waterGeometry = new THREE.PlaneGeometry(40, 40);
  const waterMaterial = new THREE.MeshStandardMaterial({
    color: 0x0a3d3a,
    transparent: true,
    opacity: 0.5,
  });
  const water = new THREE.Mesh(waterGeometry, waterMaterial);
  water.rotation.x = -Math.PI / 2; // 水平に倒す
  water.position.set(0, -1.2, 0);
  scene.add(water);

  // 波紋共有ジオメトリ。 内径0.8、外径1.0、円周分割64
  rippleGeometry = new THREE.RingGeometry(0.8, 1.0, 64);
}

// 一拍分の波紋を発生させる。
// ダウンビート(4/4拍子の入りの部分)はデカく
export function spawnRipple(isDownbeat) {
  const maxRadius = isDownbeat ? RIPPLE_MAX_RADIUS_DOWNBEAT : RIPPLE_MAX_RADIUS;
  const now = performance.now();

  const material = new THREE.MeshBasicMaterial({
    color: RIPPLE_COLOR,
    transparent: true,
    opacity: 0,
    blending: THREE.AdditiveBlending, // 薄く発光
    depthWrite: false, // 水面・他リングとの重なりを自然にするため
    side: THREE.DoubleSide,
  });
  const mesh = new THREE.Mesh(rippleGeometry, material);
  mesh.rotation.x = -Math.PI / 2; // 水平
  mesh.position.copy(RIPPLE_ORIGIN);
  mesh.scale.setScalar(0.1);
  scene.add(mesh);

  ripples.push({ mesh, material, spawnTime: now, maxRadius });
}

// scene.js の loop から毎フレーム呼ぶ。各リングを壁時計時間で拡散＋フェード、寿命切れの破棄
export function updateLake() {
  const now = performance.now();

  for (let i = ripples.length - 1; i >= 0; i--) {
    const r = ripples[i];
    const age = now - r.spawnTime;
    const t = age / RIPPLE_LIFETIME; // 0→1 の進行度

    if (t >= 1) {
      // 寿命切れをシーンから外して破棄
      scene.remove(r.mesh);
      r.material.dispose();
      ripples.splice(i, 1);
      continue;
    }

    const eased = 1 - Math.pow(1 - t, 3); // easeOutCubic：最初速く広がる
    r.mesh.scale.setScalar(0.1 + eased * r.maxRadius);
    r.material.opacity = (1 - t) * 0.8; // 広がりながら消える
  }
}
