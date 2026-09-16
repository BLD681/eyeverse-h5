import { useEffect, useMemo, useRef, useState, type CSSProperties, type KeyboardEvent, type PointerEvent, type WheelEvent } from 'react';
import { focusVisual } from '../config/visuals';
import { opticalAudio } from '../audio/OpticalAudio';

type RefractionPage = 'intro' | 'journey' | 'science';
type Direction = 'defocusing' | 'refocusing';

type RefractionStyle = CSSProperties & {
  '--focus-level': string;
  '--scene-blur': string;
  '--scene-brightness': string;
  '--scene-contrast': string;
  '--scene-saturation': string;
  '--sharp-opacity': string;
  '--focus-aperture': string;
  '--ghost-opacity': string;
  '--ghost-offset': string;
  '--bloom-opacity': string;
  '--streak-opacity': string;
  '--ring-opacity': string;
  '--refocus-opacity': string;
};

const stages = [
  { level: 0, number: '01', english: 'CLEAR', chinese: '清晰', description: '焦点稳定，远近结构保持清楚。' },
  { level: 38, number: '02', english: 'MILD BLUR', chinese: '轻度失焦', description: '远景开始变软，中央仍相对清楚。' },
  { level: 68, number: '03', english: 'STRONG BLUR', chinese: '明显失焦', description: '轮廓与层次减弱，焦点逐渐偏离。' },
  { level: 100, number: '04', english: 'ASTIGMATIC FEEL', chinese: '散光感', description: '高亮出现克制的重影与方向性拖影。' },
  { level: 0, number: '05', english: 'REFOCUS', chinese: '重新聚焦', description: '光晕退去，焦点重新回到视野中央。' },
] as const;

const clamp = (value: number) => Math.max(0, Math.min(100, value));

export function RefractionExperience({ onExit }: { onExit: (completed?: boolean) => void }) {
  const [page, setPage] = useState<RefractionPage>('intro');
  const [focusLevel, setFocusLevel] = useState(0);
  const [direction, setDirection] = useState<Direction>('defocusing');
  const [ready, setReady] = useState(false);
  const [failed, setFailed] = useState(false);
  const [dragging, setDragging] = useState(false);
  const root = useRef<HTMLElement>(null);
  const drag = useRef({ pointerId: -1, startX: 0, startLevel: 0, extent: 1, startDirection: 'defocusing' as Direction });
  const updateFrame = useRef<number | undefined>(undefined);
  const pendingLevel = useRef(0);

  useEffect(() => () => {
    cancelAnimationFrame(updateFrame.current ?? 0);
    updateFrame.current = undefined;
    const pointerId = drag.current.pointerId;
    if (pointerId >= 0 && root.current?.hasPointerCapture(pointerId)) root.current.releasePointerCapture(pointerId);
    drag.current.pointerId = -1;
    opticalAudio.disposeScene('refraction');
  }, []);

  function scheduleFocusLevel(next: number) {
    pendingLevel.current = next;
    opticalAudio.setInteraction('refraction', next);
    if (updateFrame.current !== undefined) return;
    updateFrame.current = requestAnimationFrame(() => {
      updateFrame.current = undefined;
      setFocusLevel(pendingLevel.current);
    });
  }

  const defocus = focusLevel / 100;
  const astigmatism = Math.max(0, (defocus - .68) / .32);
  const refocus = direction === 'refocusing' ? 1 - defocus : 0;
  const stageIndex = direction === 'refocusing' ? 4 : focusLevel < 25 ? 0 : focusLevel < 52 ? 1 : focusLevel < 82 ? 2 : 3;
  const stage = stages[stageIndex];

  const visualStyle = useMemo<RefractionStyle>(() => ({
    '--focus-level': defocus.toFixed(3),
    '--scene-blur': `${(defocus * 4.6).toFixed(2)}px`,
    '--scene-brightness': `${1 - defocus * .09 + refocus * .025}`,
    '--scene-contrast': `${1.04 - defocus * .2 + refocus * .05}`,
    '--scene-saturation': `${1.06 - defocus * .18 + refocus * .07}`,
    '--sharp-opacity': `${Math.max(.1, 1 - defocus * .9)}`,
    '--focus-aperture': `${42 - defocus * 27}%`,
    '--ghost-opacity': `${astigmatism * .23}`,
    '--ghost-offset': `${(astigmatism * 7.5).toFixed(2)}px`,
    '--bloom-opacity': `${.1 + defocus * .23}`,
    '--streak-opacity': `${astigmatism * .3}`,
    '--ring-opacity': `${.22 + (1 - Math.abs(defocus - .5) * 2) * .2}`,
    '--refocus-opacity': `${refocus * .62}`,
  }), [astigmatism, defocus, refocus]);

  function startJourney() {
    setFocusLevel(0);
    setDirection('defocusing');
    setPage('journey');
  }

  function goBack() {
    if (page === 'science') setPage('journey');
    else if (page === 'journey') setPage('intro');
    else onExit(false);
  }

  function beginDrag(event: PointerEvent<HTMLElement>) {
    if (page !== 'journey' || (event.target as HTMLElement).closest('button')) return;
    drag.current = { pointerId: event.pointerId, startX: event.clientX, startLevel: focusLevel, extent: event.currentTarget.getBoundingClientRect().width, startDirection: direction };
    event.currentTarget.setPointerCapture(event.pointerId);
    setDragging(true);
  }

  function updateDrag(event: PointerEvent<HTMLElement>) {
    if (event.pointerId !== drag.current.pointerId) return;
    const travel = drag.current.startX - event.clientX;
    const next = clamp(drag.current.startLevel + (travel / drag.current.extent) * 112);
    scheduleFocusLevel(next);
    if (drag.current.startDirection === 'defocusing' && drag.current.startLevel >= 96 && travel < -14) setDirection('refocusing');
    if (drag.current.startDirection === 'refocusing' && travel > 14) setDirection('defocusing');
  }

  function finishDrag(event: PointerEvent<HTMLElement>) {
    if (event.pointerId !== drag.current.pointerId) return;
    const travel = drag.current.startX - event.clientX;
    const next = clamp(drag.current.startLevel + (travel / drag.current.extent) * 112);
    cancelAnimationFrame(updateFrame.current ?? 0);
    updateFrame.current = undefined;
    drag.current.pointerId = -1;
    setDragging(false);
    if (drag.current.startDirection === 'defocusing' && drag.current.startLevel >= 96 && travel < -14) setDirection('refocusing');
    setFocusLevel(next < 4 ? 0 : next > 96 ? 100 : next);
  }

  function handleWheel(event: WheelEvent<HTMLElement>) {
    if (page !== 'journey') return;
    event.preventDefault();
    const delta = Math.abs(event.deltaX) > Math.abs(event.deltaY) ? event.deltaX : event.deltaY;
    if (direction === 'defocusing' && focusLevel >= 96 && delta < 0) setDirection('refocusing');
    if (direction === 'refocusing' && delta > 0) setDirection('defocusing');
    setFocusLevel(current => clamp(current + delta * .045));
  }

  function handleKey(event: KeyboardEvent<HTMLElement>) {
    if (page !== 'journey') return;
    if (event.key === 'ArrowRight' || event.key === 'PageDown') {
      event.preventDefault();
      if (focusLevel >= 96) setDirection('refocusing');
      setFocusLevel(current => direction === 'refocusing' ? clamp(current - 8) : clamp(current + 8));
    }
    if (event.key === 'ArrowLeft' || event.key === 'PageUp') {
      event.preventDefault();
      if (direction === 'refocusing') setDirection('defocusing');
      setFocusLevel(current => clamp(current - 8));
    }
    if (event.key === 'Home') { setDirection('defocusing'); setFocusLevel(0); }
    if (event.key === 'End') { setDirection('defocusing'); setFocusLevel(100); }
  }

  function selectStage(index: number) {
    opticalAudio.playPulse('focus', .32);
    if (index === 4) {
      setDirection('refocusing');
      setFocusLevel(0);
      return;
    }
    setDirection('defocusing');
    setFocusLevel(stages[index].level);
  }

  return <section
    ref={root}
    className={`refraction refraction--${page} ${ready ? 'is-ready' : ''} ${dragging ? 'is-dragging' : ''}`}
    style={visualStyle}
    aria-label="失焦世界屈光专题"
    aria-busy={!ready && !failed}
    onPointerDown={beginDrag}
    onPointerMove={updateDrag}
    onPointerUp={finishDrag}
    onPointerCancel={() => { drag.current.pointerId = -1; setDragging(false); }}
    onWheel={handleWheel}
  >
    <div className="refraction-scene" aria-hidden="true">
      <img className="refraction-image refraction-image--base" src={focusVisual.src} alt="" fetchPriority="high" onLoad={async event => {
        try { await event.currentTarget.decode(); } catch {}
        setReady(true);
      }} onError={() => setFailed(true)} />
      <img className="refraction-image refraction-image--sharp" src={focusVisual.src} alt="" />
      <img className="refraction-image refraction-image--ghost refraction-image--ghost-a" src={focusVisual.src} alt="" />
      <div className="refraction-bloom" />
      <div className="refraction-streaks" />
      <div className="refraction-focus-ring"><span /><i /></div>
      <div className="refraction-refocus-wave"><span /><span /></div>
      <div className="refraction-vignette" />
    </div>

    <button className="refraction-back" type="button" aria-label="返回" onClick={goBack}><span aria-hidden="true">‹</span></button>

    {page === 'intro' && <div className="refraction-intro">
      <p className="refraction-kicker">REFRACTION</p>
      <h1>失焦世界</h1>
      <p className="refraction-lead">当焦点偏离视网膜，熟悉的世界会以另一种方式抵达眼睛。</p>
      <button className="refraction-enter" type="button" disabled={!ready} onClick={startJourney}>
        <span>进入焦距体验</span><i aria-hidden="true">↔</i>
      </button>
      <small>左右滑动，调整焦距</small>
    </div>}

    {page === 'journey' && <div className="refraction-journey-ui" role="slider" tabIndex={0}
      aria-label="焦距状态" aria-orientation="horizontal" aria-valuemin={0} aria-valuemax={100}
      aria-valuenow={Math.round(focusLevel)} aria-valuetext={`${stage.chinese}状态`} onKeyDown={handleKey}>
      <header className="refraction-journey-title"><span>REFRACTION</span><strong>失焦世界</strong></header>
      <div className="refraction-state-copy" aria-live="polite">
        <span>{stage.number} / 05</span><p>{stage.english}</p><h2>{stage.chinese}</h2><small>{stage.description}</small>
      </div>
      <div className="refraction-rail" aria-label="选择焦距状态">
        <i style={{ width: `${focusLevel}%` }} aria-hidden="true" />
        {stages.map((item, index) => <button key={item.english} type="button" className={index === stageIndex ? 'is-current' : ''}
          aria-label={`切换至${item.chinese}状态`} onClick={() => selectStage(index)}><span /></button>)}
      </div>
      <p className="refraction-swipe-hint">{direction === 'defocusing'
        ? focusLevel >= 96 ? '向右滑动 · 重新找回焦点' : '向左滑动 · 让焦点逐渐偏移'
        : focusLevel <= 3 ? '聚焦完成 · 查看屈光提示' : '继续向右滑动 · 焦点正在恢复'}</p>
      {direction === 'refocusing' && focusLevel <= 3 && <button className="refraction-science-link" type="button" onClick={() => setPage('science')}>了解屈光健康</button>}
    </div>}

    {page === 'science' && <article className="refraction-science">
      <p className="refraction-kicker">REFRACTIVE CARE</p>
      <h1>让焦点<br />回到正确位置</h1>
      <div className="refraction-science-copy">
        <section><span>01</span><div><h2>焦点影响视觉质量</h2><p>近视、远视和散光都可能改变光线在眼内的聚焦方式。</p></div></section>
        <section><span>02</span><div><h2>留意视觉信号</h2><p>看远或看近不适、边缘重影与灯光发散，都可能提示焦点发生偏移。</p></div></section>
        <section><span>03</span><div><h2>用检查确认状态</h2><p>出现持续不适时及时检查，不只依赖主观感觉判断视力状况。</p></div></section>
      </div>
      <button className="refraction-finish" type="button" onClick={() => onExit(true)}>返回视觉之门</button>
    </article>}

    {!ready && !failed && <p className="load-state" role="status">正在校准焦点…</p>}
    {failed && <div className="load-state" role="alert"><p>视觉素材加载失败</p><button onClick={() => location.reload()}>重新加载</button></div>}
  </section>;
}
