// Géométrie du plateau : 11 x 11 unités, coins de 1.5, 9 cases de 8/9 par côté.
export const SIZE = 11;
export const HALF = SIZE / 2;
export const CORNER = 1.5;
export const W = (SIZE - 2 * CORNER) / 9;

// Centre de la case i (x vers la droite, z vers la caméra) + angle "vers l'intérieur"
export function tileCenter(i) {
  const h = HALF, c = CORNER;
  if (i === 0) return { x: h - c / 2, z: h - c / 2, side: 0 };
  if (i < 10) return { x: h - c - (i - 1) * W - W / 2, z: h - c / 2, side: 0 };
  if (i === 10) return { x: -h + c / 2, z: h - c / 2, side: 1 };
  if (i < 20) return { x: -h + c / 2, z: h - c - (i - 11) * W - W / 2, side: 1 };
  if (i === 20) return { x: -h + c / 2, z: -h + c / 2, side: 2 };
  if (i < 30) return { x: -h + c + (i - 21) * W + W / 2, z: -h + c / 2, side: 2 };
  if (i === 30) return { x: h - c / 2, z: -h + c / 2, side: 3 };
  return { x: h - c / 2, z: -h + c + (i - 31) * W + W / 2, side: 3 };
}
// Direction vers le centre du plateau pour chaque côté
export const INWARD = [
  { x: 0, z: -1 },
  { x: 1, z: 0 },
  { x: 0, z: 1 },
  { x: -1, z: 0 },
];
export const isCorner = (i) => i % 10 === 0;

export function tileAt(x, z) {
  for (let i = 0; i < 40; i++) {
    const t = tileCenter(i);
    const corner = isCorner(i);
    const along = corner ? CORNER : W;
    const hx = t.side % 2 === 0 ? along / 2 : CORNER / 2;
    const hz = t.side % 2 === 0 ? CORNER / 2 : along / 2;
    if (Math.abs(x - t.x) <= hx && Math.abs(z - t.z) <= hz) return i;
  }
  return -1;
}
