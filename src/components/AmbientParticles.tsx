import { useEffect, useRef } from 'react';

type Particle = {
  angle: number;
  distance: number;
  speed: number;
  size: number;
  alpha: number;
  drift: number;
};

export function AmbientParticles() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || matchMedia('(prefers-reduced-motion: reduce)').matches) return;

    const context = canvas.getContext('2d');
    if (!context) return;

    const particles: Particle[] = Array.from({ length: 18 }, (_, index) => ({
      angle: (Math.PI * 2 * index) / 18,
      distance: 0.22 + (index % 7) * 0.055,
      speed: 0.000025 + (index % 4) * 0.000008,
      size: 0.45 + (index % 3) * 0.32,
      alpha: 0.08 + (index % 5) * 0.025,
      drift: (index % 2 ? 1 : -1) * (4 + (index % 4) * 2),
    }));

    let frame = 0;
    let start = performance.now();
    const resize = () => {
      const ratio = Math.min(devicePixelRatio || 1, 2);
      const bounds = canvas.getBoundingClientRect();
      canvas.width = Math.round(bounds.width * ratio);
      canvas.height = Math.round(bounds.height * ratio);
      context.setTransform(ratio, 0, 0, ratio, 0, 0);
    };

    const draw = (time: number) => {
      const width = canvas.clientWidth;
      const height = canvas.clientHeight;
      const centerX = width * 0.5;
      const centerY = height * 0.46;
      const radius = Math.min(width, height * 0.5625);
      context.clearRect(0, 0, width, height);

      for (const particle of particles) {
        const theta = particle.angle + (time - start) * particle.speed;
        const pulse = Math.sin(theta * 3 + time * 0.00035) * particle.drift;
        const x = centerX + Math.cos(theta) * radius * particle.distance;
        const y = centerY + Math.sin(theta) * radius * particle.distance * 0.55 + pulse;
        context.beginPath();
        context.fillStyle = `rgba(190, 226, 248, ${particle.alpha})`;
        context.arc(x, y, particle.size, 0, Math.PI * 2);
        context.fill();
      }
      frame = requestAnimationFrame(draw);
    };

    resize();
    window.addEventListener('resize', resize);
    frame = requestAnimationFrame(draw);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener('resize', resize);
    };
  }, []);

  return <canvas ref={canvasRef} className="ambient-particles" aria-hidden="true" />;
}
