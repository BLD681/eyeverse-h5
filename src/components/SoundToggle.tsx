import { useEffect, useRef, useState, useSyncExternalStore, type CSSProperties } from 'react';
import { opticalAudio } from '../audio/OpticalAudio';

type Channel = 'bgm' | 'sfx';

function levelFor(volume: number, muted: boolean) {
  if (muted || volume === 0) return 0;
  if (volume <= .3) return 1;
  if (volume <= .6) return 2;
  return 3;
}

function ChannelIcon({ channel }: { channel: Channel }) {
  if (channel === 'bgm') return <span className="sound-symbol sound-symbol--bgm" aria-hidden="true">
    <i className="sound-note">♪</i><span className="sound-rings"><i /><i /><i /></span>
  </span>;
  return <span className="sound-symbol sound-symbol--sfx" aria-hidden="true">
    <i /><i /><i /><span className="sound-rings"><i /><i /><i /></span>
  </span>;
}

export function SoundToggle() {
  const root = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState<Channel | null>(null);
  const bgmVolume = useSyncExternalStore(opticalAudio.subscribe, opticalAudio.getBgmVolume, opticalAudio.getBgmVolume);
  const sfxVolume = useSyncExternalStore(opticalAudio.subscribe, opticalAudio.getSfxVolume, opticalAudio.getSfxVolume);
  const bgmMuted = useSyncExternalStore(opticalAudio.subscribe, opticalAudio.isBgmMuted, opticalAudio.isBgmMuted);
  const sfxMuted = useSyncExternalStore(opticalAudio.subscribe, opticalAudio.isSfxMuted, opticalAudio.isSfxMuted);

  useEffect(() => {
    function closeOutside(event: globalThis.PointerEvent) {
      if (!root.current?.contains(event.target as Node)) setOpen(null);
    }
    document.addEventListener('pointerdown', closeOutside, true);
    return () => document.removeEventListener('pointerdown', closeOutside, true);
  }, []);

  const activeVolume = open === 'bgm' ? bgmVolume : sfxVolume;
  const activeMuted = open === 'bgm' ? bgmMuted : sfxMuted;
  const percent = Math.round(activeVolume * 100);
  const sliderStyle = { '--sound-level': `${percent}%` } as CSSProperties;

  function togglePanel(channel: Channel) {
    setOpen(current => current === channel ? null : channel);
  }

  function changeVolume(channel: Channel, value: number) {
    if (channel === 'bgm') opticalAudio.setBgmVolume(value);
    else opticalAudio.setSfxVolume(value);
  }

  return <div ref={root} className={`sound-control ${open ? 'is-open' : ''}`}>
    <div className="sound-buttons" role="group" aria-label="声音控制">
      {(['bgm', 'sfx'] as const).map(channel => {
        const volume = channel === 'bgm' ? bgmVolume : sfxVolume;
        const muted = channel === 'bgm' ? bgmMuted : sfxMuted;
        const level = levelFor(volume, muted);
        return <button key={channel} className={`sound-mode-button sound-mode-button--${channel} ${open === channel ? 'is-active' : ''} ${level === 0 ? 'is-muted' : ''}`}
          type="button" aria-expanded={open === channel} aria-controls="sound-volume-panel"
          aria-label={`调整${channel === 'bgm' ? '背景音乐' : '交互音效'}`}
          data-level={level} onClick={() => togglePanel(channel)}>
          <span className="sound-mode-glass"><ChannelIcon channel={channel} /><small>{channel.toUpperCase()}</small></span>
        </button>;
      })}
    </div>

    {open && <section id="sound-volume-panel" className={`sound-panel sound-panel--${open}`} aria-label={`${open === 'bgm' ? '背景音乐' : '交互音效'}音量`}>
      <header><span>{open.toUpperCase()}</span><button type="button" className="sound-mute"
        aria-pressed={activeMuted} onClick={() => { void (open === 'bgm' ? opticalAudio.toggleBgmMuted() : opticalAudio.toggleSfxMuted()); }}>
        {activeMuted ? '开启' : '静音'}
      </button></header>
      <div className="sound-slider-row">
        <input type="range" min="0" max="100" step="1" value={percent}
          aria-label={`${open === 'bgm' ? '背景音乐' : '交互音效'}音量`}
          style={sliderStyle}
          onChange={event => changeVolume(open, Number(event.currentTarget.value) / 100)}
          onPointerUp={() => { if (open === 'sfx') opticalAudio.playPreview(); }}
          onKeyUp={() => { if (open === 'sfx') opticalAudio.playPreview(); }} />
        <output>{activeMuted ? 'MUTE' : `${percent}%`}</output>
      </div>
    </section>}
  </div>;
}
