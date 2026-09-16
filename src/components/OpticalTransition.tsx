import { useEffect, type CSSProperties } from 'react';

export type OpticalTransitionRequest = {
  id: number;
  direction: 'home-to-portal' | 'portal-to-topic' | 'topic-to-portal';
  origin: { x: number; y: number };
  targetHash: string;
  sourceKey: string;
  targetKey: string;
  variant?: 'dry-eye' | 'refraction' | 'vision-archive' | 'time-mirror';
};

type TransitionStyle = CSSProperties & {
  '--transition-x': string;
  '--transition-y': string;
};

export function OpticalTransition({ request, onMidpoint, onComplete }: {
  request: OpticalTransitionRequest | null;
  onMidpoint: (request: OpticalTransitionRequest) => void;
  onComplete: (request: OpticalTransitionRequest) => void;
}) {
  useEffect(() => {
    if (!request) return;
    const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
    const midpoint = window.setTimeout(() => onMidpoint(request), reduced ? 45 : request.direction === 'home-to-portal' ? 980 : 850);
    const complete = window.setTimeout(() => onComplete(request), reduced ? 90 : request.direction === 'home-to-portal' ? 1550 : 1450);
    return () => {
      window.clearTimeout(midpoint);
      window.clearTimeout(complete);
    };
  }, [request?.id]);

  if (!request) return null;

  const style: TransitionStyle = {
    '--transition-x': `${request.origin.x}%`,
    '--transition-y': `${request.origin.y}%`,
  };

  const variantClass = request.variant ? ` optical-transition--${request.variant}` : '';

  return <div className={`optical-transition optical-transition--${request.direction}${variantClass}`} style={style} aria-hidden="true">
    <div className="optical-transition-depth" />
    <div className="optical-transition-aperture"><i /><i /></div>
    {request.direction === 'portal-to-topic' && <div className="optical-transition-signature"><i /><i /><i /></div>}
    <div className="optical-transition-flare" />
    <div className="optical-transition-vignette" />
  </div>;
}
