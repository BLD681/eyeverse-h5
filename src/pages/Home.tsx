import { useEffect, useState, type CSSProperties } from 'react';
import { finaleVisuals, homeVisual } from '../config/visuals';
import { GlassButton } from '../components/GlassButton';
import { AmbientParticles } from '../components/AmbientParticles';

export function Home({ exiting, introSeen, onAwakened, onEnter }: {
  exiting: boolean;
  introSeen: boolean;
  onAwakened: () => void;
  onEnter: () => void;
}) {
  const [ready, setReady] = useState(false);
  const [failed, setFailed] = useState(false);
  const [interactive, setInteractive] = useState(introSeen);

  useEffect(() => {
    if (!ready || introSeen) {
      if (ready && introSeen) setInteractive(true);
      return;
    }
    const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
    const timer = window.setTimeout(() => {
      setInteractive(true);
      onAwakened();
    }, reduced ? 50 : 5000);
    return () => window.clearTimeout(timer);
  }, [introSeen, onAwakened, ready]);

  return <section aria-label="眼界宇宙首页" aria-busy={!ready && !failed}
    className={`home ${ready ? 'is-ready' : ''} ${introSeen ? 'is-returning' : 'is-awakening'} ${exiting ? 'is-exiting' : ''}`}
    style={{ '--pupil-x': homeVisual.pupil.x, '--pupil-y': homeVisual.pupil.y } as CSSProperties}>
    <div className="scene" aria-hidden="true">
      <img className="hero-image" src={homeVisual.src} alt="" fetchPriority="high"
        onLoad={async event => { const img = event.currentTarget; try { await img.decode(); } catch {} setReady(true); }}
        onError={() => setFailed(true)} />
      <div className="iris-dim" />
      <div className="optical-lid optical-lid--top" />
      <div className="optical-lid optical-lid--bottom" />
      <div className="orbit-flow orbit-flow--outer" />
      <div className="orbit-flow orbit-flow--inner" />
      <div className="optical-breath" />
      <div className="focus-ring" />
      <div className="pupil-flare" />
    </div>
    <AmbientParticles />
    <div className="depth-vignette" aria-hidden="true" />
    <div className="tunnel-light" aria-hidden="true" />
    <header className="home-title">
      <h1>EYEVERSE</h1>
      <p>眼界宇宙</p>
    </header>
    <div className="home-action">
      <GlassButton disabled={!ready || !interactive || exiting} onClick={onEnter}>开始探索</GlassButton>
      <img className="home-brand-logo" src={finaleVisuals.logo} alt="爱尔眼科" draggable={false} />
    </div>
    {!ready && !failed && <p className="load-state" role="status">正在开启眼界…</p>}
    {failed && <div className="load-state" role="alert"><p>视觉素材加载失败</p><button onClick={() => location.reload()}>重新加载</button></div>}
  </section>;
}
