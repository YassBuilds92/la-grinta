import * as THREE from 'three';
import { TILES, GROUPS } from '../game/board.js';
import { SIZE, CORNER, W, tileCenter } from './layout.js';

const N = 2048;
const RES = 2; // texture 4096 px : textes nets de près comme de loin
const S = N / SIZE;

function wrap(ctx, text, maxW) {
  const words = text.split(' ');
  const lines = [];
  let cur = '';
  for (const w of words) {
    const t = cur ? cur + ' ' + w : w;
    if (ctx.measureText(t).width > maxW && cur) {
      lines.push(cur);
      cur = w;
    } else cur = t;
  }
  if (cur) lines.push(cur);
  return lines;
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

const BG = '#fff8ec';
const INK = '#1d1b2e';

// Ajuste la taille de police pour qu'un texte tienne dans une largeur
function fit(ctx, text, maxW, size, weight = 700, family = '"Pixelify Sans", sans-serif') {
  let fs = size;
  do {
    ctx.font = `${weight} ${fs}px ${family}`;
    fs -= 2;
  } while (ctx.measureText(text).width > maxW && fs > 14);
  return fs + 2;
}
// Texte gras avec contour clair, lisible sur n'importe quel fond
function bold(ctx, text, x, y, maxW, size, fill = INK, halo = 'rgba(255,255,255,0.85)') {
  fit(ctx, text, maxW, size);
  ctx.lineJoin = 'round';
  ctx.lineWidth = 8;
  ctx.strokeStyle = halo;
  ctx.strokeText(text, x, y);
  ctx.fillStyle = fill;
  ctx.fillText(text, x, y);
}

function drawHand(ctx, x, y, s) {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(s, s);
  ctx.fillStyle = '#f4c9a3';
  ctx.strokeStyle = '#5a2c22';
  ctx.lineWidth = 4;
  ctx.lineJoin = 'round';
  roundRect(ctx, -26, -6, 52, 46, 12);
  ctx.fill(); ctx.stroke();
  [-20, -7, 6, 19].forEach((fx, k) => {
    roundRect(ctx, fx - 6, -44 + Math.abs(k - 1.5) * 5, 13, 44, 6);
    ctx.fill(); ctx.stroke();
  });
  ctx.save();
  ctx.translate(-26, 14);
  ctx.rotate(-0.7);
  roundRect(ctx, -26, -7, 30, 14, 7);
  ctx.fill(); ctx.stroke();
  ctx.restore();
  // interdit
  ctx.strokeStyle = '#e8243c';
  ctx.lineWidth = 11;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(-44, 46); ctx.lineTo(44, -50);
  ctx.stroke();
  ctx.restore();
}

function drawScimitar(ctx, x, y, s, rot) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(rot);
  ctx.scale(s, s);
  ctx.lineJoin = 'round';
  ctx.strokeStyle = '#3a2a40';
  ctx.lineWidth = 4;
  // lame courbe
  ctx.fillStyle = '#e9eef7';
  ctx.beginPath();
  ctx.moveTo(0, -8);
  ctx.quadraticCurveTo(70, -14, 112, -46);
  ctx.quadraticCurveTo(96, 6, 0, 8);
  ctx.closePath();
  ctx.fill(); ctx.stroke();
  ctx.fillStyle = '#b8c4d8';
  ctx.beginPath();
  ctx.moveTo(4, 3); ctx.quadraticCurveTo(80, 0, 104, -34); ctx.quadraticCurveTo(84, 8, 4, 8);
  ctx.fill();
  // garde + poignée
  ctx.fillStyle = '#f2b632';
  roundRect(ctx, -8, -20, 12, 40, 4); ctx.fill(); ctx.stroke();
  ctx.fillStyle = '#7a3b1e';
  roundRect(ctx, -42, -6, 36, 12, 4); ctx.fill(); ctx.stroke();
  ctx.fillStyle = '#f2b632';
  ctx.beginPath(); ctx.arc(-46, 0, 8, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
  ctx.restore();
}

const CORNER_BG = { go: '#ffcf9e', jail: '#c6ecb4', parking: '#d6c8ff', gotojail: '#ffc4d8' };

function drawCorner(ctx, t, tw, h) {
  ctx.fillStyle = CORNER_BG[t.type];
  ctx.fillRect(-tw / 2 + 4, -h / 2 + 4, tw - 8, h - 8);
  const D = (tw / 2) * Math.SQRT2; // demi-diagonale
  const span = (y) => 2 * (D - Math.abs(y)) - 44; // largeur utile à la hauteur y (repère tourné)
  ctx.save();
  ctx.rotate(-Math.PI / 4);
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  if (t.type === 'go') {
    ctx.font = '78px "Noto Color Emoji", sans-serif';
    ctx.fillText('🏁', 0, -92);
    bold(ctx, 'DÉPART', 0, -10, span(-10), 76);
    bold(ctx, '+200 €', 0, 64, span(64), 46, '#c2410c');
    ctx.restore();
    // grosse flèche dans le sens du tour, le long du bord extérieur
    ctx.save();
    ctx.translate(10, h / 2 - 34);
    ctx.fillStyle = '#e8432a';
    ctx.strokeStyle = INK;
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.moveTo(-110, 0); ctx.lineTo(-62, -26); ctx.lineTo(-62, -11); ctx.lineTo(96, -11);
    ctx.lineTo(96, 11); ctx.lineTo(-62, 11); ctx.lineTo(-62, 26); ctx.closePath();
    ctx.fill(); ctx.stroke();
    ctx.restore();
    return;
  }
  if (t.type === 'jail') {
    // la cellule 3D est au fond de la case : le nom s'écrit en grand devant, face à la caméra
    ctx.restore();
    ctx.save();
    ctx.rotate(-Math.PI / 2);
    bold(ctx, 'PRISON', -8, h / 2 - 86, tw - 30, 60);
    bold(ctx, 'ISLAMIQUE', -8, h / 2 - 36, tw - 26, 54);
    ctx.save();
    ctx.translate(tw / 2 - 26, -30);
    ctx.rotate(Math.PI / 2);
    bold(ctx, 'visite', 0, 0, 120, 26, '#2f6b2a');
    ctx.restore();
    ctx.restore();
    return;
  }
  if (t.type === 'parking') {
    ctx.font = '74px "Noto Color Emoji", sans-serif';
    ctx.fillText('💤', 0, -98);
    bold(ctx, 'AFK', 0, -8, span(-8), 104, '#4b2aa8');
    bold(ctx, 'cagnotte', 0, 72, span(72), 40);
    ctx.restore();
    return;
  }
  // gotojail : la sanction
  drawHand(ctx, -40, -112, 0.85);
  drawScimitar(ctx, 30, -96, 0.6, -0.3);
  bold(ctx, 'SANCTION', 0, -30, span(-30), 56, '#b3123a');
  bold(ctx, 'COUPAGE DE MAIN', 0, 22, span(22), 40);
  bold(ctx, 'POUR LES VOLEURS', 0, 68, span(68), 40);
  bold(ctx, '→ prison', 0, 116, span(116), 30, '#7a1a3a');
  ctx.restore();
}

// Logo central : bannière, couronne, lauriers
function drawLogo(ctx, cx, cy) {
  ctx.save();
  ctx.translate(cx, cy);
  ctx.lineJoin = 'round';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  const OUT = '#2a1030';
  // ombre portée douce sous l'ensemble
  ctx.fillStyle = 'rgba(30,8,60,0.35)';
  ctx.beginPath();
  ctx.ellipse(0, 40, 640, 210, 0, 0, Math.PI * 2);
  ctx.fill();

  // lauriers
  const laurel = (dir) => {
    ctx.save();
    ctx.scale(dir, 1);
    for (let k = 0; k < 9; k++) {
      const a = Math.PI * (0.62 + k * 0.06);
      const R = 430;
      const x = 120 + Math.cos(a) * -R * 0.2 + k * 52, y = 230 - Math.sin(k / 8 * Math.PI * 0.9) * 120 - k * 16;
      for (const side of [-1, 1]) {
        ctx.save();
        ctx.translate(x, y);
        ctx.rotate(-0.5 - k * 0.09 + side * 0.75);
        ctx.fillStyle = side > 0 ? '#ffd04a' : '#f2a91c';
        ctx.strokeStyle = '#6b3a08';
        ctx.lineWidth = 5;
        ctx.beginPath();
        ctx.ellipse(0, -30, 15, 34, 0, 0, Math.PI * 2);
        ctx.fill(); ctx.stroke();
        ctx.restore();
      }
    }
    ctx.strokeStyle = '#6b3a08';
    ctx.lineWidth = 10;
    ctx.beginPath();
    ctx.moveTo(110, 240);
    ctx.quadraticCurveTo(360, 230, 560, 70);
    ctx.stroke();
    ctx.restore();
  };
  laurel(1);
  laurel(-1);

  // queues de la bannière
  const tail = (dir) => {
    ctx.save();
    ctx.scale(dir, 1);
    ctx.fillStyle = '#a3142c';
    ctx.strokeStyle = OUT;
    ctx.lineWidth = 12;
    ctx.beginPath();
    ctx.moveTo(470, -40); ctx.lineTo(690, -40); ctx.lineTo(630, 55); ctx.lineTo(690, 150); ctx.lineTo(470, 150);
    ctx.closePath();
    ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#6e0c1f';
    ctx.beginPath();
    ctx.moveTo(470, 110); ctx.lineTo(560, 150); ctx.lineTo(470, 150); ctx.closePath();
    ctx.fill();
    ctx.restore();
  };
  tail(1);
  tail(-1);
  // bande principale
  ctx.fillStyle = '#e8344a';
  ctx.strokeStyle = OUT;
  ctx.lineWidth = 12;
  ctx.beginPath();
  ctx.moveTo(-560, -120); ctx.quadraticCurveTo(0, -170, 560, -120);
  ctx.lineTo(560, 110); ctx.quadraticCurveTo(0, 60, -560, 110);
  ctx.closePath();
  ctx.fill();
  ctx.save();
  ctx.clip();
  ctx.fillStyle = '#ff6a78';
  ctx.fillRect(-600, -170, 1200, 46);
  ctx.fillStyle = '#b81d38';
  ctx.beginPath();
  ctx.moveTo(-600, 70); ctx.quadraticCurveTo(0, 30, 600, 70); ctx.lineTo(600, 140); ctx.lineTo(-600, 140);
  ctx.fill();
  ctx.restore();
  ctx.stroke();
  // liseré doré
  ctx.strokeStyle = '#ffd04a';
  ctx.lineWidth = 7;
  ctx.beginPath();
  ctx.moveTo(-530, -100); ctx.quadraticCurveTo(0, -146, 530, -100);
  ctx.moveTo(-530, 88); ctx.quadraticCurveTo(0, 44, 530, 88);
  ctx.stroke();

  // couronne
  ctx.save();
  ctx.translate(0, -255);
  ctx.fillStyle = '#ffc531';
  ctx.strokeStyle = OUT;
  ctx.lineWidth = 11;
  ctx.beginPath();
  ctx.moveTo(-150, 80); ctx.lineTo(-170, -50); ctx.lineTo(-85, 10); ctx.lineTo(0, -85); ctx.lineTo(85, 10); ctx.lineTo(170, -50); ctx.lineTo(150, 80);
  ctx.closePath();
  ctx.fill(); ctx.stroke();
  ctx.fillStyle = '#fff1a8';
  ctx.beginPath();
  ctx.moveTo(-140, 50); ctx.lineTo(-155, -25); ctx.lineTo(-100, 15); ctx.closePath();
  ctx.fill();
  ctx.fillStyle = '#e09b10';
  ctx.fillRect(-150, 52, 300, 26);
  [[-170, -50], [0, -85], [170, -50]].forEach(([x, y]) => {
    ctx.fillStyle = '#ffe680';
    ctx.beginPath(); ctx.arc(x, y - 4, 17, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
  });
  [[-80, 40, '#e8344a'], [0, 32, '#3fb6ff'], [80, 40, '#2fd17a']].forEach(([x, y, c]) => {
    ctx.fillStyle = c;
    ctx.beginPath(); ctx.moveTo(x, y - 18); ctx.lineTo(x + 15, y); ctx.lineTo(x, y + 18); ctx.lineTo(x - 15, y); ctx.closePath();
    ctx.fill(); ctx.lineWidth = 6; ctx.stroke();
  });
  ctx.restore();

  // "LA" au-dessus, "GRINTA" sur la bannière, en relief
  const relief = (text, y, size, track) => {
    ctx.font = `700 ${size}px "Pixelify Sans", sans-serif`;
    if ('letterSpacing' in ctx) ctx.letterSpacing = track + 'px';
    for (let d = 16; d > 0; d -= 4) {
      ctx.fillStyle = '#4a1a52';
      ctx.fillText(text, 0, y + d);
    }
    ctx.lineWidth = 22;
    ctx.strokeStyle = OUT;
    ctx.strokeText(text, 0, y);
    const g = ctx.createLinearGradient(0, y - size / 2, 0, y + size / 2);
    g.addColorStop(0, '#ffffff');
    g.addColorStop(0.55, '#ffe3f0');
    g.addColorStop(0.56, '#ffb8d6');
    g.addColorStop(1, '#ff9cc8');
    ctx.fillStyle = g;
    ctx.fillText(text, 0, y);
    if ('letterSpacing' in ctx) ctx.letterSpacing = '0px';
  };
  relief('LA', -150, 110, 10);
  relief('GRINTA', -18, 250, 14);

  ctx.font = '600 44px "Pixelify Sans", sans-serif';
  ctx.lineWidth = 8;
  ctx.strokeStyle = 'rgba(40,10,70,0.6)';
  ctx.strokeText('Le serveur. Le business. La grinta.', 0, 300);
  ctx.fillStyle = '#ffe9a8';
  ctx.fillText('Le serveur. Le business. La grinta.', 0, 300);
  ctx.restore();
}

function drawTile(ctx, i) {
  const t = TILES[i];
  const w = W * S, h = CORNER * S;
  const corner = i % 10 === 0;
  const tw = corner ? h : w;
  ctx.fillStyle = BG;
  ctx.fillRect(-tw / 2, -h / 2, tw, h);
  ctx.strokeStyle = INK;
  ctx.lineWidth = 3;
  ctx.strokeRect(-tw / 2, -h / 2, tw, h);
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = INK;

  if (corner) {
    drawCorner(ctx, t, tw, h);
    return;
  }

  let y = -h / 2;
  if (t.type === 'prop') {
    const gc = GROUPS[t.group].color;
    ctx.fillStyle = gc;
    ctx.fillRect(-w / 2 + 2, y + 2, w - 4, 52);
    ctx.strokeRect(-w / 2, y, w, 54);
    // reflet
    ctx.fillStyle = 'rgba(255,255,255,0.25)';
    ctx.fillRect(-w / 2 + 2, y + 2, w - 4, 14);
    y += 54;
  } else {
    y += 10;
  }
  ctx.fillStyle = INK;
  let fs = 34;
  let lines;
  do {
    ctx.font = `700 ${fs}px "Pixelify Sans", sans-serif`;
    lines = wrap(ctx, t.name.toUpperCase(), w - 10);
    fs -= 2;
  } while ((lines.length > 3 || lines.some((l) => ctx.measureText(l).width > w - 8)) && fs > 18);
  const lh = fs + 4;
  lines.forEach((l, k) => ctx.fillText(l, 0, y + 6 + lh / 2 + k * lh));
  ctx.font = '60px "Noto Color Emoji", sans-serif';
  ctx.fillText(t.icon, 0, h / 2 - 84);
  const label = t.price ? t.price + ' €' : t.type === 'tax' ? '-' + t.amount + ' €' : '';
  if (label) {
    ctx.fillStyle = INK;
    ctx.fillRect(-w / 2 + 8, h / 2 - 50, w - 16, 42);
    ctx.fillStyle = '#ffffff';
    ctx.font = '700 32px Rubik, sans-serif';
    ctx.fillText(label, 0, h / 2 - 28);
  }
}

export const DECK_AT = 0.235;
const SIDE_ANGLE = [0, Math.PI / 2, Math.PI, -Math.PI / 2];

export function makeBoardTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = N * RES;
  const ctx = c.getContext('2d');
  ctx.scale(RES, RES);

  // centre : velours violet, motif losange large (pas de détail fin qui fourmille)
  const grd = ctx.createRadialGradient(N / 2, N / 2, 80, N / 2, N / 2, N * 0.62);
  grd.addColorStop(0, '#a27ad8');
  grd.addColorStop(1, '#8258c0');
  ctx.fillStyle = grd;
  ctx.fillRect(0, 0, N, N);
  ctx.fillStyle = 'rgba(255,255,255,0.045)';
  for (let a = -N; a < N * 2; a += 128) {
    for (let b = -N; b < N * 2; b += 128) {
      if (((a + b) / 128) % 2 === 0) continue;
      ctx.beginPath();
      ctx.moveTo(a, b - 64); ctx.lineTo(a + 64, b); ctx.lineTo(a, b + 64); ctx.lineTo(a - 64, b);
      ctx.fill();
    }
  }

  for (let i = 0; i < 40; i++) {
    const p = tileCenter(i);
    ctx.save();
    ctx.translate((p.x + SIZE / 2) * S, (p.z + SIZE / 2) * S);
    ctx.rotate(SIDE_ANGLE[p.side]);
    drawTile(ctx, i);
    ctx.restore();
  }
  ctx.strokeStyle = INK;
  ctx.lineWidth = 8;
  ctx.strokeRect(4, 4, N - 8, N - 8);
  ctx.strokeRect(CORNER * S, CORNER * S, N - 2 * CORNER * S, N - 2 * CORNER * S);

  drawLogo(ctx, N / 2, N / 2 - 30);

  // emplacements des cartes
  const card = (cx, cy, rot, label, color, icon) => {
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(rot);
    ctx.fillStyle = 'rgba(40,16,90,0.35)';
    roundRect(ctx, -150, -100, 300, 200, 22);
    ctx.fill();
    ctx.setLineDash([16, 10]);
    ctx.strokeStyle = color;
    ctx.lineWidth = 5;
    roundRect(ctx, -150, -100, 300, 200, 22);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillStyle = color;
    ctx.textAlign = 'center';
    ctx.font = '70px "Noto Color Emoji"';
    ctx.fillText(icon, 0, -10);
    ctx.font = '30px "Pixelify Sans", sans-serif';
    ctx.fillText(label, 0, 70);
    ctx.restore();
  };
  card(N * DECK_AT, N * DECK_AT, -Math.PI / 4, 'PING @EVERYONE', '#bcd0ff', '🔔');
  card(N * (1 - DECK_AT), N * (1 - DECK_AT), -Math.PI / 4, 'GRINTA CORP', '#ffd29a', '💼');

  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 8;
  return tex;
}

export async function loadFonts() {
  try {
    await Promise.all([
      document.fonts.load('150px "Pixelify Sans"'),
      document.fonts.load('700 23px "Pixelify Sans"'),
      document.fonts.load('600 23px "Pixelify Sans"'),
      document.fonts.load('62px "Noto Color Emoji"'),
      document.fonts.load('700 32px Rubik'),
    ]);
  } catch {
    /* polices système en secours */
  }
}
