import { NOISE, WING } from './common.js';

// Wing shader: geometry is rebuilt on the GPU from (theta, radial) so the wing
// outline, material and pattern can all change live.
export const wingVertex = /* glsl */ `
${WING}
uniform float uPhase;
uniform float uAmp;
uniform float uTime;
attribute float aRadial;
attribute float aTheta;
#ifdef USE_INSTANCING
attribute float aIPhase;
attribute float aIAlpha;
attribute float aIHue;
attribute float aIGold;
#endif
varying vec2 vPolar;
varying vec3 vNormal;
varying vec3 vView;
varying vec3 vLocal;
varying float vAlpha;
varying float vHue;
varying float vGold;

void main(){
  float phase = uPhase;
  vAlpha = 1.0;
  vHue = 0.0;
  vGold = 0.0;
  #ifdef USE_INSTANCING
  phase = aIPhase;
  vAlpha = aIAlpha;
  vHue = aIHue;
  vGold = aIGold;
  #endif
  float side = position.x >= 0.0 ? 1.0 : -1.0;
  vec3 p = wingLocalPos(side, aTheta, aRadial);
  float a = wingFlap(phase, uAmp, p.y, aRadial) + 0.22*aRadial*aRadial*uAmp*cos(phase);
  float ax = abs(p.x);
  vec3 q = vec3(side*ax*cos(a) - side*p.z*sin(a), p.y, ax*sin(a) + p.z*cos(a));
  q.z += 0.025*sin(uTime*3.1 + aRadial*7.0 + aTheta*3.0)*aRadial;
  vec3 n = normalize(vec3(-side*sin(a), 0.0, cos(a)));
  vec4 wp = vec4(q, 1.0);
  #ifdef USE_INSTANCING
  wp = instanceMatrix * wp;
  n = mat3(instanceMatrix) * n;
  #endif
  vec4 mv = modelViewMatrix * wp;
  vNormal = normalize(normalMatrix * n);
  vView = -mv.xyz;
  vPolar = vec2(aRadial, aTheta);
  vLocal = p;
  gl_Position = projectionMatrix * mv;
}
`;

export const wingFragment = /* glsl */ `
${NOISE}
uniform vec3 uBody;
uniform vec3 uAccent;
uniform vec3 uGlow;
uniform float uTime;
uniform float uDissolve;
uniform float uOpacity;
uniform float uBright;
uniform float uGhost;
uniform float uMat;      // 0 luminous 1 crystal 2 glass 3 diamond 4 metal 5 neon 6 transparent 7 holographic
uniform float uPattern;  // 0 veins 1 monarch 2 morpho 3 leopard 4 stripes 5 eyes 6 lace 7 plain
uniform float uRainbow;
uniform float uGlowAmt;
uniform float uSpec;
varying vec2 vPolar;
varying vec3 vNormal;
varying vec3 vView;
varying vec3 vLocal;
varying float vAlpha;
varying float vHue;
varying float vGold;

vec3 hsv(float h, float s, float v){
  vec3 k = clamp(abs(fract(h + vec3(0.0, 2.0/3.0, 1.0/3.0))*6.0 - 3.0) - 1.0, 0.0, 1.0);
  return v * mix(vec3(1.0), k, s);
}
vec3 hueShift(vec3 c, float h){
  if (abs(h) < 0.001) return c;
  const vec3 k = vec3(0.57735);
  float ca = cos(h*6.2831);
  return c*ca + cross(k, c)*sin(h*6.2831) + k*dot(k, c)*(1.0 - ca);
}
// Cheap cellular noise: returns (dist to nearest, dist to edge) for facets.
vec2 cells(vec2 p){
  vec2 g = floor(p); vec2 f = fract(p);
  float d1 = 8.0, d2 = 8.0;
  for (int y=-1; y<=1; y++) for (int x=-1; x<=1; x++){
    vec2 o = vec2(float(x), float(y));
    vec2 h = fract(sin(vec2(dot(g+o, vec2(127.1,311.7)), dot(g+o, vec2(269.5,183.3))))*43758.5453);
    float d = length(o + h - f);
    if (d < d1) { d2 = d1; d1 = d; } else if (d < d2) d2 = d;
  }
  return vec2(d1, d2 - d1);
}

void main(){
  float rn = vPolar.x;
  float th = vPolar.y;
  vec2 lp = vLocal.xy;

  // ---- Dissolve: edges break apart first, with a burning accent rim
  float n = snoise(vec3(lp*3.4, uTime*0.15))*0.5 + 0.5;
  float dsv = n*0.68 + (1.0 - rn)*0.32;
  float thr = uDissolve*1.08 - 0.04;
  if (dsv < thr) discard;
  float burn = (1.0 - smoothstep(thr, thr + 0.09, dsv)) * step(0.002, uDissolve);

  // ---- Shared structure
  float vth = th*7.5 + rn*1.6 + 0.15*sin(rn*9.0);
  float vl = abs(fract(vth) - 0.5);
  float vein = (1.0 - smoothstep(0.0, 0.045, vl)) * smoothstep(0.1, 0.35, rn) * (1.0 - smoothstep(0.86, 0.93, rn));
  float cross1 = 1.0 - smoothstep(0.0, 0.018, abs(rn - 0.46 - 0.05*sin(th*6.0)));
  float cross2 = 1.0 - smoothstep(0.0, 0.014, abs(rn - 0.7 - 0.03*sin(th*9.0 + 1.0)));
  float veins = max(vein, max(cross1, cross2)*smoothstep(0.1, 0.3, rn));
  float band = smoothstep(0.80, 0.9, rn);
  float rim = smoothstep(0.935, 1.0, rn);
  float sp = abs(fract(th*5.2 + 0.25) - 0.5);
  float spots = 1.0 - smoothstep(0.08, 0.16, length(vec2(sp*0.9, (rn - 0.875)*3.2)));

  // ---- Pattern
  float dark = 0.0, light = 0.0, alphaMul = 1.0, irid = 0.0;
  int pat = int(uPattern + 0.5);
  if (pat == 0) {
    float eyes = (1.0 - smoothstep(0.05, 0.085, length(vec2((th - 0.75)*0.55, rn - 0.62))))
               + (1.0 - smoothstep(0.035, 0.06, length(vec2((th + 0.75)*0.55, rn - 0.6))));
    dark = veins*0.38 + band*0.35;
    light = spots*band*0.9 + eyes*0.9;
  } else if (pat == 1) { // monarch: thick dark veins, dark border with white dots
    float thick = (1.0 - smoothstep(0.0, 0.09, vl)) * smoothstep(0.1, 0.3, rn);
    dark = max(thick, smoothstep(0.78, 0.84, rn))*0.82 + max(cross1, cross2)*0.6;
    light = spots*band*1.4 + (1.0 - smoothstep(0.02, 0.04, length(vec2(fract(th*9.0)-0.5, (rn-0.95)*5.0)*0.25)))*band;
  } else if (pat == 2) { // morpho: smooth iridescent gradient
    dark = smoothstep(0.86, 0.95, rn)*0.7 + (1.0 - smoothstep(0.0, 0.3, rn))*0.25;
    light = spots*band*0.6;
    irid = 0.9;
  } else if (pat == 3) { // leopard rosettes
    vec2 c = cells(lp*5.5);
    dark = (1.0 - smoothstep(0.18, 0.32, c.x))*0.75;
    light = (1.0 - smoothstep(0.02, 0.06, c.y))*0.25;
  } else if (pat == 4) { // tiger stripes
    float s = sin(th*11.0 + rn*4.0 + snoise(vec3(lp*2.0, 1.0))*1.2);
    dark = smoothstep(0.35, 0.6, s)*0.7*smoothstep(0.12, 0.3, rn);
    light = rim*0.5;
  } else if (pat == 5) { // peacock eyes
    vec2 e1 = vec2((th - 0.6)*0.62, rn - 0.66);
    vec2 e2 = vec2((th + 0.7)*0.62, rn - 0.62);
    float d = min(length(e1), length(e2)*1.15);
    float ring = (1.0 - smoothstep(0.0, 0.03, abs(d - 0.12))) + (1.0 - smoothstep(0.0, 0.02, abs(d - 0.07)));
    dark = (1.0 - smoothstep(0.035, 0.05, d))*0.9 + smoothstep(0.13, 0.15, d)*(1.0 - smoothstep(0.16, 0.2, d))*0.5;
    light = ring*1.2;
    irid = 0.4;
  } else if (pat == 6) { // lace: filigree net with real holes
    vec2 c = cells(vec2(th*5.0, rn*7.0));
    float net = 1.0 - smoothstep(0.03, 0.08, c.y);
    float inner = smoothstep(0.15, 0.3, rn) * (1.0 - smoothstep(0.86, 0.92, rn));
    alphaMul = mix(1.0, 0.18 + net*0.82, inner);
    light = net*inner*0.8 + veins*0.3;
  } else if (pat == 8) { // pale glitter dust — the reference video's moth
    vec2 g = floor(lp*85.0);
    float h = fract(sin(dot(g, vec2(12.9898, 78.233)))*43758.5453);
    float tw = 0.5 + 0.5*sin(uTime*2.0 + h*40.0);
    light = step(0.86, h) * tw * 0.55 * smoothstep(0.15, 0.4, rn) + rim*0.35;
    dark = veins*0.12 + smoothstep(0.55, 1.0, rn)*0.12;
  } else { // plain
    dark = 0.0;
    light = rim*0.3;
  }

  // ---- Colour
  vec3 N = normalize(vNormal) * (gl_FrontFacing ? 1.0 : -1.0);
  vec3 V = normalize(vView);
  float ndv = abs(dot(N, V));
  float fres = pow(1.0 - ndv, 2.2);
  vec3 L = normalize(vec3(0.3, 0.8, 0.9));
  vec3 Hh = normalize(L + V);
  float spec = pow(max(dot(N, Hh), 0.0), 48.0) + pow(max(dot(-N, Hh), 0.0), 48.0);

  vec3 body = hueShift(uBody, vHue);
  vec3 acc = hueShift(uAccent, vHue);
  if (uRainbow > 0.5) {
    body = hsv(fract(th*0.18 + rn*0.35 + uTime*0.05 + vHue), 0.55, 1.0);
    acc = hsv(fract(th*0.18 + rn*0.35 + uTime*0.05 + 0.35 + vHue), 0.7, 1.0);
  }
  vec3 base = mix(body, mix(body, acc, 0.35), smoothstep(0.25, 0.95, rn));
  vec3 iridC = hsv(fract(ndv*1.4 + rn*0.4 + uTime*0.04), 0.65, 1.0);
  base = mix(base, acc, fres*0.45);
  base = mix(base, base*0.5 + iridC*0.7, irid*fres + irid*0.25);
  float scales = snoise(vec3(lp*42.0, 1.0))*0.5 + 0.5;
  float lamb = 0.6 + 0.4*abs(dot(N, L));

  vec3 col;
  float alpha;
  int mat = int(uMat + 0.5);
  float glowA = uGlowAmt;
  if (mat == 1) { // crystal
    vec2 c = cells(lp*7.0);
    float edge = 1.0 - smoothstep(0.0, 0.05, c.y);
    float glint = pow(fract(sin(dot(floor(lp*7.0), vec2(12.9, 78.2)))*437.5 + uTime*0.4), 24.0);
    col = base*0.38*(1.0 - dark*0.5) + uGlow*(edge*0.7 + fres*1.1 + glint*1.6)*glowA + uGlow*light*0.5;
    alpha = 0.5 + 0.35*fres + edge*0.2;
  } else if (mat == 2) { // glass
    col = base*0.14 + uGlow*(fres*1.2 + rim*0.9)*glowA + light*base*0.4;
    alpha = 0.22 + 0.6*fres + rim*0.3;
  } else if (mat == 3) { // diamond — facets with dispersion
    vec2 c = cells(lp*9.0);
    float edge = 1.0 - smoothstep(0.0, 0.04, c.y);
    vec3 disp = hsv(fract(c.x*2.0 + ndv*2.0 + uTime*0.1), 0.75, 1.0);
    float sparkle = pow(max(0.0, sin(c.x*40.0 + uTime*3.0)), 30.0);
    col = mix(base*0.5, disp, 0.45 + fres*0.4)*(0.6 + edge*0.8) + uGlow*(sparkle*2.0 + fres*0.6)*glowA;
    alpha = 0.6 + 0.4*fres;
  } else if (mat == 4) { // metal — anisotropic environment bands
    vec3 R = reflect(-V, N);
    float env = 0.5 + 0.5*sin(R.y*9.0 + R.x*3.0 + uTime*0.3);
    col = base*(0.18 + 0.85*env*env)*(1.0 - dark*0.6) + mix(base, vec3(1.0), 0.5)*spec*2.2 + uGlow*rim*0.6*glowA;
    alpha = 1.0;
  } else if (mat == 5) { // neon — emissive lines
    col = base*0.06 + base*(veins*1.6 + rim*2.2 + light*1.2)*glowA*1.4 + acc*dark*0.4*glowA;
    alpha = 0.5 + 0.5*max(max(veins, rim), light);
  } else if (mat == 6) { // transparent
    col = base*0.06 + uGlow*(rim*1.2 + veins*0.35 + light*0.5)*glowA;
    alpha = 0.1 + 0.6*rim + 0.3*veins + 0.3*light;
  } else if (mat == 7) { // holographic
    float h = fract(ndv*1.6 + rn*0.7 + th*0.15 - uTime*0.12);
    vec3 holo = hsv(h, 0.6, 1.0);
    float scan = 0.85 + 0.15*sin(vLocal.y*140.0 + uTime*8.0);
    col = (holo*0.75 + base*0.25)*scan*(1.0 - dark*0.4) + uGlow*(rim + fres*0.8)*glowA;
    alpha = 0.6 + 0.3*fres;
  } else { // luminous (default)
    col = base*lamb*(0.8 + 0.2*scales);
    col *= 1.0 - dark;
    col += uGlow*light*0.9;
    col += uGlow*rim*1.5*glowA;
    col += body*(1.0 - smoothstep(0.0, 0.28, rn))*0.6;
    col += uGlow*fres*0.3*glowA;
    alpha = 0.94;
  }
  col += vec3(1.0)*spec*uSpec*0.9;
  col += acc*burn*5.0;
  // "the one now": gilded and lit from within
  if (vGold > 0.001) {
    vec3 gold = vec3(1.0, 0.58, 0.13);
    vec3 gilt = gold * (0.6 + 0.4*lamb) * (1.0 - dark*0.5) + gold * (rim*3.2 + light*1.6) + vec3(1.0, 0.8, 0.45) * fres * 0.7;
    col = mix(col, gilt * 1.3, vGold);
    alpha = mix(alpha, max(alpha, 0.97), vGold);
  }
  alpha *= alphaMul * vAlpha * uOpacity;
  if (uGhost > 0.5) {
    alpha *= 0.55 + 0.45*rim;
    col *= 0.85;
  }
  gl_FragColor = vec4(col * uBright, clamp(alpha, 0.0, 1.0));
}
`;

export const bodyVertex = /* glsl */ `
varying vec3 vN;
varying vec3 vV;
void main(){
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  vN = normalize(normalMatrix * normal);
  vV = -mv.xyz;
  gl_Position = projectionMatrix * mv;
}
`;

export const bodyFragment = /* glsl */ `
uniform vec3 uBody;
uniform vec3 uGlow;
uniform float uOpacity;
uniform float uBright;
varying vec3 vN;
varying vec3 vV;
void main(){
  float f = pow(1.0 - abs(dot(normalize(vN), normalize(vV))), 2.0);
  vec3 col = uBody*0.45 + uGlow*f*1.2;
  gl_FragColor = vec4(col*uBright, uOpacity);
}
`;
