// surfaceNormal を波面の傾きぶん揺らして波紋を出す
// MAX_RIPPLES は water.js の MAX_RIPPLES と一致させること
#define MAX_RIPPLES 6
// 波面が広がる速さ(単位/秒) / 輪の太さ / 時間減衰(大きいほど早く消える)
#define RIPPLE_SPEED 10.0
#define RIPPLE_WIDTH 1.0
#define RIPPLE_DECAY 1.6

uniform float uTime;
uniform int uRippleCount;
uniform vec4 uRipples[ MAX_RIPPLES ]; // xy=中心XZ, z=発生時刻, w=振幅

vec3 applyRipples( vec3 n, vec2 posXZ ) {
  vec2 perturb = vec2( 0.0 );
  for ( int i = 0; i < MAX_RIPPLES; i ++ ) {
    if ( i >= uRippleCount ) break;
    vec4 rp = uRipples[ i ];
    float age = uTime - rp.z;
    if ( age < 0.0 ) continue;
    vec2 toC = posXZ - rp.xy;
    float d = length( toC );
    float r = age * RIPPLE_SPEED;            // 波面の現在半径
    float x = ( d - r ) / RIPPLE_WIDTH;
    float band = exp( - x * x );             // 波面付近だけ
    float slope = - 2.0 * x / RIPPLE_WIDTH * band; // 波面の傾き＝法線の揺れ
    float decay = exp( - age * RIPPLE_DECAY );
    vec2 dir = d > 0.0001 ? toC / d : vec2( 0.0 );
    perturb += dir * slope * rp.w * decay;
  }
  n.xz += perturb;
  return normalize( n );
}
