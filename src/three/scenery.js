import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { detailTex, worldUV, glow } from './pixeltex.js';

// Décor autour du plateau : esplanade, village sur la falaise, lac au dragon, scène du Grinta Fest.
// Tout est fait en blocs (voxel), fusionnés par couleur pour garder peu d'appels de dessin.

// ---------- outils ----------
function rng(seed) {
  let s = seed >>> 0;
  return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296);
}
const matCache = new Map();
function mat(color, emissive = null, ei = 1, tex = null) {
  const key = color + '|' + emissive + '|' + ei + '|' + tex;
  if (!matCache.has(key)) matCache.set(key, new THREE.MeshStandardMaterial({ color, roughness: 0.85, map: tex ? detailTex(tex) : null, emissive: emissive || '#000000', emissiveIntensity: emissive ? ei : 1 }));
  return matCache.get(key);
}

// Texture de détail associée à chaque couleur du décor
const TEX_OF = {
  '#e9a86c': 'rock', '#dd9660': 'rock', '#f2bd84': 'rock', '#c9844f': 'rock', '#f6d2a6': 'rock',
  '#7fd05a': 'grass', '#4fb84a': 'grass', '#5cc756': 'grass', '#7ad85e': 'grass', '#3f9a3e': 'grass', '#4fbf55': 'grass',
  '#ff7a2e': 'roof', '#f0622a': 'roof', '#ff9a52': 'roof',
  '#fff4e0': 'wall', '#ffe9c8': 'wall', '#e9c49a': 'rock',
  '#8a5a34': 'wood', '#7a4a2e': 'wood', '#6b4426': 'wood', '#b88a5c': 'wood', '#5a3420': 'wood',
  '#c9c2dc': 'truss', '#4a3a6a': 'wood', '#a8784a': 'wood', '#946640': 'wood', '#fff1dc': 'wall',
};
// Accumule des formes par matériau puis les fusionne
class Vox {
  constructor() {
    this.parts = new Map();
  }
  add(geo, color, x, y, z, ry = 0, emissive = null, ei = 1) {
    const g = geo.index ? geo.toNonIndexed() : geo;
    if (ry) g.rotateY(ry);
    g.translate(x, y, z);
    const key = color + '|' + emissive + '|' + ei;
    if (!this.parts.has(key)) this.parts.set(key, { color, emissive, ei, list: [] });
    this.parts.get(key).list.push(g);
    return this;
  }
  // boîte posée au sol (y = bas de la boîte)
  box(color, w, h, d, x, y, z, ry = 0, emissive = null, ei = 1) {
    return this.add(new THREE.BoxGeometry(w, h, d), color, x, y + h / 2, z, ry, emissive, ei);
  }
  build({ cast = false, receive = true } = {}) {
    const g = new THREE.Group();
    for (const p of this.parts.values()) {
      const tex = p.emissive ? null : TEX_OF[p.color] || null;
      const geo = mergeGeometries(p.list);
      if (tex) worldUV(geo, 16, tex === 'rock' ? 64 : 32);
      const m = new THREE.Mesh(geo, mat(p.color, p.emissive, p.ei, tex));
      m.castShadow = cast;
      m.receiveShadow = receive;
      g.add(m);
    }
    return g;
  }
}

// Fusionne les meshes enfants directs d'un groupe par matériau (les sous-groupes animés restent à part)
function bake(group) {
  const by = new Map();
  for (const c of [...group.children]) {
    if (!c.isMesh || c.isInstancedMesh) continue;
    c.updateMatrix();
    const geo = (c.geometry.index ? c.geometry.toNonIndexed() : c.geometry.clone()).applyMatrix4(c.matrix);
    for (const k of Object.keys(geo.attributes)) if (!['position', 'normal', 'uv'].includes(k)) geo.deleteAttribute(k);
    if (!by.has(c.material)) by.set(c.material, []);
    by.get(c.material).push(geo);
    group.remove(c);
  }
  for (const [m, list] of by) group.add(new THREE.Mesh(mergeGeometries(list), m));
  return group;
}

function canvasTex(w, h, draw, { nearest = false } = {}) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  if (nearest) t.magFilter = THREE.NearestFilter;
  t.minFilter = THREE.LinearMipmapLinearFilter;
  return t;
}

// ---------- esplanade ----------
function plaza(root) {
  // dalles en terre cuite : gros carreaux, contraste doux (pas de motif fin qui fourmille au loin)
  const tex = canvasTex(256, 256, (x) => {
    const r = rng(7);
    for (let i = 0; i < 4; i++)
      for (let j = 0; j < 4; j++) {
        const v = r();
        x.fillStyle = v < 0.33 ? '#f3c29a' : v < 0.66 ? '#efb68c' : '#f6caa6';
        x.fillRect(i * 64, j * 64, 64, 64);
        x.fillStyle = 'rgba(255,246,232,0.4)';
        x.fillRect(i * 64 + 4, j * 64 + 4, 56, 6);
      }
    x.fillStyle = '#e2ab8a';
    for (let k = 0; k < 4; k++) {
      x.fillRect(k * 64, 0, 4, 256);
      x.fillRect(0, k * 64, 256, 4);
    }
  });
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(7, 7);
  const top = new THREE.MeshStandardMaterial({ map: tex, roughness: 0.9 });
  const side = new THREE.MeshStandardMaterial({ color: '#e8d2b4', roughness: 0.9 });
  const geo = new THREE.CylinderGeometry(11.5, 11.9, 1.2, 8);
  geo.rotateY(Math.PI / 8);
  const p = new THREE.Mesh(geo, [side, top, side]);
  p.position.y = -0.25 - 0.6;
  p.receiveShadow = true;
  root.add(p);
  // margelle en pierre claire
  const v = new Vox();
  for (let k = 0; k < 8; k++) {
    const a = (k / 8) * Math.PI * 2 + Math.PI / 8;
    const r = 11.5 * Math.cos(Math.PI / 8) - 0.3;
    const len = 2 * 11.5 * Math.sin(Math.PI / 8);
    v.box('#e9c49a', len, 0.18, 0.6, Math.sin(a) * r, -0.25, Math.cos(a) * r, a);
  }
  // lanternes aux 4 coins
  const lanterns = [];
  for (const [x, z] of [[-7.6, -7.6], [7.6, -7.6]]) {
    v.box('#7a4a2e', 0.26, 2.4, 0.26, x, -0.25, z);
    v.box('#5a3420', 0.5, 0.18, 0.5, x, -0.25, z);
    v.box('#7a4a2e', 0.9, 0.14, 0.14, x, 2.0, z);
    lanterns.push([x + 0.35, 1.55, z]);
    // pots de fleurs
    v.box('#c0603a', 0.7, 0.5, 0.7, x + (x > 0 ? -1.1 : 1.1), -0.25, z);
    v.box('#4fbf55', 0.62, 0.36, 0.62, x + (x > 0 ? -1.1 : 1.1), 0.25, z);
    v.box('#ff5fa2', 0.2, 0.2, 0.2, x + (x > 0 ? -1.0 : 1.2), 0.58, z + 0.12);
    v.box('#ffd23f', 0.2, 0.2, 0.2, x + (x > 0 ? -1.25 : 0.95), 0.58, z - 0.12);
  }
  root.add(v.build());
  const lg = [];
  for (const [x, y, z] of lanterns) {
    const g = new THREE.Group();
    g.position.set(x, y + 0.45, z);
    const body = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.42, 0.34), mat('#ff6a3d', '#ff8a3d', 1.4));
    body.position.y = -0.4;
    const cap = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.08, 0.42), mat('#5a3420'));
    cap.position.y = -0.15;
    g.add(body, cap);
    const lgw = glow('#ffa04a', 1.4, 0.65);
    lgw.position.y = -0.4;
    g.add(lgw);
    root.add(g);
    lg.push(g);
  }
  return (t) => lg.forEach((g, k) => (g.rotation.z = Math.sin(t * 1.3 + k * 1.7) * 0.06));
}

// ---------- terre, eau, ciel ----------
function land(root) {
  // île de verdure autour de l'esplanade, avec une baie à l'arrière où sort le dragon
  const shape = new THREE.Shape();
  const n = 72;
  for (let k = 0; k <= n; k++) {
    const a = (k / n) * Math.PI * 2; // a = 0 vers l'arrière (z négatif)
    const bay = Math.exp(-Math.pow(Math.atan2(Math.sin(a), Math.cos(a)) / 0.42, 2));
    const r = 30 - bay * 14.5 + Math.sin(a * 5) * 0.8;
    const x = Math.sin(a) * r, y = -Math.cos(a) * r; // y du shape = z monde
    k ? shape.lineTo(x, y) : shape.moveTo(x, y);
  }
  const geo = new THREE.ExtrudeGeometry(shape, { depth: 1, bevelEnabled: false, curveSegments: 1 });
  geo.rotateX(Math.PI / 2); // le shape passe dans le plan xz, extrusion vers le bas
  const g = new THREE.Mesh(geo, [mat('#a2d27a'), mat('#f1d59a')]);
  g.position.y = -1.0;
  g.receiveShadow = true;
  root.add(g);

  // eau : grand disque, couleur lagon au coucher du soleil
  const water = new THREE.Mesh(new THREE.CircleGeometry(95, 48), new THREE.MeshStandardMaterial({ color: '#86b8ee', roughness: 0.4, emissive: '#c07ad8', emissiveIntensity: 0.16 }));
  water.rotation.x = -Math.PI / 2;
  water.position.y = -1.55;
  root.add(water);

  // reflets du soleil sur l'eau : bandes larges qui ondulent lentement
  const glints = [];
  const r = rng(11);
  for (let k = 0; k < 14; k++) {
    const m = new THREE.Mesh(new THREE.BoxGeometry(1.2 + r() * 2.4, 0.04, 0.22), mat('#fff3d6', '#ffe0b0', 0.6));
    m.position.set(-14 + r() * 28, -1.5, -18 - r() * 30);
    m.userData.ph = r() * 6;
    m.userData.x0 = m.position.x;
    root.add(m);
    glints.push(m);
  }
  return (t) =>
    glints.forEach((m) => {
      m.position.x = m.userData.x0 + Math.sin(t * 0.5 + m.userData.ph) * 0.6;
      m.scale.x = 0.75 + Math.sin(t * 0.9 + m.userData.ph) * 0.25;
    });
}

// ---------- village sur la falaise (côté gauche) ----------
function emblemTexture() {
  return canvasTex(256, 384, (x, w, h) => {
    x.fillStyle = '#e23a3a';
    x.fillRect(0, 0, w, h);
    x.fillStyle = '#b52030';
    x.fillRect(0, h - 70, w, 70);
    x.fillStyle = '#ffd04a';
    x.fillRect(0, 0, w, 14);
    x.fillRect(0, h - 84, w, 10);
    // emblème La Grinta : flamme dans un cercle
    x.translate(w / 2, 150);
    x.strokeStyle = '#ffd04a';
    x.lineWidth = 14;
    x.beginPath();
    x.arc(0, 0, 82, 0, Math.PI * 2);
    x.stroke();
    x.fillStyle = '#ffd04a';
    x.beginPath();
    x.moveTo(0, -62);
    x.bezierCurveTo(44, -20, 50, 20, 30, 46);
    x.bezierCurveTo(14, 64, -14, 64, -30, 46);
    x.bezierCurveTo(-50, 20, -30, -6, -18, -20);
    x.bezierCurveTo(-14, 0, -4, 6, 4, 8);
    x.bezierCurveTo(-4, -20, 0, -40, 0, -62);
    x.fill();
    x.fillStyle = '#fff6c8';
    x.beginPath();
    x.moveTo(0, 0);
    x.bezierCurveTo(20, 18, 18, 40, 0, 48);
    x.bezierCurveTo(-18, 40, -18, 20, 0, 0);
    x.fill();
    x.fillStyle = '#ffd04a';
    x.font = '700 40px "Pixelify Sans", sans-serif';
    x.textAlign = 'center';
    x.fillText('GRINTA', 0, 140);
  });
}

function house(v, x, y, z, s, ry, r) {
  const wall = r() < 0.5 ? '#fff4e0' : '#ffe9c8';
  const roof = r() < 0.5 ? '#ff7a2e' : '#f0622a';
  const W = 2.2 * s, D = 1.8 * s, H = 1.4 * s;
  const c = Math.cos(ry), sn = Math.sin(ry);
  const at = (lx, lz) => [x + lx * c + lz * sn, z - lx * sn + lz * c];
  v.box('#b88a5c', W + 0.1, 0.25 * s, D + 0.1, x, y, z, ry);
  v.box(wall, W, H, D, x, y + 0.25 * s, z, ry);
  // poutres
  for (const lx of [-W / 2, W / 2]) {
    const [px, pz] = at(lx, D / 2);
    v.box('#8a5a34', 0.16 * s, H, 0.16 * s, px, y + 0.25 * s, pz, ry);
  }
  // fenêtres chaudes
  for (const lx of [-W / 4, W / 4]) {
    const [px, pz] = at(lx, D / 2 + 0.02);
    v.box('#ffd77a', 0.42 * s, 0.42 * s, 0.06, px, y + 0.25 * s + H * 0.38, pz, ry, '#ffb84a', 0.9);
  }
  // toit à deux étages, débord généreux
  v.box(roof, W + 0.7 * s, 0.32 * s, D + 0.7 * s, x, y + 0.25 * s + H, z, ry);
  v.box('#ff9a52', W + 0.2 * s, 0.3 * s, D + 0.2 * s, x, y + 0.57 * s + H, z, ry);
  v.box(roof, W * 0.55, 0.3 * s, D * 0.6, x, y + 0.87 * s + H, z, ry);
}

function tree(v, x, y, z, s, r) {
  v.box('#8a5a34', 0.3 * s, 1.0 * s, 0.3 * s, x, y, z);
  const g1 = r() < 0.5 ? '#4fb84a' : '#5cc756';
  v.box(g1, 1.5 * s, 0.9 * s, 1.5 * s, x, y + 0.9 * s, z);
  v.box('#7ad85e', 1.1 * s, 0.7 * s, 1.1 * s, x + 0.05, y + 1.7 * s, z - 0.05);
  v.box('#3f9a3e', 1.6 * s, 0.25 * s, 1.6 * s, x, y + 0.75 * s, z);
}

function village(parent) {
  const root = new THREE.Group();
  root.position.set(0.5, 0, -6.5);
  parent.add(root);
  const v = new Vox();
  const r = rng(21);
  const rock = ['#e9a86c', '#dd9660', '#f2bd84'];
  // falaise en gradins (le bas trempe dans l'eau à l'arrière)
  const tiers = [
    { x: -21, z: -12, w: 13, d: 17, y0: -1.5, h: 4.6 },
    { x: -22.5, z: -15, w: 10, d: 11, y0: 3.1, h: 3.4 },
    { x: -23.5, z: -18, w: 7, d: 7, y0: 6.5, h: 3.4 },
  ];
  for (const t of tiers) {
    v.box(rock[0], t.w, t.h, t.d, t.x, t.y0, t.z);
    // blocs en saillie pour un relief taillé
    for (let k = 0; k < 18; k++) {
      const face = k % 3;
      const bw = 1 + r() * 2.2, bh = 0.8 + r() * (t.h - 0.8), bd = 0.6 + r() * 0.6;
      const by = t.y0 + r() * (t.h - bh);
      if (face === 0) v.box(rock[(k % 2) + 1], bw, bh, bd, t.x - t.w / 2 + 1 + r() * (t.w - 2), by, t.z + t.d / 2 + bd / 2 - 0.3);
      else if (face === 1) v.box(rock[(k % 2) + 1], bd, bh, bw, t.x + t.w / 2 + bd / 2 - 0.3, by, t.z - t.d / 2 + 1 + r() * (t.d - 2));
      else v.box('#c9844f', bw, 0.35, bd + 0.6, t.x - t.w / 2 + 1 + r() * (t.w - 2), t.y0 + t.h - 0.1, t.z + t.d / 2 - 0.4);
    }
    // herbe sur le dessus
    v.box('#7fd05a', t.w - 0.3, 0.22, t.d - 0.3, t.x, t.y0 + t.h, t.z);
  }
  // escalier taillé vers l'esplanade
  for (let k = 0; k < 6; k++) v.box('#f6d2a6', 2, 0.55 * (k + 1), 1, -14.2 + k * 0.0, -1, -4.6 + k * -1.0);

  // maisons sur les gradins
  house(v, -17.5, 3.1, -6.2, 1.0, 0.5, r);
  house(v, -22.5, 3.1, -6.5, 0.9, 0.2, r);
  house(v, -16.8, 3.1, -11.5, 0.85, 0.9, r);
  house(v, -19.5, 6.5, -11.5, 0.9, 0.55, r);
  house(v, -24.5, 6.5, -12.8, 0.8, 0.3, r);
  house(v, -22, 9.9, -16.5, 1.1, 0.6, r);
  // tour de guet avec drapeau
  v.box('#fff4e0', 1.6, 4.2, 1.6, -26, 9.9, -16);
  v.box('#ff7a2e', 2.4, 0.35, 2.4, -26, 14.1, -16);
  v.box('#ff9a52', 1.4, 0.6, 1.4, -26, 14.45, -16);
  v.box('#ffd77a', 0.5, 0.6, 0.06, -26, 12.2, -15.2, 0, '#ffb84a', 0.9);
  v.box('#6b4426', 0.12, 2.6, 0.12, -26, 15, -16);
  // arbres
  [[-15.5, 3.1, -9], [-26.5, 3.1, -8], [-18, 6.5, -15.5], [-25.8, 6.5, -10.6], [-20, 9.9, -19.5], [-13.2, -1, -14], [-12.5, -1, -2], [-15, -1, 3.5], [-19, -1, 6], [-24, -1, 3], [-11.5, -1, 9]].forEach(([x, y, z], k) =>
    tree(v, x, y, z, 0.8 + (k % 3) * 0.18, r),
  );
  const g = v.build();
  root.add(g);

  // grande bannière avec l'emblème, accrochée à la falaise face au plateau
  const banner = new THREE.Group();
  const cloth = new THREE.Mesh(new THREE.PlaneGeometry(2.6, 3.9, 1, 6), new THREE.MeshStandardMaterial({ map: emblemTexture(), roughness: 0.8, side: THREE.DoubleSide }));
  cloth.position.y = -1.95;
  banner.add(cloth);
  const bar = new THREE.Mesh(new THREE.BoxGeometry(3.1, 0.18, 0.18), mat('#6b4426'));
  banner.add(bar);
  banner.position.set(-14.35, 2.9, -7.5);
  banner.rotation.y = Math.PI / 2 - 0.15;
  root.add(banner);
  const pos = cloth.geometry.attributes.position;
  const base = pos.array.slice();

  // drapeau sur la tour
  const flag = new THREE.Mesh(new THREE.PlaneGeometry(1.4, 0.8, 6, 1), new THREE.MeshStandardMaterial({ color: '#ff3d6e', side: THREE.DoubleSide, roughness: 0.8 }));
  flag.position.set(-25.25, 17.2, -16);
  root.add(flag);
  const fpos = flag.geometry.attributes.position;
  const fbase = fpos.array.slice();

  return (t) => {
    for (let i = 0; i < pos.count; i++) {
      const y = base[i * 3 + 1];
      const k = (1.95 - y) / 3.9; // 0 en haut, 1 en bas
      pos.setZ(i, Math.sin(t * 1.6 + y * 1.4) * 0.12 * k);
    }
    pos.needsUpdate = true;
    cloth.geometry.computeVertexNormals();
    for (let i = 0; i < fpos.count; i++) {
      const x = fbase[i * 3];
      fpos.setZ(i, Math.sin(t * 4 - x * 3) * 0.12 * (x + 0.7));
    }
    fpos.needsUpdate = true;
  };
}

// ---------- rochers et dragon du lac ----------
function ridgeRing(radius, base, amp, color, seed, step) {
  // crête de montagnes en anneau, silhouettes en escalier façon pixel art
  const r = rng(seed);
  const n = 160;
  const hs = [];
  let h = amp * 0.5;
  for (let k = 0; k < n; k++) {
    h += (r() - 0.5) * amp * 0.45;
    h = Math.max(amp * 0.15, Math.min(amp, h));
    hs.push(Math.round(h / step) * step);
  }
  // pics marqués
  for (let k = 0; k < 9; k++) {
    const c = Math.floor(r() * n), w = 3 + Math.floor(r() * 6), top = amp * (1.1 + r() * 0.7);
    for (let j = -w; j <= w; j++) {
      const i = (c + j + n) % n;
      hs[i] = Math.max(hs[i], Math.round((top * (1 - Math.abs(j) / (w + 1))) / step) * step);
    }
  }
  const pos = [];
  for (let k = 0; k < n; k++) {
    const a0 = (k / n) * Math.PI * 2, a1 = ((k + 1) / n) * Math.PI * 2;
    const x0 = Math.sin(a0) * radius, z0 = -Math.cos(a0) * radius, x1 = Math.sin(a1) * radius, z1 = -Math.cos(a1) * radius;
    const y = base + hs[k];
    pos.push(x0, base - 20, z0, x1, base - 20, z1, x1, y, z1, x0, base - 20, z0, x1, y, z1, x0, y, z0);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  const m = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color, fog: false, side: THREE.DoubleSide }));
  m.userData.noToon = true;
  return m;
}

function sky(root, scene) {
  // dôme de ciel : lavande en haut, rose, puis orange doré à l'horizon, avec la lueur du soleil
  const dome = new THREE.Mesh(
    new THREE.SphereGeometry(120, 32, 16),
    new THREE.ShaderMaterial({
      side: THREE.BackSide,
      depthWrite: false,
      fog: false,
      uniforms: { sunDir: { value: new THREE.Vector3(-0.08, 0.1, -1).normalize() } },
      vertexShader: 'varying vec3 vD; void main(){ vD = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.); }',
      fragmentShader: `
        uniform vec3 sunDir; varying vec3 vD;
        void main(){
          float h = vD.y;
          vec3 top = vec3(0.40, 0.29, 0.74), mid = vec3(0.86, 0.46, 0.76), hor = vec3(1.0, 0.74, 0.52);
          vec3 c = mix(hor, mid, smoothstep(-0.02, 0.18, h));
          c = mix(c, top, smoothstep(0.18, 0.62, h));
          float s = max(dot(vD, sunDir), 0.);
          c += vec3(1.0, 0.72, 0.42) * pow(s, 10.) * 0.55 + vec3(1.0, 0.9, 0.6) * pow(s, 90.) * 0.6;
          gl_FragColor = vec4(c, 1.);
        }`,
    }),
  );
  dome.renderOrder = -10;
  dome.frustumCulled = false;
  dome.userData.noToon = true;
  root.add(dome);
  // soleil couchant
  const sun = new THREE.Mesh(new THREE.CircleGeometry(6, 16), new THREE.MeshBasicMaterial({ color: '#fff0b0', fog: false }));
  sun.position.set(-8, 9, -100);
  sun.userData.noToon = true;
  root.add(sun);
  const sg = glow('#ffb36b', 46, 0.75);
  sg.position.set(-8, 9, -99);
  root.add(sg);
  // trois couches de montagnes, de plus en plus pâles avec la distance : la profondeur vient d'elles
  root.add(ridgeRing(100, -4, 22, '#e9a8cf', 31, 1.5));
  root.add(ridgeRing(86, -4, 16, '#c98ac4', 32, 1.2));
  root.add(ridgeRing(72, -4, 11, '#a46fb8', 33, 1.0));
  // nuages roses qui dérivent, éclairés par en dessous
  const r = rng(3);
  const clouds = [];
  for (let k = 0; k < 9; k++) {
    const g = new THREE.Group();
    const w = 7 + r() * 8;
    const parts = new Vox();
    parts.box('#ffe6f2', w, 1.2, 3, 0, 0, 0);
    parts.box('#fff6fb', w * 0.55, 1.2, 2.4, -w * 0.12, 1.1, 0);
    parts.box('#ffb8a0', w * 0.95, 0.55, 3.1, 0.3, -0.5, 0.05);
    const b = parts.build({ receive: false });
    b.traverse((o) => o.material && (o.material = new THREE.MeshBasicMaterial({ color: o.material.color, fog: false })));
    g.add(b);
    const a = -0.9 + (k / 8) * 1.8 + (r() - 0.5) * 0.2;
    const rad = 70 + r() * 15;
    g.position.set(Math.sin(a) * rad, 18 + r() * 14, -Math.cos(a) * rad);
    g.lookAt(0, g.position.y, 0);
    g.userData.v = 0.2 + r() * 0.25;
    root.add(g);
    clouds.push(g);
  }
  return (t, dt, cam) => {
    if (cam) dome.position.copy(cam.position);
    clouds.forEach((g) => {
      g.position.x += g.userData.v * dt;
      if (g.position.x > 80) g.position.x = -80;
    });
  };
}

function rockPillar(x, z, h, rad, seed, tones) {
  const r = rng(seed);
  const geo = new THREE.CylinderGeometry(rad * (0.35 + r() * 0.2), rad, h, 7, 5);
  const p = geo.attributes.position;
  // déformation stable (même sommet = même décalage, pas de fissure aux coutures)
  const hash = (a, b, c) => {
    const s = Math.sin(a * 12.9898 + b * 78.233 + c * 37.719 + seed) * 43758.5453;
    return s - Math.floor(s);
  };
  for (let i = 0; i < p.count; i++) {
    const vx = p.getX(i), vy = p.getY(i), vz = p.getZ(i);
    const k = 0.75 + hash(Math.round(vx * 10), Math.round(vy * 10), Math.round(vz * 10)) * 0.5;
    const lean = (vy / h + 0.5) * rad * 0.35;
    p.setXYZ(i, vx * k + lean * Math.sin(seed), vy + (hash(vx, vy, vz) - 0.5) * 0.4, vz * k + lean * Math.cos(seed));
  }
  geo.translate(0, h / 2, 0);
  const geo2 = geo.toNonIndexed();
  geo2.computeVertexNormals();
  worldUV(geo2, 10, 64);
  const m = new THREE.Mesh(geo2, new THREE.MeshStandardMaterial({ color: tones[seed % tones.length], map: detailTex('rock'), flatShading: true, roughness: 0.9 }));
  m.position.set(x, -1.6, z);
  m.rotation.y = r() * 6;
  return m;
}

function spires(root) {
  const g = new THREE.Group();
  const tones = ['#9c79b8', '#8d6aae', '#ae8cc6'];
  const spot = [[-12.5, -28, 13, 3.2], [-9, -40, 9, 2.8], [11, -29, 11, 3.0], [16, -38, 17, 4.0], [-18, -36, 16, 3.6], [21, -28, 8, 2.8], [8, -50, 6, 3], [26, -40, 12, 3.6], [-26, -31, 8, 2.6], [-14, -52, 7, 3]];
  spot.forEach(([x, z, h, rad], k) => {
    g.add(rockPillar(x, z, h, rad, 11 + k * 7, tones));
    // touffe de verdure au sommet
    const cap = new THREE.Mesh(new THREE.CylinderGeometry(rad * 0.5, rad * 0.42, 0.5, 7), mat('#7cc95c'));
    cap.position.set(x, -1.6 + h - 0.1, z);
    if (k % 3 !== 2) g.add(cap);
  });
  root.add(g);
}

function wingGeo(sx) {
  // membrane en éventail avec bord festonné (coordonnées miroir pour garder les normales correctes)
  const pts = [[0, 0], [1.4, 2.5], [3.0, 3.6], [5.0, 3.9], [4.5, 2.3], [3.9, 1.5], [3.4, 2.0], [2.9, 0.6], [2.2, 1.0], [1.5, -0.4]];
  const s = new THREE.Shape();
  const P = sx > 0 ? pts : pts.slice().reverse();
  P.forEach(([x, y], k) => (k ? s.lineTo(x * sx, y) : s.moveTo(x * sx, y)));
  const g = new THREE.ExtrudeGeometry(s, { depth: 0.1, bevelEnabled: false });
  g.translate(0, 0, -0.05);
  return g;
}

function dragon(root) {
  const g = new THREE.Group();
  g.position.set(1.5, -2.7, -25);
  g.scale.setScalar(1.3);
  root.add(g);
  const body = new THREE.MeshStandardMaterial({ color: '#9254cc', map: detailTex('scales'), roughness: 0.8 });
  const belly = new THREE.MeshStandardMaterial({ color: '#e2c6ff', roughness: 0.8 });
  const dark = mat('#4e2a9c');
  const horn = mat('#fff0d0');
  const add = (parent, geo, m, x, y, z) => {
    const o = new THREE.Mesh(geo, m);
    o.position.set(x, y, z);
    parent.add(o);
    return o;
  };

  // buste qui sort de l'eau
  const chest = new THREE.Group();
  g.add(chest);
  add(chest, new THREE.BoxGeometry(3.4, 3.2, 2.6), body, 0, 1.0, 0);
  add(chest, new THREE.BoxGeometry(2.4, 2.6, 0.3), belly, 0, 1.2, 1.35);
  for (let k = 0; k < 4; k++) add(chest, new THREE.BoxGeometry(2.0, 0.12, 0.34), mat('#b98cff'), 0, 0.3 + k * 0.62, 1.42);
  for (let k = 0; k < 3; k++) {
    const sp = add(chest, new THREE.BoxGeometry(0.26, 0.8, 0.8), dark, 0, 0.7 + k * 0.9, -1.35);
    sp.rotation.x = Math.PI / 4;
  }
  // bras griffus posés dans l'eau devant lui
  for (const sx of [-1, 1]) {
    const arm = add(chest, new THREE.BoxGeometry(0.8, 2.0, 0.8), body, sx * 1.9, 1.0, 1.1);
    arm.rotation.x = 0.5;
    arm.rotation.z = sx * 0.2;
    add(chest, new THREE.BoxGeometry(1.0, 0.5, 1.2), body, sx * 2.1, 0.15, 1.9);
    for (let c = -1; c <= 1; c++) add(chest, new THREE.BoxGeometry(0.16, 0.2, 0.42), horn, sx * 2.1 + c * 0.3, 0.12, 2.6);
  }

  // ailes
  const wings = [];
  for (const sx of [-1, 1]) {
    const w = new THREE.Group();
    w.position.set(sx * 1.4, 2.2, -0.7);
    const mem = new THREE.Mesh(wingGeo(sx), mat('#c39cff'));
    w.add(mem);
    // os du bord d'attaque + doigts
    const bone = (x0, y0, x1, y1, t) => {
      const len = Math.hypot(x1 - x0, y1 - y0);
      const b = add(w, new THREE.BoxGeometry(len, t, t), dark, sx * (x0 + x1) / 2, (y0 + y1) / 2, 0.08);
      b.rotation.z = Math.atan2(y1 - y0, (x1 - x0) * sx);
    };
    bone(0, 0, 1.4, 2.5, 0.32);
    bone(1.4, 2.5, 3.0, 3.6, 0.26);
    bone(3.0, 3.6, 5.0, 3.9, 0.2);
    bone(3.0, 3.6, 3.9, 1.5, 0.12);
    bone(1.4, 2.5, 2.9, 0.6, 0.12);
    const claw = add(w, new THREE.BoxGeometry(0.2, 0.36, 0.2), horn, sx * 3.0, 3.85, 0.08);
    claw.rotation.z = -sx * 0.4;
    g.add(w);
    wings.push({ w, sx });
  }

  // cou en segments
  const N = 9;
  const segs = [];
  for (let k = 0; k < N; k++) {
    const u = k / (N - 1);
    const s = 1.7 - u * 0.55;
    const seg = new THREE.Group();
    add(seg, new THREE.BoxGeometry(s, s * 0.95, s), body, 0, 0, 0);
    add(seg, new THREE.BoxGeometry(s * 0.7, s * 0.8, 0.2), belly, 0, 0, s * 0.52);
    const sp = add(seg, new THREE.BoxGeometry(0.2, s * 0.5, s * 0.5), dark, 0, 0, -s * 0.52);
    sp.rotation.x = Math.PI / 4;
    g.add(seg);
    segs.push(seg);
  }

  // tête sculptée : crâne, museau effilé, arcades sourcilières en colère, cornes recourbées,
  // collerette de pics, gueule ouverte avec crocs, langue et lueur au fond
  const head = new THREE.Group();
  head.scale.setScalar(1.3);
  // boîte effilée vers l'avant (z+) : fx/fy = facteur au bout, dy = décalage vertical du bout
  const taper = (w, h, d, fx, fy, dy = 0) => {
    const geo = new THREE.BoxGeometry(w, h, d, 1, 1, 2);
    const p = geo.attributes.position;
    for (let i = 0; i < p.count; i++) {
      const u = (p.getZ(i) + d / 2) / d;
      const kx = 1 + (fx - 1) * u, ky = 1 + (fy - 1) * u;
      p.setXYZ(i, p.getX(i) * kx, p.getY(i) * ky + dy * u, p.getZ(i));
    }
    geo.computeVertexNormals();
    return geo;
  };
  const scaleTex = detailTex('scales');
  const bodyT = new THREE.MeshStandardMaterial({ color: '#9254cc', map: scaleTex, roughness: 0.8 });
  const darkT = new THREE.MeshStandardMaterial({ color: '#4e2a9c', roughness: 0.8 });
  const hornT = new THREE.MeshStandardMaterial({ color: '#fff0d4', roughness: 0.6 });
  const hornB = new THREE.MeshStandardMaterial({ color: '#ead6b4', roughness: 0.6 });
  const gum = mat('#8a1f52', '#ff2f86', 0.6);
  // crâne
  add(head, taper(1.7, 1.25, 1.5, 0.9, 0.85), bodyT, 0, 0.05, -0.1);
  // museau long et plat
  add(head, taper(1.3, 0.62, 1.9, 0.62, 0.7, -0.08), bodyT, 0, 0.12, 1.45);
  // arête du nez + petite corne nasale
  add(head, taper(0.34, 0.18, 1.8, 0.5, 0.6), darkT, 0, 0.48, 1.25);
  const nh = add(head, new THREE.ConeGeometry(0.11, 0.42, 5), hornT, 0, 0.56, 2.15);
  nh.rotation.x = 0.5;
  // narines (rougeoient un peu)
  for (const sx of [-1, 1]) add(head, new THREE.BoxGeometry(0.14, 0.08, 0.1), mat('#2a0f3a', '#ff4f9a', 0.5), sx * 0.2, 0.36, 2.38);
  // arcades sourcilières inclinées vers le centre : regard menaçant
  for (const sx of [-1, 1]) {
    const brow = add(head, taper(0.5, 0.15, 0.55, 0.6, 0.6, 0.05), darkT, sx * 0.5, 0.56, 0.62);
    brow.rotation.z = sx * -0.38;
    brow.rotation.y = sx * 0.12;
    // œil enfoncé, iris doré et pupille fendue
    add(head, new THREE.BoxGeometry(0.38, 0.24, 0.16), mat('#fff1a0', '#ffc400', 2.2), sx * 0.56, 0.34, 0.7);
    add(head, new THREE.BoxGeometry(0.08, 0.24, 0.05), mat('#1a0828'), sx * 0.56, 0.34, 0.79);
    const lid = add(head, new THREE.BoxGeometry(0.4, 0.08, 0.2), darkT, sx * 0.55, 0.47, 0.66);
    lid.rotation.z = sx * -0.3;
    // pommette
    add(head, taper(0.3, 0.3, 0.8, 0.6, 0.6), bodyT, sx * 0.72, 0.0, 0.5);
    // collerette : 3 pics en éventail vers l'arrière
    for (let k = 0; k < 3; k++) {
      const sp = add(head, new THREE.ConeGeometry(0.12, 0.8 - k * 0.12, 4), darkT, sx * (0.8 + k * 0.05), -0.05 + k * 0.28, -0.55);
      sp.rotation.set(-1.1, 0, sx * (-0.9 - k * 0.25));
    }
    // grande corne recourbée en 4 segments (de la base foncée à la pointe claire)
    let px = sx * 0.55, py = 0.72, pz = -0.45, ax = -0.5;
    for (let k = 0; k < 4; k++) {
      const len = 0.62 - k * 0.08, rad = 0.17 - k * 0.035;
      const seg = add(head, new THREE.CylinderGeometry(rad * 0.75, rad, len, 6), k < 2 ? hornB : hornT, 0, 0, 0);
      seg.rotation.set(ax, 0, sx * -0.18);
      const dir = new THREE.Vector3(0, 1, 0).applyEuler(seg.rotation);
      seg.position.set(px + dir.x * len / 2, py + dir.y * len / 2, pz + dir.z * len / 2);
      px += dir.x * len; py += dir.y * len; pz += dir.z * len;
      ax -= 0.42;
    }
  }
  // crocs du haut (les plus longs devant)
  for (const sx of [-1, 1])
    for (let k = 0; k < 5; k++) {
      const f = add(head, new THREE.ConeGeometry(0.06 + (k === 3 ? 0.03 : 0), 0.22 + (k === 3 ? 0.14 : 0), 4), hornT, sx * (0.5 - k * 0.04), -0.22 - (k === 3 ? 0.06 : 0), 0.7 + k * 0.33);
      f.rotation.x = Math.PI;
    }
  // palais rose
  add(head, taper(1.05, 0.08, 1.8, 0.6, 1), gum, 0, -0.16, 1.4);
  const jaw = new THREE.Group();
  jaw.position.set(0, -0.3, 0.35);
  add(jaw, taper(1.2, 0.34, 2.0, 0.6, 0.7, 0.04), bodyT, 0, -0.14, 1.0);
  add(jaw, taper(1.0, 0.06, 1.8, 0.6, 1), gum, 0, 0.05, 1.0);
  // langue fourchue
  const tongue = add(jaw, taper(0.3, 0.06, 1.3, 0.8, 1), mat('#ff5f9e'), 0, 0.1, 1.1);
  for (const sx of [-1, 1]) {
    const tip = add(jaw, new THREE.BoxGeometry(0.08, 0.05, 0.3), mat('#ff5f9e'), sx * 0.09, 0.1, 1.85);
    tip.rotation.y = sx * 0.35;
  }
  tongue.userData.t = 1;
  for (const sx of [-1, 1])
    for (let k = 0; k < 4; k++) add(jaw, new THREE.ConeGeometry(0.055, 0.2, 4), hornT, sx * (0.44 - k * 0.05), 0.15, 0.4 + k * 0.38);
  // pics du menton
  for (let k = -1; k <= 1; k++) {
    const c = add(jaw, new THREE.ConeGeometry(0.08, 0.36, 4), darkT, k * 0.28, -0.35, 0.35);
    c.rotation.x = 2.6;
  }
  head.add(jaw);
  // lueur dans la gorge, plus forte quand il rugit
  const throat = glow('#ff3d9a', 1.4, 0.0);
  throat.position.set(0, -0.2, 1.0);
  head.add(throat);
  const eyeGlow = [];
  for (const sx of [-1, 1]) {
    const eg = glow('#ffd23f', 0.9, 0.55);
    eg.position.set(sx * 0.55, 0.36, 0.8);
    head.add(eg);
    eyeGlow.push(eg);
  }
  g.add(head);

  // queue qui ondule en deux bosses derrière
  const tail = [];
  for (let k = 0; k < 12; k++) {
    const s = 1.3 - k * 0.07;
    const t = new THREE.Group();
    add(t, new THREE.BoxGeometry(s, s, s), body, 0, 0, 0);
    const sp = add(t, new THREE.BoxGeometry(0.18, s * 0.5, s * 0.5), dark, 0, s * 0.55, 0);
    sp.rotation.x = Math.PI / 4;
    g.add(t);
    tail.push(t);
  }

  // rides et écume
  const rings = [];
  for (let k = 0; k < 3; k++) {
    const rg = new THREE.Mesh(new THREE.RingGeometry(2.6, 2.95, 32), new THREE.MeshBasicMaterial({ color: '#e8f8ff', transparent: true, opacity: 0.8, depthWrite: false }));
    rg.rotation.x = -Math.PI / 2;
    rg.position.y = 0.06 + k * 0.02;
    rg.renderOrder = 1;
    g.add(rg);
    rings.push(rg);
  }
  const splash = add(g, new THREE.CylinderGeometry(2.5, 3.0, 0.4, 12), mat('#eefaff'), 0, 0.05, 0.3);
  [chest, head, jaw, ...wings.map((w) => w.w), ...segs, ...tail].forEach(bake);
  eyeGlow.forEach((e) => head.add(e));

  const A = new THREE.Vector3(), B = new THREE.Vector3(), C = new THREE.Vector3(), P = new THREE.Vector3(), T = new THREE.Vector3(), UP = new THREE.Vector3(0, 1, 0);
  const bez = (u, out) => out.set(0, 0, 0).addScaledVector(A, (1 - u) * (1 - u)).addScaledVector(B, 2 * u * (1 - u)).addScaledVector(C, u * u);
  const dbez = (u, out) => out.set(0, 0, 0).addScaledVector(B.clone().sub(A), 2 * (1 - u)).addScaledVector(C.clone().sub(B), 2 * u);
  let roarT = 5;
  // le jeu peut le faire rugir sur un moment fort
  root.userData.roar = () => {
    if (roarT > 0 || roarT < -2.0) roarT = 0;
  };
  const smooth = (x) => x * x * (3 - 2 * x);
  return (t, dt) => {
    // rugit toutes les ~9 s : recule la tête (élan), puis la projette gueule grande ouverte, puis revient en douceur
    roarT -= dt;
    if (roarT < -2.6) roarT = 7 + Math.random() * 4;
    const rp = roarT < 0 ? -roarT / 2.6 : 0;
    let lunge = 0, open = 0;
    if (rp > 0) {
      if (rp < 0.22) lunge = -smooth(rp / 0.22) * 0.8;
      else if (rp < 0.38) lunge = -0.8 + smooth((rp - 0.22) / 0.16) * 2.0;
      else lunge = 1.2 * (1 - smooth((rp - 0.38) / 0.62));
      open = rp < 0.25 ? 0 : rp < 0.4 ? smooth((rp - 0.25) / 0.15) : 1 - smooth(Math.max(0, rp - 0.65) / 0.35);
    }
    const sway = Math.sin(t * 0.6) * 0.9;
    const bob = Math.sin(t * 1.2) * 0.18;
    chest.position.y = bob * 0.6;
    chest.rotation.z = Math.sin(t * 0.6) * 0.04;
    A.set(0, 2.4 + bob * 0.6, 0.2);
    B.set(sway * 0.4, 5.6 + bob, -1.6 - lunge * 0.6);
    C.set(sway, 6.0 + bob - lunge * 0.5, 2.0 + lunge * 1.6);
    for (let k = 0; k < N; k++) {
      const u = k / (N - 1);
      bez(u, P);
      dbez(u, T).normalize();
      segs[k].position.copy(P);
      segs[k].quaternion.setFromUnitVectors(UP, T);
      segs[k].scale.setScalar(1 + Math.sin(t * 1.8 - u * 3) * 0.03);
    }
    head.position.set(C.x, C.y + 0.5, C.z + 0.7);
    head.rotation.set(-0.06 - lunge * 0.22 + Math.sin(t * 1.3) * 0.04, Math.sin(t * 0.45) * 0.3 + sway * 0.12, -sway * 0.08);
    jaw.rotation.x = 0.22 + Math.sin(t * 1.8) * 0.05 + open * 0.75;
    throat.material.opacity = 0.15 + open * 0.8;
    throat.scale.setScalar(1.2 + open * 1.6);
    eyeGlow.forEach((e) => (e.material.opacity = 0.45 + open * 0.4 + Math.sin(t * 3) * 0.08));
    for (const { w, sx } of wings) {
      const flap = Math.sin(t * 1.3) * 0.12 + open * 0.3;
      w.rotation.z = sx * (-0.15 + flap);
      w.rotation.y = -sx * (0.5 - open * 0.25);
      w.position.y = 2.2 + bob * 0.6;
    }
    tail.forEach((tg, k) => {
      const u = k / (tail.length - 1);
      const z = -3.2 - u * 8;
      const y = Math.sin(u * Math.PI * 2 - t * 1.4) * 1.3 - 0.4;
      tg.position.set(Math.sin(u * 3 + t * 0.5) * 1.2 + 2.2 * u, y, z);
      tg.rotation.x = Math.cos(u * Math.PI * 2 - t * 1.4) * 0.6;
    });
    rings.forEach((rg, k) => {
      const ph = (t * 0.3 + k / 3) % 1;
      rg.scale.setScalar(1 + ph * 1.8);
      rg.material.opacity = 0.75 * (1 - ph);
    });
    splash.scale.set(1 + Math.sin(t * 2) * 0.04, 1, 1 + Math.cos(t * 2) * 0.04);
  };
}

// ---------- oiseaux ----------
function birds(root) {
  const list = [];
  for (let k = 0; k < 5; k++) {
    const g = new THREE.Group();
    const body = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.16, 0.5), mat('#ffffff'));
    g.add(body);
    const wingsL = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.05, 0.28), mat('#f4f0ff'));
    wingsL.geometry.translate(-0.35, 0, 0);
    const wingsR = wingsL.clone();
    wingsR.scale.x = -1;
    g.add(wingsL, wingsR);
    g.userData = { wl: wingsL, wr: wingsR, r: 7 + k * 2.2, h: 9 + k * 1.3, s: 0.22 + k * 0.03, ph: k * 1.4, cx: -2 + k, cz: -22 };
    root.add(g);
    list.push(g);
  }
  return (t) =>
    list.forEach((g) => {
      const d = g.userData;
      const a = t * d.s + d.ph;
      g.position.set(d.cx + Math.cos(a) * d.r, d.h + Math.sin(t * 0.8 + d.ph) * 0.5, d.cz + Math.sin(a) * d.r * 0.6);
      g.rotation.y = -a;
      const f = Math.sin(t * 7 + d.ph) * 0.6;
      d.wl.rotation.z = f;
      d.wr.rotation.z = -f;
    });
}

// ---------- scène du Grinta Fest (côté droit) ----------
function drawPerformer(x, t, w, h) {
  const beat = t * (124 / 60);
  const bp = beat % 1;
  // fond de l'écran : dégradé violet rose, rayons qui tournent
  const g = x.createLinearGradient(0, 0, 0, h);
  g.addColorStop(0, '#5a2aa8');
  g.addColorStop(1, '#d43f9a');
  x.fillStyle = g;
  x.fillRect(0, 0, w, h);
  x.save();
  x.translate(w / 2, h * 0.42);
  x.rotate(t * 0.3);
  x.fillStyle = 'rgba(255,220,255,0.13)';
  for (let k = 0; k < 8; k++) {
    x.rotate(Math.PI / 4);
    x.beginPath();
    x.moveTo(0, 0); x.lineTo(160, -22); x.lineTo(160, 22);
    x.fill();
  }
  x.restore();
  // égaliseur
  for (let k = 0; k < 16; k++) {
    const v = 0.3 + 0.7 * Math.abs(Math.sin(beat * Math.PI * 0.5 + k * 0.9) * Math.cos(k * 1.7 + beat * 0.7));
    const bh = Math.round(v * 16);
    x.fillStyle = k % 2 ? '#ffd23f' : '#5ff0ff';
    x.fillRect(4 + k * 8, h - 6 - bh, 6, bh);
  }
  // perso original : MC au bob orange, lunettes rondes, veste verte, chaîne G
  const bob = Math.round(Math.pow(1 - bp, 3) * 3);
  const cx = Math.round(w / 2), top = 12 + bob;
  const R = (c, px, py, pw, ph) => {
    x.fillStyle = c;
    x.fillRect(cx + px, top + py, pw, ph);
  };
  const O = '#2a1030';
  // épaules et veste
  R(O, -23, 41, 46, 30);
  R('#2fbf71', -22, 42, 44, 30);
  R('#1f9a58', -22, 60, 44, 12);
  R('#ffffff', -2, 42, 4, 30);
  R('#7ef0b0', -20, 43, 6, 14);
  // cou + tête
  R(O, -12, 9, 24, 34);
  R('#a8673f', -11, 10, 22, 32);
  R('#8e5532', -11, 34, 22, 8);
  // barbe courte
  R('#3a2418', -11, 32, 22, 6);
  R('#a8673f', -5, 32, 10, 3);
  // bouche (chante sur le temps)
  const open = bp < 0.5 ? 3 : 1;
  R('#5a1a2a', -3, 35, 6, open);
  // lunettes rondes jaunes
  R(O, -10, 20, 9, 7);
  R(O, 1, 20, 9, 7);
  R('#ffd23f', -9, 21, 7, 5);
  R('#ffd23f', 2, 21, 7, 5);
  R('#fff6c0', -8, 21, 2, 2);
  R('#fff6c0', 3, 21, 2, 2);
  R(O, -1, 22, 2, 2);
  // bob orange
  R(O, -16, 4, 32, 12);
  R('#ff7a1a', -15, 5, 30, 10);
  R('#ffa04a', -15, 5, 30, 3);
  R(O, -14, -2, 28, 8);
  R('#ff7a1a', -13, -1, 26, 7);
  // chaîne et pendentif G
  R('#ffd23f', -10, 44, 20, 2);
  R('#ffd23f', -4, 46, 8, 9);
  R(O, -2, 48, 4, 5);
  R('#ffd23f', -1, 50, 2, 2);
  // bras droit levé qui bat la mesure
  const up = Math.round(Math.sin(beat * Math.PI) * 4);
  R(O, 21, 18 - up, 9, 26 + up);
  R('#2fbf71', 22, 22 - up, 7, 22 + up);
  R('#a8673f', 22, 15 - up, 7, 8);
  // bras gauche au micro
  R(O, -30, 28, 20, 9);
  R('#2fbf71', -29, 29, 18, 7);
  R('#a8673f', -14, 27, 6, 8);
  R('#3a3550', -10, 30, 6, 5);
  R('#c9c9d6', -9, 28, 4, 3);
  // bandeau du bas
  x.fillStyle = 'rgba(20,6,40,0.75)';
  x.fillRect(0, h - 30, w, 2);
  x.fillStyle = '#ff3d8b';
  x.fillRect(w - 34, 4, 30, 10);
  x.fillStyle = '#ffffff';
  x.font = '700 8px "Pixelify Sans", monospace';
  x.textBaseline = 'middle';
  x.fillText('● LIVE', w - 32, 9.5);
}

function stage(root) {
  const g = new THREE.Group();
  g.position.set(19, -1, -19);
  g.rotation.y = Math.atan2(-19, 21); // face au plateau, un peu tournée vers la caméra
  root.add(g);
  const v = new Vox();
  // podium
  v.box('#4a3a6a', 11, 1.4, 5, 0, 0, 0);
  v.box('#ff3d8b', 11.2, 0.18, 0.2, 0, 1.4, 2.5, 0, '#ff3d8b', 0.8);
  v.box('#3a2d58', 11, 0.1, 5, 0, 1.4, 0);
  // tours de structure (épaisses : pas de treillis fin qui scintille)
  for (const sx of [-5.2, 5.2]) {
    v.box('#c9c2dc', 0.55, 7.6, 0.55, sx, 0, 1.8);
    v.box('#c9c2dc', 0.55, 7.6, 0.55, sx, 0, -1.6);
    for (let k = 0; k < 5; k++) v.box('#9d93b8', 0.45, 0.16, 3.3, sx, 1.2 + k * 1.4, 0.1);
  }
  v.box('#c9c2dc', 11, 0.55, 0.55, 0, 7.6, 1.8);
  v.box('#c9c2dc', 11, 0.55, 0.55, 0, 7.6, -1.6);
  v.box('#9d93b8', 10.6, 0.16, 3.2, 0, 7.7, 0.1);
  // enceintes
  for (const sx of [-6.6, 6.6])
    for (let k = 0; k < 3; k++) {
      v.box('#3a3550', 1.7, 1.4, 1.4, sx, k * 1.45 - 0.4, 1.2);
      v.add(new THREE.CylinderGeometry(0.5, 0.5, 0.1, 12).rotateX(Math.PI / 2), '#6f6890', sx, k * 1.45 + 0.3, 1.92);
      v.add(new THREE.CylinderGeometry(0.2, 0.2, 0.14, 10).rotateX(Math.PI / 2), '#a9a2c8', sx, k * 1.45 + 0.3, 1.94);
    }
  // platines du DJ
  v.box('#2c2342', 2.4, 1.0, 0.9, 0, 1.4, 1.4);
  v.box('#5ff0ff', 2.0, 0.08, 0.7, 0, 2.4, 1.4, 0, '#5ff0ff', 0.9);
  g.add(v.build());

  // écran géant animé
  const c = document.createElement('canvas');
  c.width = 128;
  c.height = 80;
  const cx = c.getContext('2d');
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.magFilter = THREE.NearestFilter;
  tex.minFilter = THREE.LinearMipmapLinearFilter;
  tex.anisotropy = 8;
  const screenFrame = new THREE.Mesh(new THREE.BoxGeometry(7.3, 4.6, 0.3), mat('#2c2342'));
  screenFrame.position.set(0, 4.6, -1.4);
  g.add(screenFrame);
  const screen = new THREE.Mesh(new THREE.PlaneGeometry(6.8, 4.25), new THREE.MeshBasicMaterial({ map: tex, toneMapped: false }));
  screen.position.set(0, 4.6, -1.23);
  g.add(screen);

  // enseigne néon GRINTA FEST
  const sign = canvasTex(512, 96, (x, w, h) => {
    x.fillStyle = '#2c2342';
    x.fillRect(0, 0, w, h);
    x.font = '700 70px "Pixelify Sans", sans-serif';
    x.textAlign = 'center';
    x.textBaseline = 'middle';
    x.lineJoin = 'round';
    x.lineWidth = 10;
    x.strokeStyle = '#ffffff';
    x.strokeText('GRINTA FEST', w / 2, h / 2 + 4);
    x.fillStyle = '#ff4fa8';
    x.fillText('GRINTA FEST', w / 2, h / 2 + 4);
  });
  const signM = new THREE.Mesh(new THREE.BoxGeometry(8.4, 1.5, 0.3), [mat('#2c2342'), mat('#2c2342'), mat('#2c2342'), mat('#2c2342'), new THREE.MeshBasicMaterial({ map: sign, toneMapped: false }), mat('#2c2342')]);
  signM.position.set(0, 9.2, 1.8);
  g.add(signM);

  // projecteurs : ampoules jaunes sur les tours + lyres avec faisceaux qui balayent
  const bulbs = [];
  for (const sx of [-5.2, 5.2])
    for (let k = 0; k < 3; k++) {
      const b = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.32, 0.25, 10).rotateX(Math.PI / 2), mat('#ffe27a', '#ffcc33', 1.5));
      b.position.set(sx + (sx < 0 ? 0.45 : -0.45), 2.6 + k * 1.6, 2.1);
      g.add(b);
      bulbs.push(b);
      const bg = glow('#ffd36b', 1.6, 0.6);
      bg.position.copy(b.position).add(new THREE.Vector3(0, 0, 0.25));
      g.add(bg);
    }
  const beams = [];
  const beamGeo = new THREE.CylinderGeometry(0.12, 1.5, 9, 16, 1, true);
  beamGeo.translate(0, -4.5, 0);
  const cols = ['#ff4fd8', '#9a6bff', '#5ff0ff', '#ff4fd8', '#9a6bff'];
  for (let k = 0; k < 5; k++) {
    const head = new THREE.Group();
    head.position.set(-4 + k * 2, 7.5, 1.9);
    const can = new THREE.Mesh(new THREE.BoxGeometry(0.45, 0.45, 0.45), mat('#3a3550'));
    const lens = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.16, 0.1, 10), mat('#ffffff', cols[k], 2));
    lens.position.y = -0.25;
    head.add(can, lens);
    const lg = glow(cols[k], 1.3, 0.8);
    lg.position.y = -0.3;
    head.add(lg);
    const beam = new THREE.Mesh(beamGeo, new THREE.MeshBasicMaterial({ color: cols[k], transparent: true, opacity: 0.22, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, fog: false }));
    beam.userData.noToon = true;
    head.add(beam);
    g.add(head);
    beams.push(head);
  }

  // public : instances qui sautent en rythme
  const crowdN = 46;
  const bodyM = new THREE.InstancedMesh(new THREE.BoxGeometry(0.42, 0.62, 0.3), new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 0.8 }), crowdN);
  const headM = new THREE.InstancedMesh(new THREE.BoxGeometry(0.32, 0.32, 0.32), new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 0.8 }), crowdN);
  const armM = new THREE.InstancedMesh(new THREE.BoxGeometry(0.11, 0.5, 0.11), new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 0.8 }), crowdN);
  const r = rng(9);
  const shirts = ['#ff5f6d', '#ffd23f', '#3fb6ff', '#2fd17a', '#ff9a3c', '#c58bff', '#ffffff', '#ff6fb5'];
  const skins = ['#f1c9a5', '#d9a07a', '#a8673f', '#7a4a2e', '#e8b48c'];
  const people = [];
  const col = new THREE.Color();
  for (let k = 0; k < crowdN; k++) {
    const row = Math.floor(k / 9);
    const px = -4.6 + (k % 9) * 1.15 + (r() - 0.5) * 0.5 + (row % 2) * 0.4;
    const pz = 3.7 + row * 1.0 + (r() - 0.5) * 0.3;
    people.push({ x: px, z: pz, ph: r(), arm: r() < 0.55, side: r() < 0.5 ? -1 : 1, s: 0.9 + r() * 0.25 });
    bodyM.setColorAt(k, col.set(shirts[Math.floor(r() * shirts.length)]));
    const sk = skins[Math.floor(r() * skins.length)];
    headM.setColorAt(k, col.set(sk));
    armM.setColorAt(k, col.set(sk));
  }
  g.add(bodyM, headM, armM);
  const M = new THREE.Matrix4(), Q = new THREE.Quaternion(), S = new THREE.Vector3(), V = new THREE.Vector3(), E = new THREE.Euler();

  let lastDraw = -1;
  return (t) => {
    const beat = t * (124 / 60);
    if (t - lastDraw > 1 / 15) {
      lastDraw = t;
      drawPerformer(cx, t, 128, 80);
      tex.needsUpdate = true;
    }
    beams.forEach((h, k) => {
      h.rotation.x = -0.55 + Math.sin(t * 0.7 + k * 0.9) * 0.35;
      h.rotation.z = Math.sin(t * 0.5 + k * 1.3) * 0.5;
    });
    bulbs.forEach((b, k) => (b.material.emissiveIntensity = 1.2 + 0.4 * Math.sin(t * 2 + k)));
    people.forEach((p, k) => {
      const ph = (beat + p.ph * 0.3) % 1;
      const jump = Math.pow(Math.sin(ph * Math.PI), 2) * 0.22;
      const y = 0.2 + jump;
      S.setScalar(p.s);
      M.compose(V.set(p.x, y + 0.31 * p.s, p.z), Q.identity(), S);
      bodyM.setMatrixAt(k, M);
      M.compose(V.set(p.x, y + 0.8 * p.s, p.z), Q.setFromEuler(E.set(0, 0, Math.sin(beat * Math.PI + p.ph * 6) * 0.12)), S);
      headM.setMatrixAt(k, M);
      const ay = p.arm ? 0.95 : 0.35;
      M.compose(V.set(p.x + p.side * 0.26 * p.s, y + ay * p.s, p.z), Q.setFromEuler(E.set(0, 0, p.arm ? p.side * (-0.25 + Math.sin(beat * Math.PI * 2 + p.ph) * 0.2) : p.side * 0.15)), S);
      armM.setMatrixAt(k, M);
    });
    bodyM.instanceMatrix.needsUpdate = headM.instanceMatrix.needsUpdate = armM.instanceMatrix.needsUpdate = true;
  };
}

// ---------- souk et palmiers (côté avant : ce que voit le joueur placé en face) ----------
function palm(v, x, z, h, lean, r) {
  let px = x, py = -1, pz = z;
  for (let k = 0; k < 7; k++) {
    v.box(k % 2 ? '#a8784a' : '#946640', 0.42 - k * 0.025, h / 7 + 0.02, 0.42 - k * 0.025, px, py, pz);
    py += h / 7;
    px += lean * (k / 6) * 0.35;
  }
  for (let k = 0; k < 6; k++) {
    const a = (k / 6) * Math.PI * 2 + r() * 0.3;
    for (let j = 1; j <= 3; j++) v.box(j === 3 ? '#4fb84a' : '#5cc756', 0.9, 0.16, 0.5, px + Math.sin(a) * j * 0.7, py - j * j * 0.07, pz + Math.cos(a) * j * 0.7, a);
  }
  v.box('#7a4a2e', 0.3, 0.3, 0.3, px + 0.2, py - 0.4, pz);
}

function market(root) {
  const v = new Vox();
  const r = rng(77);
  const stripes = [['#ff5f6d', '#fff4e0'], ['#3fb6ff', '#fff4e0'], ['#ffd23f', '#ff7a2e'], ['#2fd17a', '#fff4e0'], ['#c58bff', '#fff4e0']];
  // étals en arc de cercle face au plateau
  for (let k = 0; k < 7; k++) {
    const a = -0.75 + k * 0.25;
    const R = 19.5;
    const x = Math.sin(a) * R, z = Math.cos(a) * R;
    const ry = a + Math.PI;
    const [c1, c2] = stripes[k % stripes.length];
    v.box('#b88a5c', 2.6, 1.0, 1.4, x, -1, z, ry);
    // marchandises colorées sur l'étal
    for (let j = 0; j < 4; j++) v.box(['#ff9a3c', '#ff5f6d', '#ffd23f', '#7ad85e'][j], 0.42, 0.32, 0.42, x + Math.cos(ry) * (-0.9 + j * 0.6), 0, z - Math.sin(ry) * (-0.9 + j * 0.6), ry);
    for (const sx of [-1.2, 1.2]) v.box('#6b4426', 0.14, 2.4, 0.14, x + Math.cos(ry) * sx, -1, z - Math.sin(ry) * sx, ry);
    // auvent rayé
    for (let j = 0; j < 6; j++) {
      const o = -1.25 + j * 0.5;
      v.box(j % 2 ? c1 : c2, 0.5, 0.14, 1.9, x + Math.cos(ry) * o, 1.4, z - Math.sin(ry) * o, ry);
    }
  }
  // grande porte de la ville, motif à nous
  v.box('#fff1dc', 1.4, 6, 1.4, -4.2, -1, 25);
  v.box('#fff1dc', 1.4, 6, 1.4, 4.2, -1, 25);
  v.box('#ff7a2e', 10.6, 0.8, 1.8, 0, 5, 25);
  v.box('#ff9a52', 9, 0.6, 1.5, 0, 5.8, 25);
  v.box('#ffd04a', 1.2, 1.2, 0.3, 0, 4.3, 24.2, 0, '#ffb020', 0.6);
  for (const sx of [-4.2, 4.2]) v.box('#ff7a2e', 2, 0.5, 2, sx, 5, 25);
  // palmiers
  [[-9, 17, 5.5, 1], [9.5, 17.5, 6.2, -1], [-14, 13, 5, 1], [14.5, 12.5, 5.6, -1], [-6.5, 23, 6.5, 1], [7, 23.5, 5.8, -1], [-17, 7, 4.6, 1], [17.5, 6, 5.2, -1]].forEach(([x, z, h, l]) => palm(v, x, z, h, l, r));
  root.add(v.build());
  // guirlandes de lampions entre les palmiers
  const lamps = [];
  const cols = ['#ff5f6d', '#ffd23f', '#3fb6ff', '#2fd17a', '#ff6fb5'];
  for (let k = 0; k < 22; k++) {
    const u = k / 21;
    const a = -0.85 + u * 1.7;
    const R = 16.5;
    const y = 3.4 - Math.sin(((u * 5) % 1) * Math.PI) * 0.7;
    const m = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.32, 0.26), mat(cols[k % 5], cols[k % 5], 0.9));
    m.position.set(Math.sin(a) * R, y, Math.cos(a) * R);
    root.add(m);
    const gl = glow(cols[k % 5], 0.9, 0.5);
    gl.position.copy(m.position);
    root.add(gl);
    lamps.push(m);
  }
  return (t) => lamps.forEach((m, k) => (m.rotation.z = Math.sin(t * 1.5 + k) * 0.12));
}

export function buildScenery(scene) {
  const root = new THREE.Group();
  root.name = 'scenery';
  scene.add(root);
  const updaters = [plaza(root), land(root), sky(root, scene), village(root), spires(root), dragon(root), birds(root), stage(root), market(root)].filter(Boolean);
  return {
    root,
    roar: () => root.userData.roar?.(),
    update(t, dt, cam) {
      for (const u of updaters) u(t, dt, cam);
    },
  };
}
