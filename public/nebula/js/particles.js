import * as THREE from 'three';
import { particleVertex, particleFragment } from './shaders/particles.js';
import { sampleWing } from './butterfly.js';

// Deterministic PRNG so the same seed gives the same layout.
export function mulberry32(a) {
  return function () {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function gauss(rand) {
  return Math.sqrt(-2 * Math.log(rand() + 1e-9)) * Math.cos(2 * Math.PI * rand());
}

export class ParticleField {
  constructor(scene, max, palette, seed = 7, shapeUniforms) {
    this.max = max;
    this.scene = scene;
    this.palette = palette;
    this.uniforms = {
      uTime: { value: 0 }, uPhase: { value: 0 }, uAmp: { value: 0.6 },
      uSize: { value: 1 }, uProj: { value: 800 }, uSpread: { value: 1 },
      uFocus: { value: 11 }, uDof: { value: 0.4 },
      uBurstT: { value: 99 }, uBurstPow: { value: 1 }, uBurstO: { value: new THREE.Vector3() },
      uMorph: { value: 0 }, uRebirth: { value: 0 }, uTunnelT: { value: 0 }, uTwist: { value: 1 }, uSpin: { value: 0 },
      uMouse: { value: new THREE.Vector3(999, 999, 999) }, uMouseStr: { value: 0 }, uMouseSwirl: { value: 0 }, uMouseR: { value: 2.6 },
      uBass: { value: 0 }, uMid: { value: 0 }, uTreble: { value: 0 },
      uWA: { value: new THREE.Vector3(1, 0, 0) }, uWB: { value: new THREE.Vector3() },
      uCol1: { value: palette.particle }, uCol2: { value: palette.accent }, uCol3: { value: palette.glow }, uBody: { value: palette.body },
      uBfly: { value: new THREE.Matrix4() },
      uVar: { value: new THREE.Vector4(1, 1, 1, 1) },
      uWingVis: { value: 1 },
      uWS: { value: 0 }, uFormA: { value: 0 }, uFormB: { value: 0 }, uFormMix: { value: 1 },
      uWind: { value: new THREE.Vector3() }, uGather: { value: 0 }, uDensity: { value: 1 },
      uFxA: { value: 0 }, uFxB: { value: 0 }, uFxMix: { value: 1 }, uFxScale: { value: 1 }, uFxBloom: { value: 1 },
      uFog: { value: 0 }, uSCol: { value: new THREE.Color(1, 1, 1) },
      uShA: null, uShB: null, uShC: null,
      uGlow: { value: 1 }, uOpacity: { value: 1 },
    };
    Object.assign(this.uniforms, shapeUniforms); // wing shape shared with the butterfly mesh
    this.material = new THREE.ShaderMaterial({
      uniforms: this.uniforms,
      vertexShader: particleVertex,
      fragmentShader: particleFragment,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
    this.build(seed);
  }

  build(seed) {
    const n = this.max;
    const rand = mulberry32(seed);
    const pos = new Float32Array(n * 3);
    const wing = new Float32Array(n * 2);
    const sd = new Float32Array(n * 4);
    const gal = new Float32Array(n * 3);
    const sph = new Float32Array(n * 3);
    const knot = new Float32Array(n * 3);
    const arms = 3 + Math.floor(rand() * 3);
    for (let i = 0; i < n; i++) {
      const w = sampleWing(rand);
      pos[i * 3] = w.x; pos[i * 3 + 1] = w.y; pos[i * 3 + 2] = w.z;
      wing[i * 2] = w.f; wing[i * 2 + 1] = w.th;
      sd[i * 4] = rand(); sd[i * 4 + 1] = rand(); sd[i * 4 + 2] = rand(); sd[i * 4 + 3] = rand();

      // Galaxy: logarithmic arms + bulge
      if (rand() < 0.16) {
        const r = Math.pow(rand(), 2) * 2.2;
        const u = rand() * Math.PI * 2, v = Math.acos(2 * rand() - 1);
        gal[i * 3] = r * Math.sin(v) * Math.cos(u);
        gal[i * 3 + 1] = r * Math.cos(v) * 0.6;
        gal[i * 3 + 2] = r * Math.sin(v) * Math.sin(u);
      } else {
        const r = 1.2 + Math.pow(rand(), 0.75) * 11;
        const arm = Math.floor(rand() * arms);
        const ang = (arm / arms) * Math.PI * 2 + r * 0.42 + gauss(rand) * 0.32 * (1.25 - r / 13);
        gal[i * 3] = Math.cos(ang) * r + gauss(rand) * 0.25;
        gal[i * 3 + 1] = gauss(rand) * 0.28 * (1.1 - r / 14);
        gal[i * 3 + 2] = Math.sin(ang) * r + gauss(rand) * 0.25;
      }
      // Unit ball
      {
        const u = rand() * Math.PI * 2, v = Math.acos(2 * rand() - 1), r = Math.cbrt(rand());
        sph[i * 3] = r * Math.sin(v) * Math.cos(u);
        sph[i * 3 + 1] = r * Math.cos(v);
        sph[i * 3 + 2] = r * Math.sin(v) * Math.sin(u);
      }
      // Torus knot (2,3)
      {
        const t = rand() * Math.PI * 2;
        const p = 2, q = 3, R = 4.2;
        const r = 1.6 * Math.cos(q * t) + R;
        const cx = r * Math.cos(p * t), cy = 1.6 * Math.sin(q * t) * 1.4, cz = r * Math.sin(p * t);
        const tube = 0.55 * Math.sqrt(rand());
        const a = rand() * Math.PI * 2;
        knot[i * 3] = cx + Math.cos(a) * tube;
        knot[i * 3 + 1] = cy + Math.sin(a) * tube;
        knot[i * 3 + 2] = cz + Math.cos(a + 1.7) * tube;
      }
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    g.setAttribute('aWing', new THREE.BufferAttribute(wing, 2));
    g.setAttribute('aSeed', new THREE.BufferAttribute(sd, 4));
    g.setAttribute('aGalaxy', new THREE.BufferAttribute(gal, 3));
    g.setAttribute('aSphere', new THREE.BufferAttribute(sph, 3));
    g.setAttribute('aKnot', new THREE.BufferAttribute(knot, 3));
    g.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 1e4);
    if (this.points) {
      this.points.geometry.dispose();
      this.points.geometry = g;
    } else {
      this.points = new THREE.Points(g, this.material);
      this.points.frustumCulled = false;
      this.points.renderOrder = 8;
      this.scene.add(this.points);
    }
    this.setCount(this.count || n);
  }

  setCount(c) {
    this.count = Math.max(1000, Math.min(this.max, Math.floor(c)));
    this.points.geometry.setDrawRange(0, this.count);
  }

  dispose() {
    this.points.geometry.dispose();
    this.material.dispose();
  }
}

// Pointer / finger light trail — a small CPU-driven pool of glowing sparks.
export class PointerTrail {
  constructor(scene, palette, n = 900) {
    this.n = n;
    this.head = 0;
    this.pos = new Float32Array(n * 3);
    this.vel = new Float32Array(n * 3);
    this.life = new Float32Array(n);
    this.col = new Float32Array(n * 3);
    this.size = new Float32Array(n);
    this.palette = palette;
    const g = new THREE.BufferGeometry();
    this.aPos = new THREE.BufferAttribute(this.pos, 3).setUsage(THREE.DynamicDrawUsage);
    this.aLife = new THREE.BufferAttribute(this.life, 1).setUsage(THREE.DynamicDrawUsage);
    this.aCol = new THREE.BufferAttribute(this.col, 3).setUsage(THREE.DynamicDrawUsage);
    this.aSize = new THREE.BufferAttribute(this.size, 1);
    g.setAttribute('position', this.aPos);
    g.setAttribute('aLife', this.aLife);
    g.setAttribute('aCol', this.aCol);
    g.setAttribute('aSize', this.aSize);
    g.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 1e4);
    this.uniforms = { uProj: { value: 800 }, uGlow: { value: 1 } };
    this.material = new THREE.ShaderMaterial({
      uniforms: this.uniforms,
      vertexShader: /* glsl */ `
        attribute float aLife; attribute vec3 aCol; attribute float aSize;
        uniform float uProj;
        varying vec3 vCol; varying float vLife;
        void main(){
          vec4 mv = modelViewMatrix * vec4(position,1.0);
          gl_Position = projectionMatrix * mv;
          vLife = aLife; vCol = aCol;
          gl_PointSize = aLife <= 0.0 ? 0.0 : clamp(aSize * (0.35 + aLife) * uProj / max(-mv.z,0.1) * 0.06, 0.0, 64.0);
        }`,
      fragmentShader: /* glsl */ `
        uniform float uGlow; varying vec3 vCol; varying float vLife;
        void main(){
          vec2 c = gl_PointCoord*2.0-1.0; float d = dot(c,c); if(d>1.0) discard;
          float a = exp(-d*4.5) + exp(-d*30.0)*0.8;
          gl_FragColor = vec4(vCol*uGlow*1.6, a*vLife);
        }`,
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    });
    this.points = new THREE.Points(g, this.material);
    this.points.frustumCulled = false;
    this.points.renderOrder = 9;
    scene.add(this.points);
    this.last = null;
    this._tmp = new THREE.Color();
  }

  emit(p, amount = 6, color = null, key = 'pointer') {
    this.lasts = this.lasts || {};
    const from = this.lasts[key] || p.clone();
    for (let k = 0; k < amount; k++) {
      const i = this.head;
      this.head = (this.head + 1) % this.n;
      const f = Math.random();
      this.pos[i * 3] = from.x + (p.x - from.x) * f + (Math.random() - 0.5) * 0.08;
      this.pos[i * 3 + 1] = from.y + (p.y - from.y) * f + (Math.random() - 0.5) * 0.08;
      this.pos[i * 3 + 2] = from.z + (p.z - from.z) * f + (Math.random() - 0.5) * 0.08;
      this.vel[i * 3] = (Math.random() - 0.5) * 0.6;
      this.vel[i * 3 + 1] = (Math.random() - 0.5) * 0.6 + 0.15;
      this.vel[i * 3 + 2] = (Math.random() - 0.5) * 0.6;
      this.life[i] = 0.6 + Math.random() * 0.4;
      const r = Math.random();
      const c = color && r < 0.75 ? color : r < 0.45 ? this.palette.particle : r < 0.8 ? this.palette.accent : this.palette.glow;
      this.col[i * 3] = c.r; this.col[i * 3 + 1] = c.g; this.col[i * 3 + 2] = c.b;
      this.size[i] = 0.5 + Math.random() * 1.2;
    }
    this.aSize.needsUpdate = true;
    if (!this.lasts[key]) this.lasts[key] = p.clone(); else this.lasts[key].copy(p);
  }

  release(key = 'pointer') { if (this.lasts) this.lasts[key] = null; }

  update(dt) {
    let any = false;
    for (let i = 0; i < this.n; i++) {
      if (this.life[i] <= 0) continue;
      any = true;
      this.life[i] -= dt * 0.9;
      this.pos[i * 3] += this.vel[i * 3] * dt;
      this.pos[i * 3 + 1] += this.vel[i * 3 + 1] * dt;
      this.pos[i * 3 + 2] += this.vel[i * 3 + 2] * dt;
      this.vel[i * 3] *= 0.98; this.vel[i * 3 + 1] *= 0.98; this.vel[i * 3 + 2] *= 0.98;
    }
    if (any || this._wasActive) {
      this.aPos.needsUpdate = true;
      this.aLife.needsUpdate = true;
      this.aCol.needsUpdate = true;
    }
    this._wasActive = any;
  }

  dispose() {
    this.points.geometry.dispose();
    this.material.dispose();
  }
}
