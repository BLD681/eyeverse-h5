import { useEffect, useMemo, useRef, useState, type CSSProperties, type KeyboardEvent, type PointerEvent } from 'react';
import { archiveVisual } from '../config/visuals';
import { opticalAudio } from '../audio/OpticalAudio';

type ArchivePage = 'intro' | 'scan' | 'result';
type ScanState = 'idle' | 'scanning' | 'sealing' | 'complete';

type ArchiveStyle = CSSProperties & {
  '--scan-progress': string;
  '--scan-percent': string;
  '--scan-y': string;
  '--activation': string;
  '--lens-spread': string;
  '--ring-spread': string;
  '--lens-scale': string;
  '--core-glow': string;
  '--trace-opacity': string;
};

const SCAN_DURATION = 3600;
const clamp = (value: number) => Math.max(0, Math.min(100, value));

function haptic(pattern: number | number[]) {
  if ('vibrate' in navigator && typeof navigator.vibrate === 'function') navigator.vibrate(pattern);
}

export function VisionArchiveExperience({ onExit }: { onExit: (completed?: boolean) => void }) {
  const [page, setPage] = useState<ArchivePage>('intro');
  const [scanState, setScanState] = useState<ScanState>('idle');
  const [scanProgress, setScanProgress] = useState(0);
  const [ready, setReady] = useState(false);
  const [failed, setFailed] = useState(false);
  const frame = useRef<number | undefined>(undefined);
  const completionTimer = useRef<number | undefined>(undefined);
  const lastProgressPaint = useRef(0);
  const hapticStage = useRef(0);
  const holdButton = useRef<HTMLButtonElement>(null);
  const press = useRef({ active: false, startedAt: 0, startProgress: 0, pointerId: -1 });

  useEffect(() => () => {
    press.current.active = false;
    cancelAnimationFrame(frame.current ?? 0);
    frame.current = undefined;
    window.clearTimeout(completionTimer.current);
    const pointerId = press.current.pointerId;
    if (pointerId >= 0 && holdButton.current?.hasPointerCapture(pointerId)) holdButton.current.releasePointerCapture(pointerId);
    press.current.pointerId = -1;
    haptic(0);
    opticalAudio.disposeScene('archive');
  }, []);

  const progress = scanProgress / 100;
  const activation = Math.min(1, progress / .18);
  const lensSpread = progress < .72
    ? Math.sin((progress / .72) * Math.PI / 2) * 19
    : Math.max(0, (1 - (progress - .72) / .28) * 19);
  const scanning = Math.max(0, Math.min(1, (progress - .12) / .76));

  const visualStyle = useMemo<ArchiveStyle>(() => ({
    '--scan-progress': progress.toFixed(3),
    '--scan-percent': `${scanProgress.toFixed(1)}%`,
    '--scan-y': `${24 + scanning * 53}%`,
    '--activation': activation.toFixed(3),
    '--lens-spread': `${lensSpread.toFixed(2)}px`,
    '--ring-spread': `${(lensSpread * .58).toFixed(2)}px`,
    '--lens-scale': `${1 + lensSpread / 620}`,
    '--core-glow': `${.15 + progress * .7}`,
    '--trace-opacity': `${Math.sin(progress * Math.PI) * .48}`,
  }), [activation, lensSpread, progress, scanProgress, scanning]);

  const scanLabel = scanProgress < 12 ? '正在唤醒光学核心'
    : scanProgress < 46 ? '正在展开镜片层'
      : scanProgress < 78 ? '正在记录视觉信号'
        : scanProgress < 100 ? '正在封存视觉档案' : '视觉档案已生成';

  function finishScan() {
    press.current.active = false;
    opticalAudio.stopArchiveScan(.18);
    setScanProgress(100);
    setScanState('sealing');
    opticalAudio.playPulse('scan', .42);
    haptic([12, 34, 16]);
    completionTimer.current = window.setTimeout(() => {
      setScanState('complete');
      completionTimer.current = window.setTimeout(() => setPage('result'), 620);
    }, matchMedia('(prefers-reduced-motion: reduce)').matches ? 80 : 720);
  }

  function tick(now: number) {
    if (!press.current.active) return;
    const elapsed = now - press.current.startedAt;
    const next = clamp(press.current.startProgress + elapsed / SCAN_DURATION * 100);
    if (now - lastProgressPaint.current >= 32) {
      lastProgressPaint.current = now;
      setScanProgress(next);
      opticalAudio.setInteraction('archive', next);
      const nextStage = Math.min(3, Math.floor(next / 25));
      if (nextStage > hapticStage.current) {
        hapticStage.current = nextStage;
        haptic(7);
      }
    }
    if (next >= 100) finishScan();
    else frame.current = requestAnimationFrame(tick);
  }

  function startScan() {
    if (scanState === 'sealing' || scanState === 'complete' || press.current.active) return;
    press.current.active = true;
    press.current.startedAt = performance.now();
    press.current.startProgress = scanProgress;
    lastProgressPaint.current = 0;
    setScanState('scanning');
    opticalAudio.startArchiveScan();
    if (scanProgress === 0) {
      hapticStage.current = 0;
      haptic(9);
      opticalAudio.playPulse('scan', .24);
    }
    frame.current = requestAnimationFrame(tick);
  }

  function pauseScan() {
    if (!press.current.active) return;
    press.current.active = false;
    cancelAnimationFrame(frame.current ?? 0);
    opticalAudio.stopArchiveScan(.2);
    setScanState('idle');
  }

  function beginPress(event: PointerEvent<HTMLButtonElement>) {
    press.current.pointerId = event.pointerId;
    event.currentTarget.setPointerCapture(event.pointerId);
    startScan();
  }

  function endPress(event: PointerEvent<HTMLButtonElement>) {
    if (press.current.pointerId !== event.pointerId) return;
    press.current.pointerId = -1;
    pauseScan();
  }

  function handleKeyDown(event: KeyboardEvent<HTMLButtonElement>) {
    if ((event.key === ' ' || event.key === 'Enter') && !event.repeat) {
      event.preventDefault();
      startScan();
    }
  }

  function handleKeyUp(event: KeyboardEvent<HTMLButtonElement>) {
    if (event.key === ' ' || event.key === 'Enter') {
      event.preventDefault();
      pauseScan();
    }
  }

  function goBack() {
    if (page === 'result') {
      setPage('scan');
      setScanState('idle');
      setScanProgress(0);
      hapticStage.current = 0;
    } else if (page === 'scan') {
      pauseScan();
      setPage('intro');
      setScanProgress(0);
      hapticStage.current = 0;
    } else onExit(false);
  }

  return <section className={`archive archive--${page} archive--${scanState} ${ready ? 'is-ready' : ''}`}
    style={visualStyle} aria-label="视觉档案专题" aria-busy={!ready && !failed}>
    <div className="archive-scene" aria-hidden="true">
      <img className="archive-image archive-image--base" src={archiveVisual.src} alt="" fetchPriority="high"
        onLoad={async event => { try { await event.currentTarget.decode(); } catch {} setReady(true); }}
        onError={() => setFailed(true)} />
      <img className="archive-image archive-image--core" src={archiveVisual.src} alt="" />
      <img className="archive-image archive-image--lens archive-image--lens-shell" src={archiveVisual.src} alt="" />
      <div className="archive-orbits"><i /><i /><i /></div>
      <div className="archive-traces"><span /><span /></div>
      <div className="archive-scan-beam" />
      <div className="archive-core-flare" />
      <div className="archive-vignette" />
    </div>

    <button className="archive-back" type="button" aria-label="返回" onClick={goBack}><span aria-hidden="true">‹</span></button>

    {page === 'intro' && <div className="archive-intro">
      <p className="archive-kicker">VISION ARCHIVE</p>
      <h1>视觉档案</h1>
      <p className="archive-lead">视觉状态不只靠感觉判断。让每一次看见，都值得被记录。</p>
      <button className="archive-enter" type="button" disabled={!ready} onClick={() => { setPage('scan'); setScanProgress(0); setScanState('idle'); }}>
        <span>进入视觉扫描</span><i aria-hidden="true">◎</i>
      </button>
      <small>长按启动扫描</small>
    </div>}

    {page === 'scan' && <div className="archive-scan-ui">
      <header className="archive-scan-title"><span>VISION ARCHIVE</span><strong>视觉档案</strong></header>
      <div className="archive-scan-status" aria-live="polite">
        <span>{String(Math.round(scanProgress)).padStart(2, '0')}</span><i>/ 100</i>
        <p>{scanLabel}</p>
      </div>
      <button ref={holdButton} className="archive-hold" type="button" aria-label="长按开始扫描"
        aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(scanProgress)}
        onPointerDown={beginPress} onPointerUp={endPress} onPointerCancel={endPress} onLostPointerCapture={pauseScan}
        onKeyDown={handleKeyDown} onKeyUp={handleKeyUp}>
        <span><strong>{scanState === 'scanning' ? '保持长按' : scanState === 'sealing' ? '正在封存' : '长按扫描'}</strong><small>{scanState === 'idle' && scanProgress > 0 ? '继续按住以完成' : 'PRESS & HOLD'}</small></span>
      </button>
      <p className="archive-hold-hint">扫描仅用于体验，不生成医学诊断</p>
    </div>}

    {page === 'result' && <article className="archive-result">
      <div className="archive-result-mark" aria-hidden="true"><span>✓</span></div>
      <p className="archive-kicker">ARCHIVE COMPLETE</p>
      <h1>视觉档案摘要</h1>
      <p className="archive-result-lead">记录已完成。以下内容是日常健康提醒，不构成医学诊断。</p>
      <div className="archive-result-cards">
        <section><span>01</span><div><h2>用眼习惯</h2><p>长时间使用屏幕时，留意连续用眼时长与观看距离。</p></div></section>
        <section><span>02</span><div><h2>视觉疲劳提醒</h2><p>间隔休息、主动眨眼，让眼睛获得放松与重新聚焦的时间。</p></div></section>
        <section><span>03</span><div><h2>检查建议</h2><p>视觉不适持续或发生变化时，建议进行专业眼健康检查。</p></div></section>
      </div>
      <button className="archive-finish" type="button" onClick={() => onExit(true)}>保存体验 · 返回视觉之门</button>
    </article>}

    {!ready && !failed && <p className="load-state" role="status">正在载入视觉核心…</p>}
    {failed && <div className="load-state" role="alert"><p>视觉素材加载失败</p><button onClick={() => location.reload()}>重新加载</button></div>}
  </section>;
}
