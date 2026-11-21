import * as THREE from 'three';

// The butterfly's space: nested specimen frames, the vanishing light, wall
// striations, the butterfly gallery, the glass slab and drifting dust.
// Every layer exposes an opacity the film timeline drives.

const H = 4.2;          // frame half-size
const FRAMES = 24;
const SPACING = 2.3;

const additive = { transparent: true, depthWrite: false, blending: THREE.AdditiveBlending };

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

// Silhouette atlas: [front view, perched side view] drawn once on a canvas.
function silhouetteTexture() {
  const c = document.createElement('canvas');
  c.width = 512; c.height = 256;
  const g = c.getContext('2d');
  g.fillStyle = '#fff';
  g.shadowColor = '#fff';
  g.shadowBlur = 6;
  // front view (cell 0)
  g.save();
  g.translate(128, 132);
  for (const s of [-1, 1]) {
    g.beginPath();
    g.moveTo(0, -6);
    g.bezierCurveTo(s * 30, -70, s * 112, -96, s * 104, -46);
    g.bezierCurveTo(s * 100, -18, s * 50, -8, s * 12, 2);
    g.bezierCurveTo(s * 70, 10, s * 88, 52, s * 56, 76);
    g.bezierCurveTo(s * 34, 92, s * 10, 54, 0, 18);
    g.closePath();
    g.fill();
  }
  g.fillRect(-3, -24, 6, 70);
  g.restore();
  // perched side view, wings closed up (cell 1)
  g.save();
  g.translate(384, 150);
  g.beginPath();
  g.moveTo(-8, 30);
  g.bezierCurveTo(-46, -20, -40, -96, -18, -110);
  g.bezierCurveTo(4, -96, 18, -36, 10, 24);
  g.closePath();
  g.fill();
  g.beginPath();
  g.moveTo(4, 30);
  g.bezierCurveTo(30, -10, 64, -60, 52, -92);
  g.bezierCurveTo(30, -70, 12, -20, 0, 24);
  g.closePath();
  g.globalAlpha = 0.7;
  g.fill();
  g.globalAlpha = 1;
  g.fillRect(-26, 28, 60, 7);
  g.restore();
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}

export class Stage {
  constructor(scene, colors) {
    this.scene = scene;
    this.colors = colors; // { warm, cool, glow } THREE.Color
    this.disposables = [];
    this.opacity = { frames: 1, lines: 0, gallery: 0, slab: 0, core: 1, dust: 1, bg: 1 };
    const keep = (...xs) => { this.disposables.push(...xs); return xs[0]; };

    // ---- Background: warm-black with a soft breathing centre ------------
    this.bgU = { uWarm: { value: colors.warm }, uAmt: { value: 1 }, uTime: { value: 0 }, uAspect: { value: 1 } };
    const bgGeo = keep(new THREE.BufferGeometry());
    bgGeo.setAttribute('position', new THREE.Float32BufferAttribute([-1, -1, 0, 3, -1, 0, -1, 3, 0], 3));
    const bg = new THREE.Mesh(bgGeo, keep(new THREE.ShaderMaterial({
      uniforms: this.bgU,
      vertexShader: 'varying vec2 vUv; void main(){ vUv = position.xy*0.5+0.5; gl_Position = vec4(position.xy, 1.0, 1.0); }',
      fragmentShader: `uniform vec3 uWarm; uniform float uAmt, uTime, uAspect; varying vec2 vUv;
        void main(){
          vec2 p = (vUv - 0.5) * vec2(uAspect, 1.0);
          float r = length(p);
          vec3 c = vec3(0.012, 0.011, 0.012) + uWarm * 0.035 * exp(-r*r*3.0) * (0.85 + 0.15*sin(uTime*0.4)) * uAmt;
          gl_FragColor = vec4(c, 1.0);
        }`,
      depthWrite: false, depthTest: false,
    })));
    bg.frustumCulled = false;
    bg.renderOrder = -100;
    scene.add(bg);

    // ---- Nested specimen frames ------------------------------------------
    this.frameU = { uA: { value: 1 }, uWarm: { value: colors.warm }, uGlow: { value: colors.glow }, uTime: { value: 0 }, uNear: { value: 3 } };
    const fade = `uniform float uNear; float zf(float z){ return smoothstep(-58.0, -30.0, z) * (1.0 - smoothstep(uNear - 6.0, uNear, z)); }`;
    const panelGeo = keep(squareRing(0.66));
    this.panels = new THREE.InstancedMesh(panelGeo, keep(new THREE.ShaderMaterial({
      uniforms: this.frameU,
      vertexShader: `attribute float aE; varying float vE; varying float vZ;
        void main(){ vec4 w = instanceMatrix*vec4(position,1.0); vZ = w.z; vE = aE; gl_Position = projectionMatrix*modelViewMatrix*w; }`,
      fragmentShader: `${fade}
        uniform vec3 uWarm, uGlow; uniform float uA; varying float vE; varying float vZ;
        void main(){
          float inner = 1.0 - smoothstep(0.0, 0.05, vE);
          float outer = smoothstep(0.93, 1.0, vE);
          float body = 0.022 + 0.035*vE;
          float depth = smoothstep(-55.0, -5.0, vZ);
          vec3 c = mix(vec3(0.75), uWarm, 0.25) * (body + inner*0.09 + outer*0.05) * (0.45 + 0.55*depth);
          float a = zf(vZ) * uA;
          gl_FragColor = vec4(c*a, a);
        }`,
      side: THREE.DoubleSide, ...additive,
    })), FRAMES);
    this.panels.frustumCulled = false;
    this.panels.renderOrder = 1;
    scene.add(this.panels);
    // thin bright inner edges (the "glass" lip of each frame)
    const edgeGeo = keep(squareRing(0.985));
    this.edges = new THREE.InstancedMesh(edgeGeo, keep(new THREE.ShaderMaterial({
      uniforms: this.frameU,
      vertexShader: `varying float vZ; void main(){ vec4 w = instanceMatrix*vec4(position*vec3(0.66,0.66,1.0),1.0); vZ = w.z; gl_Position = projectionMatrix*modelViewMatrix*w; }`,
      fragmentShader: `${fade} uniform vec3 uGlow; uniform float uA; varying float vZ;
        void main(){ float a = zf(vZ)*uA*0.22; gl_FragColor = vec4(uGlow*a, a); }`,
      side: THREE.DoubleSide, ...additive,
    })), FRAMES);
    this.edges.frustumCulled = false;
    this.edges.renderOrder = 1;
    scene.add(this.edges);
    this.frameSeed = Array.from({ length: FRAMES }, (_, i) => (Math.sin(i * 12.9898) * 43758.5453) % 1);

    // ---- Wall striations: thin lines running down the corridor ----------
    const LN = 420;
    const lineGeo = keep(new THREE.BufferGeometry());
    lineGeo.setAttribute('position', new THREE.Float32BufferAttribute([-0.5, 0, -0.5, 0.5, 0, -0.5, 0.5, 0, 0.5, -0.5, 0, 0.5], 3));
    lineGeo.setAttribute('uv', new THREE.Float32BufferAttribute([0, 0, 1, 0, 1, 1, 0, 1], 2));
    lineGeo.setIndex([0, 2, 1, 0, 3, 2]);
    this.lineU = { uA: { value: 0 }, uWarm: { value: colors.warm }, uTime: { value: 0 }, uFlow: { value: 0 } };
    this.lines = new THREE.InstancedMesh(lineGeo, keep(new THREE.ShaderMaterial({
      uniforms: this.lineU,
      vertexShader: `varying vec2 vUv; varying float vZ; varying float vS;
        void main(){ vUv = uv; vec4 w = instanceMatrix*vec4(position,1.0); vZ = w.z; vS = fract(instanceMatrix[3].x*3.1 + instanceMatrix[3].y*7.7); gl_Position = projectionMatrix*modelViewMatrix*w; }`,
      fragmentShader: `uniform vec3 uWarm; uniform float uA, uTime, uFlow; varying vec2 vUv; varying float vZ; varying float vS;
        void main(){
          float across = 1.0 - abs(vUv.x*2.0 - 1.0);
          float beads = 0.55 + 0.45*sin(vZ*1.7 + vS*40.0 - uTime*uFlow);
          float z = smoothstep(-70.0, -20.0, vZ) * (1.0 - smoothstep(-2.0, 8.0, vZ));
          float a = across*across * beads * z * uA * (0.35 + 0.65*vS);
          gl_FragColor = vec4(mix(vec3(0.9), uWarm, 0.3) * a * 0.9, a);
        }`,
      side: THREE.DoubleSide, ...additive,
    })), LN);
    {
      const m = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), p = new THREE.Vector3(), s = new THREE.Vector3();
      for (let i = 0; i < LN; i++) {
        const side = i % 4;
        const t = (Math.random() * 2 - 1) * 0.98;
        const r = H * (1.0 + Math.random() * 1.6);
        const x = side === 0 ? t * r : side === 1 ? r : side === 2 ? t * r : -r;
        const y = side === 0 ? r : side === 1 ? t * r : side === 2 ? -r : t * r;
        const ang = Math.atan2(y, x);
        p.set(x, y, -30 + (Math.random() - 0.5) * 20);
        e.set(0, 0, ang - Math.PI / 2);
        q.setFromEuler(e);
        s.set(0.015 + Math.random() * 0.05, 1, 40 + Math.random() * 40);
        m.compose(p, q, s);
        this.lines.setMatrixAt(i, m);
      }
    }
    this.lines.frustumCulled = false;
    this.lines.renderOrder = 2;
    scene.add(this.lines);

    // ---- The vanishing light: soft core + cross flare --------------------
    this.coreU = { uI: { value: 1 }, uGlow: { value: colors.glow }, uWarm: { value: colors.warm }, uCross: { value: 1 }, uTime: { value: 0 } };
    const coreGeo = keep(new THREE.PlaneGeometry(1, 1));
    this.core = new THREE.Mesh(coreGeo, keep(new THREE.ShaderMaterial({
      uniforms: this.coreU,
      vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.0); }',
      fragmentShader: `uniform vec3 uGlow, uWarm; uniform float uI, uCross, uTime; varying vec2 vUv;
        void main(){
          vec2 p = vUv*2.0 - 1.0; float r = length(p);
          float core = exp(-r*r*900.0)*2.2 + exp(-r*12.0)*0.9 + exp(-r*3.8)*0.12;
          float hx = exp(-abs(p.y)*110.0) * exp(-abs(p.x)*2.6);
          float vy = exp(-abs(p.x)*110.0) * exp(-abs(p.y)*2.6);
          float d1 = exp(-abs(p.x - p.y)*160.0) * exp(-r*7.0) * 0.25;
          float d2 = exp(-abs(p.x + p.y)*160.0) * exp(-r*7.0) * 0.25;
          float rays = pow(max(0.0, 0.5 + 0.5*sin(atan(p.y, p.x)*16.0 + uTime*0.05)), 12.0) * exp(-r*5.0) * 0.12;
          float cross = (hx + vy) * 0.75 * uCross + (d1 + d2) * uCross;
          vec3 c = uGlow*(core + rays) + mix(uWarm, uGlow, 0.5)*cross;
          float a = clamp((core + cross + rays) * uI, 0.0, 1.0);
          gl_FragColor = vec4(c*uI, a);
        }`,
      depthWrite: false, depthTest: false, transparent: true, blending: THREE.AdditiveBlending,
    })));
    this.core.frustumCulled = false;
    this.core.renderOrder = 0;
    this.core.scale.setScalar(44);
    this.core.position.set(0, 0, -45);
    scene.add(this.core);

    // ---- Butterfly gallery: corridor walls of silhouettes ---------------
    const GN = 4200;
    this.silTex = keep(silhouetteTexture());
    const sGeo = keep(new THREE.PlaneGeometry(1, 1));
    const cell = new Float32Array(GN);
    this.galleryU = { uA: { value: 0 }, uTex: { value: this.silTex }, uWarm: { value: colors.warm }, uScroll: { value: 0 }, uTime: { value: 0 } };
    this.gallery = new THREE.InstancedMesh(sGeo, keep(new THREE.ShaderMaterial({
      uniforms: this.galleryU,
      vertexShader: `attribute float aCell; uniform float uScroll; varying vec2 vUv; varying float vZ; varying float vSeed;
        void main(){
          vUv = vec2((uv.x + aCell)*0.5, uv.y);
          vec4 w = instanceMatrix*vec4(position,1.0);
          w.z = mod(w.z + uScroll + 140.0, 150.0) - 140.0;
          vZ = w.z; vSeed = fract(instanceMatrix[3].x*13.7 + instanceMatrix[3].y*3.3);
          gl_Position = projectionMatrix*modelViewMatrix*w;
        }`,
      fragmentShader: `uniform sampler2D uTex; uniform vec3 uWarm; uniform float uA, uTime; varying vec2 vUv; varying float vZ; varying float vSeed;
        void main(){
          float t = texture2D(uTex, vUv).a;
          if (t < 0.02) discard;
          float z = smoothstep(-120.0, -25.0, vZ) * (1.0 - smoothstep(4.0, 10.0, vZ));
          float flick = 0.75 + 0.25*sin(uTime*(0.5 + vSeed) + vSeed*30.0);
          float a = t * z * uA * (0.12 + 0.26*vSeed) * flick;
          gl_FragColor = vec4(mix(vec3(0.85), uWarm, 0.4) * a, a);
        }`,
      side: THREE.DoubleSide, ...additive,
    })), GN);
    {
      const m = new THREE.Matrix4(), q = new THREE.Quaternion(), p = new THREE.Vector3(), s = new THREE.Vector3();
      const W = 6, Hh = 3.6;
      for (let i = 0; i < GN; i++) {
        const wall = i % 4; // 0 floor, 1 ceiling, 2 left, 3 right
        const z = -140 + Math.random() * 150;
        const u = (Math.random() * 2 - 1);
        if (wall === 0) p.set(u * W * 1.4, -Hh, z);
        else if (wall === 1) p.set(u * W * 1.4, Hh, z);
        else p.set(wall === 2 ? -W : W, u * Hh * 1.3, z);
        const sc = 0.35 + Math.pow(Math.random(), 3) * 1.4;
        q.identity();
        if (wall === 1) q.setFromAxisAngle(new THREE.Vector3(0, 0, 1), Math.PI); // hanging upside down
        s.set(sc, sc, sc);
        m.compose(p, q, s);
        this.gallery.setMatrixAt(i, m);
        cell[i] = Math.random() < 0.7 ? 1 : 0;
      }
    }
    sGeo.setAttribute('aCell', new THREE.InstancedBufferAttribute(cell, 1));
    this.gallery.frustumCulled = false;
    this.gallery.renderOrder = 2;
    scene.add(this.gallery);

    // ---- Glass slab + specimen box for the resting shot -----------------
    this.slab = new THREE.Group();
    scene.add(this.slab);
    this.glassU = { uA: { value: 0 }, uGlow: { value: colors.glow }, uWarm: { value: colors.warm } };
    const glassMat = keep(new THREE.ShaderMaterial({
      uniforms: this.glassU,
      vertexShader: 'varying vec3 vN; varying vec3 vV; varying vec3 vP; void main(){ vec4 mv = modelViewMatrix*vec4(position,1.0); vN = normalize(normalMatrix*normal); vV = -mv.xyz; vP = position; gl_Position = projectionMatrix*mv; }',
      fragmentShader: `uniform vec3 uGlow, uWarm; uniform float uA; varying vec3 vN; varying vec3 vV; varying vec3 vP;
        void main(){
          float f = pow(1.0 - abs(dot(normalize(vN), normalize(vV))), 2.5);
          float sheen = 0.5 + 0.5*sin(vP.x*1.6 + vP.z*0.8);
          vec3 c = mix(uWarm, uGlow, 0.5) * (0.07 + f*0.5 + sheen*0.04);
          float a = (0.16 + f*0.45) * uA;
          gl_FragColor = vec4(c*a, a);
        }`,
      ...additive, side: THREE.DoubleSide,
    }));
    const slabGeo = keep(new THREE.BoxGeometry(5.2, 0.16, 1.9));
    this.slabMesh = new THREE.Mesh(slabGeo, glassMat);
    this.slab.add(this.slabMesh);
    const edgeMat = keep(new THREE.LineBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false }));
    this.slabEdgeMat = edgeMat;
    const slabEdges = new THREE.LineSegments(keep(new THREE.EdgesGeometry(slabGeo)), edgeMat);
    this.slab.add(slabEdges);
    // specimen box (the frame that the butterfly sat in, now open)
    const boxGeo = keep(new THREE.BoxGeometry(3.0, 3.0, 0.18));
    this.box = new THREE.Mesh(boxGeo, glassMat);
    this.box.position.set(-0.6, 1.55, -1.6);
    this.box.rotation.x = -0.08;
    this.box.visible = false; // kept for reference: the open specimen box
    const boxEdges = new THREE.LineSegments(keep(new THREE.EdgesGeometry(boxGeo)), edgeMat);
    boxEdges.position.copy(this.box.position);
    boxEdges.rotation.copy(this.box.rotation);

    this.slab.visible = false;

    // ---- Dust: drifting motes + the single pollen star from the film ----
    const DN = 1400;
    const dpos = new Float32Array(DN * 3), dseed = new Float32Array(DN);
    for (let i = 0; i < DN; i++) {
      dpos[i * 3] = (Math.random() - 0.5) * 26;
      dpos[i * 3 + 1] = (Math.random() - 0.5) * 15;
      dpos[i * 3 + 2] = -Math.random() * 40 + 6;
      dseed[i] = Math.random();
    }
    const dGeo = keep(new THREE.BufferGeometry());
    dGeo.setAttribute('position', new THREE.BufferAttribute(dpos, 3));
    dGeo.setAttribute('aSeed', new THREE.BufferAttribute(dseed, 1));
    dGeo.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 1e4);
    this.dustU = { uA: { value: 1 }, uTime: { value: 0 }, uProj: { value: 600 }, uGlow: { value: colors.glow } };
    this.dust = new THREE.Points(dGeo, keep(new THREE.ShaderMaterial({
      uniforms: this.dustU,
      vertexShader: `attribute float aSeed; uniform float uTime, uProj; varying float vA;
        void main(){
          vec3 p = position;
          p.y += sin(uTime*0.13 + aSeed*40.0)*0.6 + uTime*0.05*(aSeed - 0.5);
          p.x += cos(uTime*0.11 + aSeed*20.0)*0.5;
          p.y = mod(p.y + 7.5, 15.0) - 7.5;
          vec4 mv = modelViewMatrix*vec4(p,1.0);
          gl_Position = projectionMatrix*mv;
          float d = max(-mv.z, 0.3);
          vA = (0.25 + 0.75*pow(0.5 + 0.5*sin(uTime*(0.4 + aSeed) + aSeed*90.0), 4.0)) * smoothstep(0.5, 3.0, d);
          gl_PointSize = clamp((0.012 + aSeed*0.02) * uProj / d, 1.0, 10.0);
        }`,
      fragmentShader: `uniform vec3 uGlow; uniform float uA; varying float vA;
        void main(){ vec2 c = gl_PointCoord*2.0-1.0; float d = dot(c,c); if (d>1.0) discard;
          float a = exp(-d*4.0)*vA*uA*0.55; gl_FragColor = vec4(uGlow*a, a); }`,
      ...additive,
    })));
    this.dust.frustumCulled = false;
    this.dust.renderOrder = 9;
    scene.add(this.dust);

    // ---- Sparks: released from the wings when the butterfly is touched --
    const SN = 600;
    this.sp = { n: SN, head: 0, pos: new Float32Array(SN * 3), vel: new Float32Array(SN * 3), life: new Float32Array(SN) };
    const spGeo = keep(new THREE.BufferGeometry());
    this.spPos = new THREE.BufferAttribute(this.sp.pos, 3).setUsage(THREE.DynamicDrawUsage);
    this.spLife = new THREE.BufferAttribute(this.sp.life, 1).setUsage(THREE.DynamicDrawUsage);
    spGeo.setAttribute('position', this.spPos);
    spGeo.setAttribute('aLife', this.spLife);
    spGeo.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 1e4);
    this.sparks = new THREE.Points(spGeo, keep(new THREE.ShaderMaterial({
      uniforms: { uProj: this.dustU.uProj, uGlow: { value: colors.glow }, uWarm: { value: colors.warm } },
      vertexShader: `attribute float aLife; uniform float uProj; varying float vL;
        void main(){ vL = aLife; vec4 mv = modelViewMatrix*vec4(position,1.0); gl_Position = projectionMatrix*mv;
          gl_PointSize = aLife <= 0.0 ? 0.0 : clamp(0.05*(0.3 + aLife)*uProj/max(-mv.z,0.3), 1.0, 18.0); }`,
      fragmentShader: `uniform vec3 uGlow, uWarm; varying float vL;
        void main(){ vec2 c = gl_PointCoord*2.0-1.0; float d = dot(c,c); if (d>1.0 || vL<=0.0) discard;
          float a = (exp(-d*5.0) + exp(-d*30.0))*vL; gl_FragColor = vec4(mix(uWarm, uGlow, vL)*1.6*a, a); }`,
      ...additive,
    })));
    this.sparks.frustumCulled = false;
    this.sparks.renderOrder = 10;
    scene.add(this.sparks);

    this._m = new THREE.Matrix4();
    this._q = new THREE.Quaternion();
    this._e = new THREE.Euler();
    this._p = new THREE.Vector3();
    this._s = new THREE.Vector3();
  }

  burst(origin, n = 90) {
    const sp = this.sp;
    for (let k = 0; k < n; k++) {
      const i = sp.head;
      sp.head = (sp.head + 1) % sp.n;
      const u = Math.random() * Math.PI * 2, v = Math.acos(2 * Math.random() - 1), sp0 = 0.6 + Math.random() * 1.8;
      sp.pos[i * 3] = origin.x + (Math.random() - 0.5) * 0.6;
      sp.pos[i * 3 + 1] = origin.y + (Math.random() - 0.5) * 0.4;
      sp.pos[i * 3 + 2] = origin.z + (Math.random() - 0.5) * 0.3;
      sp.vel[i * 3] = Math.sin(v) * Math.cos(u) * sp0;
      sp.vel[i * 3 + 1] = Math.cos(v) * sp0 * 0.7 + 0.3;
      sp.vel[i * 3 + 2] = Math.sin(v) * Math.sin(u) * sp0;
      sp.life[i] = 0.7 + Math.random() * 0.3;
    }
    this._sparkActive = true;
  }

  update(dt, t, o, camera, proj) {
    const A = this.opacity;
    this.bgU.uTime.value = t;
    this.bgU.uAmt.value = A.bg;
    // frames: slow breathing drift, each frame turning a little on its own
    this.frameU.uA.value = A.frames;
    this.frameU.uTime.value = t;
    this.frameU.uNear.value = o.frameNear;
    const vis = A.frames > 0.005;
    this.panels.visible = this.edges.visible = vis;
    if (vis) {
      const off = (o.frameTravel) % SPACING;
      for (let i = 0; i < FRAMES; i++) {
        const z = o.frameNear - 1 - i * SPACING + off;
        const s = this.frameSeed[i];
        this._e.set(Math.sin(t * 0.21 + i * 0.7) * 0.025 * o.wobble, Math.cos(t * 0.17 + i) * 0.025 * o.wobble, o.twist * (z * 0.01) + s * 0.015 * o.wobble);
        this._q.setFromEuler(this._e);
        this._p.set(0, 0, z);
        this._m.compose(this._p, this._q, this._s.setScalar(1));
        this.panels.setMatrixAt(i, this._m);
        this.edges.setMatrixAt(i, this._m);
      }
      this.panels.instanceMatrix.needsUpdate = true;
      this.edges.instanceMatrix.needsUpdate = true;
    }
    this.lineU.uA.value = A.lines;
    this.lineU.uTime.value = t;
    this.lineU.uFlow.value = o.lineFlow;
    this.lines.visible = A.lines > 0.005;

    this.coreU.uI.value = A.core;
    this.coreU.uCross.value = o.cross;
    this.coreU.uTime.value = t;
    this.core.visible = A.core > 0.005;
    this.core.position.copy(o.lightPos);
    this.core.quaternion.copy(camera.quaternion);
    this.core.scale.setScalar(o.coreSize);

    this.galleryU.uA.value = A.gallery;
    this.galleryU.uTime.value = t;
    this.galleryU.uScroll.value = o.galleryScroll;
    this.gallery.visible = A.gallery > 0.005;

    this.glassU.uA.value = A.slab;
    this.slabEdgeMat.opacity = A.slab * 0.1;
    this.slab.visible = A.slab > 0.005;

    this.dustU.uA.value = A.dust;
    this.dustU.uTime.value = t;
    this.dustU.uProj.value = proj;

    if (this._sparkActive) {
      const sp = this.sp;
      let any = false;
      for (let i = 0; i < sp.n; i++) {
        if (sp.life[i] <= 0) continue;
        any = true;
        sp.life[i] -= dt * 0.7;
        sp.vel[i * 3 + 1] -= dt * 0.25;
        for (let k = 0; k < 3; k++) { sp.pos[i * 3 + k] += sp.vel[i * 3 + k] * dt; sp.vel[i * 3 + k] *= 0.985; }
      }
      this.spPos.needsUpdate = true;
      this.spLife.needsUpdate = true;
      this._sparkActive = any;
    }
  }

  dispose() { this.disposables.forEach((d) => d.dispose && d.dispose()); }
}
