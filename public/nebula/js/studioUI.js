import { BFLY_COLORS, MATERIALS, PATTERNS, SHAPES, FORMS, EFFECTS, SCENES, STUDIO_RANGES } from './studio.js';
import { download } from './capture.js';

const ICON = {
  butterfly: '<path d="M12 7v12M12 9C9 4 4 3.5 3.5 6.5S6 12 10.5 11.5M12 9c3-5 8-5.5 8.5-2.5S18 12 13.5 11.5M10.5 11.5C6 12 5 16 7 17.5s4-.5 5-4M13.5 11.5c4.5.5 5.5 4.5 3.5 6s-4-.5-5-4"/>',
  particles: '<circle cx="6" cy="7" r="1.6"/><circle cx="16" cy="5.5" r="1.1"/><circle cx="12" cy="12" r="2.2"/><circle cx="18.5" cy="14" r="1.4"/><circle cx="7" cy="17.5" r="1.2"/><circle cx="14" cy="19" r="0.9"/>',
  path: '<path d="M4 18c3-9 6 2 9-6s5-4 7-7"/><circle cx="4" cy="18" r="1.6"/><circle cx="20" cy="5" r="1.6"/>',
  fx: '<path d="M12 3v4M12 17v4M3 12h4M17 12h4M5.6 5.6l2.8 2.8M15.6 15.6l2.8 2.8M18.4 5.6l-2.8 2.8M8.4 15.6l-2.8 2.8"/><circle cx="12" cy="12" r="2"/>',
  scene: '<path d="M3 18l5.5-7 4 5 3-3.5L21 18z"/><circle cx="16.5" cy="7" r="2"/><rect x="2.5" y="3.5" width="19" height="17" rx="3"/>',
  visual: '<circle cx="12" cy="12" r="4"/><path d="M12 2.5v2.5M12 19v2.5M2.5 12H5M19 12h2.5M5.3 5.3l1.8 1.8M16.9 16.9l1.8 1.8M18.7 5.3l-1.8 1.8M7.1 16.9l-1.8 1.8"/>',
  works: '<rect x="3.5" y="4" width="17" height="16" rx="2.5"/><path d="M8 4v6l2.5-1.6L13 10V4"/>',
  undo: '<path d="M9 7L4.5 11.5 9 16"/><path d="M5 11.5h9.5a5 5 0 0 1 0 10H11"/>',
  redo: '<path d="M15 7l4.5 4.5L15 16"/><path d="M19 11.5H9.5a5 5 0 0 0 0 10H13"/>',
  reset: '<path d="M4 12a8 8 0 1 0 2.4-5.7L4 8.5"/><path d="M4 4v4.5h4.5"/>',
  dice: '<rect x="3.5" y="3.5" width="17" height="17" rx="4"/><circle cx="8.5" cy="8.5" r="1.3" class="fill"/><circle cx="15.5" cy="15.5" r="1.3" class="fill"/><circle cx="12" cy="12" r="1.3" class="fill"/><circle cx="15.5" cy="8.5" r="1.3" class="fill"/><circle cx="8.5" cy="15.5" r="1.3" class="fill"/>',
  save: '<path d="M5 4h11l3 3v13H5z"/><path d="M8 4v5h7V4M8 20v-6h8v6"/>',
  eye: '<path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12z"/><circle cx="12" cy="12" r="3"/>',
  full: '<path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5"/>',
  pen: '<path d="M4 20l1-5L16.5 3.5a2.1 2.1 0 0 1 3 3L8 18z"/><path d="M14.5 5.5l3 3"/>',
};
const svg = (k) => `<svg viewBox="0 0 24 24">${ICON[k]}</svg>`;

const TOOLS = [
  { id: 'butterfly', name: '蝴蝶' }, { id: 'particles', name: '粒子' }, { id: 'path', name: '轨迹' },
  { id: 'fx', name: '特效' }, { id: 'scene', name: '场景' }, { id: 'visual', name: '视觉' }, { id: 'works', name: '作品' },
];

const FX_ART = {
  dissolve: ['#9fd8ff', '#2b3a66'], reassemble: ['#fff1d6', '#6b5bff'], galaxy: ['#b07bff', '#1a1450'], crystal: ['#e6fbff', '#5fb8ff'],
  beam: ['#ffffff', '#29d8ff'], planet: ['#ffcf8a', '#5a3bff'], vortex: ['#7ff3ff', '#3a1a6a'], flower: ['#ff7ab8', '#ffd27a'],
  converge: ['#f6cf8a', '#ff5fae'], explode: ['#ffd27a', '#ff4f5e'],
};

export function createStudioUI(app, studio) {
  const root = document.getElementById('studio');
  const S = studio;
  const isSheet = () => matchMedia('(max-width: 760px)').matches;
  const controls = []; // {sync()}
  let countInputEl = null;

  root.innerHTML = `
    <header class="st-top">
      <div class="brand"><div class="logo">NEBULA</div><div class="st-badge">STUDIO</div></div>
      <div class="actions">
        <button class="icon-btn" data-act="undo" title="撤销 (Ctrl+Z)">${svg('undo')}</button>
        <button class="icon-btn" data-act="redo" title="重做 (Ctrl+Shift+Z)">${svg('redo')}</button>
        <button class="icon-btn" data-act="reset" title="重置为默认">${svg('reset')}</button>
        <button class="icon-btn" data-act="random" title="随机生成艺术效果 (R)">${svg('dice')}</button>
        <button class="icon-btn" data-act="quicksave" title="保存当前作品">${svg('save')}</button>
        <button class="icon-btn" data-act="full" title="全屏创作 (F)">${svg('full')}</button>
        <button class="st-switch" data-act="showcase" title="切换到纯展示模式 (T)">${svg('eye')}<span>展示模式</span></button>
      </div>
    </header>
    <nav class="st-rail glass" aria-label="创作工具">
      ${TOOLS.map((t) => `<button class="st-tool" data-tool="${t.id}">${svg(t.id)}<span>${t.name}</span></button>`).join('')}
    </nav>
    <aside class="st-panel glass" id="stPanel">
      <div class="sheet-handle"></div>
      <div class="panel-head"><h2 id="stTitle">蝴蝶</h2><button class="close-btn" data-act="closePanel" aria-label="关闭">×</button></div>
      <div class="panel-body" id="stBody"></div>
    </aside>
    <div class="st-dock glass" id="stDock">
      ${EFFECTS.map((e) => `<button class="fx-chip" data-fx="${e.id}"><i style="background:radial-gradient(circle at 40% 40%, ${FX_ART[e.id][0]}, ${FX_ART[e.id][1]} 70%)"></i>${e.name}</button>`).join('')}
    </div>
    <div class="st-draw-pill glass" id="stDrawPill">
      <span class="pulse-dot"></span><span>绘制模式 · 在画面中按住拖动，画出蝴蝶的飞行路径</span>
      <button class="text-btn" data-act="drawDone">完成</button>
    </div>
    <div class="st-hud glass mono" id="stHud">FPS -- · 粒子 --</div>
  `;

  const body = root.querySelector('#stBody');
  const panel = root.querySelector('#stPanel');
  const sections = {};
  TOOLS.forEach((t) => {
    const sec = document.createElement('div');
    sec.className = 'st-sec';
    sec.dataset.sec = t.id;
    body.appendChild(sec);
    sections[t.id] = sec;
  });

  // ------------------------------------------------------------------
  // Control builders
  // ------------------------------------------------------------------
  const h = (html) => { const d = document.createElement('div'); d.innerHTML = html.trim(); return d.firstElementChild; };
  function group(sec, title) { const g = h(`<section class="group"><h3>${title}</h3></section>`); sec.appendChild(g); return g; }

  function slider(parent, path, label, fmt = (v) => (+v).toFixed(2)) {
    const [min, max, step] = STUDIO_RANGES[path];
    const el = h(`<div class="ctl"><div class="ctl-top"><span>${label}</span><span class="v"></span></div><input type="range" min="${min}" max="${max}" step="${step}" aria-label="${label}"></div>`);
    const input = el.querySelector('input');
    const out = el.querySelector('.v');
    const paint = () => { input.style.setProperty('--p', ((input.value - min) / (max - min)) * 100 + '%'); out.textContent = fmt(input.value); };
    input.addEventListener('input', () => { S.set(path, parseFloat(input.value)); paint(); });
    input.addEventListener('change', () => S.commit());
    parent.appendChild(el);
    controls.push({ sync: () => { const v = S.get(path); if (+input.value !== v) input.value = v; paint(); } });
    return el;
  }
  function chips(parent, path, list, cols = 4, onPick) {
    const el = h(`<div class="chips" style="grid-template-columns:repeat(${cols},1fr)"></div>`);
    list.forEach((it) => {
      const b = h(`<button class="chip" data-v="${it.id}">${it.name}</button>`);
      b.addEventListener('click', () => { if (onPick) onPick(it.id); else { S.set(path, it.id); S.commit(); } sync(); });
      el.appendChild(b);
    });
    parent.appendChild(el);
    controls.push({ sync: () => el.querySelectorAll('.chip').forEach((b) => b.classList.toggle('on', b.dataset.v === S.get(path))) });
    return el;
  }
  function colorRow(parent, path, list, { picker = true } = {}) {
    const el = h('<div class="color-row"></div>');
    list.forEach((c) => {
      const b = h(`<button class="cdot ${c.hex === 'rainbow' ? 'rainbow' : ''}" title="${c.name}" style="${c.hex !== 'rainbow' ? `--c:${c.hex}` : ''}" data-v="${c.hex}"></button>`);
      b.addEventListener('click', () => { S.set(path, c.hex); S.commit(); sync(); });
      el.appendChild(b);
    });
    let input;
    if (picker) {
      const lab = h('<label class="cdot picker" title="自定义颜色"><input type="color"><span>+</span></label>');
      input = lab.querySelector('input');
      input.addEventListener('input', () => { S.set(path, input.value, { commit: false }); syncLite(); });
      input.addEventListener('change', () => S.commit());
      el.appendChild(lab);
    }
    parent.appendChild(el);
    controls.push({
      sync: () => {
        const v = S.get(path);
        el.querySelectorAll('.cdot[data-v]').forEach((b) => b.classList.toggle('on', b.dataset.v.toLowerCase() === String(v).toLowerCase()));
        if (input && v !== 'rainbow') { input.value = v; input.parentElement.style.setProperty('--c', v); }
      },
    });
    return el;
  }
  function seg(parent, path, label, opts) {
    const el = h(`<div class="seg-row"><span class="seg-label">${label}</span><div class="seg">${opts.map((o) => `<button data-v="${o.id}">${o.name}</button>`).join('')}</div></div>`);
    el.querySelectorAll('button').forEach((b) => b.addEventListener('click', () => {
      const v = b.dataset.v === 'true' ? true : b.dataset.v === 'false' ? false : b.dataset.v;
      S.set(path, v); S.commit(); sync();
    }));
    parent.appendChild(el);
    controls.push({ sync: () => el.querySelectorAll('button').forEach((b) => b.classList.toggle('on', b.dataset.v === String(S.get(path)))) });
    return el;
  }
  const pct = (v) => `${Math.round(v * 100)}%`;
  const deg = (v) => `${Math.round(v)}°`;
  const kfmt = (v) => `${(v / 1000).toFixed(v >= 100000 ? 0 : 1)}k`;

  // ------------------------------------------------------------------
  // 1. Butterfly
  // ------------------------------------------------------------------
  {
    const s = sections.butterfly;
    const g1 = group(s, '颜色');
    colorRow(g1, 'butterfly.color', BFLY_COLORS);
    const g2 = group(s, '翅膀材质');
    chips(g2, 'butterfly.material', MATERIALS, 4);
    slider(g2, 'butterfly.glow', '翅膀发光', pct);
    const g3 = group(s, '翅膀纹理');
    chips(g3, 'butterfly.pattern', PATTERNS, 4);
    const g4 = group(s, '蝴蝶形态');
    chips(g4, 'butterfly.shape', SHAPES, 5);
    const g5 = group(s, '尺寸与数量');
    slider(g5, 'butterfly.size', '蝴蝶尺寸', pct);
    slider(g5, 'butterfly.count', '蝴蝶数量', (v) => `${v} 只`);
    slider(g5, 'butterfly.flight', '飞行速度', pct);
    slider(g5, 'butterfly.flap', '扇翅速度', pct);
  }
  // ------------------------------------------------------------------
  // 2. Particles
  // ------------------------------------------------------------------
  {
    const s = sections.particles;
    const g1 = group(s, '粒子形态');
    chips(g1, 'particles.form', FORMS, 3);
    const g2 = group(s, '数量与外观');
    const cnt = slider(g2, 'particles.count', '粒子数量', kfmt);
    countInputEl = cnt.querySelector('input');
    slider(g2, 'particles.size', '粒子大小', pct);
    slider(g2, 'particles.density', '粒子密度', pct);
    slider(g2, 'particles.opacity', '透明度', pct);
    slider(g2, 'particles.glow', '发光程度', pct);
    const g3 = group(s, '粒子颜色');
    colorRow(g3, 'particles.color', [
      { name: '星蓝', hex: '#9fc8ff' }, { name: '极光紫', hex: '#b27bff' }, { name: '香槟金', hex: '#f6cf8a' },
      { name: '霓虹粉', hex: '#ff5fae' }, { name: '冰川青', hex: '#7ff3ff' }, { name: '珊瑚橙', hex: '#ff8a5c' }, { name: '纯白', hex: '#ffffff' },
    ]);
    const g4 = group(s, '运动');
    slider(g4, 'particles.speed', '粒子速度', pct);
    slider(g4, 'particles.spread', '扩散范围', pct);
    slider(g4, 'particles.dirAngle', '运动方向', deg);
    slider(g4, 'particles.dirStrength', '方向流动强度', pct);
    slider(g4, 'particles.gather', '聚合 ← → 分散', (v) => (v < -0.01 ? `聚合 ${Math.round(-v * 100)}%` : v > 0.01 ? `分散 ${Math.round(v * 100)}%` : '自然'));
    const row = h('<div class="btn-row"><button class="chip-btn" data-g="-0.85">一键聚合</button><button class="chip-btn" data-g="0">恢复自然</button><button class="chip-btn" data-g="0.9">一键分散</button></div>');
    row.querySelectorAll('button').forEach((b) => b.addEventListener('click', () => { app.animateStudio('particles.gather', parseFloat(b.dataset.g), 1.2); }));
    g4.appendChild(row);
  }
  // ------------------------------------------------------------------
  // 3. Paths
  // ------------------------------------------------------------------
  {
    const s = sections.path;
    const g1 = group(s, '自由绘制');
    const drawBtn = h(`<button class="big-btn" data-act="draw">${svg('pen')}<span>开始绘制飞行路径</span></button>`);
    g1.appendChild(drawBtn);
    g1.appendChild(h('<p class="note">按住鼠标或手指在画面上拖动即可画出一条轨迹。可以连续画多条，蝴蝶会平均分配到每条路径上飞行。路径会自动获得前后纵深，形成真实的 3D 曲线。</p>'));
    const info = h('<div class="path-info" id="stPathInfo"></div>');
    g1.appendChild(info);
    const row = h('<div class="btn-row"><button class="chip-btn" data-act="pathUndo">撤销上一条</button><button class="chip-btn" data-act="pathRestart">重新播放</button><button class="chip-btn danger" data-act="pathClear">清除全部</button></div>');
    g1.appendChild(row);
    const g2 = group(s, '轨迹外观');
    colorRow(g2, 'path.color', [
      { name: '冰川青', hex: '#7cf3ff' }, { name: '电光蓝', hex: '#4aa8ff' }, { name: '极光紫', hex: '#b27bff' },
      { name: '霓虹粉', hex: '#ff5fae' }, { name: '香槟金', hex: '#f6cf8a' }, { name: '珊瑚橙', hex: '#ff8a5c' }, { name: '纯白', hex: '#ffffff' },
    ]);
    g2.appendChild(h('<p class="note">颜色作用于最新的一条轨迹和之后绘制的轨迹，因此每条轨迹可以是不同颜色。</p>'));
    slider(g2, 'path.width', '轨迹粗细', pct);
    slider(g2, 'path.trail', '光线拖尾长度', pct);
    slider(g2, 'path.depth', '立体纵深', pct);
    const g3 = group(s, '运动');
    slider(g3, 'path.speed', '运动速度', pct);
    seg(g3, 'path.loop', '循环方式', [{ id: 'loop', name: '循环' }, { id: 'pingpong', name: '往返' }, { id: 'once', name: '单次' }]);
    controls.push({ sync: () => {
      const n = app.paths.paths.length;
      info.textContent = n ? `当前 ${n} 条轨迹 · ${S.cfg.butterfly.count} 只蝴蝶沿路径飞行` : '还没有轨迹 · 蝴蝶处于自由飞行状态';
      drawBtn.classList.toggle('on', S.drawMode);
      drawBtn.querySelector('span').textContent = S.drawMode ? '结束绘制' : '开始绘制飞行路径';
    } });
  }
  // ------------------------------------------------------------------
  // 4. Effects
  // ------------------------------------------------------------------
  {
    const s = sections.fx;
    const g = group(s, '3D 特效变换');
    const grid = h('<div class="fx-grid"></div>');
    EFFECTS.forEach((e) => {
      const b = h(`<button class="fx-card" data-fx="${e.id}"><i style="background:radial-gradient(circle at 40% 40%, ${FX_ART[e.id][0]}, ${FX_ART[e.id][1]} 72%)"></i><b>${e.name}</b><small>${e.en}</small></button>`);
      grid.appendChild(b);
    });
    g.appendChild(grid);
    g.appendChild(h('<p class="note">化为粒子、银河、星球、光束会保持在变换后的状态，点「重新聚合」让粒子回到蝴蝶。群蝶汇聚和能量爆发是一次性动画，结束后自动复原。</p>'));
  }
  // ------------------------------------------------------------------
  // 5. Scene
  // ------------------------------------------------------------------
  {
    const s = sections.scene;
    const g = group(s, '场景');
    const grid = h('<div class="scene-grid"></div>');
    SCENES.forEach((sc) => {
      const b = h(`<button class="scene-card" data-scene="${sc.id}"><i style="background:radial-gradient(ellipse at 30% 35%, ${sc.a}cc, transparent 60%), radial-gradient(ellipse at 75% 70%, ${sc.b}bb, transparent 60%), ${sc.bg}"></i><b>${sc.name}</b><small>${sc.en}</small></button>`);
      b.addEventListener('click', () => { S.set('scene.id', sc.id); S.commit(); sync(); });
      grid.appendChild(b);
    });
    g.appendChild(grid);
    controls.push({ sync: () => grid.querySelectorAll('.scene-card').forEach((b) => b.classList.toggle('on', b.dataset.scene === S.cfg.scene.id)) });
    const g2 = group(s, '空间调节');
    const bgRow = h('<div class="seg-row"><span class="seg-label">背景颜色</span><label class="cdot picker big"><input type="color"><span></span></label></div>');
    const bgIn = bgRow.querySelector('input');
    bgIn.addEventListener('input', () => { S.set('scene.bg', bgIn.value, { commit: false }); });
    bgIn.addEventListener('change', () => S.commit());
    controls.push({ sync: () => { bgIn.value = S.cfg.scene.bg; bgIn.parentElement.style.setProperty('--c', S.cfg.scene.bg); } });
    g2.appendChild(bgRow);
    slider(g2, 'scene.ambient', '环境亮度', pct);
    slider(g2, 'scene.fog', '雾效', pct);
    slider(g2, 'scene.light', '光线', pct);
    slider(g2, 'scene.depth', '空间深度', pct);
  }
  // ------------------------------------------------------------------
  // 6. Visual
  // ------------------------------------------------------------------
  {
    const s = sections.visual;
    const g1 = group(s, '光照');
    slider(g1, 'visual.ambient', '环境光强度', pct);
    slider(g1, 'visual.mainLight', '主光源强度', pct);
    slider(g1, 'visual.bloom', '辉光强度', pct);
    slider(g1, 'visual.rt', '光线追踪风格', pct);
    g1.appendChild(h('<p class="note">光线追踪风格：增强体积光束、镜面高光与镜头光斑，模拟光线追踪的光照质感。</p>'));
    const g2 = group(s, '镜头');
    slider(g2, 'visual.zoom', '镜头远近', pct);
    slider(g2, 'visual.camRot', '镜头旋转', deg);
    slider(g2, 'visual.camSpeed', '镜头移动速度', pct);
    seg(g2, 'visual.autoOrbit', '自动环绕', [{ id: 'true', name: '开启' }, { id: 'false', name: '关闭' }]);
    slider(g2, 'visual.orbitSpeed', '环绕速度', pct);
    const g3 = group(s, '画面');
    slider(g3, 'visual.dof', '景深效果', pct);
    slider(g3, 'visual.blur', '动态模糊', pct);
    slider(g3, 'visual.exposure', '画面曝光', pct);
    slider(g3, 'visual.saturation', '色彩饱和度', pct);
  }
  // ------------------------------------------------------------------
  // 7. Works
  // ------------------------------------------------------------------
  const worksList = h('<div class="works-list"></div>');
  {
    const s = sections.works;
    const g1 = group(s, '保存作品');
    const row = h('<div class="save-row"><input type="text" id="stWorkName" maxlength="40" placeholder="为作品命名，例如：午夜水晶蝶"><button class="text-btn primary" data-act="saveNew">保存</button></div>');
    g1.appendChild(row);
    g1.appendChild(h('<p class="note">作品保存在本机浏览器中，关闭网页后再次打开依然可以恢复，无需注册账号。当前创作也会自动保存。</p>'));
    const g2 = group(s, '我的作品');
    g2.appendChild(worksList);
    const g3 = group(s, '导入 / 导出');
    g3.appendChild(h(`<div class="btn-row">
      <button class="chip-btn" data-act="export">导出配置 (.json)</button>
      <label class="chip-btn">导入配置<input type="file" accept=".json,application/json" id="stImport" hidden></label>
      <button class="chip-btn" data-act="png">导出图片 PNG</button>
      <button class="chip-btn" data-act="rec"><span class="rec-label">录制视频</span></button>
    </div>`));
    const g4 = group(s, '快捷操作');
    g4.appendChild(h('<div class="btn-row"><button class="chip-btn" data-act="random">一键随机艺术</button><button class="chip-btn" data-act="reset">一键恢复默认</button></div>'));
    g4.appendChild(h('<p class="note">快捷键：Ctrl+Z 撤销 · Ctrl+Shift+Z 重做 · R 随机 · F 全屏 · T 展示/创作切换 · 1–7 切换工具 · Esc 关闭面板</p>'));
    root.querySelector('#stImport').addEventListener('change', async (e) => {
      const f = e.target.files[0];
      e.target.value = '';
      if (!f) return;
      try {
        const name = S.importConfig(JSON.parse(await f.text()));
        app.ui.toast(`已导入：${name}`);
        sync();
      } catch (err) { app.ui.toast('导入失败：' + err.message); }
    });
  }
  function renderWorks() {
    const list = S.works();
    worksList.innerHTML = list.length ? '' : '<p class="note">还没有保存的作品。</p>';
    list.forEach((w) => {
      const d = new Date(w.time);
      const el = h(`<div class="work">
        <button class="work-thumb" data-open="${w.id}" style="${w.thumb ? `background-image:url(${w.thumb})` : ''}" title="打开作品"></button>
        <div class="work-meta"><b></b><small>${d.toLocaleDateString()} ${d.toLocaleTimeString().slice(0, 5)}</small>
          <div class="work-acts"><button data-open="${w.id}">打开</button><button data-over="${w.id}">覆盖</button><button data-ren="${w.id}">重命名</button><button data-del="${w.id}" class="danger">删除</button></div>
        </div></div>`);
      el.querySelector('b').textContent = w.name;
      worksList.appendChild(el);
    });
  }
  worksList.addEventListener('click', async (e) => {
    const b = e.target.closest('button');
    if (!b) return;
    if (b.dataset.open) { const w = S.loadWork(b.dataset.open); if (w) app.ui.toast(`已打开作品：${w.name}`); sync(); }
    if (b.dataset.over) { const thumb = await app.capture.requestThumb(); S.overwriteWork(b.dataset.over, thumb); renderWorks(); app.ui.toast('已覆盖保存'); }
    if (b.dataset.ren) {
      // inline rename (no blocking prompt dialogs)
      const meta = b.closest('.work-meta');
      const title = meta.querySelector('b');
      const input = document.createElement('input');
      input.className = 'rename-input';
      input.maxLength = 40;
      input.value = title.textContent;
      title.replaceWith(input);
      input.focus();
      input.select();
      const done = (save) => {
        if (save && input.value.trim()) S.renameWork(b.dataset.ren, input.value.trim());
        renderWorks();
      };
      input.addEventListener('keydown', (ev) => { if (ev.key === 'Enter') done(true); if (ev.key === 'Escape') done(false); ev.stopPropagation(); });
      input.addEventListener('blur', () => done(true));
    }
    if (b.dataset.del) {
      // two-step delete: first click arms, second click confirms
      if (b.dataset.armed) { S.deleteWork(b.dataset.del); renderWorks(); app.ui.toast('作品已删除'); }
      else { b.dataset.armed = '1'; b.textContent = '确认删除？'; setTimeout(() => { if (b.isConnected) { delete b.dataset.armed; b.textContent = '删除'; } }, 3000); }
    }
  });

  // ------------------------------------------------------------------
  // Actions
  // ------------------------------------------------------------------
  async function saveNew(nameOverride) {
    const input = root.querySelector('#stWorkName');
    const name = (nameOverride || input.value || '').trim() || `作品 ${S.works().length + 1}`;
    const thumb = await app.capture.requestThumb();
    const w = S.saveWork(name, thumb);
    if (w) { input.value = ''; renderWorks(); app.ui.toast(`已保存作品：${w.name}`); } else app.ui.toast('保存失败：浏览器存储空间不足或被禁用');
  }
  const actions = {
    undo: () => { if (!S.undo()) app.ui.toast('没有可撤销的操作'); sync(); },
    redo: () => { if (!S.redo()) app.ui.toast('没有可重做的操作'); sync(); },
    reset: () => { S.reset(); sync(); app.ui.toast('已恢复默认创作配置（可撤销）'); },
    random: () => { S.randomize(); sync(); app.ui.toast('已生成随机艺术效果'); },
    quicksave: () => saveNew(),
    saveNew: () => saveNew(),
    full: () => app.toggleFullscreen(),
    showcase: () => app.setStudio(false),
    closePanel: () => openTool(null),
    draw: () => app.setDrawMode(!S.drawMode),
    drawDone: () => app.setDrawMode(false),
    pathUndo: () => { app.paths.undoLast(); S.commit(); sync(); },
    pathRestart: () => { app.paths.restart(); },
    pathClear: () => { app.paths.clear(); S.commit(); sync(); },
    export: () => {
      const name = root.querySelector('#stWorkName').value.trim() || 'nebula-work';
      const data = S.exportConfig(name);
      download(new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }), `${name.replace(/[\\/:*?"<>|]/g, '_')}.json`);
      app.ui.toast('已导出作品配置');
    },
    png: () => app.screenshot(),
    rec: () => app.toggleRecord(),
  };
  root.addEventListener('click', (e) => {
    const b = e.target.closest('[data-act]');
    if (b && actions[b.dataset.act]) actions[b.dataset.act]();
    const fx = e.target.closest('[data-fx]');
    if (fx) S.effect(fx.dataset.fx);
    const tool = e.target.closest('[data-tool]');
    if (tool) openTool(currentTool === tool.dataset.tool ? null : tool.dataset.tool);
  });

  // ------------------------------------------------------------------
  // Panels
  // ------------------------------------------------------------------
  let currentTool = null;
  function openTool(id) {
    currentTool = id;
    root.querySelectorAll('.st-tool').forEach((b) => b.classList.toggle('on', b.dataset.tool === id));
    Object.entries(sections).forEach(([k, el]) => { el.hidden = k !== id; });
    panel.classList.toggle('open', !!id);
    document.body.classList.toggle('st-panel-open', !!id);
    if (id) {
      root.querySelector('#stTitle').textContent = TOOLS.find((t) => t.id === id).name;
      body.scrollTop = 0;
      if (id === 'works') renderWorks();
    }
  }
  // swipe down to close on phones
  {
    let y0 = null;
    const head = panel.querySelector('.panel-head');
    [head, panel.querySelector('.sheet-handle')].forEach((el) => {
      el.addEventListener('touchstart', (e) => { y0 = e.touches[0].clientY; }, { passive: true });
      el.addEventListener('touchmove', (e) => { if (y0 !== null && e.touches[0].clientY - y0 > 60) { openTool(null); y0 = null; } }, { passive: true });
    });
  }

  // ------------------------------------------------------------------
  // Sync
  // ------------------------------------------------------------------
  function syncLite() {
    const c = S.cfg;
    document.documentElement.style.setProperty('--accent', c.butterfly.color === 'rainbow' ? '#b27bff' : c.butterfly.color);
    document.documentElement.style.setProperty('--accent2', c.particles.color);
  }
  function sync() {
    controls.forEach((c) => c.sync());
    syncLite();
    root.querySelector('[data-act="undo"]').disabled = !S.undoStack.length;
    root.querySelector('[data-act="redo"]').disabled = !S.redoStack.length;
    document.body.classList.toggle('st-drawing', S.drawMode);
  }
  S.onChange(() => { clearTimeout(ui._st); ui._st = setTimeout(sync, 16); });

  const ui = {
    sync, openTool, renderWorks,
    hud(txt) { root.querySelector('#stHud').textContent = txt; },
    recording(on) { root.querySelectorAll('.rec-label').forEach((x) => { x.textContent = on ? '停止录制' : '录制视频'; }); },
    get tool() { return currentTool; },
    TOOLS,
  };
  countInputEl.max = app.particles.max;
  openTool(isSheet() ? null : 'butterfly');
  sync();
  return ui;
}
