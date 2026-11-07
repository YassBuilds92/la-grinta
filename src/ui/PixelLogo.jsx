import { useEffect, useRef } from 'react';
import { drawLogo } from '../three/boardTexture.js';

// Le logo bannière du plateau, redessiné en basse définition puis agrandi sans lissage.
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
      const W = Math.round(width / 2.5), H = Math.round((W * 560) / 1500);
      c.width = W;
      c.height = H;
      const ctx = c.getContext('2d');
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'high';
      ctx.clearRect(0, 0, W, H);
      ctx.drawImage(big, 0, 0, W, H);
      // seuil alpha : bords francs, pas de demi-pixels flous
      const d = ctx.getImageData(0, 0, W, H);
      for (let i = 3; i < d.data.length; i += 4) d.data[i] = d.data[i] > 110 ? 255 : 0;
      ctx.putImageData(d, 0, 0);
    };
    document.fonts.load('700 120px "Pixelify Sans"').then(paint, paint);
    return () => { alive = false; };
  }, [width]);
  return <canvas ref={ref} className="plogo" style={{ width, imageRendering: 'pixelated' }} />;
}
