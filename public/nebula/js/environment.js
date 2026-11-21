import * as THREE from 'three';
import { NOISE } from './shaders/common.js';

const H = 4.6; // tunnel half-size (matches particle tunnel)
const FRAMES = 34;
const SPACING = 3.5;
const STREAKS = 160;
const RINGS = 6;

function mergeGeometries(list) {
  const pos = [], nor = [];
  for (const g0 of list) {
    const g = g0.index ? g0.toNonIndexed() : g0;
    pos.push(...g.attributes.position.array);
    nor.push(...g.attributes.normal.array);
  }
  const out = new THREE.BufferGeometry();
  out.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  out.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  return out;
}

function frameBarsGeometry() {
  const t = 0.07, d = 0.55;
  const parts = [];
  const top = new THREE.BoxGeometry(2 * H + t, t, d); top.translate(0, H, 0); parts.push(top);
  const bot = new THREE.BoxGeometry(2 * H + t, t, d); bot.translate(0, -H, 0); parts.push(bot);
  const lef = new THREE.BoxGeometry(t, 2 * H - t, d); lef.translate(-H, 0, 0); parts.push(lef);
  const rig = new THREE.BoxGeometry(t, 2 * H - t, d); rig.translate(H, 0, 0); parts.push(rig);
  return mergeGeometries(parts);
}

// Square ring panel with attribute aE: 0 at inner edge, 1 at outer edge.
function panelGeometry(inner = 0.74) {
  const pos = [], e = [], idx = [];
  const corners = [[1, 1], [-1, 1], [-1, -1], [1, -1]];
  for (let k = 0; k < 4; k++) {
    const [ax, ay] = corners[k];
    const [bx, by] = corners[(k + 1) % 4];
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

const FADE = /* glsl */ `
uniform float uNear;
float zFade(float z){ return smoothstep(-112.0, -60.0, z) * (1.0 - smoothstep(uNear - 7.0, uNear, z)); }
`;

export class Environment {
  constructor(scene, palette) {
    this.scene = scene;
    this.palette = palette;
    this.group = new THREE.Group();
    scene.add(this.group);
    this.offset = 0;
    this.rot = 0;
    this.pulse = 0;
    this._m = new THREE.Matrix4();
    this._q = new THREE.Quaternion();
    this._e = new THREE.Euler();
    this._v = new THREE.Vector3();
    this._s = new THREE.Vector3(1, 1, 1);
    this.disposables = [];
    // Environment colours (eased by main.js toward the palette or a studio scene)
    this.envA = palette.particle.clone();
    this.envB = palette.accent.clone();

    // ---- Background: deep space + faint nebula, drawn as a fullscreen tri
    this.bgUniforms = {
      uBg: { value: palette.bg }, uA: { value: this.envA }, uB: { value: this.envB },
      uTime: { value: 0 }, uYaw: { value: 0 }, uPitch: { value: 0 }, uAspect: { value: 1 }, uAmt: { value: 1 },
      uNebula: { value: 1 }, uStars: { value: 1 }, uAurora: { value: 0 }, uSpot: { value: 0 }, uHaze: { value: 0 }, uBright: { value: 1 },
    };
    const bgGeo = new THREE.BufferGeometry();
    bgGeo.setAttribute('position', new THREE.Float32BufferAttribute([-1, -1, 0, 3, -1, 0, -1, 3, 0], 3));
    const bg = new THREE.Mesh(bgGeo, new THREE.ShaderMaterial({
      uniforms: this.bgUniforms,
      vertexShader: `varying vec2 vUv; void main(){ vUv = position.xy*0.5+0.5; gl_Position = vec4(position.xy, 1.0, 1.0); }`,
      fragmentShader: /* glsl */ `
        ${NOISE}
        uniform vec3 uBg, uA, uB; uniform float uTime, uYaw, uPitch, uAspect, uAmt, uNebula, uStars, uAurora, uSpot, uHaze, uBright;
        varying vec2 vUv;
        float star(vec2 p, float dens){
          vec2 g = floor(p); vec2 f = fract(p) - 0.5;
          float h = fract(sin(dot(g, vec2(127.1, 311.7)))*43758.5453);
          if (h > dens) return 0.0;
          vec2 o = vec2(fract(h*13.7), fract(h*71.3)) - 0.5;
          float d = length(f - o*0.7);
          return smoothstep(0.08, 0.0, d) * (0.5 + 0.5*sin(uTime*(1.0+h*3.0) + h*40.0));
        }
        void main(){
          vec2 uv = vUv - 0.5; uv.x *= uAspect;
          vec2 p = uv + vec2(uYaw*0.35, -uPitch*0.35);
          float r = length(uv);
          float n1 = snoise(vec3(p*1.6, uTime*0.015))*0.5 + 0.5;
          float n2 = snoise(vec3(p*3.7 + 4.0, uTime*0.02))*0.5 + 0.5;
          float neb = pow(n1, 3.0) * 0.55 + pow(n2, 4.0) * 0.3;
          vec3 col = uBg + (mix(uA, uB, n2) * neb * 0.07 * uNebula * uBright) * (1.0 - smoothstep(0.2, 1.1, r));
          col += uBg * 2.5 * (1.0 - smoothstep(0.0, 0.8, r));
          float s = star(p*90.0, 0.08) + star(p*160.0 + 7.0, 0.1)*0.6 + star(p*240.0 + 3.0, 0.14)*0.4*step(1.2, uStars);
          col += vec3(0.85, 0.9, 1.0) * s * 0.55 * uStars;
          // sky aurora curtains
          if (uAurora > 0.001) {
            float y = uv.y + 0.15 - uPitch*0.3;
            float band = 0.0;
            for (int i = 0; i < 3; i++) {
              float fi = float(i);
              float w = sin(p.x*(2.0 + fi) + uTime*(0.12 + fi*0.05) + fi*2.0)*0.06 + snoise(vec3(p.x*1.5, fi, uTime*0.05))*0.05;
              float yy = y - (0.12 + fi*0.09) - w;
              band += exp(-yy*yy*90.0) * (0.6 + 0.4*sin(p.x*30.0 + uTime + fi)) + smoothstep(0.0, 0.25, yy)*exp(-yy*6.0)*0.25;
            }
            col += mix(uA, uB, smoothstep(0.0, 0.5, y)) * band * 0.18 * uAurora;
          }
          // floor spotlight (minimal showroom)
          col += vec3(1.0) * exp(-pow((uv.y + 0.32)*4.0, 2.0) - uv.x*uv.x*2.2) * 0.035 * uSpot;
          // haze / fog colour
          col = mix(col, mix(uA, uB, 0.5)*0.05 + uBg*1.5, uHaze*0.5*(1.0 - smoothstep(0.0, 0.9, r)));
          gl_FragColor = vec4(col, 1.0);
        }`,
      depthWrite: false, depthTest: false,
    }));
    bg.frustumCulled = false;
    bg.renderOrder = -100;
    scene.add(bg);
    this.bg = bg;
    this.disposables.push(bgGeo, bg.material);

    // ---- Tunnel frames (bars) + translucent panels -----------------------
    this.frameUniforms = {
      uColor: { value: this.envB }, uGlow: { value: palette.glow }, uBg: { value: palette.bg },
      uAlpha: { value: 1 }, uPulseZ: { value: 0 }, uTime: { value: 0 }, uBright: { value: 1 }, uNear: { value: 10 },
    };
    const barGeo = frameBarsGeometry();
    const barMat = new THREE.ShaderMaterial({
      uniforms: this.frameUniforms,
      vertexShader: /* glsl */ `
        varying vec3 vN; varying vec3 vV; varying float vZ;
        void main(){
          vec4 wp = instanceMatrix * vec4(position, 1.0);
          vZ = wp.z;
          vec4 mv = modelViewMatrix * wp;
          vN = normalize(normalMatrix * mat3(instanceMatrix) * normal);
          vV = -mv.xyz;
          gl_Position = projectionMatrix * mv;
        }`,
      fragmentShader: /* glsl */ `
        ${FADE}
        uniform vec3 uColor, uGlow; uniform float uAlpha, uPulseZ, uBright;
        varying vec3 vN; varying vec3 vV; varying float vZ;
        void main(){
          float f = abs(dot(normalize(vN), normalize(vV)));
          float pulse = exp(-pow((vZ - uPulseZ)/4.0, 2.0));
          vec3 c = mix(uColor, uGlow, 0.35 + 0.65*pulse) * (0.18 + 0.45*f + pulse*1.2);
          float a = zFade(vZ) * uAlpha * (0.55 + 0.45*f);
          gl_FragColor = vec4(c * uBright * a, a);
        }`,
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    });
    this.bars = new THREE.InstancedMesh(barGeo, barMat, FRAMES);
    this.bars.frustumCulled = false;
    this.bars.renderOrder = 2;
    this.group.add(this.bars);

    const panelGeo = panelGeometry(0.72);
    const panelMat = new THREE.ShaderMaterial({
      uniforms: this.frameUniforms,
      vertexShader: /* glsl */ `
        attribute float aE; varying float vE; varying float vZ; varying vec2 vP;
        void main(){
          vec4 wp = instanceMatrix * vec4(position, 1.0);
          vZ = wp.z; vE = aE; vP = position.xy;
          gl_Position = projectionMatrix * modelViewMatrix * wp;
        }`,
      fragmentShader: /* glsl */ `
        ${FADE}
        uniform vec3 uColor, uGlow, uBg; uniform float uAlpha, uPulseZ, uTime, uBright;
        varying float vE; varying float vZ; varying vec2 vP;
        void main(){
          float inner = 1.0 - smoothstep(0.0, 0.035, vE);
          float outer = smoothstep(0.965, 1.0, vE);
          float glass = 0.012 + 0.03*vE;
          float sheen = pow(0.5 + 0.5*sin((vP.x + vP.y)*0.35 - uTime*0.6 + vZ*0.1), 6.0) * 0.18;
          float pulse = exp(-pow((vZ - uPulseZ)/5.0, 2.0));
          vec3 c = mix(uColor*0.55 + vec3(0.12), uGlow, inner*0.6 + pulse*0.4) * (glass + inner*0.22 + outer*0.12 + sheen*0.3 + pulse*0.08);
          float a = zFade(vZ) * uAlpha;
          gl_FragColor = vec4(c * uBright * a, a);
        }`,
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
    });
    this.panels = new THREE.InstancedMesh(panelGeo, panelMat, FRAMES);
    this.panels.frustumCulled = false;
    this.panels.renderOrder = 1;
    this.group.add(this.panels);
    this.disposables.push(barGeo, barMat, panelGeo, panelMat);
    this.frameSeeds = Array.from({ length: FRAMES }, (_, i) => Math.sin(i * 12.9898) * 43758.5453 % 1);

    // ---- Light streaks shooting through the tunnel ----------------------
    this.streakUniforms = { uA: { value: this.envA }, uB: { value: palette.glow }, uAlpha: { value: 1 }, uNear: { value: 10 } };
    const sGeo = new THREE.BufferGeometry();
    sGeo.setAttribute('position', new THREE.Float32BufferAttribute([-0.5, 0, -0.5, 0.5, 0, -0.5, 0.5, 0, 0.5, -0.5, 0, 0.5], 3));
    sGeo.setAttribute('uv', new THREE.Float32BufferAttribute([0, 0, 1, 0, 1, 1, 0, 1], 2));
    sGeo.setIndex([0, 2, 1, 0, 3, 2]);
    const sMat = new THREE.ShaderMaterial({
      uniforms: this.streakUniforms,
      vertexShader: /* glsl */ `
        attribute float aHue; varying vec2 vUv; varying float vZ; varying float vHue;
        void main(){ vUv = uv; vHue = aHue; vec4 wp = instanceMatrix * vec4(position,1.0); vZ = wp.z; gl_Position = projectionMatrix * modelViewMatrix * wp; }`,
      fragmentShader: /* glsl */ `
        ${FADE}
        uniform vec3 uA, uB; uniform float uAlpha; varying vec2 vUv; varying float vZ; varying float vHue;
        void main(){
          float across = 1.0 - abs(vUv.x*2.0 - 1.0);
          float along = pow(vUv.y, 2.5);
          float a = across*across * along * zFade(vZ) * uAlpha;
          gl_FragColor = vec4(mix(uA, uB, vHue) * 2.2 * a, a);
        }`,
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
    });
    this.streaks = new THREE.InstancedMesh(sGeo, sMat, STREAKS);
    const hue = new Float32Array(STREAKS);
    this.streakData = [];
    for (let i = 0; i < STREAKS; i++) {
      const wall = Math.random() < 0.7;
      this.streakData.push({
        ang: Math.random() * Math.PI * 2,
        r: wall ? H * (0.8 + Math.random() * 0.18) : 0.4 + Math.random() * H * 0.7,
        z0: Math.random() * 130,
        speed: 0.6 + Math.random() * 1.2,
        len: 3 + Math.random() * 14,
        w: 0.02 + Math.random() * 0.06,
      });
      hue[i] = Math.random();
    }
    sGeo.setAttribute('aHue', new THREE.InstancedBufferAttribute(hue, 1));
    this.streaks.frustumCulled = false;
    this.streaks.renderOrder = 3;
    this.group.add(this.streaks);
    this.disposables.push(sGeo, sMat);

    // ---- Central light (vanishing point) with anamorphic flare ----------
    this.coreUniforms = { uColor: { value: palette.glow }, uTint: { value: palette.accent }, uI: { value: 1 }, uTime: { value: 0 } };
    const coreGeo = new THREE.PlaneGeometry(1, 1);
    this.core = new THREE.Mesh(coreGeo, new THREE.ShaderMaterial({
      uniforms: this.coreUniforms,
      vertexShader: `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
      fragmentShader: /* glsl */ `
        uniform vec3 uColor, uTint; uniform float uI, uTime; varying vec2 vUv;
        void main(){
          vec2 p = vUv*2.0 - 1.0; float r = length(p);
          float glow = exp(-r*9.0)*1.2 + exp(-r*3.5)*0.08 + exp(-r*r*500.0)*2.5;
          float ana = exp(-abs(p.y)*90.0) * exp(-abs(p.x)*2.2) * 0.9;
          float ver = exp(-abs(p.x)*140.0) * exp(-abs(p.y)*4.0) * 0.35;
          float ring = exp(-pow((r-0.42)*28.0, 2.0)) * 0.05;
          float rays = pow(0.5+0.5*sin(atan(p.y,p.x)*12.0 + uTime*0.2), 8.0) * exp(-r*4.0) * 0.25;
          vec3 c = uColor*(glow + ver + rays) + mix(uTint, uColor, 0.4)*(ana + ring);
          float a = clamp((glow + ana + ver + ring + rays) * uI, 0.0, 1.0);
          gl_FragColor = vec4(c*uI, a);
        }`,
      transparent: true, depthWrite: false, depthTest: false, blending: THREE.AdditiveBlending,
    }));
    this.core.position.set(0, 0, -48);
    this.core.scale.setScalar(46);
    this.core.renderOrder = 0;
    this.core.frustumCulled = false;
    scene.add(this.core);
    this.disposables.push(coreGeo, this.core.material);

    // ---- Expanding energy rings -----------------------------------------
    this.ringUniforms = [];
    this.rings = [];
    const ringGeo = new THREE.BufferGeometry();
    {
      const pos = [], e = [], idx = [];
      const seg = 160;
      for (let i = 0; i <= seg; i++) {
        const a = (i / seg) * Math.PI * 2;
        pos.push(Math.cos(a) * 0.9, Math.sin(a) * 0.9, 0, Math.cos(a), Math.sin(a), 0);
        e.push(0, 1);
        if (i < seg) { const b = i * 2; idx.push(b, b + 1, b + 2, b + 1, b + 3, b + 2); }
      }
      ringGeo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
      ringGeo.setAttribute('aE', new THREE.Float32BufferAttribute(e, 1));
      ringGeo.setIndex(idx);
    }
    for (let i = 0; i < RINGS; i++) {
      const u = { uColor: { value: i % 2 ? palette.accent : palette.glow }, uA: { value: 0 } };
      const m = new THREE.Mesh(ringGeo, new THREE.ShaderMaterial({
        uniforms: u,
        vertexShader: `attribute float aE; varying float vE; void main(){ vE = aE; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
        fragmentShader: `uniform vec3 uColor; uniform float uA; varying float vE; void main(){ float a = pow(sin(vE*3.14159), 2.0) * uA; gl_FragColor = vec4(uColor*2.0*a, a); }`,
        transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
      }));
      m.rotation.set((Math.random() - 0.5) * 1.6, (Math.random() - 0.5) * 1.6, Math.random() * 3);
      m.frustumCulled = false;
      m.renderOrder = 7;
      scene.add(m);
      this.rings.push(m);
      this.ringUniforms.push(u);
      this.disposables.push(m.material);
    }
    this.disposables.push(ringGeo);
  }

  randomizeRings() {
    for (const m of this.rings) m.rotation.set((Math.random() - 0.5) * 1.8, (Math.random() - 0.5) * 1.8, Math.random() * 3);
  }

  update(dt, t, d, { tunnelT, spin, twist, camera, spread, bass, light, lightPos, ringT }) {
    const f = d.tunnel;
    this.bars.visible = this.panels.visible = f > 0.01;
    this.frameUniforms.uAlpha.value = f;
    this.frameUniforms.uTime.value = t;
    this.frameUniforms.uBright.value = 0.8 + bass * 0.8;
    this.pulse = -112 + ((t * 26) % 130);
    this.frameUniforms.uPulseZ.value = this.pulse;

    if (this.bars.visible) {
      const off = (tunnelT * 16) % SPACING;
      const start = d.tunnelNear;
      this.frameUniforms.uNear.value = start + 2;
      this.streakUniforms.uNear.value = start + 2;
      for (let i = 0; i < FRAMES; i++) {
        const z = start - i * SPACING + off;
        const s = this.frameSeeds[i];
        const wob = 0.06 * (1 - d.tunnelSpeed * 0.7);
        this._e.set(Math.sin(t * 0.3 + i) * wob, Math.cos(t * 0.27 + i * 1.3) * wob, z * 0.012 * twist + spin + s * 0.02);
        this._q.setFromEuler(this._e);
        this._v.set(0, 0, z);
        this._s.setScalar(spread * (1 + bass * 0.04));
        this._m.compose(this._v, this._q, this._s);
        this.bars.setMatrixAt(i, this._m);
        this.panels.setMatrixAt(i, this._m);
      }
      this.bars.instanceMatrix.needsUpdate = true;
      this.panels.instanceMatrix.needsUpdate = true;
    }

    // Streaks
    const sf = d.streaks;
    this.streaks.visible = sf > 0.01;
    this.streakUniforms.uAlpha.value = sf;
    if (this.streaks.visible) {
      for (let i = 0; i < STREAKS; i++) {
        const s = this.streakData[i];
        const z = -112 + ((s.z0 + tunnelT * 16 * s.speed * 2.2) % 130);
        const a = s.ang + z * 0.012 * twist + spin;
        this._v.set(Math.cos(a) * s.r * spread, Math.sin(a) * s.r * spread, z);
        this._e.set(0, 0, a - Math.PI / 2);
        this._q.setFromEuler(this._e);
        this._s.set(s.w, 1, s.len * (0.4 + d.tunnelSpeed));
        this._m.compose(this._v, this._q, this._s);
        this.streaks.setMatrixAt(i, this._m);
      }
      this.streaks.instanceMatrix.needsUpdate = true;
    }

    // Central light
    this.core.position.copy(lightPos);
    this.core.quaternion.copy(camera.quaternion);
    this.coreUniforms.uI.value = d.core * light * (1 + bass * 0.7);
    this.coreUniforms.uTime.value = t;
    this.core.visible = this.coreUniforms.uI.value > 0.01;

    // Rings
    for (let i = 0; i < RINGS; i++) {
      const life = (ringT * 0.32 + i / RINGS) % 1;
      const m = this.rings[i];
      m.visible = d.rings > 0.01;
      m.scale.setScalar((0.5 + life * 24) * spread);
      m.rotation.z += dt * 0.1;
      this.ringUniforms[i].uA.value = d.rings * Math.pow(1 - life, 1.6) * Math.min(1, life * 12) * 0.6;
    }

    this.bgUniforms.uTime.value = t;
  }

  dispose() {
    this.disposables.forEach((d) => d.dispose && d.dispose());
  }
}
