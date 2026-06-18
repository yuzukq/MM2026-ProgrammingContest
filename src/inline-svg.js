// inline-svg.js
// Illustrator 書き出しSVGをインライン展開するときの共通ヘルパー。
//
// 書き出しSVGは <style> 内で .cls-1 .cls-2 … という同名クラスを使うため、複数のSVGを
// インラインするとスタイルがグローバルに漏れて互いを汚染する（例: lyriccard の .cls-2{fill:#fff}
// が選曲カードの同名クラスまで白くする）。ここで <style> の各セレクタをコンテナ固有のスコープへ
// 前置し、汚染を防ぐ。
//
// 根本対策は素材側を「プレゼンテーション属性」で書き出すこと（<style> 自体が消え、このスコープ化は
// no-op になる）。それまでの防御ネットとして、インライン展開は必ずこの inlineSvg() 経由にする。

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
