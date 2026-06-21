// vrm-animator.js
// VRM のアニメーション再生だけを司るヘルパー
// 「いつ何を再生するか」の判断は持たず、game のイベント等から playOneShot() を呼ぶ
//
// 設計方針:
//   基本ループ1本を常時アクティブにする（= 戻り先の状態）
//   ワンショットは LoopOnce + clampWhenFinished（終端ポーズで保持）
//   遷移は crossFade（戻りモーションを各アニメに焼かず、ここで吸収）
//   ワンショット終了（mixer 'finished'）で基本ループへ crossFade で戻す

import * as THREE from "three";

let mixer = null;
const actions = {}; // name -> AnimationAction
let baseLoop = null; // 常時ループの name（未設定でも可）
let active = null; // 今ブレンドの主役 name
const FADE = 0.3; // crossFade 秒

// ── public ──────────────────────────────

// Mixer を作りワンショット終了で基本ループへ戻す配線をする。
export function initAnimator(vrm) {
  mixer = new THREE.AnimationMixer(vrm.scene);
  mixer.addEventListener("finished", (e) => {
    // 終わったのが現アクティブのワンショットで、戻る設定かつ基本ループがあればループへ
    if (
      active &&
      actions[active] === e.action &&
      actions[active].userData.returnToLoop &&
      baseLoop
    ) {
      crossFadeTo(baseLoop);
    }
  });
}

// VRMA から作った clip を名前付きで登録。
//   loop=true: 基本ループ候補（LoopRepeat）
//   returnToLoop=false: ワンショット終了後にループへ戻さず終端ポーズで保持（クリア演出など）
export function register(name, clip, { loop = false, returnToLoop = true } = {}) {
  const action = mixer.clipAction(clip);
  if (loop) {
    action.setLoop(THREE.LoopRepeat, Infinity);
  } else {
    action.setLoop(THREE.LoopOnce, 1);
    action.clampWhenFinished = true; // 終端ポーズで保持
  }
  action.userData = { returnToLoop };
  actions[name] = action;
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

// 毎フレーム mixer を進める
// VRM への反映（vrm.update）は scene が表情レイヤーと合わせて最後にvrm.updateを1回呼ぶ
export function updateAnimator(delta) {
  if (!mixer) return;
  mixer.update(delta);
}

// ── internal ────────────────────────────

// 現アクティブから toName へ crossFade
function crossFadeTo(toName) {
  const to = actions[toName];
  const from = active && active !== toName ? actions[active] : null;

  to.enabled = true;
  to.setEffectiveTimeScale(1);
  to.setEffectiveWeight(1);
  to.time = 0;
  to.play();

  if (from) from.crossFadeTo(to, FADE, false);
  active = toName;
}
