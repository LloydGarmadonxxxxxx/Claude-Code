import { SCENES } from './scenes.js';

export const TINTS = [
  { id: 'moon', name: '月白', body: '#fff2d8', accent: '#e9dcc4', glow: '#fff7ea' },
  { id: 'ice', name: '冰蓝', body: '#cfeeff', accent: '#8fd0ff', glow: '#eef9ff' },
  { id: 'gold', name: '香槟金', body: '#ffe1a6', accent: '#f2c46d', glow: '#fff1d2' },
  { id: 'rose', name: '玫瑰', body: '#ffd3e0', accent: '#ff9fbd', glow: '#fff0f5' },
  { id: 'violet', name: '暮紫', body: '#e3d4ff', accent: '#b59bff', glow: '#f4efff' },
  { id: 'mint', name: '薄荷', body: '#d4ffe9', accent: '#8ff0c4', glow: '#effff7' },
];

const $ = (s, r = document) => r.querySelector(s);
const pad = (n) => String(n).padStart(2, '0');
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

export function createUI(app) {
  const body = document.body;
  const ui = {};

  // ---------- scene chips ----------
  const chips = $('#scenes');
  chips.innerHTML = SCENES.map((s, k) => `<button class="chip" data-k="${k}"><b>${pad(k + 1)}</b><span>${s.name}</span></button>`).join('')
    + '<button class="chip auto" data-k="auto"><b>∞</b><span>连播</span></button>';
  chips.addEventListener('click', (e) => {
    const b = e.target.closest('.chip');
    if (!b) return;
    app.setScene(b.dataset.k === 'auto' ? 'auto' : +b.dataset.k);
  });

  // ---------- control bar ----------
  const rew = $('#btnRewind');
  const start = (e) => { e.preventDefault(); rew.setPointerCapture?.(e.pointerId); app.setHoldRewind(true); };
  const stop = () => app.setHoldRewind(false);
  rew.addEventListener('pointerdown', start);
  rew.addEventListener('pointerup', stop);
  rew.addEventListener('pointercancel', stop);
  rew.addEventListener('lostpointercapture', stop);
  $('#btnPlay').addEventListener('click', () => app.togglePlay());
  $('#speed').addEventListener('click', (e) => { const b = e.target.closest('button'); if (b) app.setSpeed(+b.dataset.v); });
  $('#btnRecords').addEventListener('click', () => ui.toggleDrawer());
  $('#fs').addEventListener('click', () => app.toggleFullscreen());

  // ---------- inspector ----------
  const insp = $('#inspector');
  const tintRow = $('#tints');
  tintRow.innerHTML = TINTS.map((t) => `<button class="tint" data-id="${t.id}" title="${t.name}" style="--c:${t.body};--a:${t.accent}"></button>`).join('');
  tintRow.addEventListener('click', (e) => { const b = e.target.closest('.tint'); if (b) { app.editHeld('tint', b.dataset.id); ui.inspectorValues(app.inspect); } });
  const sliders = {
    wing: { el: $('#sWing'), fmt: (v) => `${Math.round((v * 180) / Math.PI)}°` },
    glow: { el: $('#sGlow'), fmt: (v) => `${Math.round(v * 100)}%` },
    size: { el: $('#sSize'), fmt: (v) => `${Math.round(v * 100)}%` },
  };
  for (const [key, s] of Object.entries(sliders)) {
    s.el.addEventListener('input', () => { app.editHeld(key, parseFloat(s.el.value)); paint(s); });
  }
  function paint(s) {
    const p = ((s.el.value - s.el.min) / (s.el.max - s.el.min)) * 100;
    s.el.style.setProperty('--p', p + '%');
    s.el.previousElementSibling.querySelector('.v').textContent = s.fmt(+s.el.value);
  }
  $('#views').addEventListener('click', (e) => { const b = e.target.closest('button'); if (b) app.setView(b.dataset.v); });
  const note = $('#note');
  note.addEventListener('input', () => app.editHeld('note', note.value.slice(0, 80)));
  note.addEventListener('keydown', (e) => { e.stopPropagation(); if (e.key === 'Enter') app.record(); });
  $('#btnRecord').addEventListener('click', () => app.record());
  $('#btnPutBack').addEventListener('click', () => app.putBack());

  ui.inspector = (ins) => {
    body.classList.toggle('inspecting', !!ins);
    if (!ins) return;
    const i = ins.i;
    $('#inspFrame').textContent = `FRAME ${pad((i % 76) + 1)} / 76`;
    $('#inspLap').textContent = `第 ${Math.floor(i / 76) + 1} 轮 · T+${(i / 24).toFixed(2)}s`;
    const rec = ins.recordId && app.records.find((r) => r.id === ins.recordId);
    $('#inspBadge').textContent = rec ? `记录 ${rec.n}` : '未记录';
    $('#inspBadge').classList.toggle('on', !!rec);
    $('#btnRecord').textContent = rec ? '更新记录' : '记录这只蝴蝶';
    note.value = ins.edits.note || '';
    ui.inspectorValues(ins);
  };
  ui.inspectorValues = (ins) => {
    if (!ins) return;
    for (const [key, s] of Object.entries(sliders)) { s.el.value = ins.edits[key]; paint(s); }
    tintRow.querySelectorAll('.tint').forEach((b) => b.classList.toggle('on', b.dataset.id === ins.edits.tint));
  };

  // ---------- records drawer ----------
  const drawer = $('#drawer');
  const list = $('#recList');
  ui.toggleDrawer = (force) => {
    const open = force ?? !drawer.classList.contains('open');
    drawer.classList.toggle('open', open);
    body.classList.toggle('drawer-open', open);
    $('#btnRecords').classList.toggle('on', open);
  };
  ui.closeDrawer = () => ui.toggleDrawer(false);
  $('#drawerClose').addEventListener('click', () => ui.closeDrawer());
  $('#btnSelAll').addEventListener('click', () => {
    const all = app.records.every((r) => app.selected.has(r.id));
    app.records.forEach((r) => (all ? app.selected.delete(r.id) : app.selected.add(r.id)));
    ui.records();
  });
  $('#btnGoSel').addEventListener('click', () => { if (app.selected.size) app.rewindTo([...app.selected]); });
  let armed = null;
  $('#btnDelSel').addEventListener('click', (e) => {
    const b = e.currentTarget;
    if (!app.selected.size) return;
    if (armed) { clearTimeout(armed); armed = null; app.deleteRecords([...app.selected]); b.textContent = '删除'; return; }
    b.textContent = '确认删除？';
    armed = setTimeout(() => { armed = null; b.textContent = '删除'; }, 2600);
  });
  list.addEventListener('click', (e) => {
    const card = e.target.closest('.rec');
    if (!card) return;
    const id = card.dataset.id;
    if (e.target.closest('.check')) { app.toggleSelect(id); return; }
    if (e.target.closest('.go')) { app.rewindTo([id]); return; }
    app.toggleSelect(id);
  });
  ui.records = () => {
    const recs = [...app.records].sort((a, b) => b.time - a.time);
    $('#recCount').textContent = app.records.length;
    $('#btnRecords').dataset.count = app.records.length || '';
    if (!recs.length) {
      list.innerHTML = '<div class="empty"><div class="empty-art"></div><p>还没有记录。</p><small>暂停后，点击光框里任意一只蝴蝶把它抽出来，再点「记录这只蝴蝶」。</small></div>';
    } else {
      list.innerHTML = recs.map((r) => {
        const ahead = r.i > app.head;
        return `<div class="rec ${app.selected.has(r.id) ? 'sel' : ''}" data-id="${r.id}">
          <button class="check" aria-label="选择"></button>
          <div class="thumb" style="${r.thumb ? `background-image:url(${r.thumb})` : ''}"><span>${r.n}</span></div>
          <div class="meta">
            <b>FRAME ${pad(r.frame)} / 76</b>
            <small>第 ${r.lap} 轮 · ${new Date(r.time).toLocaleTimeString().slice(0, 5)}</small>
            ${r.note ? `<i>${esc(r.note)}</i>` : ''}
          </div>
          <button class="go" title="${ahead ? '快进到这里' : '倒放回到这里'}">${ahead ? '▶▶' : '◀◀'}</button>
        </div>`;
      }).join('');
    }
    const n = app.selected.size;
    $('#btnGoSel').disabled = !n;
    $('#btnDelSel').disabled = !n;
    $('#btnGoSel').textContent = n > 1 ? `倒放依次回到 ${n} 只` : n === 1 ? '倒放回到所选' : '选择记录后倒放';
    $('#btnSelAll').textContent = app.records.length && app.records.every((r) => app.selected.has(r.id)) ? '取消全选' : '全选';
  };
  ui.highlight = (id) => {
    const el = list.querySelector(`.rec[data-id="${id}"]`);
    if (!el) return;
    el.classList.add('flash');
    el.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    setTimeout(() => el.classList.remove('flash'), 1600);
  };

  // ---------- travel overlay ----------
  ui.travel = (r, remaining = 0) => {
    const o = $('#travel');
    if (!r) { o.classList.remove('show'); return; }
    o.querySelector('.t-dir').textContent = r.i < app.head ? '◀◀ 倒放' : '▶▶ 快进';
    o.querySelector('.t-to').textContent = `回到记录 ${r.n} · FRAME ${pad(r.frame)} / 76 · 第 ${r.lap} 轮`;
    o.querySelector('.t-more').textContent = remaining ? `之后还有 ${remaining} 只` : '';
    o.classList.add('show');
  };

  // ---------- sync ----------
  ui.sync = () => {
    chips.querySelectorAll('.chip').forEach((b) => {
      b.classList.toggle('on', b.dataset.k === 'auto' ? app.auto : +b.dataset.k === app.sceneIndex);
    });
    const playing = app.playing && !app.inspect;
    body.classList.toggle('paused', !playing && !app.travel);
    $('#btnPlay').classList.toggle('is-playing', playing);
    $('#btnPlay').querySelector('span').textContent = app.travel ? '倒放中' : playing ? '暂停' : '继续';
    $('#speed').querySelectorAll('button').forEach((b) => b.classList.toggle('on', +b.dataset.v === app.speed));
    rew.classList.toggle('on', app.holdRewind);
  };

  // ---------- hud / cursor / toast ----------
  const hud = $('#hud');
  ui.hud = (frame, lap, t, rate) => {
    const dir = rate < -0.5 ? '◀◀ ' : rate > FAST ? '▶▶ ' : '';
    hud.textContent = `${dir}FRAME ${pad(frame)} / 76 · 第 ${lap} 轮 · T+${t.toFixed(2)}S`;
  };
  const FAST = 60;
  ui.cursor = (over) => body.classList.toggle('over-butterfly', over);
  let toastT;
  ui.toast = (msg) => {
    const t = $('#toast');
    t.textContent = msg;
    t.classList.add('show');
    clearTimeout(toastT);
    toastT = setTimeout(() => t.classList.remove('show'), 2600);
  };

  return ui;
}
