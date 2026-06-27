// keep-text-aspect.js
// svg内の x/y 別倍率で引き伸ばさたテキストに対して横方向の引き伸ばしだけを打ち消す逆スケールを掛けて
// 文字のアスペクト比を維持するためのヘルパー

const SVG_NS = "http://www.w3.org/2000/svg";

// svgEl 内の textEls を逆スケール <g> で包み、表示サイズに追従して横潰れを補正する
export function keepTextAspect(svgEl, textEls) {
  const vb = svgEl.viewBox.baseVal; // viewBox の論理サイズ（x/y 倍率の基準）
  const wrapped = textEls.filter(Boolean).map((textEl) => {
    const m = textEl.transform.baseVal.consolidate()?.matrix;
    const tx = m ? m.e : 0; // アンカー（スケール中心）
    const ty = m ? m.f : 0;
    const g = document.createElementNS(SVG_NS, "g");
    textEl.parentNode.insertBefore(g, textEl);
    g.appendChild(textEl);
    return { g, tx, ty };
  });

  const apply = () => {
    const rect = svgEl.getBoundingClientRect();
    if (!rect.width || !rect.height) return; // 非表示中は 0 になるのでスキップ
    const scaleX = rect.width / vb.width;
    const scaleY = rect.height / vb.height;
    const sx = scaleY / scaleX; // 横の引き伸ばしを戻す係数
    wrapped.forEach(({ g, tx, ty }) => {
      // アンカー (tx,ty) を固定したまま横だけ sx 倍する
      g.setAttribute("transform", `translate(${tx} ${ty}) scale(${sx} 1) translate(${-tx} ${-ty})`);
    });
  };

  // 表示・リサイズ（display:none→表示への変化含む）で再計算する
  new ResizeObserver(apply).observe(svgEl);
  apply();
}
