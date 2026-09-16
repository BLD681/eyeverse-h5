import { useEffect, useMemo, useRef, useState, type CSSProperties, type KeyboardEvent, type PointerEvent, type WheelEvent } from 'react';
import { timeMirrorVisual } from '../config/visuals';
import { opticalAudio } from '../audio/OpticalAudio';

type TimePage = 'intro' | 'journey' | 'care';
type TimeStyle = CSSProperties & {
  '--time': string;
  '--time-percent': string;
  '--warmth': string;
  '--trace-opacity': string;
  '--balance': string;
  '--orbit-duration-a': string;
  '--orbit-duration-b': string;
  '--orbit-shift': string;
  '--mirror-brightness': string;
};

const stages = [
  { level: 0, number: '01', english: 'FRESH', chinese: '清新', description: '银白光线保持清透，镜面处于舒展状态。' },
  { level: 48, number: '02', english: 'TIME TRACE', chinese: '时间痕迹', description: '暖金纹理逐渐显现，时间被温和地记录。' },
  { level: 100, number: '03', english: 'BALANCE', chinese: '平衡恢复', description: '蓝与金重新稳定，状态回到从容与平衡。' },
] as const;

const clamp = (value: number) => Math.max(0, Math.min(100, value));

export function TimeMirrorExperience({ onExit }: { onExit: (completed?: boolean) => void }) {
  const [page, setPage] = useState<TimePage>('intro');
  const [timeLevel, setTimeLevel] = useState(0);
  const [ready, setReady] = useState(false);
  const [failed, setFailed] = useState(false);
  const [dragging, setDragging] = useState(false);
  const root = useRef<HTMLElement>(null);
  const drag = useRef({ pointerId: -1, startX: 0, startLevel: 0, extent: 1 });
  const updateFrame = useRef<number | undefined>(undefined);
  const pendingLevel = useRef(0);

  useEffect(() => () => {
    cancelAnimationFrame(updateFrame.current ?? 0);
    updateFrame.current = undefined;
    const pointerId = drag.current.pointerId;
    if (pointerId >= 0 && root.current?.hasPointerCapture(pointerId)) root.current.releasePointerCapture(pointerId);
    drag.current.pointerId = -1;
    opticalAudio.disposeScene('time');
  }, []);

  function scheduleTimeLevel(next: number) {
    pendingLevel.current = next;
    opticalAudio.setInteraction('time', next);
    if (updateFrame.current !== undefined) return;
    updateFrame.current = requestAnimationFrame(() => {
      updateFrame.current = undefined;
      setTimeLevel(pendingLevel.current);
    });
  }

  const time = timeLevel / 100;
  const warmth = Math.min(1, time / .7);
  const balance = Math.max(0, (time - .68) / .32);
  const trace = time < .68 ? time / .68 : 1 - (time - .68) / .32 * .48;
  const stageIndex = timeLevel < 28 ? 0 : timeLevel < 78 ? 1 : 2;
  const stage = stages[stageIndex];

  const visualStyle = useMemo<TimeStyle>(() => ({
    '--time': time.toFixed(3),
    '--time-percent': `${timeLevel.toFixed(1)}%`,
    '--warmth': warmth.toFixed(3),
    '--trace-opacity': `${trace * .62}`,
    '--balance': balance.toFixed(3),
    '--orbit-duration-a': `${18 - time * 5 + balance * 4}s`,
    '--orbit-duration-b': `${23 - time * 6 + balance * 5}s`,
    '--orbit-shift': `${time * 8 - balance * 4}deg`,
    '--mirror-brightness': `${.92 + time * .1 + balance * .08}`,
  }), [balance, time, timeLevel, trace, warmth]);

  function startJourney() {
    setTimeLevel(0);
    setPage('journey');
  }

  function goBack() {
    if (page === 'care') setPage('journey');
    else if (page === 'journey') setPage('intro');
    else onExit(false);
  }

  function beginDrag(event: PointerEvent<HTMLElement>) {
    if (page !== 'journey' || (event.target as HTMLElement).closest('button')) return;
    drag.current = { pointerId: event.pointerId, startX: event.clientX, startLevel: timeLevel, extent: event.currentTarget.getBoundingClientRect().width };
    event.currentTarget.setPointerCapture(event.pointerId);
    setDragging(true);
  }

  function updateDrag(event: PointerEvent<HTMLElement>) {
    if (event.pointerId !== drag.current.pointerId) return;
    const travel = event.clientX - drag.current.startX;
    scheduleTimeLevel(clamp(drag.current.startLevel + travel / drag.current.extent * 108));
  }

  function finishDrag(event: PointerEvent<HTMLElement>) {
    if (event.pointerId !== drag.current.pointerId) return;
    const travel = event.clientX - drag.current.startX;
    const next = clamp(drag.current.startLevel + travel / drag.current.extent * 108);
    cancelAnimationFrame(updateFrame.current ?? 0);
    updateFrame.current = undefined;
    drag.current.pointerId = -1;
    setDragging(false);
    setTimeLevel(next < 4 ? 0 : next > 96 ? 100 : next);
  }

  function handleWheel(event: WheelEvent<HTMLElement>) {
    if (page !== 'journey') return;
    event.preventDefault();
    const delta = Math.abs(event.deltaX) > Math.abs(event.deltaY) ? event.deltaX : event.deltaY;
    setTimeLevel(current => clamp(current + delta * .045));
  }

  function handleKey(event: KeyboardEvent<HTMLElement>) {
    if (page !== 'journey') return;
    if (event.key === 'ArrowRight' || event.key === 'PageDown') { event.preventDefault(); setTimeLevel(current => clamp(current + 8)); }
    if (event.key === 'ArrowLeft' || event.key === 'PageUp') { event.preventDefault(); setTimeLevel(current => clamp(current - 8)); }
    if (event.key === 'Home') setTimeLevel(0);
    if (event.key === 'End') setTimeLevel(100);
  }

  return <section ref={root} className={`time-mirror time-mirror--${page} ${ready ? 'is-ready' : ''} ${dragging ? 'is-dragging' : ''}`}
    style={visualStyle} aria-label="时间之镜眼周健康专题" aria-busy={!ready && !failed}
    onPointerDown={beginDrag} onPointerMove={updateDrag} onPointerUp={finishDrag}
    onPointerCancel={() => { drag.current.pointerId = -1; setDragging(false); }} onWheel={handleWheel}>
    <div className="time-scene" aria-hidden="true">
      <img className="time-image time-image--base" src={timeMirrorVisual.src} alt="" fetchPriority="high"
        onLoad={async event => { try { await event.currentTarget.decode(); } catch {} setReady(true); }}
        onError={() => setFailed(true)} />
      <img className="time-image time-image--warm" src={timeMirrorVisual.src} alt="" />
      <div className="time-orbits time-orbits--a"><i /><i /></div>
      <div className="time-orbits time-orbits--b"><i /><i /></div>
      <div className="time-texture"><span /><span /><span /></div>
      <div className="time-hand"><i /></div>
      <div className="time-balance-wave"><span /><span /></div>
      <div className="time-vignette" />
    </div>

    <button className="time-back" type="button" aria-label="返回" onClick={goBack}><span aria-hidden="true">‹</span></button>

    {page === 'intro' && <div className="time-intro">
      <p className="time-kicker">TIME MIRROR</p>
      <h1>时间之镜</h1>
      <p className="time-lead">时间留下痕迹，也给眼周重新回到平衡的机会。</p>
      <button className="time-enter" type="button" disabled={!ready} onClick={startJourney}><span>进入时间轨迹</span><i aria-hidden="true">→</i></button>
      <small>左右滑动，让时间在镜中流动</small>
    </div>}

    {page === 'journey' && <div className="time-journey-ui" role="slider" tabIndex={0}
      aria-label="眼周时间状态" aria-orientation="horizontal" aria-valuemin={0} aria-valuemax={100}
      aria-valuenow={Math.round(timeLevel)} aria-valuetext={`${stage.chinese}状态`} onKeyDown={handleKey}>
      <header className="time-journey-title"><span>TIME MIRROR</span><strong>时间之镜</strong></header>
      <div className="time-state-copy" aria-live="polite">
        <span>{stage.number} / 03</span><p>{stage.english}</p><h2>{stage.chinese}</h2><small>{stage.description}</small>
      </div>
      <div className="time-rail" aria-label="选择时间状态">
        <i style={{ width: `${timeLevel}%` }} aria-hidden="true" />
        {stages.map((item, index) => <button key={item.english} type="button" className={index === stageIndex ? 'is-current' : ''}
          aria-label={`切换至${item.chinese}状态`} onClick={() => { setTimeLevel(item.level); opticalAudio.setInteraction('time', item.level); opticalAudio.playPulse('time', .28); }}><span /></button>)}
      </div>
      <p className="time-swipe-hint">{timeLevel < 96 ? '向右滑动 · 看见时间留下的变化' : '平衡已恢复 · 继续了解眼周健康'}</p>
      {timeLevel >= 96 && <button className="time-care-link" type="button" onClick={() => setPage('care')}>查看平衡建议</button>}
    </div>}

    {page === 'care' && <article className="time-care">
      <p className="time-kicker">PERIOCULAR CARE</p>
      <h1>与时间<br />温和相处</h1>
      <p className="time-care-lead">眼周状态会随日常节律改变。稳定的照护，比追赶时间更重要。</p>
      <div className="time-care-cards">
        <section><span>01</span><div><h2>规律休息</h2><p>保证睡眠与视觉休息，减少长时间连续用眼带来的疲惫感。</p></div></section>
        <section><span>02</span><div><h2>温和保护</h2><p>重视日常防晒与温和清洁，避免反复揉眼和过度刺激眼周。</p></div></section>
        <section><span>03</span><div><h2>关注变化</h2><p>持续肿胀、疼痛或其他异常变化时，建议及时进行专业检查。</p></div></section>
      </div>
      <button className="time-finish" type="button" onClick={() => onExit(true)}>返回视觉之门</button>
    </article>}

    {!ready && !failed && <p className="load-state" role="status">正在校准时间轨道…</p>}
    {failed && <div className="load-state" role="alert"><p>视觉素材加载失败</p><button onClick={() => location.reload()}>重新加载</button></div>}
  </section>;
}
