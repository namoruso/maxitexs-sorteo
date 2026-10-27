import { useEffect, type RefObject } from 'react';

/**
 * Scale a fixed design canvas (default 1080×1920) to fill the viewport.
 * Uses independent X/Y scale so there are no letterbox bars on any aspect ratio.
 * visualViewport accounts for mobile browser chrome.
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
      const vw = Math.max(1, vv?.width ?? document.documentElement.clientWidth ?? window.innerWidth);
      const vh = Math.max(1, vv?.height ?? document.documentElement.clientHeight ?? window.innerHeight);
      const sx = vw / width;
      const sy = vh / height;
      el.style.transformOrigin = '0 0';
      el.style.transform = `scale(${sx}, ${sy})`;
      el.style.left = '0';
      el.style.top = '0';
      el.dataset.scaleX = sx.toFixed(3);
      el.dataset.scaleY = sy.toFixed(3);
      // Compact layout when the screen is shorter / smaller than the design canvas
      document.documentElement.classList.toggle('totem-compact', vh < height * 0.92 || Math.min(sx, sy) < 0.92);
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
