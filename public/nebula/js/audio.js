// Web Audio: file playback, microphone input and a built-in generative demo
// track. Produces smoothed low / mid / high band energies and beat onsets.

export class AudioEngine {
  constructor() {
    this.ctx = null;
    this.analyser = null;
    this.source = 'none'; // none | file | mic | demo
    this.bands = { bass: 0, mid: 0, treble: 0, level: 0 };
    this.beat = 0;
    this.onBeat = null;
    this._avgBass = 0;
    this._beatCooldown = 0;
    this.sensitivity = 1;
    this.el = null;
    this.mediaNode = null;
    this.micStream = null;
    this.micNode = null;
    this.demo = null;
    this.recordDest = null;
    this.fileName = '';
  }

  ensure() {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') this.ctx.resume();
      return this.ctx;
    }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) throw new Error('当前浏览器不支持 Web Audio API');
    this.ctx = new AC();
    this.analyser = this.ctx.createAnalyser();
    this.analyser.fftSize = 2048;
    this.analyser.smoothingTimeConstant = 0.72;
    this.freq = new Uint8Array(this.analyser.frequencyBinCount);
    this.out = this.ctx.createGain();
    this.out.connect(this.ctx.destination);
    this.recordDest = this.ctx.createMediaStreamDestination();
    this.out.connect(this.recordDest);
    return this.ctx;
  }

  stop() {
    if (this.el) { this.el.pause(); }
    if (this.mediaNode) { try { this.mediaNode.disconnect(); } catch (e) { /* noop */ } }
    if (this.micNode) { try { this.micNode.disconnect(); } catch (e) { /* noop */ } this.micNode = null; }
    if (this.micStream) { this.micStream.getTracks().forEach((t) => t.stop()); this.micStream = null; }
    if (this.demo) { this.demo.stop(); this.demo = null; }
    this.source = 'none';
  }

  async playFile(file) {
    this.ensure();
    this.stop();
    if (!this.el) {
      this.el = new Audio();
      this.el.crossOrigin = 'anonymous';
      this.el.loop = true;
      this.mediaNode = this.ctx.createMediaElementSource(this.el);
    }
    if (this._url) URL.revokeObjectURL(this._url);
    this._url = URL.createObjectURL(file);
    this.el.src = this._url;
    this.mediaNode.connect(this.analyser);
    this.mediaNode.connect(this.out);
    this.fileName = file.name;
    await this.el.play();
    this.source = 'file';
  }

  togglePlayback() {
    if (this.source !== 'file' || !this.el) return false;
    if (this.el.paused) this.el.play(); else this.el.pause();
    return !this.el.paused;
  }

  async useMic() {
    this.ensure();
    if (!navigator.mediaDevices?.getUserMedia) throw new Error('当前浏览器不支持麦克风输入（需要 HTTPS）');
    const stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: true } });
    this.stop();
    this.micStream = stream;
    this.micNode = this.ctx.createMediaStreamSource(stream);
    this.micNode.connect(this.analyser); // not to output — avoids feedback
    this.source = 'mic';
  }

  playDemo() {
    this.ensure();
    this.stop();
    this.demo = new DemoTrack(this.ctx, this.analyser, this.out);
    this.demo.start();
    this.source = 'demo';
  }

  update(dt) {
    const b = this.bands;
    if (!this.analyser || this.source === 'none' || (this.source === 'file' && this.el?.paused)) {
      const k = 1 - Math.exp(-dt * 4);
      b.bass += (0 - b.bass) * k; b.mid += (0 - b.mid) * k; b.treble += (0 - b.treble) * k; b.level += (0 - b.level) * k;
      return b;
    }
    this.analyser.getByteFrequencyData(this.freq);
    const hz = this.ctx.sampleRate / this.analyser.fftSize;
    const band = (lo, hi) => {
      const a = Math.max(1, Math.floor(lo / hz)), z = Math.min(this.freq.length - 1, Math.ceil(hi / hz));
      let s = 0;
      for (let i = a; i <= z; i++) s += this.freq[i];
      return s / ((z - a + 1) * 255);
    };
    const s = this.sensitivity;
    const raw = { bass: band(25, 160), mid: band(160, 2200), treble: band(2200, 11000) };
    const shape = (v, g) => Math.min(1.5, Math.pow(Math.max(0, v * g * s), 1.4) * 1.6);
    for (const key of ['bass', 'mid', 'treble']) {
      const v = shape(raw[key], key === 'treble' ? 2.4 : key === 'mid' ? 1.5 : 1.15);
      const k = 1 - Math.exp(-dt * (v > b[key] ? 22 : 6)); // fast attack, slower release
      b[key] += (v - b[key]) * k;
    }
    b.level = (b.bass + b.mid + b.treble) / 3;
    // Beat detection on bass flux
    this._avgBass += (raw.bass - this._avgBass) * (1 - Math.exp(-dt * 1.5));
    this._beatCooldown -= dt;
    if (raw.bass > this._avgBass * 1.32 + 0.04 && raw.bass > 0.25 && this._beatCooldown <= 0) {
      this._beatCooldown = 0.28;
      this.beat = 1;
      this.onBeat && this.onBeat(raw.bass);
    }
    this.beat = Math.max(0, this.beat - dt * 4);
    return b;
  }

  get stream() { return this.recordDest ? this.recordDest.stream : null; }

  dispose() {
    this.stop();
    if (this._url) URL.revokeObjectURL(this._url);
    if (this.ctx) this.ctx.close();
  }
}

// Small generative ambient-electronic loop (120 BPM) so audio reactivity can be
// tried without any file. Everything is synthesised with oscillators + noise.
class DemoTrack {
  constructor(ctx, analyser, out) {
    this.ctx = ctx;
    this.bus = ctx.createGain();
    this.bus.gain.value = 0.55;
    this.bus.connect(analyser);
    this.bus.connect(out);
    this.timer = null;
    this.next = 0;
    this.step = 0;
    this.nodes = [];
    const len = ctx.sampleRate * 0.5;
    this.noise = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = this.noise.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    // Reverb-ish delay for pads
    this.delay = ctx.createDelay(1);
    this.delay.delayTime.value = 0.375;
    this.fb = ctx.createGain();
    this.fb.gain.value = 0.35;
    this.delay.connect(this.fb); this.fb.connect(this.delay); this.delay.connect(this.bus);
  }
  start() {
    this.next = this.ctx.currentTime + 0.05;
    this.timer = setInterval(() => this.schedule(), 25);
  }
  stop() {
    clearInterval(this.timer);
    const t = this.ctx.currentTime;
    this.bus.gain.setTargetAtTime(0, t, 0.05);
    setTimeout(() => { try { this.bus.disconnect(); this.delay.disconnect(); } catch (e) { /* noop */ } }, 400);
  }
  schedule() {
    const ctx = this.ctx;
    const spb = 60 / 120 / 4; // sixteenth
    // If the tab was throttled, skip the backlog instead of firing it all at once.
    if (this.next < ctx.currentTime) this.next = ctx.currentTime + 0.02;
    while (this.next < ctx.currentTime + 0.12) {
      const s = this.step % 64;
      const t = this.next;
      if (s % 4 === 0) this.kick(t);
      if (s % 8 === 4) this.snare(t);
      if (s % 2 === 1) this.hat(t, s % 4 === 3 ? 0.07 : 0.035);
      if (s % 16 === 0) this.pad(t, [[220, 277.18, 329.63], [196, 246.94, 293.66], [174.61, 220, 261.63], [196, 246.94, 329.63]][(s / 16) % 4]);
      if (s % 4 === 2) this.pluck(t, [880, 659.25, 739.99, 987.77, 1108.73, 739.99][(this.step / 4 | 0) % 6]);
      this.next += spb;
      this.step++;
    }
  }
  env(g, t, a, peak, d) {
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(peak, t + a);
    g.gain.exponentialRampToValueAtTime(0.0001, t + a + d);
  }
  kick(t) {
    const o = this.ctx.createOscillator(), g = this.ctx.createGain();
    o.frequency.setValueAtTime(140, t);
    o.frequency.exponentialRampToValueAtTime(42, t + 0.18);
    this.env(g, t, 0.004, 0.9, 0.38);
    o.connect(g).connect(this.bus); o.start(t); o.stop(t + 0.5);
  }
  snare(t) {
    const n = this.ctx.createBufferSource(); n.buffer = this.noise;
    const f = this.ctx.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = 1800; f.Q.value = 0.8;
    const g = this.ctx.createGain(); this.env(g, t, 0.003, 0.35, 0.2);
    n.connect(f).connect(g).connect(this.bus); n.start(t); n.stop(t + 0.3);
  }
  hat(t, v) {
    const n = this.ctx.createBufferSource(); n.buffer = this.noise;
    const f = this.ctx.createBiquadFilter(); f.type = 'highpass'; f.frequency.value = 7500;
    const g = this.ctx.createGain(); this.env(g, t, 0.002, v, 0.05);
    n.connect(f).connect(g).connect(this.bus); n.start(t); n.stop(t + 0.1);
  }
  pad(t, notes) {
    for (const fr of notes) {
      for (const det of [-6, 6]) {
        const o = this.ctx.createOscillator(); o.type = 'sawtooth'; o.frequency.value = fr; o.detune.value = det;
        const f = this.ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.setValueAtTime(500, t); f.frequency.linearRampToValueAtTime(1400, t + 1.5); f.frequency.linearRampToValueAtTime(600, t + 2);
        const g = this.ctx.createGain();
        g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(0.03, t + 0.4); g.gain.linearRampToValueAtTime(0.0001, t + 2.05);
        o.connect(f).connect(g); g.connect(this.bus); g.connect(this.delay);
        o.start(t); o.stop(t + 2.1);
      }
    }
  }
  pluck(t, fr) {
    const o = this.ctx.createOscillator(); o.type = 'triangle'; o.frequency.value = fr;
    const g = this.ctx.createGain(); this.env(g, t, 0.004, 0.08, 0.35);
    o.connect(g); g.connect(this.bus); g.connect(this.delay); o.start(t); o.stop(t + 0.45);
  }
}
