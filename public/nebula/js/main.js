import * as THREE from 'three';
import { MODES, DIRECTOR, PALETTES, DEFAULTS, RANGES, PRESETS, DEMO_SEQUENCE, DEMO_INTERVAL } from './config.js';
import { detectTier, TIER_SETTINGS, AdaptiveQuality } from './quality.js';
import { Butterfly } from './butterfly.js';
import { ParticleField, PointerTrail } from './particles.js';
import { Environment } from './environment.js';
import { PostFX } from './postfx.js';
import { Interaction } from './interaction.js';
import { AudioEngine } from './audio.js';
import { Capture } from './capture.js';
import { createUI } from './ui.js';
import { Swarm } from './swarm.js';
import { PathSystem } from './paths.js';
import { StudioEnv } from './studioEnv.js';
import { Studio, MATERIALS, PATTERNS } from './studio.js';
import { createStudioUI } from './studioUI.js';

const MODE_IDS = MODES.map((m) => m.id);
// Extra per-mode staging that isn't in DIRECTOR: butterfly anchor & orbit style.
const STAGE = {
  butterfly: { bx: 0, by: 0, bz: 0, orbit: 0, sway: 1 },
  universe: { bx: 0, by: 0, bz: 0, orbit: 1, sway: 1 },
  burst: { bx: 0, by: 0, bz: 0, orbit: 0.45, sway: 0.4 },
  tunnel: { bx: -2.5, by: -0.5, bz: 1.4, orbit: 0, sway: 0.6 },
  aurora: { bx: 0, by: 1.5, bz: -2, orbit: 0.12, sway: 1 },
  rebirth: { bx: 0, by: 0, bz: 0, orbit: 0, sway: 0.7 },
};
const LOOK_KEYS = [...Object.keys(DIRECTOR.butterfly), ...Object.keys(STAGE.butterfly), 'w0', 'w1', 'w2', 'w3', 'w4', 'w5', 'w6'];
const COLOR_KEYS = ['bg', 'body', 'particle', 'accent', 'glow'];

const ease = (x) => (x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2);
const clamp = THREE.MathUtils.clamp;

function lookFor(mode) {
  const o = { ...DIRECTOR[mode], ...STAGE[mode] };
  MODE_IDS.forEach((id, i) => { o['w' + i] = id === mode ? 1 : 0; });
  o.w6 = 0;
  return o;
}

// Studio "look": driven by the selected studio scene and camera settings.
function studioLook(studio) {
  const sl = studio.sceneLive || studio.sceneTarget();
  const o = {
    wing: 1, echo: 0, echoSpread: 0, tunnel: sl.tunnel, tunnelSpeed: sl.tunnelSpeed, streaks: sl.streaks, rays: sl.rays,
    core: sl.core, rings: 0, camDist: 13, camLift: 0.3, tunnelNear: sl.tunnelNear, focus: 13,
    bx: 0, by: 0, bz: 0, orbit: studio.cfg.visual.autoOrbit ? 1 : 0, sway: 1,
  };
  for (let i = 0; i < 6; i++) o['w' + i] = 0;
  o.w6 = 1;
  return o;
}

class App {
  constructor() {
    this.canvas = document.getElementById('stage');
    const { tier, mobile } = detectTier();
    this.autoTier = tier;
    this.mobile = mobile;
    this.state = {
      mode: 'butterfly',
      preset: 'celestial',
      params: { ...DEFAULTS, count: TIER_SETTINGS[tier].defaultParticles },
      colors: { ...PALETTES.butterfly },
      quality: 'auto',
      variant: { twist: 1, lx: 0, ly: 0, aur: 1, seed: 7 },
    };
    this.paused = false;
    this.demo = { on: false, t: 0, i: 0 };
    this.time = { sim: 0, p: 0, tunnel: 0, spin: 0, morph: 0, ring: 0, rebirth: 0, burst: 99, orbit: 0, frame: 0 };
    this.flash = 0;
    this.trans = { p: 1, dur: 1.8, pulse: 0 };
    this.fps = { acc: 0, n: 0, val: 60 };
    this.autoFlutter = 9;
    this.studioOn = false;
    this.shake = 0;
    this.tweens = [];
  }

  init() {
    this.loadFromHash();
    const tierName = this.state.quality === 'auto' ? this.autoTier : this.state.quality;
    this.tierSettings = TIER_SETTINGS[tierName];

    // ---- Renderer
    let renderer;
    try {
      renderer = new THREE.WebGLRenderer({ canvas: this.canvas, antialias: false, alpha: false, powerPreference: 'high-performance', stencil: false, depth: true });
    } catch (e) {
      this.fatal('无法创建 WebGL 2 上下文：' + (e.message || e));
      return false;
    }
    if (!renderer.capabilities.isWebGL2) { this.fatal('当前设备不支持 WebGL 2。'); return false; }
    this.renderer = renderer;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 0.95;
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.canvas.addEventListener('webglcontextlost', (e) => {
      e.preventDefault();
      this.contextLost = true;
      this.ui?.toast('显卡上下文丢失，正在尝试恢复…', 4000);
    });
    this.canvas.addEventListener('webglcontextrestored', () => location.reload());

    // ---- Scene
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(50, innerWidth / innerHeight, 0.1, 400);
    this.camera.position.set(0, 0.4, 11);

    // Live palette (THREE.Color objects shared by every material)
    this.pal = {};
    COLOR_KEYS.forEach((k) => { this.pal[k] = new THREE.Color(this.state.colors[k]); });
    this.colFrom = {};
    this.colTo = {};
    COLOR_KEYS.forEach((k) => { this.colFrom[k] = this.pal[k].clone(); this.colTo[k] = this.pal[k].clone(); });

    this.env = new Environment(this.scene, this.pal);
    this.butterfly = new Butterfly(this.scene, this.pal);
    this.particles = new ParticleField(this.scene, this.tierSettings.maxParticles, this.pal, this.state.variant.seed,
      { uShA: this.butterfly.uniforms.uShA, uShB: this.butterfly.uniforms.uShB, uShC: this.butterfly.uniforms.uShC });
    this.trail = new PointerTrail(this.scene, this.pal, this.mobile ? 600 : 1200);
    this.swarm = new Swarm(this.scene, this.butterfly);
    this.paths = new PathSystem(this.scene, this.camera);
    this.studioEnv = new StudioEnv(this.scene);
    this.studio = new Studio(this);

    this.look = lookFor(this.state.mode);
    this.lookFrom = { ...this.look };
    this.lookTo = { ...this.look };

    // ---- Post
    this.post = new PostFX(renderer, this.scene, this.camera, {
      samples: tierName === 'high' ? 4 : tierName === 'mid' ? 2 : 0,
      raySamples: this.tierSettings.raySamples,
      bloomScale: this.tierSettings.bloomScale,
    });
    this.adaptive = new AdaptiveQuality({ baseDpr: this.tierSettings.dpr, onChange: () => { this.resize(); this.applyCount(); } });
    this.adaptive.enabled = this.state.quality === 'auto' && !/[?&]debug/.test(location.search);

    // ---- Systems
    this.audio = new AudioEngine();
    this.audio.onBeat = (v) => this.onBeat(v);
    this.capture = new Capture(this.canvas);
    this.ia = new Interaction(this.canvas, {
      onTap: (ndc) => this.onTap(ndc),
      onMove: () => { this.trailPending = true; },
      onRelease: () => this.trail.release(),
      onDrawStart: (ndc) => this.paths.begin(ndc),
      onDrawMove: (ndc) => this.paths.add(ndc),
      onDrawEnd: () => {
        const p = this.paths.end();
        if (p) { this.studio.commit(); this.ui.toast(`已创建第 ${this.paths.paths.length} 条飞行轨迹`); this.studioUI.sync(); }
      },
    });

    this.ui = createUI(this);
    this.studio.restoreAutosave();
    this.studioUI = createStudioUI(this, this.studio);
    this.studio.onChange(() => this.applyCount());
    this.ui.setSliderMax('count', this.tierSettings.maxParticles);
    this.applyCount();
    this.applyPresetColorsNow();
    this.ui.sync();
    this.updateQualityNote();

    this._mouseW = new THREE.Vector3();
    this._ray = new THREE.Raycaster();
    this._plane = new THREE.Plane();
    this._tmp = new THREE.Vector3();
    this._tmp2 = new THREE.Vector3();
    this._light = new THREE.Vector3(0, 0, -48);
    this._bpos = new THREE.Vector3();
    this._follow = new THREE.Vector3();

    this.bindGlobal();
    this.resize();
    let wantStudio = false;
    try { wantStudio = localStorage.getItem('nebula.lastMode') === 'studio'; } catch (e) { /* ignore */ }
    if (/[?&]studio/.test(location.search)) wantStudio = true;
    if (/[?&]showcase/.test(location.search)) wantStudio = false;
    if (wantStudio) this.setStudio(true, { silent: true });
    this.clock = new THREE.Clock();
    renderer.setAnimationLoop(() => this.frame());
    // Warm-up: compile shaders before revealing
    try { renderer.compile(this.scene, this.camera); } catch (e) { /* noop */ }
    setTimeout(() => {
      document.getElementById('veil').classList.add('done');
      this.ui.titleCard(MODES.find((m) => m.id === this.state.mode), 'NEBULA · ' + MODES.find((m) => m.id === this.state.mode).key);
      this.ui.hint();
    }, 500);
    window.__nebula = this; // for debugging / automated checks
    return true;
  }

  fatal(msg) {
    document.getElementById('veil').classList.add('done');
    document.getElementById('fatal').hidden = false;
    document.getElementById('fatalMsg').textContent = msg;
  }

  // ------------------------------------------------------------------
  // State changes
  // ------------------------------------------------------------------
  beginTransition(dur = 1.8) {
    this.lookFrom = { ...this.look };
    COLOR_KEYS.forEach((k) => this.colFrom[k].copy(this.pal[k]));
    this.trans.p = 0;
    this.trans.dur = dur;
  }

  setMode(mode, { user = false, colors = true, silent = false, dur = 1.8 } = {}) {
    if (!MODE_IDS.includes(mode)) return;
    if (user && this.demo.on) this.toggleDemo(false);
    const changed = mode !== this.state.mode;
    this.state.mode = mode;
    if (user) this.state.preset = PRESETS.find((p) => p.mode === mode && JSON.stringify(p.colors) === JSON.stringify(PALETTES[mode]))?.id || null;
    this.beginTransition(dur);
    this.lookTo = lookFor(mode);
    if (colors) { this.state.colors = { ...PALETTES[mode] }; this.setColorTargets(); }
    else this.setColorTargets();
    if (changed) {
      this.time.rebirth = 0;
      if (mode === 'rebirth') this.time.rebirth = 0;
      if (!silent) this.ui.titleCard(MODES.find((m) => m.id === mode));
      this.trans.pulse = 1;
    }
    this.ui.sync();
  }

  setColorTargets() {
    COLOR_KEYS.forEach((k) => this.colTo[k].set(this.state.colors[k]));
  }

  applyPreset(id, { user = false, dur = 2.0 } = {}) {
    const p = PRESETS.find((x) => x.id === id);
    if (!p) return;
    if (user && this.demo.on) this.toggleDemo(false);
    const count = this.state.params.count;
    this.state.params = { ...DEFAULTS, count, mouse: this.state.params.mouse, audioSens: this.state.params.audioSens, ...p.params };
    this.state.colors = { ...p.colors };
    this.state.preset = id;
    this.state.variant = { ...this.state.variant, twist: 1, lx: 0, ly: 0, aur: 1 };
    const label = `PRESET · ${p.en.toUpperCase()}`;
    const m = MODES.find((x) => x.id === p.mode);
    this.setMode(p.mode, { colors: false, silent: true, dur });
    this.ui.titleCard({ ...m, name: p.name, en: m.en }, label);
    this.trans.pulse = 1;
    this.flash = Math.max(this.flash, 0.12);
    this.audio.sensitivity = this.state.params.audioSens;
    this.ui.sync();
  }

  applyPresetColorsNow() {
    COLOR_KEYS.forEach((k) => { this.pal[k].set(this.state.colors[k]); this.colFrom[k].copy(this.pal[k]); this.colTo[k].copy(this.pal[k]); });
  }

  setParam(key, v) {
    this.state.params[key] = v;
    if (key === 'count') this.applyCount();
    if (key === 'audioSens') this.audio.sensitivity = v;
    this.state.preset = null;
    if (key === 'mouse') this.ui.sync();
  }

  setColor(key, hex) {
    this.state.colors[key] = hex;
    this.pal[key].set(hex);
    this.colTo[key].set(hex);
    this.colFrom[key].set(hex);
    this.state.preset = null;
    this.ui.sync();
  }

  applyCount() {
    if (!this.particles) return;
    const scale = this.adaptive ? this.adaptive.particleScale : 1;
    const want = this.studioOn ? this.studio.cfg.particles.count : this.state.params.count;
    this.particles.setCount(want * scale);
  }

  // ------------------------------------------------------------------
  // Creative Studio
  // ------------------------------------------------------------------
  setStudio(on, { silent = false } = {}) {
    if (on === this.studioOn) return;
    if (on && this.demo.on) this.toggleDemo(false);
    this.studioOn = on;
    document.body.classList.toggle('is-studio', on);
    try { localStorage.setItem('nebula.lastMode', on ? 'studio' : 'showcase'); } catch (e) { /* ignore */ }
    this.beginTransition(1.8);
    this.lookTo = on ? studioLook(this.studio) : lookFor(this.state.mode);
    if (!on) {
      this.setDrawMode(false);
      this.studio.clearFx();
      this.setColorTargets();
    }
    this.paths.group.visible = on;
    this.trans.pulse = 1;
    this.applyCount();
    this.ui.closePanels();
    if (!silent) this.ui.titleCard(on ? { key: 'S', name: '创作工作室', en: '3D CREATIVE STUDIO' } : MODES.find((m) => m.id === this.state.mode), on ? 'STUDIO' : undefined);
    this.studioUI.sync();
    this.ui.sync();
  }

  setDrawMode(on) {
    this.studio.drawMode = on;
    this.ia.drawMode = on;
    if (on && matchMedia('(max-width: 760px)').matches) this.studioUI.openTool(null);
    if (on) this.ui.toast('绘制模式已开启：按住拖动画出飞行路径', 2600);
    this.studioUI.sync();
  }

  // Smoothly animate a studio value (used by one-tap gather / scatter).
  animateStudio(path, to, dur = 1) {
    const from = this.studio.get(path);
    this.tweens = this.tweens.filter((t) => t.path !== path);
    this.tweens.push({ path, from, to, t: 0, dur });
  }

  resetDefaults() {
    const count = TIER_SETTINGS[this.state.quality === 'auto' ? this.autoTier : this.state.quality].defaultParticles;
    this.state.params = { ...DEFAULTS, count };
    this.state.colors = { ...PALETTES[this.state.mode] };
    this.state.variant = { ...this.state.variant, twist: 1, lx: 0, ly: 0, aur: 1 };
    this.setColorTargets();
    this.beginTransition(1.2);
    this.lookTo = lookFor(this.state.mode);
    this.ia.resetView();
    this.audio.sensitivity = 1;
    this.applyCount();
    this.ui.sync();
    this.ui.toast('已恢复默认设置');
  }

  setQuality(q) {
    this.state.quality = q;
    const tierName = q === 'auto' ? this.autoTier : q;
    const ts = TIER_SETTINGS[tierName];
    this.adaptive.enabled = q === 'auto';
    this.adaptive.baseDpr = ts.dpr;
    if (q !== 'auto') { this.adaptive.dprScale = 1; this.adaptive.particleScale = 1; }
    this.post.bloomScale = ts.bloomScale;
    const max = Math.min(ts.maxParticles, this.particles.max);
    this.ui.setSliderMax('count', max);
    this.state.params.count = Math.min(this.state.params.count, max);
    this.applyCount();
    this.resize();
    this.updateQualityNote();
    this.ui.sync();
  }

  updateQualityNote() {
    const names = { high: '高', mid: '中', low: '低' };
    this.ui.qualityNote(`检测到设备档位：${names[this.autoTier]}${this.mobile ? '（移动设备）' : ''}。自动模式会在帧率不足时降低像素密度与粒子数量，优先保证流畅。`);
  }

  // ------------------------------------------------------------------
  // Random art
  // ------------------------------------------------------------------
  randomize() {
    if (this.demo.on) this.toggleDemo(false);
    const R = Math.random;
    const h = R();
    const schemes = [[0.08, -0.08], [0.33, 0.66], [0.5, 0.15], [0.12, 0.55], [-0.15, 0.42]];
    const [d1, d2] = schemes[Math.floor(R() * schemes.length)];
    const hsl = (hh, s, l) => '#' + new THREE.Color().setHSL(((hh % 1) + 1) % 1, s, l).getHexString();
    const colors = {
      bg: hsl(h + 0.5, 0.55, 0.012 + R() * 0.01),
      body: hsl(h + 0.02, 0.6 + R() * 0.3, 0.86 + R() * 0.06),
      particle: hsl(h, 0.75 + R() * 0.2, 0.55 + R() * 0.1),
      accent: hsl(h + d1, 0.8, 0.6),
      glow: hsl(h + d2, 0.65, 0.72),
    };
    const pick = (a, b) => a + R() * (b - a);
    const modeWeights = ['butterfly', 'butterfly', 'tunnel', 'tunnel', 'universe', 'burst', 'aurora', 'rebirth'];
    const mode = modeWeights[Math.floor(R() * modeWeights.length)];
    this.state.params = {
      ...this.state.params,
      size: pick(0.8, 1.5), speed: pick(0.6, 1.6), spread: pick(0.8, 1.5), glow: pick(0.8, 1.4),
      scale: pick(0.85, 1.3), flap: pick(0.6, 1.6), rotate: pick(-0.9, 0.9), light: pick(0.8, 1.4),
      bloom: pick(0.8, 1.5), dof: pick(0.2, 0.8), blur: pick(0, 0.6), anim: pick(0.8, 1.3),
      mouse: ['repel', 'attract', 'swirl'][Math.floor(R() * 3)],
    };
    this.state.colors = colors;
    this.state.variant = { twist: pick(-2.2, 2.2), lx: pick(-4, 4), ly: pick(-2.5, 2.5), aur: pick(0.6, 1.6), seed: Math.floor(R() * 1e9) };
    this.state.preset = null;
    this.particles.build(this.state.variant.seed);
    this.applyCount();
    this.env.randomizeRings();
    this.setMode(mode, { colors: false, silent: true, dur: 1.6 });
    this.ui.titleCard({ ...MODES.find((m) => m.id === mode), name: '随机艺术', en: `SEED ${this.state.variant.seed.toString(36).toUpperCase()}` }, 'GENERATIVE');
    this.flash = 0.25;
    this.trans.pulse = 1;
    this.ui.sync();
  }

  // ------------------------------------------------------------------
  // Demo / pause / fullscreen
  // ------------------------------------------------------------------
  toggleDemo(force) {
    this.demo.on = force ?? !this.demo.on;
    this.demo.t = 0;
    if (this.demo.on) {
      const idx = DEMO_SEQUENCE.indexOf(this.state.preset);
      this.demo.i = idx >= 0 ? idx + 1 : 0;
      this.nextDemo();
      this.ui.toast('自动演示已开启 · 每 12 秒切换场景');
    } else this.ui.toast('自动演示已关闭');
    this.ui.sync();
  }

  nextDemo() {
    const id = DEMO_SEQUENCE[this.demo.i % DEMO_SEQUENCE.length];
    this.demo.i++;
    this.demo.t = 0;
    this.applyPreset(id, { dur: 2.6 });
    this.flash = 0.3;
    this.ia.zoomT = 1;
  }

  togglePause(force) {
    this.paused = force ?? !this.paused;
    document.body.classList.toggle('paused', this.paused);
  }

  toggleFullscreen(force) {
    const el = document.documentElement;
    const fsEl = document.fullscreenElement || document.webkitFullscreenElement;
    const want = force ?? !(fsEl || document.body.classList.contains('immersive'));
    const canFs = !!(el.requestFullscreen || el.webkitRequestFullscreen);
    if (want) {
      if (canFs) {
        const p = (el.requestFullscreen || el.webkitRequestFullscreen).call(el);
        if (p && p.catch) p.catch(() => this.setImmersive(true));
      }
      this.setImmersive(true);
      this.ui.closePanels();
      this.ui.toast(canFs ? '已进入全屏 · 移动鼠标到边缘显示控制栏 · Esc 退出' : '沉浸模式 · 点击右上角退出', 2600);
    } else {
      if (fsEl) (document.exitFullscreen || document.webkitExitFullscreen).call(document);
      this.setImmersive(false);
    }
  }

  setImmersive(on) {
    document.body.classList.toggle('immersive', on);
    if (!on) document.body.classList.remove('peek');
  }

  // ------------------------------------------------------------------
  // Audio / capture / config
  // ------------------------------------------------------------------
  async audioFile(file) {
    try {
      await this.audio.playFile(file);
      this.ui.audioStatus(`正在播放：${file.name}`, 'file');
    } catch (e) { this.ui.toast('无法播放该音频：' + (e.message || e)); }
  }
  async audioMic() {
    try {
      await this.audio.useMic();
      this.ui.audioStatus('麦克风输入中 · 对着设备播放音乐试试', 'mic');
    } catch (e) { this.ui.toast('无法使用麦克风：' + (e.message || '权限被拒绝')); }
  }
  audioDemo() {
    try {
      this.audio.playDemo();
      this.ui.audioStatus('内置合成音轨 · 120 BPM', 'demo');
    } catch (e) { this.ui.toast(e.message); }
  }
  audioStop() {
    this.audio.stop();
    this.ui.audioStatus('未连接音频 · 场景正常运行', null);
  }

  onBeat(v) {
    const m = this.state.mode;
    this.flash = Math.max(this.flash, m === 'burst' ? 0.1 : 0.04);
    if (m === 'burst' || (v > 0.55 && Math.random() < 0.35)) {
      this.triggerBurst(this.butterfly.pos.clone(), 0.45 + v * 0.4);
    }
  }

  async screenshot() {
    try {
      const name = await this.capture.requestScreenshot();
      this.ui.toast(`已导出 PNG：${name}`);
    } catch (e) { this.ui.toast('截图失败：' + e.message); }
  }

  async toggleRecord() {
    if (this.capture.recording) {
      const name = await this.capture.stop();
      this.ui.recording(false);
      this.studioUI.recording(false);
      if (name) this.ui.toast(`录制完成，已下载：${name}`, 3200);
      return;
    }
    try {
      this.capture.start(this.audio.source !== 'none' ? this.audio.stream : null);
      this.ui.recording(true);
      this.studioUI.recording(true);
      this.ui.toast('开始录制 · 再次点击停止并下载');
    } catch (e) { this.ui.toast(e.message); }
  }

  configJSON() {
    return { app: 'NEBULA', v: 1, mode: this.state.mode, preset: this.state.preset, params: this.state.params, colors: this.state.colors, variant: this.state.variant };
  }

  async copyConfig() {
    const cfg = this.configJSON();
    const b64 = btoa(unescape(encodeURIComponent(JSON.stringify(cfg)))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
    const url = `${location.origin}${location.pathname}#c=${b64}`;
    const text = `${JSON.stringify(cfg, null, 2)}\n\n分享链接：${url}`;
    history.replaceState(null, '', '#c=' + b64);
    try {
      await navigator.clipboard.writeText(text);
      this.ui.toast('已复制当前场景配置和分享链接');
    } catch (e) {
      const ta = document.createElement('textarea');
      ta.value = text; document.body.appendChild(ta); ta.select();
      const ok = document.execCommand && document.execCommand('copy');
      ta.remove();
      this.ui.toast(ok ? '已复制当前场景配置和分享链接' : '复制失败，请检查浏览器剪贴板权限');
    }
  }

  loadFromHash() {
    const m = location.hash.match(/#c=([\w-]+)/);
    if (!m) return;
    try {
      const json = decodeURIComponent(escape(atob(m[1].replace(/-/g, '+').replace(/_/g, '/'))));
      const cfg = JSON.parse(json);
      if (cfg.mode && MODE_IDS.includes(cfg.mode)) this.state.mode = cfg.mode;
      if (cfg.params) for (const k of Object.keys(DEFAULTS)) {
        if (cfg.params[k] === undefined) continue;
        if (RANGES[k]) this.state.params[k] = clamp(+cfg.params[k], RANGES[k][0], RANGES[k][1]);
        else if (k === 'mouse' && ['repel', 'attract', 'swirl'].includes(cfg.params[k])) this.state.params.mouse = cfg.params[k];
      }
      if (cfg.colors) for (const k of COLOR_KEYS) if (/^#[0-9a-f]{6}$/i.test(cfg.colors[k])) this.state.colors[k] = cfg.colors[k];
      if (cfg.variant) this.state.variant = { ...this.state.variant, ...cfg.variant };
      this.state.preset = cfg.preset || null;
    } catch (e) { console.warn('无法解析分享配置', e); }
  }

  // ------------------------------------------------------------------
  // Input
  // ------------------------------------------------------------------
  pointerWorld(ndc, anchor) {
    this._ray.setFromCamera(ndc, this.camera);
    this.camera.getWorldDirection(this._tmp);
    this._plane.setFromNormalAndCoplanarPoint(this._tmp, anchor);
    const hit = this._ray.ray.intersectPlane(this._plane, this._tmp2);
    return hit ? hit.clone() : anchor.clone();
  }

  triggerBurst(origin, power = 1) {
    this.time.burst = 0;
    this.particles.uniforms.uBurstO.value.copy(origin);
    this.particles.uniforms.uBurstPow.value = power * this.state.params.spread;
  }

  onTap(ndc) {
    if (this.butterfly.hitTest(ndc, this.camera)) {
      this.butterfly.triggerFlutter();
      this.triggerBurst(this.butterfly.pos.clone(), 1.25);
      this.flash = Math.max(this.flash, 0.1);
      return;
    }
    const anchor = this.state.mode === 'tunnel' ? new THREE.Vector3(0, 0, 0) : this.butterfly.pos;
    const p = this.pointerWorld(ndc, anchor);
    this.triggerBurst(p, 1);
    this.flash = Math.max(this.flash, 0.05);
    if (this.state.mode === 'burst') this.time.ring = Math.floor(this.time.ring) + 0.999;
  }

  bindGlobal() {
    let rt;
    const onResize = () => { cancelAnimationFrame(rt); rt = requestAnimationFrame(() => this.resize()); };
    window.addEventListener('resize', onResize);
    window.addEventListener('orientationchange', () => setTimeout(() => this.resize(), 250));
    window.visualViewport?.addEventListener('resize', onResize);
    const onFs = () => {
      const fs = !!(document.fullscreenElement || document.webkitFullscreenElement);
      document.body.classList.toggle('fs', fs);
      if (!fs && document.body.classList.contains('immersive') && this._wasFs) this.setImmersive(false);
      this._wasFs = fs;
      setTimeout(() => this.resize(), 60);
    };
    document.addEventListener('fullscreenchange', onFs);
    document.addEventListener('webkitfullscreenchange', onFs);
    let peekT;
    window.addEventListener('pointermove', (e) => {
      if (!document.body.classList.contains('immersive')) return;
      const edge = e.clientY < 110 || e.clientY > innerHeight - 110;
      if (edge || e.pointerType !== 'mouse') {
        document.body.classList.add('peek');
        clearTimeout(peekT);
        peekT = setTimeout(() => document.body.classList.remove('peek'), 2600);
      }
    });
    window.addEventListener('keydown', (e) => {
      if (e.target.closest && e.target.closest('input, textarea')) return;
      const k = e.key.toLowerCase();
      if (k === 't') { this.setStudio(!this.studioOn); return; }
      if (this.studioOn) {
        const S = this.studio;
        if ((e.ctrlKey || e.metaKey) && k === 'z') { e.preventDefault(); (e.shiftKey ? S.redo() : S.undo()); this.studioUI.sync(); return; }
        if ((e.ctrlKey || e.metaKey) && k === 'y') { e.preventDefault(); S.redo(); this.studioUI.sync(); return; }
        if ((e.ctrlKey || e.metaKey) && k === 's') { e.preventDefault(); this.studioUI.openTool('works'); return; }
        if (k >= '1' && k <= '7') { const t = this.studioUI.TOOLS[+k - 1].id; this.studioUI.openTool(this.studioUI.tool === t ? null : t); return; }
        if (k === 'r') { S.randomize(); this.studioUI.sync(); return; }
        if (k === 'b') { this.setDrawMode(!S.drawMode); return; }
        if (k === 'escape') { if (S.drawMode) this.setDrawMode(false); else this.studioUI.openTool(null); if (!document.fullscreenElement) this.setImmersive(false); return; }
        if (k === 'f') { this.toggleFullscreen(); return; }
        if (k === ' ') { e.preventDefault(); this.togglePause(); return; }
        if (k === 's') { this.screenshot(); return; }
        if (k === 'h') { this.setImmersive(!document.body.classList.contains('immersive')); return; }
        return;
      }
      if (k >= '1' && k <= '6') this.setMode(MODE_IDS[+k - 1], { user: true });
      else if (k === ' ') { e.preventDefault(); this.togglePause(); }
      else if (k === 'f') this.toggleFullscreen();
      else if (k === 'r') this.randomize();
      else if (k === 'd') this.toggleDemo();
      else if (k === 's') this.screenshot();
      else if (k === 'h') this.setImmersive(!document.body.classList.contains('immersive'));
      else if (k === 'p') this.ui.togglePanel('left');
      else if (k === 'c') this.ui.togglePanel('right');
      else if (k === 'escape') { this.ui.closePanels(); if (!document.fullscreenElement) this.setImmersive(false); }
    });
    document.addEventListener('visibilitychange', () => { if (!document.hidden) this.clock.getDelta(); });
    window.addEventListener('pagehide', () => this.dispose());
  }

  resize() {
    const vv = window.visualViewport;
    const w = Math.round(vv ? Math.min(innerWidth, vv.width * (vv.scale || 1)) : innerWidth) || innerWidth;
    const h = innerHeight;
    const dpr = this.adaptive.dpr;
    this.renderer.setPixelRatio(dpr);
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.post.setSize(w, h, dpr);
    this.post.feedback.reset = true;
    this.env.bgUniforms.uAspect.value = w / h;
    this.size = { w, h, dpr };
  }

  // ------------------------------------------------------------------
  // Frame
  // ------------------------------------------------------------------
  // Debug helper: advance the simulation without rendering (used for automated checks).
  advance(seconds, step = 1 / 30) {
    for (let t = 0; t < seconds; t += step) this.frame(step, true);
  }

  // Effective parameters: showcase params, or the studio configuration.
  effective() {
    const P = this.state.params;
    if (!this.studioOn) {
      return { speed: P.speed, size: P.size, spread: P.spread, glow: P.glow, dof: P.dof, blur: P.blur, bloom: P.bloom, light: P.light,
        flap: P.flap, scale: P.scale, rotate: P.rotate, anim: P.anim, opacity: 1, exposure: 1, saturation: 1, rt: 0.3, ambient: 1, mainLight: 1 };
    }
    const c = this.studio.cfg;
    return {
      speed: c.particles.speed, size: c.particles.size, spread: c.particles.spread, glow: c.particles.glow, dof: c.visual.dof, blur: c.visual.blur,
      bloom: c.visual.bloom, light: c.scene.light * c.visual.mainLight, flap: c.butterfly.flap, scale: c.butterfly.size,
      rotate: c.visual.orbitSpeed * (c.visual.autoOrbit ? 1 : 0), anim: 1, opacity: c.particles.opacity, exposure: c.visual.exposure,
      saturation: c.visual.saturation, rt: c.visual.rt, ambient: c.scene.ambient * c.visual.ambient, mainLight: c.visual.mainLight,
    };
  }

  // Studio flyers: where butterfly k (0 = main) should be, if paths exist.
  flyerTarget(k) {
    const list = this.paths.paths;
    if (!this.studioOn || !list.length) return null;
    const path = list[k % list.length];
    const slot = Math.floor(k / list.length);
    return this.paths.sample(path, slot * 0.055);
  }

  frame(forcedDt, skipRender = false) {
    if (this.contextLost) return;
    const rawDt = forcedDt ?? this.clock.getDelta();
    const dt = Math.min(rawDt, 1 / 20);
    const E = this.effective();
    const SO = this.studioOn;
    const SC = this.studio.cfg;
    const T = this.time;

    // FPS + adaptive quality
    this.fps.acc += rawDt; this.fps.n++;
    if (this.fps.acc >= 0.5) {
      this.fps.val = Math.round(this.fps.n / this.fps.acc);
      this.fps.acc = 0; this.fps.n = 0;
      const ad = this.adaptive;
      const degraded = ad.state === 'degraded';
      this.ui.hud({
        fps: this.fps.val, count: this.particles.count,
        state: this.paused ? '已暂停' : degraded ? `自适应 ${Math.round(ad.dprScale * 100)}%` : '渲染中',
        warn: degraded, idle: this.paused,
      });
      if (SO) {
        const c = this.particles.count;
        this.studioUI.hud(`FPS ${this.fps.val} · 粒子 ${c >= 1000 ? (c / 1000).toFixed(1) + 'k' : c} · 蝴蝶 ${SC.butterfly.count} · 轨迹 ${this.paths.paths.length}${this.paused ? ' · 已暂停' : ''}`);
      }
    }
    if (!forcedDt) this.adaptive.update(rawDt);

    this.ia.update(dt);
    const band = this.audio.update(dt);
    this.ui.meters(band);
    const bass = band.bass, mid = band.mid, treble = band.treble;

    // Demo sequencing
    if (this.demo.on && !this.paused) {
      this.demo.t += dt;
      if (this.demo.t >= DEMO_INTERVAL) this.nextDemo();
    }

    // Studio tweens (one-tap gather/scatter)
    if (this.tweens.length) {
      this.tweens = this.tweens.filter((tw) => {
        tw.t = Math.min(1, tw.t + dt / tw.dur);
        this.studio.set(tw.path, tw.from + (tw.to - tw.from) * ease(tw.t), { commit: tw.t >= 1 });
        return tw.t < 1;
      });
      this.studioUI.sync();
    }
    this.studio.update(dt);
    const sceneLive = this.studio.updateScene(dt);

    // Transition easing for look + colors
    if (this.trans.p < 1) {
      this.trans.p = Math.min(1, this.trans.p + dt / this.trans.dur);
      const e = ease(this.trans.p);
      if (SO) this.lookTo = studioLook(this.studio);
      for (const k of LOOK_KEYS) this.look[k] = this.lookFrom[k] + (this.lookTo[k] - this.lookFrom[k]) * e;
      if (!SO) COLOR_KEYS.forEach((k) => this.pal[k].lerpColors(this.colFrom[k], this.colTo[k], e));
    } else if (SO) {
      const tgt = studioLook(this.studio);
      const k = 1 - Math.exp(-dt * 2);
      for (const key of LOOK_KEYS) this.look[key] += (tgt[key] - this.look[key]) * k;
    }
    if (SO) this.studioPalette(dt);
    // Environment colours: palette in showcase, scene colours in studio
    {
      const k = 1 - Math.exp(-dt * 3);
      this.env.envA.lerp(SO ? sceneLive.a : this.pal.particle, k);
      this.env.envB.lerp(SO ? sceneLive.b : this.pal.accent, k);
      this.studioEnv.colA.copy(sceneLive.a);
      this.studioEnv.colB.copy(sceneLive.b);
    }
    this.trans.pulse = Math.max(0, this.trans.pulse - dt * 0.9);
    const pulse = Math.sin(Math.min(1, 1 - this.trans.pulse) * Math.PI) * (this.trans.pulse > 0 ? 1 : 0);
    this.flash = Math.max(0, this.flash - dt * 1.6);
    this.shake = Math.max(0, this.shake - dt * 1.4);
    const d = this.look;
    const ws = d.w6;

    // Clocks
    const anim = this.paused ? 0 : E.anim;
    const adt = dt * anim;
    T.sim += adt;
    T.p += adt * E.speed;
    T.tunnel += adt * (SO ? 1 : E.speed) * d.tunnelSpeed * (1 + bass * 0.8);
    T.spin += adt * (SO ? 0.15 : E.rotate) * 0.12;
    T.morph += adt * E.speed * 0.085;
    T.ring += adt * (0.9 + bass * 1.5) * E.speed;
    T.rebirth = (T.rebirth + adt / 11) % 1;
    T.burst += adt * Math.max(0.4, E.speed);
    T.orbit += adt * E.rotate * 0.14 * d.orbit;
    if (!this.paused) T.frame++;

    // Automatic flutter in the butterfly mode ("特定动作")
    if (!SO && this.state.mode === 'butterfly' && !this.paused) {
      this.autoFlutter -= adt;
      if (this.autoFlutter <= 0) {
        this.autoFlutter = 13 + Math.random() * 6;
        this.butterfly.triggerFlutter();
        this.triggerBurst(this.butterfly.pos.clone(), 0.9);
      }
    }

    // ---- Camera
    const ia = this.ia;
    const aspect = this.camera.aspect;
    const fit = aspect < 1 ? Math.pow(1 / Math.max(aspect, 0.42), 0.72) : 1;
    const zoom = ia.zoom * (SO ? SC.visual.zoom : 1);
    const dist = d.camDist * zoom * fit * (1 + pulse * 0.18);
    const swing = SO ? 0 : (1 - d.orbit) * 0.22 * Math.sin(T.sim * 0.11) * Math.sign(E.rotate || 1) * Math.min(1, Math.abs(E.rotate) * 2.5);
    const camRot = SO ? THREE.MathUtils.degToRad(SC.visual.camRot) : 0;
    const yaw = ia.yaw + T.orbit + swing + camRot + ia.smoothNdc.x * 0.1 * ia.active * (this.ia.drawMode ? 0 : 1);
    const pitch = clamp(ia.pitch + 0.04 + ia.smoothNdc.y * 0.06 * ia.active * (this.ia.drawMode ? 0 : 1) + (d.orbit > 0.5 && !SO ? 0.12 : 0), -1.2, 1.2);
    this._tmp.set(
      Math.sin(yaw) * Math.cos(pitch) * dist,
      Math.sin(pitch) * dist + d.camLift,
      Math.cos(yaw) * Math.cos(pitch) * dist,
    );
    if (this.shake > 0) this._tmp.add(this._tmp2.set(Math.random() - 0.5, Math.random() - 0.5, Math.random() - 0.5).multiplyScalar(this.shake * 0.5));
    const camK = SO ? 1 - Math.exp(-dt * 4 * SC.visual.camSpeed) : 1;
    this.camera.position.lerp(this._tmp, forcedDt ? 1 : camK);
    this.camera.lookAt(0, d.camLift * 0.4, 0);
    this.camera.updateMatrixWorld();

    // ---- Pointer world position (on a plane through the butterfly)
    if (SO && !this.paths.paths.length) {
      const f = SC.butterfly.flight;
      this._bpos.set(Math.sin(T.sim * 0.27 * f) * 2.2, Math.sin(T.sim * 0.41 * f) * 0.9, Math.cos(T.sim * 0.23 * f) * 1.6).multiplyScalar(ws);
    } else this._bpos.set(d.bx, d.by, d.bz);
    const anchor = d.w3 > 0.5 ? this._bpos : this.butterfly.pos;
    this._mouseW.copy(this.pointerWorld(ia.smoothNdc, anchor));
    const coarse = this.mobile;
    const presence = (coarse ? (ia.pointers.size ? ia.active : 0) : ia.active) * (ia.drawMode ? 0 : 1);
    this._follow.subVectors(this._mouseW, this._bpos).multiplyScalar(0.22 * presence);
    if (this._follow.length() > 2.4) this._follow.setLength(2.4);
    if (this.trailPending) {
      this.trailPending = false;
      const live = this.pointerWorld(ia.ndc, anchor);
      if ((!coarse || ia.pointers.size) && !ia.drawing) this.trail.emit(live, Math.round(3 + ia.speed * 6));
    }

    // ---- Paths + flyers
    if (SO) this.paths.update(adt, T.sim, 1);
    const mainTarget = this.flyerTarget(0);
    let override = null;
    if (mainTarget) {
      override = this._override || (this._override = { pos: new THREE.Vector3(), quat: new THREE.Quaternion() });
      override.pos.copy(mainTarget.pos);
      Swarm.headingQuat(mainTarget.tangent, override.quat, this._headTmp || (this._headTmp = { x: new THREE.Vector3(), y: new THREE.Vector3(), z: new THREE.Vector3(), m: new THREE.Matrix4() }));
    }

    // ---- Butterfly
    const fx = this.studio.fx;
    this.butterfly.update(dt, T.sim, {
      flapSpeed: E.flap, scale: E.scale, follow: this._follow, wing: d.wing,
      echo: d.echo, echoSpread: d.echoSpread, bass, anim, basePos: this._bpos, sway: d.sway,
      override, extraScale: SO ? fx.extra : 1,
    });
    const BU = this.butterfly.uniforms;
    let dis = this.butterfly.dissolve;
    if (d.w5 > 0.01) {
      const r = T.rebirth;
      const rebirthDissolve = THREE.MathUtils.smoothstep(r, 0.14, 0.34) * (1 - THREE.MathUtils.smoothstep(r, 0.74, 0.94));
      dis = Math.max(dis, rebirthDissolve * d.w5);
    }
    if (SO) dis = Math.max(dis, fx.dissolve);
    BU.uDissolve.value = Math.min(1, dis);
    this.butterfly.bodyUniforms.uOpacity.value = Math.max(0, 1 - dis * 1.6);
    this.butterfly.body.visible = dis < 0.6;
    this.butterfly.wings.visible = dis < 0.995;
    BU.uBright.value = 0.95 * Math.sqrt(E.light) * (1 + bass * 0.25 + this.butterfly.flutter * 0.4) * (SO ? 0.55 + 0.45 * E.ambient : 1);
    if (SO) {
      BU.uMat.value = MATERIALS.find((m) => m.id === SC.butterfly.material).i;
      BU.uPattern.value = PATTERNS.find((m) => m.id === SC.butterfly.pattern).i;
      BU.uRainbow.value = SC.butterfly.color === 'rainbow' ? 1 : 0;
      BU.uGlowAmt.value = SC.butterfly.glow;
      BU.uSpec.value = 0.2 + SC.visual.rt * 0.8;
    } else {
      BU.uMat.value = 0; BU.uPattern.value = 0; BU.uRainbow.value = 0; BU.uGlowAmt.value = 1; BU.uSpec.value = 0.15;
      this.butterfly.setShape('classic');
    }

    // ---- Swarm
    this.swarm.converge = SO ? fx.converge : 0;
    this.swarm.update(dt, T.sim, {
      count: SO ? Math.max(0, SC.butterfly.count - 1) : 0, flapSpeed: E.flap, flight: SO ? SC.butterfly.flight : 1,
      scale: E.scale, anim, center: this.butterfly.pos,
      target: this.paths.paths.length && SO ? (i) => this.flyerTarget(i + 1) : null,
    });
    // spark trails behind flyers on paths
    if (SO && this.paths.paths.length && !this.paused) {
      const n = Math.min(SC.butterfly.count, 10);
      for (let k = 0; k < n; k++) {
        const tg = this.flyerTarget(k);
        if (!tg) break;
        const path = this.paths.paths[k % this.paths.paths.length];
        this.trail.emit(tg.pos, 1, path.uniforms.uColor.value, 'fly' + k);
      }
    }

    // ---- Particles
    const U = this.particles.uniforms;
    U.uTime.value = T.p;
    U.uPhase.value = this.butterfly.phase;
    U.uAmp.value = this.butterfly.amp;
    U.uBfly.value.copy(this.butterfly.root.matrixWorld);
    U.uSize.value = E.size * (this.mobile ? 1.15 : 1);
    U.uProj.value = this.camera.projectionMatrix.elements[5] * this.size.h * this.size.dpr * 0.5;
    U.uSpread.value = E.spread;
    U.uGlow.value = E.glow * 0.55;
    U.uOpacity.value = E.opacity;
    U.uDof.value = E.dof;
    U.uFocus.value = this.camera.position.distanceTo(this.butterfly.pos);
    U.uWA.value.set(d.w0, d.w1, d.w2);
    U.uWB.value.set(d.w3, d.w4, d.w5);
    U.uWS.value = ws;
    U.uMorph.value = T.morph;
    U.uRebirth.value = T.rebirth;
    U.uTunnelT.value = T.tunnel;
    U.uSpin.value = T.spin;
    U.uTwist.value = this.state.variant.twist;
    U.uVar.value.y = this.state.variant.aur;
    U.uBurstT.value = T.burst;
    U.uWingVis.value = 1 - Math.min(1, dis);
    U.uFormA.value = this.studio.form.a;
    U.uFormB.value = this.studio.form.b;
    U.uFormMix.value = this.studio.form.mix;
    const ang = THREE.MathUtils.degToRad(SC.particles.dirAngle);
    U.uWind.value.set(Math.cos(ang), Math.sin(ang), 0).multiplyScalar(SC.particles.dirStrength * ws);
    U.uGather.value = SC.particles.gather * ws;
    U.uDensity.value = 1 + (SC.particles.density - 1) * ws;
    U.uSCol.value.set(SC.particles.color);
    U.uFxA.value = SO ? fx.a : 0;
    U.uFxB.value = SO ? fx.b : 0;
    U.uFxMix.value = fx.mix;
    U.uFxScale.value = fx.scale;
    U.uFxBloom.value = fx.bloom;
    U.uFog.value = SO ? SC.scene.fog * ws : 0;
    U.uMouse.value.copy(this._mouseW);
    const P = this.state.params;
    const mstr = presence * (1 + ia.speed * 0.6);
    U.uMouseStr.value = P.mouse === 'repel' ? mstr : P.mouse === 'attract' ? -mstr * 0.8 : mstr * 0.15;
    U.uMouseSwirl.value = P.mouse === 'swirl' ? mstr : 0;
    U.uMouseR.value = 2.4 * E.spread * (1 + mid * 0.3);
    U.uBass.value = bass; U.uMid.value = mid; U.uTreble.value = treble;
    this.trail.uniforms.uProj.value = U.uProj.value;
    this.trail.uniforms.uGlow.value = E.glow;
    this.trail.update(dt);

    // ---- Environment
    const v = this.state.variant;
    this._light.set(v.lx * (1 - d.w3 * 0.7) * (1 - ws), v.ly * (1 - d.w3 * 0.7) * (1 - ws), -48);
    const dEnv = SO ? { ...d, rings: d.rings + (fx.ring || 0), core: d.core + fx.core } : d;
    this.env.update(dt, T.sim, dEnv, {
      tunnelT: T.tunnel, spin: T.spin, twist: SO ? 1 : v.twist, camera: this.camera, spread: SO ? SC.scene.depth : E.spread,
      bass, light: E.light, lightPos: this._light, ringT: T.ring,
    });
    const bgU = this.env.bgUniforms;
    bgU.uYaw.value = yaw;
    bgU.uPitch.value = pitch;
    const mixv = (a, b) => a + (b - a) * ws;
    bgU.uNebula.value = mixv(1, sceneLive.nebula);
    bgU.uStars.value = mixv(1, sceneLive.stars);
    bgU.uAurora.value = sceneLive.aurora * ws;
    bgU.uSpot.value = sceneLive.spot * ws;
    bgU.uHaze.value = SC.scene.fog * ws;
    bgU.uBright.value = mixv(1, E.ambient);
    this.env.frameUniforms.uBright.value *= mixv(1, E.ambient);
    this.studioEnv.update(dt, T.sim, {
      grid: sceneLive.grid * ws, mist: sceneLive.mist * ws, gridSpeed: sceneLive.gridSpeed, crystals: sceneLive.crystals * ws,
      forest: sceneLive.forest * ws, dust: sceneLive.dust * ws, dustMode: sceneLive.dustMode, dustCol: sceneLive.dustCol,
      fog: SC.scene.fog, ambient: E.ambient, depth: SC.scene.depth,
    }, U.uProj.value);

    // ---- Post
    const lp = this._tmp.copy(this._light).project(this.camera);
    const lx = lp.x * 0.5 + 0.5, ly = lp.y * 0.5 + 0.5;
    const behind = lp.z > 1 ? 0 : 1;
    const rtBoost = SO ? 0.5 + E.rt * 1.1 : 1;
    const po = this.post;
    po.rays.uniforms.uLight.value.set(lx, ly);
    po.rays.uniforms.uStrength.value = dEnv.rays * E.light * 0.55 * rtBoost * (1 + bass * 0.6) * behind;
    po.rays.uniforms.uTime.value = T.frame % 100;
    po.bloom.strength = E.bloom * 0.62 * (1 + bass * 0.35 + this.flash * 0.8);
    po.bloom.radius = 0.42 + 0.08 * E.bloom;
    po.feedback.amount = clamp(E.blur, 0, 0.95);
    const F = po.final.uniforms;
    F.uTime.value = T.sim;
    F.uDof.value = E.dof * 0.8;
    F.uTrans.value = pulse * 0.9;
    F.uFlash.value = this.flash * 0.5;
    F.uLight.value.set(lx, ly);
    F.uFlare.value = dEnv.core * E.light * 0.7 * behind * (SO ? 0.4 + E.rt * 0.6 : 1);
    F.uTint.value.copy(this.pal.accent);
    F.uCA.value = 0.55 + treble * 1.4 + pulse;
    F.uSat.value = E.saturation;
    this.renderer.toneMappingExposure = 0.82 * Math.pow(E.light, 0.35) * E.exposure;

    if (skipRender) return;
    po.render(dt);
    this.capture.afterRender();

    if (this.capture.recording) this.ui.hud({ rec: this.capture.elapsed });
    if (T.frame % 3 === 0) this.ui.hud({ frame: T.frame, t: T.sim });
  }

  // Live palette in the studio follows the creation settings.
  studioPalette(dt) {
    const c = this.studio.cfg;
    const k = 1 - Math.exp(-dt * 6);
    const tc = this._stc || (this._stc = { bg: new THREE.Color(), body: new THREE.Color(), particle: new THREE.Color(), accent: new THREE.Color(), glow: new THREE.Color(), hsl: {} });
    tc.bg.set(c.scene.bg);
    if (c.butterfly.color === 'rainbow') tc.body.set('#ffffff'); else tc.body.set(c.butterfly.color);
    tc.particle.set(c.particles.color);
    tc.body.getHSL(tc.hsl);
    tc.accent.setHSL((tc.hsl.h + 0.1) % 1, Math.min(1, tc.hsl.s + 0.15), 0.62);
    tc.glow.copy(tc.body).lerp(new THREE.Color(1, 1, 1), 0.55);
    COLOR_KEYS.forEach((key) => { this.pal[key].lerp(tc[key], k); this.colFrom[key].copy(this.pal[key]); });
  }

  dispose() {
    try {
      this.renderer?.setAnimationLoop(null);
      this.audio?.dispose();
      this.ia?.dispose();
      this.butterfly?.dispose();
      this.particles?.dispose();
      this.trail?.dispose();
      this.env?.dispose();
      this.post?.dispose();
      this.swarm?.dispose();
      this.paths?.dispose();
      this.studioEnv?.dispose();
      this.renderer?.dispose();
    } catch (e) { /* page is going away */ }
  }
}

function boot() {
  try {
    const gl = document.createElement('canvas').getContext('webgl2');
    if (!gl) throw new Error('浏览器未提供 WebGL 2（可能关闭了硬件加速）。');
    const app = new App();
    app.init();
  } catch (e) {
    console.error(e);
    document.getElementById('veil').classList.add('done');
    document.getElementById('fatal').hidden = false;
    document.getElementById('fatalMsg').textContent = '初始化失败：' + (e.message || e);
  }
}
boot();
