// PNG screenshots and WebM recording (MediaRecorder).

function stamp() {
  const d = new Date();
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}${p(d.getSeconds())}`;
}

export function download(blob, name) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
}

export class Capture {
  constructor(canvas) {
    this.canvas = canvas;
    this.pendingShot = null;
    this.recorder = null;
    this.chunks = [];
    this.recStart = 0;
  }

  // Must be called right after rendering (drawing buffer is not preserved).
  requestScreenshot() {
    return new Promise((resolve, reject) => { this.pendingShot = { resolve, reject }; });
  }

  requestThumb(w = 240, h = 135) {
    return new Promise((resolve) => { this.pendingThumb = { resolve, w, h }; });
  }

  afterRender() {
    if (this.pendingThumb) {
      const { resolve, w, h } = this.pendingThumb;
      this.pendingThumb = null;
      try {
        const c = document.createElement('canvas');
        c.width = w; c.height = h;
        const ctx = c.getContext('2d');
        const sw = this.canvas.width, sh = this.canvas.height;
        const scale = Math.max(w / sw, h / sh);
        const dw = sw * scale, dh = sh * scale;
        ctx.drawImage(this.canvas, (w - dw) / 2, (h - dh) / 2, dw, dh);
        resolve(c.toDataURL('image/jpeg', 0.72));
      } catch (e) { resolve(null); }
    }
    if (!this.pendingShot) return;
    const { resolve, reject } = this.pendingShot;
    this.pendingShot = null;
    try {
      this.canvas.toBlob((blob) => {
        if (!blob) return reject(new Error('截图失败'));
        const name = `nebula-${stamp()}.png`;
        download(blob, name);
        resolve(name);
      }, 'image/png');
    } catch (e) { reject(e); }
  }

  static supported() {
    return typeof MediaRecorder !== 'undefined' && !!HTMLCanvasElement.prototype.captureStream;
  }

  pickMime() {
    const types = ['video/webm;codecs=vp9,opus', 'video/webm;codecs=vp8,opus', 'video/webm;codecs=vp9', 'video/webm', 'video/mp4;codecs=avc1', 'video/mp4'];
    return types.find((t) => MediaRecorder.isTypeSupported?.(t)) || '';
  }

  start(audioStream) {
    if (!Capture.supported()) throw new Error('当前浏览器不支持 MediaRecorder 录制');
    const stream = this.canvas.captureStream(60);
    if (audioStream) audioStream.getAudioTracks().forEach((t) => stream.addTrack(t));
    const mimeType = this.pickMime();
    this.mime = mimeType || 'video/webm';
    this.recorder = new MediaRecorder(stream, { mimeType: mimeType || undefined, videoBitsPerSecond: 16_000_000 });
    this.chunks = [];
    this.recorder.ondataavailable = (e) => { if (e.data && e.data.size) this.chunks.push(e.data); };
    this.recorder.start(250);
    this.recStart = performance.now();
  }

  stop() {
    return new Promise((resolve) => {
      if (!this.recorder) return resolve(null);
      this.recorder.onstop = () => {
        const ext = this.mime.includes('mp4') ? 'mp4' : 'webm';
        const blob = new Blob(this.chunks, { type: this.mime.split(';')[0] });
        const name = `nebula-${stamp()}.${ext}`;
        download(blob, name);
        this.recorder.stream.getTracks().forEach((t) => { if (t.kind === 'video') t.stop(); });
        this.recorder = null;
        resolve(name);
      };
      this.recorder.stop();
    });
  }

  get recording() { return !!this.recorder; }
  get elapsed() { return this.recorder ? (performance.now() - this.recStart) / 1000 : 0; }
}
