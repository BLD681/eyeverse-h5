import { useEffect, useMemo, useRef, useState, type CSSProperties, type KeyboardEvent, type PointerEvent, type WheelEvent } from 'react';
import { dryEyeVisual } from '../config/visuals';
import { opticalAudio } from '../audio/OpticalAudio';

type DryEyePage = 'intro' | 'journey' | 'science';

type DryEyeStyle = CSSProperties & {
  '--dryness': string;
  '--restore': string;
  '--water-top': string;
  '--water-height': string;
  '--water-opacity': string;
  '--scene-brightness': string;
  '--scene-saturation': string;
  '--scene-contrast': string;
  '--dry-veil-opacity': string;
  '--restore-opacity': string;
  '--gloss-opacity': string;
  '--ripple-opacity': string;
  '--water-blur': string;
  '--water-loss-height': string;
  '--water-width': string;
  '--scene-sepia': string;
  '--earth-opacity': string;
  '--shore-opacity': string;
  '--texture-opacity': string;
  '--edge-opacity': string;
};

const stages = [
  { level: 0, number: '01', english: 'HEALTHY', chinese: '健康', description: '水润清澈，泪膜保持稳定。' },
  { level: 40, number: '02', english: 'FATIGUE', chinese: '疲劳', description: '水位轻降，水面开始变得安静。' },
  { level: 100, number: '03', english: 'DRY', chinese: '干涩', description: '湖面退去，灰黄湖缘逐渐显露。' },
  { level: 0, number: '04', english: 'RESTORE', chinese: '恢复', description: '水分回流，清澈与生命感逐步苏醒。' },
] as const;

const clamp = (value: number) => Math.max(0, Math.min(100, value));

export function DryEyeExperience({ onExit }: { onExit: (completed?: boolean) => void }) {
  const [page, setPage] = useState<DryEyePage>('intro');
  const [drynessLevel, setDrynessLevel] = useState(0);
  const [journeyDirection, setJourneyDirection] = useState<'drying' | 'restoring'>('drying');
  const [ready, setReady] = useState(false);
  const [failed, setFailed] = useState(false);
  const [dragging, setDragging] = useState(false);
  const root = useRef<HTMLElement>(null);
  const drag = useRef({ pointerId: -1, startY: 0, startLevel: 0, startDirection: 'drying' as 'drying' | 'restoring' });

  useEffect(() => () => {
    const pointerId = drag.current.pointerId;
    if (pointerId >= 0 && root.current?.hasPointerCapture(pointerId)) root.current.releasePointerCapture(pointerId);
    drag.current.pointerId = -1;
    opticalAudio.disposeScene('dryeye');
  }, []);

  const dryness = drynessLevel / 100;
  const restore = journeyDirection === 'restoring' ? 1 - dryness : 0;
  const stageIndex = journeyDirection === 'restoring' ? 3 : drynessLevel < 25 ? 0 : drynessLevel < 58 ? 1 : 2;
  const stage = stages[stageIndex];

  const visualStyle = useMemo<DryEyeStyle>(() => ({
    '--dryness': dryness.toFixed(3),
    '--restore': restore.toFixed(3),
    '--water-top': `${49 + dryness * 8}%`,
    '--water-height': `${13 - dryness * 8}%`,
    '--water-width': `${50 - dryness * 23}%`,
    '--water-opacity': `${0.74 - dryness * 0.57 + restore * 0.2}`,
    '--scene-brightness': `${1 - dryness * 0.23 + restore * 0.07}`,
    '--scene-saturation': `${1.08 - dryness * 0.48 + restore * 0.2}`,
    '--scene-contrast': `${1 + dryness * 0.07}`,
    '--scene-sepia': `${dryness * 0.2}`,
    '--dry-veil-opacity': `${dryness * 0.58}`,
    '--restore-opacity': `${restore * 0.68}`,
    '--gloss-opacity': `${0.52 - dryness * 0.44 + restore * 0.24}`,
    '--ripple-opacity': `${0.68 - dryness * 0.6 + restore * 0.3}`,
    '--water-blur': `${dryness * 1.4}px`,
    '--water-loss-height': `${dryness * 8}%`,
    '--earth-opacity': `${dryness * 0.56}`,
    '--shore-opacity': `${dryness * 0.72}`,
    '--texture-opacity': `${dryness * 0.26}`,
    '--edge-opacity': `${dryness * 0.46}`,
  }), [dryness, restore]);

  function startJourney() {
    setDrynessLevel(0);
    setJourneyDirection('drying');
    setPage('journey');
  }

  function goBack() {
    if (page === 'science') setPage('journey');
    else if (page === 'journey') setPage('intro');
    else onExit(false);
  }

  function beginDrag(event: PointerEvent<HTMLElement>) {
    if (page !== 'journey' || (event.target as HTMLElement).closest('button')) return;
    drag.current = {
      pointerId: event.pointerId,
      startY: event.clientY,
      startLevel: drynessLevel,
      startDirection: journeyDirection,
    };
    event.currentTarget.setPointerCapture(event.pointerId);
    setDragging(true);
  }

  function updateDrag(event: PointerEvent<HTMLElement>) {
    if (event.pointerId !== drag.current.pointerId) return;
    const travel = drag.current.startY - event.clientY;
    const next = clamp(drag.current.startLevel + (travel / window.innerHeight) * 92);
    setDrynessLevel(next);
    opticalAudio.setInteraction('dryeye', next);
    if (drag.current.startDirection === 'drying' && drag.current.startLevel >= 96 && travel < -16) {
      setJourneyDirection('restoring');
    }
    if (drag.current.startDirection === 'restoring' && travel > 16) {
      setJourneyDirection('drying');
    }
  }

  function finishDrag(event: PointerEvent<HTMLElement>) {
    if (event.pointerId !== drag.current.pointerId) return;
    const travel = drag.current.startY - event.clientY;
    const releasedLevel = clamp(drag.current.startLevel + (travel / window.innerHeight) * 92);
    drag.current.pointerId = -1;
    setDragging(false);
    if (drag.current.startDirection === 'restoring' && drag.current.startLevel <= 2 && travel < -54) {
      setPage('science');
      return;
    }
    if (drag.current.startDirection === 'drying' && drag.current.startLevel >= 96 && travel < -16) {
      setJourneyDirection('restoring');
    }
    setDrynessLevel(releasedLevel < 4 ? 0 : releasedLevel > 96 ? 100 : releasedLevel);
  }

  function handleWheel(event: WheelEvent<HTMLElement>) {
    if (page !== 'journey') return;
    event.preventDefault();
    if (journeyDirection === 'drying' && drynessLevel >= 96 && event.deltaY < 0) setJourneyDirection('restoring');
    if (journeyDirection === 'restoring' && event.deltaY > 0) setJourneyDirection('drying');
    setDrynessLevel(current => clamp(current + event.deltaY * 0.045));
  }

  function handleKey(event: KeyboardEvent<HTMLElement>) {
    if (page !== 'journey') return;
    if (event.key === 'ArrowDown' || event.key === 'PageDown') {
      event.preventDefault();
      if (journeyDirection === 'restoring') setJourneyDirection('drying');
      setDrynessLevel(current => clamp(current + 8));
    }
    if (event.key === 'ArrowUp' || event.key === 'PageUp') {
      event.preventDefault();
      if (drynessLevel >= 96) setJourneyDirection('restoring');
      setDrynessLevel(current => clamp(current - 8));
    }
    if (event.key === 'Home') { setJourneyDirection('drying'); setDrynessLevel(0); }
    if (event.key === 'End') { setJourneyDirection('drying'); setDrynessLevel(100); }
  }

  function selectStage(index: number) {
    opticalAudio.playPulse('water', .26);
    if (index === 3) {
      setJourneyDirection('restoring');
      setDrynessLevel(0);
      return;
    }
    setJourneyDirection('drying');
    setDrynessLevel(stages[index].level);
  }

  return <section
    ref={root}
    className={`dryeye dryeye--${page} ${ready ? 'is-ready' : ''} ${dragging ? 'is-dragging' : ''}`}
    style={visualStyle}
    aria-label="眼中的湖干眼专题"
    aria-busy={!ready && !failed}
    onPointerDown={beginDrag}
    onPointerMove={updateDrag}
    onPointerUp={finishDrag}
    onPointerCancel={() => { drag.current.pointerId = -1; setDragging(false); }}
    onWheel={handleWheel}
  >
    <div className="dryeye-scene" aria-hidden="true">
      <img
        className="dryeye-image"
        src={dryEyeVisual.src}
        alt=""
        fetchPriority="high"
        onLoad={async event => {
          try { await event.currentTarget.decode(); } catch {}
          setReady(true);
        }}
        onError={() => setFailed(true)}
      />
      <div className="dryeye-temperature" />
      <div className="dryeye-edge-contraction" />
      <div className="dryeye-dry-veil" />
      <div className="dryeye-earth-tone" />
      <div className="dryeye-shoreline-exposure" />
      <div className="dryeye-parched-texture" />
      <div className="dryeye-water-loss" />
      <div className="dryeye-water-sheen">
        <span /><span /><span />
      </div>
      <div className="dryeye-lake-gloss" />
      <div className="dryeye-restore-glow" />
      <div className="dryeye-restore-wave"><span /><span /></div>
    </div>

    <button className="dryeye-back" type="button" aria-label="返回" onClick={goBack}><span aria-hidden="true">‹</span></button>

    {page === 'intro' && <div className="dryeye-intro">
      <p className="dryeye-kicker">DRY EYE</p>
      <h1>眼中的湖</h1>
      <p className="dryeye-lead">一层稳定的泪膜，让每一次看见都保持清晰。</p>
      <button className="dryeye-enter" type="button" disabled={!ready} onClick={startJourney}>
        <span>进入水膜旅程</span><i aria-hidden="true">↑</i>
      </button>
    </div>}

    {page === 'journey' && <div
      className="dryeye-journey-ui"
      role="slider"
      tabIndex={0}
      aria-label="泪膜状态"
      aria-orientation="vertical"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(drynessLevel)}
      aria-valuetext={`${stage.chinese}状态`}
      onKeyDown={handleKey}
    >
      <header className="dryeye-journey-title">
        <span>DRY EYE</span>
        <strong>眼中的湖</strong>
      </header>

      <div className="dryeye-state-copy" aria-live="polite">
        <span>{stage.number} / 04</span>
        <p>{stage.english}</p>
        <h2>{stage.chinese}</h2>
        <small>{stage.description}</small>
      </div>

      <div className="dryeye-rail" aria-label="选择泪膜状态">
        <i style={{ height: `${drynessLevel}%` }} aria-hidden="true" />
        {stages.map((item, index) => <button
          key={item.english}
          type="button"
          className={index === stageIndex ? 'is-current' : ''}
          aria-label={`切换至${item.chinese}状态`}
          onClick={() => selectStage(index)}
        ><span /></button>)}
      </div>

      <p className="dryeye-swipe-hint">{
        journeyDirection === 'drying'
          ? drynessLevel >= 96 ? '向下滑动 · 让湖水重新回归' : '向上滑动 · 感受水分逐渐流失'
          : drynessLevel <= 3 ? '恢复完成 · 查看护眼提示' : '继续向下滑动 · 水分正在恢复'
      }</p>
      {journeyDirection === 'restoring' && drynessLevel <= 3 && <button className="dryeye-science-link" type="button" onClick={() => setPage('science')}>了解泪膜健康</button>}
    </div>}

    {page === 'science' && <article className="dryeye-science">
      <p className="dryeye-kicker">TEAR FILM CARE</p>
      <h1>让眼中的湖<br />保持清澈</h1>
      <div className="dryeye-science-copy">
        <section><span>01</span><div><h2>稳定的泪膜</h2><p>干眼不适常与泪膜稳定性变化有关。</p></div></section>
        <section><span>02</span><div><h2>留意用眼环境</h2><p>长时间用眼、环境因素与眨眼减少，都可能带来不适。</p></div></section>
        <section><span>03</span><div><h2>给眼睛恢复时间</h2><p>主动眨眼、合理休息；持续不适时，建议进行专业检查。</p></div></section>
      </div>
      <button className="dryeye-finish" type="button" onClick={() => onExit(true)}>返回视觉之门</button>
    </article>}

    {!ready && !failed && <p className="load-state" role="status">正在注入水光…</p>}
    {failed && <div className="load-state" role="alert"><p>视觉素材加载失败</p><button onClick={() => location.reload()}>重新加载</button></div>}
  </section>;
}
