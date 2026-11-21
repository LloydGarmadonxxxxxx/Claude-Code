import * as THREE from 'three';
import { CONFIG, PALETTE } from './config.js';
import {
  particleVertex,
  particleFragment,
  linkVertex,
  linkFragment,
  cometVertex,
  cometFragment,
  glowVertex,
  glowFragment,
  dustVertex,
  dustFragment,
} from './shaders.js';

const TAU = Math.PI * 2;

// 可复现的随机数
function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function pickWeighted(rand, table) {
  let r = rand();
  for (const [value, w] of table) {
    if ((r -= w) <= 0) return value;
  }
  return table[table.length - 1][0];
}

function gaussian(rand) {
  return (rand() + rand() + rand() + rand() - 2) / 2;
}

const { bottom: TREE_BOTTOM, height: TREE_H, radius: TREE_R, tiers: TIERS, starY: STAR_Y } = CONFIG.tree;

// 分层的圆锥半径，形成枝叶层次
function treeRadius(h) {
  const tierPhase = (h * TIERS) % 1;
  const tier = 0.8 + 0.2 * Math.pow(1 - tierPhase, 1.6);
  return TREE_R * Math.pow(1 - h, 1.05) * tier + 0.04;
}

// 五角星半径函数（极坐标）
function starRadius(theta, outer, inner) {
  const seg = TAU / 10;
  const k = (((theta % TAU) + TAU) % TAU) / seg;
  const i = Math.floor(k);
  const f = k - i;
  const a = i % 2 === 0 ? outer : inner;
  const b = i % 2 === 0 ? inner : outer;
  return a + (b - a) * f;
}

const BODY_COLORS = [
  ['gold', 0.42],
  ['champagne', 0.2],
  ['yellow', 0.1],
  ['warmWhite', 0.12],
  ['red', 0.11],
  ['blue', 0.025],
  ['green', 0.025],
];
const ORNAMENT_COLORS = [
  ['red', 0.38],
  ['gold', 0.24],
  ['blue', 0.14],
  ['green', 0.1],
  ['warmWhite', 0.14],
];

const CATEGORIES = [
  ['body', 0.6],
  ['garland', 0.11],
  ['ornament', 0.07],
  ['star', 0.03],
  ['base', 0.05],
  ['halo', 0.14],
];

export class ParticleTree {
  constructor(tier) {
    this.tier = tier;
    this.count = tier.particles;
    this.group = new THREE.Group();

    this.uniforms = {
      uTime: { value: 0 },
      uW: { value: new THREE.Vector4(0, 1, 0, 0) },
      uScatterScale: { value: 2.6 },
      uSize: { value: 0.036 },
      uScale: { value: 800 },
      uFocus: { value: 21 },
      uAperture: { value: 0.035 },
      uIntensity: { value: 1 },
      uLinkAlpha: { value: 0.16 },
      uGlow: { value: 0 },
    };

    this.#buildParticles();
    this.#buildLinks();
    this.#buildComets();
    this.#buildStarGlow();
    this.#buildCard();
  }

  #buildParticles() {
    const n = this.count;
    const rand = mulberry32(20251225);
    const pos = new Float32Array(n * 3);
    const scatter = new Float32Array(n * 3);
    const cloud = new Float32Array(n * 3);
    const frame = new Float32Array(n * 4);
    const color = new Float32Array(n * 3);
    const data = new Float32Array(n * 4);
    const category = new Uint8Array(n);

    // 彩球中心
    const ornamentCenters = [];
    const ornamentCount = Math.max(60, Math.round(n / 300));
    for (let i = 0; i < ornamentCount; i++) {
      const h = 0.05 + rand() * 0.82;
      const a = rand() * TAU;
      const r = treeRadius(h) * (0.9 + rand() * 0.12);
      ornamentCenters.push({
        p: [Math.cos(a) * r, TREE_BOTTOM + h * TREE_H, Math.sin(a) * r],
        c: PALETTE[pickWeighted(rand, ORNAMENT_COLORS)],
        s: 0.09 + rand() * 0.12,
      });
    }

    const { half: FH, band: FB } = CONFIG.frame;

    for (let i = 0; i < n; i++) {
      const cat = pickWeighted(rand, CATEGORIES);
      let x = 0, y = 0, z = 0;
      let col = PALETTE.gold;
      let size = 1;
      let type = 0;
      let bright = 1;

      if (cat === 'body') {
        const h = 1 - Math.sqrt(rand());
        const r = treeRadius(h) * (0.5 + 0.5 * Math.pow(rand(), 0.35));
        const a = rand() * TAU;
        x = Math.cos(a) * r;
        z = Math.sin(a) * r;
        y = TREE_BOTTOM + h * TREE_H + (rand() - 0.5) * 0.12;
        col = PALETTE[pickWeighted(rand, BODY_COLORS)];
        size = 0.55 + Math.pow(rand(), 3) * 2.0;
        if (rand() < 0.06) {
          type = 1;
          size = 2.2 + rand() * 1.6;
          col = rand() < 0.6 ? PALETTE.warmWhite : PALETTE.champagne;
          bright = 1.4;
        }
      } else if (cat === 'garland') {
        const h = rand();
        const strand = rand() < 0.5 ? 0 : Math.PI;
        const a = h * TAU * 6.5 + strand;
        const r = treeRadius(h) * 1.03 + (rand() - 0.5) * 0.12;
        x = Math.cos(a) * r;
        z = Math.sin(a) * r;
        y = TREE_BOTTOM + h * TREE_H + (rand() - 0.5) * 0.1;
        col = rand() < 0.65 ? PALETTE.warmWhite : PALETTE.champagne;
        size = 0.8 + rand() * 0.9;
        bright = 1.25;
      } else if (cat === 'ornament') {
        const o = ornamentCenters[(rand() * ornamentCenters.length) | 0];
        const u = rand() * TAU;
        const v = Math.acos(2 * rand() - 1);
        const rr = o.s * Math.cbrt(rand());
        x = o.p[0] + Math.sin(v) * Math.cos(u) * rr;
        y = o.p[1] + Math.cos(v) * rr;
        z = o.p[2] + Math.sin(v) * Math.sin(u) * rr;
        col = o.c;
        size = 1.2 + rand() * 1.4;
        type = 3;
        bright = 1.5;
      } else if (cat === 'star') {
        const th = rand() * TAU;
        const edge = rand() < 0.55;
        const rr = starRadius(th + Math.PI / 2, 0.78, 0.32) * (edge ? 1 : Math.sqrt(rand()));
        x = Math.cos(th) * rr;
        y = STAR_Y + Math.sin(th) * rr;
        z = (rand() - 0.5) * 0.12;
        col = rand() < 0.5 ? PALETTE.warmWhite : PALETTE.yellow;
        size = 0.9 + rand() * 1.2;
        type = 2;
        bright = 1.7;
      } else if (cat === 'base') {
        const a = rand() * TAU;
        const r = 1.2 + Math.pow(rand(), 0.7) * 3.6;
        x = Math.cos(a) * r;
        z = Math.sin(a) * r;
        y = TREE_BOTTOM - 0.2 + gaussian(rand) * 0.08;
        col = rand() < 0.7 ? PALETTE.gold : PALETTE.champagne;
        size = 0.5 + rand() * 0.8;
        bright = 0.75;
      } else {
        // halo：树周围漂浮的星尘
        const a = rand() * TAU;
        const h = rand();
        const r = treeRadius(h * 0.9) + 0.6 + Math.pow(rand(), 1.5) * 3.2;
        x = Math.cos(a) * r;
        z = Math.sin(a) * r;
        y = TREE_BOTTOM - 0.3 + h * (TREE_H + 1.5);
        col = rand() < 0.5 ? PALETTE.warmWhite : PALETTE.gold;
        size = 0.4 + Math.pow(rand(), 2) * 1.4;
        bright = 0.55;
        if (rand() < 0.05) {
          type = 1;
          size = 2.0 + rand();
          bright = 1.1;
        }
      }

      category[i] = CATEGORIES.findIndex((c) => c[0] === cat);
      pos.set([x, y, z], i * 3);
      color.set([col[0] * bright, col[1] * bright, col[2] * bright], i * 3);
      data.set([size, rand(), rand(), type], i * 4);

      // 爆散目标：以树上位置方向为主，叠加随机方向，向屏幕外飞散
      {
        const u = rand() * TAU;
        const v = Math.acos(2 * rand() - 1);
        let dx = Math.sin(v) * Math.cos(u);
        let dy = Math.cos(v);
        let dz = Math.sin(v) * Math.sin(u);
        const len = Math.hypot(x, y - 0.5, z) || 1;
        dx = dx * 0.65 + (x / len) * 0.35;
        dy = dy * 0.65 + ((y - 0.5) / len) * 0.35;
        dz = dz * 0.65 + (z / len) * 0.35;
        const l2 = Math.hypot(dx, dy, dz) || 1;
        const R = 9 + Math.pow(rand(), 0.6) * 24;
        scatter.set([(dx / l2) * R, (dy / l2) * R * 0.8, (dz / l2) * R], i * 3);
      }

      // 星云目标：螺旋臂 + 球壳
      {
        let cx, cy, cz;
        if (rand() < 0.58) {
          const arm = (rand() * 3) | 0;
          const r = 1.2 + Math.pow(rand(), 0.75) * 11;
          const a = (arm / 3) * TAU + r * 0.42 + gaussian(rand) * 0.45;
          cx = Math.cos(a) * r;
          cz = Math.sin(a) * r;
          cy = gaussian(rand) * (0.9 + r * 0.06);
        } else {
          const u = rand() * TAU;
          const v = Math.acos(2 * rand() - 1);
          const r = 2.5 + Math.pow(rand(), 0.5) * 8.5;
          cx = Math.sin(v) * Math.cos(u) * r;
          cy = Math.cos(v) * r * 0.85;
          cz = Math.sin(v) * Math.sin(u) * r;
        }
        cloud.set([cx, cy + 0.3, cz], i * 3);
      }

      // 卡片边框目标
      {
        const roll = rand();
        let fx, fy, fz, isBand = 0;
        if (roll < 0.36) {
          const side = (rand() * 4) | 0;
          const along = (rand() * 2 - 1) * (FH + FB);
          const across = FH + rand() * FB;
          if (side === 0) { fx = along; fy = across; }
          else if (side === 1) { fx = along; fy = -across; }
          else if (side === 2) { fx = across; fy = along; }
          else { fx = -across; fy = along; }
          fz = gaussian(rand) * 0.1;
          isBand = 1;
        } else if (roll < 0.44) {
          // 内侧细亮线
          const side = (rand() * 4) | 0;
          const along = (rand() * 2 - 1) * (FH - 0.08);
          const s = FH - 0.1;
          if (side === 0) { fx = along; fy = s; }
          else if (side === 1) { fx = along; fy = -s; }
          else if (side === 2) { fx = s; fy = along; }
          else { fx = -s; fy = along; }
          fz = 0.05;
          isBand = 1;
        } else {
          const a = rand() * TAU;
          const r = 3.1 + Math.pow(rand(), 0.8) * 8.5;
          fx = Math.cos(a) * r;
          fy = Math.sin(a) * r * 0.82;
          fz = -0.8 + gaussian(rand) * 2.2;
        }
        frame.set([fx, fy + 0.3, fz, isBand], i * 4);
      }
    }

    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    geo.setAttribute('aScatter', new THREE.BufferAttribute(scatter, 3));
    geo.setAttribute('aCloud', new THREE.BufferAttribute(cloud, 3));
    geo.setAttribute('aFrame', new THREE.BufferAttribute(frame, 4));
    geo.setAttribute('aColor', new THREE.BufferAttribute(color, 3));
    geo.setAttribute('aData', new THREE.BufferAttribute(data, 4));
    geo.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 60);

    const mat = new THREE.ShaderMaterial({
      uniforms: this.uniforms,
      vertexShader: particleVertex,
      fragmentShader: particleFragment,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      transparent: true,
    });

    this.points = new THREE.Points(geo, mat);
    this.points.frustumCulled = false;
    this.points.renderOrder = 2;
    this.group.add(this.points);
    this.geometry = geo;
    this._attrs = { pos, scatter, cloud, frame, color, data, category };
  }

  // 在相邻粒子之间建立少量连线，营造“能量网络”的连接感
  #buildLinks() {
    const { pos, scatter, cloud, frame, color, data, category } = this._attrs;
    const n = this.count;
    const rand = mulberry32(77);
    const target = this.tier.links;
    const pairs = [];
    let guard = 0;
    while (pairs.length < target && guard++ < target * 30) {
      const i = (rand() * n) | 0;
      if (category[i] !== 0 && category[i] !== 1) continue;
      let best = -1;
      let bestD = 0.75 * 0.75;
      for (let k = 0; k < 60; k++) {
        const j = (rand() * n) | 0;
        if (j === i) continue;
        const dx = pos[i * 3] - pos[j * 3];
        const dy = pos[i * 3 + 1] - pos[j * 3 + 1];
        const dz = pos[i * 3 + 2] - pos[j * 3 + 2];
        const d = dx * dx + dy * dy + dz * dz;
        if (d < bestD && d > 0.04) {
          bestD = d;
          best = j;
        }
      }
      if (best >= 0) pairs.push(i, best);
    }

    const m = pairs.length;
    const copy = (src, size) => {
      const out = new Float32Array(m * size);
      for (let k = 0; k < m; k++) {
        for (let c = 0; c < size; c++) out[k * size + c] = src[pairs[k] * size + c];
      }
      return out;
    };
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(copy(pos, 3), 3));
    geo.setAttribute('aScatter', new THREE.BufferAttribute(copy(scatter, 3), 3));
    geo.setAttribute('aCloud', new THREE.BufferAttribute(copy(cloud, 3), 3));
    geo.setAttribute('aFrame', new THREE.BufferAttribute(copy(frame, 4), 4));
    geo.setAttribute('aData', new THREE.BufferAttribute(copy(data, 4), 4));
    void color;

    const mat = new THREE.ShaderMaterial({
      uniforms: this.uniforms,
      vertexShader: linkVertex,
      fragmentShader: linkFragment,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      transparent: true,
    });
    this.links = new THREE.LineSegments(geo, mat);
    this.links.frustumCulled = false;
    this.links.renderOrder = 1;
    this.group.add(this.links);
  }

  // 带拖尾的动态光点（InstancedBufferGeometry）
  #buildComets() {
    const TRAIL = 46;
    const count = this.tier.comets;
    const rand = mulberry32(1225);
    const geo = new THREE.InstancedBufferGeometry();
    const base = new Float32Array(TRAIL * 3);
    const idx = new Float32Array(TRAIL);
    for (let i = 0; i < TRAIL; i++) idx[i] = i / (TRAIL - 1);
    geo.setAttribute('position', new THREE.BufferAttribute(base, 3));
    geo.setAttribute('aIdx', new THREE.BufferAttribute(idx, 1));

    const comet = new Float32Array(count * 4);
    const col = new Float32Array(count * 3);
    const choices = [PALETTE.warmWhite, PALETTE.champagne, PALETTE.gold, PALETTE.red, PALETTE.blue];
    for (let i = 0; i < count; i++) {
      comet.set([rand(), 0.7 + rand() * 0.9, rand() * 0.5, rand() < 0.5 ? 1 : -1], i * 4);
      const c = i < count * 0.7 ? choices[(rand() * 3) | 0] : choices[3 + ((rand() * 2) | 0)];
      col.set([c[0] * 1.4, c[1] * 1.4, c[2] * 1.4], i * 3);
    }
    geo.setAttribute('aComet', new THREE.InstancedBufferAttribute(comet, 4));
    geo.setAttribute('aCometColor', new THREE.InstancedBufferAttribute(col, 3));
    geo.instanceCount = count;

    const mat = new THREE.ShaderMaterial({
      uniforms: this.uniforms,
      vertexShader: cometVertex,
      fragmentShader: cometFragment,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      transparent: true,
    });
    this.comets = new THREE.Points(geo, mat);
    this.comets.frustumCulled = false;
    this.comets.renderOrder = 3;
    this.group.add(this.comets);
  }

  #buildStarGlow() {
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array([0, CONFIG.tree.starY, 0.05]), 3));
    const mat = new THREE.ShaderMaterial({
      uniforms: this.uniforms,
      vertexShader: glowVertex,
      fragmentShader: glowFragment,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      depthTest: false,
      transparent: true,
    });
    this.starGlow = new THREE.Points(geo, mat);
    this.starGlow.frustumCulled = false;
    this.starGlow.renderOrder = 4;
    this.group.add(this.starGlow);
  }

  #buildCard() {
    const size = CONFIG.frame.half * 2 - 0.3;
    const mat = new THREE.MeshBasicMaterial({
      color: new THREE.Color(1.1, 1.05, 1.0),
      transparent: true,
      opacity: 0,
      depthWrite: false,
      side: THREE.DoubleSide,
    });
    this.card = new THREE.Mesh(new THREE.PlaneGeometry(size, size), mat);
    this.card.position.set(0, 0.3, 0);
    this.card.renderOrder = 0;
    this.card.visible = false;
    this.group.add(this.card);
  }

  setCardTexture(texture) {
    const old = this.card.material.map;
    this.card.material.map = texture;
    this.card.material.needsUpdate = true;
    if (old && old !== texture) old.dispose();
  }

  setDrawCount(n) {
    this.drawCount = Math.max(1000, Math.min(this.count, Math.round(n)));
    this.geometry.setDrawRange(0, this.drawCount);
  }

  // 每帧：只更新少量 uniform
  update(time, weights, opts) {
    const u = this.uniforms;
    u.uTime.value = time;
    u.uW.value.copy(weights);
    u.uScatterScale.value = opts.scatterScale;
    u.uIntensity.value = opts.intensity;
    u.uGlow.value = Math.pow(Math.max(0, weights.x), 2.2);
    u.uLinkAlpha.value = 0.17;

    // 卡片：边框形成后淡入并带回弹缩放
    const show = THREE.MathUtils.smoothstep(weights.w, 0.55, 0.92);
    const m = this.card.material;
    m.opacity = show;
    m.depthWrite = show > 0.95;
    this.card.visible = show > 0.002 && !!m.map;
    const s = 0.72 + 0.28 * easeOutBack(show);
    this.card.scale.set(s, s, 1);
  }
}

function easeOutBack(x) {
  const c1 = 1.70158;
  const c3 = c1 + 1;
  return 1 + c3 * Math.pow(x - 1, 3) + c1 * Math.pow(x - 1, 2);
}

// 背景星尘（世界坐标，不随树旋转，带来视差纵深）
export function createStardust(count, uniforms) {
  const rand = mulberry32(4242);
  const pos = new Float32Array(count * 3);
  const dust = new Float32Array(count * 4);
  for (let i = 0; i < count; i++) {
    const u = rand() * TAU;
    const r = 18 + rand() * 55;
    pos.set([Math.cos(u) * r, (rand() - 0.5) * 80, Math.sin(u) * r - 20], i * 3);
    dust.set([0.04 + Math.pow(rand(), 4) * 0.12, rand(), 0.15 + rand() * 0.5, rand()], i * 4);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setAttribute('aDust', new THREE.BufferAttribute(dust, 4));
  const mat = new THREE.ShaderMaterial({
    uniforms: { uTime: uniforms.uTime, uScale: uniforms.uScale },
    vertexShader: dustVertex,
    fragmentShader: dustFragment,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    transparent: true,
  });
  const pts = new THREE.Points(geo, mat);
  pts.frustumCulled = false;
  return pts;
}

// 默认祝福卡片：用 Canvas 2D 绘制（非静态图片素材）
export function createGreetingTexture(renderer) {
  const S = 1024;
  const cv = document.createElement('canvas');
  cv.width = cv.height = S;
  const g = cv.getContext('2d');

  const bg = g.createRadialGradient(S / 2, S * 0.42, 40, S / 2, S / 2, S * 0.75);
  bg.addColorStop(0, '#4a0d12');
  bg.addColorStop(0.55, '#24060a');
  bg.addColorStop(1, '#0c0204');
  g.fillStyle = bg;
  g.fillRect(0, 0, S, S);

  const rand = mulberry32(99);
  for (let i = 0; i < 260; i++) {
    const x = rand() * S;
    const y = rand() * S;
    const r = Math.pow(rand(), 3) * 3 + 0.4;
    g.fillStyle = `rgba(255, ${200 + rand() * 50}, ${120 + rand() * 80}, ${0.15 + rand() * 0.5})`;
    g.beginPath();
    g.arc(x, y, r, 0, TAU);
    g.fill();
  }

  const goldGrad = (y0, y1) => {
    const gr = g.createLinearGradient(0, y0, 0, y1);
    gr.addColorStop(0, '#fff1c4');
    gr.addColorStop(0.45, '#f2c25b');
    gr.addColorStop(1, '#a8741f');
    return gr;
  };

  g.strokeStyle = goldGrad(0, S);
  g.lineWidth = 6;
  g.strokeRect(44, 44, S - 88, S - 88);
  g.lineWidth = 2;
  g.strokeRect(64, 64, S - 128, S - 128);

  // 小星星
  g.save();
  g.translate(S / 2, 250);
  g.fillStyle = goldGrad(-60, 60);
  g.shadowColor = 'rgba(255,200,100,0.9)';
  g.shadowBlur = 30;
  g.beginPath();
  for (let k = 0; k < 10; k++) {
    const r = k % 2 === 0 ? 58 : 23;
    const a = -Math.PI / 2 + (k * Math.PI) / 5;
    g.lineTo(Math.cos(a) * r, Math.sin(a) * r);
  }
  g.closePath();
  g.fill();
  g.restore();

  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.shadowColor = 'rgba(255, 190, 90, 0.75)';
  g.shadowBlur = 24;
  g.fillStyle = goldGrad(380, 620);
  g.font = '150px "Great Vibes", "Snell Roundhand", cursive';
  g.fillText('Merry', S / 2, 430);
  g.fillText('Christmas', S / 2, 580);

  g.shadowBlur = 14;
  g.fillStyle = goldGrad(690, 760);
  g.font = '600 76px "Noto Serif SC", "Songti SC", serif';
  g.fillText('圣诞快乐', S / 2, 728);

  g.shadowBlur = 0;
  g.fillStyle = 'rgba(255, 228, 170, 0.75)';
  g.font = '500 30px "Cinzel", serif';
  g.fillText('PEACE · JOY · LIGHT', S / 2, 830);

  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());
  return tex;
}

// 用户上传的照片：居中裁成正方形，加金色内框
export async function createPhotoTexture(file, renderer) {
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise((resolve, reject) => {
      const im = new Image();
      im.onload = () => resolve(im);
      im.onerror = () => reject(new Error('图片无法读取'));
      im.src = url;
    });
    const S = 1024;
    const cv = document.createElement('canvas');
    cv.width = cv.height = S;
    const g = cv.getContext('2d');
    const side = Math.min(img.naturalWidth, img.naturalHeight);
    g.drawImage(
      img,
      (img.naturalWidth - side) / 2,
      (img.naturalHeight - side) / 2,
      side,
      side,
      0,
      0,
      S,
      S,
    );
    const vg = g.createRadialGradient(S / 2, S / 2, S * 0.35, S / 2, S / 2, S * 0.75);
    vg.addColorStop(0, 'rgba(0,0,0,0)');
    vg.addColorStop(1, 'rgba(20,5,0,0.55)');
    g.fillStyle = vg;
    g.fillRect(0, 0, S, S);
    g.strokeStyle = 'rgba(255, 214, 140, 0.9)';
    g.lineWidth = 4;
    g.strokeRect(26, 26, S - 52, S - 52);
    const tex = new THREE.CanvasTexture(cv);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());
    return tex;
  } finally {
    URL.revokeObjectURL(url);
  }
}
