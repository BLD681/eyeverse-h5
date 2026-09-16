import { forwardRef, useEffect, useImperativeHandle, useRef, useState, useSyncExternalStore } from 'react';
import { opticalAudio } from '../audio/OpticalAudio';
import { finaleVisuals } from '../config/visuals';

type FinalePhase = 'idle' | 'entering' | 'playing' | 'holding' | 'ready' | 'resolving' | 'final';
type FrameAwareVideo = {
  requestVideoFrameCallback?: (callback: VideoFrameRequestCallback) => number;
  cancelVideoFrameCallback?: (handle: number) => void;
};

export type TheEyeWithinHandle = {
  begin: () => boolean;
};

function afterTwoFrames(callback: () => void) {
  requestAnimationFrame(() => requestAnimationFrame(callback));
}

export const TheEyeWithin = forwardRef<TheEyeWithinHandle, {
  active: boolean;
  onReady: (ready: boolean) => void;
  onPlaybackStarted: () => void;
  onPlaybackFailed: () => void;
}>(({ active, onReady, onPlaybackStarted, onPlaybackFailed }, forwardedRef) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const phaseRef = useRef<FinalePhase>(active ? 'holding' : 'idle');
  const frameCallback = useRef<number | undefined>(undefined);
  const timers = useRef<number[]>([]);
  const [phase, setPhaseState] = useState<FinalePhase>(active ? 'holding' : 'idle');
  const [videoReady, setVideoReady] = useState(false);
  const [earthReady, setEarthReady] = useState(false);
  const muted = useSyncExternalStore(opticalAudio.subscribe, opticalAudio.isMuted, opticalAudio.isMuted);
  const volume = useSyncExternalStore(opticalAudio.subscribe, opticalAudio.getVolume, opticalAudio.getVolume);

  function setPhase(next: FinalePhase) {
    phaseRef.current = next;
    setPhaseState(next);
  }

  function releaseVideo() {
    const video = videoRef.current;
    if (!video) return;
    video.pause();
    video.removeAttribute('src');
    video.load();
  }

  function waitForPaintedFrame(video: HTMLVideoElement) {
    return new Promise<void>((resolve, reject) => {
      let settled = false;
      const finish = () => {
        if (settled) return;
        settled = true;
        window.clearTimeout(timeout);
        afterTwoFrames(resolve);
      };
      const timeout = window.setTimeout(() => {
        if (settled) return;
        settled = true;
        reject(new Error('Video frame was not painted'));
      }, 7000);
      const frameVideo = video as unknown as FrameAwareVideo;
      if (typeof frameVideo.requestVideoFrameCallback === 'function') {
        frameCallback.current = frameVideo.requestVideoFrameCallback(() => finish());
      } else {
        video.addEventListener('timeupdate', finish, { once: true });
        video.addEventListener('playing', finish, { once: true });
      }
    });
  }

  useImperativeHandle(forwardedRef, () => ({
    begin() {
      const video = videoRef.current;
      if (!video || !videoReady || !earthReady || phaseRef.current !== 'idle') return false;
      setPhase('entering');
      video.currentTime = 0;
      video.muted = muted;
      video.volume = volume;
      const firstFrame = waitForPaintedFrame(video);
      const playback = video.play();
      void Promise.all([playback, firstFrame]).then(() => {
        if (phaseRef.current !== 'entering') return;
        setPhase('playing');
        timers.current.push(window.setTimeout(onPlaybackStarted, 900));
      }).catch(() => {
        if (phaseRef.current !== 'entering') return;
        setPhase('idle');
        onPlaybackFailed();
      });
      return true;
    },
  }), [earthReady, muted, onPlaybackFailed, onPlaybackStarted, videoReady, volume]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    video.muted = muted;
    video.volume = volume;
  }, [muted, volume]);

  useEffect(() => {
    onReady(videoReady && earthReady);
  }, [earthReady, onReady, videoReady]);

  useEffect(() => {
    if (active || phaseRef.current === 'idle') return;
    timers.current.forEach(window.clearTimeout);
    timers.current = [];
    releaseVideo();
    const video = videoRef.current;
    if (video) {
      video.src = finaleVisuals.video;
      video.load();
    }
    setVideoReady(false);
    setPhase('idle');
  }, [active]);

  useEffect(() => () => {
    timers.current.forEach(window.clearTimeout);
    timers.current = [];
    const video = videoRef.current;
    const frameVideo = video as unknown as FrameAwareVideo;
    if (video && frameCallback.current !== undefined && typeof frameVideo.cancelVideoFrameCallback === 'function') {
      frameVideo.cancelVideoFrameCallback(frameCallback.current);
    }
    releaseVideo();
    opticalAudio.disposeScene('core');
  }, []);

  function finishPlayback() {
    if (!earthReady) return;
    setPhase('holding');
    afterTwoFrames(() => {
      timers.current.push(window.setTimeout(releaseVideo, 360));
      timers.current.push(window.setTimeout(() => setPhase('ready'), 820));
    });
  }

  function finishEarthLoad(image: HTMLImageElement) {
    void image.decode().catch(() => {});
    setEarthReady(true);
    if (active && phaseRef.current === 'holding') {
      timers.current.push(window.setTimeout(() => setPhase('ready'), 820));
    }
  }

  function touchEarth() {
    if (phaseRef.current !== 'ready') return;
    setPhase('resolving');
    opticalAudio.playPulse('route-in', .38);
    if ('vibrate' in navigator) navigator.vibrate(18);
    timers.current.push(window.setTimeout(() => setPhase('final'), 1650));
  }

  return <section className={`eye-within eye-within--${phase}`} aria-label="The Eye Within" aria-live="polite">
    <video
      ref={videoRef}
      className="eye-within-video"
      src={finaleVisuals.video}
      poster={finaleVisuals.poster}
      preload="auto"
      playsInline
      disablePictureInPicture
      controls={false}
      onLoadedData={() => setVideoReady(true)}
      onCanPlay={() => setVideoReady(true)}
      onEnded={finishPlayback}
      onError={() => { setVideoReady(false); onPlaybackFailed(); }}
    />

    <img className="eye-within-poster" src={finaleVisuals.poster} alt="" aria-hidden="true" draggable={false} />

    <img className="eye-within-earth" src={finaleVisuals.earth} alt="地球与星海"
      draggable={false} onLoad={event => finishEarthLoad(event.currentTarget)} />

    <div className="eye-within-entry" aria-hidden="true"><i /><i /><i /></div>

    {(phase === 'ready' || phase === 'resolving') && <button className="eye-within-touch" type="button" onClick={touchEarth} aria-label="触碰世界">
      <span>触碰世界</span><small>TOUCH THE EARTH</small>
    </button>}

    {(phase === 'resolving' || phase === 'final') && <div className="eye-within-awakening" aria-hidden="true">
      <i /><i /><i /><span /><span /><span />
    </div>}

    {phase === 'final' && <div className="eye-within-final">
      <div className="eye-within-masthead" aria-label="EYEVERSE 眼界宇宙">
        <strong>EYEVERSE</strong>
        <span><i />眼界宇宙<i /></span>
      </div>
      <div className="eye-within-copy">
        <h1>在看见世界之前<br />先看见自己的眼睛</h1>
        <p>Before seeing the world,<br />see your vision.</p>
        <i className="eye-within-copy-rule" aria-hidden="true" />
      </div>
      <div className="eye-within-brand" aria-label="无锡太湖学院艺术学院与无锡爱尔眼科医院联合署名">
        <div className="eye-within-partner eye-within-partner--school">
          <img src={finaleVisuals.schoolLogo} alt="无锡太湖学院" />
          <span>无锡太湖学院艺术学院</span>
        </div>
        <i aria-hidden="true" />
        <div className="eye-within-partner eye-within-partner--aier">
          <img src={finaleVisuals.logo} alt="无锡爱尔眼科医院" />
          <span>无锡爱尔眼科医院</span>
        </div>
      </div>
      <div className="eye-within-signoff">
        <span>守护清晰视界　看见更大的世界</span>
        <small>A CLEARER WORLD　A BRIGHTER TOMORROW</small>
      </div>
    </div>}
  </section>;
});

TheEyeWithin.displayName = 'TheEyeWithin';

