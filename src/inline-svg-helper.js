// inline-svg-helper.js
// Illustrator 書き出しSVGをインライン展開・テキストアスペクト比補正の共通ヘルパー。

let scopeSeq = 0;

// container に svgText を展開し、内部 <style> があればコンテナ固有スコープへ限定する。
// 返り値は展開された <svg> 要素（呼び出し側はこれを querySelector の起点に使う）。
export function inlineSvg(container, svgText) {
  container.innerHTML = svgText;
  const styleEl = container.querySelector("svg style");
  if (styleEl) {
    const scope = `svg-scope-${scopeSeq++}`;
    container.classList.add(scope);
    styleEl.textContent = scopeSelectors(styleEl.textContent, `.${scope}`);
  }
  return container.querySelector("svg");
}

// CSS の各ルールのセレクタを scope 配下へ前置する
// （`.cls-1, .cls-2 {…}` → `.scope .cls-1, .scope .cls-2 {…}`）。
function scopeSelectors(css, scope) {
  return css.replace(
    /([^{}]+)(\{[^}]*\})/g,
    (_, selectors, body) =>
      selectors
        .split(",")
        .map((s) => `${scope} ${s.trim()}`)
        .join(", ") + body
  );
}

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
