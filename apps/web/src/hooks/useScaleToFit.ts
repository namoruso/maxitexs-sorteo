import { useEffect, type RefObject } from 'react';

/**
 * Scale a fixed design canvas (default 1080×1920) to fit the viewport.
 * Uses visualViewport when available so mobile browser chrome is accounted for.
 */
export function useScaleToFit(
  ref: RefObject<HTMLElement | null>,
  width = 1080,
  height = 1920,
): void {
  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const fit = () => {
      const vv = window.visualViewport;
      const vw = vv?.width ?? document.documentElement.clientWidth ?? window.innerWidth;
      const vh = vv?.height ?? document.documentElement.clientHeight ?? window.innerHeight;
      const s = Math.min(vw / width, vh / height);
      const x = (vw - width * s) / 2;
      const y = (vh - height * s) / 2;
      el.style.transform = `translate(${x}px, ${y}px) scale(${s})`;
      el.dataset.scale = s.toFixed(3);
      // Compact layout tweaks when the screen is shorter than the design canvas
      document.documentElement.classList.toggle('totem-compact', vh < height * 0.92 || s < 0.92);
    };

    fit();
    window.addEventListener('resize', fit);
    window.addEventListener('orientationchange', fit);
    window.visualViewport?.addEventListener('resize', fit);
    window.visualViewport?.addEventListener('scroll', fit);
    return () => {
      window.removeEventListener('resize', fit);
      window.removeEventListener('orientationchange', fit);
      window.visualViewport?.removeEventListener('resize', fit);
      window.visualViewport?.removeEventListener('scroll', fit);
      document.documentElement.classList.remove('totem-compact');
    };
  }, [ref, width, height]);
}
