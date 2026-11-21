import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { AfterimagePass } from 'three/addons/postprocessing/AfterimagePass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';

import { CONFIG, detectTier } from './config.js';
import { ParticleTree, createStardust, createGreetingTexture, createPhotoTexture } from './particles.js';
import { gradeShader } from './shaders.js';
import { GestureController, GESTURE_LABELS } from './gesture.js';

const $ = (id) => document.getElementById(id);
const tier = detectTier();
const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

// ======================= 渲染器 / 场景 =======================
const stage = $('stage');
let renderer;
try {
  renderer = new THREE.WebGLRenderer({ antialias: false, powerPreference: 'high-performance', alpha: false });
} catch (err) {
  document.body.innerHTML =
    '<p style="color:#f3c862;padding:40px;text-align:center;font-size:18px">当前浏览器不支持 WebGL，请使用最新版 Chrome / Edge / Safari 打开。</p>';
  throw err;
}
let pixelRatio = Math.min(window.devicePixelRatio || 1, tier.pixelRatio);
renderer.setPixelRatio(pixelRatio);
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setClearColor(0x000000, 1);
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.05;
stage.appendChild(renderer.domElement);

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(CONFIG.camera.fov, window.innerWidth / window.innerHeight, 0.1, 300);

const tree = new ParticleTree(tier);
scene.add(tree.group);
const stardust = createStardust(tier.dust, tree.uniforms);
scene.add(stardust);
tree.setCardTexture(createGreetingTexture(renderer));

// ======================= 后期 =======================
const composer = new EffectComposer(renderer);
composer.setPixelRatio(pixelRatio);
composer.setSize(window.innerWidth, window.innerHeight);
composer.addPass(new RenderPass(scene, camera));
const afterimage = new AfterimagePass(0.8);
composer.addPass(afterimage);
const bloom = new UnrealBloomPass(
  new THREE.Vector2(window.innerWidth, window.innerHeight),
  CONFIG.bloom.strength,
  CONFIG.bloom.radius,
  CONFIG.bloom.threshold,
);
composer.addPass(bloom);
const grade = new ShaderPass(gradeShader);
grade.uniforms.uRes.value = new THREE.Vector2(window.innerWidth, window.innerHeight);
composer.addPass(grade);
composer.addPass(new OutputPass());

// ======================= 状态机 =======================
const MODES = {
  tree: [1, 0, 0, 0],
  text: [1, 0, 0, 0],
  scatter: [0, 1, 0, 0],
  cloud: [0, 0, 1, 0],
  frame: [0, 0, 0, 1],
};
const AUTO_SPIN = { intro: 0.12, tree: 0.16, text: 0.1, scatter: 0.06, cloud: 0.2, frame: 0 };

const weights = new THREE.Vector4(0, 1, 0, 0);
const wTarget = new THREE.Vector4(0, 1, 0, 0);
let mode = 'intro';
let modeTime = 0;
let morphRate = 1.5;
let scatterScale = 2.8;
let scatterScaleTarget = 2.8;
let flash = 0;
let squeeze = 0;
let pendingTree = null; // “重新聚合”序列

const rig = {
  angle: 0,
  angVel: 0,
  offset: new THREE.Vector3(),
  offsetTarget: new THREE.Vector3(),
  spread: 1,
  spreadTarget: 1,
  zoom: 1,
  zoomTarget: 1,
  baseDistance: CONFIG.camera.distance,
  textBlend: 0,
};

function setMode(next, { user = false } = {}) {
  if (user) markInteraction();
  pendingTree = null;

  // 已是树形时再次“聚合”：先炸开再从四周重新聚合（状态 1）
  if (next === 'tree' && (mode === 'tree' || mode === 'text') && user) {
    setMode('scatter');
    pendingTree = 0.9;
    return;
  }
  if (next === mode && next !== 'scatter') return;

  const prev = mode;
  mode = next;
  modeTime = 0;
  wTarget.set(...MODES[next]);
  morphRate = CONFIG.morphRate[next === 'text' ? 'tree' : next];

  if (next === 'scatter') {
    // 爆炸：从中心向外冲出
    if (prev === 'tree' || prev === 'text' || prev === 'frame' || prev === 'intro') scatterScale = 0.3;
    scatterScaleTarget = 1;
    flash = 1;
  }
  if (next === 'tree' && prev !== 'intro') {
    scatterScaleTarget = 1;
  }
  updateUI();
}

function markInteraction() {
  lastInteraction = performance.now();
}

// ======================= 自动演示 =======================
let demoIndex = 0;
let demoTimer = 0;
let lastInteraction = -Infinity;
let handVisibleUntil = 0;

function tickDemo(dt, now) {
  if (mode === 'intro') return;
  if (now - lastInteraction < CONFIG.idleResumeSeconds * 1000 || now < handVisibleUntil) {
    demoTimer = 0;
    return;
  }
  demoTimer += dt;
  const [, dur] = CONFIG.demo[demoIndex];
  if (demoTimer >= dur) {
    demoTimer = 0;
    demoIndex = (demoIndex + 1) % CONFIG.demo.length;
    setMode(CONFIG.demo[demoIndex][0]);
  }
}

// ======================= UI =======================
const sideTitle = $('sideTitle');
const heroText = $('heroText');
const heroEn = $('heroEn');
const dock = $('dock');
const toastEl = $('toast');

heroEn.innerHTML = [...heroEn.textContent]
  .map((ch, i) => `<span style="transition-delay:${(i * 0.06).toFixed(2)}s">${ch === ' ' ? '&nbsp;' : ch}</span>`)
  .join('');

function updateUI() {
  for (const b of dock.querySelectorAll('[data-mode]')) {
    const m = b.dataset.mode;
    const active = m === mode || (m === 'scatter' && mode === 'scatter');
    b.classList.toggle('active', active);
  }
  heroText.classList.toggle('show', mode === 'text');
}

let toastTimer = 0;
function toast(msg, ms = 3200) {
  toastEl.textContent = msg;
  toastEl.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toastEl.classList.remove('show'), ms);
}

dock.addEventListener('click', (e) => {
  const b = e.target.closest('[data-mode]');
  if (!b) return;
  setMode(b.dataset.mode, { user: true });
});

// 开场按钮
const intro = $('intro');
function closeIntro() {
  intro.classList.add('hide');
  sideTitle.classList.add('show');
}
$('startView').addEventListener('click', () => {
  closeIntro();
  markInteraction();
  lastInteraction -= (CONFIG.idleResumeSeconds - 4) * 1000;
});
$('startCam').addEventListener('click', () => {
  closeIntro();
  enableCamera();
});

// 帮助
const help = $('help');
$('helpBtn').addEventListener('click', () => (help.hidden = !help.hidden));
$('helpClose').addEventListener('click', () => (help.hidden = true));

// 全屏
const fsBtn = $('fsBtn');
const canFs = !!(document.documentElement.requestFullscreen || document.documentElement.webkitRequestFullscreen);
if (!canFs) fsBtn.hidden = true;
fsBtn.addEventListener('click', async () => {
  try {
    if (document.fullscreenElement || document.webkitFullscreenElement) {
      await (document.exitFullscreen || document.webkitExitFullscreen).call(document);
    } else {
      const el = document.documentElement;
      await (el.requestFullscreen || el.webkitRequestFullscreen).call(el);
    }
  } catch {
    toast('浏览器不允许全屏');
  }
});

// 换照片
$('photoInput').addEventListener('change', async (e) => {
  const file = e.target.files?.[0];
  if (!file) return;
  try {
    tree.setCardTexture(await createPhotoTexture(file, renderer));
    customPhoto = true;
    setMode('frame', { user: true });
    toast('照片已放入卡片，捏合手势可随时展示');
  } catch (err) {
    toast(err.message || '图片读取失败');
  }
  e.target.value = '';
});
let customPhoto = false;

// 字体加载完成后重绘默认卡片
if (document.fonts?.load) {
  Promise.race([
    Promise.all([
      document.fonts.load('150px "Great Vibes"'),
      document.fonts.load('600 76px "Noto Serif SC"', '圣诞快乐'),
      document.fonts.load('500 30px "Cinzel"'),
    ]),
    new Promise((r) => setTimeout(r, 4000)),
  ]).then(() => {
    if (!customPhoto) tree.setCardTexture(createGreetingTexture(renderer));
  });
}

// ======================= 鼠标 / 触屏 / 键盘 =======================
const pointers = new Map();
let pinchStart = 0;
let zoomStart = 1;
let lastTap = 0;

stage.addEventListener('pointerdown', (e) => {
  stage.setPointerCapture(e.pointerId);
  pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
  if (pointers.size === 2) {
    const [a, b] = [...pointers.values()];
    pinchStart = Math.hypot(a.x - b.x, a.y - b.y);
    zoomStart = rig.zoomTarget;
  }
  const now = performance.now();
  if (e.pointerType === 'touch' && now - lastTap < 300) toggleBurst();
  lastTap = now;
  markInteraction();
});
stage.addEventListener('pointermove', (e) => {
  const p = pointers.get(e.pointerId);
  if (!p) return;
  if (pointers.size === 1) {
    const dx = e.clientX - p.x;
    rig.angVel += (dx / window.innerWidth) * 9;
    rig.angVel = THREE.MathUtils.clamp(rig.angVel, -6, 6);
  } else if (pointers.size === 2) {
    p.x = e.clientX;
    p.y = e.clientY;
    const [a, b] = [...pointers.values()];
    const d = Math.hypot(a.x - b.x, a.y - b.y);
    if (pinchStart > 0) rig.zoomTarget = THREE.MathUtils.clamp(zoomStart * (pinchStart / d), 0.55, 1.8);
  }
  p.x = e.clientX;
  p.y = e.clientY;
});
const endPointer = (e) => pointers.delete(e.pointerId);
stage.addEventListener('pointerup', endPointer);
stage.addEventListener('pointercancel', endPointer);
stage.addEventListener(
  'wheel',
  (e) => {
    e.preventDefault();
    rig.zoomTarget = THREE.MathUtils.clamp(rig.zoomTarget * Math.exp(e.deltaY * 0.0012), 0.55, 1.8);
    markInteraction();
  },
  { passive: false },
);
stage.addEventListener('dblclick', toggleBurst);

function toggleBurst() {
  setMode(mode === 'scatter' || mode === 'cloud' ? 'tree' : 'scatter', { user: true });
}

window.addEventListener('keydown', (e) => {
  const map = { 1: 'tree', 2: 'scatter', 3: 'cloud', 4: 'tree', 5: 'frame', 6: 'text' };
  if (map[e.key]) {
    if (!intro.classList.contains('hide')) closeIntro();
    setMode(map[e.key], { user: true });
  } else if (e.key === ' ') {
    toggleBurst();
  }
});

// ======================= 手势 =======================
const camBox = $('cam');
const camBtn = $('camBtn');
const chip = $('gestureChip');
let gesture = null;
let lastPalmMove = 0;
let twoHands = false;

function onGestureEvent(name, payload) {
  const now = performance.now();
  switch (name) {
    case 'status':
      toast(payload, 6000);
      break;
    case 'ready':
      toast('手势已就绪：张开手掌试试');
      break;
    case 'gesture':
      chip.textContent = GESTURE_LABELS[payload] || payload;
      chip.classList.toggle('idle', payload === 'none' || payload === 'neutral');
      if (payload !== 'none') handVisibleUntil = now + 8000;
      break;
    case 'explode':
    case 'expand':
      if (mode !== 'scatter' && mode !== 'cloud') setMode('scatter', { user: true });
      else markInteraction();
      break;
    case 'gather':
    case 'contract':
      squeeze = 1;
      if (mode !== 'tree' && mode !== 'text') setMode('tree', { user: true });
      else markInteraction();
      break;
    case 'card':
      setMode(mode === 'frame' ? 'tree' : 'frame', { user: true });
      break;
    case 'palmMove': {
      lastPalmMove = now;
      handVisibleUntil = now + 8000;
      markInteraction();
      // 左右移动 → 旋转；位置 → 跟随（慢速移动时跟随更明显）
      rig.angVel += (payload.vx * 3.2 - rig.angVel) * 0.25;
      const speed = Math.hypot(payload.vx, payload.vy);
      const follow = THREE.MathUtils.clamp(1.2 - speed, 0.25, 1);
      rig.offsetTarget.set((payload.x - 0.5) * 9 * follow, -(payload.y - 0.5) * 6 * follow, 0);
      break;
    }
    case 'twoHands':
      twoHands = true;
      handVisibleUntil = now + 8000;
      markInteraction();
      rig.spreadTarget = payload.spread;
      break;
    case 'twoHandsEnd':
      twoHands = false;
      rig.spreadTarget = 1;
      break;
    default:
      break;
  }
}

async function enableCamera() {
  if (gesture?.running) return;
  camBox.hidden = false;
  camBtn.classList.add('on');
  gesture = new GestureController({
    video: $('video'),
    overlay: $('overlay'),
    isMobile: tier.isMobile,
    onEvent: onGestureEvent,
  });
  try {
    await gesture.start();
  } catch (err) {
    console.error(err);
    const msg =
      err?.name === 'NotAllowedError'
        ? '摄像头权限被拒绝，请在浏览器地址栏允许摄像头后重试'
        : err?.name === 'NotFoundError'
          ? '没有找到摄像头'
          : `手势识别启动失败：${err?.message || err}`;
    toast(msg + '。仍可用鼠标、触屏和底部按钮控制。', 7000);
    disableCamera();
  }
}

function disableCamera() {
  gesture?.stop();
  gesture = null;
  camBox.hidden = true;
  camBtn.classList.remove('on');
  twoHands = false;
  rig.spreadTarget = 1;
}

camBtn.addEventListener('click', () => (gesture ? disableCamera() : enableCamera()));

// ======================= 尺寸 =======================
function resize() {
  const w = window.innerWidth;
  const h = window.innerHeight;
  camera.aspect = w / h;
  // 竖屏时拉远镜头，保证整棵树在画面内
  rig.baseDistance = CONFIG.camera.distance * Math.max(1, 0.78 / camera.aspect);
  camera.updateProjectionMatrix();
  renderer.setSize(w, h);
  composer.setSize(w, h);
  bloom.resolution.set(w, h);
  grade.uniforms.uRes.value.set(w * pixelRatio, h * pixelRatio);
  updateScale();
}
const bufSize = new THREE.Vector2();
function updateScale() {
  renderer.getDrawingBufferSize(bufSize);
  tree.uniforms.uScale.value = bufSize.y / (2 * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)));
}
window.addEventListener('resize', resize);
resize();

// ======================= 自适应性能 =======================
tree.setDrawCount(tier.particles);
const perf = { frames: 0, time: 0, warmup: 3, good: 0 };
function adaptQuality(dt) {
  if (perf.warmup > 0) {
    perf.warmup -= dt;
    return;
  }
  perf.frames++;
  perf.time += dt;
  if (perf.time < 2) return;
  const fps = perf.frames / perf.time;
  perf.frames = 0;
  perf.time = 0;
  if (document.hidden) return;
  if (fps < 42) {
    perf.good = 0;
    if (tree.drawCount > CONFIG.minParticles) {
      tree.setDrawCount(Math.max(CONFIG.minParticles, tree.drawCount * 0.8));
    } else if (pixelRatio > 1) {
      pixelRatio = Math.max(1, pixelRatio - 0.25);
      renderer.setPixelRatio(pixelRatio);
      composer.setPixelRatio(pixelRatio);
      resize();
    }
  } else if (fps > 57) {
    perf.good += 2;
    if (perf.good >= 8 && tree.drawCount < tree.count) {
      tree.setDrawCount(tree.drawCount * 1.1);
      perf.good = 0;
    }
  }
}

// 粒子越多叠加越亮，按实际绘制数量归一化亮度，保持金色不过曝
function baseIntensity() {
  return THREE.MathUtils.clamp(0.6 * Math.sqrt(24000 / (tree.drawCount || 24000)), 0.4, 0.85);
}

// ======================= 主循环 =======================
const clock = new THREE.Clock();
let elapsed = 0;
const tmpTarget = new THREE.Vector3();

function simulate(dt, now) {
  elapsed += dt;
  modeTime += dt;

  // 开场：粒子从屏幕四周飞入聚成树
  if (mode === 'intro' && modeTime > 0.5) {
    setMode('tree');
    scatterScaleTarget = 1;
    morphRate = 1.05;
  }
  if (mode === 'scatter' && modeTime > 1.7) setMode('cloud');
  if (pendingTree !== null) {
    pendingTree -= dt;
    if (pendingTree <= 0) {
      pendingTree = null;
      setMode('tree');
    }
  }
  tickDemo(dt, now);

  // 权重插值（指数平滑，保证可随时打断）
  const k = 1 - Math.exp(-dt * morphRate);
  weights.x += (wTarget.x - weights.x) * k;
  weights.y += (wTarget.y - weights.y) * k;
  weights.z += (wTarget.z - weights.z) * k;
  weights.w += (wTarget.w - weights.w) * k;
  scatterScale += (scatterScaleTarget - scatterScale) * (1 - Math.exp(-dt * (mode === 'scatter' ? 2.6 : 0.8)));
  flash *= Math.exp(-dt * 2.4);
  squeeze *= Math.exp(-dt * 2.0);

  // 旋转
  rig.angVel *= Math.exp(-dt * 1.6);
  if (mode === 'frame') {
    const target = Math.round(rig.angle / (Math.PI * 2)) * Math.PI * 2;
    rig.angle += (target - rig.angle) * (1 - Math.exp(-dt * 3.5));
    rig.angVel *= 0.9;
  } else {
    rig.angle += ((reduceMotion ? 0.3 : 1) * AUTO_SPIN[mode] + rig.angVel) * dt;
  }

  // 手部跟随
  if (now - lastPalmMove > 700) rig.offsetTarget.set(0, 0, 0);
  if (mode === 'frame') rig.offsetTarget.multiplyScalar(0.3);
  rig.offset.lerp(rig.offsetTarget, 1 - Math.exp(-dt * 3));

  // 缩放（双手 / 握拳收缩）
  if (!twoHands) rig.spreadTarget = 1;
  rig.spread += (rig.spreadTarget - rig.spread) * (1 - Math.exp(-dt * 4));
  const scale = rig.spread * (1 - 0.35 * Math.sin(Math.min(squeeze, 1) * Math.PI) * squeeze);

  tree.group.rotation.y = rig.angle;
  tree.group.position.copy(rig.offset);
  tree.group.scale.setScalar(scale);

  // 电影镜头：缓慢漂移 + 推拉
  rig.zoom += (rig.zoomTarget - rig.zoom) * (1 - Math.exp(-dt * 4));
  rig.textBlend += ((mode === 'text' ? 1 : 0) - rig.textBlend) * (1 - Math.exp(-dt * 2));
  const textPush = 1 + rig.textBlend * 0.12;
  const introPush = 1 + Math.max(0, 1 - elapsed / 5) * 0.35;
  const dist = rig.baseDistance * rig.zoom * textPush * introPush;
  camera.position.set(Math.sin(elapsed * 0.07) * 1.4, 1.1 + Math.sin(elapsed * 0.11) * 0.6, dist);
  tmpTarget.set(0, CONFIG.camera.lookY - rig.textBlend * 2.2, 0);
  camera.lookAt(tmpTarget);

  // uniform
  tree.uniforms.uFocus.value = camera.position.distanceTo(tree.group.position);
  tree.uniforms.uAperture.value = mode === 'frame' ? 0.025 : 0.035;
  tree.update(elapsed, weights, {
    scatterScale,
    intensity: baseIntensity() * (1 + flash * 0.8),
  });

  // 后期参数随状态变化：爆散时拖尾更长、泛光更强
  const transit = 1 - Math.max(weights.x, weights.y, weights.z, weights.w);
  const dampTarget = reduceMotion ? 0.6 : 0.74 + weights.y * 0.14 + transit * 0.12;
  afterimage.uniforms.damp.value += (Math.min(dampTarget, 0.9) - afterimage.uniforms.damp.value) * 0.08;
  bloom.strength = CONFIG.bloom.strength + flash * 0.7 + weights.w * 0.15;
  grade.uniforms.uTime.value = elapsed;
  grade.uniforms.uFlash.value = flash;

  // 文字
  sideTitle.classList.toggle('dim', intro.classList.contains('hide') && (mode === 'scatter' || mode === 'cloud'));
  dock.classList.toggle('idle', now - lastInteraction > 6000 && pointers.size === 0);

}

function frame() {
  const dt = Math.min(clock.getDelta(), 0.05);
  const now = performance.now();
  gesture?.update(now);
  simulate(dt, now);
  adaptQuality(dt);
  composer.render(dt);
  requestAnimationFrame(frame);
}

updateUI();
requestAnimationFrame(frame);

if (!window.isSecureContext) {
  setTimeout(() => toast('当前不是 HTTPS 环境，摄像头手势不可用（动画和按钮可正常使用）', 6000), 1500);
}

// 方便调试
window.__xmas = {
  setMode,
  tree,
  tier,
  get mode() {
    return mode;
  },
  advance(seconds) {
    for (let t = 0; t < seconds; t += 1 / 30) simulate(1 / 30, performance.now());
  },
};
