import * as THREE from 'three';

// ---------------------------------------------------------------------------
// Creative Studio — catalogue
// ---------------------------------------------------------------------------
export const BFLY_COLORS = [
  { id: 'ice', name: '冰蓝', hex: '#8fd8ff' },
  { id: 'violet', name: '紫色', hex: '#b27bff' },
  { id: 'gold', name: '金色', hex: '#f6cf8a' },
  { id: 'pink', name: '粉色', hex: '#ff7ab8' },
  { id: 'red', name: '红色', hex: '#ff4f5e' },
  { id: 'green', name: '绿色', hex: '#6dffa8' },
  { id: 'white', name: '月白', hex: '#fff1d6' },
  { id: 'rainbow', name: '彩虹', hex: 'rainbow' },
];
export const MATERIALS = [
  { id: 'luminous', name: '柔光', i: 0 }, { id: 'crystal', name: '水晶', i: 1 }, { id: 'glass', name: '玻璃', i: 2 },
  { id: 'diamond', name: '钻石', i: 3 }, { id: 'metal', name: '金属', i: 4 }, { id: 'neon', name: '霓虹', i: 5 },
  { id: 'transparent', name: '透明', i: 6 }, { id: 'holo', name: '全息', i: 7 },
];
export const PATTERNS = [
  { id: 'veins', name: '经典脉络', i: 0 }, { id: 'monarch', name: '帝王斑', i: 1 }, { id: 'morpho', name: '闪蝶渐变', i: 2 },
  { id: 'leopard', name: '豹纹', i: 3 }, { id: 'stripes', name: '虎纹', i: 4 }, { id: 'eyes', name: '孔雀眼', i: 5 },
  { id: 'lace', name: '蕾丝镂空', i: 6 }, { id: 'plain', name: '纯色', i: 7 },
];
export const SHAPES = [
  { id: 'classic', name: '经典' }, { id: 'swallow', name: '燕尾' }, { id: 'moth', name: '飞蛾' },
  { id: 'falcon', name: '隼翼' }, { id: 'lace', name: '花边' },
];
export const FORMS = [
  { id: 'stardust', name: '星尘', i: 0 }, { id: 'galaxy', name: '银河', i: 1 }, { id: 'dots', name: '光点', i: 2 },
  { id: 'meteors', name: '流星', i: 3 }, { id: 'shards', name: '能量碎片', i: 4 }, { id: 'ribbons', name: '光线丝带', i: 5 },
  { id: 'smoke', name: '烟雾', i: 6 }, { id: 'magic', name: '魔法光点', i: 7 }, { id: 'geometric', name: '几何粒子', i: 8 },
];
export const EFFECTS = [
  { id: 'dissolve', name: '化为粒子', en: 'DISSOLVE' },
  { id: 'reassemble', name: '重新聚合', en: 'REASSEMBLE' },
  { id: 'galaxy', name: '化作银河', en: 'GALAXY' },
  { id: 'crystal', name: '发光水晶', en: 'CRYSTALLIZE' },
  { id: 'beam', name: '能量光束', en: 'ENERGY BEAM' },
  { id: 'planet', name: '旋转星球', en: 'PLANET' },
  { id: 'vortex', name: '空间漩涡', en: 'VORTEX' },
  { id: 'flower', name: '发光花朵', en: 'BLOOM' },
  { id: 'converge', name: '群蝶汇聚', en: 'CONVERGENCE' },
  { id: 'explode', name: '能量爆发', en: 'SUPERNOVA' },
];

// Each scene: background, light, particles and space layers.
export const SCENES = [
  { id: 'deep', name: '深空银河', en: 'DEEP GALAXY', bg: '#02030b', a: '#4f7dff', b: '#b07bff', nebula: 1.6, stars: 1.2, aurora: 0, grid: 0, mist: 0, gridSpeed: 0, crystals: 0, forest: 0, dust: 0.8, dustMode: 0, dustCol: '#a9c4ff', tunnel: 0, tunnelSpeed: 0.05, streaks: 0, core: 0.7, rays: 0.6, spot: 0, fog: 0.1, tunnelNear: -6 },
  { id: 'dream', name: '梦幻星空', en: 'DREAM SKY', bg: '#070318', a: '#ff7ad9', b: '#7f6bff', nebula: 1.1, stars: 2, aurora: 0, grid: 0, mist: 0.3, gridSpeed: 0, crystals: 0, forest: 0, dust: 1, dustMode: 1, dustCol: '#ffd9f4', tunnel: 0, tunnelSpeed: 0.05, streaks: 0, core: 0.5, rays: 0.5, spot: 0, fog: 0.2, tunnelNear: -6 },
  { id: 'tech', name: '未来科技', en: 'FUTURE TECH', bg: '#00060c', a: '#29d8ff', b: '#3d7bff', nebula: 0.3, stars: 0.4, aurora: 0, grid: 1, mist: 0, gridSpeed: 1.5, crystals: 0, forest: 0, dust: 0.7, dustMode: 2, dustCol: '#7fe8ff', tunnel: 0.55, tunnelSpeed: 0.35, streaks: 0.5, core: 0.9, rays: 0.8, spot: 0, fog: 0.25, tunnelNear: -4 },
  { id: 'crystal', name: '水晶空间', en: 'CRYSTAL HALL', bg: '#030912', a: '#bfefff', b: '#8f9dff', nebula: 0.5, stars: 0.8, aurora: 0, grid: 0, mist: 0.25, gridSpeed: 0, crystals: 1, forest: 0, dust: 0.9, dustMode: 1, dustCol: '#e6f9ff', tunnel: 0, tunnelSpeed: 0.05, streaks: 0, core: 1.0, rays: 0.9, spot: 0, fog: 0.2, tunnelNear: -6 },
  { id: 'universe', name: '粒子宇宙', en: 'PARTICLE COSMOS', bg: '#010108', a: '#3d8bff', b: '#ff5fb7', nebula: 0.9, stars: 1.8, aurora: 0, grid: 0, mist: 0, gridSpeed: 0, crystals: 0, forest: 0, dust: 1, dustMode: 0, dustCol: '#c9d6ff', tunnel: 0.12, tunnelSpeed: 0.05, streaks: 0, core: 0.55, rays: 0.5, spot: 0, fog: 0.05, tunnelNear: -6 },
  { id: 'neon', name: '霓虹空间', en: 'NEON SPACE', bg: '#08010d', a: '#ff3fd0', b: '#29e7ff', nebula: 0.4, stars: 0.3, aurora: 0, grid: 1, mist: 0.2, gridSpeed: 2.5, crystals: 0, forest: 0, dust: 0.6, dustMode: 2, dustCol: '#ff8ae6', tunnel: 0.75, tunnelSpeed: 0.5, streaks: 0.8, core: 0.8, rays: 0.8, spot: 0, fog: 0.3, tunnelNear: -2 },
  { id: 'aurora', name: '极光世界', en: 'AURORA REALM', bg: '#010610', a: '#4ef0c0', b: '#9a63ff', nebula: 0.3, stars: 1.4, aurora: 1, grid: 0, mist: 0.35, gridSpeed: 0, crystals: 0, forest: 0, dust: 0.6, dustMode: 0, dustCol: '#9effe0', tunnel: 0, tunnelSpeed: 0.05, streaks: 0, core: 0.25, rays: 0.3, spot: 0, fog: 0.2, tunnelNear: -6 },
  { id: 'tunnel', name: '无限光线隧道', en: 'INFINITE CORRIDOR', bg: '#010309', a: '#4aa8ff', b: '#9be9ff', nebula: 0.2, stars: 0.5, aurora: 0, grid: 0, mist: 0, gridSpeed: 0, crystals: 0, forest: 0, dust: 0.3, dustMode: 0, dustCol: '#cfe9ff', tunnel: 1, tunnelSpeed: 1.2, streaks: 1, core: 1.3, rays: 1.1, spot: 0, fog: 0.05, tunnelNear: 9 },
  { id: 'forest', name: '魔法森林', en: 'ENCHANTED FOREST', bg: '#010805', a: '#5dffb0', b: '#ffd27a', nebula: 0.35, stars: 0.6, aurora: 0, grid: 0, mist: 0.8, gridSpeed: 0, crystals: 0, forest: 1, dust: 1, dustMode: 3, dustCol: '#d8ff8a', tunnel: 0, tunnelSpeed: 0.05, streaks: 0, core: 0.45, rays: 0.6, spot: 0, fog: 0.45, tunnelNear: -6 },
  { id: 'minimal', name: '纯黑极简', en: 'BLACK BOX', bg: '#000000', a: '#ffffff', b: '#bfbfbf', nebula: 0, stars: 0, aurora: 0, grid: 0, mist: 0, gridSpeed: 0, crystals: 0, forest: 0, dust: 0.15, dustMode: 0, dustCol: '#ffffff', tunnel: 0, tunnelSpeed: 0.05, streaks: 0, core: 0.15, rays: 0.3, spot: 1, fog: 0, tunnelNear: -6 },
];
const SCENE_NUM = ['nebula', 'stars', 'aurora', 'grid', 'mist', 'gridSpeed', 'crystals', 'forest', 'dust', 'dustMode', 'tunnel', 'tunnelSpeed', 'streaks', 'core', 'rays', 'spot', 'tunnelNear'];

export const STUDIO_DEFAULT = {
  butterfly: { color: '#8fd8ff', material: 'crystal', glow: 1.2, pattern: 'veins', size: 1, count: 6, shape: 'classic', flight: 1, flap: 1 },
  particles: { count: 60000, size: 1, speed: 1, density: 1, color: '#9fc8ff', opacity: 1, glow: 1, spread: 1, dirAngle: 0, dirStrength: 0, gather: 0, form: 'stardust' },
  path: { color: '#7cf3ff', width: 1, trail: 0.25, speed: 1, loop: 'loop', depth: 1 },
  scene: { id: 'deep', bg: '#02030b', ambient: 1, fog: 0.1, light: 1, depth: 1 },
  visual: { ambient: 1, mainLight: 1, bloom: 1, dof: 0.35, blur: 0.15, rt: 0.5, zoom: 1, camRot: 0, camSpeed: 1, autoOrbit: true, orbitSpeed: 0.3, exposure: 1, saturation: 1.1 },
  paths: [],
};

export const STUDIO_RANGES = {
  'butterfly.glow': [0, 3, 0.01], 'butterfly.size': [0.3, 3, 0.01], 'butterfly.count': [1, 33, 1], 'butterfly.flight': [0, 3, 0.01], 'butterfly.flap': [0, 3, 0.01],
  'particles.count': [2000, 200000, 1000], 'particles.size': [0.2, 3, 0.01], 'particles.speed': [0, 3, 0.01], 'particles.density': [0.3, 2, 0.01],
  'particles.opacity': [0, 1.5, 0.01], 'particles.glow': [0.1, 3, 0.01], 'particles.spread': [0.3, 2.5, 0.01], 'particles.dirAngle': [0, 360, 1],
  'particles.dirStrength': [0, 2, 0.01], 'particles.gather': [-1, 1, 0.01],
  'path.width': [0.3, 4, 0.01], 'path.trail': [0.02, 1, 0.01], 'path.speed': [0.1, 4, 0.01], 'path.depth': [0, 2, 0.01],
  'scene.ambient': [0, 2.5, 0.01], 'scene.fog': [0, 1.5, 0.01], 'scene.light': [0, 2.5, 0.01], 'scene.depth': [0.5, 2, 0.01],
  'visual.ambient': [0, 2, 0.01], 'visual.mainLight': [0, 2.5, 0.01], 'visual.bloom': [0, 3, 0.01], 'visual.dof': [0, 1.5, 0.01],
  'visual.blur': [0, 0.95, 0.01], 'visual.rt': [0, 1.5, 0.01], 'visual.zoom': [0.4, 2.5, 0.01], 'visual.camRot': [-180, 180, 1],
  'visual.camSpeed': [0.1, 3, 0.01], 'visual.orbitSpeed': [-2, 2, 0.01], 'visual.exposure': [0.3, 2.5, 0.01], 'visual.saturation': [0, 2, 0.01],
};

const FX_INDEX = { base: 0, scatter: 1, wing: 2, galaxy: 3, shards: 4, beam: 5, planet: 6, vortex: 7, flower: 8, giant: 9 };
const WORKS_KEY = 'nebula.works.v1';
const CURRENT_KEY = 'nebula.studio.current.v1';

const clone = (o) => JSON.parse(JSON.stringify(o));
function deepMerge(base, over) {
  const out = clone(base);
  if (!over || typeof over !== 'object') return out;
  for (const k of Object.keys(base)) {
    if (over[k] === undefined) continue;
    if (Array.isArray(base[k])) out[k] = Array.isArray(over[k]) ? clone(over[k]) : out[k];
    else if (base[k] && typeof base[k] === 'object') out[k] = deepMerge(base[k], over[k]);
    else if (typeof base[k] === typeof over[k]) out[k] = over[k];
  }
  return out;
}
function sanitize(cfg) {
  const c = deepMerge(STUDIO_DEFAULT, cfg);
  for (const [key, [min, max]] of Object.entries(STUDIO_RANGES)) {
    const [g, k] = key.split('.');
    c[g][k] = Math.min(max, Math.max(min, +c[g][k] || 0));
  }
  const ok = (list, v, d) => (list.some((x) => x.id === v) ? v : d);
  c.butterfly.material = ok(MATERIALS, c.butterfly.material, 'crystal');
  c.butterfly.pattern = ok(PATTERNS, c.butterfly.pattern, 'veins');
  c.butterfly.shape = ok(SHAPES, c.butterfly.shape, 'classic');
  c.particles.form = ok(FORMS, c.particles.form, 'stardust');
  c.scene.id = ok(SCENES, c.scene.id, 'deep');
  if (!['loop', 'pingpong', 'once'].includes(c.path.loop)) c.path.loop = 'loop';
  const hex = /^#[0-9a-f]{6}$/i;
  if (c.butterfly.color !== 'rainbow' && !hex.test(c.butterfly.color)) c.butterfly.color = STUDIO_DEFAULT.butterfly.color;
  for (const [g, k] of [['particles', 'color'], ['path', 'color'], ['scene', 'bg']]) if (!hex.test(c[g][k])) c[g][k] = STUDIO_DEFAULT[g][k];
  c.paths = (c.paths || []).filter((p) => Array.isArray(p.points) && p.points.length > 3).slice(0, 12);
  return c;
}

// ---------------------------------------------------------------------------
// Controller
// ---------------------------------------------------------------------------
export class Studio {
  constructor(app) {
    this.app = app;
    this.cfg = clone(STUDIO_DEFAULT);
    this.undoStack = [];
    this.redoStack = [];
    this.lastSnap = null;
    this.fx = { a: 0, b: 0, mix: 1, scale: 1, scaleT: 1, bloom: 1, dissolve: 0, dissolveT: 0, extra: 1, extraT: 1, converge: 0, convergeT: 0, core: 0, timers: [] };
    this.form = { a: 0, b: 0, mix: 1 };
    this.sceneLive = null; // eased numeric scene values
    this.drawMode = false;
    this.listeners = new Set();
  }

  // ---- config access -------------------------------------------------
  get(path) { const [g, k] = path.split('.'); return k ? this.cfg[g][k] : this.cfg[g]; }

  set(path, v, { commit = true } = {}) {
    const [g, k] = path.split('.');
    const prev = this.cfg[g][k];
    this.cfg[g][k] = v;
    this.applyKey(g, k, prev);
    if (commit) this.commitSoon();
  }

  applyKey(g, k, prev) {
    const app = this.app;
    if (g === 'butterfly' && k === 'shape') app.butterfly.setShape(this.cfg.butterfly.shape);
    if (g === 'particles' && k === 'form' && prev !== this.cfg.particles.form) this.setForm(this.cfg.particles.form);
    if (g === 'particles' && k === 'count') app.applyCount();
    if (g === 'path') {
      const ps = app.paths.settings;
      if (k === 'width') app.paths.setWidth(this.cfg.path.width);
      else if (k === 'color') app.paths.setColor(this.cfg.path.color);
      else ps[k] = this.cfg.path[k];
    }
    if (g === 'scene' && k === 'id') this.applySceneDefaults();
    this.emit();
  }

  setForm(id) {
    const i = FORMS.find((f) => f.id === id)?.i ?? 0;
    // continue from wherever the morph currently is
    this.form.a = this.form.mix >= 0.5 ? this.form.b : this.form.a;
    this.form.b = i;
    this.form.mix = 0;
  }

  applySceneDefaults() {
    const s = SCENES.find((x) => x.id === this.cfg.scene.id);
    this.cfg.scene.bg = s.bg;
    this.cfg.scene.fog = s.fog;
  }

  // Everything (used after undo / load / random).
  applyAll({ instantForm = false } = {}) {
    const app = this.app;
    app.butterfly.setShape(this.cfg.butterfly.shape);
    const f = FORMS.find((x) => x.id === this.cfg.particles.form)?.i ?? 0;
    if (instantForm) { this.form.a = f; this.form.b = f; this.form.mix = 1; } else if (f !== this.form.b) this.setForm(this.cfg.particles.form);
    const ps = app.paths.settings;
    Object.assign(ps, { color: this.cfg.path.color, trail: this.cfg.path.trail, speed: this.cfg.path.speed, loop: this.cfg.path.loop, depth: this.cfg.path.depth });
    if (ps.width !== this.cfg.path.width) app.paths.setWidth(this.cfg.path.width);
    const cur = JSON.stringify(app.paths.serialize());
    if (cur !== JSON.stringify(this.cfg.paths)) app.paths.load(this.cfg.paths);
    app.applyCount();
    this.emit();
  }

  onChange(fn) { this.listeners.add(fn); }
  emit() { this.listeners.forEach((fn) => fn()); }

  // ---- history -------------------------------------------------------
  snapshot() {
    this.cfg.paths = this.app.paths.serialize();
    return JSON.stringify(this.cfg);
  }
  commitSoon() {
    clearTimeout(this._ct);
    this._ct = setTimeout(() => this.commit(), 350);
  }
  commit() {
    clearTimeout(this._ct);
    const snap = this.snapshot();
    if (snap === this.lastSnap) return;
    if (this.lastSnap) {
      this.undoStack.push(this.lastSnap);
      if (this.undoStack.length > 80) this.undoStack.shift();
    }
    this.redoStack = [];
    this.lastSnap = snap;
    this.autosave();
    this.emit();
  }
  undo() {
    this.commit();
    if (!this.undoStack.length) return false;
    this.redoStack.push(this.lastSnap);
    this.lastSnap = this.undoStack.pop();
    this.cfg = sanitize(JSON.parse(this.lastSnap));
    this.applyAll();
    this.autosave();
    return true;
  }
  redo() {
    if (!this.redoStack.length) return false;
    this.undoStack.push(this.lastSnap);
    this.lastSnap = this.redoStack.pop();
    this.cfg = sanitize(JSON.parse(this.lastSnap));
    this.applyAll();
    this.autosave();
    return true;
  }

  reset() {
    this.cfg = clone(STUDIO_DEFAULT);
    this.cfg.particles.count = Math.min(this.cfg.particles.count, this.app.particles.max);
    this.app.paths.clear();
    this.clearFx();
    this.applyAll();
    this.commit();
  }

  load(cfg, { record = true } = {}) {
    this.cfg = sanitize(cfg);
    this.cfg.particles.count = Math.min(this.cfg.particles.count, this.app.particles.max);
    this.clearFx();
    this.applyAll();
    if (record) this.commit(); else this.lastSnap = this.snapshot();
  }

  autosave() {
    try { localStorage.setItem(CURRENT_KEY, this.lastSnap || this.snapshot()); } catch (e) { /* storage full or disabled */ }
  }
  restoreAutosave() {
    try {
      const s = localStorage.getItem(CURRENT_KEY);
      if (s) { this.load(JSON.parse(s), { record: false }); return true; }
    } catch (e) { /* ignore corrupt data */ }
    this.lastSnap = this.snapshot();
    return false;
  }

  // ---- random art ----------------------------------------------------
  randomize() {
    const R = Math.random;
    const pick = (a) => a[Math.floor(R() * a.length)];
    const rng = (a, b) => a + R() * (b - a);
    const h = R();
    const hsl = (hh, s, l) => '#' + new THREE.Color().setHSL(((hh % 1) + 1) % 1, s, l).getHexString();
    const scene = pick(SCENES.filter((s) => s.id !== 'minimal'));
    this.cfg = sanitize({
      ...this.cfg,
      butterfly: {
        color: R() < 0.12 ? 'rainbow' : hsl(h, 0.75, 0.72), material: pick(MATERIALS).id, glow: rng(0.8, 1.8),
        pattern: pick(PATTERNS).id, size: rng(0.8, 1.4), count: Math.floor(rng(1, 14)), shape: pick(SHAPES).id,
        flight: rng(0.6, 1.6), flap: rng(0.7, 1.6),
      },
      particles: {
        ...this.cfg.particles, size: rng(0.8, 1.5), speed: rng(0.6, 1.5), density: rng(0.7, 1.4), color: hsl(h + pick([0.08, 0.5, -0.12, 0.33]), 0.8, 0.62),
        opacity: rng(0.8, 1.1), glow: rng(0.8, 1.4), spread: rng(0.8, 1.4), dirAngle: Math.floor(rng(0, 360)), dirStrength: R() < 0.3 ? rng(0.2, 0.8) : 0,
        gather: R() < 0.3 ? rng(-0.4, 0.4) : 0, form: pick(FORMS).id,
      },
      scene: { id: scene.id, bg: scene.bg, ambient: rng(0.8, 1.3), fog: scene.fog, light: rng(0.8, 1.3), depth: 1 },
      visual: { ...this.cfg.visual, bloom: rng(0.8, 1.5), dof: rng(0.1, 0.7), blur: rng(0, 0.45), rt: rng(0.2, 1), exposure: rng(0.9, 1.2), saturation: rng(0.9, 1.35), camRot: 0, orbitSpeed: rng(-0.5, 0.5) },
      paths: this.app.paths.serialize(),
    });
    this.applyAll();
    this.commit();
  }

  // ---- effects -------------------------------------------------------
  clearFx() {
    this.fx.timers.forEach(clearTimeout);
    this.fx.timers = [];
    Object.assign(this.fx, { a: 0, b: 0, mix: 1, scaleT: 1, dissolveT: 0, extraT: 1, convergeT: 0, core: 0 });
  }
  goFx(k) {
    const f = this.fx;
    f.a = f.mix >= 0.5 ? f.b : f.a;
    f.b = FX_INDEX[k];
    f.mix = 0;
  }
  later(ms, fn) { this.fx.timers.push(setTimeout(fn, ms)); }

  effect(id) {
    const f = this.fx;
    const app = this.app;
    f.timers.forEach(clearTimeout);
    f.timers = [];
    f.scaleT = 1; f.extraT = 1; f.convergeT = 0;
    switch (id) {
      case 'dissolve': this.goFx('scatter'); f.dissolveT = 1; break;
      case 'reassemble':
        this.goFx('wing'); f.scale = 1;
        this.later(1300, () => { f.dissolveT = 0; });
        this.later(2900, () => this.goFx('base'));
        break;
      case 'galaxy': this.goFx('galaxy'); f.dissolveT = 1; break;
      case 'crystal':
        this.set('butterfly.material', 'crystal');
        this.set('butterfly.glow', Math.max(1.6, this.cfg.butterfly.glow));
        f.dissolveT = 0; this.goFx('shards'); app.flash = Math.max(app.flash, 0.25);
        break;
      case 'beam': this.goFx('beam'); f.dissolveT = 1; f.core = 1.2; break;
      case 'planet': this.goFx('planet'); f.dissolveT = 1; break;
      case 'vortex': this.goFx('vortex'); f.dissolveT = 0; break;
      case 'flower': this.goFx('flower'); f.bloom = 0; f.dissolveT = 0; break;
      case 'converge': {
        f.dissolveT = 0;
        const n = this.cfg.butterfly.count;
        if (n < 8) this.set('butterfly.count', 12, { commit: false });
        f.convergeT = 1; f.extraT = 2.6; f.scale = 1; f.scaleT = 2.6; this.goFx('giant');
        this.later(6500, () => { f.convergeT = 0; f.extraT = 1; f.scaleT = 1; this.goFx('base'); if (n < 8) this.set('butterfly.count', n, { commit: false }); });
        break;
      }
      case 'explode':
        app.triggerBurst(app.butterfly.pos.clone(), 3.2);
        app.flash = 0.7;
        app.shake = 1;
        f.ring = 1;
        this.goFx('scatter');
        this.later(2600, () => this.goFx('base'));
        break;
      default: return;
    }
    if (id !== 'explode' && id !== 'crystal') app.flash = Math.max(app.flash, 0.12);
    app.trans.pulse = Math.max(app.trans.pulse, 0.6);
    const e = EFFECTS.find((x) => x.id === id);
    app.ui.titleCard({ key: 'FX', name: e.name, en: e.en }, 'EFFECT');
  }

  update(dt) {
    const f = this.fx;
    const ease = (cur, target, rate) => cur + (target - cur) * (1 - Math.exp(-dt * rate));
    f.mix = Math.min(1, f.mix + dt / 2.0);
    f.scale = ease(f.scale, f.scaleT, 1.6);
    f.dissolve = ease(f.dissolve, f.dissolveT, 1.4);
    f.extra = ease(f.extra, f.extraT, 1.3);
    f.converge = ease(f.converge, f.convergeT, 1.5);
    f.bloom = f.b === FX_INDEX.flower ? Math.min(1, f.bloom + dt / 3.5) : 1;
    f.core = Math.max(0, f.core - (f.b === FX_INDEX.beam ? 0 : dt * 0.5));
    f.ring = Math.max(0, (f.ring || 0) - dt * 0.5);
    this.form.mix = Math.min(1, this.form.mix + dt / 2.2);
  }

  // ---- derived values for the renderer ------------------------------
  sceneTarget() {
    const s = SCENES.find((x) => x.id === this.cfg.scene.id);
    return s;
  }

  // Eased scene numbers + colours (so scene switches crossfade).
  updateScene(dt) {
    const target = this.sceneTarget();
    if (!this.sceneLive) {
      this.sceneLive = { a: new THREE.Color(target.a), b: new THREE.Color(target.b), dustCol: new THREE.Color(target.dustCol) };
      SCENE_NUM.forEach((k) => { this.sceneLive[k] = target[k]; });
    }
    const L = this.sceneLive;
    const k = 1 - Math.exp(-dt * 1.8);
    SCENE_NUM.forEach((key) => { L[key] += (target[key] - L[key]) * k; });
    L.dustMode = target.dustMode; // discrete
    if (this._tgtId !== target.id) {
      this._tgtId = target.id;
      this._ta = new THREE.Color(target.a); this._tb = new THREE.Color(target.b); this._td = new THREE.Color(target.dustCol);
    }
    L.a.lerp(this._ta, k);
    L.b.lerp(this._tb, k);
    L.dustCol.lerp(this._td, k);
    return L;
  }

  // ---- works (localStorage) ------------------------------------------
  works() {
    try { return JSON.parse(localStorage.getItem(WORKS_KEY) || '[]'); } catch (e) { return []; }
  }
  saveWorks(list) {
    try { localStorage.setItem(WORKS_KEY, JSON.stringify(list)); return true; } catch (e) { return false; }
  }
  saveWork(name, thumb) {
    this.commit();
    const list = this.works();
    const w = { id: Date.now().toString(36), name: name || `作品 ${list.length + 1}`, time: Date.now(), thumb, config: JSON.parse(this.snapshot()) };
    list.unshift(w);
    if (!this.saveWorks(list)) {
      // Storage full: drop thumbnails of older works and retry
      list.forEach((x, i) => { if (i > 0) x.thumb = null; });
      if (!this.saveWorks(list)) return null;
    }
    return w;
  }
  overwriteWork(id, thumb) {
    const list = this.works();
    const w = list.find((x) => x.id === id);
    if (!w) return null;
    this.commit();
    w.config = JSON.parse(this.snapshot());
    w.time = Date.now();
    if (thumb) w.thumb = thumb;
    this.saveWorks(list);
    return w;
  }
  renameWork(id, name) {
    const list = this.works();
    const w = list.find((x) => x.id === id);
    if (w) { w.name = name; this.saveWorks(list); }
  }
  deleteWork(id) { this.saveWorks(this.works().filter((x) => x.id !== id)); }
  loadWork(id) {
    const w = this.works().find((x) => x.id === id);
    if (w) this.load(w.config);
    return w;
  }
  exportConfig(name = 'nebula-work') {
    this.commit();
    return { app: 'NEBULA Studio', v: 1, name, exported: new Date().toISOString(), config: JSON.parse(this.snapshot()) };
  }
  importConfig(obj) {
    const cfg = obj && obj.config ? obj.config : obj;
    if (!cfg || typeof cfg !== 'object' || !cfg.butterfly) throw new Error('不是有效的 NEBULA 作品文件');
    this.load(cfg);
    return obj.name || '导入的作品';
  }
}
