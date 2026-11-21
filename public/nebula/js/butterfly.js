import * as THREE from 'three';
import { wingVertex, wingFragment, bodyVertex, bodyFragment } from './shaders/wing.js';

// --- Wing shapes (mirror of GLSL wingR in shaders/common.js) -------------
// [forewing centre, sharpness, exponent, length], [hindwing ...], [tail, scallop]
export const WING_SHAPES = {
  classic: [[0.62, 1.55, 0.9, 1.15], [-0.72, 1.45, 0.7, 0.86], [0, 0.03]],
  swallow: [[0.58, 1.6, 1.1, 1.2], [-0.8, 1.6, 0.8, 0.78], [0.55, 0.06]],
  moth: [[0.45, 1.15, 0.55, 1.0], [-0.6, 1.25, 0.5, 0.9], [0, 0]],
  falcon: [[0.48, 2.0, 1.6, 1.35], [-0.62, 1.8, 1.0, 0.7], [0, 0.02]],
  lace: [[0.7, 1.4, 0.8, 1.1], [-0.85, 1.35, 0.6, 0.95], [0.25, 0.09]],
};
function lobe(th, c, k, p) {
  const a = Math.max(-1.5707, Math.min(1.5707, (th - c) * k));
  return Math.pow(Math.max(Math.cos(a), 0), p);
}
const sm = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
export function wingR(th, shape = WING_SHAPES.classic) {
  const [A, B, C] = shape;
  const fore = A[3] * lobe(th, A[0], A[1], A[2]) * (1 + 0.12 * sm(A[0] - 0.35, A[0] + 0.25, th));
  const hind = B[3] * lobe(th, B[0], B[1], B[2]) * (1 + C[1] * Math.sin(th * 24) * sm(-0.15, -0.7, th));
  const tail = C[0] * Math.exp(-(((th + 1.22) / 0.075) ** 2));
  return Math.max(fore, hind, 0.06) + tail;
}
const ROOT = 0.035; // half body width — wings attach here
export const TH_MIN = -1.5;
export const TH_MAX = 1.52;

export function wingLocal(side, th, f) {
  const r = wingR(th) * f;
  const x = side * (ROOT + Math.cos(th) * r);
  const y = Math.sin(th) * r;
  const z = -0.1 * f * f + 0.035 * Math.sin(th * 3) * f;
  return [x, y, z];
}

// Area-weighted random sample on the wing surface (edge-biased) for particles.
export function sampleWing(rand) {
  const side = rand() < 0.5 ? -1 : 1;
  let th, r;
  for (let i = 0; i < 20; i++) {
    th = TH_MIN + rand() * (TH_MAX - TH_MIN);
    r = wingR(th);
    if (rand() < (r * r) / 1.4) break;
  }
  const u = rand();
  const f = u < 0.3 ? 0.93 + rand() * 0.07 : Math.sqrt(rand());
  // th/f are what the GPU uses (shape can change live); x/y/z are the classic-shape preview
  const [x, y, z] = wingLocal(side, th, f);
  return { x, y, z, f, th };
}

function buildWingGeometry(segs = 150, rings = 34) {
  const pos = [];
  const rad = [];
  const the = [];
  const idx = [];
  let base = 0;
  for (const side of [1, -1]) {
    for (let j = 0; j <= rings; j++) {
      const f = 0.02 + (j / rings) * 0.98;
      for (let i = 0; i <= segs; i++) {
        const th = TH_MIN + (i / segs) * (TH_MAX - TH_MIN);
        const [x, y, z] = wingLocal(side, th, f);
        pos.push(x, y, z);
        rad.push(f);
        the.push(th);
      }
    }
    const row = segs + 1;
    for (let j = 0; j < rings; j++) {
      for (let i = 0; i < segs; i++) {
        const a = base + j * row + i;
        const b = a + 1;
        const c = a + row;
        const d = c + 1;
        if (side > 0) idx.push(a, c, b, b, c, d);
        else idx.push(a, b, c, b, d, c);
      }
    }
    base += (rings + 1) * row;
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('aRadial', new THREE.Float32BufferAttribute(rad, 1));
  g.setAttribute('aTheta', new THREE.Float32BufferAttribute(the, 1));
  g.setIndex(idx);
  g.computeBoundingSphere();
  g.boundingSphere.radius = 1.6;
  return g;
}

const HISTORY = 360;
const GHOSTS = 30;

export class Butterfly {
  constructor(scene, palette) {
    this.group = new THREE.Group();
    this.root = new THREE.Group(); // receives pose rotation
    this.group.add(this.root);
    scene.add(this.group);

    this.phase = 0;
    this.amp = 0.62;
    this.dissolve = 0;
    this.flutter = 0; // 0..1 envelope after tap
    this.spin = 0;
    this.pos = new THREE.Vector3();
    this.vel = new THREE.Vector3();
    this.target = new THREE.Vector3();
    this.baseScale = 1.35;

    const common = {
      uPhase: { value: 0 },
      uAmp: { value: this.amp },
      uTime: { value: 0 },
      uBody: { value: palette.body },
      uAccent: { value: palette.accent },
      uGlow: { value: palette.glow },
      uDissolve: { value: 0 },
      uOpacity: { value: 1 },
      uBright: { value: 1.35 },
      uGhost: { value: 0 },
      uShA: { value: new THREE.Vector4(...WING_SHAPES.classic[0]) },
      uShB: { value: new THREE.Vector4(...WING_SHAPES.classic[1]) },
      uShC: { value: new THREE.Vector4(...WING_SHAPES.classic[2], 0, 0) },
      uMat: { value: 0 },
      uPattern: { value: 0 },
      uRainbow: { value: 0 },
      uGlowAmt: { value: 1 },
      uSpec: { value: 0.3 },
      uFlapBase: { value: 0.18 },
    };
    this.uniforms = common;
    this.shapeTarget = WING_SHAPES.classic;
    const geo = buildWingGeometry();
    this.wingGeo = geo;
    this.wingMat = new THREE.ShaderMaterial({
      uniforms: common,
      vertexShader: wingVertex,
      fragmentShader: wingFragment,
      side: THREE.DoubleSide,
      transparent: true,
      depthWrite: true,
    });
    this.wings = new THREE.Mesh(geo, this.wingMat);
    this.wings.renderOrder = 5;
    this.root.add(this.wings);

    // Body: head, thorax, abdomen, antennae
    this.bodyUniforms = { uBody: common.uBody, uGlow: common.uGlow, uOpacity: { value: 1 }, uBright: common.uBright };
    this.bodyMat = new THREE.ShaderMaterial({
      uniforms: this.bodyUniforms, vertexShader: bodyVertex, fragmentShader: bodyFragment, transparent: true,
    });
    const body = new THREE.Group();
    const sph = new THREE.SphereGeometry(1, 24, 16);
    const mk = (sx, sy, sz, y) => {
      const m = new THREE.Mesh(sph, this.bodyMat);
      m.scale.set(sx, sy, sz);
      m.position.y = y;
      body.add(m);
      return m;
    };
    mk(0.06, 0.06, 0.06, 0.27);
    mk(0.075, 0.2, 0.08, 0.06);
    mk(0.05, 0.38, 0.055, -0.38);
    const antGeo = [];
    for (const s of [-1, 1]) {
      const curve = new THREE.CatmullRomCurve3([
        new THREE.Vector3(s * 0.02, 0.31, 0.02),
        new THREE.Vector3(s * 0.12, 0.55, 0.06),
        new THREE.Vector3(s * 0.24, 0.78, 0.04),
        new THREE.Vector3(s * 0.3, 0.9, -0.02),
      ]);
      const tube = new THREE.TubeGeometry(curve, 24, 0.007, 6, false);
      antGeo.push(tube);
      body.add(new THREE.Mesh(tube, this.bodyMat));
      const tip = new THREE.Mesh(sph, this.bodyMat);
      tip.scale.setScalar(0.022);
      tip.position.set(s * 0.3, 0.9, -0.02);
      body.add(tip);
    }
    this.extraGeos = [sph, ...antGeo];
    body.renderOrder = 6;
    this.root.add(body);
    this.body = body;

    // Echo ghosts (time-slice trail like the reference video)
    this.ghostUniforms = { ...common, uGhost: { value: 1 }, uOpacity: { value: 1 }, uDissolve: { value: 0 } };
    this.ghostMat = new THREE.ShaderMaterial({
      uniforms: this.ghostUniforms,
      vertexShader: wingVertex,
      fragmentShader: wingFragment,
      side: THREE.DoubleSide,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
    this.ghosts = new THREE.InstancedMesh(geo, this.ghostMat, GHOSTS);
    this.ghostPhase = new THREE.InstancedBufferAttribute(new Float32Array(GHOSTS), 1);
    this.ghostAlpha = new THREE.InstancedBufferAttribute(new Float32Array(GHOSTS), 1);
    this.ghostPhase.setUsage(THREE.DynamicDrawUsage);
    geo.setAttribute('aIHue', new THREE.InstancedBufferAttribute(new Float32Array(GHOSTS), 1));
    this.ghostAlpha.setUsage(THREE.DynamicDrawUsage);
    geo.setAttribute('aIPhase', this.ghostPhase);
    geo.setAttribute('aIAlpha', this.ghostAlpha);
    this.ghosts.frustumCulled = false;
    this.ghosts.renderOrder = 4;
    scene.add(this.ghosts);

    this.hist = Array.from({ length: HISTORY }, () => ({ m: new THREE.Matrix4(), p: 0 }));
    this.histHead = 0;
    this.histFilled = 0;
    this._m = new THREE.Matrix4();
    this._v = new THREE.Vector3();
    this._q = new THREE.Quaternion();
    this._s = new THREE.Vector3();
    this._v4 = new THREE.Vector4();
    this._echoDir = new THREE.Vector3(0.62, 0.02, -1).normalize();
    this.echoStep = 1.05;
  }

  triggerFlutter() {
    this.flutter = 1;
  }

  setShape(name) {
    if (WING_SHAPES[name]) this.shapeTarget = WING_SHAPES[name];
  }

  morphShape(dt) {
    const k = 1 - Math.exp(-dt * 4);
    const [A, B, C] = this.shapeTarget;
    const u = this.uniforms;
    u.uShA.value.lerp(this._v4.set(...A), k);
    u.uShB.value.lerp(this._v4.set(...B), k);
    u.uShC.value.lerp(this._v4.set(C[0], C[1], 0, 0), k);
  }

  update(dt, t, { flapSpeed, scale, follow, wing, echo, echoSpread, bass, anim, basePos, sway, override = null, extraScale = 1, amp = null }) {
    this.morphShape(dt);
    // Flap
    const flutterBoost = 1 + this.flutter * 2.2;
    this.phase += dt * anim * flapSpeed * Math.PI * 2 * 1.15 * flutterBoost * (1 + bass * 0.7);
    this.amp = (amp ?? 0.5 + 0.12 * Math.sin(t * 0.37)) + bass * 0.25 + this.flutter * 0.3;
    this.flutter = Math.max(0, this.flutter - dt * 0.55);

    // Position: base position + gentle hover + pointer follow (eased spring)
    this.target.copy(basePos).add(follow);
    this.target.y += Math.sin(t * 0.9) * 0.16 + Math.sin(t * 2.3) * 0.04;
    this.target.x += Math.sin(t * 0.43) * 0.22 * sway;
    const k = 1 - Math.exp(-dt * 2.4);
    const prev = this._v.copy(this.pos);
    this.pos.lerp(this.target, k);
    this.vel.subVectors(this.pos, prev).divideScalar(Math.max(dt, 1e-3));

    // Pose: slow cinematic attitude changes + banking from velocity + flutter spin
    this.spin += dt * this.flutter * 9;
    if (!override) {
      const r = this.root.rotation;
      r.x = -0.22 + 0.32 * Math.sin(t * 0.21) * sway - this.vel.y * 0.05;
      r.y = 0.55 * Math.sin(t * 0.16 + 1.2) * sway + this.spin;
      r.z = 0.12 * Math.sin(t * 0.29) - this.vel.x * 0.06;
    }

    if (override) {
      // Path following: position and heading come from the drawn curve.
      this.pos.copy(prev).lerp(override.pos, 1 - Math.exp(-dt * 12));
      this.root.quaternion.slerp(override.quat, 1 - Math.exp(-dt * 7));
    }
    const s = this.baseScale * scale * extraScale * (0.25 + 0.75 * Math.min(1, wing * 1.6));
    this.group.position.copy(this.pos);
    this.group.scale.setScalar(s);

    this.dissolve = 1 - wing;
    this.uniforms.uPhase.value = this.phase;
    this.uniforms.uAmp.value = this.amp;
    this.uniforms.uTime.value = t;
    this.uniforms.uDissolve.value = Math.min(1, this.dissolve);
    this.bodyUniforms.uOpacity.value = Math.max(0, 1 - this.dissolve * 1.6);
    this.wings.visible = this.dissolve < 0.995;
    this.body.visible = this.dissolve < 0.6;

    this.group.updateMatrixWorld(true);
    this.root.updateMatrixWorld(true);

    // Record history and place ghosts
    const h = this.hist[this.histHead];
    h.m.copy(this.root.matrixWorld);
    h.p = this.phase;
    this.histHead = (this.histHead + 1) % HISTORY;
    this.histFilled = Math.min(HISTORY, this.histFilled + 1);

    const visibleEcho = echo * (1 - this.dissolve);
    this.ghosts.visible = visibleEcho > 0.01;
    if (this.ghosts.visible) {
      const step = 3 + Math.round(echoSpread * 3);
      for (let i = 0; i < GHOSTS; i++) {
        const back = Math.min(this.histFilled - 1, (i + 1) * step);
        const hi = (this.histHead - 1 - back + HISTORY * 2) % HISTORY;
        const e = this.hist[hi];
        // attitude and wing phase come from the recent past (a time-slice),
        // position always extends from where the butterfly is now
        e.m.decompose(this._v, this._q, this._s);
        const off = (i + 1) * this.echoStep * echoSpread * s;
        this._v.copy(this.pos).addScaledVector(this._echoDir, off);
        this._s.multiplyScalar(1 - i * 0.012 * echoSpread);
        this._m.compose(this._v, this._q, this._s);
        this.ghosts.setMatrixAt(i, this._m);
        this.ghostPhase.array[i] = e.p;
        const fall = Math.pow(1 - i / GHOSTS, 1.4);
        this.ghostAlpha.array[i] = visibleEcho * fall * (0.2 + 0.22 * echoSpread);
      }
      this.ghosts.instanceMatrix.needsUpdate = true;
      this.ghostPhase.needsUpdate = true;
      this.ghostAlpha.needsUpdate = true;
    }
  }

  // Screen-space hit test for tap interaction
  hitTest(ndc, camera) {
    if (this.dissolve > 0.7) return false;
    const p = this._v.copy(this.pos).project(camera);
    const dx = (p.x - ndc.x) * camera.aspect;
    const dy = p.y - ndc.y;
    const dist = this.pos.distanceTo(camera.position);
    const rad = (this.group.scale.x * 1.25 * camera.projectionMatrix.elements[5]) / Math.max(dist, 0.1);
    return Math.hypot(dx, dy) < Math.max(rad, 0.12);
  }

  dispose() {
    this.wingGeo.dispose();
    this.extraGeos.forEach((g) => g.dispose());
    this.wingMat.dispose();
    this.ghostMat.dispose();
    this.bodyMat.dispose();
  }
}
