import * as THREE from 'three';

// Pointer / touch / wheel input → eased camera orbit, zoom and scene events.
export class Interaction {
  constructor(el, { onTap, onMove, onRelease, onDrawStart, onDrawMove, onDrawEnd }) {
    this.onDrawStart = onDrawStart;
    this.onDrawMove = onDrawMove;
    this.onDrawEnd = onDrawEnd;
    this.drawMode = false;
    this.drawing = false;
    this.el = el;
    this.onTap = onTap;
    this.onMove = onMove;
    this.onRelease = onRelease;
    this.ndc = new THREE.Vector2(0, 0);
    this.smoothNdc = new THREE.Vector2(0, 0);
    this.hover = false;
    this.active = 0; // eased 0..1 "pointer present" factor
    this.yaw = 0; this.pitch = 0; // user orbit (target)
    this.yawV = 0; this.pitchV = 0;
    this.zoom = 1; this.zoomT = 1;
    this.pointers = new Map();
    this.dragging = false;
    this.downAt = null;
    this.pinchD = 0;
    this.lastMove = 0;
    this.speed = 0;

    this._down = this.down.bind(this);
    this._move = this.move.bind(this);
    this._up = this.up.bind(this);
    this._wheel = this.wheel.bind(this);
    this._leave = () => { if (!this.pointers.size) { this.hover = false; this.onRelease?.(); } };
    el.addEventListener('pointerdown', this._down);
    window.addEventListener('pointermove', this._move, { passive: true });
    window.addEventListener('pointerup', this._up);
    window.addEventListener('pointercancel', this._up);
    el.addEventListener('pointerleave', this._leave);
    el.addEventListener('wheel', this._wheel, { passive: false });
    el.addEventListener('contextmenu', (e) => e.preventDefault());
  }

  toNdc(e) {
    const r = this.el.getBoundingClientRect();
    return new THREE.Vector2(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
  }

  down(e) {
    this.el.setPointerCapture?.(e.pointerId);
    this.pointers.set(e.pointerId, { x: e.clientX, y: e.clientY, sx: e.clientX, sy: e.clientY, t: performance.now() });
    if (this.drawMode && this.pointers.size === 1 && e.button !== 2) {
      this.drawing = true;
      this.ndc.copy(this.toNdc(e));
      this.onDrawStart?.(this.ndc.clone());
      return;
    }
    if (this.drawing && this.pointers.size === 2) { this.drawing = false; this.onDrawEnd?.(); }
    if (this.pointers.size === 2) {
      const [a, b] = [...this.pointers.values()];
      this.pinchD = Math.hypot(a.x - b.x, a.y - b.y);
      this.dragging = true; // pinch is never a tap
    } else {
      this.dragging = false;
      this.downAt = { x: e.clientX, y: e.clientY, t: performance.now() };
    }
    this.ndc.copy(this.toNdc(e));
    this.hover = true;
  }

  move(e) {
    const inside = e.target === this.el || this.pointers.has(e.pointerId);
    if (!inside) return;
    const n = this.toNdc(e);
    const now = performance.now();
    const dtm = Math.max(1, now - this.lastMove);
    this.speed = Math.min(3, n.distanceTo(this.ndc) / dtm * 1000 * 0.2);
    this.lastMove = now;
    this.ndc.copy(n);
    this.hover = true;
    const p = this.pointers.get(e.pointerId);
    if (this.drawing && p) {
      p.x = e.clientX; p.y = e.clientY;
      this.onDrawMove?.(n.clone());
      this.onMove?.(this.ndc, e.pointerType, true);
      return;
    }
    if (p) {
      const dx = e.clientX - p.x, dy = e.clientY - p.y;
      p.x = e.clientX; p.y = e.clientY;
      if (this.pointers.size === 2) {
        const [a, b] = [...this.pointers.values()];
        const d = Math.hypot(a.x - b.x, a.y - b.y);
        if (this.pinchD > 0) this.zoomT = THREE.MathUtils.clamp(this.zoomT * (this.pinchD / d), 0.35, 2.6);
        this.pinchD = d;
      } else {
        if (Math.hypot(e.clientX - p.sx, e.clientY - p.sy) > 7) this.dragging = true;
        if (this.dragging) {
          const k = 4.2 / Math.max(innerWidth, innerHeight);
          this.yawV = -dx * k * 60;
          this.pitchV = -dy * k * 60;
          this.yaw += -dx * k;
          this.pitch = THREE.MathUtils.clamp(this.pitch - dy * k, -1.1, 1.1);
        }
      }
    }
    this.onMove?.(this.ndc, e.pointerType, this.pointers.size > 0);
  }

  up(e) {
    if (!this.pointers.has(e.pointerId)) return;
    const p = this.pointers.get(e.pointerId);
    this.pointers.delete(e.pointerId);
    if (this.drawing) {
      this.drawing = false;
      this.onDrawEnd?.();
      if (e.pointerType !== 'mouse') { this.hover = false; this.onRelease?.(); }
      return;
    }
    const quick = performance.now() - p.t < 450;
    if (!this.dragging && quick && this.pointers.size === 0) this.onTap?.(this.toNdc(e), e.pointerType);
    if (this.pointers.size === 0) {
      this.dragging = false;
      if (e.pointerType !== 'mouse') { this.hover = false; this.onRelease?.(); }
    }
    if (this.pointers.size < 2) this.pinchD = 0;
  }

  wheel(e) {
    e.preventDefault();
    const d = e.deltaMode === 1 ? e.deltaY * 30 : e.deltaY;
    this.zoomT = THREE.MathUtils.clamp(this.zoomT * Math.exp(d * 0.0012), 0.35, 2.6);
  }

  update(dt) {
    // inertia after drag
    if (!this.dragging) {
      this.yaw += this.yawV * dt * 0.016;
      this.pitch = THREE.MathUtils.clamp(this.pitch + this.pitchV * dt * 0.016, -1.1, 1.1);
      const damp = Math.exp(-dt * 3.5);
      this.yawV *= damp; this.pitchV *= damp;
    }
    const k = 1 - Math.exp(-dt * 5);
    this.zoom += (this.zoomT - this.zoom) * k;
    this.smoothNdc.lerp(this.ndc, 1 - Math.exp(-dt * 6));
    this.active += ((this.hover ? 1 : 0) - this.active) * (1 - Math.exp(-dt * 4));
    this.speed *= Math.exp(-dt * 3);
  }

  resetView() { this.yaw = 0; this.pitch = 0; this.yawV = 0; this.pitchV = 0; this.zoomT = 1; }

  dispose() {
    this.el.removeEventListener('pointerdown', this._down);
    window.removeEventListener('pointermove', this._move);
    window.removeEventListener('pointerup', this._up);
    window.removeEventListener('pointercancel', this._up);
    this.el.removeEventListener('pointerleave', this._leave);
    this.el.removeEventListener('wheel', this._wheel);
  }
}
