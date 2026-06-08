// 五線譜のフラグメントシェーダー

uniform vec3 uColor;
uniform float uOpacity; // 全体フェード（退場用）
varying float vAlpha; // ドローオンの可視/不可視（頂点シェーダーから）

void main() {
    gl_FragColor = vec4(uColor, vAlpha * uOpacity);
}
