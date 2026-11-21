import * as THREE from 'three';
import { Butterfly } from './butterfly.js';
import { Stage } from './stage.js';
import { PostFX } from './postfx.js';

// ---------------------------------------------------------------------------
// A real-time, endlessly looping film of one butterfly in its space,
// following the reference video shot by shot:
//   1 specimen frames · 2 echo corridor · 3 return · 4 gallery · 5 glass rest
// ---------------------------------------------------------------------------

const V = (x, y, z) => new THREE.Vector3(x, y, z);
const sm = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
const easeIO = (x) => (x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2);
const lerpV = (a, b, t, out) => out.copy(a).lerp(b, t);

const COLORS = {
  warm: new THREE.Color('#f1e2c6'),
  glow: new THREE.Color('#fff7ea'),
  body: new THREE.Color('#fff2d8'),
  accent: new THREE.Color('#e9dcc4'),
};

// Orientation helper: body axis (+Y) along `head`, back (+Z) along `back`.
const _bx = new THREE.Vector3(), _by = new THREE.Vector3(), _bz = new THREE.Vector3(), _bm = new THREE.Matrix4();
function basisQuat(head, back, out) {
  _by.copy(head).normalize();
  _bz.copy(back).sub(_bx.copy(_by).multiplyScalar(back.dot(_by))).normalize();
  _bx.crossVectors(_by, _bz).normalize();
  _bm.makeBasis(_bx, _by, _bz);
  return out.setFromRotationMatrix(_bm);
}

// Shot table. Each shot fills `s` (the frame state) for its local time u ∈ [0,1].
const SHOTS = [
  {
    name: 'SPECIMEN', dur: 7,
    fill(s, u, t) {
      lerpV(V(0, 0.05, 8.8), V(0, 0.15, 7.4), easeIO(u), s.cam);
      s.look.set(0, 0.1, -8);
      s.bpos.set(Math.sin(t * 0.5) * 0.08, 0.28 + Math.sin(t * 0.9) * 0.06, 0);
      s.bEuler.set(-0.12 + Math.sin(t * 0.33) * 0.06, Math.sin(t * 0.41) * 0.16, Math.sin(t * 0.27) * 0.04);
      s.bScale = 0.62; s.flap = 0.55; s.amp = 0.55; s.base = 0.18;
      s.echo = 0; s.echoSpread = 0.2;
      Object.assign(s.op, { frames: 1, lines: 0, gallery: 0, slab: 0, core: 0.95, dust: 0.8, bg: 1 });
      s.lightPos.set(0, 0, -45); s.cross = 0.3; s.coreSize = 38;
      s.frameNear = 4; s.frameTravel = t * 0.12; s.twist = 0; s.wobble = 1; s.lineFlow = 0;
      s.rays = 0.55; s.fg = 0;
    },
  },
  {
    name: 'ECHO', dur: 7,
    fill(s, u, t) {
      lerpV(V(3.6, 0.7, 7.6), V(2.4, 0.45, 6.4), easeIO(u), s.cam);
      s.look.set(-1.2, 0, -12);
      lerpV(V(-3.9, -0.55, 2.2), V(-2.7, -0.3, 1.3), easeIO(u), s.bpos);
      s.bEuler.set(-0.3, 0.5 + Math.sin(t * 0.5) * 0.08, 0.18);
      s.bScale = 0.55; s.flap = 0.95; s.amp = 0.6; s.base = 0.18;
      s.echo = 1; s.echoSpread = 1; s.echoToLight = true;
      Object.assign(s.op, { frames: 0.5, lines: 0.55, gallery: 0, slab: 0, core: 1.2, dust: 0.5, bg: 0.6 });
      s.lightPos.set(0.6, 0, -45); s.cross = 1.15; s.coreSize = 70;
      s.frameNear = 1.5; s.frameTravel = t * 0.4; s.twist = 0; s.wobble = 0.4; s.lineFlow = 4;
      s.rays = 1.35; s.fg = 0;
    },
  },
  {
    name: 'RETURN', dur: 7,
    fill(s, u, t) {
      lerpV(V(0, -0.1, 9.4), V(0, 0.05, 8.2), easeIO(u), s.cam);
      s.look.set(0, 0, -8);
      lerpV(V(-1.7, 0.45, 0.6), V(0.35, 0.15, 0), easeIO(u), s.bpos);
      s.bEuler.set(-0.25, 0.35 - u * 0.5, 0.1);
      s.bScale = 0.45; s.flap = 0.8; s.amp = 0.55; s.base = 0.18;
      s.echo = 0.35; s.echoSpread = 0.35; s.echoToLight = false; s.echoStep = 1.0;
      Object.assign(s.op, { frames: 1, lines: 0, gallery: 0, slab: 0, core: 1.05, dust: 0.9, bg: 1 });
      s.lightPos.set(0.3, 0, -45); s.cross = 0.55; s.coreSize = 42;
      s.frameNear = 4.5; s.frameTravel = t * 0.9; s.twist = 0.15; s.wobble = 1; s.lineFlow = 0;
      s.rays = 0.75; s.fg = 1;
    },
  },
  {
    name: 'GALLERY', dur: 7,
    fill(s, u, t) {
      lerpV(V(0.4, 0.35, 8.4), V(-0.2, 0.2, 7.4), easeIO(u), s.cam);
      s.look.set(1.8, 0, -30);
      lerpV(V(-4.6, -0.75, 1.8), V(-3.9, -0.6, 1.4), easeIO(u), s.bpos);
      s.bEuler.set(-0.35, 0.45, 0.12);
      s.bScale = 0.6; s.flap = 0.9; s.amp = 0.58; s.base = 0.18;
      s.echo = 1; s.echoSpread = 1; s.echoToLight = true;
      Object.assign(s.op, { frames: 0, lines: 0.15, gallery: 1, slab: 0, core: 1.0, dust: 0.6, bg: 0.8 });
      s.lightPos.set(3.4, -0.2, -55); s.cross = 0.7; s.coreSize = 46;
      s.frameNear = 4; s.frameTravel = 0; s.twist = 0; s.wobble = 1; s.lineFlow = 1;
      s.rays = 1.0; s.fg = 0;
    },
  },
  {
    name: 'REST', dur: 9,
    fill(s, u, t, scene) {
      lerpV(V(0.6, 0.95, 7.0), V(-0.4, 0.75, 6.3), easeIO(u), s.cam);
      s.look.set(0.9, 0.35, 0);
      // the slab turns slowly in space; the butterfly rests on it
      const yaw = -0.35 + Math.sin(t * 0.22) * 0.55 + u * 0.4;
      const roll = Math.sin(t * 0.17) * 0.12;
      scene.slab.rotation.set(roll * 0.5, yaw, roll);
      scene.slab.position.set(0, -0.35, 0);
      scene.slab.updateMatrixWorld(true);
      s.bpos.set(-0.25, 0.48, 0.15).applyMatrix4(scene.slab.matrixWorld);
      const head = V(-1, 0.08, 0).applyQuaternion(scene.slab.quaternion);
      const back = V(0, 1, 0).applyQuaternion(scene.slab.quaternion);
      s.bQuat = basisQuat(head, back, s.bQuatStore);
      s.bScale = 0.62; s.flap = 0.3;
      // resting: wings mostly closed, opening slowly now and then
      const open = sm(0.72, 1.0, Math.sin(t * 0.5) * 0.5 + 0.5);
      s.base = 1.32 - open * 0.42; s.amp = 0.1 + open * 0.08;
      s.echo = 0.55; s.echoSpread = 0.25; s.echoToLight = false; s.echoStep = 0.5;
      s.echoDir.set(1, 0.02, -0.35).normalize();
      Object.assign(s.op, { frames: 0, lines: 0, gallery: 0, slab: 1, core: 0.45, dust: 0.45, bg: 0.25 });
      s.lightPos.set(4.2, 0.5, -3); s.cross = 0.45; s.coreSize = 7;
      s.frameNear = 4; s.frameTravel = 0; s.twist = 0; s.wobble = 1; s.lineFlow = 0;
      s.rays = 0.6; s.fg = 0;
    },
  },
];
const TOTAL = SHOTS.reduce((a, s) => a + s.dur, 0);
const FADE = 0.42; // seconds of dip-to-black on each side of a cut

class Film {
  constructor() {
    this.canvas = document.getElementById('stage');
  }

  init() {
    const renderer = new THREE.WebGLRenderer({ canvas: this.canvas, antialias: false, powerPreference: 'high-performance', stencil: false });
    if (!renderer.capabilities.isWebGL2) throw new Error('当前设备不支持 WebGL 2');
    this.renderer = renderer;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.canvas.addEventListener('webglcontextlost', (e) => { e.preventDefault(); this.lost = true; });
    this.canvas.addEventListener('webglcontextrestored', () => location.reload());

    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(40, innerWidth / innerHeight, 0.1, 300);

    this.stage = new Stage(this.scene, COLORS);
    this.bfly = new Butterfly(this.scene, COLORS);
    const U = this.bfly.uniforms;
    U.uPattern.value = 8; // pale glitter, like the film's moth
    U.uMat.value = 0;
    U.uGlowAmt.value = 0.85;
    U.uSpec.value = 0.12;

    // Large out-of-focus butterflies drifting past the lens (shot 3)
    const fgGeo = this.bfly.wingGeo.clone();
    this.fgPhase = new THREE.InstancedBufferAttribute(new Float32Array(4), 1).setUsage(THREE.DynamicDrawUsage);
    this.fgAlpha = new THREE.InstancedBufferAttribute(new Float32Array(4), 1).setUsage(THREE.DynamicDrawUsage);
    fgGeo.setAttribute('aIPhase', this.fgPhase);
    fgGeo.setAttribute('aIAlpha', this.fgAlpha);
    fgGeo.setAttribute('aIHue', new THREE.InstancedBufferAttribute(new Float32Array(4), 1));
    this.fg = new THREE.InstancedMesh(fgGeo, this.bfly.ghostMat, 4);
    this.fg.frustumCulled = false;
    this.fg.renderOrder = 12;
    this.scene.add(this.fg);
    this.fgGeo = fgGeo;

    const mobile = matchMedia('(pointer: coarse)').matches;
    this.mobile = mobile;
    this.maxDpr = Math.min(window.devicePixelRatio || 1, mobile ? 1.5 : 2);
    this.dprScale = 1;
    this.post = new PostFX(renderer, this.scene, this.camera, { samples: mobile ? 0 : 4, raySamples: mobile ? 32 : 48, bloomScale: mobile ? 0.6 : 0.85 });
    this.post.final.uniforms.uVignette.value = 0.9;
    this.post.final.uniforms.uGrain.value = 0.045;
    this.post.final.uniforms.uSat.value = 0.88;
    this.post.final.uniforms.uTint.value.copy(COLORS.warm);
    this.post.bloom.threshold = 0.5;

    // frame state
    this.s = {
      cam: new THREE.Vector3(), look: new THREE.Vector3(), bpos: new THREE.Vector3(), bEuler: new THREE.Euler(),
      bQuat: null, bQuatStore: new THREE.Quaternion(), echoDir: new THREE.Vector3(), lightPos: new THREE.Vector3(),
      op: {}, bScale: 1, flap: 1, amp: 0.5, base: 0.18, echo: 0, echoSpread: 0, echoToLight: false, echoStep: 1,
      cross: 0, coreSize: 40, frameNear: 4, frameTravel: 0, twist: 0, wobble: 1, lineFlow: 0, rays: 1, fg: 0,
    };
    this.op = { frames: 1, lines: 0, gallery: 0, slab: 0, core: 1, dust: 1, bg: 1 };

    this.t = 0;          // film clock (loops)
    this.world = 0;      // free-running clock
    this.paused = false;
    this.frame = 0;
    this.fpsAcc = 0; this.fpsN = 0;
    this.ptr = { x: 0, y: 0, sx: 0, sy: 0, active: 0, down: null, yaw: 0, pitch: 0, zoom: 1 };
    this.camPos = new THREE.Vector3(0, 0, 9);
    this.camLook = new THREE.Vector3(0, 0, -8);
    this._q = new THREE.Quaternion();
    this._v = new THREE.Vector3();
    this._m = new THREE.Matrix4();
    this._zero = new THREE.Vector3();
    this.hud = document.getElementById('hud');
    this.bindInput();
    this.resize();
    window.addEventListener('resize', () => this.resize());
    window.visualViewport?.addEventListener('resize', () => this.resize());
    window.addEventListener('orientationchange', () => setTimeout(() => this.resize(), 250));
    document.addEventListener('visibilitychange', () => { if (!document.hidden) this.clock.getDelta(); });
    window.addEventListener('pagehide', () => this.dispose());
    this.clock = new THREE.Clock();
    try { renderer.compile(this.scene, this.camera); } catch (e) { /* compile lazily */ }
    renderer.setAnimationLoop(() => this.tick());
    window.__film = this;
    this.advance = (sec) => { for (let x = 0; x < sec; x += 1 / 30) this.tick(1 / 30, true); };
    setTimeout(() => document.body.classList.add('ready'), 350);
  }

  // ---------------------------------------------------------------------
  bindInput() {
    const c = this.canvas, p = this.ptr;
    const ndc = (e) => { const r = c.getBoundingClientRect(); return [((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1]; };
    const pointers = new Map();
    c.addEventListener('pointerdown', (e) => {
      c.setPointerCapture?.(e.pointerId);
      pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (pointers.size === 1) p.down = { x: e.clientX, y: e.clientY, t: performance.now(), moved: false };
      else { p.down = null; const [a, b] = [...pointers.values()]; p.pinch = Math.hypot(a.x - b.x, a.y - b.y); }
      [p.x, p.y] = ndc(e);
      p.touch = e.pointerType !== 'mouse';
      this.wake();
    });
    window.addEventListener('pointermove', (e) => {
      if (e.target !== c && !pointers.has(e.pointerId)) return;
      [p.x, p.y] = ndc(e);
      p.hover = true;
      this.wake();
      const q = pointers.get(e.pointerId);
      if (!q) return;
      const dx = e.clientX - q.x, dy = e.clientY - q.y;
      q.x = e.clientX; q.y = e.clientY;
      if (pointers.size === 2) {
        const [a, b] = [...pointers.values()];
        const d = Math.hypot(a.x - b.x, a.y - b.y);
        if (p.pinch) p.zoom = Math.min(1.35, Math.max(0.7, p.zoom * (p.pinch / d)));
        p.pinch = d;
      } else if (p.down) {
        if (Math.hypot(e.clientX - p.down.x, e.clientY - p.down.y) > 6) p.down.moved = true;
        if (p.down.moved) {
          const k = 3.2 / Math.max(innerWidth, innerHeight);
          p.yaw = Math.max(-0.75, Math.min(0.75, p.yaw - dx * k));
          p.pitch = Math.max(-0.45, Math.min(0.45, p.pitch - dy * k));
        }
      }
    }, { passive: true });
    const up = (e) => {
      if (!pointers.has(e.pointerId)) return;
      pointers.delete(e.pointerId);
      if (p.down && !p.down.moved && performance.now() - p.down.t < 450 && pointers.size === 0) this.tap(ndc(e));
      if (pointers.size === 0) { p.down = null; p.pinch = 0; if (e.pointerType !== 'mouse') p.hover = false; }
    };
    window.addEventListener('pointerup', up);
    window.addEventListener('pointercancel', up);
    c.addEventListener('pointerleave', () => { if (!pointers.size) p.hover = false; });
    c.addEventListener('wheel', (e) => { e.preventDefault(); p.zoom = Math.min(1.35, Math.max(0.7, p.zoom * Math.exp(e.deltaY * 0.0009))); }, { passive: false });
    c.addEventListener('dblclick', () => this.toggleFullscreen());
    c.addEventListener('contextmenu', (e) => e.preventDefault());
    window.addEventListener('keydown', (e) => {
      const k = e.key.toLowerCase();
      if (k === ' ') { e.preventDefault(); this.paused = !this.paused; document.body.classList.toggle('paused', this.paused); }
      else if (k === 'f') this.toggleFullscreen();
      else if (k === 'arrowright') this.jump(1);
      else if (k === 'arrowleft') this.jump(-1);
    });
    document.getElementById('fs').addEventListener('click', () => this.toggleFullscreen());
    const onFs = () => document.body.classList.toggle('fs', !!(document.fullscreenElement || document.webkitFullscreenElement));
    document.addEventListener('fullscreenchange', onFs);
    document.addEventListener('webkitfullscreenchange', onFs);
  }

  wake() {
    document.body.classList.add('awake');
    clearTimeout(this._wakeT);
    this._wakeT = setTimeout(() => document.body.classList.remove('awake'), 2600);
  }

  toggleFullscreen() {
    const el = document.documentElement;
    if (document.fullscreenElement || document.webkitFullscreenElement) (document.exitFullscreen || document.webkitExitFullscreen).call(document);
    else (el.requestFullscreen || el.webkitRequestFullscreen)?.call(el)?.catch?.(() => {});
  }

  jump(dir) {
    const { index } = this.shotAt(this.t);
    let start = 0;
    const target = (index + dir + SHOTS.length) % SHOTS.length;
    for (let i = 0; i < target; i++) start += SHOTS[i].dur;
    this.t = start + 0.01;
    this.snap = true;
  }

  tap(n) {
    // touching the butterfly makes it flutter and shed a little light
    const b = this.bfly;
    const sp = this._v.copy(b.pos).project(this.camera);
    const dist = Math.hypot((sp.x - n[0]) * this.camera.aspect, sp.y - n[1]);
    const r = Math.max(0.16, (b.group.scale.x * 1.3 * this.camera.projectionMatrix.elements[5]) / b.pos.distanceTo(this.camera.position));
    if (dist < r) {
      b.triggerFlutter();
      this.stage.burst(b.pos, 110);
    } else {
      const ray = new THREE.Raycaster();
      ray.setFromCamera(new THREE.Vector2(n[0], n[1]), this.camera);
      const plane = new THREE.Plane().setFromNormalAndCoplanarPoint(this.camera.getWorldDirection(new THREE.Vector3()).negate(), b.pos);
      const hit = ray.ray.intersectPlane(plane, new THREE.Vector3());
      if (hit) this.stage.burst(hit, 40);
    }
  }

  shotAt(t) {
    let acc = 0;
    for (let i = 0; i < SHOTS.length; i++) {
      if (t < acc + SHOTS[i].dur) return { index: i, local: t - acc };
      acc += SHOTS[i].dur;
    }
    return { index: SHOTS.length - 1, local: SHOTS[SHOTS.length - 1].dur };
  }

  resize() {
    const w = innerWidth, h = innerHeight;
    const dpr = Math.max(0.75, this.maxDpr * this.dprScale);
    this.renderer.setPixelRatio(dpr);
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    // keep the composition: widen the view on portrait screens
    this.camera.fov = w / h < 1 ? Math.min(68, 40 * Math.pow(1 / (w / h), 0.62)) : 40;
    this.camera.updateProjectionMatrix();
    this.post.setSize(w, h, dpr);
    this.post.feedback.reset = true;
    this.stage.bgU.uAspect.value = w / h;
    this.size = { w, h, dpr };
  }

  // ---------------------------------------------------------------------
  tick(forced = null, skipRender = false) {
    if (this.lost) return;
    const raw = forced ?? this.clock.getDelta();
    const dt = Math.min(raw, 1 / 20);
    const adt = this.paused ? 0 : dt;
    this.t = (this.t + adt) % TOTAL;
    this.world += adt;
    if (!this.paused) this.frame++;

    // adaptive resolution: hold a smooth frame rate first
    this.fpsAcc += raw; this.fpsN++;
    if (this.fpsAcc > 2 && !forced) {
      const fps = this.fpsN / this.fpsAcc;
      if (fps < 40 && this.dprScale > 0.55) { this.dprScale -= 0.15; this.resize(); }
      else if (fps > 57 && this.dprScale < 1) { this.dprScale = Math.min(1, this.dprScale + 0.1); this.resize(); }
      this.fpsAcc = 0; this.fpsN = 0;
    }

    const { index, local } = this.shotAt(this.t);
    const shot = SHOTS[index];
    const u = local / shot.dur;
    const s = this.s;
    s.bQuat = null;
    s.echoToLight = false;
    shot.fill(s, u, this.world, this.stage);
    // dip to black around each cut
    const fade = sm(0, FADE, local) * sm(0, FADE, shot.dur - local);
    const cut = fade < 0.05 || this.snap;
    if (this.snap) { this.post.feedback.reset = true; this.snap = false; }
    const k = cut ? 1 : 1 - Math.exp(-dt * 3);
    for (const key of Object.keys(s.op)) this.op[key] += (s.op[key] - this.op[key]) * k;
    Object.assign(this.stage.opacity, this.op);

    // ---- camera: shot path + pointer parallax + gentle drag orbit
    const p = this.ptr;
    p.active += ((p.hover ? 1 : 0) - p.active) * (1 - Math.exp(-dt * 3));
    p.sx += (p.x - p.sx) * (1 - Math.exp(-dt * 4));
    p.sy += (p.y - p.sy) * (1 - Math.exp(-dt * 4));
    if (!p.down) { p.yaw *= Math.exp(-dt * 0.6); p.pitch *= Math.exp(-dt * 0.6); }
    if (this.camera.aspect < 1 && (index === 1 || index === 3)) {
      s.look.lerp(this._v.copy(s.bpos).lerp(s.lightPos, 0.12), Math.min(0.8, (1 - this.camera.aspect) * 1.6));
      s.cam.x *= 0.6;
    }
    const camTarget = this._v.copy(s.cam).sub(s.look);
    const dist = camTarget.length() * p.zoom;
    const sph = new THREE.Spherical().setFromVector3(camTarget);
    sph.radius = dist;
    sph.theta += p.yaw + p.sx * 0.06 * p.active;
    sph.phi = Math.min(Math.PI - 0.2, Math.max(0.2, sph.phi - p.pitch - p.sy * 0.04 * p.active));
    const want = new THREE.Vector3().setFromSpherical(sph).add(s.look);
    const ck = cut ? 1 : 1 - Math.exp(-dt * 6);
    this.camPos.lerp(want, ck);
    this.camLook.lerp(s.look, ck);
    this.camera.position.copy(this.camPos);
    this.camera.lookAt(this.camLook);
    this.camera.updateMatrixWorld();

    // ---- butterfly
    const b = this.bfly;
    if (!s.bQuat) {
      s.bQuatStore.setFromEuler(s.bEuler);
      // she glances toward the pointer
      if (p.active > 0.01) s.bQuatStore.multiply(this._q.setFromEuler(new THREE.Euler(p.sy * 0.18 * p.active, p.sx * 0.3 * p.active, 0)));
      s.bQuat = s.bQuatStore;
    }
    if (s.echoToLight) {
      // afterimages fill the path to the light, stopping just short of it
      s.echoDir.copy(s.lightPos).sub(s.bpos);
      const L = s.echoDir.length();
      s.echoDir.normalize();
      s.echoStep = (L * 0.55) / (30 * 1.35 * s.bScale);
    }
    else if (index !== 4) s.echoDir.set(0.55, 0.05, -1).normalize();
    b._echoDir.copy(s.echoDir);
    b.echoStep = s.echoStep;
    if (cut) { b.pos.copy(s.bpos); b.root.quaternion.copy(s.bQuat); b.histFilled = 0; b.uniforms.uFlapBase.value = s.base; }
    b.uniforms.uFlapBase.value += (s.base - b.uniforms.uFlapBase.value) * (1 - Math.exp(-dt * 3));
    b.update(dt, this.world, {
      flapSpeed: s.flap * (this.paused ? 0 : 1), scale: s.bScale, follow: this._zero, wing: 1,
      echo: s.echo, echoSpread: s.echoSpread, bass: 0, anim: 1, basePos: s.bpos, sway: 1,
      override: { pos: s.bpos, quat: s.bQuat }, amp: s.amp,
    });
    b.uniforms.uBright.value = 0.62 * (1 + b.flutter * 0.45);

    // ---- foreground ghosts (shot 3)
    const fgOn = s.fg > 0.5 && index === 2;
    this.fg.visible = fgOn;
    if (fgOn) {
      for (let i = 0; i < 4; i++) {
        const tt = u * 1.15 - i * 0.22;
        const x = -9 + tt * 16 + i * 1.5;
        const pos = this._v.set(x, 1.0 - i * 0.8 + Math.sin(tt * 4 + i) * 0.4, 3.2 - i * 0.8);
        const q = this._q.setFromEuler(new THREE.Euler(-0.5, 0.6 + i * 0.2, 0.2));
        const sc = 2.1 - i * 0.25;
        this._m.compose(pos, q, new THREE.Vector3(sc, sc, sc));
        this.fg.setMatrixAt(i, this._m);
        this.fgPhase.array[i] = this.world * (2.4 + i * 0.3) + i;
        this.fgAlpha.array[i] = 0.09 * sm(0, 0.15, tt) * (1 - sm(0.85, 1, tt)) * fade;
      }
      this.fg.instanceMatrix.needsUpdate = true;
      this.fgPhase.needsUpdate = true;
      this.fgAlpha.needsUpdate = true;
    }

    // ---- stage
    const proj = this.camera.projectionMatrix.elements[5] * this.size.h * this.size.dpr * 0.5;
    this.stage.update(dt, this.world, s, this.camera, proj);

    // ---- post
    const lp = this._v.copy(s.lightPos).project(this.camera);
    const lx = lp.x * 0.5 + 0.5, ly = lp.y * 0.5 + 0.5;
    const behind = lp.z > 1 ? 0 : 1;
    const po = this.post;
    po.rays.uniforms.uLight.value.set(lx, ly);
    po.rays.uniforms.uStrength.value = s.rays * 0.38 * behind;
    po.rays.uniforms.uTime.value = this.frame % 100;
    po.bloom.strength = 0.72 + b.flutter * 0.4;
    po.bloom.radius = 0.5;
    po.feedback.amount = index === 1 || index === 3 ? 0.35 : 0.2;
    const F = po.final.uniforms;
    F.uTime.value = this.world;
    F.uDof.value = index === 2 ? 0.9 : 0.55;
    F.uTrans.value = (1 - fade) * 0.6;
    F.uFlash.value = 0;
    F.uLight.value.set(lx, ly);
    F.uFlare.value = this.op.core * 0.35 * behind;
    F.uCA.value = 0.45;
    this.renderer.toneMappingExposure = 0.88 * (0.04 + 0.96 * fade);

    if (skipRender) return;
    po.render(dt);

    // ---- HUD, as in the film: FRAME nn / 76 · T+s.ss
    if (this.frame % 2 === 0) {
      const f = Math.min(76, Math.floor((this.t / TOTAL) * 76) + 1);
      this.hud.textContent = `FRAME ${String(f).padStart(2, '0')} / 76 · T+${local.toFixed(2)}S`;
    }
  }

  dispose() {
    try {
      this.renderer.setAnimationLoop(null);
      this.bfly.dispose();
      this.fgGeo.dispose();
      this.stage.dispose();
      this.post.dispose();
      this.renderer.dispose();
    } catch (e) { /* page is closing */ }
  }
}

try {
  if (!document.createElement('canvas').getContext('webgl2')) throw new Error('浏览器没有提供 WebGL 2（可能关闭了硬件加速）');
  new Film().init();
} catch (e) {
  console.error(e);
  document.body.classList.add('ready');
  const f = document.getElementById('fatal');
  f.hidden = false;
  f.querySelector('p').textContent = e.message || String(e);
}
