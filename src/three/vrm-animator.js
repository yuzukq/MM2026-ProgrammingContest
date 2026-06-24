// vrm-animator.js
// VRM のアニメーション再生だけを司るヘルパー
// 「いつ何を再生するか」の判断は持たず、game のイベント等から playOneShot() を呼ぶ
//
// 設計方針:
//   基本ループ1本を常時アクティブにする（= 戻り先の状態）
//   基本ループは「位相駆動」: 自動進行を止め(setEffectiveTimeScale 0)、毎フレーム applyFrame() で
//     ビートの位相に合わせて action.time を直書きする（着地がビートに吸着しドリフトしない）
//   ワンショットは LoopOnce + clampWhenFinished（終端ポーズで保持）、通常の delta 駆動
//   遷移は crossFade（戻りモーションを各アニメに焼かず、ここで吸収）
//   ワンショット終了（mixer 'finished'）で基本ループへ crossFade で戻す

import * as THREE from "three";

let mixer = null;
const actions = {}; // name -> AnimationAction
const metas = {}; // name -> { clipDuration, beatsPerCycle, phaseDriven, returnToLoop }
let baseLoop = null; // 常時ループの name（未設定でも可）
let active = null; // 今ブレンドの主役 name
const FADE = 0.3; // crossFade 秒

// ── public ──────────────────────────────

// Mixer を作りワンショット終了で基本ループへ戻す配線をする。
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
  if (!actions[name]) return;
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

// 毎フレーム mixer を進める（位相駆動ループは timeScale 0 なので進まず applyFrame の直書きが効く）。
// VRM への反映（vrm.update）は scene が表情レイヤーと合わせて最後に1回呼ぶ
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
