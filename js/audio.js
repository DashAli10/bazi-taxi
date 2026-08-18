/* صداهای بازی با WebAudio — بدون فایل صوتی خارجی */
(function (global) {
  'use strict';

  const Sound = {
    enabled: true,
    ctx: null,
    ready: false,

    init() {
      if (this.ctx) return;
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      this.ctx = new AC();
      this.master = this.ctx.createGain();
      this.master.gain.value = 0.5;
      this.master.connect(this.ctx.destination);

      // موتور
      this.engGain = this.ctx.createGain();
      this.engGain.gain.value = 0;
      this.engFilter = this.ctx.createBiquadFilter();
      this.engFilter.type = 'lowpass';
      this.engFilter.frequency.value = 700;
      this.osc = this.ctx.createOscillator();
      this.osc.type = 'sawtooth';
      this.osc.frequency.value = 60;
      this.osc2 = this.ctx.createOscillator();
      this.osc2.type = 'square';
      this.osc2.frequency.value = 30;
      this.osc.connect(this.engFilter);
      this.osc2.connect(this.engFilter);
      this.engFilter.connect(this.engGain);
      this.engGain.connect(this.master);
      this.osc.start(); this.osc2.start();
      this.ready = true;
    },

    resume() {
      if (!this.ctx) this.init();
      if (this.ctx && this.ctx.state === 'suspended') this.ctx.resume();
    },

    setEnabled(v) {
      this.enabled = v;
      if (this.master) this.master.gain.value = v ? 0.5 : 0;
    },

    engine(speedRatio, throttle) {
      if (!this.ready || !this.enabled) return;
      const f = 55 + speedRatio * 165;
      this.osc.frequency.setTargetAtTime(f, this.ctx.currentTime, 0.08);
      this.osc2.frequency.setTargetAtTime(f / 2, this.ctx.currentTime, 0.08);
      this.engFilter.frequency.setTargetAtTime(420 + speedRatio * 1400, this.ctx.currentTime, 0.1);
      const g = 0.028 + speedRatio * 0.05 + (throttle > 0 ? 0.02 : 0);
      this.engGain.gain.setTargetAtTime(g, this.ctx.currentTime, 0.1);
    },

    blip(freq, dur, type, vol, slideTo) {
      if (!this.ready || !this.enabled) return;
      const t = this.ctx.currentTime;
      const o = this.ctx.createOscillator();
      const g = this.ctx.createGain();
      o.type = type || 'square';
      o.frequency.setValueAtTime(freq, t);
      if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, t + dur);
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(vol || 0.18, t + 0.015);
      g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      o.connect(g); g.connect(this.master);
      o.start(t); o.stop(t + dur + 0.05);
    },

    noise(dur, vol, freq) {
      if (!this.ready || !this.enabled) return;
      const t = this.ctx.currentTime;
      const len = Math.floor(this.ctx.sampleRate * dur);
      const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
      const d = buf.getChannelData(0);
      for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
      const src = this.ctx.createBufferSource();
      src.buffer = buf;
      const f = this.ctx.createBiquadFilter();
      f.type = 'lowpass'; f.frequency.value = freq || 1200;
      const g = this.ctx.createGain();
      g.gain.value = vol || 0.3;
      src.connect(f); f.connect(g); g.connect(this.master);
      src.start(t);
    },

    honk() { this.blip(392, 0.28, 'square', 0.16); this.blip(330, 0.3, 'square', 0.12); },
    coin() { this.blip(880, 0.09, 'triangle', 0.2); setTimeout(() => this.blip(1320, 0.14, 'triangle', 0.18), 90); },
    crash() { this.noise(0.35, 0.35, 900); this.blip(90, 0.25, 'sawtooth', 0.15, 50); },
    pickup() { this.blip(520, 0.1, 'sine', 0.18); setTimeout(() => this.blip(780, 0.12, 'sine', 0.16), 90); },
    fail() { this.blip(300, 0.2, 'sawtooth', 0.16, 140); },
    siren() { this.blip(760, 0.22, 'sine', 0.12, 520); },
    fuelTick() { this.blip(620, 0.05, 'sine', 0.07); },
    music() { [523, 659, 784, 659].forEach((f, i) => setTimeout(() => this.blip(f, 0.16, 'triangle', 0.12), i * 130)); }
  };

  global.Sound = Sound;
})(window);
