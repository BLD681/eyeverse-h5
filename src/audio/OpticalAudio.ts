export type AudioScene = 'home' | 'portal' | 'dryeye' | 'refraction' | 'archive' | 'time' | 'core';
export type PortalSoundTheme = 'dry-eye' | 'refraction' | 'vision-archive' | 'time-mirror';
type PulseKind = 'home' | 'route-in' | 'route-out' | 'water' | 'focus' | 'scan' | 'time';
type InteractionKind = 'dryeye' | 'refraction' | 'archive' | 'time';

type ActiveVoice = {
  scene: AudioScene;
  output: GainNode;
  sources: AudioScheduledSourceNode[];
  cleanupTimer?: number;
};

type Tone = {
  from: number;
  to: number;
  level: number;
  wave?: OscillatorType;
  delay?: number;
  duration?: number;
  pan?: number;
};

type Cue = {
  duration: number;
  attack: number;
  release: number;
  filter: number;
  wet: number;
  tones: Tone[];
  noise?: { level: number; frequency: number; delay?: number; duration?: number };
};

export const DEFAULT_BGM_VOLUME = 0.48;
export const DEFAULT_SFX_VOLUME = 0.32;
const BGM_SOURCE = '/assets/audio/eyeverse-theme.mp3';

export function mapVolumeToGain(value: number) {
  const normalized = Math.max(0, Math.min(1, value));
  return normalized * normalized;
}

const homeEntry: Cue = {
  duration: .76, attack: .035, release: .42, filter: 1650, wet: .34,
  tones: [
    { from: 286, to: 342, level: .34 },
    { from: 572, to: 684, level: .11, delay: .04 },
    { from: 108, to: 132, level: .42, delay: .08 },
  ],
  noise: { level: .045, frequency: 720, duration: .62 },
};

const nodeCues: Record<PortalSoundTheme, Cue> = {
  'dry-eye': {
    duration: 1.02, attack: .06, release: .54, filter: 1420, wet: .42,
    tones: [{ from: 164, to: 192, level: .46 }, { from: 328, to: 382, level: .16, delay: .05, pan: -.16 }],
    noise: { level: .075, frequency: 620, duration: .72 },
  },
  refraction: {
    duration: .98, attack: .05, release: .5, filter: 1720, wet: .38,
    tones: [{ from: 224, to: 278, level: .38 }, { from: 249, to: 278, level: .28, pan: .2 }, { from: 448, to: 556, level: .08, delay: .05 }],
  },
  'vision-archive': {
    duration: 1.04, attack: .07, release: .5, filter: 1480, wet: .4,
    tones: [{ from: 112, to: 148, level: .5 }, { from: 336, to: 444, level: .15, delay: .08, pan: -.12 }],
    noise: { level: .04, frequency: 880, delay: .06, duration: .7 },
  },
  'time-mirror': {
    duration: 1.08, attack: .09, release: .58, filter: 1260, wet: .46,
    tones: [{ from: 96, to: 112, level: .54 }, { from: 288, to: 318, level: .12, delay: .09, pan: .14 }],
  },
};

const completionCue: Cue = {
  duration: 1.38, attack: .08, release: .7, filter: 1580, wet: .48,
  tones: [
    { from: 146, to: 164, level: .46 },
    { from: 219, to: 246, level: .22, delay: .12, pan: -.08 },
    { from: 292, to: 328, level: .16, delay: .25, pan: .1 },
    { from: 438, to: 492, level: .07, delay: .32 },
  ],
  noise: { level: .025, frequency: 760, delay: .08, duration: 1.05 },
};

const routeOutCue: Cue = {
  duration: .68, attack: .04, release: .38, filter: 1180, wet: .28,
  tones: [{ from: 216, to: 132, level: .34 }, { from: 108, to: 92, level: .4, delay: .04 }],
};

const scanCompleteCue: Cue = {
  duration: 1.26, attack: .06, release: .65, filter: 1480, wet: .44,
  tones: [
    { from: 132, to: 148, level: .48 },
    { from: 198, to: 222, level: .22, delay: .13 },
    { from: 264, to: 296, level: .13, delay: .26 },
  ],
};

const subtleWater: Cue = {
  duration: .62, attack: .05, release: .34, filter: 1080, wet: .38,
  tones: [{ from: 142, to: 118, level: .34 }, { from: 392, to: 246, level: .08, delay: .03 }],
  noise: { level: .055, frequency: 540, duration: .48 },
};

const subtleFocus: Cue = {
  duration: .58, attack: .04, release: .3, filter: 1420, wet: .3,
  tones: [{ from: 248, to: 306, level: .27, pan: -.12 }, { from: 276, to: 306, level: .23, pan: .12 }],
};

const subtleTime: Cue = {
  duration: .72, attack: .07, release: .4, filter: 980, wet: .38,
  tones: [{ from: 92, to: 102, level: .4 }, { from: 184, to: 204, level: .1, delay: .08 }],
};

class OpticalAudioEngine {
  private context?: AudioContext;
  private master?: GainNode;
  private musicBus?: GainNode;
  private sfxBus?: GainNode;
  private reverbInput?: GainNode;
  private noiseBuffer?: AudioBuffer;
  private music?: HTMLAudioElement;
  private mediaSource?: MediaElementAudioSourceNode;
  private voices = new Set<ActiveVoice>();
  private scanVoice?: ActiveVoice;
  private finaleVoice?: ActiveVoice;
  private desiredScene: AudioScene = 'home';
  private bgmMuted = false;
  private sfxMuted = false;
  private bgmVolume = DEFAULT_BGM_VOLUME;
  private sfxVolume = DEFAULT_SFX_VOLUME;
  private unlocked = false;
  private listeners = new Set<() => void>();
  private lastInteractionCue = 0;
  private lastPreview = 0;

  constructor() {
    try {
      const savedBgmValue = localStorage.getItem('bgmVolume');
      const savedSfxValue = localStorage.getItem('sfxVolume');
      const savedBgm = savedBgmValue === null ? Number.NaN : Number(savedBgmValue);
      const savedSfx = savedSfxValue === null ? Number.NaN : Number(savedSfxValue);
      if (Number.isFinite(savedBgm)) this.bgmVolume = Math.max(0, Math.min(1, savedBgm));
      if (Number.isFinite(savedSfx)) this.sfxVolume = Math.max(0, Math.min(1, savedSfx));
      this.bgmMuted = localStorage.getItem('bgmMuted') === 'true';
      this.sfxMuted = localStorage.getItem('sfxMuted') === 'true';
    } catch {}
    document.addEventListener('visibilitychange', this.handleVisibility);
    window.addEventListener('pageshow', this.handlePageShow);
  }

  // Compatibility snapshots used by the existing Page3 video element.
  isMuted = () => this.bgmMuted;
  getVolume = () => this.bgmVolume;
  isBgmMuted = () => this.bgmMuted;
  isSfxMuted = () => this.sfxMuted;
  getBgmVolume = () => this.bgmVolume;
  getSfxVolume = () => this.sfxVolume;
  subscribe = (listener: () => void) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };

  async unlock() {
    if (!this.context) this.createGraph();
    if (this.context?.state !== 'running') {
      try { await this.context?.resume(); } catch {}
    }
    this.unlocked = this.context?.state === 'running';
    if (!this.unlocked) return;
    this.setMasterLevel(.12);
    this.applyBusLevels(.08);
    if (!this.bgmMuted) await this.startMusic();
  }

  setBgmVolume(value: number) {
    this.bgmVolume = Math.max(0, Math.min(1, value));
    try { localStorage.setItem('bgmVolume', String(this.bgmVolume)); } catch {}
    this.applyBusLevels(.045);
    this.emit();
  }

  setSfxVolume(value: number) {
    this.sfxVolume = Math.max(0, Math.min(1, value));
    try { localStorage.setItem('sfxVolume', String(this.sfxVolume)); } catch {}
    this.applyBusLevels(.035);
    this.emit();
  }

  async toggleBgmMuted() {
    this.bgmMuted = !this.bgmMuted;
    try { localStorage.setItem('bgmMuted', String(this.bgmMuted)); } catch {}
    if (!this.bgmMuted) await this.unlock();
    this.applyBusLevels(.06);
    if (this.bgmMuted) window.setTimeout(() => { if (this.bgmMuted) this.music?.pause(); }, 420);
    this.emit();
  }

  async toggleSfxMuted() {
    this.sfxMuted = !this.sfxMuted;
    try { localStorage.setItem('sfxMuted', String(this.sfxMuted)); } catch {}
    if (!this.sfxMuted) await this.unlock();
    else {
      this.stopArchiveScan(.12);
      this.stopFinaleJourney(.16);
    }
    this.applyBusLevels(.05);
    this.emit();
  }

  playPreview() {
    const now = performance.now();
    if (now - this.lastPreview < 180 || this.sfxMuted || this.sfxVolume === 0) return;
    this.lastPreview = now;
    this.playCue(homeEntry, this.desiredScene, .42);
  }

  setScene(scene: AudioScene) { this.activateScene(scene); }

  async prepareScene(_scene: AudioScene) {
    if (!this.context) this.createGraph();
  }

  activateScene(scene: AudioScene) { this.desiredScene = scene; }

  deactivateScene(scene: AudioScene, nextScene?: AudioScene, releaseCues = true) {
    if (nextScene) this.desiredScene = nextScene;
    if (scene === 'archive') this.stopArchiveScan(.1);
    if (scene === 'core') this.stopFinaleJourney(.14);
    if (releaseCues) this.stopSceneCues(scene, .1);
  }

  disposeScene(scene: AudioScene) {
    if (scene === 'archive') this.stopArchiveScan(.035);
    if (scene === 'core') this.stopFinaleJourney(.05);
    this.stopSceneCues(scene, .035);
  }

  playHomeEnter() { this.playCue(homeEntry, 'home', .88); }

  playThemeEntry(theme: PortalSoundTheme) { this.playCue(nodeCues[theme], 'portal', .92); }

  playCompletion() { this.playCue(completionCue, 'portal', .9); }

  startArchiveScan() {
    if (!this.context || !this.sfxBus || !this.reverbInput || !this.noiseBuffer || this.sfxMuted || this.scanVoice) return;
    const context = this.context;
    const now = context.currentTime;
    const output = context.createGain();
    const pulse = context.createOscillator();
    const pulseGain = context.createGain();
    const signal = context.createOscillator();
    const signalGain = context.createGain();
    const noise = context.createBufferSource();
    const noiseFilter = context.createBiquadFilter();
    const noiseGain = context.createGain();
    const movement = context.createOscillator();
    const movementDepth = context.createGain();

    output.gain.setValueAtTime(.0001, now);
    output.gain.exponentialRampToValueAtTime(.72, now + .32);
    pulse.frequency.value = 72;
    pulseGain.gain.value = .2;
    signal.frequency.value = 184;
    signalGain.gain.value = .07;
    noise.buffer = this.noiseBuffer;
    noise.loop = true;
    noiseFilter.type = 'bandpass';
    noiseFilter.frequency.value = 540;
    noiseFilter.Q.value = .55;
    noiseGain.gain.value = .055;
    movement.frequency.value = .42;
    movementDepth.gain.value = .08;

    movement.connect(movementDepth).connect(pulseGain.gain);
    pulse.connect(pulseGain).connect(output);
    signal.connect(signalGain).connect(output);
    noise.connect(noiseFilter).connect(noiseGain).connect(output);
    output.connect(this.sfxBus);
    output.connect(this.reverbInput);
    const sources: AudioScheduledSourceNode[] = [pulse, signal, noise, movement];
    sources.forEach(source => source.start(now));
    this.scanVoice = { scene: 'archive', output, sources };
  }

  stopArchiveScan(duration = .24) {
    if (!this.scanVoice) return;
    this.fadeAndStop(this.scanVoice, duration);
    this.scanVoice = undefined;
  }

  playFinaleJourney() {
    this.stopFinaleJourney(.04);
    if (!this.context || !this.sfxBus || !this.reverbInput || !this.noiseBuffer || this.sfxMuted) return;
    const context = this.context;
    const now = context.currentTime;
    const output = context.createGain();
    const low = context.createOscillator();
    const lowGain = context.createGain();
    const shimmer = context.createOscillator();
    const shimmerGain = context.createGain();
    const open = context.createOscillator();
    const openGain = context.createGain();
    const noise = context.createBufferSource();
    const noiseFilter = context.createBiquadFilter();
    const noiseGain = context.createGain();

    output.gain.setValueAtTime(.0001, now);
    output.gain.exponentialRampToValueAtTime(.64, now + .48);
    output.gain.setValueAtTime(.64, now + 4.4);
    output.gain.exponentialRampToValueAtTime(.0001, now + 5.8);
    low.frequency.setValueAtTime(62, now);
    low.frequency.exponentialRampToValueAtTime(92, now + 5.3);
    lowGain.gain.setValueAtTime(.18, now);
    lowGain.gain.linearRampToValueAtTime(.24, now + 3.2);
    shimmer.frequency.setValueAtTime(196, now);
    shimmer.frequency.exponentialRampToValueAtTime(294, now + 4.5);
    shimmerGain.gain.setValueAtTime(.0001, now);
    shimmerGain.gain.exponentialRampToValueAtTime(.07, now + 1.5);
    shimmerGain.gain.exponentialRampToValueAtTime(.035, now + 5.5);
    open.type = 'triangle';
    open.frequency.value = 138;
    openGain.gain.setValueAtTime(.0001, now);
    openGain.gain.setValueAtTime(.0001, now + 3.05);
    openGain.gain.exponentialRampToValueAtTime(.12, now + 3.65);
    openGain.gain.exponentialRampToValueAtTime(.0001, now + 5.65);
    noise.buffer = this.noiseBuffer;
    noise.loop = true;
    noiseFilter.type = 'lowpass';
    noiseFilter.frequency.setValueAtTime(420, now);
    noiseFilter.frequency.exponentialRampToValueAtTime(1180, now + 3.8);
    noiseGain.gain.value = .035;

    low.connect(lowGain).connect(output);
    shimmer.connect(shimmerGain).connect(output);
    open.connect(openGain).connect(output);
    noise.connect(noiseFilter).connect(noiseGain).connect(output);
    output.connect(this.sfxBus);
    output.connect(this.reverbInput);
    const sources: AudioScheduledSourceNode[] = [low, shimmer, open, noise];
    sources.forEach(source => { source.start(now); source.stop(now + 5.9); });
    const voice: ActiveVoice = { scene: 'core', output, sources };
    voice.cleanupTimer = window.setTimeout(() => {
      this.voices.delete(voice);
      if (this.finaleVoice === voice) this.finaleVoice = undefined;
    }, 6100);
    this.voices.add(voice);
    this.finaleVoice = voice;
  }

  stopFinaleJourney(duration = .2) {
    if (!this.finaleVoice) return;
    this.fadeAndStop(this.finaleVoice, duration);
    this.finaleVoice = undefined;
  }

  setInteraction(kind: InteractionKind, value: number) {
    if (kind === 'archive') return;
    const now = performance.now();
    if (now - this.lastInteractionCue < 280 || value < 18) return;
    this.lastInteractionCue = now;
  }

  playPulse(kind: PulseKind, intensity = .5) {
    if (kind === 'home') this.playCue(homeEntry, this.desiredScene, intensity);
    else if (kind === 'route-in') this.playCue(homeEntry, this.desiredScene, intensity * .82);
    else if (kind === 'route-out') this.playCue(routeOutCue, this.desiredScene, intensity);
    else if (kind === 'water') this.playCue(subtleWater, this.desiredScene, intensity);
    else if (kind === 'focus') this.playCue(subtleFocus, this.desiredScene, intensity);
    else if (kind === 'scan') this.playCue(scanCompleteCue, this.desiredScene, intensity);
    else this.playCue(subtleTime, this.desiredScene, intensity);
  }

  private createGraph() {
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (!AudioContextClass) return;
    const context = new AudioContextClass({ latencyHint: 'interactive' });
    const master = context.createGain();
    const musicBus = context.createGain();
    const sfxBus = context.createGain();
    const reverbInput = context.createGain();
    const convolver = context.createConvolver();
    const reverbReturn = context.createGain();
    const toneControl = context.createBiquadFilter();
    const compressor = context.createDynamicsCompressor();

    master.gain.value = 0;
    musicBus.gain.value = this.bgmMuted ? 0 : mapVolumeToGain(this.bgmVolume);
    sfxBus.gain.value = this.sfxMuted ? 0 : mapVolumeToGain(this.sfxVolume);
    reverbReturn.gain.value = .32;
    toneControl.type = 'lowpass';
    toneControl.frequency.value = 3900;
    toneControl.Q.value = .18;
    compressor.threshold.value = -20;
    compressor.knee.value = 18;
    compressor.ratio.value = 2.4;
    compressor.attack.value = .02;
    compressor.release.value = .3;
    convolver.buffer = this.createImpulse(context, 1.65, 3.4);
    this.noiseBuffer = this.createNoise(context, 6.2);

    musicBus.connect(master);
    sfxBus.connect(master);
    reverbInput.connect(convolver).connect(reverbReturn).connect(sfxBus);
    master.connect(toneControl).connect(compressor).connect(context.destination);

    const music = new Audio(BGM_SOURCE);
    music.loop = true;
    music.preload = 'none';
    music.crossOrigin = 'anonymous';
    music.setAttribute('playsinline', '');
    const mediaSource = context.createMediaElementSource(music);
    mediaSource.connect(musicBus);

    this.context = context;
    this.master = master;
    this.musicBus = musicBus;
    this.sfxBus = sfxBus;
    this.reverbInput = reverbInput;
    this.music = music;
    this.mediaSource = mediaSource;
  }

  private async startMusic() {
    if (!this.music || this.bgmMuted || this.bgmVolume === 0 || document.hidden) return;
    try { await this.music.play(); } catch {}
  }

  private playCue(cue: Cue, scene: AudioScene, intensity: number) {
    if (!this.context || !this.sfxBus || !this.reverbInput || !this.noiseBuffer || this.sfxMuted || this.sfxVolume === 0) return;
    const context = this.context;
    const now = context.currentTime;
    const output = context.createGain();
    const dry = context.createGain();
    const wet = context.createGain();
    const filter = context.createBiquadFilter();
    const sources: AudioScheduledSourceNode[] = [];
    const safeIntensity = Math.max(.18, Math.min(1, intensity));

    output.gain.setValueAtTime(.0001, now);
    output.gain.exponentialRampToValueAtTime(.7 + safeIntensity * .3, now + cue.attack);
    output.gain.setValueAtTime(.7 + safeIntensity * .3, now + Math.max(cue.attack, cue.duration - cue.release));
    output.gain.exponentialRampToValueAtTime(.0001, now + cue.duration);
    dry.gain.value = 1;
    wet.gain.value = cue.wet;
    filter.type = 'lowpass';
    filter.frequency.value = cue.filter;
    filter.Q.value = .28;

    cue.tones.forEach(tone => {
      const oscillator = context.createOscillator();
      const gain = context.createGain();
      const panner = context.createStereoPanner();
      const delay = tone.delay ?? 0;
      const duration = tone.duration ?? Math.max(.16, cue.duration - delay);
      oscillator.type = tone.wave ?? 'sine';
      oscillator.frequency.setValueAtTime(tone.from, now + delay);
      oscillator.frequency.exponentialRampToValueAtTime(tone.to, now + delay + duration * .84);
      gain.gain.value = tone.level * safeIntensity;
      panner.pan.value = tone.pan ?? 0;
      oscillator.connect(gain).connect(panner).connect(filter);
      oscillator.start(now + delay);
      oscillator.stop(now + delay + duration + .04);
      sources.push(oscillator);
    });

    if (cue.noise) {
      const source = context.createBufferSource();
      const noiseFilter = context.createBiquadFilter();
      const gain = context.createGain();
      const delay = cue.noise.delay ?? 0;
      const duration = cue.noise.duration ?? cue.duration - delay;
      source.buffer = this.noiseBuffer;
      noiseFilter.type = 'bandpass';
      noiseFilter.frequency.value = cue.noise.frequency;
      noiseFilter.Q.value = .5;
      gain.gain.value = cue.noise.level * safeIntensity;
      source.connect(noiseFilter).connect(gain).connect(filter);
      source.start(now + delay);
      source.stop(now + delay + duration + .04);
      sources.push(source);
    }

    filter.connect(output);
    output.connect(dry).connect(this.sfxBus);
    output.connect(wet).connect(this.reverbInput);
    const voice: ActiveVoice = { scene, output, sources };
    voice.cleanupTimer = window.setTimeout(() => this.voices.delete(voice), (cue.duration + .14) * 1000);
    this.voices.add(voice);
  }

  private stopSceneCues(scene: AudioScene, duration: number) {
    for (const voice of Array.from(this.voices)) {
      if (voice.scene === scene) this.fadeAndStop(voice, duration);
    }
  }

  private fadeAndStop(voice: ActiveVoice, duration: number) {
    if (!this.context) return;
    const now = this.context.currentTime;
    if (voice.cleanupTimer) window.clearTimeout(voice.cleanupTimer);
    voice.output.gain.cancelScheduledValues(now);
    voice.output.gain.setValueAtTime(Math.max(.0001, voice.output.gain.value), now);
    voice.output.gain.exponentialRampToValueAtTime(.0001, now + duration);
    voice.sources.forEach(source => {
      try { source.stop(now + duration + .05); } catch {}
    });
    this.voices.delete(voice);
  }

  private createNoise(context: AudioContext, seconds: number) {
    const buffer = context.createBuffer(1, Math.floor(context.sampleRate * seconds), context.sampleRate);
    const data = buffer.getChannelData(0);
    let previous = 0;
    for (let index = 0; index < data.length; index += 1) {
      const white = Math.random() * 2 - 1;
      previous = previous * .9 + white * .1;
      data[index] = previous;
    }
    return buffer;
  }

  private createImpulse(context: AudioContext, seconds: number, decay: number) {
    const buffer = context.createBuffer(2, Math.floor(context.sampleRate * seconds), context.sampleRate);
    for (let channel = 0; channel < buffer.numberOfChannels; channel += 1) {
      const data = buffer.getChannelData(channel);
      for (let index = 0; index < data.length; index += 1) {
        data[index] = (Math.random() * 2 - 1) * Math.pow(1 - index / data.length, decay);
      }
    }
    return buffer;
  }

  private setMasterLevel(smooth: number) {
    if (!this.context || !this.master) return;
    const target = document.hidden ? 0 : 1;
    this.master.gain.setTargetAtTime(target, this.context.currentTime, smooth);
  }

  private applyBusLevels(smooth: number) {
    if (!this.context) return;
    const now = this.context.currentTime;
    if (this.musicBus) {
      const bgmTarget = this.bgmMuted ? 0 : mapVolumeToGain(this.bgmVolume);
      this.musicBus.gain.setTargetAtTime(bgmTarget, now, smooth);
      if (!this.bgmMuted && this.bgmVolume > 0) void this.startMusic();
    }
    if (this.sfxBus) {
      const sfxTarget = this.sfxMuted ? 0 : mapVolumeToGain(this.sfxVolume);
      this.sfxBus.gain.setTargetAtTime(sfxTarget, now, smooth);
    }
  }

  private handleVisibility = () => {
    if (!this.context || !this.unlocked) return;
    if (document.hidden) {
      this.setMasterLevel(.06);
      window.setTimeout(() => {
        if (!document.hidden) return;
        this.music?.pause();
        void this.context?.suspend();
      }, 360);
    } else {
      void this.context.resume().then(async () => {
        this.setMasterLevel(.14);
        this.applyBusLevels(.08);
        if (!this.bgmMuted) await this.startMusic();
      }).catch(() => {});
    }
  };

  private handlePageShow = () => {
    if (!this.context || !this.unlocked) return;
    void this.context.resume().then(async () => {
      this.setMasterLevel(.14);
      this.applyBusLevels(.08);
      if (!this.bgmMuted) await this.startMusic();
    }).catch(() => {});
  };

  private emit() { this.listeners.forEach(listener => listener()); }
}

declare global { interface Window { webkitAudioContext: typeof AudioContext; } }

export const opticalAudio = new OpticalAudioEngine();
