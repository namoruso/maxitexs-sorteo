import { useEffect, type RefObject } from 'react';

/** Scale a fixed 1080×1920 canvas to fit the viewport (gh-hoteles style). */
export function useScaleToFit(
  ref: RefObject<HTMLElement | null>,
  width = 1080,
  height = 1920,
): void {
  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const fit = () => {
      const s = Math.min(window.innerWidth / width, window.innerHeight / height);
      const x = (window.innerWidth - width * s) / 2;
      const y = (window.innerHeight - height * s) / 2;
      el.style.transform = `translate(${x}px, ${y}px) scale(${s})`;
    };

    fit();
    window.addEventListener('resize', fit);
    window.addEventListener('orientationchange', fit);
    return () => {
      window.removeEventListener('resize', fit);
      window.removeEventListener('orientationchange', fit);
    };
  }, [ref, width, height]);
}
