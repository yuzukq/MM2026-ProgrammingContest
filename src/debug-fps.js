// debug-fps.js
// 表示: FPS（0.5s平均） / now（直近フレームの所要ms） / worst（直近の最悪フレーム時間ms）

export function startFpsMeter() {
  const el = document.createElement("div");
  el.style.cssText =
    "position:fixed;top:4px;left:4px;z-index:9999;padding:4px 8px;" +
    "font:bold 16px/1.4 monospace;color:#0f0;background:rgba(0,0,0,.6);" +
    "pointer-events:none;white-space:pre;border-radius:4px;";
  document.body.appendChild(el);

  let prev = performance.now();
  let frames = 0;
  let acc = 0; // 0.5s ぶんの経過時間
  let fps = 0;
  let worst = 0; // 直近の最悪フレーム時間(ms)

  function tick(now) {
    const dt = now - prev;
    prev = now;

    worst = Math.max(worst * 0.95, dt); // スパイクで上書き、平常時はじわっと減衰

    frames++;
    acc += dt;
    if (acc >= 500) {
      fps = Math.round((frames * 1000) / acc);
      frames = 0;
      acc = 0;
    }

    el.textContent = `FPS ${fps}\nnow  ${dt.toFixed(1)}ms\nworst ${worst.toFixed(0)}ms`;
    requestAnimationFrame(tick);
  }
  requestAnimationFrame(tick);
}
