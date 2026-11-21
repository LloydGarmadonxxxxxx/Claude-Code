import * as THREE from 'three';
import { wingVertex, wingFragment } from './shaders/wing.js';

// The zoetrope corridor: an endless row of specimen frames, each holding one
// motionless butterfly. Frame i shows the butterfly at pose i of a 76-frame
// flight cycle; as the row rushes toward the viewer the still poses read as
// flight, exactly like a flipbook.

export const CYCLE = 76;
const SLOTS = 56;
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
export const FRAMES_PER_BEAT = 24; // one slow wingbeat spread over 24 frames
export const PATH_FRAMES = 160;    // one loop of the flight path
export function poseOf(i, out = {}) {
  const a = (i / PATH_FRAMES) * Math.PI * 2;
  out.x = 1.1 * Math.sin(a * 2);
  out.y = 0.5 * Math.sin(a * 3 + 0.6) + 0.15;
  out.phase = i * (Math.PI * 2 / FRAMES_PER_BEAT);
  _e.set(-0.18 + 0.12 * Math.sin(a * 3), 0.38 * Math.cos(a * 2), -0.26 * Math.cos(a * 2));
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
    this.spacing = 1.1;
    this.lensZ = -1.2; // where the butterfly 'now' is born — a comfortable distance from the lens
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
          c += mix(uGlow, uGold, 0.7) * vCur * (inner*0.35 + outer*0.12 + 0.025);
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
        void main(){ float a = vFade*uA*(0.2 + vMark*0.6 + vCur*0.6); gl_FragColor = vec4(mix(uGlow, uGold, max(vMark, vCur*0.85))*a, a); }`,
      side: THREE.DoubleSide, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    })), SLOTS);
    this.edges.frustumCulled = false;
    this.edges.renderOrder = 1;
    this.group.add(this.edges);

    // ---- one still butterfly per frame ------------------------------------
    const geo = keep(bfly.wingGeo.clone());
    this.aPhase = new THREE.InstancedBufferAttribute(new Float32Array(SLOTS), 1).setUsage(THREE.DynamicDrawUsage);
    this.aAlpha = new THREE.InstancedBufferAttribute(new Float32Array(SLOTS), 1).setUsage(THREE.DynamicDrawUsage);
    this.aGold = new THREE.InstancedBufferAttribute(new Float32Array(SLOTS), 1).setUsage(THREE.DynamicDrawUsage);
    geo.setAttribute('aIGold', this.aGold);
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

    // ---- the one now: a golden halo and drifting gold flecks --------------
    this.haloU = { uA: { value: 0 }, uGold: { value: new THREE.Color('#ff9e2c') }, uTime: { value: 0 } };
    const haloGeo = keep(new THREE.PlaneGeometry(1, 1));
    this.halo = new THREE.Mesh(haloGeo, keep(new THREE.ShaderMaterial({
      uniforms: this.haloU,
      vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.0); }',
      fragmentShader: `uniform vec3 uGold; uniform float uA, uTime; varying vec2 vUv;
        void main(){
          vec2 p = vUv*2.0 - 1.0; float r = length(p);
          float breathe = 0.9 + 0.1*sin(uTime*2.2);
          float g = exp(-r*r*4.5)*1.1 + exp(-r*r*20.0)*0.7 + exp(-r*2.4)*0.25;
          float ring = exp(-pow((r - 0.62)*9.0, 2.0)) * 0.16;
          float a = (g + ring) * uA * breathe;
          gl_FragColor = vec4(uGold * a, a);
        }`,
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    })));
    this.halo.frustumCulled = false;
    this.halo.renderOrder = 4;
    scene.add(this.halo);
    const FN = 70;
    const fpos = new Float32Array(FN * 3), fseed = new Float32Array(FN * 4);
    for (let k = 0; k < FN; k++) { for (let c = 0; c < 4; c++) fseed[k * 4 + c] = Math.random(); }
    const fGeo = keep(new THREE.BufferGeometry());
    fGeo.setAttribute('position', new THREE.BufferAttribute(fpos, 3));
    fGeo.setAttribute('aSeed', new THREE.BufferAttribute(fseed, 4));
    fGeo.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 1e4);
    this.fleckU = { uA: { value: 0 }, uCenter: { value: new THREE.Vector3() }, uR: { value: 1 }, uTime: { value: 0 }, uProj: { value: 600 }, uGold: this.haloU.uGold };
    this.flecks = new THREE.Points(fGeo, keep(new THREE.ShaderMaterial({
      uniforms: this.fleckU,
      vertexShader: `attribute vec4 aSeed; uniform vec3 uCenter; uniform float uR, uTime, uProj; varying float vT;
        void main(){
          float a = aSeed.x*6.2831 + uTime*(0.25 + aSeed.y*0.5);
          float rr = uR*(0.55 + aSeed.z*0.9);
          vec3 p = uCenter + vec3(cos(a)*rr, sin(a*1.3 + aSeed.w*6.0)*rr*0.6 + sin(uTime*0.7 + aSeed.x*20.0)*uR*0.1, sin(a)*rr*0.5);
          vec4 mv = modelViewMatrix*vec4(p,1.0);
          gl_Position = projectionMatrix*mv;
          vT = pow(0.5 + 0.5*sin(uTime*(1.5 + aSeed.w*3.0) + aSeed.y*40.0), 3.0);
          gl_PointSize = clamp((0.02 + aSeed.w*0.03)*uProj/max(-mv.z, 0.3), 1.0, 9.0);
        }`,
      fragmentShader: `uniform vec3 uGold; uniform float uA; varying float vT;
        void main(){ vec2 c = gl_PointCoord*2.0-1.0; float d = dot(c,c); if (d>1.0) discard;
          float a = (exp(-d*5.0) + exp(-d*30.0)) * (0.25 + vT) * uA; gl_FragColor = vec4(mix(uGold, vec3(1.0,0.95,0.8), 0.35)*1.6*a, a); }`,
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    })));
    this.flecks.frustumCulled = false;
    this.flecks.renderOrder = 6;
    scene.add(this.flecks);
    this.curPos = new THREE.Vector3();
    this._wp = new THREE.Vector3();

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
    this.gold = 1;
  }

  // Frame i is born at the lens when the playhead reaches it, then recedes into the depth.
  frameZ(i, head) { return this.lensZ - (head - i) * this.spacing; }

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

  update(head, { marks, extracted, time, far = -62, camera = null, proj = 600 }) {
    let bestCur = 0;
    this.frameU.uA.value = this.frameOpacity;
    this.frameU.uLens.value = this.lensZ;
    this.frameU.uFar.value = far;
    this.wingU.uTime.value = time;
    this.wings.visible = this.opacity > 0.003;
    this.panels.visible = this.edges.visible = this.frameOpacity > 0.003;
    const newest = Math.floor(head) + 1; // the next frame, about to be born at the lens
    for (let j = 0; j < SLOTS; j++) {
      const i = newest - (SLOTS - 1 - j); // oldest (farthest) drawn first, newest last
      const slot = j;
      this.slotIndex[slot] = i;
      if (i < 0) {
        this.aFade.array[slot] = 0; this.aAlpha.array[slot] = 0; this.aGold.array[slot] = 0;
        this._m.makeScale(0, 0, 0);
        this.panels.setMatrixAt(slot, this._m); this.edges.setMatrixAt(slot, this._m); this.wings.setMatrixAt(slot, this._m);
        continue;
      }
      const z = this.frameZ(i, head);
      const age = head - i; // 0 = the frame now, grows as it recedes
      // a frame is born over the last fraction of a frame, then recedes and fades into the light
      const birth = THREE.MathUtils.clamp(1 + age * 1.6, 0, 1);
      const fadeFar = THREE.MathUtils.smoothstep(z, far, far + 22);
      const fade = birth * fadeFar;
      // "now" = the frame closest to the playhead; it is gilded
      // exactly one butterfly is 'now' at full gold: the newest one at the lens;
      // the one it replaces lets go of its gold quickly instead of cross-fading
      const cur = age < 0 ? 0 : age < 1 ? 1 : THREE.MathUtils.clamp(1 - (age - 1) * 4, 0, 1);
      this._q.setFromAxisAngle(this._p.set(0, 0, 1), this.frameTwist(i));
      this._fm.compose(this._p.set(0, 0, z), this._q, this._s.setScalar(1));
      this.panels.setMatrixAt(slot, this._fm);
      this.edges.setMatrixAt(slot, this._fm);
      this.aFade.array[slot] = fade;
      this.aMark.array[slot] = marks.has(i) ? 1 : 0;
      this.aCur.array[slot] = cur;
      const pose = poseOf(i, this._pose);
      const lift = 1 + cur * 0.08; // the one now is a touch larger
      this._bm.compose(this._p.set(pose.x, pose.y, 0.05 + cur * 0.15), pose.quat, this._s.setScalar(this.scale * 1.35 * lift));
      this._m.multiplyMatrices(this._fm, this._bm);
      this.wings.setMatrixAt(slot, this._m);
      this.aPhase.array[slot] = pose.phase;
      this.aGold.array[slot] = cur * this.gold;
      if (cur > bestCur && i !== extracted) {
        bestCur = cur;
        this.curPos.setFromMatrixPosition(this._m);
      }
      // past selves dim with age so the gilded one reads as the living butterfly
      const trail = 0.1 + 0.28 * Math.pow(Math.max(0, 1 - Math.max(0, age) / 44), 1.5);
      this.aAlpha.array[slot] = i === extracted ? 0 : fade * this.opacity * Math.max(trail, cur);
    }
    for (const m of [this.panels, this.edges, this.wings]) m.instanceMatrix.needsUpdate = true;
    this.aMark.needsUpdate = this.aCur.needsUpdate = this.aFade.needsUpdate = true;
    this.aPhase.needsUpdate = this.aAlpha.needsUpdate = this.aGold.needsUpdate = true;

    // halo + flecks follow the gilded butterfly (smoothly, so frame steps don't jitter it)
    this.group.updateMatrixWorld();
    const target = this._wp.copy(this.curPos).applyMatrix4(this.group.matrixWorld);
    if (!this._haloInit) { this.halo.position.copy(target); this._haloInit = true; }
    this.halo.position.lerp(target, 0.35);
    const k = this.group.scale.x;
    // there is always a butterfly 'now': keep its halo steady instead of pulsing with each frame step
    const show = (bestCur > 0.01 ? 1 : 0) * this.gold * this.opacity;
    this.haloU.uA.value += (show - this.haloU.uA.value) * 0.25;
    this.haloU.uTime.value = time;
    this.halo.scale.setScalar(this.scale * 1.35 * 4.2 * k);
    if (camera) this.halo.quaternion.copy(camera.quaternion);
    this.halo.visible = this.haloU.uA.value > 0.005;
    this.fleckU.uCenter.value.copy(this.halo.position);
    this.fleckU.uR.value = this.scale * 1.35 * 1.25 * k;
    this.fleckU.uA.value = this.haloU.uA.value;
    this.fleckU.uTime.value = time;
    this.fleckU.uProj.value = proj;
    this.flecks.visible = this.halo.visible;
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
