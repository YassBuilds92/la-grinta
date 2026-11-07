// Petites icônes pixel 8×8 dessinées en code (rendu net, pas d'emoji).
const ICONS = {
  close: ['X......X', '.X....X.', '..X..X..', '...XX...', '...XX...', '..X..X..', '.X....X.', 'X......X'],
  sound: ['...X....', '..XX..X.', 'XXXX...X', 'XXXX.X.X', 'XXXX.X.X', 'XXXX...X', '..XX..X.', '...X....'],
  mute: ['...X....', '..XX....', 'XXXX.X.X', 'XXXX..X.', 'XXXX..X.', 'XXXX.X.X', '..XX....', '...X....'],
  target: ['..XXXX..', '.X....X.', 'X..XX..X', 'X.X..X.X', 'X.X..X.X', 'X..XX..X', '.X....X.', '..XXXX..'],
  house: ['...XX...', '..XXXX..', '.XXXXXX.', 'XXXXXXXX', '.X....X.', '.X.XX.X.', '.X.XX.X.', '.XXXXXX.'],
  scroll: ['.XXXXXX.', 'X.X....X', '.XX.XX.X', '..X....X', '..X.XX.X', '..X....X', '..XXXXX.', '........'],
  dice: ['XXXXXXXX', 'X......X', 'X.X..X.X', 'X......X', 'X......X', 'X.X..X.X', 'X......X', 'XXXXXXXX'],
  zzz: ['XXXX....', '...X....', '..X.....', 'XXXX.XXX', '.......X', '......X.', '.....XXX', '........'],
  crown: ['X..XX..X', 'XX.XX.XX', 'XXXXXXXX', 'XXXXXXXX', '.XXXXXX.', '.XXXXXX.', '........', '.XXXXXX.'],
  bell: ['...XX...', '..XXXX..', '.XXXXXX.', '.XXXXXX.', '.XXXXXX.', 'XXXXXXXX', '........', '...XX...'],
  case: ['..XXXX..', '..X..X..', 'XXXXXXXX', 'X......X', 'XXXXXXXX', 'X......X', 'X......X', 'XXXXXXXX'],
};
export default function PxIcon({ name, size = 16, color = 'currentColor', className = '' }) {
  const rows = ICONS[name];
  if (!rows) return null;
  let d = '';
  rows.forEach((r, y) => [...r].forEach((c, x) => { if (c === 'X') d += `M${x} ${y}h1v1h-1z`; }));
  return (
    <svg className={'pxi ' + className} width={size} height={size} viewBox="0 0 8 8" shapeRendering="crispEdges" aria-hidden="true">
      <path d={d} fill={color} />
    </svg>
  );
}
