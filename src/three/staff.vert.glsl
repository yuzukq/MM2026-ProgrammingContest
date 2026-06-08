// 五線譜の頂点シェーダー。波打たせ＋右→左のドローオン
// ライフサイクル（登場/保持/退場）は JS 側が uReveal / uOpacity に値を流し込んで制御する
uniform float uTime;
uniform float uReveal; // 描画範囲（右→左）0=未描画, 1=全描画
uniform float uAmp;
uniform float uFreq;
uniform float uSpeed;
uniform float uWidth; // x→0..1正規化用
varying float vAlpha;

void main() {
    vec3 p = position;
    // 横方向(x)に沿って縦(y)を sin で揺らす＝五線譜が波打つ
    p.y += sin(p.x * uFreq + uTime * uSpeed) * uAmp;

    // 右端(xr=0)から左端(xr=1)へ向けて徐々に描画（xr <= uReveal で表示）
    float xr = 0.5 - p.x / uWidth;
    vAlpha = step(xr, uReveal);

    gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
}
