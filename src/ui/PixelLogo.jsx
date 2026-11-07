import { useEffect, useRef } from 'react';
import { drawLogo } from '../three/boardTexture.js';

// Le logo bannière du plateau, redessiné net à la taille de l'écran.
export default function PixelLogo({ width = 360 }) {
  const ref = useRef(null);
  useEffect(() => {
    let alive = true;
    const paint = () => {
      if (!alive) return;
      const big = document.createElement('canvas');
      big.width = 1500;
      big.height = 560;
      drawLogo(big.getContext('2d'), 750, 300);
      const c = ref.current;
      const W = Math.round(width * Math.min(window.devicePixelRatio || 1, 2)), H = Math.round((W * 560) / 1500);
      c.width = W;
      c.height = H;
      const ctx = c.getContext('2d');
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'high';
      ctx.clearRect(0, 0, W, H);
      ctx.drawImage(big, 0, 0, W, H);
    };
    document.fonts.load('700 120px "Pixelify Sans"').then(paint, paint);
    return () => { alive = false; };
  }, [width]);
  return <canvas ref={ref} className="plogo" style={{ width }} />;
}
