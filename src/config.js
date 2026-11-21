// 全局配置：粒子数量分级、颜色、动画节奏、手势阈值
export const CONFIG = {
  // 粒子数量（根据设备自动选择，运行时还会按帧率自适应下调/回升）
  tiers: {
    ultra: { particles: 50000, comets: 32, dust: 4000, links: 520, pixelRatio: 2 },
    high: { particles: 36000, comets: 26, dust: 3000, links: 420, pixelRatio: 1.75 },
    mobile: { particles: 26000, comets: 20, dust: 2000, links: 300, pixelRatio: 1.5 },
    low: { particles: 16000, comets: 14, dust: 1200, links: 200, pixelRatio: 1.25 },
  },
  minParticles: 9000,
  targetFps: 50,

  tree: {
    bottom: -4.6,
    height: 9.4,
    radius: 3.6,
    tiers: 7,
    starY: 5.25,
  },

  frame: { half: 2.25, band: 0.3 },

  camera: { fov: 45, distance: 21, lookY: 0.35 },

  bloom: { strength: 0.85, radius: 0.55, threshold: 0.32 },

  // 状态切换速度（越大越快）
  morphRate: { tree: 1.5, scatter: 4.2, cloud: 1.4, frame: 1.7 },

  // 自动演示时间线（秒）
  demo: [
    ['tree', 8],
    ['scatter', 7],
    ['tree', 6],
    ['frame', 6],
    ['text', 7],
  ],
  idleResumeSeconds: 14,

  gesture: {
    stableMs: 170, // 同一手势需持续多久才被确认
    pinchEnter: 0.34, // 拇指-食指距离 / 手掌尺寸
    pinchExit: 0.5,
    cooldownMs: 1100, // 离散触发冷却
    lostMs: 450, // 手丢失多久后视为无手
    detectIntervalDesktop: 30,
    detectIntervalMobile: 55,
    wasmBase: 'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/wasm',
    modelUrl:
      'https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task',
  },
};

// 线性空间颜色（允许 >1 产生 HDR 泛光）
export const PALETTE = {
  gold: [1.0, 0.66, 0.22],
  champagne: [1.0, 0.82, 0.55],
  yellow: [1.0, 0.8, 0.18],
  warmWhite: [1.0, 0.92, 0.8],
  red: [1.0, 0.08, 0.1],
  deepRed: [0.75, 0.03, 0.06],
  blue: [0.25, 0.45, 1.0],
  green: [0.15, 0.85, 0.4],
};

export function detectTier() {
  const params = new URLSearchParams(location.search);
  const forced = params.get('quality');
  if (forced && CONFIG.tiers[forced]) return { name: forced, ...CONFIG.tiers[forced] };

  const ua = navigator.userAgent || '';
  const isMobile =
    /Android|iPhone|iPad|iPod|Mobile|HarmonyOS/i.test(ua) ||
    (navigator.maxTouchPoints > 1 && Math.min(screen.width, screen.height) < 900);
  const cores = navigator.hardwareConcurrency || 4;
  const mem = navigator.deviceMemory || 4;

  let name;
  if (isMobile) name = cores >= 8 && mem >= 6 ? 'mobile' : 'low';
  else name = cores >= 8 ? 'ultra' : 'high';

  const tier = { name, isMobile, ...CONFIG.tiers[name] };
  const count = parseInt(params.get('count'), 10);
  if (count > 1000 && count <= 120000) tier.particles = count;
  return tier;
}
