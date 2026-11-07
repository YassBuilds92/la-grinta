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
    const bg = { go: '#ffd0a8', jail: '#d7d9ff', parking: '#d5f5e3', gotojail: '#ffc9c9' }[t.type];
    ctx.fillStyle = bg;
    ctx.fillRect(-tw / 2 + 4, -h / 2 + 4, tw - 8, h - 8);
    ctx.save();
    ctx.rotate(-Math.PI / 4);
    ctx.fillStyle = INK;
    ctx.font = '84px "Noto Color Emoji", sans-serif';
    ctx.fillText(t.icon, 0, -22);
    ctx.font = '700 ' + (t.name.length > 9 ? '30px' : '38px') + ' "Pixelify Sans", sans-serif';
    ctx.fillText(t.name, 0, 52);
    if (t.type === 'go') {
      ctx.font = '700 26px "Pixelify Sans", sans-serif';
      ctx.fillText('+200 € en passant', 0, -88);
    }
    if (t.type === 'jail') {
      ctx.font = '700 26px "Pixelify Sans", sans-serif';
      ctx.fillText('juste en visite', 0, -88);
    }
    ctx.restore();
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

const SIDE_ANGLE = [0, Math.PI / 2, Math.PI, -Math.PI / 2];

export function makeBoardTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = N * RES;
  const ctx = c.getContext('2d');
  ctx.scale(RES, RES);

  // centre
  const grd = ctx.createRadialGradient(N / 2, N / 2, 100, N / 2, N / 2, N * 0.6);
  grd.addColorStop(0, '#fffdf6');
  grd.addColorStop(1, '#ffe7c4');
  ctx.fillStyle = grd;
  ctx.fillRect(0, 0, N, N);
  // grille néon
  ctx.strokeStyle = 'rgba(255,122,26,0.10)';
  ctx.lineWidth = 2;
  for (let k = 0; k < N; k += 64) {
    ctx.beginPath(); ctx.moveTo(k, 0); ctx.lineTo(k, N); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(0, k); ctx.lineTo(N, k); ctx.stroke();
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

  // logo : blason Grinta + titre
  ctx.save();
  ctx.translate(N / 2, N / 2);
  ctx.rotate(-Math.PI / 4);
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  // blason
  ctx.save();
  ctx.translate(0, -175);
  ctx.shadowColor = 'rgba(255,90,0,0.35)';
  ctx.shadowBlur = 30;
  ctx.fillStyle = '#ff7a1a';
  ctx.beginPath();
  ctx.arc(0, 0, 105, 0, Math.PI * 2);
  ctx.fill();
  ctx.shadowBlur = 0;
  ctx.strokeStyle = '#1a1214';
  ctx.lineWidth = 9;
  ctx.beginPath();
  ctx.arc(0, 0, 86, 0, Math.PI * 2);
  ctx.stroke();
  ctx.fillStyle = '#1a1214';
  ctx.font = '700 130px "Pixelify Sans", sans-serif';
  ctx.fillText('G', 0, 8);
  ctx.restore();
  ctx.font = '700 170px "Pixelify Sans", sans-serif';
  ctx.lineJoin = 'round';
  ctx.lineWidth = 16;
  ctx.strokeStyle = '#1d1b2e';
  ctx.strokeText('LA GRINTA', 0, 40);
  ctx.fillStyle = '#ff7a1a';
  ctx.fillText('LA GRINTA', 0, 40);
  ctx.shadowBlur = 0;
  ctx.font = '600 40px "Pixelify Sans", sans-serif';
  ctx.fillStyle = '#5a3a2a';
  ctx.fillText('Le serveur. Le business. La grinta.', 0, 150);
  ctx.restore();

  // emplacements des cartes
  const card = (cx, cy, rot, label, color, icon) => {
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(rot);
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
  card(N * 0.3, N * 0.3, -Math.PI / 4, 'PING @EVERYONE', '#4a5fe0', '🔔');
  card(N * 0.7, N * 0.7, -Math.PI / 4, 'GRINTA CORP', '#e06a00', '💼');

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
