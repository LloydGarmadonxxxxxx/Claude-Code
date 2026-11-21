// 所有 GLSL 着色器。粒子运动全部在 GPU 顶点着色器中计算：
// 每个粒子携带 4 个目标形态（树 / 爆散 / 星云 / 卡片边框），
// CPU 只更新 4 个权重 uW，顶点着色器按粒子各自的缓动指数混合，形成错落的聚合与爆散。

const common = /* glsl */ `
uniform float uTime;
uniform vec4 uW;            // x 树, y 爆散, z 星云, w 卡片边框
uniform float uScatterScale;

attribute vec3 aScatter;
attribute vec3 aCloud;
attribute vec4 aFrame;       // xyz 位置, w = 是否属于金色边框
attribute vec4 aData;        // x 尺寸, y 随机1, z 随机2, w 类型(0 普通,1 闪光,2 星星,3 彩球)

vec3 rotY(vec3 p, float a) {
  float c = cos(a), s = sin(a);
  return vec3(c * p.x + s * p.z, p.y, -s * p.x + c * p.z);
}
vec2 rot2(vec2 p, float a) {
  float c = cos(a), s = sin(a);
  return vec2(c * p.x - s * p.y, s * p.x + c * p.y);
}

// 每个粒子独立的权重：用不同的指数让粒子先后到达，避免整齐划一
vec4 particleWeights() {
  vec4 w = max(uW, vec4(0.0)) + 1e-5;
  float e = mix(0.45, 2.6, aData.y);
  w = pow(w, vec4(e));
  return w / dot(w, vec4(1.0));
}

vec3 particlePosition(vec4 w, out float transit) {
  float r1 = aData.y;
  float r2 = aData.z;
  float t = uTime;

  // 树：自然漂浮
  vec3 tree = position + vec3(
    sin(t * 0.9 + r1 * 31.0),
    sin(t * 0.7 + r2 * 17.0),
    cos(t * 0.8 + r1 * 23.0)) * (0.03 + 0.07 * r2);

  // 爆散：向外持续漂移
  vec3 sc = aScatter * uScatterScale * (1.0 + 0.07 * sin(t * 0.4 + r2 * 12.0));
  sc = rotY(sc, t * 0.05 * (r1 - 0.5));

  // 星云：差速旋转（内快外慢）形成空间纵深
  float cr = length(aCloud.xz);
  vec3 cl = rotY(aCloud, t * 0.32 * (4.0 / (cr + 1.6)));
  cl.y += sin(t * 0.6 + cr * 0.8 + r1 * 6.2831) * 0.22;
  cl.yz = rot2(cl.yz, 0.52);   // 星盘朝镜头倾斜，展示纵深

  // 卡片边框：边框微微闪动，外圈光晕缓慢公转
  vec3 fr = aFrame.xyz;
  float fl = length(fr.xy);
  fr.xy = rot2(fr.xy, (1.0 - aFrame.w) * step(2.9, fl) * t * 0.5 / (fl * 0.35));
  fr += vec3(sin(t * 1.3 + r1 * 40.0), cos(t * 1.1 + r2 * 30.0), sin(t * 0.9 + r2 * 20.0)) * 0.025;

  vec3 p = tree * w.x + sc * w.y + cl * w.z + fr * w.w;

  // 切换途中走弧线：越处于“半路”越偏离直线
  transit = 1.0 - max(max(w.x, w.y), max(w.z, w.w));
  vec3 swirl = vec3(sin(r1 * 12.0 + t * 1.7), cos(r2 * 9.0 + t * 1.3), sin(r2 * 15.0 - t * 1.5));
  p += swirl * transit * (1.2 + 2.8 * r2);
  p = rotY(p, transit * (r1 - 0.5) * 3.0);
  return p;
}
`;

export const particleVertex = /* glsl */ `
${common}
uniform float uSize;
uniform float uScale;       // 视口高度 / (2 tan(fov/2))
uniform float uFocus;
uniform float uAperture;
uniform float uIntensity;
attribute vec3 aColor;

varying vec3 vColor;
varying float vAlpha;
varying float vBlur;
varying float vFlare;

void main() {
  vec4 w = particleWeights();
  float transit;
  vec3 p = particlePosition(w, transit);
  vec4 mv = modelViewMatrix * vec4(p, 1.0);
  gl_Position = projectionMatrix * mv;

  float depth = max(-mv.z, 0.1);
  // 景深：离焦平面越远，点越大越虚越暗
  float coc = clamp(abs(depth - uFocus) * uAperture, 0.0, 2.5);

  float r1 = aData.y, r2 = aData.z, type = aData.w;
  float tw = 0.62 + 0.38 * sin(uTime * (1.4 + r2 * 4.0) + r1 * 60.0);
  float spark = pow(max(sin(uTime * (0.5 + r1 * 1.2) + r2 * 80.0), 0.0), 38.0) * 2.2;

  float size = aData.x * uSize * (1.0 + coc * 0.6);
  float px = size * uScale / depth;
  // 限制最大光斑：靠近镜头的粒子缩小并淡出，控制 GPU 填充量
  float near = smoothstep(4.0, 10.0, depth);
  px = min(px, mix(6.0, 30.0, near));
  gl_PointSize = max(px, 1.0);

  vAlpha = (tw + spark) / (1.0 + coc * coc * 2.2);
  vAlpha *= clamp(px / 1.6, 0.25, 1.0) * near;
  vBlur = clamp(coc * 0.6, 0.0, 1.0);
  vFlare = (type == 1.0 || type == 2.0) ? (0.55 + spark * 0.4) * (1.0 - vBlur) : spark * 0.25;

  vec3 col = aColor;
  // 进入卡片状态时，边框粒子统一变成香槟金
  col = mix(col, vec3(1.0, 0.74, 0.3) * 1.35, w.w * aFrame.w);
  if (type == 2.0) col *= 1.0 + 0.6 * w.x;
  vColor = col * uIntensity * (1.0 + spark * 0.4 + transit * 0.6);
}
`;

export const particleFragment = /* glsl */ `
varying vec3 vColor;
varying float vAlpha;
varying float vBlur;
varying float vFlare;

void main() {
  vec2 uv = gl_PointCoord - 0.5;
  float d = length(uv) * 2.0;
  if (d > 1.0) discard;
  float sharp = mix(11.0, 2.4, vBlur);
  float core = exp(-d * d * sharp);
  float halo = exp(-d * 3.5) * 0.12 * (1.0 - vBlur * 0.5);
  float a = (core + halo) * (1.0 - smoothstep(0.75, 1.0, d));
  float flare = 0.0;
  if (vFlare > 0.02) {
    vec2 q = abs(uv);
    flare = (max(0.0, 1.0 - q.x * 16.0) * max(0.0, 1.0 - q.y * 2.0) +
             max(0.0, 1.0 - q.y * 16.0) * max(0.0, 1.0 - q.x * 2.0)) * vFlare;
  }
  gl_FragColor = vec4(vColor * (a + flare) * vAlpha, 1.0);
}
`;

// 粒子之间的动态连线（与粒子共享同一套位置计算）
export const linkVertex = /* glsl */ `
${common}
uniform float uLinkAlpha;
varying float vAlpha;
void main() {
  vec4 w = particleWeights();
  float transit;
  vec3 p = particlePosition(w, transit);
  gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
  float flick = 0.45 + 0.55 * sin(uTime * (0.8 + aData.z * 2.0) + aData.y * 40.0);
  vAlpha = uLinkAlpha * flick * max(0.0, 1.0 - transit * 4.0) * (w.x + w.z * 0.35);
}
`;

export const linkFragment = /* glsl */ `
varying float vAlpha;
void main() {
  gl_FragColor = vec4(vec3(1.0, 0.72, 0.32) * vAlpha, 1.0);
}
`;

// 拖尾光点：InstancedBufferGeometry，每个实例是一颗彗星，基础几何是沿时间回溯的拖尾点
export const cometVertex = /* glsl */ `
uniform float uTime;
uniform vec4 uW;
uniform float uScale;
uniform float uIntensity;
attribute float aIdx;        // 0 = 头部, 1 = 尾端
attribute vec4 aComet;       // 相位, 速度, 半径偏移, 方向
attribute vec3 aCometColor;
varying vec3 vColor;
varying float vAlpha;

vec3 squarePath(float u, float s) {
  float q = fract(u) * 4.0;
  float f = fract(q);
  vec2 p;
  if (q < 1.0) p = vec2(mix(-s, s, f), s);
  else if (q < 2.0) p = vec2(s, mix(s, -s, f));
  else if (q < 3.0) p = vec2(mix(s, -s, f), -s);
  else p = vec2(-s, mix(-s, s, f));
  return vec3(p, 0.08);
}

vec3 cometPos(float t) {
  float ph = aComet.x, sp = aComet.y, ro = aComet.z, dir = aComet.w;
  float h = fract(ph + t * 0.05 * sp);
  float R = (1.0 - h) * 3.75 + 0.35 + ro;
  float a = dir * (t * 0.8 * sp + ph * 6.2831) + h * 15.0;
  vec3 tree = vec3(cos(a) * R, mix(-4.6, 4.9, h), sin(a) * R);

  float R2 = 4.5 + ro * 14.0 + ph * 4.0;
  float a2 = dir * (t * 0.45 * sp + ph * 6.2831);
  vec3 cloud = vec3(cos(a2) * R2, sin(a2 * 1.7 + ph * 5.0) * 1.3 + (ph - 0.5) * 4.0, sin(a2) * R2);

  vec3 fr = squarePath(ph + t * 0.07 * sp * dir, 2.55 + ro * 0.6);
  return tree * uW.x + cloud * 1.7 * uW.y + cloud * uW.z + fr * uW.w;
}

void main() {
  float t = uTime - aIdx * 0.42;
  vec3 p = cometPos(t);
  vec4 mv = modelViewMatrix * vec4(p, 1.0);
  gl_Position = projectionMatrix * mv;
  float depth = max(-mv.z, 0.1);
  float head = 1.0 - aIdx;
  gl_PointSize = clamp((0.05 + 0.13 * head * head) * uScale / depth, 1.0, 20.0);
  vAlpha = pow(head, 1.7);
  vColor = aCometColor * uIntensity * (1.0 + 1.5 * step(aIdx, 0.001));
}
`;

export const cometFragment = /* glsl */ `
varying vec3 vColor;
varying float vAlpha;
void main() {
  float d = length(gl_PointCoord - 0.5) * 2.0;
  if (d > 1.0) discard;
  float a = exp(-d * d * 6.0) * vAlpha;
  gl_FragColor = vec4(vColor * a, 1.0);
}
`;

// 树顶星光晕
export const glowVertex = /* glsl */ `
uniform float uTime;
uniform float uScale;
uniform float uGlow;
varying float vAlpha;
void main() {
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  gl_Position = projectionMatrix * mv;
  float pulse = 1.0 + 0.12 * sin(uTime * 2.1) + 0.06 * sin(uTime * 5.3);
  gl_PointSize = clamp(1.7 * pulse * uScale / max(-mv.z, 0.1), 1.0, 512.0);
  vAlpha = uGlow;
}
`;

export const glowFragment = /* glsl */ `
uniform float uTime;
varying float vAlpha;
void main() {
  vec2 uv = gl_PointCoord - 0.5;
  float d = length(uv) * 2.0;
  float core = exp(-d * d * 30.0) * 1.6;
  float halo = exp(-d * 4.5) * 0.45;
  vec2 q = abs(uv);
  float rays = (max(0.0, 1.0 - q.x * 40.0) * max(0.0, 1.0 - q.y * 2.1) +
                max(0.0, 1.0 - q.y * 40.0) * max(0.0, 1.0 - q.x * 2.1)) * 0.9;
  vec2 r = abs(vec2(uv.x + uv.y, uv.x - uv.y)) * 0.7071;
  rays += (max(0.0, 1.0 - r.x * 50.0) * max(0.0, 1.0 - r.y * 3.2) +
           max(0.0, 1.0 - r.y * 50.0) * max(0.0, 1.0 - r.x * 3.2)) * 0.45;
  float a = (core + halo + rays) * (1.0 - smoothstep(0.85, 1.0, d)) * vAlpha;
  gl_FragColor = vec4(vec3(1.0, 0.78, 0.42) * a * 1.1, 1.0);
}
`;

// 背景星尘
export const dustVertex = /* glsl */ `
uniform float uTime;
uniform float uScale;
attribute vec4 aDust;   // 尺寸, 随机, 速度, 色温
varying float vAlpha;
varying float vWarm;
void main() {
  vec3 p = position;
  p.y = mod(p.y + uTime * aDust.z + 40.0, 80.0) - 40.0;
  p.x += sin(uTime * 0.2 + aDust.y * 30.0) * 0.6;
  vec4 mv = modelViewMatrix * vec4(p, 1.0);
  gl_Position = projectionMatrix * mv;
  gl_PointSize = clamp(aDust.x * uScale / max(-mv.z, 0.1), 1.0, 6.0);
  vAlpha = (0.35 + 0.65 * pow(0.5 + 0.5 * sin(uTime * (0.6 + aDust.y * 2.5) + aDust.y * 90.0), 3.0)) * 0.55;
  vWarm = aDust.w;
}
`;

export const dustFragment = /* glsl */ `
varying float vAlpha;
varying float vWarm;
void main() {
  float d = length(gl_PointCoord - 0.5) * 2.0;
  if (d > 1.0) discard;
  float a = exp(-d * d * 5.0) * vAlpha;
  vec3 col = mix(vec3(0.8, 0.85, 1.0), vec3(1.0, 0.8, 0.5), vWarm);
  gl_FragColor = vec4(col * a, 1.0);
}
`;

// 最终调色：暗角、轻微色散、胶片颗粒（在色调映射之前，线性空间）
export const gradeShader = {
  uniforms: {
    tDiffuse: { value: null },
    uTime: { value: 0 },
    uRes: { value: null },
    uVignette: { value: 0.55 },
    uGrain: { value: 0.018 },
    uCA: { value: 0.012 },
    uFlash: { value: 0 },
  },
  vertexShader: /* glsl */ `
    varying vec2 vUv;
    void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }
  `,
  fragmentShader: /* glsl */ `
    uniform sampler2D tDiffuse;
    uniform float uTime;
    uniform vec2 uRes;
    uniform float uVignette;
    uniform float uGrain;
    uniform float uCA;
    uniform float uFlash;
    varying vec2 vUv;
    void main() {
      vec2 c = vUv - 0.5;
      float r2 = dot(c, c);
      vec2 off = c * uCA * (0.4 + r2 * 3.0);
      vec3 col;
      col.r = texture2D(tDiffuse, vUv + off).r;
      col.g = texture2D(tDiffuse, vUv).g;
      col.b = texture2D(tDiffuse, vUv - off).b;
      col *= vec3(1.04, 1.0, 0.94);
      col += vec3(1.0, 0.75, 0.4) * uFlash * 0.12 * (1.0 - r2 * 2.0);
      float vig = smoothstep(0.9, 0.2, sqrt(r2) * 1.3);
      col *= mix(1.0 - uVignette, 1.0, vig);
      float n = fract(sin(dot(vUv * uRes + fract(uTime) * 61.0, vec2(12.9898, 78.233))) * 43758.5453);
      col += (n - 0.5) * uGrain;
      gl_FragColor = vec4(max(col, 0.0), 1.0);
    }
  `,
};
