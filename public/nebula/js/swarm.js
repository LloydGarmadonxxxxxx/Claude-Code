import * as THREE from 'three';
import { wingVertex, wingFragment } from './shaders/wing.js';

// Extra butterflies for the Creative Studio (count, path following, converge FX).
// Shares the main butterfly's uniforms (shape, material, pattern, colours) and
// geometry layout; each instance has its own flap phase, hue offset and flight.
export const SWARM_MAX = 32;

export class Swarm {
  constructor(scene, butterfly) {
    this.bfly = butterfly;
    const geo = butterfly.wingGeo.clone();
    this.phase = new THREE.InstancedBufferAttribute(new Float32Array(SWARM_MAX), 1).setUsage(THREE.DynamicDrawUsage);
    this.alpha = new THREE.InstancedBufferAttribute(new Float32Array(SWARM_MAX), 1).setUsage(THREE.DynamicDrawUsage);
    this.hue = new THREE.InstancedBufferAttribute(new Float32Array(SWARM_MAX), 1);
    geo.setAttribute('aIPhase', this.phase);
    geo.setAttribute('aIAlpha', this.alpha);
    geo.setAttribute('aIHue', this.hue);
    this.geo = geo;
    this.uniforms = { ...butterfly.uniforms, uDissolve: { value: 0 }, uOpacity: { value: 1 }, uGhost: { value: 0 } };
    this.mat = new THREE.ShaderMaterial({
      uniforms: this.uniforms, vertexShader: wingVertex, fragmentShader: wingFragment,
      side: THREE.DoubleSide, transparent: true, depthWrite: true,
    });
    this.mesh = new THREE.InstancedMesh(geo, this.mat, SWARM_MAX);
    this.mesh.frustumCulled = false;
    this.mesh.renderOrder = 5;
    this.mesh.count = 0;
    scene.add(this.mesh);

    this.items = [];
    for (let i = 0; i < SWARM_MAX; i++) {
      const r = (k) => Math.sin(i * 91.7 + k * 13.1) * 0.5 + 0.5;
      this.items.push({
        pos: new THREE.Vector3((r(1) - 0.5) * 8, (r(2) - 0.5) * 4, (r(3) - 0.5) * 5),
        quat: new THREE.Quaternion(),
        flap: r(4) * 6.28,
        flapRate: 0.85 + r(5) * 0.35,
        orbit: { a: 2.5 + r(6) * 4, b: 1 + r(7) * 2, c: 1.5 + r(8) * 3, w: 0.25 + r(9) * 0.35, p: r(10) * 6.28, y: (r(11) - 0.5) * 4 },
        scale: 0.55 + r(12) * 0.35,
        fade: 0,
      });
      this.hue.array[i] = (r(13) - 0.5) * 0.16;
    }
    this.hue.needsUpdate = true;
    this.count = 0;
    this.converge = 0; // 0..1 pulls every butterfly into the centre
    this._m = new THREE.Matrix4();
    this._s = new THREE.Vector3();
    this._t = new THREE.Vector3();
    this._dir = new THREE.Vector3();
    this._up = new THREE.Vector3(0, 1, 0);
    this._basis = new THREE.Matrix4();
    this._x = new THREE.Vector3();
    this._y = new THREE.Vector3();
    this._z = new THREE.Vector3();
  }

  static headingQuat(tangent, out, tmp) {
    // Body axis (+Y) along travel, back (+Z) toward world up.
    const y = tmp.y.copy(tangent).normalize();
    const z = tmp.z.set(0, 1, 0).addScaledVector(y, -y.y);
    if (z.lengthSq() < 1e-4) z.set(0, 0, 1);
    z.normalize();
    const x = tmp.x.crossVectors(y, z).normalize();
    tmp.m.makeBasis(x, y, z);
    return out.setFromRotationMatrix(tmp.m);
  }

  // targets: function(i) => {pos, tangent} | null for free flight
  update(dt, t, { count, flapSpeed, flight, scale, anim, target, center }) {
    this.count = count;
    const tmp = { x: this._x, y: this._y, z: this._z, m: this._basis };
    let visible = 0;
    for (let i = 0; i < SWARM_MAX; i++) {
      const it = this.items[i];
      const want = i < count ? 1 : 0;
      it.fade += (want - it.fade) * (1 - Math.exp(-dt * 3));
      if (it.fade < 0.01 && !want) continue;
      it.flap += dt * anim * flapSpeed * Math.PI * 2 * 1.15 * it.flapRate;
      const prev = this._t.copy(it.pos);
      const tg = target ? target(i) : null;
      if (tg) {
        it.pos.lerp(tg.pos, 1 - Math.exp(-dt * 6));
        this._dir.copy(tg.tangent);
      } else {
        const o = it.orbit;
        const tt = t * o.w * flight + o.p;
        const goal = this._s.set(Math.sin(tt) * o.a, o.y + Math.sin(tt * 1.7) * o.b, Math.cos(tt * 0.8) * o.c).add(center);
        it.pos.lerp(goal, 1 - Math.exp(-dt * 1.5));
        this._dir.subVectors(it.pos, prev);
        if (this._dir.lengthSq() < 1e-8) this._dir.set(0, 1, 0);
      }
      if (this.converge > 0) it.pos.lerp(center, this.converge * (1 - Math.exp(-dt * 3)));
      Swarm.headingQuat(this._dir, it.quat, tmp);
      const sc = it.scale * scale * 1.35 * (1 - this.converge * 0.85) * it.fade;
      this._m.compose(it.pos, it.quat, this._s.setScalar(Math.max(sc, 1e-4)));
      this.mesh.setMatrixAt(visible, this._m);
      this.phase.array[visible] = it.flap;
      this.alpha.array[visible] = it.fade * (1 - this.converge * 0.9);
      this.hue.array[visible] = (Math.sin(i * 7.31) * 0.5) * 0.16;
      visible++;
    }
    this.mesh.count = visible;
    this.mesh.visible = visible > 0;
    if (visible) {
      this.mesh.instanceMatrix.needsUpdate = true;
      this.phase.needsUpdate = true;
      this.alpha.needsUpdate = true;
      this.hue.needsUpdate = true;
    }
  }

  dispose() {
    this.geo.dispose();
    this.mat.dispose();
  }
}
