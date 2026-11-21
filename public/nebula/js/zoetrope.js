import * as THREE from 'three';
import { wingVertex, wingFragment } from './shaders/wing.js';

// The zoetrope corridor: an endless row of specimen frames, each holding one
// motionless butterfly. Frame i shows the butterfly at pose i of a 76-frame
// flight cycle; as the row rushes toward the viewer the still poses read as
// flight, exactly like a flipbook.

export const CYCLE = 76;
const SLOTS = 30;
const H = 4.2;

function squareRing(inner) {
  const pos = [], e = [], idx = [];
  const C = [[1, 1], [-1, 1], [-1, -1], [1, -1]];
  for (let k = 0; k < 4; k++) {
    const [ax, ay] = C[k], [bx, by] = C[(k + 1) % 4];
    const b = pos.length / 3;
    pos.push(ax * H, ay * H, 0, bx * H, by * H, 0, bx * H * inner, by * H * inner, 0, ax * H * inner, ay * H * inner, 0);
    e.push(1, 1, 0, 0);
    idx.push(b, b + 1, b + 2, b, b + 2, b + 3);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('aE', new THREE.Float32BufferAttribute(e, 1));
  g.setIndex(idx);
  return g;
}

// Pose of the butterfly inside frame i (absolute index; the cycle repeats).
const _e = new THREE.Euler();
export function poseOf(i, out = {}) {
  const a = (((i % CYCLE) + CYCLE) % CYCLE) / CYCLE * Math.PI * 2;
  out.x = 1.2 * Math.sin(a * 2);
  out.y = 0.6 * Math.sin(a * 3 + 0.6) + 0.15;
  out.phase = i * (Math.PI * 2 / 9); // nine frames per wingbeat
  _e.set(-0.18 + 0.12 * Math.sin(a * 3), 0.4 * Math.cos(a * 2), -0.28 * Math.cos(a * 2));
  out.quat = (out.quat || new THREE.Quaternion()).setFromEuler(_e);
  return out;
}

// Approximate wing angle that the shader produces for a phase (for the inspector).
export function wingAngleOf(phase, amp = 0.62, base = 0.18) {
  return base + amp * (Math.sin(phase) + 0.22 * Math.sin(2 * phase));
}

export class Zoetrope {
  constructor(scene, bfly, colors) {
    this.group = new THREE.Group();
    scene.add(this.group);
    this.spacing = 2.3;
    this.lensZ = 2.2;
    this.scale = 0.46;
    this.disposables = [];
    const keep = (...x) => { this.disposables.push(...x); return x[0]; };

    // ---- frames ----------------------------------------------------------
    this.frameU = { uA: { value: 1 }, uWarm: { value: colors.warm }, uGlow: { value: colors.glow }, uGold: { value: new THREE.Color('#f2c46d') }, uLens: { value: 3.2 }, uFar: { value: -60 } };
    this.aMark = new THREE.InstancedBufferAttribute(new Float32Array(SLOTS), 1).setUsage(THREE.DynamicDrawUsage);
    this.aCur = new THREE.InstancedBufferAttribute(new Float32Array(SLOTS), 1).setUsage(THREE.DynamicDrawUsage);
    this.aFade = new THREE.InstancedBufferAttribute(new Float32Array(SLOTS), 1).setUsage(THREE.DynamicDrawUsage);
    const frameVS = (scaleInner) => `attribute float aE; attribute float aMark; attribute float aCur; attribute float aFade;
      varying float vE; varying float vMark; varying float vCur; varying float vFade; varying float vZ;
      void main(){ vE = aE; vMark = aMark; vCur = aCur; vFade = aFade;
        vec4 w = instanceMatrix * vec4(position * vec3(${scaleInner}, ${scaleInner}, 1.0), 1.0); vZ = w.z;
        gl_Position = projectionMatrix * modelViewMatrix * w; }`;
    const panelGeo = keep(squareRing(0.66));
    panelGeo.setAttribute('aMark', this.aMark); panelGeo.setAttribute('aCur', this.aCur); panelGeo.setAttribute('aFade', this.aFade);
    this.panels = new THREE.InstancedMesh(panelGeo, keep(new THREE.ShaderMaterial({
      uniforms: this.frameU,
      vertexShader: frameVS('1.0'),
      fragmentShader: `uniform vec3 uWarm, uGlow, uGold; uniform float uA, uFar; varying float vE; varying float vMark; varying float vCur; varying float vFade; varying float vZ;
        void main(){
          float inner = 1.0 - smoothstep(0.0, 0.05, vE);
          float outer = smoothstep(0.93, 1.0, vE);
          float depth = smoothstep(uFar, -4.0, vZ);
          vec3 base = mix(vec3(0.75), uWarm, 0.25);
          vec3 c = base * (0.022 + 0.035*vE + inner*0.09 + outer*0.05) * (0.45 + 0.55*depth);
          c += uGold * vMark * (inner*0.35 + outer*0.25 + 0.03);
          c += uGlow * vCur * (inner*0.25 + 0.02);
          float a = vFade * uA;
          gl_FragColor = vec4(c*a, a);
        }`,
      side: THREE.DoubleSide, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    })), SLOTS);
    this.panels.frustumCulled = false;
    this.panels.renderOrder = 1;
    this.group.add(this.panels);
    const edgeGeo = keep(squareRing(0.985));
    edgeGeo.setAttribute('aMark', this.aMark); edgeGeo.setAttribute('aCur', this.aCur); edgeGeo.setAttribute('aFade', this.aFade);
    this.edges = new THREE.InstancedMesh(edgeGeo, keep(new THREE.ShaderMaterial({
      uniforms: this.frameU,
      vertexShader: frameVS('0.66'),
      fragmentShader: `uniform vec3 uGlow, uGold; uniform float uA; varying float vMark; varying float vCur; varying float vFade;
        void main(){ float a = vFade*uA*(0.2 + vMark*0.6 + vCur*0.35); gl_FragColor = vec4(mix(uGlow, uGold, vMark)*a, a); }`,
      side: THREE.DoubleSide, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    })), SLOTS);
    this.edges.frustumCulled = false;
    this.edges.renderOrder = 1;
    this.group.add(this.edges);

    // ---- one still butterfly per frame ------------------------------------
    const geo = keep(bfly.wingGeo.clone());
    this.aPhase = new THREE.InstancedBufferAttribute(new Float32Array(SLOTS), 1).setUsage(THREE.DynamicDrawUsage);
    this.aAlpha = new THREE.InstancedBufferAttribute(new Float32Array(SLOTS), 1).setUsage(THREE.DynamicDrawUsage);
    geo.setAttribute('aIPhase', this.aPhase);
    geo.setAttribute('aIAlpha', this.aAlpha);
    geo.setAttribute('aIHue', new THREE.InstancedBufferAttribute(new Float32Array(SLOTS), 1));
    const BU = bfly.uniforms;
    this.wingU = {
      uPhase: { value: 0 }, uAmp: { value: 0.62 }, uTime: { value: 0 }, uFlapBase: { value: 0.18 },
      uBody: { value: colors.body }, uAccent: { value: colors.accent }, uGlow: { value: colors.glow },
      uDissolve: { value: 0 }, uOpacity: { value: 1 }, uBright: { value: 0.55 }, uGhost: { value: 0 },
      uShA: BU.uShA, uShB: BU.uShB, uShC: BU.uShC,
      uMat: { value: 0 }, uPattern: { value: 8 }, uRainbow: { value: 0 }, uGlowAmt: { value: 0.85 }, uSpec: { value: 0.12 },
    };
    this.wings = new THREE.InstancedMesh(geo, keep(new THREE.ShaderMaterial({
      uniforms: this.wingU, vertexShader: wingVertex, fragmentShader: wingFragment,
      side: THREE.DoubleSide, transparent: true, depthWrite: false,
    })), SLOTS);
    this.wings.frustumCulled = false;
    this.wings.renderOrder = 5;
    this.group.add(this.wings);

    this.slotIndex = new Int32Array(SLOTS).fill(-1); // absolute frame index shown in each draw slot
    this._m = new THREE.Matrix4();
    this._fm = new THREE.Matrix4();
    this._bm = new THREE.Matrix4();
    this._q = new THREE.Quaternion();
    this._p = new THREE.Vector3();
    this._s = new THREE.Vector3();
    this._pose = {};
    this.opacity = 1;
    this.frameOpacity = 1;
  }

  frameZ(i, head) { return this.lensZ - (i - head) * this.spacing; }

  frameTwist(i) { return 0.018 * Math.sin(i * 0.73) + 0.01 * Math.sin(i * 1.91); }

  // World matrix of the still butterfly in frame i.
  butterflyMatrix(i, head, out = new THREE.Matrix4()) {
    const z = this.frameZ(i, head);
    this._q.setFromAxisAngle(this._p.set(0, 0, 1), this.frameTwist(i));
    this._fm.compose(this._p.set(0, 0, z), this._q, this._s.setScalar(1));
    const pose = poseOf(i, this._pose);
    this._bm.compose(this._p.set(pose.x, pose.y, 0.05), pose.quat, this._s.setScalar(this.scale * 1.35));
    out.multiplyMatrices(this._fm, this._bm);
    this.group.updateMatrixWorld();
    return out.premultiply(this.group.matrixWorld);
  }

  update(head, { marks, extracted, time, far = -62 }) {
    this.frameU.uA.value = this.frameOpacity;
    this.frameU.uLens.value = this.lensZ;
    this.frameU.uFar.value = far;
    this.wingU.uTime.value = time;
    this.wings.visible = this.opacity > 0.003;
    this.panels.visible = this.edges.visible = this.frameOpacity > 0.003;
    const first = Math.floor(head) - 2;
    for (let j = 0; j < SLOTS; j++) {
      const i = first + (SLOTS - 1 - j); // draw far frames first
      const slot = j;
      this.slotIndex[slot] = i;
      if (i < 0) {
        this.aFade.array[slot] = 0; this.aAlpha.array[slot] = 0;
        this._m.makeScale(0, 0, 0);
        this.panels.setMatrixAt(slot, this._m); this.edges.setMatrixAt(slot, this._m); this.wings.setMatrixAt(slot, this._m);
        continue;
      }
      const z = this.frameZ(i, head);
      // fade: far end dissolves into the light; frames that pass the lens fly off behind the viewer
      const fadeFar = THREE.MathUtils.smoothstep(z, far, far + 22);
      const pass = 1 - THREE.MathUtils.smoothstep(z, this.lensZ + 0.2, this.lensZ + this.spacing * 1.6);
      const fade = fadeFar * pass;
      const cur = Math.max(0, 1 - Math.abs(i - head) * 0.9);
      this._q.setFromAxisAngle(this._p.set(0, 0, 1), this.frameTwist(i));
      this._fm.compose(this._p.set(0, 0, z), this._q, this._s.setScalar(1));
      this.panels.setMatrixAt(slot, this._fm);
      this.edges.setMatrixAt(slot, this._fm);
      this.aFade.array[slot] = fade;
      this.aMark.array[slot] = marks.has(i) ? 1 : 0;
      this.aCur.array[slot] = cur;
      const pose = poseOf(i, this._pose);
      this._bm.compose(this._p.set(pose.x, pose.y, 0.05), pose.quat, this._s.setScalar(this.scale * 1.35));
      this._m.multiplyMatrices(this._fm, this._bm);
      this.wings.setMatrixAt(slot, this._m);
      this.aPhase.array[slot] = pose.phase;
      this.aAlpha.array[slot] = i === extracted ? 0 : fade * this.opacity * (0.28 + 0.72 * Math.pow(1 - Math.min(1, Math.max(0, (i - head) / 22)), 1.4));
    }
    for (const m of [this.panels, this.edges, this.wings]) m.instanceMatrix.needsUpdate = true;
    this.aMark.needsUpdate = this.aCur.needsUpdate = this.aFade.needsUpdate = true;
    this.aPhase.needsUpdate = this.aAlpha.needsUpdate = true;
  }

  // Nearest still butterfly under a screen point (NDC), or -1.
  pick(ndc, camera, head, extracted) {
    let best = -1, bestD = Infinity;
    const v = new THREE.Vector3();
    for (let slot = 0; slot < SLOTS; slot++) {
      const i = this.slotIndex[slot];
      if (i < 0 || i === extracted || this.aAlpha.array[slot] < 0.08) continue;
      this.butterflyMatrix(i, head, this._m);
      v.setFromMatrixPosition(this._m);
      const dist = v.distanceTo(camera.position);
      v.project(camera);
      if (v.z > 1) continue;
      const r = Math.max(0.05, (this.scale * 1.35 * 1.25 * this.group.scale.x * camera.projectionMatrix.elements[5]) / dist);
      const d = Math.hypot((v.x - ndc.x) * camera.aspect, v.y - ndc.y);
      // prefer the closest frame when several overlap on screen
      const score = d / r + dist * 0.004;
      if (d < r && score < bestD) { bestD = score; best = i; }
    }
    return best;
  }

  dispose() { this.disposables.forEach((d) => d.dispose && d.dispose()); }
}
