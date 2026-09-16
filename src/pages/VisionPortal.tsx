import { useEffect, useRef, useState, type CSSProperties } from 'react';
import { portalThemes, type PortalTheme } from '../config/themes';
import { portalVisual } from '../config/visuals';

type PortalStyle = CSSProperties & {
  '--active-x'?: string;
  '--active-y'?: string;
  '--completion-x'?: string;
  '--completion-y'?: string;
  '--node-delay'?: string;
};

export function VisionPortal({ active = true, arrivalMode = 'default', completedThemes, recentCompletion, coreReady, coreLoadingFailed, onBack, onOpenTheme, onEnterCore }: {
  active?: boolean;
  arrivalMode?: 'default' | 'from-home' | 'from-topic';
  completedThemes: readonly PortalTheme['id'][];
  recentCompletion: PortalTheme['id'] | null;
  coreReady: boolean;
  coreLoadingFailed: boolean;
  onBack: () => void;
  onOpenTheme: (theme: PortalTheme['id']) => Promise<boolean>;
  onEnterCore: () => void;
}) {
  const heading = useRef<HTMLHeadingElement>(null);
  const [ready, setReady] = useState(false);
  const [failed, setFailed] = useState(false);
  const [selected, setSelected] = useState<PortalTheme | null>(null);
  const selecting = useRef(false);

  useEffect(() => {
    if (active) heading.current?.focus();
  }, [active]);

  async function chooseTheme(theme: PortalTheme) {
    if (selected?.id === theme.id || selecting.current) return;
    selecting.current = true;
    setSelected(theme);
    const opened = await onOpenTheme(theme.id);
    if (!opened) setSelected(null);
    selecting.current = false;
  }

  const completed = new Set(completedThemes);
  const completedCount = completed.size;
  const evolved = completedCount === portalThemes.length;
  const completionTheme = portalThemes.find(theme => theme.id === recentCompletion);
  const portalStyle: PortalStyle = {
    ...(selected ? { '--active-x': `${selected.position.x}%`, '--active-y': `${selected.position.y}%` } : {}),
    ...(completionTheme ? { '--completion-x': `${completionTheme.position.x}%`, '--completion-y': `${completionTheme.position.y}%` } : {}),
  };

  return <section
    className={`portal portal--${arrivalMode} ${ready ? 'is-ready' : ''} ${selected ? 'has-selection' : ''} ${recentCompletion ? 'has-completion' : ''} ${evolved ? 'is-evolved' : ''}`}
    style={portalStyle}
    aria-label="视觉之门"
    aria-busy={!ready && !failed}
  >
    <div className="portal-stage">
      <div className="portal-visual" aria-hidden="true">
        <img
          className="portal-image"
          src={portalVisual.src}
          alt=""
          fetchPriority="high"
          onLoad={event => {
            const image = event.currentTarget;
            if (typeof image.decode === 'function') void image.decode().catch(() => {});
            setReady(true);
          }}
          onError={() => setFailed(true)}
        />
        <div className="portal-core-reveal">
          <img src={portalVisual.src} alt="" />
        </div>
        <div className="portal-core-pulse" />
        <div className="portal-selection-light" />
        {recentCompletion && !evolved && <div className="portal-energy-transfer"><i /><span /></div>}
        {recentCompletion && evolved && <div className="portal-evolution">
          {portalThemes.map(theme => <i key={theme.id} style={{ '--completion-x': `${theme.position.x}%`, '--completion-y': `${theme.position.y}%` } as PortalStyle} />)}
        </div>}
      </div>

      <button className="portal-back" type="button" onClick={onBack} aria-label="返回首页">
        <span aria-hidden="true">‹</span>
      </button>

      <header className="portal-title">
        <p>EYEVERSE</p>
        <h1 ref={heading} tabIndex={-1}>视觉之门</h1>
      </header>

      <div className="portal-core-label" aria-hidden="true">
        <span>VISION CORE</span>
        <small>{selected ? `连接至 ${selected.chinese}` : evolved ? '视觉核心已开启' : '视觉核心'}</small>
      </div>

      <nav className="portal-nodes" aria-label="眼健康主题">
        {portalThemes.map(theme => {
          const nodeStyle: PortalStyle = { '--node-delay': theme.delay };
          const isSelected = selected?.id === theme.id;
          const isComplete = completed.has(theme.id);
          return <button
            key={theme.id}
            type="button"
            className={`portal-node ${theme.className} ${isSelected ? 'is-selected' : ''} ${isComplete ? 'is-complete' : ''}`}
            style={nodeStyle}
            aria-pressed={isSelected}
            aria-label={`${theme.english}，${theme.chinese}`}
            onClick={() => { void chooseTheme(theme); }}
          >
            <span className="portal-node-float">
              <span className="portal-node-label">
                <span>{theme.english}</span>
                <strong>{theme.chinese}</strong>
                <i aria-hidden="true" />
              </span>
              {isComplete && <span className="portal-node-state" aria-hidden="true"><i />COMPLETE</span>}
            </span>
          </button>;
        })}
      </nav>
    </div>

    {evolved && <button className="portal-core-entry" type="button" onClick={onEnterCore} disabled={!coreReady}>
      <span>{coreLoadingFailed ? 'VIDEO UNAVAILABLE' : coreReady ? 'ENTER THE EYE WITHIN' : 'PREPARING THE JOURNEY'}</span><i aria-hidden="true">→</i>
    </button>}

    <div className="portal-progress" aria-label={`探索进度 ${completedCount} / ${portalThemes.length}`}>
      <small>EXPLORE&nbsp;&nbsp;{String(completedCount).padStart(2, '0')} / 04</small>
      <span aria-hidden="true">{portalThemes.map(theme => <i key={theme.id} className={completed.has(theme.id) ? 'is-complete' : ''} />)}</span>
    </div>

    <p className="portal-status" aria-live="polite">
      {selected ? `正在进入${selected.chinese}` : ''}
    </p>
    {!ready && !failed && <p className="load-state" role="status">正在构建视觉空间…</p>}
    {failed && <div className="load-state" role="alert"><p>视觉素材加载失败</p><button onClick={() => location.reload()}>重新加载</button></div>}
  </section>;
}
