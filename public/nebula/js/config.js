// NEBULA — configuration: modes, palettes, presets, defaults.

export const MODES = [
  { id: 'butterfly', key: 'A', name: '蝴蝶模式', en: 'LUMINOUS WING' },
  { id: 'universe', key: 'B', name: '粒子宇宙', en: 'PARTICLE COSMOS' },
  { id: 'burst', key: 'C', name: '能量爆发', en: 'ENERGY BURST' },
  { id: 'tunnel', key: 'D', name: '时空隧道', en: 'TIME CORRIDOR' },
  { id: 'aurora', key: 'E', name: '极光幻境', en: 'AURORA DREAM' },
  { id: 'rebirth', key: 'F', name: '蝴蝶重生', en: 'REBIRTH' },
];

// Per-mode "director" targets. Every value is eased while switching modes,
// so transitions are continuous instead of cuts.
export const DIRECTOR = {
  butterfly: { wing: 1, echo: 0.25, echoSpread: 0.25, tunnel: 0.7, tunnelSpeed: 0.12, streaks: 0.25, rays: 0.8, core: 0.8, rings: 0, camDist: 11, camLift: 0.4, tunnelNear: -3, focus: 11 },
  universe:  { wing: 0, echo: 0, echoSpread: 0, tunnel: 0.12, tunnelSpeed: 0.05, streaks: 0.0, rays: 0.45, core: 0.55, rings: 0, camDist: 21, camLift: 2.5, tunnelNear: -6, focus: 20 },
  burst:     { wing: 0.35, echo: 0, echoSpread: 0, tunnel: 0.3, tunnelSpeed: 0.4, streaks: 0.5, rays: 1.25, core: 1.6, rings: 1, camDist: 19, camLift: 0.6, tunnelNear: -4, focus: 18 },
  tunnel:    { wing: 1, echo: 1, echoSpread: 1, tunnel: 1, tunnelSpeed: 1, streaks: 1, rays: 1.1, core: 1.2, rings: 0, camDist: 12.5, camLift: 0.2, tunnelNear: 9, focus: 12 },
  aurora:    { wing: 0, echo: 0, echoSpread: 0, tunnel: 0.0, tunnelSpeed: 0.05, streaks: 0, rays: 0.3, core: 0.25, rings: 0, camDist: 17, camLift: 0.4, tunnelNear: -10, focus: 16 },
  rebirth:   { wing: 1, echo: 0.15, echoSpread: 0.1, tunnel: 0.45, tunnelSpeed: 0.08, streaks: 0.15, rays: 0.9, core: 1.0, rings: 0.35, camDist: 12, camLift: 0.5, tunnelNear: -3, focus: 12 },
};

// Colors: bg, body (butterfly), particle (primary), accent (secondary), glow (tertiary)
export const PALETTES = {
  butterfly: { bg: '#020206', body: '#fff1d6', particle: '#f3d9a4', accent: '#7cc8ff', glow: '#ffffff' },
  universe: { bg: '#01020a', body: '#cfe6ff', particle: '#3d8bff', accent: '#a46bff', glow: '#7ff3ff' },
  burst: { bg: '#060205', body: '#ffe2c4', particle: '#ff7a4d', accent: '#ff4fa8', glow: '#ffd27a' },
  tunnel: { bg: '#010309', body: '#eaf6ff', particle: '#4aa8ff', accent: '#9be9ff', glow: '#ffffff' },
  aurora: { bg: '#01040a', body: '#e3f2ff', particle: '#9a63ff', accent: '#ff5fb7', glow: '#4ef0e0' },
  rebirth: { bg: '#05020a', body: '#ffe7f3', particle: '#ff5fae', accent: '#f6cf8a', glow: '#b27bff' },
};

export const DEFAULTS = {
  count: 90000, // particles (capped by device tier)
  size: 1.0,
  speed: 1.0,
  spread: 1.0,
  glow: 1.0,
  scale: 1.0,
  flap: 1.0,
  rotate: 0.35,
  light: 1.0,
  bloom: 1.0,
  dof: 0.45,
  blur: 0.25,
  anim: 1.0,
  mouse: 'repel', // repel | attract | swirl
  audioSens: 1.0,
};

export const RANGES = {
  count: [5000, 200000, 1000],
  size: [0.2, 3, 0.01],
  speed: [0, 3, 0.01],
  spread: [0.3, 2.5, 0.01],
  glow: [0.1, 3, 0.01],
  scale: [0.4, 2.2, 0.01],
  flap: [0, 3, 0.01],
  rotate: [-2, 2, 0.01],
  light: [0.2, 2.5, 0.01],
  bloom: [0, 3, 0.01],
  dof: [0, 1.5, 0.01],
  blur: [0, 0.95, 0.01],
  anim: [0, 3, 0.01],
  audioSens: [0, 3, 0.01],
};

export const PRESETS = [
  {
    id: 'celestial', name: '星辉之蝶', en: 'Celestial Wing', mode: 'butterfly',
    colors: PALETTES.butterfly, params: {},
  },
  {
    id: 'origin', name: '原初回响', en: 'Monochrome Origin', mode: 'tunnel',
    colors: { bg: '#030303', body: '#fff4dc', particle: '#e9dcc0', accent: '#bfb6a6', glow: '#ffffff' },
    params: { glow: 0.85, bloom: 1.1, rotate: 0.15, dof: 0.6 },
  },
  {
    id: 'lightyear', name: '光年隧道', en: 'Lightyear Corridor', mode: 'tunnel',
    colors: PALETTES.tunnel, params: { speed: 1.4, rotate: 0.5 },
  },
  {
    id: 'neon', name: '霓虹脉冲', en: 'Neon Pulse', mode: 'burst',
    colors: PALETTES.burst, params: { bloom: 1.25, size: 1.1 },
  },
  {
    id: 'boreal', name: '北境极光', en: 'Boreal Dream', mode: 'aurora',
    colors: PALETTES.aurora, params: { blur: 0.4, size: 1.15 },
  },
  {
    id: 'galaxy', name: '深空星系', en: 'Deep Galaxy', mode: 'universe',
    colors: PALETTES.universe, params: { rotate: 0.6 },
  },
  {
    id: 'nirvana', name: '涅槃', en: 'Nirvana', mode: 'rebirth',
    colors: PALETTES.rebirth, params: {},
  },
  {
    id: 'glacier', name: '冰川回响', en: 'Glacier Echo', mode: 'tunnel',
    colors: { bg: '#00060a', body: '#effcff', particle: '#7ff3ff', accent: '#d7f7ff', glow: '#5fb8ff' },
    params: { speed: 0.6, blur: 0.55, rotate: -0.4 },
  },
  {
    id: 'corona', name: '珊瑚日冕', en: 'Coral Corona', mode: 'burst',
    colors: { bg: '#070302', body: '#fff0d8', particle: '#f6c46a', accent: '#ff7a4d', glow: '#ffe7b3' },
    params: { spread: 1.3, bloom: 1.1 },
  },
  {
    id: 'amethyst', name: '紫晶星云', en: 'Amethyst Nebula', mode: 'universe',
    colors: { bg: '#04010a', body: '#f3e6ff', particle: '#b27bff', accent: '#ff5fb7', glow: '#7cc8ff' },
    params: { spread: 1.25, size: 1.2, rotate: -0.5 },
  },
];

export const DEMO_SEQUENCE = ['celestial', 'lightyear', 'neon', 'boreal', 'nirvana', 'galaxy', 'origin', 'corona', 'glacier', 'amethyst'];
export const DEMO_INTERVAL = 12; // seconds per scene
