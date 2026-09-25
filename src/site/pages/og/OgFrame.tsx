/**
 * The 1200x630 canvas `scripts/og.mjs` screenshots (011 §4, §7).
 *
 * `[data-og-frame]` is the renderer's contract: no frame, no shot. The frame is
 * fixed and pinned to the top left so it occupies exactly the viewport the
 * renderer sets, covering the app chrome that is mounted around it, and the
 * effect below takes the scrollbars off the document - a scrollbar would eat
 * pixels off the right edge of every share image.
 *
 * These routes are never prerendered, so an effect is the right tool here.
 */
import { useEffect } from 'react';
import type { ReactNode } from 'react';
import styles from './og.module.css';

export interface OgFrameProps {
  children: ReactNode;
}

export function OgFrame({ children }: OgFrameProps) {
  useEffect(() => {
    const { documentElement, body } = document;
    const previous = [documentElement.style.overflow, body.style.overflow];
    documentElement.style.overflow = 'hidden';
    body.style.overflow = 'hidden';
    return () => {
      documentElement.style.overflow = previous[0];
      body.style.overflow = previous[1];
    };
  }, []);

  return (
    <div className={styles.frame} data-og-frame="">
      {children}
    </div>
  );
}

export default OgFrame;
