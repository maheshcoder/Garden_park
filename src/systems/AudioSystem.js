/* ===================================================================
   AudioSystem - everything is synthesised with WebAudio oscillators
   and noise buffers; there are zero audio files to load, so the app
   can never fail because of a missing asset.

   Rules honoured here:
   - the AudioContext is only created/resumed on a user gesture
   - all calls are safe no-ops before that or if WebAudio is missing
   - mute/unmute is a master-gain ramp (no teardown)
   =================================================================== */
export class AudioSystem {
  constructor() {
    this.ctx = null;
    this.master = null;
    this.muted = false;
    this.started = false;
    this._ambientTimer = 0;
    this._noiseBuf = null;
    this._windGain = null;
    this._rainGain = null;
    this._pourSrc = null;
  }

  /* call from any pointerdown/keydown - idempotent */
  ensure() {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') this.ctx.resume().catch(() => {});
      return;
    }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;                 /* no WebAudio: stay silent, never throw */
    try {
      this.ctx = new AC();
      this.master = this.ctx.createGain();
      this.master.gain.value = this.muted ? 0 : 0.8;
      this.master.connect(this.ctx.destination);
      this._noiseBuf = this._makeNoise();
      this._startAmbience();
      this.started = true;
    } catch (e) {
      this.ctx = null;
    }
  }

  _makeNoise() {
    const len = this.ctx.sampleRate * 2;
    const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    return buf;
  }

  /* looping wind + rain beds; gains are modulated by the garden state */
  _startAmbience() {
    const c = this.ctx;
    const mk = (freq, gain, type) => {
      const src = c.createBufferSource();
      src.buffer = this._noiseBuf;
      src.loop = true;
      const f = c.createBiquadFilter();
      f.type = type; f.frequency.value = freq; f.Q.value = 0.6;
      const g = c.createGain();
      g.gain.value = gain;
      src.connect(f); f.connect(g); g.connect(this.master);
      src.start();
      return g;
    };
    this._windGain = mk(380, 0.018, 'lowpass');   /* soft breeze bed  */
    this._rainGain = mk(2400, 0, 'highpass');      /* silent until rain */
  }

  setMuted(m) {
    this.muted = m;
    if (this.master) {
      const t = this.ctx.currentTime;
      this.master.gain.cancelScheduledValues(t);
      this.master.gain.linearRampToValueAtTime(m ? 0 : 0.8, t + 0.15);
    }
  }

  /* per-frame: wind follows gusts, rain bed follows blend 0..1 */
  update(dt, { wind = 0.4, rain = 0 } = {}) {
    if (!this.ctx || this.muted) return;
    if (this._windGain) {
      this._windGain.gain.value = 0.012 + wind * 0.03;
    }
    if (this._rainGain) {
      const target = rain * 0.11;
      const g = this._rainGain.gain;
      g.value += (target - g.value) * Math.min(1, dt * 2);
    }
  }

  /* ------------------------------------------------------- one-shots */
  _tone(freq, dur, type = 'sine', vol = 0.15, bend = 1) {
    if (!this.ctx || this.muted) return;
    const c = this.ctx, t = c.currentTime;
    const o = c.createOscillator();
    const g = c.createGain();
    o.type = type;
    o.frequency.setValueAtTime(freq, t);
    if (bend !== 1) o.frequency.exponentialRampToValueAtTime(Math.max(30, freq * bend), t + dur);
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(vol, t + 0.012);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    o.connect(g); g.connect(this.master);
    o.start(t); o.stop(t + dur + 0.02);
  }

  _noise(dur, filterFreq, vol = 0.2, type = 'bandpass') {
    if (!this.ctx || this.muted) return;
    const c = this.ctx, t = c.currentTime;
    const src = c.createBufferSource();
    src.buffer = this._noiseBuf;
    src.loop = true;
    const f = c.createBiquadFilter();
    f.type = type; f.frequency.value = filterFreq; f.Q.value = 1.1;
    const g = c.createGain();
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(vol, t + 0.03);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    src.connect(f); f.connect(g); g.connect(this.master);
    src.start(t); src.stop(t + dur + 0.02);
  }

  chirp() {  /* bird: quick upward blip */
    this._tone(1800 + Math.random() * 900, 0.09, 'sine', 0.06, 1.8);
    setTimeout(() => this._tone(2300 + Math.random() * 700, 0.07, 'sine', 0.05, 1.4), 90);
  }

  water() {  /* pour: filtered noise splash */
    this._noise(0.55, 1600, 0.16);
    this._tone(520, 0.28, 'sine', 0.03, 0.6);
  }

  refill() { this._noise(0.7, 900, 0.14, 'lowpass'); }

  feed() {   /* seeds hitting the tray */
    this._noise(0.16, 3000, 0.12);
    setTimeout(() => this._noise(0.12, 2600, 0.09), 70);
  }

  munch() { this._noise(0.1, 800, 0.1, 'lowpass'); }

  pick() { this._tone(700, 0.12, 'triangle', 0.1, 1.7); }

  plant() {
    this._tone(320, 0.16, 'sine', 0.12, 1.9);
    setTimeout(() => this._tone(520, 0.1, 'sine', 0.07, 1.5), 60);
  }

  pop() { this._tone(240, 0.08, 'square', 0.05, 2.2); }  /* UI click */

  splash() { this._noise(0.4, 700, 0.18, 'lowpass'); }
}
