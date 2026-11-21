import { MODES, PRESETS, RANGES } from './config.js';

const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];

export function createUI(app) {
  const ui = {};
  const body = document.body;
  const isSheet = () => matchMedia('(max-width: 760px)').matches;

  // ---------- Mode tabs (top) + mode list (left) ----------
  const tabs = $('#modeTabs');
  const pill = document.createElement('div');
  pill.className = 'mode-pill';
  tabs.appendChild(pill);
  MODES.forEach((m, i) => {
    const b = document.createElement('button');
    b.className = 'mode-tab';
    b.dataset.mode = m.id;
    b.title = `${m.name}（快捷键 ${i + 1}）`;
    b.innerHTML = `<b>${m.key}</b><span>${m.name}</span>`;
    b.addEventListener('click', () => app.setMode(m.id, { user: true }));
    tabs.appendChild(b);
  });
  const modeList = $('#modeList');
  MODES.forEach((m) => {
    const b = document.createElement('button');
    b.className = 'mode-item';
    b.dataset.mode = m.id;
    b.innerHTML = `<span class="k">${m.key}</span><span><div class="t">${m.name}</div><div class="e">${m.en}</div></span>`;
    b.addEventListener('click', () => { app.setMode(m.id, { user: true }); if (isSheet()) closePanels(); });
    modeList.appendChild(b);
  });

  function placePill() {
    const a = tabs.querySelector('.mode-tab.active');
    if (!a) return;
    pill.style.left = a.offsetLeft + 'px';
    pill.style.width = a.offsetWidth + 'px';
  }

  // ---------- Presets ----------
  const plist = $('#presetList');
  PRESETS.forEach((p) => {
    const b = document.createElement('button');
    b.className = 'preset';
    b.dataset.preset = p.id;
    const c = p.colors;
    b.innerHTML = `<div class="art" style="background:
      radial-gradient(circle at 50% 55%, ${c.body} 0, transparent 26%),
      radial-gradient(ellipse at 25% 40%, ${c.particle}aa 0, transparent 55%),
      radial-gradient(ellipse at 78% 62%, ${c.accent}aa 0, transparent 55%),
      radial-gradient(circle at 60% 20%, ${c.glow}55 0, transparent 40%), ${c.bg}"></div>
      <div class="meta"><div class="nm">${p.name}</div><div class="en">${p.en}</div></div>`;
    b.addEventListener('click', () => { app.applyPreset(p.id, { user: true }); if (isSheet()) closePanels(); });
    plist.appendChild(b);
  });

  // ---------- Sliders ----------
  const sliders = {};
  $$('.ctl[data-key]').forEach((el) => {
    const key = el.dataset.key;
    const [min, max, step] = RANGES[key];
    el.innerHTML = `<div class="ctl-top"><span>${el.dataset.label}</span><span class="v"></span></div>
      <input type="range" min="${min}" max="${max}" step="${step}" aria-label="${el.dataset.label}" />`;
    const input = el.querySelector('input');
    const out = el.querySelector('.v');
    const fmt = (v) => (el.dataset.fmt === 'k' ? `${(v / 1000).toFixed(v >= 100000 ? 0 : 1)}k` : (+v).toFixed(2));
    const paint = () => {
      const p = ((input.value - input.min) / (input.max - input.min)) * 100;
      input.style.setProperty('--p', p + '%');
      out.textContent = fmt(input.value);
    };
    input.addEventListener('input', () => { app.setParam(key, parseFloat(input.value)); paint(); });
    sliders[key] = { input, paint };
  });
  ui.setSliderMax = (key, max) => { if (sliders[key]) { sliders[key].input.max = max; sliders[key].paint(); } };

  // ---------- Segmented controls ----------
  const seg = (id, get, set) => {
    const root = $(id);
    root.addEventListener('click', (e) => {
      const b = e.target.closest('button');
      if (!b) return;
      set(b.dataset.v);
      sync();
    });
    return () => $$('button', root).forEach((b) => b.classList.toggle('on', b.dataset.v === get()));
  };
  const syncMouse = seg('#mouseMode', () => app.state.params.mouse, (v) => app.setParam('mouse', v));
  const syncQuality = seg('#qualityMode', () => app.state.quality, (v) => app.setQuality(v));

  // ---------- Colors ----------
  $$('input[data-color]').forEach((inp) => {
    inp.addEventListener('input', () => app.setColor(inp.dataset.color, inp.value));
  });

  // ---------- Panels ----------
  const left = $('#panelLeft');
  const right = $('#panelRight');
  function togglePanel(p, force) {
    const open = force ?? !p.classList.contains('open');
    if (open && isSheet()) [left, right].forEach((x) => x !== p && x.classList.remove('open'));
    p.classList.toggle('open', open);
    $('#btnPresets').classList.toggle('on', left.classList.contains('open'));
    $('#btnSettings').classList.toggle('on', right.classList.contains('open'));
    body.classList.toggle('sheet-open', isSheet() && (left.classList.contains('open') || right.classList.contains('open')));
  }
  function closePanels() { togglePanel(left, false); togglePanel(right, false); }
  ui.togglePanel = (which) => togglePanel(which === 'left' ? left : right);
  ui.closePanels = closePanels;
  $('#btnPresets').addEventListener('click', () => togglePanel(left));
  $('#btnSettings').addEventListener('click', () => togglePanel(right));
  $$('[data-close]').forEach((b) => b.addEventListener('click', () => togglePanel($('#' + b.dataset.close), false)));
  // swipe-down to close sheets on mobile
  [left, right].forEach((p) => {
    let y0 = null;
    const head = p.querySelector('.panel-head');
    const handle = p.querySelector('.sheet-handle');
    [head, handle].forEach((h) => {
      h.addEventListener('touchstart', (e) => { y0 = e.touches[0].clientY; }, { passive: true });
      h.addEventListener('touchmove', (e) => { if (y0 !== null && e.touches[0].clientY - y0 > 60) { togglePanel(p, false); y0 = null; } }, { passive: true });
    });
  });

  // ---------- Buttons ----------
  $('#btnStudio').addEventListener('click', () => app.setStudio(true));
  $('#btnDemo').addEventListener('click', () => app.toggleDemo());
  $('#btnRandom').addEventListener('click', () => app.randomize());
  $('#btnFullscreen').addEventListener('click', () => app.toggleFullscreen());
  $('#exitImmersive').addEventListener('click', () => app.toggleFullscreen(false));
  $('#btnPlay').addEventListener('click', () => app.togglePause());
  $('#btnReset').addEventListener('click', () => app.resetDefaults());
  $('#btnShot').addEventListener('click', () => app.screenshot());
  $('#btnRec').addEventListener('click', () => app.toggleRecord());
  $('#btnCopy').addEventListener('click', () => app.copyConfig());
  $('#audioFile').addEventListener('change', (e) => { const f = e.target.files[0]; if (f) app.audioFile(f); e.target.value = ''; });
  $('#btnMic').addEventListener('click', () => app.audioMic());
  $('#btnDemoTrack').addEventListener('click', () => app.audioDemo());
  $('#btnAudioStop').addEventListener('click', () => app.audioStop());

  // ---------- Sync from state ----------
  function sync() {
    const s = app.state;
    for (const [k, sl] of Object.entries(sliders)) {
      if (s.params[k] !== undefined) { sl.input.value = s.params[k]; sl.paint(); }
    }
    $$('input[data-color]').forEach((inp) => { inp.value = s.colors[inp.dataset.color]; inp.style.color = s.colors[inp.dataset.color]; });
    $$('.mode-tab').forEach((b) => b.classList.toggle('active', b.dataset.mode === s.mode));
    $$('.mode-item').forEach((b) => b.classList.toggle('on', b.dataset.mode === s.mode));
    $$('.preset').forEach((b) => b.classList.toggle('on', b.dataset.preset === s.preset));
    syncMouse();
    syncQuality();
    $('#btnDemo').classList.toggle('on', app.demo.on);
    document.documentElement.style.setProperty('--accent', s.colors.accent);
    document.documentElement.style.setProperty('--accent2', s.colors.particle);
    const m = MODES.find((x) => x.id === s.mode);
    $('#hudKey').textContent = m.key;
    $('#hudMode').textContent = m.name;
    requestAnimationFrame(placePill);
  }
  ui.sync = sync;
  window.addEventListener('resize', placePill);

  // ---------- Toast / title card / hint ----------
  let toastT;
  ui.toast = (msg, ms = 2400) => {
    const t = $('#toast');
    t.textContent = msg;
    t.classList.add('show');
    clearTimeout(toastT);
    toastT = setTimeout(() => t.classList.remove('show'), ms);
  };
  let cardT;
  ui.titleCard = (m, label) => {
    const c = $('#titleCard');
    c.querySelector('.tc-index').textContent = label || `MODE ${m.key}`;
    c.querySelector('.tc-name').textContent = m.name;
    c.querySelector('.tc-en').textContent = m.en;
    c.classList.add('show');
    clearTimeout(cardT);
    cardT = setTimeout(() => c.classList.remove('show'), 2300);
  };
  ui.hint = () => {
    const h = $('#hint');
    if (matchMedia('(pointer: coarse)').matches) h.textContent = '单指旋转 · 双指缩放 · 轻点释放粒子 · 轻点蝴蝶触发飞舞';
    setTimeout(() => h.classList.add('show'), 1800);
    setTimeout(() => h.classList.remove('show'), 8500);
  };

  // ---------- HUD ----------
  const hud = { fps: $('#hudFps'), count: $('#hudCount'), state: $('#hudState'), dot: $('#hudDot'), frame: $('#hudFrame'), rec: $('#hudRecTime') };
  const meters = { bass: $('#mBass'), mid: $('#mMid'), treble: $('#mTreble') };
  ui.hud = ({ fps, count, state, warn, idle, frame, t, rec }) => {
    if (fps !== undefined) hud.fps.textContent = fps;
    if (count !== undefined) hud.count.textContent = count >= 1000 ? `${(count / 1000).toFixed(count >= 100000 ? 0 : 1)}k` : count;
    if (state !== undefined) {
      hud.state.textContent = state;
      hud.dot.className = 'dot' + (warn ? ' warn' : idle ? ' idle' : '');
    }
    if (frame !== undefined) hud.frame.textContent = `FRAME ${String(frame % 10000).padStart(4, '0')} · T+${t.toFixed(2)}S`;
    if (rec !== undefined) {
      const s = Math.floor(rec);
      hud.rec.textContent = `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
    }
  };
  ui.meters = (b) => {
    meters.bass.style.setProperty('--v', Math.min(1, b.bass));
    meters.mid.style.setProperty('--v', Math.min(1, b.mid));
    meters.treble.style.setProperty('--v', Math.min(1, b.treble));
  };
  ui.audioStatus = (txt, on) => {
    $('#audioStatus').textContent = txt;
    $('#btnMic').classList.toggle('on', on === 'mic');
    $('#btnDemoTrack').classList.toggle('on', on === 'demo');
  };
  ui.recording = (on) => {
    body.classList.toggle('recording', on);
    $('#btnRec').classList.toggle('rec', on);
    $('#recLabel').textContent = on ? '停止录制' : '录制 WebM';
  };
  ui.qualityNote = (txt) => { $('#qualityNote').textContent = txt; };

  return ui;
}
