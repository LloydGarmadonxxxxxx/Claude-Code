// Device tiering and adaptive quality.

export function detectTier() {
  const coarse = matchMedia('(pointer: coarse)').matches;
  const small = Math.min(screen.width, screen.height) < 820;
  const mem = navigator.deviceMemory || 8;
  const cores = navigator.hardwareConcurrency || 8;
  const mobile = coarse && (small || /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent));
  let tier = 'high';
  if (mobile) tier = mem <= 3 || cores <= 4 ? 'low' : 'mid';
  else if (mem <= 4 || cores <= 4) tier = 'mid';
  return { tier, mobile };
}

export const TIER_SETTINGS = {
  high: { maxParticles: 200000, defaultParticles: 90000, dpr: 2.0, bloomScale: 1.0, raySamples: 56 },
  mid: { maxParticles: 120000, defaultParticles: 45000, dpr: 1.5, bloomScale: 0.75, raySamples: 40 },
  low: { maxParticles: 60000, defaultParticles: 22000, dpr: 1.25, bloomScale: 0.5, raySamples: 28 },
};

// Watches frame time; lowers pixel ratio first, then particle count, when the
// device can't hold a smooth frame rate. Recovers slowly when there's headroom.
export class AdaptiveQuality {
  constructor({ baseDpr, onChange }) {
    this.baseDpr = baseDpr;
    this.dprScale = 1;
    this.particleScale = 1;
    this.onChange = onChange;
    this.acc = 0;
    this.frames = 0;
    this.cooldown = 2.5;
    this.enabled = true;
    this.state = 'stable';
  }
  update(dt) {
    if (!this.enabled) return;
    this.cooldown -= dt;
    this.acc += dt;
    this.frames++;
    if (this.acc < 1.5) return;
    const fps = this.frames / this.acc;
    this.acc = 0;
    this.frames = 0;
    if (this.cooldown > 0 || document.hidden) return;
    if (fps < 42) {
      if (this.dprScale > 0.55) this.dprScale = Math.max(0.55, this.dprScale - 0.15);
      else if (this.particleScale > 0.35) this.particleScale = Math.max(0.35, this.particleScale - 0.15);
      else return;
      this.state = 'degraded';
      this.cooldown = 2.5;
      this.onChange();
    } else if (fps > 57 && (this.dprScale < 1 || this.particleScale < 1)) {
      if (this.particleScale < 1) this.particleScale = Math.min(1, this.particleScale + 0.1);
      else this.dprScale = Math.min(1, this.dprScale + 0.1);
      this.state = this.dprScale >= 1 && this.particleScale >= 1 ? 'stable' : 'degraded';
      this.cooldown = 4;
      this.onChange();
    }
  }
  get dpr() {
    return Math.max(0.6, Math.min(window.devicePixelRatio || 1, this.baseDpr) * this.dprScale);
  }
}
