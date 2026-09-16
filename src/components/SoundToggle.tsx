import { useSyncExternalStore, type CSSProperties } from 'react';
import { opticalAudio } from '../audio/OpticalAudio';

export function SoundToggle() {
  const muted = useSyncExternalStore(opticalAudio.subscribe, opticalAudio.isMuted, opticalAudio.isMuted);
  const volume = useSyncExternalStore(opticalAudio.subscribe, opticalAudio.getVolume, opticalAudio.getVolume);
  return <div className={`sound-control ${muted ? 'is-muted' : ''}`}>
    <input
      type="range"
      min="8"
      max="100"
      value={Math.round(volume * 100)}
      aria-label="环境声音音量"
      style={{ '--sound-level': `${volume * 100}%` } as CSSProperties}
      onChange={event => opticalAudio.setVolume(Number(event.currentTarget.value) / 100)}
    />
    <button className="sound-toggle" type="button"
      aria-label={muted ? '开启环境声音' : '关闭环境声音'} aria-pressed={!muted}
      onClick={() => { void opticalAudio.toggle(); }}>
      <span aria-hidden="true"><i /><i /><i /></span>
    </button>
  </div>;
}
