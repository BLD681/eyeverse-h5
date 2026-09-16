export type AudioScene = 'home' | 'portal' | 'dryeye' | 'refraction' | 'archive' | 'time' | 'core';
export type PortalSoundTheme = 'dry-eye' | 'refraction' | 'vision-archive' | 'time-mirror';
type PulseKind = 'home' | 'route-in' | 'route-out' | 'water' | 'focus' | 'scan' | 'time';
type InteractionKind = 'dryeye' | 'refraction' | 'archive' | 'time';

type SceneSpec = {
  drone: number;
  glass: number;
  texture: number;
  droneGain: number;
  glassGain: number;
  textureGain: number;
  noiseGain: number;
  noiseFilter: number;
  room: number;
  motion: number;
  pan: number;
};

type SceneVoice = {
  scene: AudioScene;
  output: GainNode;
  room: GainNode;
  drone: OscillatorNode;
  droneGain: GainNode;
  glass: OscillatorNode;
  glassGain: GainNode;
  glassPan: StereoPannerNode;
  texture: OscillatorNode;
  textureGain: GainNode;
  texturePan: StereoPannerNode;
  noise: AudioBufferSourceNode;
  noiseGain: GainNode;
  noiseFilter: BiquadFilterNode;
  motion: OscillatorNode;
  sources: AudioScheduledSourceNode[];
  spec: SceneSpec;
};

type CueVoice = {
  scene: AudioScene;
  output: GainNode;
  sources: AudioScheduledSourceNode[];
  cleanupTimer: number;
};

type CueTone = [from: number, to: number, gain: number, wave: OscillatorType];
type CueSpec = {
  duration: number;
  attack: number;
  level: number;
  filter: number;
  wet: number;
  tones: CueTone[];
  pan?: [number, number];
  noise?: [gain: number, frequency: number];
};

const scenes: Record<AudioScene, SceneSpec> = {
  home: { drone: 92, glass: 276, texture: 184, droneGain: .052, glassGain: .014, textureGain: .007, noiseGain: .004, noiseFilter: 620, room: .13, motion: .085, pan: .14 },
  portal: { drone: 104, glass: 312, texture: 208, droneGain: .045, glassGain: .019, textureGain: .009, noiseGain: .008, noiseFilter: 900, room: .21, motion: .07, pan: .24 },
  dryeye: { drone: 118, glass: 354, texture: 236, droneGain: .034, glassGain: .011, textureGain: .006, noiseGain: .026, noiseFilter: 760, room: .18, motion: .12, pan: .18 },
  refraction: { drone: 146, glass: 438, texture: 292, droneGain: .032, glassGain: .018, textureGain: .009, noiseGain: .004, noiseFilter: 1350, room: .16, motion: .095, pan: .28 },
  archive: { drone: 108, glass: 432, texture: 216, droneGain: .04, glassGain: .018, textureGain: .009, noiseGain: .007, noiseFilter: 1050, room: .22, motion: .16, pan: .2 },
  time: { drone: 94, glass: 282, texture: 188, droneGain: .049, glassGain: .013, textureGain: .008, noiseGain: .005, noiseFilter: 720, room: .23, motion: .18, pan: .17 },
  core: { drone: 96, glass: 288, texture: 192, droneGain: .052, glassGain: .02, textureGain: .01, noiseGain: .006, noiseFilter: 860, room: .26, motion: .065, pan: .2 },
};

const cues: Record<'awaken' | 'open' | 'close' | 'water' | 'focus' | 'scanStart' | 'scanComplete' | 'time', CueSpec> = {
  awaken: { duration: 1.08, attack: .15, level: .105, filter: 980, wet: .2, tones: [[92, 108, .72, 'sine'], [184, 216, .23, 'triangle'], [276, 322, .11, 'sine']], noise: [.035, 520] },
  open: { duration: 1.24, attack: .13, level: .13, filter: 1120, wet: .27, tones: [[88, 136, .68, 'sine'], [176, 272, .24, 'triangle'], [264, 408, .1, 'sine']], pan: [-.08, .08], noise: [.055, 640] },
  close: { duration: .92, attack: .08, level: .105, filter: 1050, wet: .22, tones: [[196, 104, .62, 'sine'], [294, 156, .21, 'triangle'], [392, 208, .08, 'sine']], pan: [.1, 0] },
  water: { duration: .78, attack: .09, level: .09, filter: 1180, wet: .24, tones: [[132, 118, .5, 'sine'], [420, 248, .18, 'sine']], pan: [-.18, .14], noise: [.22, 610] },
  focus: { duration: .72, attack: .08, level: .095, filter: 1260, wet: .18, tones: [[264, 328, .42, 'sine'], [292, 328, .34, 'sine'], [528, 492, .08, 'triangle']], pan: [-.3, 0] },
  scanStart: { duration: .9, attack: .1, level: .105, filter: 1360, wet: .22, tones: [[118, 148, .56, 'sine'], [354, 486, .2, 'triangle'], [472, 594, .08, 'sine']], pan: [-.12, .12], noise: [.045, 760] },
  scanComplete: { duration: 1.28, attack: .1, level: .135, filter: 1280, wet: .3, tones: [[146, 146, .55, 'sine'], [219, 220, .24, 'sine'], [292, 293, .12, 'triangle']], pan: [-.04, .04] },
  time: { duration: .96, attack: .13, level: .095, filter: 920, wet: .28, tones: [[92, 104, .65, 'sine'], [184, 208, .2, 'triangle'], [276, 286, .07, 'sine']], pan: [-.1, .1] },
};

class OpticalAudioEngine {
  private context?: AudioContext;
  private master?: GainNode;
  private ambientBus?: GainNode;
  private interactionBus?: GainNode;
  private completionBus?: GainNode;
  private reverbInput?: GainNode;
  private noiseBuffer?: AudioBuffer;
  private activeVoice?: SceneVoice;
  private activeCues = new Set<CueVoice>();
  private desiredScene: AudioScene = 'home';
  private muted = false;
  private volume = .82;
  private unlocked = false;
  private listeners = new Set<() => void>();
  private lastModulation = 0;
  private archiveStage = 0;

  constructor() {
    try {
      this.muted = localStorage.getItem('eyeverse-sound') === 'off';
      const savedVolume = Number(localStorage.getItem('eyeverse-volume'));
      if (Number.isFinite(savedVolume) && savedVolume > 0) this.volume = Math.min(1, savedVolume);
    } catch {}
    document.addEventListener('visibilitychange', this.handleVisibility);
    window.addEventListener('pageshow', this.handlePageShow);
  }

  isMuted = () => this.muted;
  getVolume = () => this.volume;
  subscribe = (listener: () => void) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };

  async unlock() {
    if (this.muted) return;
    if (!this.context) this.createGraph();
    if (this.context?.state !== 'running') {
      try { await this.context?.resume(); } catch {}
    }
    this.unlocked = this.context?.state === 'running';
    if (this.unlocked && this.activeVoice?.scene !== this.desiredScene) this.crossfadeScene(this.desiredScene, 1.15);
    this.setMasterLevel(.18);
  }

  async toggle() {
    this.muted = !this.muted;
    try { localStorage.setItem('eyeverse-sound', this.muted ? 'off' : 'on'); } catch {}
    if (this.muted) this.setMasterLevel(.1);
    else {
      await this.unlock();
      this.playCue(cues.awaken, .34, false);
    }
    this.emit();
  }

  setVolume(value: number) {
    this.volume = Math.max(.08, Math.min(1, value));
    try { localStorage.setItem('eyeverse-volume', String(this.volume)); } catch {}
    this.setMasterLevel(.065);
    this.emit();
  }

  setScene(scene: AudioScene) {
    this.activateScene(scene);
  }

  async prepareScene(_scene: AudioScene) {
    if (this.muted) return;
    if (!this.context) this.createGraph();
    if (this.context?.state !== 'running') {
      try { await this.context?.resume(); } catch {}
    }
    this.unlocked = this.context?.state === 'running';
  }

  activateScene(scene: AudioScene) {
    if (scene === this.desiredScene && this.activeVoice?.scene === scene) return;
    this.desiredScene = scene;
    this.archiveStage = 0;
    if (this.context && this.unlocked && !this.muted) this.crossfadeScene(scene, .72);
  }

  deactivateScene(scene: AudioScene, nextScene?: AudioScene, releaseCues = true) {
    if (nextScene) this.desiredScene = nextScene;
    if (this.activeVoice?.scene === scene) {
      this.stopSceneVoice(this.activeVoice, .2);
      this.activeVoice = undefined;
    }
    if (releaseCues) this.stopCues(scene, .12);
  }

  disposeScene(scene: AudioScene) {
    if (this.activeVoice?.scene === scene) {
      this.stopSceneVoice(this.activeVoice, .035);
      this.activeVoice = undefined;
    }
    this.stopCues(scene, .035);
  }

  playThemeEntry(theme: PortalSoundTheme) {
    const cue = theme === 'dry-eye' ? cues.water
      : theme === 'refraction' ? cues.focus
        : theme === 'vision-archive' ? cues.scanStart : cues.time;
    this.playCue(cue, .52, false);
  }

  setInteraction(kind: InteractionKind, value: number) {
    const voice = this.activeVoice;
    if (!this.context || !voice || voice.scene !== kind || this.muted) return;
    const nowMs = performance.now();
    if (nowMs - this.lastModulation < 32) return;
    this.lastModulation = nowMs;
    const amount = Math.max(0, Math.min(1, value / 100));
    const now = this.context.currentTime;
    const smooth = .07;

    if (kind === 'dryeye') {
      voice.noiseGain.gain.setTargetAtTime(voice.spec.noiseGain * (1 - amount * .78), now, .11);
      voice.noiseFilter.frequency.setTargetAtTime(760 - amount * 350, now, .1);
      voice.room.gain.setTargetAtTime(.18 - amount * .105, now, .12);
      voice.glassGain.gain.setTargetAtTime(voice.spec.glassGain * (1 - amount * .55), now, .1);
    } else if (kind === 'refraction') {
      voice.glass.frequency.setTargetAtTime(438 * (1 + amount * .022), now, smooth);
      voice.texture.frequency.setTargetAtTime(292 * (1 - amount * .018), now, smooth);
      voice.glassPan.pan.setTargetAtTime(-amount * .42, now, smooth);
      voice.texturePan.pan.setTargetAtTime(amount * .38, now, smooth);
      voice.room.gain.setTargetAtTime(.16 + amount * .08, now, .1);
    } else if (kind === 'archive') {
      voice.noiseFilter.frequency.setTargetAtTime(520 + amount * 760, now, smooth);
      voice.glass.frequency.setTargetAtTime(432 + amount * 92, now, smooth);
      voice.glassGain.gain.setTargetAtTime(.018 + amount * .016, now, smooth);
      const stage = Math.min(3, Math.floor(amount * 4));
      if (stage > this.archiveStage && stage < 4) {
        this.archiveStage = stage;
        if (stage > 0) this.playArchiveStage(stage);
      }
    } else {
      voice.drone.frequency.setTargetAtTime(94 - amount * 12, now, .12);
      voice.room.gain.setTargetAtTime(.2 + amount * .1, now, .12);
      voice.textureGain.gain.setTargetAtTime(.008 + amount * .006, now, .1);
      voice.motion.frequency.setTargetAtTime(.18 - amount * .055, now, .12);
    }
  }

  playPulse(kind: PulseKind, intensity = .5) {
    if (kind === 'scan') {
      this.playCue(intensity >= .36 ? cues.scanComplete : cues.scanStart, intensity, intensity >= .36);
      return;
    }
    const cue = kind === 'home' ? cues.awaken
      : kind === 'route-in' ? cues.open
        : kind === 'route-out' ? cues.close
          : kind === 'water' ? cues.water
            : kind === 'focus' ? cues.focus : cues.time;
    this.playCue(cue, intensity, false);
  }

  private createGraph() {
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (!AudioContextClass) return;
    const context = new AudioContextClass({ latencyHint: 'interactive' });
    const master = context.createGain();
    const ambientBus = context.createGain();
    const interactionBus = context.createGain();
    const completionBus = context.createGain();
    const reverbInput = context.createGain();
    const reverb = context.createConvolver();
    const reverbReturn = context.createGain();
    const toneControl = context.createBiquadFilter();
    const compressor = context.createDynamicsCompressor();

    master.gain.value = 0;
    ambientBus.gain.value = .36;
    interactionBus.gain.value = .56;
    completionBus.gain.value = .66;
    reverbReturn.gain.value = .42;
    toneControl.type = 'lowpass';
    toneControl.frequency.value = 1850;
    toneControl.Q.value = .35;
    compressor.threshold.value = -24;
    compressor.knee.value = 22;
    compressor.ratio.value = 3;
    compressor.attack.value = .018;
    compressor.release.value = .28;

    reverb.buffer = this.createImpulse(context, 1.45, 3.3);
    this.noiseBuffer = this.createNoise(context, 2.4);
    ambientBus.connect(master);
    interactionBus.connect(master);
    completionBus.connect(master);
    reverbInput.connect(reverb).connect(reverbReturn).connect(master);
    master.connect(toneControl).connect(compressor).connect(context.destination);

    this.context = context;
    this.master = master;
    this.ambientBus = ambientBus;
    this.interactionBus = interactionBus;
    this.completionBus = completionBus;
    this.reverbInput = reverbInput;
  }

  private crossfadeScene(scene: AudioScene, duration: number) {
    if (!this.context || !this.ambientBus || !this.reverbInput) return;
    const context = this.context;
    const now = context.currentTime;
    const previous = this.activeVoice;
    if (previous) {
      this.stopSceneVoice(previous, duration);
    }
    const voice = this.createSceneVoice(scene);
    voice.output.gain.setValueAtTime(.0001, now);
    voice.output.gain.exponentialRampToValueAtTime(1, now + Math.max(.65, duration * 1.4));
    this.activeVoice = voice;
  }

  private createSceneVoice(scene: AudioScene): SceneVoice {
    const context = this.context!;
    const spec = scenes[scene];
    const output = context.createGain();
    const room = context.createGain();
    const drone = context.createOscillator();
    const droneGain = context.createGain();
    const glass = context.createOscillator();
    const glassGain = context.createGain();
    const glassPan = context.createStereoPanner();
    const texture = context.createOscillator();
    const textureGain = context.createGain();
    const texturePan = context.createStereoPanner();
    const noise = context.createBufferSource();
    const noiseFilter = context.createBiquadFilter();
    const noiseGain = context.createGain();
    const motion = context.createOscillator();
    const glassMotion = context.createGain();
    const textureMotion = context.createGain();

    drone.type = 'sine';
    drone.frequency.value = spec.drone;
    droneGain.gain.value = spec.droneGain;
    glass.type = 'sine';
    glass.frequency.value = spec.glass;
    glassGain.gain.value = spec.glassGain;
    glassPan.pan.value = -spec.pan;
    texture.type = 'triangle';
    texture.frequency.value = spec.texture;
    texture.detune.value = -5;
    textureGain.gain.value = spec.textureGain;
    texturePan.pan.value = spec.pan;
    noise.buffer = this.noiseBuffer!;
    noise.loop = true;
    noiseFilter.type = scene === 'dryeye' ? 'bandpass' : 'lowpass';
    noiseFilter.frequency.value = spec.noiseFilter;
    noiseFilter.Q.value = scene === 'dryeye' ? .45 : .25;
    noiseGain.gain.value = spec.noiseGain;
    motion.type = 'sine';
    motion.frequency.value = spec.motion;
    glassMotion.gain.value = spec.pan * .45;
    textureMotion.gain.value = -spec.pan * .38;
    room.gain.value = spec.room;

    drone.connect(droneGain).connect(output);
    glass.connect(glassGain).connect(glassPan).connect(output);
    texture.connect(textureGain).connect(texturePan).connect(output);
    noise.connect(noiseFilter).connect(noiseGain).connect(output);
    motion.connect(glassMotion).connect(glassPan.pan);
    motion.connect(textureMotion).connect(texturePan.pan);
    output.connect(this.ambientBus!);
    output.connect(room).connect(this.reverbInput!);

    const sources: AudioScheduledSourceNode[] = [drone, glass, texture, noise, motion];
    sources.forEach(source => source.start());
    return { scene, output, room, drone, droneGain, glass, glassGain, glassPan, texture, textureGain, texturePan, noise, noiseGain, noiseFilter, motion, sources, spec };
  }

  private playCue(spec: CueSpec, intensity: number, completion: boolean) {
    if (!this.context || !this.interactionBus || !this.completionBus || !this.reverbInput || !this.noiseBuffer || this.muted) return;
    const context = this.context;
    const now = context.currentTime;
    const toneMix = context.createGain();
    const filter = context.createBiquadFilter();
    const envelope = context.createGain();
    const panner = context.createStereoPanner();
    const wet = context.createGain();
    const cueOutput = context.createGain();
    const sources: AudioScheduledSourceNode[] = [];
    const peak = spec.level * (.82 + Math.max(0, Math.min(1, intensity)) * .28);

    toneMix.gain.value = 1;
    filter.type = 'lowpass';
    filter.frequency.value = spec.filter;
    filter.Q.value = .4;
    envelope.gain.setValueAtTime(.0001, now);
    envelope.gain.exponentialRampToValueAtTime(peak, now + spec.attack);
    envelope.gain.setTargetAtTime(peak * .72, now + spec.duration * .38, spec.duration * .24);
    envelope.gain.exponentialRampToValueAtTime(.0001, now + spec.duration);
    if (spec.pan) {
      panner.pan.setValueAtTime(spec.pan[0], now);
      panner.pan.linearRampToValueAtTime(spec.pan[1], now + spec.duration);
    }
    wet.gain.value = spec.wet;

    spec.tones.forEach(([from, to, level, wave]) => {
      const oscillator = context.createOscillator();
      const gain = context.createGain();
      oscillator.type = wave;
      oscillator.frequency.setValueAtTime(from, now);
      oscillator.frequency.exponentialRampToValueAtTime(to, now + spec.duration * .82);
      gain.gain.value = level;
      oscillator.connect(gain).connect(toneMix);
      oscillator.start(now);
      oscillator.stop(now + spec.duration + .06);
      sources.push(oscillator);
    });

    if (spec.noise) {
      const noise = context.createBufferSource();
      const noiseFilter = context.createBiquadFilter();
      const noiseGain = context.createGain();
      noise.buffer = this.noiseBuffer;
      noiseFilter.type = 'bandpass';
      noiseFilter.frequency.value = spec.noise[1];
      noiseFilter.Q.value = .55;
      noiseGain.gain.value = spec.noise[0];
      noise.connect(noiseFilter).connect(noiseGain).connect(toneMix);
      noise.start(now);
      noise.stop(now + spec.duration + .06);
      sources.push(noise);
    }

    cueOutput.gain.value = 1;
    toneMix.connect(filter).connect(envelope).connect(panner).connect(cueOutput);
    cueOutput.connect(completion ? this.completionBus : this.interactionBus);
    cueOutput.connect(wet).connect(this.reverbInput);
    const cueVoice = {
      scene: this.desiredScene,
      output: cueOutput,
      sources,
      cleanupTimer: 0,
    } satisfies CueVoice;
    cueVoice.cleanupTimer = window.setTimeout(() => this.activeCues.delete(cueVoice), (spec.duration + .14) * 1000);
    this.activeCues.add(cueVoice);
  }

  private stopSceneVoice(voice: SceneVoice, duration: number) {
    if (!this.context) return;
    const now = this.context.currentTime;
    voice.output.gain.cancelScheduledValues(now);
    voice.output.gain.setValueAtTime(Math.max(.0001, voice.output.gain.value), now);
    voice.output.gain.exponentialRampToValueAtTime(.0001, now + duration);
    voice.sources.forEach(source => {
      try { source.stop(now + duration + .06); } catch {}
    });
  }

  private stopCues(scene: AudioScene, duration: number) {
    if (!this.context) return;
    const now = this.context.currentTime;
    for (const cue of this.activeCues) {
      if (cue.scene !== scene) continue;
      window.clearTimeout(cue.cleanupTimer);
      cue.output.gain.cancelScheduledValues(now);
      cue.output.gain.setValueAtTime(Math.max(.0001, cue.output.gain.value), now);
      cue.output.gain.exponentialRampToValueAtTime(.0001, now + duration);
      cue.sources.forEach(source => {
        try { source.stop(now + duration + .04); } catch {}
      });
      this.activeCues.delete(cue);
    }
  }

  private playArchiveStage(stage: number) {
    const base = 172 + stage * 24;
    this.playCue({
      duration: .52,
      attack: .08,
      level: .052,
      filter: 940,
      wet: .2,
      tones: [[base, base * 1.08, .6, 'sine'], [base * 2, base * 2.05, .13, 'triangle']],
      pan: [stage % 2 ? -.18 : .18, 0],
    }, .28, false);
  }

  private createNoise(context: AudioContext, seconds: number) {
    const buffer = context.createBuffer(1, Math.floor(context.sampleRate * seconds), context.sampleRate);
    const data = buffer.getChannelData(0);
    let previous = 0;
    for (let index = 0; index < data.length; index += 1) {
      const white = Math.random() * 2 - 1;
      previous = previous * .86 + white * .14;
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
    const target = this.muted || document.hidden ? 0 : this.volume * .9;
    this.master.gain.setTargetAtTime(target, this.context.currentTime, smooth);
  }

  private handleVisibility = () => {
    if (!this.context || !this.unlocked) return;
    if (document.hidden) {
      this.setMasterLevel(.08);
      window.setTimeout(() => { if (document.hidden) void this.context?.suspend(); }, 340);
    } else {
      void this.context.resume().then(() => this.setMasterLevel(.18)).catch(() => {});
    }
  };

  private handlePageShow = () => {
    if (!this.context || !this.unlocked || this.muted) return;
    void this.context.resume().then(() => this.setMasterLevel(.18)).catch(() => {});
  };

  private emit() { this.listeners.forEach(listener => listener()); }
}

declare global { interface Window { webkitAudioContext: typeof AudioContext; } }

export const opticalAudio = new OpticalAudioEngine();
