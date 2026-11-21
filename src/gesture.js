// 手势识别：MediaPipe Hands（Tasks Vision HandLandmarker）
// 输出“稳定手势”事件，带时间去抖、滞回阈值和冷却时间，避免频繁误触发。
import { CONFIG } from './config.js';

const G = CONFIG.gesture;

export const GESTURE_LABELS = {
  none: '未识别手势',
  open: '张开手掌 · 爆散',
  fist: '握拳 · 聚合',
  pinch: '捏合 · 卡片',
  two: '双手 · 缩放',
  neutral: '手势待定',
};

const CONNECTIONS = [
  [0, 1], [1, 2], [2, 3], [3, 4],
  [0, 5], [5, 6], [6, 7], [7, 8],
  [5, 9], [9, 10], [10, 11], [11, 12],
  [9, 13], [13, 14], [14, 15], [15, 16],
  [13, 17], [17, 18], [18, 19], [19, 20], [0, 17],
];

const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y, (a.z || 0) - (b.z || 0));

export class GestureController {
  /**
   * @param {object} opts
   * @param {HTMLVideoElement} opts.video
   * @param {HTMLCanvasElement} opts.overlay
   * @param {boolean} opts.isMobile
   * @param {(name:string, payload?:any)=>void} opts.onEvent
   */
  constructor({ video, overlay, isMobile, onEvent }) {
    this.video = video;
    this.overlay = overlay;
    this.ctx = overlay.getContext('2d');
    this.onEvent = onEvent;
    this.interval = isMobile ? G.detectIntervalMobile : G.detectIntervalDesktop;
    this.running = false;
    this.landmarker = null;
    this.stream = null;
    this.lastDetect = 0;
    this.lastVideoTime = -1;

    // 状态
    this.raw = 'none';
    this.rawSince = 0;
    this.stable = 'none';
    this.lastSeen = 0;
    this.pinchLatched = false;
    this.lastTrigger = { open: 0, fist: 0, pinch: 0, twoIn: 0, twoOut: 0 };
    this.palm = null; // 平滑后的手掌中心（屏幕坐标，已镜像）
    this.palmVel = { x: 0, y: 0 };
    this.twoFrames = 0;
    this.twoSpread = 1;
    this.hands = 0;
  }

  async start() {
    if (!window.isSecureContext) {
      throw new Error('摄像头需要 HTTPS 或 localhost 环境');
    }
    if (!navigator.mediaDevices?.getUserMedia) {
      throw new Error('当前浏览器不支持摄像头访问');
    }

    this.onEvent('status', '正在请求摄像头权限…');
    this.stream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: 'user', width: { ideal: 640 }, height: { ideal: 480 }, frameRate: { ideal: 30 } },
      audio: false,
    });
    this.video.srcObject = this.stream;
    this.video.muted = true;
    this.video.playsInline = true;
    await this.video.play();

    this.onEvent('status', '正在加载手势识别模型…');
    const vision = await import('@mediapipe/tasks-vision');
    const fileset = await vision.FilesetResolver.forVisionTasks(G.wasmBase);
    const make = (delegate) =>
      vision.HandLandmarker.createFromOptions(fileset, {
        baseOptions: { modelAssetPath: G.modelUrl, delegate },
        runningMode: 'VIDEO',
        numHands: 2,
        minHandDetectionConfidence: 0.6,
        minHandPresenceConfidence: 0.6,
        minTrackingConfidence: 0.55,
      });
    try {
      this.landmarker = await make('GPU');
    } catch (err) {
      console.warn('GPU delegate unavailable, falling back to CPU', err);
      this.landmarker = await make('CPU');
    }

    this.overlay.width = this.video.videoWidth || 640;
    this.overlay.height = this.video.videoHeight || 480;
    this.running = true;
    this.onEvent('ready');
  }

  stop() {
    this.running = false;
    if (this.stream) this.stream.getTracks().forEach((t) => t.stop());
    this.stream = null;
    this.video.srcObject = null;
    if (this.landmarker) this.landmarker.close();
    this.landmarker = null;
    this.ctx.clearRect(0, 0, this.overlay.width, this.overlay.height);
    this.#setStable('none', performance.now());
  }

  // 在主渲染循环中调用
  update(now) {
    if (!this.running || !this.landmarker) return;
    if (now - this.lastDetect < this.interval) return;
    if (this.video.readyState < 2 || this.video.currentTime === this.lastVideoTime) return;
    this.lastDetect = now;
    this.lastVideoTime = this.video.currentTime;

    let res;
    try {
      res = this.landmarker.detectForVideo(this.video, now);
    } catch (err) {
      console.warn(err);
      return;
    }
    this.#process(res, now);
  }

  #process(res, now) {
    const lms = res.landmarks || [];
    const world = res.worldLandmarks || [];
    this.hands = lms.length;
    this.#draw(lms);

    if (lms.length === 0) {
      if (now - this.lastSeen > G.lostMs) {
        this.twoFrames = 0;
        this.palm = null;
        this.#feedRaw('none', now);
      }
      return;
    }
    this.lastSeen = now;

    // ---------- 双手：靠近收缩 / 分开扩散 ----------
    if (lms.length >= 2) {
      this.twoFrames++;
      const c0 = palmCenter(lms[0]);
      const c1 = palmCenter(lms[1]);
      const aspect = (this.video.videoWidth || 4) / (this.video.videoHeight || 3);
      const d = Math.hypot((c0.x - c1.x) * aspect, c0.y - c1.y);
      // 0.25(很近) → 0.55 ；1.2(很开) → 1.7
      const spread = clamp(0.55 + ((d - 0.25) / 0.95) * 1.15, 0.5, 1.75);
      this.twoSpread += (spread - this.twoSpread) * 0.35;
      if (this.twoFrames >= 5) {
        this.#feedRaw('two', now);
        this.onEvent('twoHands', { spread: this.twoSpread, distance: d });
        if (d < 0.3 && now - this.lastTrigger.twoIn > G.cooldownMs * 1.4) {
          this.lastTrigger.twoIn = now;
          this.onEvent('contract');
        } else if (d > 1.05 && now - this.lastTrigger.twoOut > G.cooldownMs * 1.4) {
          this.lastTrigger.twoOut = now;
          this.onEvent('expand');
        }
      }
      return;
    }
    this.twoFrames = 0;

    // ---------- 单手 ----------
    const lm = lms[0];
    const wl = world[0] && world[0].length === 21 ? world[0] : lm;
    const gesture = this.#classify(wl);

    // 手掌位置（镜像，使其与用户视角一致）
    const c = palmCenter(lm);
    const sx = 1 - c.x;
    const sy = c.y;
    if (!this.palm) {
      this.palm = { x: sx, y: sy };
      this.palmVel = { x: 0, y: 0 };
    } else {
      const nx = this.palm.x + (sx - this.palm.x) * 0.45;
      const ny = this.palm.y + (sy - this.palm.y) * 0.45;
      const dt = Math.max(this.interval, 16) / 1000;
      this.palmVel.x += ((nx - this.palm.x) / dt - this.palmVel.x) * 0.4;
      this.palmVel.y += ((ny - this.palm.y) / dt - this.palmVel.y) * 0.4;
      this.palm.x = nx;
      this.palm.y = ny;
    }

    this.#feedRaw(gesture, now);

    if (this.stable === 'open') {
      this.onEvent('palmMove', { x: this.palm.x, y: this.palm.y, vx: this.palmVel.x, vy: this.palmVel.y });
    }
  }

  // 基于 3D 世界坐标判断手势（与手的远近、朝向无关）
  #classify(p) {
    const wrist = p[0];
    const size = dist(wrist, p[9]) || 1e-3;
    let extended = 0;
    let maxTip = 0;
    for (let f = 1; f <= 4; f++) {
      const pip = p[f * 4 + 2];
      const tip = p[f * 4 + 4];
      const dTip = dist(wrist, tip);
      maxTip = Math.max(maxTip, dTip / size);
      if (dTip > dist(wrist, pip) * 1.12 && dTip > size * 1.25) extended++;
    }
    const others =
      (dist(wrist, p[12]) > size * 1.3 ? 1 : 0) +
      (dist(wrist, p[16]) > size * 1.25 ? 1 : 0) +
      (dist(wrist, p[20]) > size * 1.1 ? 1 : 0);
    const pinchRatio = dist(p[4], p[8]) / size;
    const thumbOpen = dist(p[4], p[5]) / size > 0.55;
    const indexOut = dist(wrist, p[8]) / size > 1.05;

    // 捏合使用滞回阈值
    const pinchThr = this.pinchLatched ? G.pinchExit : G.pinchEnter;
    const pinching = pinchRatio < pinchThr && indexOut && others >= 1;
    this.pinchLatched = pinching;
    if (pinching) return 'pinch';
    if (extended >= 4 && thumbOpen && pinchRatio > 0.6) return 'open';
    if (extended === 0 && maxTip < 1.35) return 'fist';
    return 'neutral';
  }

  #feedRaw(g, now) {
    if (g !== this.raw) {
      this.raw = g;
      this.rawSince = now;
      return;
    }
    if (g !== this.stable && now - this.rawSince >= G.stableMs) {
      this.#setStable(g, now);
    }
  }

  #setStable(g, now) {
    const prev = this.stable;
    if (prev === g) return;
    this.stable = g;
    this.onEvent('gesture', g);

    const fire = (key, evt) => {
      if (now - this.lastTrigger[key] > G.cooldownMs) {
        this.lastTrigger[key] = now;
        this.onEvent(evt);
      }
    };
    if (g === 'open') fire('open', 'explode');
    else if (g === 'fist') fire('fist', 'gather');
    else if (g === 'pinch') fire('pinch', 'card');
    if (prev === 'two' && g !== 'two') this.onEvent('twoHandsEnd');
  }

  #draw(hands) {
    const { ctx, overlay } = this;
    ctx.clearRect(0, 0, overlay.width, overlay.height);
    const W = overlay.width;
    const H = overlay.height;
    ctx.lineWidth = 2;
    for (const lm of hands) {
      ctx.strokeStyle = 'rgba(255, 205, 120, 0.85)';
      ctx.beginPath();
      for (const [a, b] of CONNECTIONS) {
        ctx.moveTo(lm[a].x * W, lm[a].y * H);
        ctx.lineTo(lm[b].x * W, lm[b].y * H);
      }
      ctx.stroke();
      ctx.fillStyle = '#fff3d6';
      for (const pt of lm) {
        ctx.beginPath();
        ctx.arc(pt.x * W, pt.y * H, 3, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }
}

function palmCenter(lm) {
  const ids = [0, 5, 9, 13, 17];
  let x = 0, y = 0;
  for (const i of ids) {
    x += lm[i].x;
    y += lm[i].y;
  }
  return { x: x / ids.length, y: y / ids.length };
}

function clamp(v, a, b) {
  return Math.min(b, Math.max(a, v));
}
