import * as THREE from 'three';
import { NOISE } from './shaders/common.js';

// Extra environment layers used by the Creative Studio scenes:
// neon floor grid, floating crystals, luminous forest and ambient dust.
export class StudioEnv {
  constructor(scene) {
    this.scene = scene;
    this.colA = new THREE.Color('#7cc8ff');
    this.colB = new THREE.Color('#a46bff');
    this.disposables = [];
    const common = { uA: { value: this.colA }, uB: { value: this.colB }, uTime: { value: 0 }, uBright: { value: 1 }, uFog: { value: 0 } };
    this.common = common;

    // ---- Floor grid
    this.gridU = { ...common, uAmt: { value: 0 }, uScroll: { value: 0 }, uMist: { value: 0 } };
    const gGeo = new THREE.PlaneGeometry(260, 260, 1, 1);
    gGeo.rotateX(-Math.PI / 2);
    this.grid = new THREE.Mesh(gGeo, new THREE.ShaderMaterial({
      uniforms: this.gridU,
      vertexShader: `varying vec3 vW; void main(){ vec4 w = modelMatrix*vec4(position,1.0); vW = w.xyz; gl_Position = projectionMatrix*viewMatrix*w; }`,
      fragmentShader: /* glsl */ `
        ${NOISE}
        uniform vec3 uA, uB; uniform float uTime, uBright, uAmt, uScroll, uMist, uFog; varying vec3 vW;
        void main(){
          vec2 p = vW.xz * 0.5 + vec2(0.0, uScroll);
          vec2 g = abs(fract(p - 0.5) - 0.5) / fwidth(p);
          float line = 1.0 - min(min(g.x, g.y), 1.0);
          vec2 p2 = vW.xz * 0.1 + vec2(0.0, uScroll*0.2);
          vec2 g2 = abs(fract(p2 - 0.5) - 0.5) / fwidth(p2);
          float major = 1.0 - min(min(g2.x, g2.y), 1.0);
          float dist = length(vW.xz);
          float fade = exp(-dist*0.022) * (1.0 - smoothstep(60.0, 120.0, dist));
          fade *= exp(-max(dist - 10.0, 0.0) * uFog * 0.05);
          vec3 c = mix(uA, uB, smoothstep(-40.0, 40.0, vW.x)) * (line*0.45 + major*0.9);
          float mist = (snoise(vec3(vW.xz*0.06, uTime*0.05))*0.5 + 0.5) * exp(-dist*0.03) * uMist;
          c += mix(uA, uB, 0.5) * mist * 0.25;
          c += uA * exp(-dist*0.08) * 0.15;
          float a = (line*0.45 + major*0.9) * uAmt + mist*0.4;
          gl_FragColor = vec4(c * fade * uBright * (uAmt + uMist), a * fade);
        }`,
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    }));
    this.grid.position.y = -5.5;
    this.grid.renderOrder = 1;
    this.grid.frustumCulled = false;
    scene.add(this.grid);
    this.disposables.push(gGeo, this.grid.material);

    // ---- Crystals
    const N = 46;
    const cGeo = new THREE.OctahedronGeometry(1, 0);
    cGeo.computeVertexNormals();
    cGeo.scale(0.7, 1.4, 0.7);
    this.crystalU = { ...common, uAmt: { value: 0 } };
    this.crystals = new THREE.InstancedMesh(cGeo, new THREE.ShaderMaterial({
      uniforms: this.crystalU,
      vertexShader: `varying vec3 vN; varying vec3 vV; varying vec3 vL; varying float vD;
        void main(){ vec4 wp = instanceMatrix*vec4(position,1.0); vec4 mv = modelViewMatrix*wp; vN = normalize(normalMatrix*mat3(instanceMatrix)*normal); vV = -mv.xyz; vL = position; vD = -mv.z; gl_Position = projectionMatrix*mv; }`,
      fragmentShader: `uniform vec3 uA, uB; uniform float uTime, uAmt, uBright, uFog; varying vec3 vN; varying vec3 vV; varying vec3 vL; varying float vD;
        void main(){
          vec3 N = normalize(vN); vec3 V = normalize(vV);
          float f = pow(1.0 - abs(dot(N, V)), 2.0);
          float facet = 0.5 + 0.5*sin(dot(N, vec3(5.0, 3.0, 4.0)) + uTime*0.6);
          float edge = smoothstep(0.86, 1.0, max(max(abs(N.x), abs(N.y)), abs(N.z)));
          vec3 c = mix(uA, uB, facet) * (0.12 + f*1.3 + pow(facet, 8.0)*0.8);
          float fog = exp(-max(vD - 12.0, 0.0)*uFog*0.05);
          float a = (0.15 + f*0.7) * uAmt * fog;
          gl_FragColor = vec4(c * uBright * a, a);
        }`,
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    }), N);
    this.crystalData = [];
    for (let i = 0; i < N; i++) {
      const a = Math.random() * Math.PI * 2;
      const r = 7 + Math.random() * 18;
      this.crystalData.push({
        p: new THREE.Vector3(Math.cos(a) * r, (Math.random() - 0.5) * 14, Math.sin(a) * r - 4),
        s: 0.4 + Math.pow(Math.random(), 2) * 2.2,
        rot: new THREE.Euler(Math.random() * 3, Math.random() * 3, Math.random() * 3),
        w: (Math.random() - 0.5) * 0.4,
        ph: Math.random() * 6.28,
      });
    }
    this.crystals.frustumCulled = false;
    this.crystals.renderOrder = 2;
    scene.add(this.crystals);
    this.disposables.push(cGeo, this.crystals.material);

    // ---- Luminous forest (trunks with bioluminescent veins)
    const T = 64;
    const tGeo = new THREE.CylinderGeometry(0.06, 0.22, 1, 7, 12, true);
    tGeo.translate(0, 0.5, 0);
    this.forestU = { ...common, uAmt: { value: 0 } };
    this.forest = new THREE.InstancedMesh(tGeo, new THREE.ShaderMaterial({
      uniforms: this.forestU,
      vertexShader: `uniform float uTime; varying float vY; varying vec3 vN; varying vec3 vV; varying float vD; varying vec3 vW;
        void main(){ vec3 p = position; float sway = sin(uTime*0.4 + instanceMatrix[3].x*0.3)*0.25*p.y*p.y;
          p.x += sway; vY = p.y; vec4 wp = instanceMatrix*vec4(p,1.0); vW = wp.xyz; vec4 mv = modelViewMatrix*wp;
          vN = normalize(normalMatrix*mat3(instanceMatrix)*normal); vV = -mv.xyz; vD = -mv.z; gl_Position = projectionMatrix*mv; }`,
      fragmentShader: `uniform vec3 uA, uB; uniform float uTime, uAmt, uBright, uFog; varying float vY; varying vec3 vN; varying vec3 vV; varying float vD; varying vec3 vW;
        void main(){
          float f = pow(1.0 - abs(dot(normalize(vN), normalize(vV))), 1.5);
          float vein = pow(0.5 + 0.5*sin(vW.y*3.0 + atan(vN.z, vN.x)*3.0 - uTime*1.2), 10.0);
          float pulse = exp(-pow(fract(vY - uTime*0.12)*4.0 - 2.0, 2.0));
          vec3 c = mix(uA, uB, vY) * (0.06 + f*0.6 + vein*0.6 + pulse*0.5);
          float fog = exp(-max(vD - 10.0, 0.0)*uFog*0.06);
          float a = uAmt * (0.12 + f*0.35) * fog * (1.0 - smoothstep(0.75, 1.0, vY));
          gl_FragColor = vec4(c * uBright * a, a);
        }`,
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
    }), T);
    const m = new THREE.Matrix4();
    for (let i = 0; i < T; i++) {
      const a = Math.random() * Math.PI * 2;
      const r = 12 + Math.pow(Math.random(), 0.7) * 30;
      const h = 9 + Math.random() * 16;
      const s = 0.7 + Math.random() * 1.3;
      m.compose(new THREE.Vector3(Math.cos(a) * r, -5.5, Math.sin(a) * r - 6),
        new THREE.Quaternion().setFromEuler(new THREE.Euler((Math.random() - 0.5) * 0.15, 0, (Math.random() - 0.5) * 0.15)),
        new THREE.Vector3(s, h, s));
      this.forest.setMatrixAt(i, m);
    }
    this.forest.frustumCulled = false;
    this.forest.renderOrder = 2;
    scene.add(this.forest);
    this.disposables.push(tGeo, this.forest.material);

    // ---- Ambient dust (stars, fireflies, rising motes…)
    const D = 5000;
    const pos = new Float32Array(D * 3);
    const seed = new Float32Array(D * 4);
    for (let i = 0; i < D; i++) {
      pos[i * 3] = (Math.random() - 0.5) * 70;
      pos[i * 3 + 1] = (Math.random() - 0.5) * 34;
      pos[i * 3 + 2] = (Math.random() - 0.5) * 70 - 8;
      for (let k = 0; k < 4; k++) seed[i * 4 + k] = Math.random();
    }
    const dGeo = new THREE.BufferGeometry();
    dGeo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    dGeo.setAttribute('aSeed', new THREE.BufferAttribute(seed, 4));
    dGeo.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 1e4);
    this.dustU = { ...common, uAmt: { value: 0 }, uMode: { value: 0 }, uProj: { value: 800 }, uCol: { value: new THREE.Color('#ffffff') } };
    this.dust = new THREE.Points(dGeo, new THREE.ShaderMaterial({
      uniforms: this.dustU,
      vertexShader: /* glsl */ `
        ${NOISE}
        attribute vec4 aSeed; uniform float uTime, uMode, uProj, uFog; varying float vA;
        void main(){
          vec3 p = position;
          float t = uTime;
          float a = 0.6;
          if (uMode < 0.5) { p += snoise3(p*0.05 + t*0.02)*2.0; }
          else if (uMode < 1.5) { a = pow(0.5 + 0.5*sin(t*(0.8 + aSeed.x*3.0) + aSeed.y*40.0), 6.0); }
          else if (uMode < 2.5) { p.y = mod(p.y + 17.0 + t*(0.6 + aSeed.x*1.2), 34.0) - 17.0; a = 0.5; }
          else { p += snoise3(vec3(aSeed.xy*8.0, t*0.15))*2.5; a = pow(max(0.0, sin(t*(0.6 + aSeed.z) + aSeed.w*30.0)), 8.0)*1.6; p.y = -4.0 + aSeed.y*9.0 + sin(t*0.5 + aSeed.x*10.0); }
          vec4 mv = modelViewMatrix * vec4(p, 1.0);
          gl_Position = projectionMatrix * mv;
          float d = max(-mv.z, 0.1);
          vA = a * exp(-max(d - 12.0, 0.0)*uFog*0.06);
          gl_PointSize = clamp((0.05 + aSeed.z*0.07) * uProj / d * (uMode > 2.5 ? 2.2 : 1.0), 1.0, 24.0);
        }`,
      fragmentShader: `uniform vec3 uCol; uniform float uAmt, uBright; varying float vA;
        void main(){ vec2 c = gl_PointCoord*2.0-1.0; float d = dot(c,c); if (d>1.0) discard;
          float a = (exp(-d*5.0) + exp(-d*30.0)) * vA * uAmt; gl_FragColor = vec4(uCol*uBright*1.4, a); }`,
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    }));
    this.dust.frustumCulled = false;
    this.dust.renderOrder = 3;
    scene.add(this.dust);
    this.disposables.push(dGeo, this.dust.material);
    this._m = new THREE.Matrix4();
    this._q = new THREE.Quaternion();
    this._s = new THREE.Vector3();
  }

  // s: eased scene values {grid, mist, crystals, forest, dust, dustMode, fog, ambient, depth, gridSpeed}
  update(dt, t, s, proj) {
    const c = this.common;
    c.uTime.value = t;
    c.uBright.value = s.ambient;
    c.uFog.value = s.fog;
    this.gridU.uAmt.value = s.grid;
    this.gridU.uMist.value = s.mist;
    this.gridU.uScroll.value += dt * s.gridSpeed;
    this.grid.visible = s.grid + s.mist > 0.01;
    this.grid.position.y = -5.5 * s.depth;

    this.crystalU.uAmt.value = s.crystals;
    this.crystals.visible = s.crystals > 0.01;
    if (this.crystals.visible) {
      this.crystalData.forEach((d, i) => {
        d.rot.y += dt * d.w;
        d.rot.x += dt * d.w * 0.5;
        this._q.setFromEuler(d.rot);
        const p = this._s.copy(d.p).multiplyScalar(s.depth);
        p.y += Math.sin(t * 0.4 + d.ph) * 0.6;
        this._m.compose(p, this._q, new THREE.Vector3(d.s, d.s, d.s));
        this.crystals.setMatrixAt(i, this._m);
      });
      this.crystals.instanceMatrix.needsUpdate = true;
    }
    this.forestU.uAmt.value = s.forest;
    this.forest.visible = s.forest > 0.01;
    this.forest.scale.setScalar(s.depth);
    this.dustU.uAmt.value = s.dust;
    this.dustU.uMode.value = s.dustMode;
    this.dustU.uProj.value = proj;
    this.dustU.uCol.value.copy(s.dustCol);
    this.dust.visible = s.dust > 0.01;
    this.dust.scale.setScalar(s.depth);
  }

  dispose() { this.disposables.forEach((d) => d.dispose && d.dispose()); }
}
