// 初雪 · First Snow — Three.js 实时雪景（模型由 Blender 脚本 blender/scripts/snow_assets.py 生成）
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';

const $ = (id) => document.getElementById(id);
const MOBILE = Math.min(innerWidth, innerHeight) < 700;
const REDUCED = matchMedia('(prefers-reduced-motion: reduce)').matches || location.search.includes('still');
const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
const smooth = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
const lerp = (a, b, t) => a + (b - a) * t;
let seed = 7;
const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);

/* ---------------- renderer / scene ---------------- */
const canvas = $('stage');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(devicePixelRatio, MOBILE ? 1.5 : 1.75));
renderer.setSize(innerWidth, innerHeight);
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;

const scene = new THREE.Scene();
scene.fog = new THREE.FogExp2(0x18233a, 0.02);
const camera = new THREE.PerspectiveCamera(50, innerWidth / innerHeight, 0.1, 700);
const CAM_HOME = new THREE.Vector3(0.6, 2.1, 12.5);
camera.position.set(0, 7, 30);

const controls = new OrbitControls(camera, canvas);
controls.target.set(0, 1.7, 0);
controls.enableDamping = true;
controls.dampingFactor = 0.06;
controls.rotateSpeed = 0.55;
controls.maxPolarAngle = 1.5;
controls.minDistance = 3;
controls.maxDistance = 34;
controls.enablePan = false;
controls.enabled = false;

const composer = new EffectComposer(renderer);
composer.addPass(new RenderPass(scene, camera));
const bloom = new UnrealBloomPass(new THREE.Vector2(innerWidth, innerHeight), 0.8, 0.55, 0.7);
composer.addPass(bloom);
composer.addPass(new OutputPass());

/* ---------------- state ---------------- */
const hour = new Date().getHours();
const S = {
  snow: 0.55,
  dayTarget: hour >= 7 && hour < 17 ? 1 : 0,
  day: 0,
  write: false,
  lampOn: true, windowOn: true, treeOn: true,
  lastInput: performance.now(),
};
S.day = S.dayTarget;

/* ---------------- environment palettes ---------------- */
const C = (h) => new THREE.Color(h);
const PAL = {
  day:   { top: C('#8394ab'), hor: C('#cdd5df'), hemiS: C('#e4ebf5'), hemiG: C('#c9d1dc'), hemi: 1.55, sun: C('#fff3e6'), sunI: 1.25, flake: 0.95, exp: 1.0 },
  night: { top: C('#03060f'), hor: C('#1a253d'), hemiS: C('#41527a'), hemiG: C('#1a2133'), hemi: 0.42, sun: C('#9cb4e8'), sunI: 0.38, flake: 0.2, exp: 1.12 },
};

/* ---------------- lights ---------------- */
const hemi = new THREE.HemisphereLight(0xffffff, 0xffffff, 1);
scene.add(hemi);
const sun = new THREE.DirectionalLight(0xffffff, 1);
sun.castShadow = true;
sun.shadow.mapSize.set(MOBILE ? 1024 : 2048, MOBILE ? 1024 : 2048);
Object.assign(sun.shadow.camera, { left: -30, right: 30, top: 30, bottom: -30, near: 1, far: 120 });
sun.shadow.bias = -0.0004;
sun.shadow.normalBias = 0.03;
sun.target.position.set(0, 0, -3);
scene.add(sun, sun.target);
const SUN_DIR = new THREE.Vector3(-0.55, 0.62, 0.42).normalize();

/* ---------------- sky ---------------- */
const skyU = {
  uTop: { value: new THREE.Color() }, uHor: { value: new THREE.Color() },
  uMoon: { value: new THREE.Vector3(-0.35, 0.42, -0.84).normalize() },
  uNight: { value: 0 }, uClear: { value: 1 }, uTime: { value: 0 },
};
const sky = new THREE.Mesh(
  new THREE.SphereGeometry(500, 32, 16),
  new THREE.ShaderMaterial({
    uniforms: skyU, side: THREE.BackSide, depthWrite: false, fog: false,
    vertexShader: `varying vec3 vDir; void main(){ vDir = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.); }`,
    fragmentShader: `
      uniform vec3 uTop, uHor, uMoon; uniform float uNight, uClear, uTime; varying vec3 vDir;
      float h21(vec2 p){ return fract(sin(dot(p, vec2(127.1,311.7)))*43758.5453); }
      void main(){
        vec3 d = normalize(vDir);
        vec3 col = mix(uHor, uTop, smoothstep(-0.02, 0.55, d.y));
        float m = dot(d, uMoon);
        float vis = uNight * uClear;
        col += vis * vec3(0.95,0.97,1.0) * (smoothstep(0.99955, 0.99975, m) * 1.6 + pow(max(m,0.0), 90.0) * 0.18 + pow(max(m,0.0), 12.0)*0.04);
        vec2 g = vec2(atan(d.z, d.x) * 160.0, d.y * 260.0);
        vec2 id = floor(g);
        float s = h21(id);
        float tw = 0.6 + 0.4 * sin(uTime * (1.0 + s * 3.0) + s * 40.0);
        float star = step(0.9965, s) * smoothstep(0.42, 0.05, length(fract(g) - 0.5)) * tw;
        col += vis * star * smoothstep(0.08, 0.35, d.y) * vec3(0.8, 0.86, 1.0) * 0.9;
        gl_FragColor = vec4(col, 1.0);
      }`,
  })
);
scene.add(sky);

/* ---------------- ground ---------------- */
function hfn(x, z) {
  const r = Math.hypot(x, z - 2);
  const k = smooth(27, 60, r);
  return k * (1.4 + Math.sin(x * 0.06) * 1.3 + Math.sin(z * 0.045 + 1.3) * 1.6 + Math.sin((x + z) * 0.12) * 0.5) - 0.02;
}

function makeSnowNormal(N = 256) {
  const H = new Float32Array(N * N);
  for (const [cells, amp] of [[4, 1], [8, 0.55], [16, 0.3], [32, 0.18], [64, 0.12], [128, 0.08]]) {
    const g = new Float32Array(cells * cells).map(() => rnd());
    for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
      const fx = x / N * cells, fy = y / N * cells, ix = Math.floor(fx), iy = Math.floor(fy);
      const tx = fx - ix, ty = fy - iy, sx = tx * tx * (3 - 2 * tx), sy = ty * ty * (3 - 2 * ty);
      const a = g[iy % cells * cells + ix % cells], b = g[iy % cells * cells + (ix + 1) % cells];
      const c = g[(iy + 1) % cells * cells + ix % cells], d = g[(iy + 1) % cells * cells + (ix + 1) % cells];
      H[y * N + x] += amp * lerp(lerp(a, b, sx), lerp(c, d, sx), sy);
    }
  }
  const cv = document.createElement('canvas'); cv.width = cv.height = N;
  const ctx = cv.getContext('2d'), img = ctx.createImageData(N, N);
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
    const dx = (H[y * N + (x + 1) % N] - H[y * N + (x - 1 + N) % N]) * 3.2;
    const dy = (H[((y + 1) % N) * N + x] - H[((y - 1 + N) % N) * N + x]) * 3.2;
    const l = Math.hypot(dx, dy, 1), i = (y * N + x) * 4;
    img.data[i] = (-dx / l * 0.5 + 0.5) * 255; img.data[i + 1] = (dy / l * 0.5 + 0.5) * 255; img.data[i + 2] = (1 / l * 0.5 + 0.5) * 255; img.data[i + 3] = 255;
  }
  ctx.putImageData(img, 0, 0);
  const t = new THREE.CanvasTexture(cv);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.anisotropy = 8;
  return t;
}
const snowN = makeSnowNormal();
const SNOW_COLOR = new THREE.Color('#eaf0f8');
const PATCH = 36, PZ = 2;

const bigGeo = new THREE.PlaneGeometry(420, 420, 180, 180).rotateX(-Math.PI / 2);
{
  const p = bigGeo.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), z = p.getZ(i);
    const inside = Math.abs(x) < PATCH / 2 - 2.6 && Math.abs(z - PZ) < PATCH / 2 - 2.6;
    p.setY(i, inside ? -0.5 : hfn(x, z));
  }
  bigGeo.computeVertexNormals();
}
const bigN = snowN.clone(); bigN.repeat.set(70, 70); bigN.needsUpdate = true;
const bigMat = new THREE.MeshStandardMaterial({ color: SNOW_COLOR, roughness: 0.93, normalMap: bigN, normalScale: new THREE.Vector2(0.35, 0.35) });
const bigGround = new THREE.Mesh(bigGeo, bigMat);
bigGround.receiveShadow = true;
scene.add(bigGround);

// the writable patch
const WN = 1024;
const wcv = document.createElement('canvas'); wcv.width = wcv.height = WN;
const wctx = wcv.getContext('2d', { willReadFrequently: false });
wctx.fillStyle = 'rgb(128,128,128)'; wctx.fillRect(0, 0, WN, WN);
const writeTex = new THREE.CanvasTexture(wcv);
writeTex.anisotropy = 8;
const patchN = snowN.clone(); patchN.repeat.set(70 * PATCH / 420, 70 * PATCH / 420); patchN.needsUpdate = true;
const patchMat = new THREE.MeshStandardMaterial({
  color: SNOW_COLOR, roughness: 0.93, normalMap: patchN, normalScale: new THREE.Vector2(0.35, 0.35),
  displacementMap: writeTex, displacementScale: 0.3, displacementBias: -0.15,
  bumpMap: writeTex, bumpScale: 6,
});
patchMat.onBeforeCompile = (sh) => {
  sh.fragmentShader = sh.fragmentShader.replace('#include <dithering_fragment>', `#include <dithering_fragment>
  #ifdef USE_BUMPMAP
    float gH = texture2D(bumpMap, vBumpMapUv).r;
    float gg = clamp((0.5 - gH) * 2.4, 0.0, 1.0);
    gl_FragColor.rgb *= mix(vec3(1.0), vec3(0.6, 0.7, 0.88), gg);
  #endif`);
};
const patch = new THREE.Mesh(new THREE.PlaneGeometry(PATCH, PATCH, MOBILE ? 256 : 384, MOBILE ? 256 : 384).rotateX(-Math.PI / 2), patchMat);
patch.position.set(0, 0, PZ);
patch.receiveShadow = true;
scene.add(patch);

/* ---------------- ground glitter ---------------- */
const GLN = MOBILE ? 5000 : 9000;
const glPos = new Float32Array(GLN * 3), glSeed = new Float32Array(GLN);
for (let i = 0; i < GLN; i++) {
  const a = rnd() * Math.PI * 2, r = Math.sqrt(rnd()) * 26;
  const x = Math.cos(a) * r, z = PZ + Math.sin(a) * r;
  glPos.set([x, Math.abs(x) < PATCH / 2 && Math.abs(z - PZ) < PATCH / 2 ? 0.015 : hfn(x, z) + 0.02, z], i * 3);
  glSeed[i] = rnd();
}
const glGeo = new THREE.BufferGeometry();
glGeo.setAttribute('position', new THREE.BufferAttribute(glPos, 3));
glGeo.setAttribute('aSeed', new THREE.BufferAttribute(glSeed, 1));
const glU = { uTime: { value: 0 }, uAmt: { value: 1 }, uPR: { value: renderer.getPixelRatio() }, uLampPos: { value: new THREE.Vector3() }, uLamp: { value: 1 }, uDay: { value: 1 } };
const glitter = new THREE.Points(glGeo, new THREE.ShaderMaterial({
  uniforms: glU, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
  vertexShader: `
    uniform float uTime, uAmt, uPR, uLamp, uDay; uniform vec3 uLampPos; attribute float aSeed; varying float vI;
    void main(){
      vec4 mv = modelViewMatrix * vec4(position, 1.0);
      vec3 toCam = normalize(cameraPosition - position);
      float h = fract(sin(dot(floor(toCam * 55.0) + aSeed * 91.0 + floor(uTime * (0.3 + aSeed)), vec3(12.9898, 78.233, 37.719))) * 43758.5453);
      float lampK = uLamp * smoothstep(9.0, 1.5, length(position.xz - uLampPos.xz));
      vI = pow(h, 26.0) * uAmt * (uDay * 1.6 + lampK * 2.2 + 0.25);
      gl_PointSize = uPR * clamp(26.0 / -mv.z, 1.2, 3.2);
      gl_Position = projectionMatrix * mv;
    }`,
  fragmentShader: `varying float vI; void main(){ float d = length(gl_PointCoord - 0.5); float a = smoothstep(0.5, 0.0, d); gl_FragColor = vec4(vec3(1.0, 0.98, 0.95) * vI * a, 1.0); }`,
}));
scene.add(glitter);

/* ---------------- placements ---------------- */
const P = {
  cabin: { x: 6.8, z: -8.5, ry: -0.42 },
  lamp: { x: 2.7, z: 3.4 },
  tree: { x: -4.4, z: -2.6 },
};
const LAMP_LIGHT_POS = new THREE.Vector3(P.lamp.x, 3.45, P.lamp.z);
glU.uLampPos.value.copy(LAMP_LIGHT_POS);

const lampLight = new THREE.PointLight(0xffb066, 20, 16, 2);
lampLight.position.copy(LAMP_LIGHT_POS);
lampLight.castShadow = false;
lampLight.shadow.mapSize.set(512, 512);
lampLight.shadow.bias = -0.002;
scene.add(lampLight);

const winLight = new THREE.PointLight(0xff9a4a, 10, 11, 2);
const treeLight = new THREE.PointLight(0xffcf8a, 4, 9, 2);
treeLight.position.set(P.tree.x, 2.2, P.tree.z + 0.4);
scene.add(winLight, treeLight);

// lamp halo cone
const halo = new THREE.Mesh(
  new THREE.ConeGeometry(2.4, 3.4, 48, 1, true).translate(0, -1.7, 0),
  new THREE.ShaderMaterial({
    uniforms: { uOp: { value: 0 }, uCol: { value: new THREE.Color('#ffb46a') } },
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
    vertexShader: `varying vec2 vUv; varying vec3 vN; varying vec3 vV;
      void main(){ vUv = uv; vec4 wp = modelMatrix * vec4(position,1.); vN = normalize(mat3(modelMatrix) * normal); vV = normalize(cameraPosition - wp.xyz); gl_Position = projectionMatrix * viewMatrix * wp; }`,
    fragmentShader: `uniform float uOp; uniform vec3 uCol; varying vec2 vUv; varying vec3 vN; varying vec3 vV;
      void main(){ float edge = pow(abs(dot(normalize(vN), normalize(vV))), 2.0); float h = pow(vUv.y, 1.6) * smoothstep(0.0, 0.25, vUv.y);
        gl_FragColor = vec4(uCol * uOp * edge * h, 1.0); }`,
  })
);
halo.position.set(P.lamp.x, 3.4, P.lamp.z);
scene.add(halo);

/* ---------------- tree lights, star, smoke, puff ---------------- */
const TL = 170;
const tlMesh = new THREE.InstancedMesh(new THREE.SphereGeometry(0.026, 10, 8), new THREE.MeshBasicMaterial(), TL);
const tlBase = [], tlPhase = [];
const TCOL = ['#ffcf8a', '#ff6b5a', '#ffd34d', '#7fc6ff', '#ffb0d0', '#ffe8c0'];
{
  const m = new THREE.Matrix4();
  for (let i = 0; i < TL; i++) {
    const t = i / TL;
    const y = 0.75 + t * 4.05;
    const rad = (1 - (y - 0.6) / 4.4) * 1.95 * 0.92 + 0.06;
    const a = t * Math.PI * 2 * 8.5 + rnd() * 0.5;
    m.makeTranslation(P.tree.x + Math.cos(a) * rad, y, P.tree.z + Math.sin(a) * rad);
    tlMesh.setMatrixAt(i, m);
    tlBase.push(new THREE.Color(TCOL[i % TCOL.length]));
    tlPhase.push([rnd() * 6.28, 0.6 + rnd() * 2.2]);
    tlMesh.setColorAt(i, tlBase[i]);
  }
}
scene.add(tlMesh);

function starShape() {
  const s = new THREE.Shape();
  for (let i = 0; i < 10; i++) {
    const r = i % 2 ? 0.11 : 0.26, a = i / 10 * Math.PI * 2 + Math.PI / 2;
    i ? s.lineTo(Math.cos(a) * r, Math.sin(a) * r) : s.moveTo(Math.cos(a) * r, Math.sin(a) * r);
  }
  return new THREE.ExtrudeGeometry(s, { depth: 0.06, bevelEnabled: true, bevelThickness: 0.02, bevelSize: 0.02, bevelSegments: 2 }).center();
}
const starMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(3.2, 2.3, 0.9) });
const star = new THREE.Mesh(starShape(), starMat);
star.position.set(P.tree.x, 5.1, P.tree.z);
scene.add(star);

// chimney smoke
function softSprite(size = 64) {
  const c = document.createElement('canvas'); c.width = c.height = size;
  const g = c.getContext('2d'), gr = g.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.45, 'rgba(255,255,255,0.45)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = gr; g.fillRect(0, 0, size, size);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}
const smokeTex = softSprite();
const smoke = [];
const smokeOrigin = new THREE.Vector3();
for (let i = 0; i < 46; i++) {
  const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: smokeTex, transparent: true, depthWrite: false, color: 0xbfc6d2 }));
  sp.userData = { age: i / 46 * 9, life: 9, rot: rnd() * 6, spin: (rnd() - 0.5) * 0.4 };
  smoke.push(sp); scene.add(sp);
}

// snow puff when the tree is shaken
const PUFFN = 700;
const puffGeo = new THREE.BufferGeometry();
const puffPos = new Float32Array(PUFFN * 3), puffVel = new Float32Array(PUFFN * 3);
puffGeo.setAttribute('position', new THREE.BufferAttribute(puffPos, 3));
const puffMat = new THREE.PointsMaterial({ size: 0.05, map: smokeTex, transparent: true, depthWrite: false, opacity: 0, color: 0xffffff });
const puff = new THREE.Points(puffGeo, puffMat);
puff.frustumCulled = false;
scene.add(puff);
let puffT = 99;
function shakeTree() {
  for (let i = 0; i < PUFFN; i++) {
    const y = 0.8 + rnd() * 4, rad = (1 - (y - 0.6) / 4.4) * 1.9 * (0.6 + rnd() * 0.45), a = rnd() * 6.28;
    puffPos.set([P.tree.x + Math.cos(a) * rad, y, P.tree.z + Math.sin(a) * rad], i * 3);
    puffVel.set([Math.cos(a) * (0.3 + rnd()), rnd() * 0.6, Math.sin(a) * (0.3 + rnd())], i * 3);
  }
  puffGeo.attributes.position.needsUpdate = true;
  puffT = 0;
}

/* ---------------- falling snow ----------------
   Every flake is a camera-facing quad stretched along its own screen-space motion (motion blur),
   widened by depth of field, and lit by the scene's real lights (lamp, window, tree, sky).
   Positions are analytic: fall and wind are integrated on the CPU, so speed changes never make flakes jump. */
const SNOW_VERT = /* glsl */`
  #define SPI 3.14159265
  uniform float uTime, uFall, uFallV, uExpo, uScale, uAper, uFocus, uSize, uTurb, uFlutter, uGain, uFog, uDriftAmt, uFadeBottom;
  uniform float uLampI, uWinI, uTreeI, uSunI;
  uniform vec2 uWind, uWindV, uRes;
  uniform vec3 uBox, uCenter, uCam, uAmb, uFogCol, uLampPos, uLampCol, uWinPos, uWinCol, uTreePos, uTreeCol, uSunCol;
  attribute vec4 aSeed;
  attribute vec4 aSeed2;
  varying vec2 vLoc;
  varying float vL, vR, vSoft, vA;
  varying vec3 vCol;

  float groundH(vec2 xz) {
    float r = length(vec2(xz.x, xz.y - 2.0));
    float k = smoothstep(27.0, 60.0, r);
    return k * (1.4 + sin(xz.x * 0.06) * 1.3 + sin(xz.y * 0.045 + 1.3) * 1.6 + sin((xz.x + xz.y) * 0.12) * 0.5) - 0.02;
  }
  // smooth, spatially coherent eddies (neighbouring flakes move together)
  vec3 turb(vec3 q, float t) {
    return vec3(
      sin(dot(q, vec3(0.31, 0.47, 0.19)) + t * 0.37) + 0.6 * sin(dot(q, vec3(-0.73, 0.29, 0.61)) + t * 0.61 + 1.3) + 0.35 * sin(dot(q, vec3(1.3, -0.9, 0.4)) + t * 1.1),
      0.45 * sin(dot(q, vec3(0.37, -0.21, 0.52)) + t * 0.53 + 4.0) + 0.3 * sin(dot(q, vec3(-0.9, 0.7, -0.6)) + t * 1.3),
      sin(dot(q, vec3(-0.41, 0.33, 0.27)) + t * 0.43 + 2.1) + 0.6 * sin(dot(q, vec3(0.57, -0.61, 0.83)) + t * 0.71 + 0.4) + 0.35 * sin(dot(q, vec3(-1.1, 0.8, 1.2)) + t * 0.97 + 2.0));
  }
  vec3 flakePos(float fall, vec2 wind, float t) {
  #ifdef DRIFT
    float h = aSeed.z;
    float k = 0.55 + 0.45 * h + 0.15 * aSeed2.y;
    vec3 p = vec3(aSeed.x + wind.x * k, 0.0, aSeed.y + wind.y * k);
    p.xz = uCenter.xz + mod(p.xz - uCenter.xz + uBox.xz * 0.5, uBox.xz) - uBox.xz * 0.5;
    float hop = abs(sin(t * (3.0 + 5.0 * aSeed2.z) + aSeed2.w * 40.0));
    float g = groundH(p.xz);
    p.y = g + 0.015 + h * h * h * 1.5 * uDriftAmt + hop * 0.05 * (1.0 - h);
    p += turb(vec3(p.x - wind.x, p.y * 2.0, p.z - wind.y) * 1.4, t * 1.8) * vec3(0.3, 0.08, 0.3);
    p.y = max(p.y, g + 0.01);
    return p;
  #else
    float vk = 0.65 + 0.7 * aSeed2.x;
    float wk = 0.88 + 0.24 * aSeed2.y;
    vec3 p = vec3(aSeed.x + wind.x * wk, aSeed.z - fall * vk, aSeed.y + wind.y * wk);
    p = uCenter + mod(p - uCenter + uBox * 0.5, uBox) - uBox * 0.5;
    p += turb(vec3(p.x - wind.x, p.y, p.z - wind.y) * 0.8, t) * uTurb;
    float z = aSeed2.z;
    float w = 3.0 + 6.0 * z;
    float ph = aSeed2.w * 60.0;
    float A = uFlutter * (0.1 + 1.2 * pow(fract(z * 13.7), 2.0));
    float spiral = step(0.72, aSeed2.w);
    p.x += A * (sin(w * t + ph) + 0.35 * sin(2.3 * w * t + ph * 1.7));
    p.z += A * (mix(sin(0.83 * w * t + ph * 2.1), cos(w * t + ph), spiral) + 0.35 * sin(1.7 * w * t + ph * 0.6));
    return p;
  #endif
  }
  // point light on a small ice aggregate: inverse square + forward-scattering phase (Henyey-Greenstein, g = 0.45)
  vec3 pointL(vec3 p, vec3 V, vec3 lp, vec3 lc, float I, float range) {
    vec3 L = p - lp;
    float d2 = max(dot(L, L), 0.09);
    float d = sqrt(d2);
    float cut = clamp(1.0 - pow(d / range, 4.0), 0.0, 1.0);
    float hg = 0.7975 / pow(1.2025 - 0.9 * dot(L / d, V), 1.5);
    return lc * (I / d2 * cut * cut * (0.5 + 0.5 * hg) * 0.92 / SPI);
  }
  void main() {
    float t = uTime;
    vec3 p1 = flakePos(uFall, uWind, t);
    float dist = length(p1 - uCam);
    float vis = smoothstep(0.25, 0.7, dist);
  #ifdef DRIFT
    vec2 e2 = abs(p1.xz - uCenter.xz) / (uBox.xz * 0.5);
    vis *= (1.0 - smoothstep(0.7, 1.0, max(e2.x, e2.y))) * uDriftAmt * (1.0 - 0.5 * aSeed.z);
  #else
    float gy = groundH(p1.xz);
    vis *= smoothstep(gy - 0.01, gy + 0.1, p1.y);
    vec3 e = (p1 - uCenter) / (uBox * 0.5);
    vis *= 1.0 - smoothstep(0.78, 1.0, max(abs(e.x), abs(e.z)));
    vis *= 1.0 - smoothstep(0.8, 1.0, e.y);
    vis *= 1.0 - uFadeBottom * smoothstep(0.8, 1.0, -e.y);
  #endif
    float fogT = exp(-uFog * uFog * dist * dist);
    vec4 c1 = projectionMatrix * viewMatrix * vec4(p1, 1.0);
    if (vis < 0.003 || fogT < 0.02 || c1.w < 0.2) { gl_Position = vec4(2.0, 2.0, 2.0, 1.0); return; }

    // where the flake was when the "shutter" opened -> streak
    vec3 p0 = flakePos(uFall - uFallV * uExpo, uWind - uWindV * uExpo, t - uExpo);
    if (distance(p0, p1) > 1.5) p0 = p1;
    vec4 c0 = projectionMatrix * viewMatrix * vec4(p0, 1.0);
    if (c0.w < 0.2) c0 = c1;
    vec2 hr = uRes * 0.5;
    vec2 s1 = c1.xy / c1.w * hr;
    vec2 s0 = c0.xy / c0.w * hr;

    float diam = uSize * (0.45 + 1.1 * aSeed.w * aSeed.w);
  #ifdef DRIFT
    diam *= 0.5;
  #endif
    float sharp = 0.5 * diam * uScale / c1.w;
    float coc = uAper * abs(1.0 / c1.w - 1.0 / uFocus);
    float rad = sqrt(sharp * sharp + coc * coc);
    float rd = max(rad, 0.75);
    vec2 dv = s1 - s0;
    float len = length(dv);
    if (len > 180.0) { s0 = s1 - dv * (180.0 / len); len = 180.0; }
    vec2 ax = len > 0.01 ? (s1 - s0) / len : vec2(0.0, 1.0);
    vec2 pr = vec2(ax.y, -ax.x);
    float hl = len * 0.5 + rd + 1.0;
    float hw = rd + 1.0;
    vec2 sp = (s0 + s1) * 0.5 + ax * (position.y * hl) + pr * (position.x * hw);
    vLoc = vec2(position.x * hw, position.y * hl);
    vL = len * 0.5;
    vR = rd;
    vSoft = clamp(coc / max(rad, 1e-4), 0.0, 1.0);
    // the flake's light is spread over its blurred footprint (energy conserving)
    float energy = (SPI * sharp * sharp) / (SPI * rd * rd + 2.0 * rd * len);
    vA = clamp(energy * uGain, 0.0, 0.92) * vis;

    vec3 V = normalize(uCam - p1);
    float lampMask = mix(0.15, 1.0, smoothstep(uLampPos.y + 0.55, uLampPos.y + 0.05, p1.y));
    vec3 lamp = pointL(p1, V, uLampPos, uLampCol, uLampI, 16.0) * lampMask;
    vec3 win = pointL(p1, V, uWinPos, uWinCol, uWinI, 11.0);
    vec3 tree = pointL(p1, V, uTreePos, uTreeCol, uTreeI, 9.0);
    // tumbling ice facets occasionally flash in direct light
    float tw = sin(t * (1.5 + 4.5 * aSeed2.z) + aSeed2.w * 31.0);
    float glint = pow(max(tw, 0.0), 36.0) * step(0.4, fract(aSeed2.y * 7.31));
    vec3 col = uAmb * (0.9 + 0.2 * aSeed2.x) + lamp * (1.0 + 5.0 * glint) + (win + tree) * (1.0 + 3.0 * glint) + uSunCol * (uSunI * 0.07 * glint);
    vCol = mix(col, uFogCol, 1.0 - fogT);
    gl_Position = vec4(sp / hr * c1.w, c1.z, c1.w);
  }`;
const SNOW_FRAG = /* glsl */`
  varying vec2 vLoc;
  varying float vL, vR, vSoft, vA;
  varying vec3 vCol;
  void main() {
    float d = length(vec2(vLoc.x, max(abs(vLoc.y) - vL, 0.0)));
    float w = mix(1.0, 0.95 * vR, vSoft);
    float a = (1.0 - smoothstep(vR - w, vR + 0.5 * (1.0 - vSoft) + 0.2 * vR * vSoft, d)) * vA;
    if (a < 0.003) discard;
    gl_FragColor = vec4(vCol, a);
  }`;

const SNOW_SHARED = {
  uTime: { value: 0 }, uFall: { value: 0 }, uFallV: { value: 1 }, uExpo: { value: 1 / 55 },
  uWind: { value: new THREE.Vector2() }, uWindV: { value: new THREE.Vector2() },
  uScale: { value: 600 }, uAper: { value: 6 }, uFocus: { value: 12 }, uRes: { value: new THREE.Vector2(1, 1) },
  uSize: { value: 0.012 }, uTurb: { value: 0.4 }, uFlutter: { value: 0.04 }, uGain: { value: 4.0 }, uFog: { value: 0.02 },
  uDriftAmt: { value: 0 }, uCam: { value: new THREE.Vector3() }, uAmb: { value: new THREE.Color() }, uFogCol: { value: new THREE.Color() },
  uLampPos: { value: lampLight.position }, uLampCol: { value: new THREE.Color() }, uLampI: { value: 0 },
  uWinPos: { value: winLight.position }, uWinCol: { value: new THREE.Color() }, uWinI: { value: 0 },
  uTreePos: { value: treeLight.position }, uTreeCol: { value: treeLight.color }, uTreeI: { value: 0 },
  uSunCol: { value: new THREE.Color() }, uSunI: { value: 0 },
};
function makeSnowLayer(max, box, opts = {}) {
  const g = new THREE.InstancedBufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(new Float32Array([-1, -1, 0, 1, -1, 0, 1, 1, 0, -1, 1, 0]), 3));
  g.setIndex([0, 1, 2, 0, 2, 3]);
  const a = new Float32Array(max * 4), b = new Float32Array(max * 4);
  for (let i = 0; i < max; i++) {
    a.set([rnd() * box.x, rnd() * box.z, opts.drift ? rnd() : rnd() * box.y, rnd()], i * 4);
    b.set([rnd(), rnd(), rnd(), rnd()], i * 4);
  }
  g.setAttribute('aSeed', new THREE.InstancedBufferAttribute(a, 4));
  g.setAttribute('aSeed2', new THREE.InstancedBufferAttribute(b, 4));
  g.instanceCount = 0;
  const m = new THREE.ShaderMaterial({
    uniforms: { ...SNOW_SHARED, uBox: { value: box }, uCenter: { value: new THREE.Vector3() }, uFadeBottom: { value: opts.fadeBottom ? 1 : 0 } },
    defines: opts.drift ? { DRIFT: 1 } : {},
    vertexShader: SNOW_VERT, fragmentShader: SNOW_FRAG, transparent: true, depthWrite: false, side: THREE.DoubleSide,
  });
  const mesh = new THREE.Mesh(g, m);
  mesh.frustumCulled = false;
  mesh.renderOrder = 10;
  mesh.userData.max = max;
  scene.add(mesh);
  return mesh;
}
const snowNear = makeSnowLayer(MOBILE ? 22000 : 50000, new THREE.Vector3(22, 14, 22), { fadeBottom: true });
const snowFar = makeSnowLayer(MOBILE ? 28000 : 70000, new THREE.Vector3(64, 26, 64));
const snowDrift = makeSnowLayer(MOBILE ? 9000 : 22000, new THREE.Vector3(30, 1, 30), { drift: true });

let fallOff = 0, fallV = 1;
const _up = new THREE.Color(), _gr = new THREE.Color(), _sn = new THREE.Color(), _fw = new THREE.Vector3(), _white = new THREE.Color(1, 1, 1);
function updateSnow(dt, t) {
  const s = S.snow, U = SNOW_SHARED;
  fallV = lerp(fallV, 0.85 + 0.35 * s, 1 - Math.exp(-dt * 0.8));
  fallOff += fallV * dt;
  U.uTime.value = t;
  U.uFall.value = fallOff;
  U.uFallV.value = fallV;
  U.uWind.value.copy(wind.off);
  U.uWindV.value.set(Math.cos(wind.dir), Math.sin(wind.dir)).multiplyScalar(wind.speed);
  U.uSize.value = lerp(0.009, 0.02, smooth(0.1, 0.75, s)) * (1 - 0.3 * smooth(0.85, 1, s));
  U.uTurb.value = 0.25 + 0.12 * wind.speed;
  U.uFlutter.value = 0.045 * (1 - 0.5 * s);
  U.uFog.value = scene.fog.density;
  U.uFogCol.value.copy(scene.fog.color);
  U.uCam.value.copy(camera.position);
  U.uFocus.value = Math.max(2, camera.position.distanceTo(controls.target));
  // a bright lamp over-exposes white flakes toward white, so the flakes see a less saturated colour than the ground
  U.uLampCol.value.copy(lampLight.color).lerp(_white, 0.4);
  U.uWinCol.value.copy(winLight.color).lerp(_white, 0.3);
  U.uLampI.value = lampLight.intensity;
  U.uWinI.value = winLight.intensity;
  U.uTreeI.value = treeLight.intensity;
  U.uSunCol.value.copy(sun.color);
  U.uSunI.value = sun.intensity;
  // a flake scatters roughly the average light around it: sky above, lit snow below, a little direct sun/moon
  _up.copy(skyU.uHor.value).lerp(skyU.uTop.value, 0.45);
  _gr.copy(hemi.color).multiplyScalar(hemi.intensity * 0.86 / Math.PI)
    .add(_sn.copy(sun.color).multiplyScalar(sun.intensity * 0.6 * 0.86 / Math.PI));
  U.uAmb.value.copy(_up).add(_gr).multiplyScalar(0.52)
    .add(_sn.copy(sun.color).multiplyScalar(sun.intensity * 0.92 * 0.35 / Math.PI));
  const c = camera.position;
  camera.getWorldDirection(_fw); _fw.y = 0; _fw.normalize();
  snowNear.material.uniforms.uCenter.value.set(c.x + _fw.x * 6, c.y + 1, c.z + _fw.z * 6);
  snowFar.material.uniforms.uCenter.value.set(c.x, 13, c.z);
  snowDrift.material.uniforms.uCenter.value.set(c.x, 0, c.z);
  snowNear.geometry.instanceCount = Math.floor(snowNear.userData.max * Math.pow(s, 1.1));
  snowFar.geometry.instanceCount = Math.floor(snowFar.userData.max * Math.pow(s, 1.25));
  snowNear.visible = snowNear.geometry.instanceCount > 0;
  snowFar.visible = snowFar.geometry.instanceCount > 0;
  const drift = smooth(2.5, 7, wind.speed);
  U.uDriftAmt.value = drift;
  snowDrift.geometry.instanceCount = Math.floor(snowDrift.userData.max * drift);
  snowDrift.visible = snowDrift.geometry.instanceCount > 0;
}

/* ---------------- load Blender models ---------------- */
const glow = { window: [], lamp: [] };
const clickables = { tree: null, lamp: null, cabin: null };
let cabinObj = null;
const bar = $('bar');

const MODEL_URLS = ['./assets/snow_assets.glb', './assets/snow_assets.gltf.json'];
function loadModels(i = 0) {
  new GLTFLoader().load(MODEL_URLS[i], onModels, (e) => { if (e.total) bar.style.width = (e.loaded / e.total * 100).toFixed(0) + '%'; },
    (err) => {
      if (i + 1 < MODEL_URLS.length) return loadModels(i + 1);
      console.error(err); $('loader').firstElementChild.textContent = '模型加载失败，请刷新重试';
    });
}
loadModels();
function onModels(gltf) {
  const get = (n) => gltf.scene.getObjectByName(n);
  gltf.scene.traverse((o) => {
    if (!o.isMesh) return;
    o.castShadow = o.receiveShadow = true;
    const m = o.material;
    if (m.name === 'Snow') { m.color.copy(SNOW_COLOR).multiplyScalar(0.98); m.roughness = 0.9; m.normalMap = bigN; m.normalScale.set(0.25, 0.25); }
    if (m.name === 'WindowGlow') { glow.window.push(m); o.castShadow = false; }
    if (m.name === 'LampGlow') { glow.lamp.push(m); o.castShadow = false; }
    if (m.name === 'Foliage') { m.roughness = 0.9; }
  });

  const place = (name, x, z, ry = 0, s = 1) => {
    const o = get(name).clone(true);
    o.position.set(x, 0, z); o.rotation.y = ry; o.scale.setScalar(s);
    scene.add(o); return o;
  };
  cabinObj = place('cabin', P.cabin.x, P.cabin.z, P.cabin.ry);
  clickables.cabin = cabinObj;
  cabinObj.updateMatrixWorld(true);
  cabinObj.localToWorld(winLight.position.set(0, 1.5, 3.4));
  cabinObj.localToWorld(smokeOrigin.set(1.9, 6.0, -0.9));
  clickables.lamp = place('lamp', P.lamp.x, P.lamp.z, 0.3);
  clickables.tree = place('xmas_tree', P.tree.x, P.tree.z, 0.4);
  [[-11, -7.4, 0.05], [-8.4, -7.2, 0.1], [-5.8, -6.9, 0.12], [-0.4, -6.4, 0.16], [2.2, -6.0, 0.2]].forEach(([x, z, r]) => place('fence', x, z, r));

  // forest via instancing
  const kinds = ['pine_a', 'pine_b', 'pine_c'].map(get);
  const lists = [[], [], []];
  const N = MOBILE ? 110 : 190;
  const far = (x, z, px, pz, d) => Math.hypot(x - px, z - pz) > d;
  for (let tries = 0; lists.flat().length < N && tries < 6000; tries++) {
    const a = rnd() * Math.PI * 2, r = 9 + Math.pow(rnd(), 1.6) * 85;
    const x = Math.cos(a) * r, z = Math.sin(a) * r;
    if (!far(x, z, P.cabin.x, P.cabin.z, 7) || !far(x, z, P.tree.x, P.tree.z, 4.5) || !far(x, z, P.lamp.x, P.lamp.z, 3)) continue;
    if (z > -7 && z < 18 && Math.abs(x) < 10) continue;
    const s = 0.75 + rnd() * 0.65;
    const m = new THREE.Matrix4().compose(new THREE.Vector3(x, hfn(x, z) - 0.05, z),
      new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), rnd() * 6.28), new THREE.Vector3(s, s * (0.9 + rnd() * 0.25), s));
    lists[Math.floor(rnd() * 3)].push(m);
  }
  kinds.forEach((obj, k) => {
    obj.updateMatrixWorld(true);
    obj.traverse((mesh) => {
      if (!mesh.isMesh) return;
      const im = new THREE.InstancedMesh(mesh.geometry, mesh.material, lists[k].length);
      lists[k].forEach((m, i) => im.setMatrixAt(i, new THREE.Matrix4().multiplyMatrices(m, mesh.matrixWorld)));
      im.castShadow = im.receiveShadow = true;
      scene.add(im);
    });
  });
  start();
}

/* ---------------- writing in the snow ---------------- */
const toPx = (x, z) => [((x) / PATCH + 0.5) * WN, ((z - PZ) / PATCH + 0.5) * WN];
let texDirty = false;
function dent(px, py, rad, depth = 28) {
  const g = wctx.createRadialGradient(px, py, 0, px, py, rad);
  g.addColorStop(0, `rgb(${depth},${depth},${depth})`);
  g.addColorStop(0.55, `rgb(${depth + 30},${depth + 30},${depth + 30})`);
  g.addColorStop(1, 'rgb(128,128,128)');
  wctx.globalCompositeOperation = 'darken';
  wctx.fillStyle = g;
  wctx.beginPath(); wctx.arc(px, py, rad, 0, Math.PI * 2); wctx.fill();
  wctx.globalCompositeOperation = 'source-over';
  texDirty = true;
}
let lastPt = null;
function strokeTo(px, py) {
  const R = 0.13 / PATCH * WN;
  if (!lastPt) { dent(px, py, R); lastPt = [px, py]; return; }
  const d = Math.hypot(px - lastPt[0], py - lastPt[1]);
  const n = Math.max(1, Math.ceil(d / (R * 0.3)));
  for (let i = 1; i <= n; i++) dent(lerp(lastPt[0], px, i / n), lerp(lastPt[1], py, i / n), R);
  if (d > 6) audio.crunch(0.5);
  lastPt = [px, py];
}

let refillAcc = 0;
function refill(dt) {
  const T = 75 / (Math.pow(S.snow, 1.2) + 0.015);
  refillAcc += dt;
  const step = T / 50;
  if (refillAcc > step) {
    refillAcc = 0;
    wctx.fillStyle = 'rgba(128,128,128,0.06)';
    wctx.fillRect(0, 0, WN, WN);
    texDirty = true;
  }
}

let carving = null;
function carve(text) {
  text = text.trim();
  if (!text) { toast('先在输入框里写一句话'); $('words').focus(); return; }
  const f = new THREE.Vector3(); camera.getWorldDirection(f); f.y = 0; f.normalize();
  const dist = clamp(controls.getDistance() * 0.55, 5, 10);
  let x = camera.position.x + f.x * dist, z = camera.position.z + f.z * dist;
  x = clamp(x, -PATCH / 2 + 4, PATCH / 2 - 4); z = clamp(z, PZ - PATCH / 2 + 4, PZ + PATCH / 2 - 4);
  const tmp = document.createElement('canvas'), tg = tmp.getContext('2d');
  let fs = 46;
  const font = (s) => `600 ${s}px "Noto Serif SC", "Songti SC", serif`;
  tg.font = font(fs);
  const maxW = 9 / PATCH * WN;
  const w0 = tg.measureText(text).width;
  if (w0 > maxW) fs = Math.max(20, fs * maxW / w0);
  tg.font = font(fs);
  const w = Math.ceil(tg.measureText(text).width) + 20, h = Math.ceil(fs * 1.5);
  tmp.width = w; tmp.height = h;
  tg.font = font(fs); tg.textAlign = 'center'; tg.textBaseline = 'middle';
  tg.fillStyle = 'rgb(128,128,128)'; tg.fillRect(0, 0, w, h);
  tg.shadowColor = 'rgb(40,40,40)'; tg.shadowBlur = 3;
  tg.fillStyle = 'rgb(26,26,26)'; tg.fillText(text, w / 2, h / 2);
  const [px, py] = toPx(x, z);
  carving = { tmp, w, h, px, py, th: Math.atan2(f.x, -f.z), done: 0, t: 0, dur: 0.5 + text.length * 0.22 };
  toast('正在把「' + text + '」刻进雪里…');
}
function stepCarve(dt) {
  if (!carving) return;
  const c = carving;
  c.t += dt;
  const to = Math.min(c.w, Math.ceil(c.w * c.t / c.dur));
  if (to > c.done) {
    wctx.save();
    wctx.globalCompositeOperation = 'darken';
    wctx.translate(c.px, c.py); wctx.rotate(c.th);
    wctx.drawImage(c.tmp, c.done, 0, to - c.done, c.h, -c.w / 2 + c.done, -c.h / 2, to - c.done, c.h);
    wctx.restore();
    texDirty = true;
    if (Math.random() < 0.5) audio.crunch(0.35);
    c.done = to;
  }
  if (c.done >= c.w) carving = null;
}

let smoothing = 0;
function smoothAll() { smoothing = 1.2; toast('雪地抹平了'); }

// critters crossing the patch
let critter = null, critterNext = 25 + Math.random() * 25;
const CRITTERS = [
  { name: '一只小狐狸', step: 0.34, side: 0.07, kind: 'fox' },
  { name: '一只麻雀', step: 0.12, side: 0.035, kind: 'bird' },
  { name: '一只雪兔', step: 0.5, side: 0.06, kind: 'hare' },
];
function startCritter() {
  const c = CRITTERS[Math.floor(Math.random() * CRITTERS.length)];
  const dir = Math.random() < 0.5 ? 1 : -1;
  const z0 = PZ + (Math.random() * 2 - 0.6) * 5;
  critter = { ...c, dir, x: -dir * (PATCH / 2 - 0.5), z0, n: 0, acc: 0, phase: Math.random() * 6 };
  setTimeout(() => toast(c.name + '刚刚从雪地上走过'), 2500);
}
function paw(x, z, ang, kind) {
  const [px, py] = toPx(x, z), k = WN / PATCH;
  const ca = Math.cos(ang), sa = Math.sin(ang);
  const at = (fx, fy) => [px + (fx * ca - fy * sa) * k, py + (fx * sa + fy * ca) * k];
  if (kind === 'bird') {
    for (const [fx, fy] of [[0.05, -0.025], [0.05, 0.025], [0.06, 0], [-0.03, 0]]) {
      const [ax, ay] = at(fx * 0.5, fy * 0.5); const [bx, by] = at(fx, fy);
      for (let t = 0; t <= 1; t += 0.25) dent(lerp(ax, bx, t), lerp(ay, by, t), 0.012 * k, 60);
    }
    return;
  }
  const s = kind === 'hare' ? 1.25 : 1;
  const [cx, cy] = at(0, 0); dent(cx, cy, 0.035 * k * s, 40);
  for (const [fx, fy] of [[0.05, -0.022], [0.055, 0.022], [0.035, -0.04], [0.035, 0.04]]) {
    const [tx, ty] = at(fx * s, fy * s); dent(tx, ty, 0.014 * k * s, 50);
  }
}
function stepCritter(dt) {
  if (!critter) {
    critterNext -= dt;
    if (critterNext < 0) { startCritter(); critterNext = 45 + Math.random() * 40; }
    return;
  }
  const c = critter;
  c.acc += dt;
  const every = c.kind === 'bird' ? 0.22 : 0.3;
  while (c.acc > every) {
    c.acc -= every;
    c.x += c.dir * c.step;
    const z = c.z0 + Math.sin(c.x * 0.28 + c.phase) * 1.6;
    const dz = Math.cos(c.x * 0.28 + c.phase) * 1.6 * 0.28;
    const ang = Math.atan2(dz * c.dir, c.dir);
    const off = (c.n % 2 ? 1 : -1) * c.side;
    if (c.kind === 'hare') {
      paw(c.x, z - 0.06, ang, 'hare'); paw(c.x + c.dir * 0.08, z + 0.06, ang, 'hare');
    } else paw(c.x - Math.sin(ang) * off, z + Math.cos(ang) * off, ang, c.kind);
    c.n++;
    if (Math.abs(c.x) > PATCH / 2 - 0.5) { critter = null; break; }
  }
}

/* ---------------- wind ---------------- */
const wind = { dir: Math.random() * 6.28, gust: 0, gustT: 0, next: 3, off: new THREE.Vector2(), speed: 0 };
function stepWind(dt) {
  wind.next -= dt;
  if (wind.next < 0) { wind.gustT = Math.pow(Math.random(), 2) * (0.3 + 3.0 * S.snow * S.snow); wind.next = 3 + Math.random() * 7; }
  wind.gust = lerp(wind.gust, wind.gustT, 1 - Math.exp(-dt * 0.7));
  wind.dir += (Math.random() - 0.5) * dt * 0.15;
  wind.speed = 0.2 + 1.2 * S.snow * S.snow + 7.5 * Math.pow(smooth(0.8, 1, S.snow), 1.5) + wind.gust;
  wind.off.x += Math.cos(wind.dir) * wind.speed * dt;
  wind.off.y += Math.sin(wind.dir) * wind.speed * dt;
}

/* ---------------- audio (synthesised, no files) ---------------- */
const audio = {
  ctx: null, on: false, master: null, bp: null, gain: null, crunchBuf: null,
  init() {
    const ctx = this.ctx = new (window.AudioContext || window.webkitAudioContext)();
    this.master = ctx.createGain(); this.master.gain.value = 0; this.master.connect(ctx.destination);
    const len = ctx.sampleRate * 4, buf = ctx.createBuffer(1, len, ctx.sampleRate), d = buf.getChannelData(0);
    let last = 0;
    for (let i = 0; i < len; i++) { last = (last + 0.02 * (Math.random() * 2 - 1)) / 1.02; d[i] = last * 3.2; }
    const src = ctx.createBufferSource(); src.buffer = buf; src.loop = true;
    this.bp = ctx.createBiquadFilter(); this.bp.type = 'bandpass'; this.bp.frequency.value = 500; this.bp.Q.value = 0.55;
    this.gain = ctx.createGain(); this.gain.gain.value = 0.2;
    src.connect(this.bp).connect(this.gain).connect(this.master); src.start();
    const cl = Math.floor(ctx.sampleRate * 0.09); this.crunchBuf = ctx.createBuffer(1, cl, ctx.sampleRate);
    const cd = this.crunchBuf.getChannelData(0);
    for (let i = 0; i < cl; i++) cd[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / cl, 2.5) * (Math.random() < 0.3 ? 1 : 0.35);
  },
  toggle() {
    if (!this.ctx) this.init();
    this.on = !this.on;
    this.ctx.resume();
    this.master.gain.setTargetAtTime(this.on ? 0.9 : 0, this.ctx.currentTime, 0.4);
    return this.on;
  },
  update(speed) {
    if (!this.on) return;
    const t = this.ctx.currentTime;
    this.bp.frequency.setTargetAtTime(260 + speed * 210, t, 0.3);
    this.gain.gain.setTargetAtTime(0.1 + Math.min(speed, 5) * 0.11, t, 0.3);
  },
  crunch(v = 0.5) {
    if (!this.on) return;
    const c = this.ctx, s = c.createBufferSource(), hp = c.createBiquadFilter(), g = c.createGain();
    s.buffer = this.crunchBuf; s.playbackRate.value = 0.7 + Math.random() * 0.7;
    hp.type = 'highpass'; hp.frequency.value = 900 + Math.random() * 900; g.gain.value = v * (0.5 + Math.random() * 0.5);
    s.connect(hp).connect(g).connect(this.master); s.start();
  },
  chime() {
    if (!this.on) return;
    const c = this.ctx, notes = [523.25, 587.33, 659.25, 783.99, 880, 1046.5];
    notes.sort(() => Math.random() - 0.5).slice(0, 3).forEach((f, k) => {
      [1, 2.76, 5.4].forEach((p, j) => {
        const o = c.createOscillator(), g = c.createGain(), t0 = c.currentTime + k * 0.12;
        o.frequency.value = f * p; g.gain.setValueAtTime(0, t0);
        g.gain.linearRampToValueAtTime(0.09 / (j + 1), t0 + 0.005);
        g.gain.exponentialRampToValueAtTime(0.0001, t0 + 2.2 / (j + 1));
        o.connect(g).connect(this.master); o.start(t0); o.stop(t0 + 2.4);
      });
    });
  },
};

/* ---------------- UI ---------------- */
let toastT;
function toast(msg, ms = 3200) {
  const el = $('toast'); el.textContent = msg; el.classList.add('show');
  clearTimeout(toastT); toastT = setTimeout(() => el.classList.remove('show'), ms);
}
const AMT = [[0, '停雪'], [0.12, '小雪'], [0.4, '中雪'], [0.68, '大雪'], [0.88, '暴雪']];
function setAmount(v) {
  S.snow = v;
  let n = AMT[0][1]; for (const [k, name] of AMT) if (v >= k) n = name;
  $('amtName').textContent = n;
}
$('amount').addEventListener('input', (e) => { setAmount(e.target.value / 100); poke(); });
setAmount(0.55);

function setDay(d) {
  S.dayTarget = d;
  $('dayBtn').classList.toggle('on', d === 1); $('dayBtn').setAttribute('aria-pressed', d === 1);
  $('nightBtn').classList.toggle('on', d === 0); $('nightBtn').setAttribute('aria-pressed', d === 0);
}
$('dayBtn').onclick = () => { setDay(1); poke(); };
$('nightBtn').onclick = () => { setDay(0); poke(); };
setDay(S.dayTarget);

function setWrite(on) {
  S.write = on;
  document.body.classList.toggle('writing', on);
  $('writeBtn').classList.toggle('on', on); $('writeBtn').setAttribute('aria-pressed', on);
  controls.enabled = !on && introDone;
  if (on) toast('在雪地上按住拖动就能写字，再点一次按钮回到观景');
}
$('writeBtn').onclick = () => setWrite(!S.write);
$('carveBtn').onclick = () => carve($('words').value);
$('words').addEventListener('keydown', (e) => { if (e.key === 'Enter') carve(e.target.value); });
$('smoothBtn').onclick = smoothAll;
$('soundBtn').onclick = () => {
  try { const on = audio.toggle(); $('soundBtn').classList.toggle('on', on); $('soundBtn').setAttribute('aria-pressed', on); toast(on ? '风声打开了' : '静音'); }
  catch (e) { toast('这个浏览器不支持声音'); }
};
$('shotBtn').onclick = () => {
  $('title').style.opacity = 0;
  composer.render();
  const url = renderer.domElement.toDataURL('image/png');
  $('shotImg').src = url; $('shotDl').href = url;
  $('shot').classList.add('show'); $('shot').setAttribute('aria-hidden', 'false');
};
$('shotClose').onclick = () => { $('shot').classList.remove('show'); $('shot').setAttribute('aria-hidden', 'true'); $('title').style.opacity = 1; };

/* ---------------- pointer: write or click objects ---------------- */
const ray = new THREE.Raycaster();
const ndc = new THREE.Vector2();
let down = null, drawing = false;
function setNdc(e) { const r = canvas.getBoundingClientRect(); ndc.set((e.clientX - r.left) / r.width * 2 - 1, -(e.clientY - r.top) / r.height * 2 + 1); ray.setFromCamera(ndc, camera); }
function hitPatch(e) { setNdc(e); const h = ray.intersectObject(patch, false)[0]; return h ? [h.uv.x * WN, (1 - h.uv.y) * WN] : null; }
function poke() { S.lastInput = performance.now(); controls.autoRotate = false; }

canvas.addEventListener('pointerdown', (e) => {
  poke();
  down = [e.clientX, e.clientY];
  if (S.write) {
    const p = hitPatch(e);
    if (p) { drawing = true; lastPt = null; strokeTo(...p); canvas.setPointerCapture(e.pointerId); }
  }
});
canvas.addEventListener('pointermove', (e) => {
  if (!drawing) return;
  const p = hitPatch(e);
  if (p) strokeTo(...p);
});
canvas.addEventListener('pointerup', (e) => {
  if (drawing) { drawing = false; lastPt = null; return; }
  if (!down || Math.hypot(e.clientX - down[0], e.clientY - down[1]) > 6 || S.write) return;
  setNdc(e);
  for (const [k, obj] of Object.entries(clickables)) {
    if (!obj || !ray.intersectObject(obj, true).length) continue;
    if (k === 'tree') {
      S.treeOn = !S.treeOn; shakeTree(); audio.chime();
      toast(S.treeOn ? '彩灯亮了，雪从枝头抖落' : '彩灯熄了');
    } else if (k === 'lamp') {
      S.lampOn = !S.lampOn; toast(S.lampOn ? '路灯亮了' : '路灯关了'); audio.crunch(0.2);
    } else if (k === 'cabin') {
      S.windowOn = !S.windowOn; toast(S.windowOn ? '屋里有人点起了灯' : '屋里的人睡了');
    }
    break;
  }
});
canvas.addEventListener('wheel', poke, { passive: true });
addEventListener('keydown', (e) => { if (e.target.tagName !== 'INPUT') poke(); });

/* ---------------- start / intro ---------------- */
let introDone = false, introT = 0, started = false;
const introFrom = camera.position.clone();
function start() {
  started = true;
  $('loader').style.opacity = 0;
  setTimeout(() => $('loader').remove(), 1500);
  if (REDUCED) { camera.position.copy(CAM_HOME); introT = 1; }
  setTimeout(() => toast('点圣诞树、路灯或小木屋试试；也可以在雪上写字', 5200), 3800);
}

/* ---------------- environment update ---------------- */
const tmpC = new THREE.Color();
function applyEnv() {
  const d = S.day, s = S.snow, D = PAL.day, N = PAL.night;
  const hor = tmpC.copy(N.hor).lerp(D.hor, d);
  const fogCol = hor.clone().lerp(new THREE.Color(d > 0.5 ? '#c3cad4' : '#1d2638'), s * 0.35);
  skyU.uHor.value.copy(fogCol);
  skyU.uTop.value.copy(N.top).lerp(D.top, d).lerp(fogCol, s * 0.55);
  skyU.uNight.value = 1 - d;
  skyU.uClear.value = clamp(1 - s * 1.25, 0, 1);
  scene.fog.color.copy(fogCol);
  scene.fog.density = 0.008 + 0.034 * Math.pow(s, 1.4);
  hemi.color.copy(N.hemiS).lerp(D.hemiS, d);
  hemi.groundColor.copy(N.hemiG).lerp(D.hemiG, d);
  hemi.intensity = lerp(N.hemi, D.hemi, d) * (1 - s * 0.12);
  sun.color.copy(N.sun).lerp(D.sun, d);
  sun.intensity = lerp(N.sunI, D.sunI, d) * (1 - s * 0.45);
  sun.position.copy(sun.target.position).addScaledVector(SUN_DIR, 50);
  renderer.toneMappingExposure = lerp(N.exp, D.exp, d);
  bloom.strength = lerp(0.62, 0.2, d);
  bloom.threshold = lerp(0.62, 0.92, d);
  glU.uDay.value = d;
  glU.uAmt.value = 1 - s * 0.5;
}

/* ---------------- loop ---------------- */
const clock = new THREE.Clock();
let lampK = 1, winK = 1, treeK = 1;
let simT = 0, paused = false;
function frame() {
  if (paused) return;
  requestAnimationFrame(frame);
  tick(Math.min(clock.getDelta(), 0.05));
}
function tick(dt) {
  simT += dt;
  const t = simT;

  S.day = lerp(S.day, S.dayTarget, 1 - Math.exp(-dt * 1.6));
  if (Math.abs(S.day - S.dayTarget) < 0.001) S.day = S.dayTarget;
  applyEnv();
  const night = 1 - S.day;

  // intro dolly
  if (started && !introDone) {
    introT = Math.min(1, introT + dt / 4.5);
    const e = 1 - Math.pow(1 - introT, 3);
    camera.position.lerpVectors(introFrom, CAM_HOME, e);
    camera.lookAt(controls.target);
    if (introT >= 1) { introDone = true; controls.enabled = !S.write; }
  } else if (introDone) {
    if (!S.write && performance.now() - S.lastInput > 25000 && !REDUCED) { controls.autoRotate = true; controls.autoRotateSpeed = 0.22; }
    controls.update();
  }

  stepWind(dt);
  audio.update(wind.speed);

  sky.position.copy(camera.position);
  skyU.uTime.value = t;
  glU.uTime.value = t;

  // lights
  lampK = lerp(lampK, S.lampOn ? 1 : 0, 1 - Math.exp(-dt * 6));
  winK = lerp(winK, S.windowOn ? 1 : 0, 1 - Math.exp(-dt * 3));
  treeK = lerp(treeK, S.treeOn ? 1 : 0, 1 - Math.exp(-dt * 5));
  const flick = 1 + Math.sin(t * 13.0) * 0.01 + Math.sin(t * 7.3) * 0.015;
  lampLight.intensity = lampK * lerp(5, 26, night) * flick;
  glU.uLamp.value = lampK * lerp(0.15, 1, night);
  halo.material.uniforms.uOp.value = lampK * night * (0.1 + S.snow * 0.22);
  glow.lamp.forEach((m) => (m.emissiveIntensity = lampK * lerp(1.6, 3.2, night) * flick));
  const candle = 1 + Math.sin(t * 9.1) * 0.04 + Math.sin(t * 3.7) * 0.05;
  winLight.intensity = winK * lerp(2, 14, night) * candle;
  glow.window.forEach((m) => (m.emissiveIntensity = winK * lerp(0.6, 4.5, night) * candle + 0.05));
  treeLight.intensity = treeK * lerp(1, 6, night);
  for (let i = 0; i < TL; i++) {
    const [ph, sp] = tlPhase[i];
    const k = treeK * (1.2 + 2.6 * Math.pow(0.5 + 0.5 * Math.sin(t * sp + ph), 2)) * lerp(0.9, 1.6, night) + 0.02;
    tlMesh.setColorAt(i, tmpC.copy(tlBase[i]).multiplyScalar(k));
  }
  tlMesh.instanceColor.needsUpdate = true;
  updateSnow(dt, t);
  starMat.color.setRGB(3.2, 2.3, 0.9).multiplyScalar((0.15 + treeK * 0.85) * (1 + Math.sin(t * 2) * 0.12));
  star.rotation.y = Math.sin(t * 0.5) * 0.4;

  // smoke
  for (const sp of smoke) {
    const u = sp.userData;
    u.age += dt;
    if (u.age > u.life) { u.age = 0; u.rot = Math.random() * 6; }
    const k = u.age / u.life;
    sp.position.set(
      smokeOrigin.x + Math.cos(wind.dir) * k * k * (2 + wind.speed * 1.6) + Math.sin(u.rot + t * 0.3) * 0.25 * k,
      smokeOrigin.y + k * 4.5,
      smokeOrigin.z + Math.sin(wind.dir) * k * k * (2 + wind.speed * 1.6));
    sp.scale.setScalar(0.4 + k * 3.2);
    sp.material.rotation = u.rot + u.spin * u.age;
    sp.material.opacity = Math.sin(Math.PI * Math.min(1, k * 1.4)) * (0.16 + night * 0.05) * (winK * 0.7 + 0.3) * (1 - S.snow * 0.4);
    sp.material.color.setRGB(lerp(0.32, 0.82, S.day), lerp(0.34, 0.84, S.day), lerp(0.4, 0.88, S.day));
  }

  // puff
  if (puffT < 3) {
    puffT += dt;
    for (let i = 0; i < PUFFN; i++) {
      puffVel[i * 3 + 1] -= 2.2 * dt;
      puffVel[i * 3] *= 0.98; puffVel[i * 3 + 2] *= 0.98;
      puffPos[i * 3] += (puffVel[i * 3] + Math.cos(wind.dir) * wind.speed * 0.3) * dt;
      puffPos[i * 3 + 1] = Math.max(0.02, puffPos[i * 3 + 1] + puffVel[i * 3 + 1] * dt * 0.6);
      puffPos[i * 3 + 2] += (puffVel[i * 3 + 2] + Math.sin(wind.dir) * wind.speed * 0.3) * dt;
    }
    puffGeo.attributes.position.needsUpdate = true;
    puffMat.opacity = Math.max(0, 0.9 - puffT * 0.3);
    puffMat.color.setScalar(lerp(0.35, 1, S.day));
  } else puffMat.opacity = 0;

  // ground writing
  refill(dt);
  stepCarve(dt);
  stepCritter(dt);
  if (smoothing > 0) {
    smoothing -= dt;
    wctx.fillStyle = 'rgba(128,128,128,0.18)'; wctx.fillRect(0, 0, WN, WN); texDirty = true;
    if (smoothing <= 0) { wctx.fillStyle = 'rgb(128,128,128)'; wctx.fillRect(0, 0, WN, WN); }
  }
  if (texDirty) { writeTex.needsUpdate = true; texDirty = false; }

  composer.render();
}

function resize() {
  const w = innerWidth, h = innerHeight;
  renderer.setSize(w, h); composer.setSize(w, h);
  camera.aspect = w / h; camera.updateProjectionMatrix();
  const buf = renderer.getDrawingBufferSize(new THREE.Vector2());
  SNOW_SHARED.uRes.value.copy(buf);
  SNOW_SHARED.uScale.value = buf.y / (2 * Math.tan(THREE.MathUtils.degToRad(camera.fov) / 2));
  SNOW_SHARED.uAper.value = 0.5 * 0.012 * SNOW_SHARED.uScale.value;
  glU.uPR.value = renderer.getPixelRatio();
}
addEventListener('resize', resize);
resize();
frame();

// test hooks (harmless in production)
window.__snow = { SU: SNOW_SHARED, layers: () => [snowNear, snowFar, snowDrift], wind, pause: () => { paused = true; }, tick: (dt) => tick(dt), wcv, finish: () => { while (carving) stepCarve(1); for (let i = 0; i < 60 && critter; i++) stepCritter(0.3); writeTex.needsUpdate = true; }, grab: () => { composer.render(); return renderer.domElement.toDataURL('image/jpeg', 0.85); }, S, setAmount, setDay, carve, startCritter, shakeTree, camera, controls };
