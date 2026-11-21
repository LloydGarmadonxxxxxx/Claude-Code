import { NOISE, WING } from './common.js';

// All particle motion is evaluated on the GPU. Each of the six modes defines a
// target position/colour/size; the CPU only eases the six blend weights, so
// switching modes morphs every particle continuously.
export const particleVertex = /* glsl */ `
${NOISE}
${WING}
uniform float uTime;
uniform float uPhase;
uniform float uAmp;
uniform float uSize;
uniform float uProj;
uniform float uSpread;
uniform float uFocus;
uniform float uDof;
uniform float uBurstT;
uniform float uBurstPow;
uniform vec3 uBurstO;
uniform float uMorph;
uniform float uRebirth;
uniform float uTunnelT;
uniform float uTwist;
uniform float uSpin;
uniform vec3 uMouse;
uniform float uMouseStr;
uniform float uMouseSwirl;
uniform float uMouseR;
uniform float uBass;
uniform float uMid;
uniform float uTreble;
uniform vec3 uWA;
uniform vec3 uWB;
uniform vec3 uCol1;
uniform vec3 uCol2;
uniform vec3 uCol3;
uniform vec3 uBody;
uniform mat4 uBfly;
uniform vec4 uVar;
uniform float uWingVis;
// Creative Studio
uniform float uWS;
uniform float uFormA;
uniform float uFormB;
uniform float uFormMix;
uniform vec3 uWind;
uniform float uGather;
uniform float uDensity;
uniform float uFxA;
uniform float uFxB;
uniform float uFxMix;
uniform float uFxScale;
uniform float uFxBloom;
uniform float uFog;
uniform vec3 uSCol;

attribute vec4 aSeed;
attribute vec3 aGalaxy;
attribute vec3 aSphere;
attribute vec3 aKnot;
attribute vec2 aWing; // (radial f, theta)

varying vec3 vColor;
varying float vAlpha;
varying float vBlur;
varying float vStyle;
varying float vSeed;

vec3 rotY(vec3 p, float a){ float c=cos(a), s=sin(a); return vec3(c*p.x + s*p.z, p.y, -s*p.x + c*p.z); }
vec3 rotX(vec3 p, float a){ float c=cos(a), s=sin(a); return vec3(p.x, c*p.y - s*p.z, s*p.y + c*p.z); }
vec3 rotZ3(vec3 p, float a){ float c=cos(a), s=sin(a); return vec3(c*p.x - s*p.y, s*p.x + c*p.y, p.z); }
vec2 rot2(vec2 p, float a){ float c=cos(a), s=sin(a); return vec2(c*p.x - s*p.y, s*p.x + c*p.y); }

vec3 bflyCenter(){ return (uBfly * vec4(0.0, 0.0, 0.0, 1.0)).xyz; }

vec3 wingWorld(){
  float aRad = aWing.x;
  float side = position.x >= 0.0 ? 1.0 : -1.0;
  vec3 p = wingLocalPos(side, aWing.y, aRad);
  float a = wingFlap(uPhase, uAmp, p.y, aRad) + 0.22*aRad*aRad*uAmp*cos(uPhase);
  float ax = abs(p.x);
  vec3 q = vec3(side*ax*cos(a) - side*p.z*sin(a), p.y, ax*sin(a) + p.z*cos(a));
  q += (aSeed.xyz - 0.5) * 0.03;
  q.z += 0.02;
  return (uBfly * vec4(q, 1.0)).xyz;
}

vec3 unitDir(){ return aSphere / max(length(aSphere), 1e-4); }

vec3 halo(float t){
  float r = mix(1.5, 10.0, pow(aSeed.y, 1.6)) * uSpread;
  vec3 p = unitDir() * r;
  p.y *= 0.72;
  p = rotY(p, t*0.07*(1.6 - aSeed.y) + uSpin + aSeed.z*6.2831);
  p += snoise3(p*0.16 + vec3(0.0, t*0.05, 0.0)) * 0.9 * uSpread;
  return p + bflyCenter()*0.7;
}

vec3 haloColor(){
  vec3 c = mix(uBody, uCol1, smoothstep(0.05, 0.45, aSeed.y));
  c = mix(c, uCol2, smoothstep(0.55, 0.95, aSeed.y) * step(0.45, aSeed.x));
  c = mix(c, uCol3, step(0.88, aSeed.x));
  return c;
}

vec3 shapeN(float i, float t){
  i = mod(i, 4.0);
  if (i < 0.5) return aGalaxy * uSpread;
  if (i < 1.5) {
    vec3 d = unitDir();
    return d * (6.5 + 0.7*snoise(d*2.2 + t*0.15) + (aSeed.y - 0.5)*0.5) * uSpread;
  }
  if (i < 2.5) return aKnot * uSpread;
  vec3 c = aSphere * 12.0 * uSpread;
  c.y *= 0.45;
  return c + snoise3(c*0.08)*2.5;
}


// ---------------- Creative Studio particle forms ----------------
const vec3 CUBE[8] = vec3[8](vec3(-1,-1,-1), vec3(1,-1,-1), vec3(1,1,-1), vec3(-1,1,-1), vec3(-1,-1,1), vec3(1,-1,1), vec3(1,1,1), vec3(-1,1,1));
const ivec2 CE[12] = ivec2[12](ivec2(0,1), ivec2(1,2), ivec2(2,3), ivec2(3,0), ivec2(4,5), ivec2(5,6), ivec2(6,7), ivec2(7,4), ivec2(0,4), ivec2(1,5), ivec2(2,6), ivec2(3,7));
const vec3 OCT[6] = vec3[6](vec3(1,0,0), vec3(-1,0,0), vec3(0,1,0), vec3(0,-1,0), vec3(0,0,1), vec3(0,0,-1));
const ivec2 OE[12] = ivec2[12](ivec2(0,2), ivec2(0,3), ivec2(0,4), ivec2(0,5), ivec2(1,2), ivec2(1,3), ivec2(1,4), ivec2(1,5), ivec2(2,4), ivec2(4,3), ivec2(3,5), ivec2(5,2));

// style: 0 soft, 1 sparkle, 2 streak, 3 shard, 4 smoke, 5 geometric
vec3 formPos(float k, float t, out float style, out float sz, out float al){
  vec3 c = bflyCenter();
  style = 0.0; sz = 1.0; al = 0.75;
  int f = int(k + 0.5);
  if (f == 0) { // stardust
    style = aSeed.z > 0.86 ? 1.0 : 0.0;
    sz = style > 0.5 ? 1.6 : 0.9;
    return halo(t);
  }
  if (f == 1) { // galaxy
    vec3 p = rotX(rotY(aGalaxy * 1.15 * uSpread, t*0.09 + uSpin), 0.5);
    return p + c*0.4;
  }
  if (f == 2) { // light dots
    vec3 p = unitDir() * (5.0 + 11.0*aSeed.y) * uSpread;
    p.y += sin(t*0.5 + aSeed.x*30.0)*0.5;
    p = rotY(p, t*0.03 + uSpin);
    sz = 2.6; al = step(0.8, aSeed.x) * 0.9;
    return p + c*0.4;
  }
  if (f == 3) { // meteors: 300 meteors, each a trail of particles
    float id = floor(aSeed.x * 300.0);
    float h1 = hash11(id*1.7), h2 = hash11(id*3.1 + 4.0), h3 = hash11(id*5.3 + 9.0), h4 = hash11(id*7.9 + 2.0);
    vec3 dir = normalize(vec3(-1.0, -0.55, 0.22));
    vec3 start = vec3((h1 - 0.5)*44.0 + 14.0, (h2 - 0.5)*26.0 + 12.0, (h3 - 0.5)*22.0) * uSpread;
    float life = fract(t*0.16*(0.6 + h4) + h1*7.0);
    float back = pow(aSeed.w, 1.6) * 5.5;
    vec3 p = start + dir*(life*48.0 - back);
    style = 2.0;
    sz = mix(1.6, 0.4, aSeed.w);
    al = (1.0 - aSeed.w) * smoothstep(0.0, 0.08, life) * (1.0 - smoothstep(0.85, 1.0, life)) * 1.4;
    return p;
  }
  if (f == 4) { // energy shards
    float ring = floor(aSeed.w * 3.0);
    float r = (3.2 + ring*1.7 + (aSeed.y - 0.5)*0.9) * uSpread;
    float a = aSeed.x*6.2831 + t*(0.55 - ring*0.14);
    vec3 p = vec3(cos(a)*r, (aSeed.z - 0.5)*0.6, sin(a)*r);
    p = rotX(p, 0.4 + ring*0.55);
    p = rotY(p, ring*1.2);
    style = 3.0; sz = 1.5; al = 0.85;
    return p + c;
  }
  if (f == 5) { // light ribbons
    float k2 = floor(aSeed.w * 5.0);
    float u = aSeed.x*2.0 - 1.0;
    vec3 p = vec3(u*15.0*uSpread,
                  sin(u*3.0 + t*0.6 + k2*1.3)*2.6 + (k2 - 2.0)*1.3,
                  cos(u*2.3 + t*0.45 + k2)*3.2);
    vec3 off = vec3(0.0, (aSeed.y - 0.5)*0.45, (aSeed.z - 0.5)*0.12);
    p += off;
    sz = 0.7; al = 0.9;
    return p + c*0.5;
  }
  if (f == 6) { // smoke
    float h = fract(t*0.045*(0.5 + aSeed.y) + aSeed.x);
    float y = h*15.0 - 6.0;
    vec2 disc = vec2(cos(aSeed.z*6.2831), sin(aSeed.z*6.2831)) * sqrt(aSeed.w) * 2.5;
    vec3 p = vec3(disc.x, y, disc.y) * vec3(1.0 + h*1.4, 1.0, 1.0 + h*1.4);
    p += snoise3(p*0.18 + vec3(0.0, -t*0.15, 0.0)) * (0.6 + h*2.5);
    style = 4.0; sz = 5.0 + h*5.0; al = 0.18 * smoothstep(0.0, 0.15, h) * (1.0 - smoothstep(0.7, 1.0, h));
    return p * uSpread + vec3(c.x, 0.0, c.z);
  }
  if (f == 7) { // magic sparkles: rising helix around the butterfly
    float h = fract(t*0.07 + aSeed.x);
    float y = h*10.0 - 4.5;
    float ang = aSeed.x*40.0 + t*1.1 + y*0.7;
    float r = (1.4 + aSeed.y*2.6 + h*1.2) * uSpread;
    vec3 p = vec3(cos(ang)*r, y, sin(ang)*r) + snoise3(vec3(aSeed.xy*10.0, t*0.2))*0.3;
    style = 1.0; sz = 1.3; al = (0.4 + 0.6*pow(0.5 + 0.5*sin(t*4.0 + aSeed.z*50.0), 4.0)) * (1.0 - smoothstep(0.8, 1.0, h));
    return p + c;
  }
  // geometric: nested cube + octahedron edges
  int e = int(aSeed.x * 11.999);
  vec3 p;
  if (aSeed.w < 0.5) {
    p = mix(CUBE[CE[e].x], CUBE[CE[e].y], aSeed.y) * 3.6;
    p = rotY(rotX(p, t*0.21), t*0.17);
  } else {
    p = mix(OCT[OE[e].x], OCT[OE[e].y], aSeed.y) * 6.4;
    p = rotX(rotY(p, -t*0.13), 0.35);
  }
  p += (aSeed.zwx - 0.5) * 0.08;
  style = 5.0; sz = 1.2; al = 0.85;
  return p * uSpread + c;
}

// Effect targets
vec3 fxPos(float k, vec3 basePos, float t, inout vec3 col){
  int f = int(k + 0.5);
  vec3 c = bflyCenter();
  if (f == 0) return basePos;
  if (f == 1) { // scatter
    vec3 p = unitDir() * mix(4.0, 15.0, aSeed.y) * uSpread;
    p = rotY(p, t*0.2*(1.2 - aSeed.y));
    return c + p + snoise3(p*0.12 + t*0.15)*1.5;
  }
  if (f == 2 || f == 9) { // all particles on the wing (reassemble / giant)
    vec3 w = wingWorld();
    return c + (w - c) * uFxScale;
  }
  if (f == 3) { // galaxy
    col = mix(col, mix(uCol1, uCol3, smoothstep(2.0, 9.0, length(aGalaxy))), 0.6);
    return c + rotX(rotY(aGalaxy*0.95*uSpread, t*0.18), 0.55);
  }
  if (f == 4) { // crystal shards orbit
    float ring = floor(aSeed.w * 3.0);
    float r = (1.8 + ring*0.9 + (aSeed.y - 0.5)*0.5);
    float a = aSeed.x*6.2831 + t*(0.9 - ring*0.25);
    vec3 p = rotY(rotX(vec3(cos(a)*r, (aSeed.z - 0.5)*0.3, sin(a)*r), 0.5 + ring*0.6), ring*1.4);
    col = mix(col, uCol3, 0.5);
    return c + p;
  }
  if (f == 5) { // energy beam
    float y = (fract(aSeed.x + t*0.28*(0.5 + aSeed.z)) * 2.0 - 1.0) * 18.0;
    float r = 0.12 + 0.7*pow(aSeed.y, 3.0) + 0.25*exp(-abs(y)*0.4);
    float a = aSeed.z*6.2831 + t*2.4 + y*0.3;
    col = mix(col, uCol3*1.3, 0.6);
    return vec3(c.x + cos(a)*r, y, c.z + sin(a)*r);
  }
  if (f == 6) { // planet with ring
    vec3 p;
    if (aSeed.w < 0.66) {
      p = unitDir() * (3.6 + (aSeed.y - 0.5)*0.12);
      p = rotY(p, t*0.25);
      float lat = p.y / 3.6;
      col = mix(uCol1, uCol2, 0.5 + 0.5*sin(lat*9.0 + snoise(p*0.6)*2.0));
    } else {
      float r = 5.0 + aSeed.y*2.6;
      float a = aSeed.x*6.2831 + t*(0.6 - aSeed.y*0.3);
      p = rotZ3(vec3(cos(a)*r, (aSeed.z - 0.5)*0.08, sin(a)*r), 0.42);
      col = mix(uCol3, uCol2, aSeed.y);
    }
    return c + p * uSpread;
  }
  if (f == 7) { // vortex funnel
    float h = fract(aSeed.x + t*0.14*(0.6 + aSeed.z));
    float y = (1.0 - h) * 14.0 - 7.0;
    float r = (0.35 + pow((y + 7.0)/14.0, 1.6) * 6.5) * (0.85 + aSeed.y*0.3);
    float a = aSeed.z*6.2831 + t*(2.8 - (y + 7.0)*0.12) + y*0.45;
    col = mix(col, mix(uCol3, uCol2, (y + 7.0)/14.0), 0.5);
    return c + vec3(cos(a)*r, y, sin(a)*r) * uSpread;
  }
  if (f == 8) { // blooming flower
    float layer = floor(aSeed.w * 4.0);
    float petals = 5.0 + layer;
    float th = aSeed.x * 6.2831;
    float pr = pow(abs(cos(petals*0.5*th)), 0.6) * (4.2 - layer*0.75) * uFxBloom;
    float rr = pr * sqrt(aSeed.y);
    float y = rr*rr*0.11*(1.0 + layer*0.5) - layer*0.25 - 1.5;
    vec3 p = rotY(vec3(cos(th)*rr, y, sin(th)*rr), layer*0.6 + t*0.12);
    if (aSeed.z > 0.94) p = vec3((aSeed.x - 0.5)*0.4, -1.5 - aSeed.y*9.0, (aSeed.w - 0.5)*0.4); // stem
    col = mix(uCol2, uCol1, aSeed.y*0.8 + layer*0.1);
    col = mix(col, uCol3, 1.0 - smoothstep(0.0, 0.35, aSeed.y));
    return c + p * uSpread;
  }
  return basePos;
}

void main(){
  float t = uTime;
  vec3 pos = vec3(0.0);
  vec3 col = vec3(0.0);
  float alpha = 0.0;
  float size = 0.0;
  bool isWing = aSeed.w < 0.36;

  // ---- A: butterfly -----------------------------------------------------
  if (uWA.x > 0.001) {
    vec3 p = isWing ? wingWorld() : halo(t);
    vec3 c = isWing ? mix(uBody, uCol3, aSeed.x*0.45) : haloColor();
    float a = isWing ? 0.85 * uWingVis : 0.7;
    pos += p * uWA.x; col += c * uWA.x; alpha += a * uWA.x; size += (isWing ? 0.8 : 1.0) * uWA.x;
  }
  // ---- B: particle universe (morphing shapes) ---------------------------
  if (uWA.y > 0.001) {
    float m = uMorph;
    float i0 = floor(m);
    float f = smoothstep(aSeed.x*0.4, aSeed.x*0.4 + 0.6, fract(m));
    vec3 p = mix(shapeN(i0, t), shapeN(i0 + 1.0, t), f);
    p += unitDir() * sin(f*3.14159) * 2.5 * uSpread;
    p += snoise3(p*0.12 + t*0.06) * 0.55;
    p = rotX(rotY(p, t*0.05 + uSpin), 0.38);
    float rr = length(p) / (11.0*uSpread);
    vec3 c = mix(uCol3, uCol1, smoothstep(0.0, 0.35, rr));
    c = mix(c, uCol2, smoothstep(0.45, 1.0, rr) * step(0.35, aSeed.x));
    c = mix(c, vec3(1.0), step(0.97, aSeed.x)*0.6);
    pos += p * uWA.y; col += c * uWA.y; alpha += 0.75 * uWA.y; size += 1.0 * uWA.y;
  }
  // ---- C: energy burst --------------------------------------------------
  if (uWA.z > 0.001) {
    float life = fract(t*(0.24 + aSeed.y*0.22) + aSeed.x);
    float R = mix(5.0, 27.0, aSeed.z) * uSpread * (1.0 + uBass*0.5);
    vec3 d = unitDir();
    if (aSeed.w < 0.5) {
      float k = floor(aSeed.w / 0.5 * 3.0);
      vec3 n = normalize(k < 1.0 ? vec3(0.0, 1.0, 0.25) : (k < 2.0 ? vec3(0.8, 0.5, 0.3) : vec3(-0.6, 0.6, 0.5)));
      d = normalize(d - n*dot(d, n) + n*(aSeed.y - 0.5)*0.06);
    }
    float e = 1.0 - pow(1.0 - life, 2.4);
    vec3 p = d * e * R + snoise3(d*2.0 + t*0.25) * life * 1.6;
    vec3 c = mix(uCol3*1.4, mix(uCol1, uCol2, step(0.55, aSeed.x)), smoothstep(0.0, 0.35, life));
    float a = (1.0 - life) * smoothstep(0.0, 0.03, life) * 1.3;
    pos += p * uWA.z; col += c * uWA.z; alpha += a * uWA.z; size += mix(1.7, 0.6, life) * uWA.z;
  }
  // ---- D: time tunnel ---------------------------------------------------
  if (uWB.x > 0.001) {
    float L = 130.0;
    float z = -118.0 + mod(aSeed.z*L + uTunnelT*(0.7 + aSeed.y*0.6)*16.0, L);
    float u = aSeed.x * 4.0;
    float e = floor(u);
    float s = fract(u)*2.0 - 1.0;
    float h = 4.6 * uSpread * (aSeed.w < 0.7 ? (0.955 + 0.09*aSeed.y) : (0.12 + 0.75*aSeed.y));
    vec2 q = e < 1.0 ? vec2(s, 1.0) : (e < 2.0 ? vec2(1.0, s) : (e < 3.0 ? vec2(s, -1.0) : vec2(-1.0, s)));
    q = rot2(q*h, z*0.012*uTwist + uSpin);
    vec3 p = vec3(q, z);
    vec3 c = aSeed.w < 0.7 ? mix(uCol1, uCol2, aSeed.y) : mix(uCol3, uBody, aSeed.y);
    float a = smoothstep(-118.0, -70.0, z) * (1.0 - smoothstep(4.0, 12.0, z)) * 0.9;
    pos += p * uWB.x; col += c * uWB.x; alpha += a * uWB.x; size += (aSeed.w < 0.7 ? 0.9 : 1.2) * uWB.x;
  }
  // ---- E: aurora --------------------------------------------------------
  if (uWB.y > 0.001) {
    vec3 p; vec3 c; float a; float sz;
    if (aSeed.w < 0.74) {
      float k = floor(aSeed.x * 4.0);
      float x = (fract(aSeed.x*4.0) - 0.5) * 36.0 * uSpread;
      float h = pow(aSeed.y, 1.7);
      float y = -3.5 + h * 10.5 * uSpread + 1.3*sin(x*0.17 + k*1.7 + t*0.22);
      float z = -4.0 - k*3.6 + 2.6*sin(x*0.21*uVar.y + t*0.3 + k*2.1) + 1.6*snoise(vec3(x*0.06, k*1.3, t*0.08));
      x += 0.7*sin(y*0.45 + t*0.5 + k);
      p = vec3(x, y, z);
      c = mix(uCol3, uCol1, smoothstep(0.0, 0.5, h));
      c = mix(c, uCol2, smoothstep(0.5, 1.0, h));
      float ripple = 0.55 + 0.45*sin(x*0.45 - t*1.2 + k*1.3);
      a = (1.0 - h*0.5) * ripple * 1.5;
      sz = 1.3 + (1.0 - h)*0.5;
    } else {
      vec3 d = unitDir();
      p = d * (34.0 + aSeed.y*22.0);
      p.y = abs(p.y)*0.9 - 2.0;
      c = mix(vec3(1.0), uCol3, aSeed.x*0.5);
      a = 0.35 + 0.65*pow(0.5 + 0.5*sin(t*(1.0 + aSeed.x*3.0) + aSeed.z*40.0), 3.0);
      sz = 0.55;
    }
    pos += p * uWB.y; col += c * uWB.y; alpha += a * uWB.y; size += sz * uWB.y;
  }
  // ---- F: rebirth -------------------------------------------------------
  if (uWB.z > 0.001) {
    bool w = aSeed.w < 0.8;
    vec3 W = w ? wingWorld() : halo(t);
    vec3 cen = bflyCenter();
    float delay = aWing.x*0.16 + aSeed.x*0.08;
    float pr = uRebirth;
    float outv = smoothstep(0.16 + delay, 0.42 + delay, pr);
    float back = smoothstep(0.6 + delay*0.6, 0.88 + delay*0.5, pr);
    float d = outv * (1.0 - back);
    vec3 S = unitDir() * mix(3.0, 13.0, aSeed.y) * uSpread;
    S = rotY(S, t*0.3*(1.2 - aSeed.y) + aSeed.z);
    S += snoise3(S*0.14 + t*0.2) * 1.6;
    S += cen;
    vec3 p = mix(W, S, smoothstep(0.0, 1.0, d));
    p += cross(normalize(p - cen + 1e-4), vec3(0.0, 1.0, 0.0)) * sin(d*3.14159) * 1.4;
    vec3 c = w ? mix(uBody, uCol1, d) : haloColor();
    c = mix(c, uCol3, sin(d*3.14159)*0.5);
    float a = (w ? 0.85 : 0.6) * (1.0 + sin(d*3.14159)*0.6);
    pos += p * uWB.z; col += c * uWB.z; alpha += a * uWB.z; size += (w ? 0.8 : 1.0) * uWB.z;
  }

  // ---- S: Creative Studio ---------------------------------------------
  float style = 0.0;
  if (uWS > 0.001) {
    float sA, zA, aA, sB, zB, aB;
    vec3 pa = formPos(uFormA, t, sA, zA, aA);
    vec3 pb = formPos(uFormB, t, sB, zB, aB);
    float m = smoothstep(aSeed.x*0.4, aSeed.x*0.4 + 0.6, uFormMix);
    vec3 p = mix(pa, pb, m);
    p += unitDir() * sin(m*3.14159) * 1.5;
    vec3 c = bflyCenter();
    // wind / flow direction
    p += uWind * (mod(t*0.9 + aSeed.y*24.0, 24.0) - 12.0) * 0.45;
    // density: cluster toward the centre or loosen outward
    float dd = uDensity - 1.0;
    p = c + (p - c) * (dd > 0.0 ? mix(1.0, 0.35 + 0.65*sqrt(aSeed.z), clamp(dd, 0.0, 1.0)) : 1.0 + (-dd)*aSeed.z*1.4);
    // gather (-1) / scatter (+1)
    float gs = uGather < 0.0 ? mix(1.0, 0.12, -uGather) : 1.0 + uGather*2.2;
    p = c + (p - c) * gs;
    vec3 sc = mix(uSCol, uCol2, step(0.62, aSeed.x)*0.7);
    sc = mix(sc, uCol3, step(0.9, aSeed.x)*0.6);
    pos += p * uWS; col += sc * uWS; alpha += mix(aA, aB, m) * uWS; size += mix(zA, zB, m) * uWS;
    style = m < 0.5 ? sA : sB;
  }

  // ---- Effects (studio) ------------------------------------------------
  if (uFxA > 0.5 || uFxB > 0.5) {
    vec3 ca = col, cb = col;
    vec3 fa = fxPos(uFxA, pos, t, ca);
    vec3 fb = fxPos(uFxB, pos, t, cb);
    float m = smoothstep(aSeed.y*0.45, aSeed.y*0.45 + 0.55, uFxMix);
    vec3 target = mix(fa, fb, m);
    pos = target + unitDir() * sin(m*3.14159) * 2.0 * step(0.5, abs(uFxA - uFxB));
    col = mix(ca, cb, m);
    if (uFxB > 0.5 && uFxB < 2.5) alpha = max(alpha, 0.75);
    if (uFxB > 2.5) { alpha = max(alpha, 0.65); size = max(size, 0.9); if (m > 0.5) style = 0.0; }
  }

  // ---- Click burst: radial shells + rings, then re-gathers -------------
  if (uBurstT < 6.0) {
    vec3 dir = normalize(pos - uBurstO + (aSeed.xyz - 0.5) * 1.4);
    if (aSeed.w > 0.62) {
      vec3 n = normalize(vec3(sin(aSeed.z*6.28)*0.35, 1.0, cos(aSeed.z*6.28)*0.35));
      dir = normalize(dir - n*dot(dir, n));
    }
    float bt = uBurstT;
    float amt = (1.0 - exp(-bt*5.5)) * exp(-bt*0.95);
    float reach = mix(2.5, 13.0, pow(aSeed.y, 0.8)) * uBurstPow;
    float fall = exp(-length(pos - uBurstO)*0.045);
    pos += dir * amt * reach * fall + snoise3(dir*3.0 + bt*0.6) * amt * 1.3 * fall;
    alpha *= 1.0 + amt * 1.2 * fall;
    col = mix(col, uCol3, amt * 0.35 * fall);
  }

  // ---- Pointer field ----------------------------------------------------
  vec3 dm = pos - uMouse;
  float dl = length(dm);
  float inf = exp(-dl*dl / (uMouseR*uMouseR));
  vec3 dn = dm / max(dl, 1e-3);
  pos += (dn * uMouseStr * 2.0 + cross(dn, vec3(0.0, 0.0, 1.0)) * uMouseSwirl * 2.2) * inf;
  alpha *= 1.0 + inf * abs(uMouseStr) * 0.6;

  // ---- Audio ------------------------------------------------------------
  vec3 c0 = uWB.x > 0.5 ? vec3(0.0, 0.0, pos.z) : bflyCenter()*0.5;
  pos += (pos - c0) * uBass * 0.07 * aSeed.y;
  size *= 1.0 + uTreble * 1.1 * aSeed.z;
  alpha *= 1.0 + uMid * 0.6;

  // ---- Fine drift -------------------------------------------------------
  pos += snoise3(pos*0.22 + t*0.12) * 0.07;

  vec4 mv = modelViewMatrix * vec4(pos, 1.0);
  gl_Position = projectionMatrix * mv;
  float depth = max(-mv.z, 0.1);

  float twinkle = 0.7 + 0.3*sin(t*(1.3 + aSeed.x*4.0) + aSeed.y*37.0);
  float big = aSeed.z > 0.985 ? 2.6 : 1.0;
  float px = 0.034 * uSize * size * (0.55 + aSeed.y*0.9) * big * uProj / depth;
  float coc = uDof * abs(depth - uFocus) / depth * uProj * 0.0105;
  float total = clamp(px + coc, 1.0, uProj * 0.06);
  float energy = (px*px + 0.6) / (total*total + 0.6);
  vBlur = clamp(coc / total, 0.0, 1.0);
  float fog = exp(-max(depth - 9.0, 0.0) * uFog * 0.07);
  if (style > 1.5 && style < 2.5) total *= 1.6;
  if (style > 3.5 && style < 4.5) total = min(total * 1.8, uProj * 0.12);
  vAlpha = alpha * twinkle * max(energy, 0.035) * fog;
  vStyle = style;
  vSeed = aSeed.z;
  vColor = col;
  gl_PointSize = total;
}
`;

export const particleFragment = /* glsl */ `
uniform float uGlow;
uniform float uOpacity;
varying vec3 vColor;
varying float vAlpha;
varying float vBlur;
varying float vStyle;
varying float vSeed;
void main(){
  vec2 c = gl_PointCoord*2.0 - 1.0;
  float d = dot(c, c);
  if (d > 1.0) discard;
  float a;
  int st = int(vStyle + 0.5);
  if (st == 1) { // four-point sparkle
    float cross = exp(-abs(c.x)*14.0)*exp(-abs(c.y)*2.2) + exp(-abs(c.y)*14.0)*exp(-abs(c.x)*2.2);
    a = cross*0.9 + exp(-d*18.0)*0.8;
  } else if (st == 2) { // streak along the meteor direction
    vec2 dir = normalize(vec2(-1.0, 0.55));
    float along = dot(c, dir);
    float across = dot(c, vec2(-dir.y, dir.x));
    a = exp(-across*across*60.0) * smoothstep(1.0, -0.2, along) * smoothstep(-1.0, -0.6, along) + exp(-d*20.0)*0.5;
  } else if (st == 3) { // rotated diamond shard
    float an = vSeed*6.2831;
    vec2 r = mat2(cos(an), -sin(an), sin(an), cos(an)) * c;
    float k = abs(r.x)*1.9 + abs(r.y)*0.75;
    a = (1.0 - smoothstep(0.75, 1.0, k)) * (0.55 + 0.45*(1.0 - k)) + exp(-d*24.0)*0.4;
  } else if (st == 4) { // smoke puff
    a = exp(-d*2.2) * 0.6;
  } else if (st == 5) { // geometric: hexagonal outline
    vec2 q = abs(c);
    float hx = max(q.x*0.866 + q.y*0.5, q.y);
    a = (1.0 - smoothstep(0.0, 0.14, abs(hx - 0.68))) * 0.9 + exp(-d*30.0)*0.5;
  } else {
    float g = exp(-d*5.0);
    float core = exp(-d*26.0);
    float disk = (1.0 - smoothstep(0.72, 1.0, d)) * (0.6 + 0.4*d);
    a = mix(g*0.7 + core*0.55, disk*0.45, vBlur);
  }
  gl_FragColor = vec4(vColor * uGlow, a * vAlpha * uOpacity);
}
`;
