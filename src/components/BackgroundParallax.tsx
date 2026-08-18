import { useEffect } from 'react';

const RANGE_PX = 18;

export function BackgroundParallax() {
  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

    let frame = 0;

    function handleMove(e: MouseEvent) {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        const x = (e.clientX / window.innerWidth - 0.5) * 2 * RANGE_PX;
        const y = (e.clientY / window.innerHeight - 0.5) * 2 * RANGE_PX;
        document.documentElement.style.setProperty('--oc-parallax-x', `${x}px`);
        document.documentElement.style.setProperty('--oc-parallax-y', `${y}px`);
      });
    }

    window.addEventListener('mousemove', handleMove);
    return () => {
      window.removeEventListener('mousemove', handleMove);
      cancelAnimationFrame(frame);
    };
  }, []);

  return null;
}
