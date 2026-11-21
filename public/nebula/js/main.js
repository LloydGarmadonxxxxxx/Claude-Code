import * as THREE from 'three';
import { Butterfly } from './butterfly.js';
import { Stage } from './stage.js';
import { PostFX } from './postfx.js';
import { Zoetrope, CYCLE, poseOf, wingAngleOf } from './zoetrope.js';
import { createUI, TINTS } from './ui.js';
import { SCENES } from './scenes.js';

// ---------------------------------------------------------------------------
// NEBULA · 蝴蝶 — a zoetrope of light.
// Every frame holds one still butterfly; the frames rush past and the stills
// become flight. Pause to pull any butterfly out of its frame, study it,
// record it — and rewind the corridor back to the butterflies you recorded.
// ---------------------------------------------------------------------------

const sm = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
const easeIO = (x) => (x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2);
const FPS = 12; // corridor frames per second at 1×
const STORE = 'nebula.zoetrope.v1';
const AUTO_EVERY = 12;

const COLORS = {
  warm: new THREE.Color('#f1e2c6'),
  glow: new THREE.Color('#fff7ea'),
  body: new THREE.Color('#fff2d8'),
  accent: new THREE.Color('#e9dcc4'),
};

const _bx = new THREE.Vector3(), _by = new THREE.Vector3(), _bz = new THREE.Vector3(), _bm = new THREE.Matrix4();
function basisQuat(head, back, out) {
  _by.copy(head).normalize();
  _bz.copy(back).sub(_bx.copy(_by).multiplyScalar(back.dot(_by))).normalize();
  _bx.crossVectors(_by, _bz).normalize();
  _bm.makeBasis(_bx, _by, _bz);
  return out.setFromRotationMatrix(_bm);
}

class App {
  constructor() { this.canvas = document.getElementById('stage'); }

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

    // The butterfly you hold: pulled out of a frame, or resting on the glass.
    this.held = new Butterfly(this.scene, { body: COLORS.body.clone(), accent: COLORS.accent.clone(), glow: COLORS.glow.clone() });
    const HU = this.held.uniforms;
    HU.uPattern.value = 8; HU.uGlowAmt.value = 0.85; HU.uSpec.value = 0.15;
    this.held.group.visible = false;
    this.zoe = new Zoetrope(this.scene, this.held, COLORS);

    // out-of-focus giants for the DRIFT scene
    const fgGeo = this.held.wingGeo.clone();
    this.fgPhase = new THREE.InstancedBufferAttribute(new Float32Array(4), 1).setUsage(THREE.DynamicDrawUsage);
    this.fgAlpha = new THREE.InstancedBufferAttribute(new Float32Array(4), 1).setUsage(THREE.DynamicDrawUsage);
    fgGeo.setAttribute('aIPhase', this.fgPhase);
    fgGeo.setAttribute('aIAlpha', this.fgAlpha);
    fgGeo.setAttribute('aIHue', new THREE.InstancedBufferAttribute(new Float32Array(4), 1));
    this.fg = new THREE.InstancedMesh(fgGeo, this.held.ghostMat, 4);
    this.fg.frustumCulled = false;
    this.fg.renderOrder = 12;
    this.scene.add(this.fg);
    this.fgGeo = fgGeo;

    const mobile = matchMedia('(pointer: coarse)').matches;
    this.mobile = mobile;
    this.maxDpr = Math.min(window.devicePixelRatio || 1, mobile ? 1.5 : 2);
    this.dprScale = 1;
    this.post = new PostFX(renderer, this.scene, this.camera, { samples: mobile ? 0 : 4, raySamples: mobile ? 32 : 48, bloomScale: mobile ? 0.6 : 0.85 });
    const F = this.post.final.uniforms;
    F.uVignette.value = 0.9; F.uGrain.value = 0.045; F.uSat.value = 0.88; F.uTint.value.copy(COLORS.warm);
    this.post.bloom.threshold = 0.5;

    // --- state
    this.s = {
      cam: new THREE.Vector3(), look: new THREE.Vector3(), lightPos: new THREE.Vector3(),
      group: { pos: new THREE.Vector3(), rotY: 0, scale: 1 }, op: {}, cross: 0, coreSize: 50, rays: 1, fg: 0, lineFlow: 0,
      frameNear: 4, frameTravel: 0, twist: 0, wobble: 1, galleryScroll: 0,
    };
    this.op = { frames: 0, zoe: 1, lines: 0, gallery: 0, slab: 0, core: 1, dust: 1, bg: 1 };
    this.sceneIndex = 0;
    this.auto = false;
    this.autoT = 0;
    this.sceneFade = { t: 1, next: -1 };
    this.head = 0;
    this.playing = true;
    this.speed = 1;
    this.holdRewind = false;
    this.world = 0;
    this.rate = 0;
    this.records = [];
    this.selected = new Set();
    this.inspect = null;
    this.travel = null;
    this.ptr = { x: 0, y: 0, sx: 0, sy: 0, active: 0, down: null, yaw: 0, pitch: 0, zoom: 1, hover: false };
    this.camPos = new THREE.Vector3(0, 0, 9);
    this.camLook = new THREE.Vector3(0, 0, -8);
    this._v = new THREE.Vector3(); this._v2 = new THREE.Vector3(); this._q = new THREE.Quaternion(); this._q2 = new THREE.Quaternion();
    this._m = new THREE.Matrix4(); this._zero = new THREE.Vector3(); this._e = new THREE.Euler();
    this.load();

    this.ui = createUI(this);
    this.bindInput();
    this.resize();
    window.addEventListener('resize', () => this.resize());
    window.visualViewport?.addEventListener('resize', () => this.resize());
    window.addEventListener('orientationchange', () => setTimeout(() => this.resize(), 250));
    document.addEventListener('visibilitychange', () => { if (!document.hidden) this.clock.getDelta(); else this.save(); });
    window.addEventListener('pagehide', () => { this.save(); this.dispose(); });
    setInterval(() => this.save(), 4000);
    this.clock = new THREE.Clock();
    try { renderer.compile(this.scene, this.camera); } catch (e) { /* compile lazily */ }
    renderer.setAnimationLoop(() => this.tick());
    window.__app = this;
    this.advance = (sec) => { for (let x = 0; x < sec; x += 1 / 30) this.tick(1 / 30, true); };
    this.ui.sync();
    this.ui.records();
    setTimeout(() => document.body.classList.add('ready'), 350);
  }

  // ------------------------------------------------------------------ storage
  load() {
    try {
      const d = JSON.parse(localStorage.getItem(STORE) || 'null');
      if (d) {
        this.head = Math.max(0, +d.head || 0);
        this.records = Array.isArray(d.records) ? d.records.filter((r) => Number.isFinite(r.i) && r.edits) : [];
        if (Number.isInteger(d.scene) && SCENES[d.scene]) this.sceneIndex = d.scene;
        this.auto = !!d.auto;
      }
    } catch (e) { /* start fresh */ }
  }

  save() {
    const write = () => localStorage.setItem(STORE, JSON.stringify({ head: this.head, records: this.records, scene: this.sceneIndex, auto: this.auto }));
    try { write(); } catch (e) {
      // storage full: drop older thumbnails and try once more
      this.records.forEach((r, k) => { if (k < this.records.length - 6) r.thumb = null; });
      try { write(); } catch (e2) { /* give up quietly */ }
    }
  }

  // ------------------------------------------------------------------ scenes
  setScene(k) {
    if (k === 'auto') { this.auto = !this.auto; this.autoT = 0; this.ui.sync(); this.save(); return; }
    this.auto = false;
    if (k === this.sceneIndex && this.sceneFade.next < 0) { this.ui.sync(); return; }
    this.sceneFade = { t: 0, next: k };
    this.ui.sync();
  }

  // ------------------------------------------------------------------ playback
  play() {
    if (this.travel) return;
    if (this.inspect) { this.putBack(() => { this.playing = true; this.ui.sync(); }); return; }
    this.playing = true;
    this.ui.sync();
  }

  pause() { this.playing = false; this.ui.sync(); }

  togglePlay() {
    if (this.travel) return;
    if (this.playing && !this.inspect) this.pause(); else this.play();
  }

  setSpeed(v) { this.speed = v; this.ui.sync(); }

  setHoldRewind(on) {
    if (on && this.travel) return;
    if (on && this.inspect) this.putBack();
    this.holdRewind = on;
    document.body.classList.toggle('rewinding', on);
    this.ui.sync();
  }

  // ------------------------------------------------------------------ pull out / put back
  extract(i, edits = null, recordId = null) {
    const m = this.zoe.butterflyMatrix(i, this.head, new THREE.Matrix4());
    const pos = new THREE.Vector3(), quat = new THREE.Quaternion(), sc = new THREE.Vector3();
    m.decompose(pos, quat, sc);
    const wing = wingAngleOf(poseOf(i).phase);
    this.inspect = {
      i, phase: 'out', t: 0, from: { pos, quat, scale: sc.x / 1.35 }, recordId,
      edits: edits ? { ...edits } : { wing: +wing.toFixed(2), tint: 'moon', glow: 1, size: 1, rotX: 0, rotY: 0, note: '' },
      startWing: wing,
    };
    this.held.uniforms.uFlapBase.value = wing;
    this.held.pos.copy(pos);
    this.held.root.quaternion.copy(quat);
    this.applyTint(this.inspect.edits.tint);
    this.playing = false;
    this.ui.inspector(this.inspect);
    this.ui.sync();
  }

  putBack(done) {
    const ins = this.inspect;
    if (!ins) { if (done) done(); return; }
    if (ins.phase === 'in') return;
    ins.phase = 'in';
    ins.t = 0;
    ins.done = done;
    ins.back = { pos: this.held.pos.clone(), quat: this.held.root.quaternion.clone(), scale: this.held.group.scale.x / 1.35 };
    this.ui.inspector(null);
  }

  applyTint(id) {
    const t = TINTS.find((x) => x.id === id) || TINTS[0];
    const U = this.held.uniforms;
    U.uBody.value.set(t.body);
    U.uAccent.value.set(t.accent);
    U.uGlow.value.set(t.glow);
  }

  editHeld(key, v) {
    if (!this.inspect) return;
    this.inspect.edits[key] = v;
    if (key === 'tint') this.applyTint(v);
  }

  setView(name) {
    if (!this.inspect) return;
    const views = { front: [0, 0], side: [0, Math.PI / 2], back: [0, Math.PI], top: [1.2, 0] };
    const [x, y] = views[name] || views.front;
    this.inspect.edits.rotX = x;
    this.inspect.edits.rotY = y;
  }

  // ------------------------------------------------------------------ records
  async record() {
    const ins = this.inspect;
    if (!ins || ins.phase === 'in') return;
    const thumb = await this.requestThumb();
    const existing = ins.recordId && this.records.find((r) => r.id === ins.recordId);
    const data = {
      i: ins.i, frame: (ins.i % CYCLE) + 1, lap: Math.floor(ins.i / CYCLE) + 1,
      edits: { ...ins.edits }, note: ins.edits.note || '', thumb, time: Date.now(), scene: this.sceneIndex,
    };
    if (existing) Object.assign(existing, data);
    else {
      const n = this.records.reduce((a, x) => Math.max(a, x.n || 0), 0) + 1;
      const r = { id: Date.now().toString(36) + Math.random().toString(36).slice(2, 5), n, ...data };
      this.records.push(r);
      ins.recordId = r.id;
    }
    this.records.sort((a, b) => a.i - b.i);
    this.save();
    this.stage.burst(this.held.pos, 60);
    this.ui.toast(existing ? `已更新记录 · FRAME ${String(data.frame).padStart(2, '0')}` : `已记录 · FRAME ${String(data.frame).padStart(2, '0')} / 76 · 第 ${data.lap} 轮`);
    this.ui.inspector(ins);
    this.ui.records();
  }

  deleteRecords(ids) {
    this.records = this.records.filter((r) => !ids.includes(r.id));
    ids.forEach((id) => this.selected.delete(id));
    if (this.inspect && ids.includes(this.inspect.recordId)) { this.inspect.recordId = null; this.ui.inspector(this.inspect); }
    this.save();
    this.ui.records();
  }

  toggleSelect(id) {
    if (this.selected.has(id)) this.selected.delete(id); else this.selected.add(id);
    this.ui.records();
  }

  // Rewind (or fast-forward) through chosen records: nearest behind first.
  rewindTo(ids) {
    const list = this.records.filter((r) => ids.includes(r.id));
    if (!list.length) return;
    const behind = list.filter((r) => r.i <= this.head).sort((a, b) => b.i - a.i);
    const ahead = list.filter((r) => r.i > this.head).sort((a, b) => a.i - b.i);
    const queue = [...behind, ...ahead];
    clearTimeout(this._holdT);
    const go = () => {
      const r = queue.shift();
      if (!r) return;
      const from = this.head, to = r.i;
      this.travel = { from, to, t: 0, dur: Math.min(3.8, Math.max(1.2, Math.abs(to - from) / 60)), record: r, queue, next: go };
      document.body.classList.toggle('rewinding', to < from);
      document.body.classList.toggle('forwarding', to > from);
      this.ui.travel(r, queue.length);
      this.ui.sync();
    };
    this.holdRewind = false;
    this.playing = false;
    if (this.inspect) this.putBack(go); else go();
  }

  // ------------------------------------------------------------------ input
  bindInput() {
    const c = this.canvas, p = this.ptr;
    const ndc = (e) => { const r = c.getBoundingClientRect(); return new THREE.Vector2(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1); };
    const pointers = new Map();
    c.addEventListener('pointerdown', (e) => {
      c.setPointerCapture?.(e.pointerId);
      pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (pointers.size === 1) p.down = { x: e.clientX, y: e.clientY, t: performance.now(), moved: false };
      else { p.down = null; const [a, b] = [...pointers.values()]; p.pinch = Math.hypot(a.x - b.x, a.y - b.y); }
      const n = ndc(e); p.x = n.x; p.y = n.y;
      this.wake();
    });
    window.addEventListener('pointermove', (e) => {
      if (e.target !== c && !pointers.has(e.pointerId)) return;
      const n = ndc(e); p.x = n.x; p.y = n.y;
      p.hover = true;
      this.wake();
      const q = pointers.get(e.pointerId);
      if (!q) { if (e.pointerType === 'mouse') this.ui.cursor(this.hoverPick(n)); return; }
      const dx = e.clientX - q.x, dy = e.clientY - q.y;
      q.x = e.clientX; q.y = e.clientY;
      if (pointers.size === 2) {
        const [a, b] = [...pointers.values()];
        const d = Math.hypot(a.x - b.x, a.y - b.y);
        if (p.pinch) this.zoomBy(p.pinch / d);
        this.lastInteract = this.world;
        p.pinch = d;
      } else if (p.down) {
        if (Math.hypot(e.clientX - p.down.x, e.clientY - p.down.y) > 6) p.down.moved = true;
        if (p.down.moved) {
          this.lastInteract = this.world;
          const k = 3.2 / Math.max(innerWidth, innerHeight);
          if (this.inspect && this.inspect.phase !== 'in') {
            this.inspect.edits.rotY += dx * k * 1.6;
            this.inspect.edits.rotX = Math.max(-1.4, Math.min(1.4, this.inspect.edits.rotX + dy * k * 1.6));
          } else {
            p.yaw = Math.max(-0.75, Math.min(0.75, p.yaw - dx * k));
            // drag down → look down from above (standard orbit direction)
            p.pitch = Math.max(-0.45, Math.min(0.45, p.pitch + dy * k));
          }
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
    c.addEventListener('wheel', (e) => { e.preventDefault(); this.lastInteract = this.world; this.zoomBy(Math.exp(e.deltaY * 0.0009)); }, { passive: false });
    c.addEventListener('dblclick', (e) => { e.preventDefault(); if (!this.inspect) this.toggleFullscreen(); });
    c.addEventListener('contextmenu', (e) => e.preventDefault());
    window.addEventListener('keydown', (e) => {
      if (e.target.closest && e.target.closest('input, textarea')) return;
      const k = e.key.toLowerCase();
      if (k === ' ') { e.preventDefault(); this.togglePlay(); }
      else if (k === 'arrowleft') { e.preventDefault(); if (!e.repeat) this.setHoldRewind(true); }
      else if (k === 'f') this.toggleFullscreen();
      else if (k === 'escape') { if (this.inspect) this.putBack(); else this.ui.closeDrawer(); }
      else if (k === 'enter' && this.inspect) this.record();
      else if (k === 'r') this.ui.toggleDrawer();
      else if (k >= '1' && k <= '5') this.setScene(+k - 1);
      else if (k === '6') this.setScene('auto');
    });
    window.addEventListener('keyup', (e) => { if (e.key === 'ArrowLeft') this.setHoldRewind(false); });
    window.addEventListener('blur', () => { if (this.holdRewind) this.setHoldRewind(false); });
    const onFs = () => document.body.classList.toggle('fs', !!(document.fullscreenElement || document.webkitFullscreenElement));
    document.addEventListener('fullscreenchange', onFs);
    document.addEventListener('webkitfullscreenchange', onFs);
  }

  zoomBy(f) {
    if (this.inspect && this.inspect.phase !== 'in') {
      this.inspect.edits.size = Math.max(0.5, Math.min(2.2, this.inspect.edits.size / f));
      this.ui.inspectorValues(this.inspect);
    } else this.ptr.zoom = Math.min(1.35, Math.max(0.7, this.ptr.zoom * f));
  }

  hoverPick(n) {
    if (this.travel || (this.inspect && this.inspect.phase !== 'in')) return false;
    return this.zoe.pick(n, this.camera, this.head, -1) >= 0;
  }

  tap(n) {
    if (this.travel) return;
    if (this.inspect && this.inspect.phase !== 'in') {
      this._v.copy(this.held.pos).project(this.camera);
      if (Math.hypot((this._v.x - n.x) * this.camera.aspect, this._v.y - n.y) < 0.35) {
        this.held.triggerFlutter();
        this.stage.burst(this.held.pos, 80);
      }
      return;
    }
    const i = this.zoe.pick(n, this.camera, this.head, -1);
    if (i >= 0) {
      const existing = this.records.find((r) => r.i === i);
      this.extract(i, existing ? existing.edits : null, existing ? existing.id : null);
    }
  }

  wake() {
    document.body.classList.add('awake');
    clearTimeout(this._wakeT);
    this._wakeT = setTimeout(() => document.body.classList.remove('awake'), 2800);
  }

  toggleFullscreen() {
    const el = document.documentElement;
    if (document.fullscreenElement || document.webkitFullscreenElement) (document.exitFullscreen || document.webkitExitFullscreen).call(document);
    else { const r = (el.requestFullscreen || el.webkitRequestFullscreen)?.call(el); if (r && r.catch) r.catch(() => {}); }
  }

  requestThumb() { return new Promise((resolve) => { this.pendingThumb = resolve; }); }

  resize() {
    const w = innerWidth, h = innerHeight;
    const dpr = Math.max(0.75, this.maxDpr * this.dprScale);
    this.renderer.setPixelRatio(dpr);
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    this.camera.fov = w / h < 1 ? Math.min(68, 40 * Math.pow(1 / (w / h), 0.62)) : 40;
    this.camera.updateProjectionMatrix();
    this.post.setSize(w, h, dpr);
    this.post.feedback.reset = true;
    this.stage.bgU.uAspect.value = w / h;
    this.size = { w, h, dpr };
  }

  // ------------------------------------------------------------------ frame
  tick(forced = null, skipRender = false) {
    if (this.lost) return;
    const raw = forced ?? this.clock.getDelta();
    const dt = Math.min(raw, 1 / 20);
    this.world += dt;

    // adaptive resolution: hold a smooth frame rate first
    this.fpsAcc = (this.fpsAcc || 0) + raw; this.fpsN = (this.fpsN || 0) + 1;
    if (this.fpsAcc > 2 && !forced) {
      const fps = this.fpsN / this.fpsAcc;
      if (fps < 40 && this.dprScale > 0.55) { this.dprScale -= 0.15; this.resize(); }
      else if (fps > 57 && this.dprScale < 1) { this.dprScale = Math.min(1, this.dprScale + 0.1); this.resize(); }
      this.fpsAcc = 0; this.fpsN = 0;
    }

    // ---- playhead
    let rate = 0;
    if (this.travel) {
      const tr = this.travel;
      tr.t = Math.min(1, tr.t + dt / tr.dur);
      const prev = this.head;
      this.head = tr.from + (tr.to - tr.from) * easeIO(tr.t);
      rate = (this.head - prev) / Math.max(dt, 1e-3);
      if (tr.t >= 1) {
        this.head = tr.to;
        document.body.classList.remove('rewinding', 'forwarding');
        const r = tr.record;
        this.travel = null;
        this.ui.travel(null);
        this.extract(r.i, r.edits, r.id);
        this.ui.toast(`回到记录 ${r.n} · FRAME ${String(r.frame).padStart(2, '0')} / 76 · 第 ${r.lap} 轮`);
        this.ui.highlight(r.id);
        if (tr.queue.length) this._holdT = setTimeout(() => this.putBack(tr.next), 2600);
      }
    } else if (this.holdRewind) {
      rate = -FPS * 2 * this.speed;
      this.head = Math.max(0, this.head + rate * dt);
      if (this.head <= 0) rate = 0;
    } else if (this.playing && !this.inspect) {
      rate = FPS * this.speed;
      this.head += rate * dt;
    }
    this.rate = rate;

    // ---- scenes (manual or auto)
    if (this.auto && this.playing && !this.inspect && !this.travel) {
      this.autoT += dt;
      if (this.autoT > AUTO_EVERY) { this.autoT = 0; this.sceneFade = { t: 0, next: (this.sceneIndex + 1) % SCENES.length }; }
    }
    let cut = this.world < 0.1;
    if (this.sceneFade.t < 1) {
      const sf = this.sceneFade;
      const before = sf.t;
      sf.t = Math.min(1, sf.t + dt / 1.0);
      if (before < 0.5 && sf.t >= 0.5 && sf.next >= 0) {
        this.sceneIndex = sf.next; sf.next = -1; cut = true;
        this.post.feedback.reset = true;
        this.ui.sync();
        this.save();
      }
    }
    const fade = this.sceneFade.t >= 1 ? 1 : Math.abs(this.sceneFade.t - 0.5) * 2;

    const s = this.s;
    const sc = SCENES[this.sceneIndex];
    sc.fill(s, this.world);
    const k = cut ? 1 : 1 - Math.exp(-dt * 3);
    for (const key of Object.keys(s.op)) this.op[key] += (s.op[key] - this.op[key]) * k;
    if (this.inspect) this.op.slab += (1 - this.op.slab) * (1 - Math.exp(-dt * 4));
    Object.assign(this.stage.opacity, this.op);
    this.stage.opacity.frames = 0; // frames belong to the zoetrope

    const g = this.zoe.group;
    const gk = cut ? 1 : 1 - Math.exp(-dt * 4);
    g.position.lerp(s.group.pos, gk);
    g.rotation.y += (s.group.rotY - g.rotation.y) * gk;
    g.scale.setScalar(g.scale.x + (s.group.scale - g.scale.x) * gk);
    g.updateMatrixWorld(true);

    // ---- camera
    const p = this.ptr;
    p.active += ((p.hover ? 1 : 0) - p.active) * (1 - Math.exp(-dt * 3));
    p.sx += (p.x - p.sx) * (1 - Math.exp(-dt * 4));
    p.sy += (p.y - p.sy) * (1 - Math.exp(-dt * 4));
    // Left alone, the view drifts — very slowly — back to the best angle on the butterfly.
    const idleFor = this.world - (this.lastInteract ?? -1e9);
    const idle = p.down && !this.inspect ? 0 : sm(1.5, 6, idleFor);
    if (this.inspect) { p.yaw *= Math.exp(-dt * 0.6); p.pitch *= Math.exp(-dt * 0.6); }
    else if (!p.down) {
      const r = Math.exp(-dt * 0.11 * idle);
      p.yaw *= r; p.pitch *= r;
      p.zoom = 1 + (p.zoom - 1) * Math.exp(-dt * 0.09 * idle);
    }
    // ...and gently frames the gilded butterfly (not in GLASS REST, whose subject is the slab)
    const biasTarget = !this.inspect && sc.id !== 'rest' ? 0.4 * idle : 0;
    this.lookBias = (this.lookBias ?? 0) + (biasTarget - (this.lookBias ?? 0)) * (1 - Math.exp(-dt * 0.22));
    if (this.lookBias > 0.001 && this.zoe.halo.visible) s.look.lerp(this.zoe.halo.position, this.lookBias);
    if (this.camera.aspect < 1 && (this.sceneIndex === 1 || this.sceneIndex === 3)) { s.cam.x *= 0.55; s.look.x *= 0.5; }
    const rel = this._v.copy(s.cam).sub(s.look);
    const sph = new THREE.Spherical().setFromVector3(rel);
    sph.radius *= p.zoom;
    const par = this.inspect ? 0.25 : 1;
    sph.theta += p.yaw + p.sx * 0.06 * p.active * par;
    sph.phi = Math.min(Math.PI - 0.2, Math.max(0.2, sph.phi - p.pitch - p.sy * 0.04 * p.active * par));
    const want = this._v2.setFromSpherical(sph).add(s.look);
    const ck = cut ? 1 : 1 - Math.exp(-dt * 5);
    this.camPos.lerp(want, ck);
    this.camLook.lerp(s.look, ck);
    this.camera.position.copy(this.camPos);
    this.camera.lookAt(this.camLook);
    this.camera.updateMatrixWorld();

    // ---- the corridor
    const marks = new Set(this.records.map((r) => r.i));
    this.zoe.frameOpacity = this.op.frames;
    this.zoe.opacity = this.op.zoe;
    const projPx = this.camera.projectionMatrix.elements[5] * this.size.h * this.size.dpr * 0.5;
    this.zoe.update(this.head, { marks, extracted: this.inspect ? this.inspect.i : -1, time: this.world, camera: this.camera, proj: projPx });

    // ---- the held (or resting) butterfly
    this.updateHeld(dt, sc);

    // ---- out-of-focus giants (DRIFT)
    const fgOn = sc.id === 'return' && !this.inspect;
    this.fg.visible = fgOn;
    if (fgOn) {
      for (let i = 0; i < 4; i++) {
        const u = (this.world / 9 + i * 0.27) % 1;
        const pos = this._v.set(-9 + u * 18, 1.0 - i * 0.8 + Math.sin(u * 6 + i) * 0.4, 3.4 - i * 0.8);
        const q = this._q.setFromEuler(this._e.set(-0.5, 0.6 + i * 0.2, 0.2));
        const scl = 2.1 - i * 0.25;
        this._m.compose(pos, q, this._v2.set(scl, scl, scl));
        this.fg.setMatrixAt(i, this._m);
        this.fgPhase.array[i] = this.world * (2.4 + i * 0.3) + i;
        this.fgAlpha.array[i] = 0.09 * sm(0, 0.12, u) * (1 - sm(0.88, 1, u)) * fade;
      }
      this.fg.instanceMatrix.needsUpdate = true;
      this.fgPhase.needsUpdate = true;
      this.fgAlpha.needsUpdate = true;
    }

    // ---- stage: light, striations, gallery walls, glass, dust
    s.galleryScroll = -this.head * this.zoe.spacing * 0.35;
    const proj = this.camera.projectionMatrix.elements[5] * this.size.h * this.size.dpr * 0.5;
    this.stage.update(dt, this.world, { ...s, lineFlow: s.lineFlow + rate * 0.3 }, this.camera, proj);

    // ---- post
    const lp = this._v.copy(s.lightPos).project(this.camera);
    const lx = lp.x * 0.5 + 0.5, ly = lp.y * 0.5 + 0.5;
    const behind = lp.z > 1 ? 0 : 1;
    const rewinding = rate < -0.5;
    const po = this.post;
    po.rays.uniforms.uLight.value.set(lx, ly);
    po.rays.uniforms.uStrength.value = s.rays * 0.38 * behind;
    po.rays.uniforms.uTime.value = Math.floor(this.world * 60) % 100;
    po.bloom.strength = 0.72 + this.held.flutter * 0.4;
    po.bloom.radius = 0.5;
    // keep the living (gilded) butterfly crisp while playing; smear only when scrubbing fast
    po.feedback.amount = Math.min(0.5, 0.06 + Math.max(0, Math.abs(rate) - FPS * this.speed - 1) * 0.006);
    const F = po.final.uniforms;
    F.uTime.value = this.world;
    F.uDof.value = sc.id === 'return' ? 0.9 : this.inspect ? 0.8 : 0.55;
    F.uTrans.value = (1 - fade) * 0.6 + (rewinding ? 0.22 : 0);
    F.uFlash.value = 0;
    F.uLight.value.set(lx, ly);
    F.uFlare.value = this.op.core * 0.35 * behind;
    F.uCA.value = rewinding ? 1.6 : 0.45;
    F.uSat.value = rewinding ? 0.35 : 0.88;
    this.renderer.toneMappingExposure = 0.88 * (0.04 + 0.96 * fade);

    if (skipRender) return;
    po.render(dt);
    if (this.pendingThumb) this.captureThumb();

    if (Math.floor(this.world * 30) % 2 === 0) {
      const i = Math.max(0, Math.round(this.head));
      this.ui.hud(i % CYCLE + 1, Math.floor(i / CYCLE) + 1, this.head / FPS, rate);
    }
  }

  captureThumb() {
    const resolve = this.pendingThumb;
    this.pendingThumb = null;
    try {
      const c = document.createElement('canvas');
      c.width = 240; c.height = 150;
      const ctx = c.getContext('2d');
      const src = this.canvas;
      const hp = this._v.copy(this.held.pos).project(this.camera);
      const cx = (hp.x * 0.5 + 0.5) * src.width, cy = (1 - (hp.y * 0.5 + 0.5)) * src.height;
      const cw = src.height * 0.62, ch = cw * (150 / 240);
      ctx.fillStyle = '#050505';
      ctx.fillRect(0, 0, 240, 150);
      ctx.drawImage(src, cx - cw / 2, cy - ch / 2, cw, ch, 0, 0, 240, 150);
      resolve(c.toDataURL('image/jpeg', 0.7));
    } catch (e) { resolve(null); }
  }

  // Where the held butterfly floats: in front of the lens, above a pane of glass.
  inspectSpot(out) {
    const cam = this.camera;
    const fwd = this._v2.set(0, 0, -1).applyQuaternion(cam.quaternion);
    out.copy(cam.position).addScaledVector(fwd, 4.4);
    if (innerWidth > 760) out.addScaledVector(this._v.set(1, 0, 0).applyQuaternion(cam.quaternion), -0.6);
    else {
      // phones: the panel takes the lower half, so the butterfly floats in the upper half
      const halfH = 4.4 * Math.tan(THREE.MathUtils.degToRad(cam.fov / 2));
      out.addScaledVector(this._v.set(0, 1, 0).applyQuaternion(cam.quaternion), halfH * 0.42);
    }
    return out;
  }

  updateHeld(dt, sc) {
    const b = this.held;
    const ins = this.inspect;
    const stage = this.stage;
    if (!ins) {
      stage.slab.scale.setScalar(1);
      if (sc.id === 'rest') {
        // GLASS REST: one butterfly resting on the slab, as in the film
        b.group.visible = true;
        const t = this.world;
        stage.slab.position.set(0, -0.35, 0);
        stage.slab.rotation.set(Math.sin(t * 0.17) * 0.06, -0.35 + Math.sin(t * 0.22) * 0.55, Math.sin(t * 0.17) * 0.12);
        stage.slab.updateMatrixWorld(true);
        const pos = this._v.set(-0.25, 0.48, 0.15).applyMatrix4(stage.slab.matrixWorld).clone();
        const head = new THREE.Vector3(-1, 0.08, 0).applyQuaternion(stage.slab.quaternion);
        const back = new THREE.Vector3(0, 1, 0).applyQuaternion(stage.slab.quaternion);
        const q = basisQuat(head, back, new THREE.Quaternion());
        const open = sm(0.72, 1.0, Math.sin(t * 0.5) * 0.5 + 0.5);
        b.uniforms.uFlapBase.value += (1.32 - open * 0.42 - b.uniforms.uFlapBase.value) * (1 - Math.exp(-dt * 3));
        b.pos.copy(pos); b.root.quaternion.copy(q);
        b.update(dt, t, { flapSpeed: 0.3, scale: 0.62, follow: this._zero, wing: 1, echo: 0, echoSpread: 0, bass: 0, anim: 1, basePos: pos, sway: 1, override: { pos, quat: q }, amp: 0.1 + open * 0.08 });
        this.applyTint('moon');
        b.uniforms.uBright.value = 0.62;
        b.uniforms.uGlowAmt.value = 0.85;
      } else {
        b.group.visible = false;
        b.ghosts.visible = false;
      }
      return;
    }

    b.group.visible = true;
    ins.t = Math.min(1, ins.t + dt / (ins.phase === 'in' ? 0.85 : 1.05));
    const e = ins.edits;
    const spot = this.inspectSpot(new THREE.Vector3());
    spot.y += Math.sin(this.world * 1.1) * 0.05;
    const camQ = this.camera.quaternion;
    const tq = this._q2.copy(camQ).multiply(this._q.setFromEuler(this._e.set(-0.25 + e.rotX, e.rotY, 0)));
    const tScale = 0.62 * e.size * (innerWidth > 760 ? 1 : 0.78);

    // a pane of glass under the held butterfly, facing the viewer
    const down = this._v.set(0, -1, 0).applyQuaternion(camQ);
    stage.slab.position.copy(spot).addScaledVector(down, 0.95 * e.size);
    stage.slab.quaternion.copy(camQ).multiply(this._q.setFromEuler(this._e.set(0.3, 0, 0)));
    stage.slab.scale.setScalar(0.45 + 0.25 * e.size);

    let pos, quat, scl;
    if (ins.phase !== 'in') {
      const u = easeIO(ins.t);
      const from = ins.from;
      pos = new THREE.Vector3().lerpVectors(from.pos, spot, u);
      pos.y += Math.sin(u * Math.PI) * 0.6;
      quat = new THREE.Quaternion().slerpQuaternions(from.quat, tq, u);
      scl = from.scale + (tScale - from.scale) * u;
      if (ins.t >= 1) ins.phase = 'hold';
      const w = ins.phase === 'hold' ? e.wing : ins.startWing + (e.wing - ins.startWing) * u;
      b.uniforms.uFlapBase.value += (w - b.uniforms.uFlapBase.value) * (1 - Math.exp(-dt * 10));
    } else {
      // home: fly back into its own frame
      const u = easeIO(ins.t);
      const m = this.zoe.butterflyMatrix(ins.i, this.head, this._m);
      const hp = new THREE.Vector3(), hq = new THREE.Quaternion(), hs = new THREE.Vector3();
      m.decompose(hp, hq, hs);
      pos = new THREE.Vector3().lerpVectors(ins.back.pos, hp, u);
      pos.y += Math.sin(u * Math.PI) * 0.4;
      quat = new THREE.Quaternion().slerpQuaternions(ins.back.quat, hq, u);
      scl = ins.back.scale + (hs.x / 1.35 - ins.back.scale) * u;
      b.uniforms.uFlapBase.value += (ins.startWing - b.uniforms.uFlapBase.value) * (1 - Math.exp(-dt * 6));
      if (ins.t >= 1) {
        const done = ins.done;
        this.inspect = null;
        b.group.visible = false;
        this.ui.sync();
        if (done) done();
        return;
      }
    }
    b.pos.copy(pos);
    b.root.quaternion.copy(quat);
    b.update(dt, this.world, {
      flapSpeed: 0.35, scale: scl, follow: this._zero, wing: 1, echo: 0, echoSpread: 0, bass: 0, anim: 1,
      basePos: pos, sway: 1, override: { pos, quat }, amp: ins.phase === 'hold' ? 0.035 : 0,
    });
    b.uniforms.uBright.value = 0.62 * e.glow * (1 + b.flutter * 0.45);
    b.uniforms.uGlowAmt.value = 0.85 * e.glow;
  }

  dispose() {
    try {
      this.renderer.setAnimationLoop(null);
      this.held.dispose(); this.zoe.dispose(); this.fgGeo.dispose(); this.stage.dispose(); this.post.dispose(); this.renderer.dispose();
    } catch (e) { /* closing */ }
  }
}

try {
  if (!document.createElement('canvas').getContext('webgl2')) throw new Error('浏览器没有提供 WebGL 2（可能关闭了硬件加速）');
  new App().init();
} catch (e) {
  console.error(e);
  document.body.classList.add('ready');
  const f = document.getElementById('fatal');
  f.hidden = false;
  f.querySelector('p').textContent = e.message || String(e);
}
