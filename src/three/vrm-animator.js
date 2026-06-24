// vrm-animator.js
// VRM アニメーション再生ヘルパー
// 発火タイミングはもたず、sceneからanimを呼び出す

import * as THREE from "three";

let mixer = null;
const actions = {}; // name -> AnimationAction
const metas = {}; // name -> { clipDuration, beatsPerCycle, phaseDriven, returnToLoop }
let baseLoop = null;
let active = null;
const FADE = 0.5; // crossFade 秒

// ── public ──────────────────────────────

// Mixer を作りワンショット終了で基本ループへ戻す配線をする
export function initAnimator(vrm) {
  mixer = new THREE.AnimationMixer(vrm.scene);
  mixer.addEventListener("finished", (e) => {
    // 終わったのが現アクティブのワンショットで、戻る設定かつ基本ループがあればループへ
    if (active && actions[active] === e.action && metas[active].returnToLoop && baseLoop) {
      crossFadeTo(baseLoop);
    }
  });
}

// VRMA を clip を名前付きで登録
// loop=true: 位相駆動の基本ループ候補（LoopRepeat・ビート同期）
// beatsPerCycle: anim 1ループが何拍ぶんか
export function register(
  name,
  clip,
  { loop = false, beatsPerCycle = 2, returnToLoop = true } = {}
) {
  const action = mixer.clipAction(clip);
  if (loop) {
    action.setLoop(THREE.LoopRepeat, Infinity);
  } else {
    action.setLoop(THREE.LoopOnce, 1);
    action.clampWhenFinished = true; // ワンショットは終端ポーズで保持
  }
  actions[name] = action;
  metas[name] = { clipDuration: clip.duration, beatsPerCycle, phaseDriven: loop, returnToLoop };
}

// 基本ループを設定して再生開始する
export function setBaseLoop(name) {
  // 未ロード or 既に同じループなら何もしない
  if (!actions[name] || baseLoop === name) return;
  baseLoop = name;
  crossFadeTo(name);
}

// 何が再生中でも name へ crossFade する
// ワンショット・ループ切替の共通入口
export function playOneShot(name) {
  if (!actions[name]) return;
  crossFadeTo(name);
}

// 基本ループの再生位置をビート間の位相に合わせる
export function applyFrame(phaseRaw) {
  if (baseLoop === null) return;
  const meta = metas[baseLoop];
  if (!meta.phaseDriven) return;
  // beatsPerCycle 拍で1周、位相を 0-1 に畳んでクリップ長へ写す
  const phase01 = (((phaseRaw / meta.beatsPerCycle) % 1) + 1) % 1;
  actions[baseLoop].time = phase01 * meta.clipDuration;
}

// 毎フレーム mixer を進める
// vrm.update は scene 側で表情レイヤーとまとめて行う
export function updateAnimator(delta) {
  if (!mixer) return;
  mixer.update(delta);
}

// ── internal ────────────────────────────

// 現アクティブから toName へ crossFade
function crossFadeTo(toName) {
  const to = actions[toName];
  const from = active && active !== toName ? actions[active] : null;

  to.reset(); // 前回ワンショットのクランプを解除する
  to.setEffectiveWeight(1);
  to.setEffectiveTimeScale(metas[toName].phaseDriven ? 0 : 1); // 位相駆動ループは自動進行させない
  to.play();

  if (from) from.crossFadeTo(to, FADE, false);
  active = toName;
}
