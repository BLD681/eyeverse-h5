import { useCallback, useEffect, useRef, useState, type CSSProperties } from 'react';
import { Home } from './pages/Home';
import { VisionPortal } from './pages/VisionPortal';
import { DryEyeExperience } from './pages/DryEyeExperience';
import { RefractionExperience } from './pages/RefractionExperience';
import { VisionArchiveExperience } from './pages/VisionArchiveExperience';
import { TimeMirrorExperience } from './pages/TimeMirrorExperience';
import { TheEyeWithin, type TheEyeWithinHandle } from './pages/TheEyeWithin';
import { archiveVisual, dryEyeVisual, focusVisual, portalVisual, timeMirrorVisual } from './config/visuals';
import { portalThemes, type PortalTheme } from './config/themes';
import { OpticalTransition, type OpticalTransitionRequest } from './components/OpticalTransition';
import { SoundToggle } from './components/SoundToggle';
import { opticalAudio, type AudioScene } from './audio/OpticalAudio';

type Page = 'home' | 'portal' | 'dryeye' | 'refraction' | 'archive' | 'time' | 'core';

function pageFromHash(): Page {
  if (location.hash === '#portal') return 'portal';
  if (location.hash === '#dryeye') return 'dryeye';
  if (location.hash === '#refraction') return 'refraction';
  if (location.hash === '#archive') return 'archive';
  if (location.hash === '#time') return 'time';
  if (location.hash === '#the-eye-within' || location.hash === '#vision-core') return 'core';
  return 'home';
}

const topicPages: Record<PortalTheme['id'], { page: Exclude<Page, 'home' | 'portal'>; hash: string; src: string }> = {
  'dry-eye': { page: 'dryeye', hash: '#dryeye', src: dryEyeVisual.src },
  refraction: { page: 'refraction', hash: '#refraction', src: focusVisual.src },
  'vision-archive': { page: 'archive', hash: '#archive', src: archiveVisual.src },
  'time-mirror': { page: 'time', hash: '#time', src: timeMirrorVisual.src },
};

const topicIdByPage: Partial<Record<Page, PortalTheme['id']>> = {
  dryeye: 'dry-eye',
  refraction: 'refraction',
  archive: 'vision-archive',
  time: 'time-mirror',
};

const preloadedVisuals = new Map<string, Promise<void>>();

function decodeImage(image: HTMLImageElement, timeoutMs = 900) {
  if (typeof image.decode !== 'function') return Promise.resolve();
  return new Promise<void>(resolve => {
    const timeout = window.setTimeout(resolve, timeoutMs);
    void image.decode().catch(() => {}).then(() => {
      window.clearTimeout(timeout);
      resolve();
    });
  });
}

function preloadVisual(src: string) {
  const existing = preloadedVisuals.get(src);
  if (existing) return existing;
  const pending = new Promise<void>((resolve, reject) => {
    const image = new Image();
    image.decoding = 'async';
    image.onload = async () => {
      await decodeImage(image);
      if (image.naturalWidth > 0) resolve();
      else reject(new Error(`Unable to decode visual: ${src}`));
    };
    image.onerror = () => {
      preloadedVisuals.delete(src);
      reject(new Error(`Unable to load visual: ${src}`));
    };
    image.src = src;
  });
  preloadedVisuals.set(src, pending);
  return pending;
}

function nextPaint() {
  return new Promise<void>(resolve => requestAnimationFrame(() => resolve()));
}

async function waitForRoutePaint(layer: HTMLDivElement) {
  await nextPaint();
  const images = Array.from(layer.querySelectorAll('img'));
  await Promise.all(images.map(async image => {
    if (!image.complete) {
      await new Promise<void>((resolve, reject) => {
        image.addEventListener('load', () => resolve(), { once: true });
        image.addEventListener('error', () => reject(new Error('Route image failed')), { once: true });
      });
    }
    if (image.naturalWidth === 0) throw new Error('Route image has no decoded pixels');
    await decodeImage(image);
  }));
  for (let frame = 0; frame < 20 && layer.querySelector('[aria-busy="true"]'); frame += 1) {
    await nextPaint();
  }
  if (layer.querySelector('[aria-busy="true"]')) throw new Error('Prepared route did not report ready');
  layer.getBoundingClientRect();
  await nextPaint();
  await nextPaint();
}

export function App() {
  const [page, setPage] = useState<Page>(pageFromHash);
  const [exiting, setExiting] = useState(false);
  const [introSeen, setIntroSeen] = useState(false);
  const transitionId = useRef(0);
  const [transition, setTransition] = useState<OpticalTransitionRequest | null>(null);
  const [preparing, setPreparing] = useState<OpticalTransitionRequest | null>(null);
  const [portalArrival, setPortalArrival] = useState<'default' | 'from-home' | 'from-topic'>('default');
  const [topicSession, setTopicSession] = useState(0);
  const [completedThemes, setCompletedThemes] = useState<PortalTheme['id'][]>([]);
  const completedThemesRef = useRef(new Set<PortalTheme['id']>());
  const [recentCompletion, setRecentCompletion] = useState<PortalTheme['id'] | null>(null);
  const completionTimer = useRef<number | undefined>(undefined);
  const completionSoundPending = useRef(false);
  const routeLayers = useRef<Partial<Record<Page, HTMLDivElement | null>>>({});
  const navigationBusy = useRef(false);
  const navigationVersion = useRef(0);
  const finaleRef = useRef<TheEyeWithinHandle>(null);
  const [finaleReady, setFinaleReady] = useState(false);
  const [finaleLoadFailed, setFinaleLoadFailed] = useState(false);
  const [finaleEntering, setFinaleEntering] = useState(false);
  useEffect(() => {
    const navigate = () => {
      navigationVersion.current += 1;
      navigationBusy.current = false;
      setExiting(false);
      setPreparing(null);
      setTransition(null);
      setFinaleEntering(false);
      setPage(pageFromHash());
    };
    window.addEventListener('hashchange', navigate);
    return () => {
      window.removeEventListener('hashchange', navigate);
      window.clearTimeout(completionTimer.current);
    };
  }, []);
  useEffect(() => {
    if (page !== 'home') return;
    const preload = window.setTimeout(() => {
      const image = new Image();
      image.src = portalVisual.src;
    }, 1200);
    return () => window.clearTimeout(preload);
  }, [page]);
  useEffect(() => {
    if (page === 'core') {
      opticalAudio.disposeScene('portal');
      opticalAudio.disposeScene('core');
      return;
    }
    opticalAudio.activateScene(page as AudioScene);
  }, [page]);
  useEffect(() => {
    if (!preparing) return;
    let cancelled = false;
    const request = preparing;
    void (async () => {
      try {
        const layer = routeLayers.current[request.targetKey as Page];
        if (!layer) throw new Error('Prepared route did not mount');
        await waitForRoutePaint(layer);
        if (cancelled || navigationVersion.current !== request.id) return;
        opticalAudio.deactivateScene(
          request.sourceKey as AudioScene,
          request.targetKey as AudioScene,
          request.direction === 'topic-to-portal',
        );
        if (request.direction === 'home-to-portal') setExiting(true);
        setTransition(request);
        setPreparing(null);
      } catch {
        if (cancelled) return;
        navigationBusy.current = false;
        setPreparing(null);
      }
    })();
    return () => { cancelled = true; };
  }, [preparing?.id]);
  async function enter() {
    if (exiting || navigationBusy.current || transition || preparing) return;
    navigationBusy.current = true;
    const requestId = ++transitionId.current;
    navigationVersion.current = requestId;
    setPortalArrival('default');
    opticalAudio.playHomeEnter();
    try {
      await Promise.all([preloadVisual(portalVisual.src), opticalAudio.prepareScene('portal')]);
      if (navigationVersion.current !== requestId) return;
      setPreparing({
        id: requestId,
        direction: 'home-to-portal',
        origin: { x: 50, y: 46 },
        targetHash: '#portal',
        sourceKey: 'home',
        targetKey: 'portal',
      });
    } catch {
      navigationBusy.current = false;
    }
  }
  function markAwakened() {
    setIntroSeen(true);
  }

  async function openTheme(themeId: PortalTheme['id']) {
    if (navigationBusy.current || transition || preparing) return false;
    navigationBusy.current = true;
    const requestId = ++transitionId.current;
    navigationVersion.current = requestId;
    const theme = portalThemes.find(item => item.id === themeId);
    if (!theme) { navigationBusy.current = false; return false; }
    const target = topicPages[themeId];
    try {
      opticalAudio.playThemeEntry(themeId);
      await Promise.all([preloadVisual(target.src), opticalAudio.prepareScene(target.page)]);
      if (navigationVersion.current !== requestId) return false;
      setTopicSession(current => current + 1);
      setPortalArrival('default');
      setPreparing({
        id: requestId,
        direction: 'portal-to-topic',
        origin: theme.position,
        targetHash: target.hash,
        sourceKey: 'portal',
        targetKey: target.page,
        variant: themeId,
      });
      return true;
    } catch {
      navigationBusy.current = false;
      return false;
    }
  }

  function enterVisionCore() {
    if (completedThemesRef.current.size < portalThemes.length || !finaleReady || navigationBusy.current || transition || preparing) return;
    navigationBusy.current = true;
    opticalAudio.playFinaleJourney();
    opticalAudio.deactivateScene('portal', undefined, true);
    const started = finaleRef.current?.begin() ?? false;
    if (started) setFinaleEntering(true);
    else {
      navigationBusy.current = false;
      opticalAudio.stopFinaleJourney();
      opticalAudio.activateScene('portal');
    }
  }

  const handleFinalePlaybackStarted = useCallback(() => {
    history.pushState(null, '', '#the-eye-within');
    setFinaleEntering(false);
    setPage('core');
    navigationBusy.current = false;
  }, []);

  const handleFinalePlaybackFailed = useCallback(() => {
    setFinaleLoadFailed(true);
    setFinaleEntering(false);
    navigationBusy.current = false;
    opticalAudio.stopFinaleJourney();
    if (page === 'portal') opticalAudio.activateScene('portal');
  }, [page]);

  async function returnToPortal(completed = false) {
    if (navigationBusy.current || transition || preparing) return;
    const origins: Record<Exclude<Page, 'home' | 'portal'>, { x: number; y: number }> = {
      dryeye: { x: 50, y: 49 },
      refraction: { x: 50, y: 46 },
      archive: { x: 50, y: 46 },
      time: { x: 50, y: 43 },
      core: { x: 50, y: 42 },
    };
    if (page === 'home' || page === 'portal') return;
    navigationBusy.current = true;
    const requestId = ++transitionId.current;
    navigationVersion.current = requestId;
    try {
      const completedTheme = completed ? topicIdByPage[page] : undefined;
      if (completedTheme && !completedThemesRef.current.has(completedTheme)) {
        completedThemesRef.current.add(completedTheme);
        setCompletedThemes(Array.from(completedThemesRef.current));
        setRecentCompletion(completedTheme);
        completionSoundPending.current = true;
      }
      opticalAudio.playPulse('route-out', .46);
      await Promise.all([preloadVisual(portalVisual.src), opticalAudio.prepareScene('portal')]);
      if (navigationVersion.current !== requestId) return;
      setPreparing({
        id: requestId,
        direction: 'topic-to-portal',
        origin: origins[page],
        targetHash: '#portal',
        sourceKey: page,
        targetKey: 'portal',
      });
    } catch {
      navigationBusy.current = false;
    }
  }

  const commitTransition = useCallback((request: OpticalTransitionRequest) => {
    history.pushState(null, '', request.targetHash);
    setPortalArrival(request.direction === 'topic-to-portal' ? 'from-topic' : request.direction === 'home-to-portal' ? 'from-home' : 'default');
    setPage(pageFromHash());
  }, []);

  const finishTransition = useCallback((request: OpticalTransitionRequest) => {
    opticalAudio.disposeScene(request.sourceKey as AudioScene);
    navigationBusy.current = false;
    if (request.direction === 'home-to-portal') setExiting(false);
    setTransition(current => current?.id === request.id ? null : current);
    if (request.direction === 'topic-to-portal') {
      if (completionSoundPending.current) {
        completionSoundPending.current = false;
        opticalAudio.playCompletion();
      }
      window.clearTimeout(completionTimer.current);
      completionTimer.current = window.setTimeout(() => setRecentCompletion(null), 1900);
    }
  }, []);

  const transitionClass = transition ? `is-optical-transitioning is-${transition.direction}` : '';
  const experienceStyle = transition ? {
    '--transition-x': `${transition.origin.x}%`,
    '--transition-y': `${transition.origin.y}%`,
  } as CSSProperties : undefined;

  const activePages = transition
    ? [transition.sourceKey as Page, transition.targetKey as Page]
    : preparing ? [preparing.sourceKey as Page, preparing.targetKey as Page]
    : [page];

  function routeKey(route: Page) {
    return route === 'dryeye' || route === 'refraction' || route === 'archive' || route === 'time'
      || route === 'core' ? `${route}-${topicSession}` : route;
  }

  function renderPage(route: Page, active: boolean) {
    if (route === 'home') return <Home exiting={exiting} introSeen={introSeen} onAwakened={markAwakened} onEnter={enter} />;
    if (route === 'portal') return <VisionPortal active={active} arrivalMode={portalArrival}
      completedThemes={completedThemes} recentCompletion={recentCompletion}
      coreReady={finaleReady} coreLoadingFailed={finaleLoadFailed}
      onBack={() => { location.hash = 'home'; }} onOpenTheme={openTheme} onEnterCore={enterVisionCore} />;
    if (route === 'dryeye') return <DryEyeExperience onExit={returnToPortal} />;
    if (route === 'refraction') return <RefractionExperience onExit={returnToPortal} />;
    if (route === 'archive') return <VisionArchiveExperience onExit={returnToPortal} />;
    if (route === 'time') return <TimeMirrorExperience onExit={returnToPortal} />;
    return null;
  }

  const finaleActive = page === 'core' || finaleEntering;
  const shouldMountFinale = finaleActive || (page === 'portal' && completedThemes.length >= 3);

  return <main className="viewport" onPointerDownCapture={() => { void opticalAudio.unlock(); }}><div className={`experience ${transitionClass} ${finaleEntering ? 'is-entering-eye' : ''}`} style={experienceStyle}>
    {activePages.map(route => {
      const transitionRole = transition
        ? route === transition.sourceKey ? ' route-layer--transition-source' : ' route-layer--transition-target'
        : '';
      const preparationRole = preparing && route === preparing.targetKey ? ' route-layer--preparing' : '';
      return <div key={routeKey(route)} data-route={route} ref={node => { routeLayers.current[route] = node; }}
        className={`route-layer ${route === page ? 'route-layer--current' : 'route-layer--standby'}${transitionRole}${preparationRole}`}>
      {renderPage(route, route === page)}
    </div>})}
    {shouldMountFinale && <TheEyeWithin ref={finaleRef} active={finaleActive}
      onReady={ready => { setFinaleReady(ready); if (ready) setFinaleLoadFailed(false); }}
      onPlaybackStarted={handleFinalePlaybackStarted}
      onPlaybackFailed={handleFinalePlaybackFailed} />}
    <OpticalTransition request={transition} onMidpoint={commitTransition} onComplete={finishTransition} />
    {!finaleActive && <SoundToggle />}
  </div></main>;
}
