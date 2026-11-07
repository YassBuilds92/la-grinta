// Généré par tools/build_champs.py depuis styles-perso/lion-pixel.html : ne pas modifier à la main.
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';

export function create() {
const PAL = {
  fur: '#f4f1f8', mane: '#f3eff9', mane2: '#dcd3ec', muzzle: '#fdfbfe', nose: '#7e4659', earIn: '#eda2b6',
  mouth: '#94304a', tongue: '#e0697f', teeth: '#fffaf0', eyeW: '#ffcd2b', pupil: '#3a2410',
  armor: '#7d7794', armorD: '#6a6580', strap: '#9c6a43', gold: '#f3bc46', horn: '#f3e6c6', hornD: '#dcc69c',
  cloth: '#c93b50', blade: '#f5ebd0', grip: '#7c4834', claw: '#fffaf2',
  keff: '#ffffff', keffR: '#ffffff', white: '#ffffff', hood: '#2f7de1',
};
const METAL = { gold: 1 };

const S = (c, r, m, o = {}) => ({ t: 'sph', c, r, m, ...o });
const E = (c, rad, m, o = {}) => ({ t: 'ell', c, rad, m, ...o });
const Hm = (c, rad, m, o = {}) => ({ t: 'hemi', c, rad, m, ...o });
const C = (a, b, r, m, o = {}) => ({ t: 'cap', a, b, r, m, ...o });
const B = (c, h, r, m, o = {}) => ({ t: 'box', c, h, r, m, ...o });
const T = (c, R, r, m, o = {}) => ({ t: 'tor', c, R, r, m, ...o });
const G = (g, m, o = {}) => ({ t: 'geo', g, c: [0, 0, 0], m, ...o });
const mir = (list) => list.flatMap((p) => {
  const f = (v) => v && [-v[0], v[1], v[2]];
  const q = { ...p, c: f(p.c), a: f(p.a), b: f(p.b) };
  if (p.rot) q.rot = [p.rot[0], -p.rot[1], -p.rot[2]];
  if (p.g && p.mg) q.g = p.mg;
  return [p, q];
});
const add = (a, b) => a.map((v, i) => v + b[i]);
const sc3 = (a, k) => a.map((v) => v * k);
const fx = (p) => p && [-p[0], p[1], p[2]];
const hsh = (i) => Math.sin(i * 12.9898) * 0.5 + 0.5;
// pointe (cône) posée sur `base`, orientée selon `dir`
const cone = (base, dir, len, r, seg = 6) => () => {
  const g = new THREE.ConeGeometry(r, len, seg, 1);
  g.translate(0, len / 2, 0);
  g.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), new THREE.Vector3(...dir).normalize()));
  g.translate(...base);
  return g;
};
const Cn = (base, dir, len, r, m, o = {}) => ({ ...G(cone(base, dir, len, r), m, o), mg: cone(fx(base), fx(dir), len, r) });
// mèche, corne ou griffe : tube effilé à 5 pans le long d'une courbe de Bézier, aplati selon `ref`
const lockGeo = (p0, p1, p2, r0, flat = 0.55, ref = [0, 1, 0.3], sides = 5, seg = 7, pw = 0.75) => () => {
  const A = new THREE.Vector3(...p0), Bp = new THREE.Vector3(...p1), Cp = new THREE.Vector3(...p2), R = new THREE.Vector3(...ref).normalize();
  const pos = [], idx = [];
  for (let i = 0; i <= seg; i++) {
    const t = i / seg, u = 1 - t;
    const P = A.clone().multiplyScalar(u * u).addScaledVector(Bp, 2 * u * t).addScaledVector(Cp, t * t);
    const Tg = Bp.clone().sub(A).multiplyScalar(2 * u).addScaledVector(Cp.clone().sub(Bp), 2 * t).normalize();
    const N = R.clone().sub(Tg.clone().multiplyScalar(R.dot(Tg)));
    if (N.lengthSq() < 1e-6) N.set(1, 0, 0);
    N.normalize();
    const Bn = new THREE.Vector3().crossVectors(Tg, N);
    const r = Math.max(0.0015, pw < 0 ? r0 * Math.pow(1 - Math.pow(t, -pw), 0.8) * (0.75 + 0.25 * Math.sin(Math.PI * Math.min(1, t * 1.6))) : r0 * Math.pow(u, pw));
    for (let k = 0; k < sides; k++) {
      const a = (k / sides) * Math.PI * 2 + 0.3;
      pos.push(...P.clone().addScaledVector(Bn, Math.cos(a) * r).addScaledVector(N, Math.sin(a) * r * flat).toArray());
    }
  }
  for (let i = 0; i < seg; i++) for (let k = 0; k < sides; k++) {
    const a = i * sides + k, b = i * sides + ((k + 1) % sides);
    idx.push(a, a + sides, b, b, a + sides, b + sides);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setIndex(idx); g.computeVertexNormals();
  return g;
};
const Lk = (p0, p1, p2, r, m, o = {}) => {
  const fl = o.flat ?? 0.55, ref = o.ref ?? [0, 1, 0.3], pw = o.pw ?? 0.75;
  return { ...G(lockGeo(p0, p1, p2, r, fl, ref, 5, 7, pw), m), mg: lockGeo(fx(p0), fx(p1), fx(p2), r, fl, fx(ref), 5, 7, pw) };
};
// mèche à partir d'une base, d'une direction de départ et d'un point d'arrivée relatif
const lock = (b, mid, end, r, m, ref) => G(lockGeo(b, add(b, mid), add(b, end), r, 0.5, ref), m);
// point posé sur un ellipsoïde (pour coller sangles et liserés)
const onE = (c, rad, x, y, off = 0.012) => {
  const k = 1 - ((x - c[0]) / rad[0]) ** 2 - ((y - c[1]) / rad[1]) ** 2;
  return [x, y, c[2] + (rad[2] + off) * Math.sqrt(Math.max(0, k))];
};
const strap = (c, rad, pts, r, m, off) => pts.slice(1).map((p, i) => C(onE(c, rad, ...pts[i], off), onE(c, rad, ...p, off), r, m));

/* ---- crinière : collerette autour de la face, crête qui part en arrière, mèches sur les côtés et dans le dos ---- */
const FC = [0, 0.12, 0.07];
const maneHead = [];
const ML = (b, mid, end, r, m, ref, fl = 0.42) => G(lockGeo(b, add(b, mid), add(b, end), r, fl, ref, 5, 8, -1.4), m);
// collerette autour de la face : grosses mèches en pétales, pointes rabattues en arrière
for (let i = 0; i < 15; i++) {
  const a = (i / 15) * Math.PI * 2 + 0.21, h = hsh(i);
  const dx = Math.cos(a), dy = Math.sin(a);
  const len = 0.15 + 0.07 * h + (dy > 0.2 ? 0.05 : 0);
  const b = [FC[0] + dx * 0.14, FC[1] + dy * 0.15, FC[2] - 0.04];
  maneHead.push(ML(b, [dx * len * 0.6, dy * len * 0.55 + 0.02, -len * 0.1], [dx * len, dy * len * 0.7 - 0.02, -len * 0.7], 0.085 + 0.015 * h, i % 2 ? 'mane' : 'mane2', [0, 0, 1]));
}
// 2e collerette, plus large, derrière
for (let i = 0; i < 12; i++) {
  const a = (i / 12) * Math.PI * 2 + 0.5, h = hsh(i + 20);
  const dx = Math.cos(a), dy = Math.sin(a);
  const len = 0.22 + 0.08 * h + (dy > 0 ? 0.07 : 0);
  const b = [dx * 0.16, FC[1] + 0.02 + dy * 0.16, -0.05];
  maneHead.push(ML(b, [dx * len * 0.65, dy * len * 0.6 + 0.04, -len * 0.2], [dx * len, dy * len * 0.6 - 0.03, -len * 0.85], 0.1, i % 2 ? 'mane2' : 'mane', [dx * 0.3, dy * 0.3, 1]));
}
// crête : trois rangs de grosses mèches qui montent puis partent en arrière
for (let row = 0; row < 3; row++) for (let j = 0; j < 5; j++) {
  const x = (j - 2) * 0.065, h = hsh(row * 7 + j + 50), ax = Math.abs(x);
  const b = [x, 0.24 - ax * 0.35 + row * 0.025, 0.08 - ax * 0.3 - row * 0.1];
  const L = 0.34 + 0.1 * h + row * 0.05 - ax * 0.5;
  maneHead.push(ML(b, [x * 0.6, 0.2 + 0.04 * h, -0.06], [x * 1.8 + (h - 0.5) * 0.06, 0.2 + 0.08 * h - row * 0.08, -L], 0.11 - row * 0.006, (j + row) % 2 ? 'mane' : 'mane2', [0, 1, 0.2]));
}
// côtés : mèches qui balaient vers l'arrière et retombent sur les épaules
for (const s of [1, -1]) for (let j = 0; j < 4; j++) {
  const y = 0.0 + j * 0.075, h = hsh(j * 3 + (s > 0 ? 80 : 90));
  const b = [s * 0.14, y, -0.02];
  maneHead.push(ML(b, [s * 0.12, 0.05, -0.14], [s * (0.21 + 0.05 * h), -0.14 + 0.2 * y, -0.4 - 0.1 * h], 0.1, j % 2 ? 'mane2' : 'mane', [s, 0.3, 0]));
}
// longues mèches sauvages dans le dos (sans anneaux)
for (const s of [1, -1]) for (let k = 0; k < 3; k++) {
  const h = hsh(k + (s > 0 ? 30 : 33));
  const b = [s * (0.04 + 0.06 * k), 0.15 - 0.04 * k, -0.15];
  maneHead.push(ML(b, [s * 0.08, 0.1, -0.22], [s * (0.14 + 0.07 * k), -0.14 - 0.08 * h, -0.5 - 0.08 * h], 0.1, k % 2 ? 'mane' : 'mane2', [s * 0.3, 1, 0]));
}

/* ---- lame courbe en ivoire (une grosse dent / défense), tenue à l'envers sous le poing ---- */
const bladeGeo = (inner = false) => () => {
  const s = new THREE.Shape();
  const k = inner ? 0.55 : 1;
  // profil dans le plan (z, y) : dos qui bombe vers l'arrière, tranchant devant, pointe qui revient vers l'avant
  s.moveTo(-0.035 * k, 0);
  s.quadraticCurveTo(-0.1 * k, -0.22, -0.04 * k, -0.38);
  s.quadraticCurveTo(0.02, -0.48, 0.14, -0.5);
  s.quadraticCurveTo(0.1, -0.38, 0.09 * k, -0.24);
  s.quadraticCurveTo(0.075 * k, -0.08, 0.04 * k, 0);
  s.lineTo(-0.035 * k, 0);
  const d = inner ? 0.03 : 0.022;
  const g = new THREE.ExtrudeGeometry(s, { depth: d, bevelEnabled: !inner, bevelThickness: 0.008, bevelSize: 0.007, bevelSegments: 1, curveSegments: 10 });
  g.translate(0, 0, -d / 2);
  g.rotateY(-Math.PI / 2);
  g.translate(0, -0.135, 0);
  g.scale(1, 0.86, 1);
  if (inner) g.scale(1, 0.94, 1);
  return g;
};
/* ---- pagne déchiré ---- */
const ragGeo = (w, h, z, tilt, seed) => () => {
  const s = new THREE.Shape();
  s.moveTo(-w, 0); s.lineTo(w, 0);
  const n = 6;
  for (let i = 0; i <= n; i++) {
    const x = (w - (2 * w * i) / n) * 0.82;
    const y = -h + (i % 2 ? 0.06 : 0) - 0.05 * hsh(i + seed);
    s.lineTo(x, y);
  }
  s.lineTo(-w, 0);
  const g = new THREE.ExtrudeGeometry(s, { depth: 0.014, bevelEnabled: false });
  g.translate(0, 0, -0.007); g.rotateX(tilt); g.translate(0, 0.05, z);
  return g;
};

const UA = 0.26, FA = 0.27, TH = 0.25, SH = 0.25;
// épaulières posées sur le torse (elles ne tournent pas avec le bras)
const PR_C = [-0.3, 0.43, 0.0], PL_C = [0.3, 0.42, 0.0];
const hornAt = (c, d, len, r, bend) => G(lockGeo(c, add(c, sc3(d, len * 0.55)), add(add(c, sc3(d, len)), bend), r, 1, [1, 0, 0], 6, 7, 1.1), 'horn');
const PAULDRONS = [
  // droite : coque d'os à deux étages et trois cornes recourbées
  Hm(PR_C, [0.18, 0.14, 0.18], 'horn', { rot: [0, 0, 0.55] }),
  T(PR_C, 0.176, 0.016, 'gold', { rot: [0, 0, 0.55] }),
  Hm(add(PR_C, [0.03, -0.07, 0]), [0.165, 0.08, 0.165], 'hornD', { rot: [0, 0, 0.55] }),
  hornAt([-0.38, 0.52, 0.03], [-0.55, 0.6, -0.6], 0.22, 0.05, [-0.02, 0.05, -0.04]),
  hornAt([-0.31, 0.55, -0.08], [-0.3, 0.55, -0.8], 0.19, 0.045, [-0.02, 0.05, -0.03]),
  hornAt([-0.43, 0.46, 0.1], [-0.8, 0.5, -0.35], 0.14, 0.036, [-0.01, 0.04, -0.03]),
  T([-0.38, 0.52, 0.03], 0.045, 0.011, 'gold', { rot: [0.2, 0, 0.9] }),
  // gauche : plaque d'armure à liseré doré
  Hm(PL_C, [0.165, 0.12, 0.165], 'armor', { rot: [0, 0, -0.55] }),
  T(PL_C, 0.162, 0.016, 'gold', { rot: [0, 0, -0.55] }),
  Hm(add(PL_C, [-0.03, -0.06, 0]), [0.15, 0.07, 0.15], 'armorD', { rot: [0, 0, -0.55] }),
  T(add(PL_C, [-0.03, -0.06, 0]), 0.148, 0.011, 'gold', { rot: [0, 0, -0.55] }),
  C([0.27, 0.56, 0.1], [0.4, 0.49, 0.0], 0.016, 'gold'), C([0.4, 0.49, 0.0], [0.33, 0.53, -0.12], 0.016, 'gold'),
  S([0.36, 0.47, 0.13], 0.017, 'gold'), S([0.41, 0.43, -0.06], 0.017, 'gold'),
];
const CH_C = [0, 0.27, 0.03], CH_R = [0.27, 0.21, 0.21];

const PARTS = [
  { n: 'hips', p: null, o: [0, 0.4, 0], prims: [
    E([0, 0, 0], [0.2, 0.12, 0.16], 'armorD'),
    B([0, 0.07, 0], [0.215, 0.045, 0.172], 0.035, 'strap'),
    B([0, 0.07, 0.18], [0.055, 0.045, 0.016], 0.012, 'gold'),
    S([0, 0.07, 0.198], 0.016, 'strap'),
    ...mir([
      E([0.175, -0.04, 0.03], [0.07, 0.12, 0.13], 'armor', { rot: [0, 0, 0.3] }),
      C([0.2, -0.12, 0.13], [0.23, -0.1, -0.06], 0.012, 'gold'),
    ]),
    G(ragGeo(0.085, 0.3, 0.19, -0.28, 3), 'cloth'),
    G(ragGeo(0.12, 0.28, -0.18, -0.25, 9), 'cloth'),
  ] },
  { n: 'torso', p: 'hips', o: [0, 0.07, 0], prims: [
    E([0, 0.15, 0.03], [0.2, 0.19, 0.17], 'fur'),
    E([0, 0.3, -0.05], [0.29, 0.2, 0.23], 'armorD'),
    E(CH_C, CH_R, 'armor'),
    E([0, 0.35, -0.1], [0.28, 0.16, 0.21], 'armor'),
    E([0, 0.11, 0.07], [0.19, 0.05, 0.16], 'armorD'),
    E([0, 0.03, 0.06], [0.18, 0.045, 0.15], 'armorD'),
    ...strap(CH_C, CH_R, [[-0.25, 0.17], [-0.15, 0.11], [0, 0.085], [0.15, 0.11], [0.25, 0.17]], 0.015, 'gold', 0.004),
    ...strap(CH_C, CH_R, [[0, 0.43], [0, 0.3], [0, 0.12]], 0.011, 'gold', 0.004),
    ...strap(CH_C, CH_R, [[0.02, 0.4], [0.1, 0.33], [0.2, 0.3], [0.255, 0.24]], 0.011, 'gold', 0.004),
    ...strap(CH_C, CH_R, [[-0.02, 0.4], [-0.1, 0.33], [-0.2, 0.3], [-0.255, 0.24]], 0.011, 'gold', 0.004),
    ...strap(CH_C, CH_R, [[-0.25, 0.39], [-0.14, 0.29], [-0.02, 0.21], [0.11, 0.14], [0.24, 0.11]], 0.026, 'strap', 0.012),
    S(onE(CH_C, CH_R, -0.13, 0.28, 0.035), 0.018, 'gold'),
    S(onE(CH_C, CH_R, 0.11, 0.14, 0.035), 0.018, 'gold'),
    S(onE(CH_C, CH_R, 0, 0.22, 0.032), 0.024, 'gold'),
    C([0, 0.36, 0.03], [0, 0.44, 0.15], 0.11, 'fur'),
    E([0, 0.45, 0.12], [0.18, 0.1, 0.11], 'mane'),
    ...[-0.1, -0.035, 0.035, 0.1].map((x, i) => lock([x, 0.45, 0.17], [x * 0.3, -0.06, 0.05], [x * 0.6, -0.15, 0.04], 0.05, i % 2 ? 'mane' : 'mane2', [0, 0, 1])),
    E([0, 0.42, -0.14], [0.27, 0.17, 0.21], 'mane2'),
    E([0, 0.28, -0.2], [0.24, 0.2, 0.12], 'mane2'),
    ...[-0.22, -0.13, -0.045, 0.045, 0.13, 0.22].map((x, i) => G(lockGeo([x, 0.5, -0.06], [x * 1.3, 0.46, -0.34], [x * 1.25, 0.08 - 0.08 * hsh(i), -0.4], 0.12, 0.42, [0, 1, -0.3], 5, 8, -1.4), i % 2 ? 'mane' : 'mane2')),
    ...[-0.17, -0.06, 0.06, 0.17].map((x, i) => G(lockGeo([x, 0.36, -0.22], [x * 1.3, 0.3, -0.36], [x * 1.3, -0.02 - 0.06 * hsh(i + 9), -0.36], 0.1, 0.42, [0, 1, -0.5], 5, 8, -1.4), i % 2 ? 'mane2' : 'mane')),
    ...PAULDRONS,
  ] },
  { n: 'head', p: 'torso', o: [0, 0.44, 0.16], prims: [
    E([0, 0.13, 0.05], [0.14, 0.13, 0.16], 'fur'),
    E([0, 0.08, 0.18], [0.118, 0.065, 0.105], 'muzzle'),
    C([0, 0.19, 0.15], [0, 0.135, 0.255], 0.05, 'fur'),
    C([-0.03, 0.163, 0.232], [0.03, 0.163, 0.232], 0.012, 'fur'),
    C([-0.026, 0.178, 0.212], [0.026, 0.178, 0.212], 0.011, 'fur'),
    E([0, 0.13, 0.285], [0.058, 0.028, 0.03], 'nose'),
    E([0, 0.112, 0.288], [0.025, 0.025, 0.02], 'nose'),
    E([0, 0.04, 0.19], [0.08, 0.045, 0.09], 'mouth'),
    ...mir([
      // arcade sourcilière froncée : basse au centre, haute sur les côtés
      C([0.035, 0.178, 0.212], [0.115, 0.215, 0.168], 0.024, 'mane2'),
      E([0.1, 0.075, 0.13], [0.075, 0.065, 0.08], 'fur'),
      // babines retroussées
      E([0.055, 0.065, 0.245], [0.042, 0.03, 0.035], 'muzzle', { rot: [0, 0, 0.4] }),
      Cn([0.06, 0.055, 0.255], [0.05, -1, 0.15], 0.08, 0.018, 'teeth'),
      Cn([0.025, 0.05, 0.268], [0, -1, 0.1], 0.03, 0.01, 'teeth'),
      Lk([0.12, 0.06, 0.15], [0.19, 0.06, 0.12], [0.24, 0.02, 0.06], 0.035, 'fur', { ref: [0, 0, 1] }),
      Lk([0.11, 0.0, 0.14], [0.16, -0.03, 0.12], [0.2, -0.08, 0.06], 0.03, 'mane2', { ref: [0, 0, 1] }),
      // oreilles
      Cn([0.135, 0.2, 0.0], [0.55, 1, -0.15], 0.13, 0.05, 'fur'),
      Cn([0.14, 0.205, 0.022], [0.55, 1, -0.15], 0.1, 0.03, 'earIn'),
    ]),
    E([0, 0.16, -0.12], [0.22, 0.24, 0.24], 'mane2'),
    ...maneHead,
  ] },
  { n: 'jaw', p: 'head', o: [0, 0.055, 0.07], prims: [
    E([0, -0.025, 0.1], [0.08, 0.035, 0.1], 'muzzle'),
    E([0, -0.005, 0.11], [0.05, 0.016, 0.07], 'tongue'),
    E([0, -0.05, 0.05], [0.085, 0.05, 0.08], 'fur'),
    ...mir([Cn([0.05, -0.01, 0.18], [0, 1, 0.15], 0.055, 0.015, 'teeth')]),
    ...[-0.04, 0, 0.04].map((x, i) => lock([x, -0.07, 0.08], [x * 0.3, -0.06, 0.0], [x * 0.6, -0.14, -0.04], 0.035, i % 2 ? 'mane' : 'mane2', [0, 0, 1])),
  ] },
  { n: 'eyes', p: 'head', o: [0, 0.155, 0.19], prims: [
    ...mir([
      E([0.068, 0, 0.012], [0.04, 0.02, 0.02], 'eyeW', { rot: [0, 0.35, 0.32] }),
      E([0.064, 0.0, 0.029], [0.01, 0.018, 0.006], 'pupil', { rot: [0, 0.35, 0] }),
    ]),
  ] },
  { n: 'braids', p: 'hips', o: [0, 0.02, -0.16], prims: [
    G(lockGeo([0, 0, 0], [0, -0.1, -0.22], [-0.12, -0.12, -0.4], 0.048, 1, [1, 0, 0], 6, 8, 0.25), 'fur'),
    G(lockGeo([-0.12, -0.12, -0.4], [-0.2, -0.12, -0.48], [-0.25, 0.0, -0.5], 0.04, 1, [1, 0, 0], 6, 6, 0.3), 'fur'),
    ...[0, 1, 2, 3, 4].map((k) => lock([-0.25, -0.02, -0.5], [Math.cos(k * 1.25) * 0.05 - 0.03, 0.05 + Math.sin(k * 1.25) * 0.04, -0.02], [Math.cos(k * 1.25) * 0.07 - 0.05, 0.13 + Math.sin(k * 1.25) * 0.05, -0.04], 0.05, k % 2 ? 'mane' : 'mane2', [0, 0, 1])),
  ] },
  ...['L', 'R'].flatMap((sd) => {
    const x = sd === 'L' ? 1 : -1;
    const uprims = [
      C([0, 0, 0], [0, -UA, 0], 0.09, 'fur'),
      E([0, -0.12, 0], [0.105, 0.12, 0.1], 'fur'),
    ];
    const fprims = [
      C([0, 0, 0], [0, -FA + 0.03, 0], 0.075, 'fur'),
      E([0, -0.07, 0], [0.095, 0.1, 0.09], 'fur'),
    ];
    if (sd === 'R') {
      fprims.push(
        C([0, -0.1, 0], [0, -0.22, 0], 0.088, 'armor'),
        T([0, -0.1, 0], 0.088, 0.014, 'gold'), T([0, -0.22, 0], 0.088, 0.014, 'gold'),
      );
    } else {
      fprims.push(
        C([0, -0.09, 0], [0, -0.22, 0], 0.088, 'strap'),
        T([0, -0.09, 0], 0.088, 0.014, 'gold'), T([0, -0.155, 0], 0.088, 0.01, 'armorD'), T([0, -0.22, 0], 0.088, 0.014, 'gold'),
      );
    }
    return [
      { n: 'uarm' + sd, p: 'torso', o: [x * 0.29, 0.37, 0.02], prims: uprims },
      { n: 'farm' + sd, p: 'uarm' + sd, o: [0, -UA, 0], prims: fprims },
      { n: 'thigh' + sd, p: 'hips', o: [x * 0.14, -0.04, 0], prims: [
        C([0, 0, 0], [0, -TH, 0], 0.1, 'armorD'),
        E([0, -0.11, 0], [0.122, 0.105, 0.122], 'armor'),
        T([0, -0.05, 0], 0.112, 0.012, 'gold'),
      ] },
      { n: 'shin' + sd, p: 'thigh' + sd, o: [0, -TH, 0], prims: [
        C([0, 0, 0], [0, -SH + 0.03, 0], 0.072, 'fur'),
        E([0, -0.07, 0], [0.088, 0.1, 0.088], 'fur'),
        S([0, 0, 0], 0.08, 'armor'),
        T([0, -0.02, 0], 0.08, 0.012, 'gold'),
      ] },
      { n: 'foot' + sd, p: 'shin' + sd, o: [0, -SH, 0], prims: [
        E([0, -0.03, 0.05], [0.095, 0.052, 0.13], 'fur'),
        ...[-1, 0, 1].flatMap((k) => [
          S([k * 0.05, -0.04, 0.15], 0.032, 'fur'),
          G(lockGeo([k * 0.055, -0.04, 0.17], [k * 0.06, -0.04, 0.21], [k * 0.065, -0.075, 0.23], 0.016, 1, [1, 0, 0], 5, 4, 1), 'claw'),
        ]),
        Lk([0.03, 0.01, -0.06], [0.05, 0.0, -0.11], [0.06, -0.05, -0.14], 0.03, 'mane2', { ref: [1, 0, 0] }),
      ] },
    ];
  }),
  // patte gauche : orientée dans le monde par la pose (griffes vers le sol)
  { n: 'pawL', p: 'farmL', o: [0, -FA, 0], prims: [
    E([0, -0.045, 0.02], [0.082, 0.065, 0.085], 'fur'),
    ...[-1.5, -0.5, 0.5, 1.5].flatMap((k) => [
      C([k * 0.032, -0.06, 0.06], [k * 0.04, -0.1, 0.11], 0.024, 'fur'),
      G(lockGeo([k * 0.04, -0.1, 0.13], [k * 0.045, -0.13, 0.17], [k * 0.05, -0.19, 0.17], 0.017, 1, [1, 0, 0], 5, 4, 1), 'claw'),
    ]),
    G(lockGeo([0.07, -0.05, 0.06], [0.1, -0.08, 0.1], [0.1, -0.13, 0.11], 0.015, 1, [1, 0, 0], 5, 4, 1), 'claw'),
  ] },
  // patte droite : poing serré sur la lame, orienté dans le monde par la pose
  { n: 'pawR', p: 'farmR', o: [0, -FA, 0], prims: [
    E([0, -0.04, 0.0], [0.08, 0.07, 0.08], 'fur'),
    ...[-0.03, -0.065, -0.1].map((y) => C([-0.045, y, 0.06], [0.045, y, 0.06], 0.02, 'fur')),
    C([0.07, -0.02, 0.03], [0.07, -0.07, 0.07], 0.022, 'fur'),
    C([0, 0.07, 0.0], [0, -0.13, 0.0], 0.022, 'grip'),
    S([0, 0.085, 0], 0.03, 'gold'),
    E([0, -0.13, 0.0], [0.05, 0.022, 0.06], 'gold'),
    G(bladeGeo(false), 'blade'),
    G(bladeGeo(true), 'hornD'),
  ] },
];
const PART_INDEX = Object.fromEntries(PARTS.map((p, i) => [p.n, i]));

/* ============================================================
   2. SQUELETTE MAÎTRE + ANIMS + IK (calculé une fois par frame)
   ============================================================ */
const M = {};
for (const P of PARTS) { const g = new THREE.Object3D(); g.position.fromArray(P.o); M[P.n] = g; if (P.p) M[P.p].add(g); }

const _v = new THREE.Vector3(), _m = new THREE.Matrix4();
const clamp = (x, a, b) => Math.min(b, Math.max(a, x));
function solveLimb(upper, lower, S0, Tt, a, b, pole) {
  const d = Tt.clone().sub(S0); let D = d.length(); const dir = d.normalize();
  D = clamp(D, Math.abs(a - b) + 1e-3, a + b - 2e-4);
  const cosA = clamp((a * a + D * D - b * b) / (2 * a * D), -1, 1), sinA = Math.sqrt(1 - cosA * cosA);
  const perp = pole.clone().sub(dir.clone().multiplyScalar(pole.dot(dir))).normalize();
  const Eb = S0.clone().addScaledVector(dir, a * cosA).addScaledVector(perp, a * sinA);
  const Y = S0.clone().sub(Eb).normalize();
  const Tc = S0.clone().addScaledVector(dir, D);
  const toT = Tc.sub(Eb); const Z = toT.sub(Y.clone().multiplyScalar(toT.dot(Y)));
  if (Z.lengthSq() < 1e-8) Z.copy(perp); Z.normalize();
  const X = new THREE.Vector3().crossVectors(Y, Z);
  upper.quaternion.setFromRotationMatrix(_m.makeBasis(X, Y, Z));
  const cosC = clamp((a * a + b * b - D * D) / (2 * a * b), -1, 1);
  lower.rotation.set(-(Math.PI - Math.acos(cosC)), 0, 0);
}

const pos = (x) => Math.max(0, x);
const ss = (x) => x * x * (3 - 2 * x);
const seg = (x, a, b) => Math.min(1, Math.max(0, (x - a) / (b - a)));
const eOut = (x) => 1 - Math.pow(1 - x, 3);
// ressort amorti : 0 -> 1 avec un petit dépassement, pour les retombées
const spring = (x) => (x <= 0 ? 0 : 1 - Math.exp(-6 * x) * Math.cos(9 * x));
const BASE = {
  hipP: [0, 0.4, 0], hipR: [0.3, 0, 0], torR: [0.5, 0, 0], headR: [-0.84, 0, 0],
  braR: [0.55, 0, 0], braZ: 0, jaw: 0.2,
  handL: [0.36, 0.2, 0.42], poleL: [1, 0.2, -0.7], pawL: [0.2, -0.2, 0],
  handR: [-0.36, 0.42, 0.38], poleR: [-1, 0.0, -0.6], pawR: [-0.35, -0.93, -0.02, -0.6, 0, 0.8],
  footL: [0.23, 0.082, 0.14], footR: [-0.23, 0.082, -0.12],
  toeL: 0, toeR: 0, yawL: 0.35, yawR: -0.3,
};
const P0 = () => JSON.parse(JSON.stringify(BASE));
const ANIMS = {
  chill(t) {
    const P = P0();
    // respiration lourde
    const br = Math.sin((2 * Math.PI * t) / 2.3), br2 = Math.sin((2 * Math.PI * t) / 2.3 - 0.6);
    const sw = Math.sin((2 * Math.PI * t) / 5.1);
    // il scrute : coups de tête qui s'arrêtent net puis se posent
    const sc = t / 2.7, k = sc % 1, j = Math.floor(sc);
    const L = [0.32, -0.08, -0.34, 0.12, 0.02];
    const look = L[j % 5], prev = L[(j + 4) % 5];
    const e = k < 0.2 ? spring(k / 0.2 * 0.55) : spring(0.55 + (k - 0.2) * 3);
    const yaw = prev + (look - prev) * Math.min(1.08, e);
    // grognement toutes les 8 s : la tête plonge, les babines se retroussent, les épaules se gonflent
    const gp = (t % 8) / 8;
    const gr = ss(seg(gp, 0.7, 0.75)) * (1 - ss(seg(gp, 0.86, 0.96)));
    const grS = gr * Math.sin(t * 38) * 0.012;
    // la lame tourne dans le poing de temps en temps
    const tw = (t % 11) / 11, twi = ss(seg(tw, 0.3, 0.4)) * (1 - ss(seg(tw, 0.48, 0.6)));
    P.hipP = [0.015 * sw, 0.4 - 0.012 * br - 0.02 * gr, -0.01 * gr];
    P.hipR = [0.3 + 0.03 * gr, 0.08 * yaw, 0.02 * sw];
    P.torR = [0.5 + 0.035 * br + 0.08 * gr, -0.22 * yaw, -0.025 * sw];
    P.headR = [-0.84 - 0.03 * br2 + 0.12 * gr + grS, 0.5 * yaw, 0.1 * yaw + grS];
    P.jaw = 0.17 + 0.05 * pos(br2) + 0.33 * gr;
    P.braR = [0.55 + 0.1 * Math.sin(t * 0.9), 0, 0]; P.braZ = 0.4 * Math.sin(t * 1.3) + 0.15 * Math.sin(t * 3.1);
    P.handL = [0.36 + 0.01 * sw, 0.2, 0.42];
    P.pawL = [0.2 + 0.25 * gr, -0.2, 0];
    P.handR = [-0.36, 0.42 - 0.012 * br + 0.04 * twi, 0.38];
    P.pawR = [-0.35 - 0.25 * twi, -0.93 + 1.3 * twi, -0.02 + 0.8 * twi, -0.6 + 0.8 * twi, 0.3 * twi, 0.8 - 0.4 * twi];
    return P;
  },
  walk(t) {
    // il rôde : démarche basse, la main gauche touche le sol comme une patte, la tête reste stable
    const P = P0();
    const ph = (2 * Math.PI * t) / 1.1, s = Math.sin(ph), c = Math.cos(ph), c2 = Math.cos(2 * ph);
    P.hipP = [0.03 * s, 0.39 - 0.018 * c2, 0];
    P.hipR = [0.32, 0.12 * c, 0.05 * s];
    P.torR = [0.54 + 0.03 * c2, -0.18 * c, -0.06 * s];
    P.headR = [-0.86 - 0.03 * c2, 0.07 * c + 0.12 * Math.sin(t * 0.7), 0.04 * s];
    P.jaw = 0.18 + 0.04 * pos(c2);
    P.braR = [0.5, 0, 0]; P.braZ = 0.3 * s;
    P.footL = [0.2, 0.082 + 0.09 * pos(s), -0.2 * c + 0.02];
    P.footR = [-0.2, 0.082 + 0.09 * pos(-s), 0.2 * c - 0.02];
    P.toeL = 0.45 * pos(s) * c; P.toeR = -0.45 * pos(-s) * c;
    P.yawL = 0.15; P.yawR = -0.15;
    // patte gauche en phase avec le pied droit (allure diagonale)
    P.handL = [0.34, 0.2 + 0.1 * pos(-s), 0.4 + 0.18 * c];
    P.pawL = [0.2 - 0.5 * pos(-s), -0.2, 0];
    P.handR = [-0.36, 0.44 + 0.03 * pos(s), 0.36 - 0.1 * c];
    P.pawR = [-0.35, -0.93, -0.02 + 0.25 * c, -0.6, 0, 0.8];
    return P;
  },
  win(t) {
    // rugissement : il se ramasse, se dresse d'un coup bras écartés, rugit en tremblant, puis retombe en garde
    const P = P0();
    const p = (t / 3.0) % 1;
    const crouch = ss(seg(p, 0.0, 0.16)) * (1 - ss(seg(p, 0.16, 0.24)));
    const up = eOut(seg(p, 0.16, 0.27)) * (1 - ss(seg(p, 0.74, 0.86)));
    const roar = ss(seg(p, 0.22, 0.3)) * (1 - ss(seg(p, 0.7, 0.8)));
    const land = seg(p, 0.84, 1.0);
    const bounce = land > 0 ? (1 - spring(land * 1.6)) : 0; // petit tassement à l'atterrissage
    const sh = roar * Math.sin(t * 52) * 0.03;
    P.hipP = [0, 0.4 - 0.07 * crouch + 0.08 * up + 0.04 * bounce, 0];
    P.hipR = [0.3 + 0.12 * crouch - 0.36 * up, 0, 0];
    P.torR = [0.5 + 0.2 * crouch - 0.58 * up + 0.12 * bounce, 0, sh];
    P.headR = [-0.84 - 0.1 * crouch + 0.55 * up - 0.35 * roar + sh, sh * 0.5, 0];
    P.jaw = 0.2 + 0.6 * roar;
    P.braR = [0.55 + 0.6 * up, 0, 0]; P.braZ = sh * 4;
    P.handL = [0.36 + 0.26 * up, 0.2 + 0.05 * crouch + 0.66 * up, 0.42 - 0.2 * up];
    P.poleL = [1, -0.6 * up + 0.2, -0.7 + 0.2 * up];
    P.pawL = [0.2 - 1.4 * up, -0.2, 0.6 * up];
    P.handR = [-0.36 - 0.26 * up, 0.42 + 0.45 * up, 0.38 - 0.16 * up];
    P.poleR = [-1, -0.6 * up, -0.6 + 0.2 * up];
    P.pawR = [-0.35 - 0.45 * up, -0.93 + 1.35 * up, -0.02 + 0.1 * up, -0.6 + 0.2 * up, 0, 0.8];
    P.footL = [0.23, 0.082, 0.14]; P.footR = [-0.23, 0.082, -0.12];
    return P;
  },
};
function blendPose(a, b, w) {
  const o = {};
  for (const k in a) o[k] = Array.isArray(a[k]) ? a[k].map((v, i) => v + (b[k][i] - v) * w) : a[k] + (b[k] - a[k]) * w;
  return o;
}

const anim = { cur: 'chill', prev: 'chill', w: 1 };
const braid = { x: 0, vx: 0, z: 0, vz: 0, lastP: null, lastV: new THREE.Vector3(), acc: new THREE.Vector3() };
let blink = { next: 2, t: -1 };

const qa = new THREE.Quaternion(), qb = new THREE.Quaternion(), eu = new THREE.Euler();
const _q1 = new THREE.Quaternion(), _q2 = new THREE.Quaternion();
// bras : cible et coude donnés dans le repère du perso, convertis dans celui du torse
function armIK(sd, P) {
  const up = M['uarm' + sd], lo = M['farm' + sd];
  M.torso.updateMatrixWorld(true);
  const Tt = new THREE.Vector3(...P['hand' + sd]).applyMatrix4(M.torso.matrixWorld.clone().invert());
  M.torso.getWorldQuaternion(_q1); _q1.invert();
  const pole = new THREE.Vector3(...P['pole' + sd]).applyQuaternion(_q1).normalize();
  solveLimb(up, lo, up.position, Tt, UA, FA, pole);
}
// oriente un os dans le repère du perso, quel que soit son parent
const _ax = new THREE.Vector3(), _ay = new THREE.Vector3(), _az = new THREE.Vector3();
function orientWorld(bone, e) {
  bone.parent.updateMatrixWorld(true);
  bone.parent.getWorldQuaternion(_q1);
  if (e.length === 6) {
    // e = [direction de la lame (axe -Y local), normale du plat (axe X local)]
    _ay.set(-e[0], -e[1], -e[2]).normalize();
    _ax.set(e[3], e[4], e[5]); _ax.addScaledVector(_ay, -_ax.dot(_ay)).normalize();
    _az.crossVectors(_ax, _ay);
    _q2.setFromRotationMatrix(_m.makeBasis(_ax, _ay, _az));
  } else _q2.setFromEuler(eu.set(e[0], e[1], e[2]));
  bone.quaternion.copy(_q1.invert().multiply(_q2));
}
function applyPose(P, dt, time) {
  M.hips.position.fromArray(P.hipP); M.hips.rotation.set(...P.hipR);
  M.torso.rotation.set(...P.torR); M.head.rotation.set(...P.headR); M.jaw.rotation.x = P.jaw; M.head.scale.setScalar(1.12);
  // clignement
  if (time > blink.next && blink.t < 0) blink.t = 0;
  let bl = 1;
  if (blink.t >= 0) { blink.t += dt; const k = blink.t / 0.16; bl = k < 1 ? 1 - 0.92 * Math.sin(Math.PI * k) : 1; if (k >= 1) { blink.t = -1; blink.next = time + 2.2 + Math.random() * 2.8; } }
  M.eyes.scale.set(1, bl, 1);
  M.hips.updateMatrixWorld(true);
  armIK('L', P); armIK('R', P);
  orientWorld(M.pawL, P.pawL); orientWorld(M.pawR, P.pawR);
  // jambes : cibles dans le monde, pieds à plat
  M.hips.updateMatrix();
  const inv = M.hips.matrix.clone().invert();
  const hq = M.hips.quaternion.clone(), hqi = hq.clone().invert();
  for (const sd of ['L', 'R']) {
    const Tt = new THREE.Vector3(...P['foot' + sd]).applyMatrix4(inv);
    const pole = new THREE.Vector3(sd === 'L' ? 0.45 : -0.45, 0, 1).applyQuaternion(hqi).normalize();
    solveLimb(M['thigh' + sd], M['shin' + sd], M['thigh' + sd].position, Tt, TH, SH, pole);
    qa.copy(hq).multiply(M['thigh' + sd].quaternion).multiply(M['shin' + sd].quaternion).invert();
    qb.setFromEuler(eu.set(P['toe' + sd], P.hipR[1] * 0.5 + P['yaw' + sd], 0));
    M['foot' + sd].quaternion.copy(qa.multiply(qb));
  }
  // queue : pendule physique, poussé par l'accélération des hanches
  M.hips.updateMatrixWorld(true);
  const hp = new THREE.Vector3().setFromMatrixPosition(M.braids.matrixWorld);
  if (braid.lastP && dt > 0) {
    const v = hp.clone().sub(braid.lastP).divideScalar(dt);
    const a = v.clone().sub(braid.lastV).divideScalar(dt);
    braid.acc.lerp(a, 0.5);
    braid.lastV.copy(v);
  }
  braid.lastP = hp;
  const steps = 4, h = dt / steps, L = 0.3, g = 9.8;
  for (let k = 0; k < steps; k++) {
    const Gy = -g - braid.acc.y, Gz = -braid.acc.z, Gx = -braid.acc.x;
    let ax = (Gy * Math.sin(braid.x) - Gz * Math.cos(braid.x)) / L * 0.25;
    ax += -16 * (braid.x - P.braR[0]) - 5 * braid.vx;
    braid.vx += ax * h; braid.x += braid.vx * h;
    let az = (Gy * Math.sin(braid.z) + Gx * Math.cos(braid.z)) / L * 0.25;
    az += -16 * (braid.z - P.braZ) - 5 * braid.vz;
    braid.vz += az * h; braid.z += braid.vz * h;
  }
  braid.x = clamp(braid.x, -0.6, 1.4); braid.z = clamp(braid.z, -0.8, 0.8);
  M.braids.rotation.set(braid.x - P.hipR[0], 0, braid.z);
  M.hips.updateMatrixWorld(true);
}


const srgb = (h) => { const n = parseInt(h.slice(1), 16); return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255]; };
const lin = (c) => c.map((x) => (x <= 0.04045 ? x / 12.92 : Math.pow((x + 0.055) / 1.055, 2.4)));
const Y = new THREE.Vector3(0, 1, 0);
const KEY_POS = new THREE.Vector3(2.2, 4, 3);

function primGeometry(pr, seg) {
  let g;
  const s = seg;
  switch (pr.t) {
    case 'geo': g = pr.g(); break;
    case 'sph': g = new THREE.SphereGeometry(pr.r, Math.round(20 * s), Math.round(14 * s)); break;
    case 'ell': g = new THREE.SphereGeometry(1, Math.round(28 * s), Math.round(20 * s)); g.scale(...pr.rad); break;
    case 'hemi': g = new THREE.SphereGeometry(1, Math.round(28 * s), Math.round(10 * s), 0, Math.PI * 2, 0, Math.PI / 2); g.scale(...pr.rad); break;
    case 'cap': {
      const a = new THREE.Vector3(...pr.a), b = new THREE.Vector3(...pr.b), d = b.clone().sub(a);
      g = new THREE.CapsuleGeometry(pr.r, d.length(), Math.max(3, Math.round(5 * s)), Math.round(14 * s));
      g.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(Y, d.normalize()));
      g.translate(...a.add(b).multiplyScalar(0.5).toArray());
      return g;
    }
    case 'box': g = new RoundedBoxGeometry(pr.h[0] * 2, pr.h[1] * 2, pr.h[2] * 2, Math.max(2, Math.round(3 * s)), pr.r); break;
    case 'tor': g = new THREE.TorusGeometry(pr.R, pr.r, Math.round(10 * s), Math.round(30 * s)); g.rotateX(Math.PI / 2); break;
  }
  if (pr.rot) g.applyMatrix4(new THREE.Matrix4().makeRotationFromEuler(new THREE.Euler(...pr.rot)));
  g.translate(...pr.c);
  return g;
}

// rig maillé : un Group par membre, rempli par une fabrique de mesh
function buildMeshRig(meshFor, { detail = false, seg = 1 } = {}) {
  const joints = {};
  let root;
  for (const P of PARTS) {
    const g = new THREE.Group(); joints[P.n] = g;
    if (P.p) joints[P.p].add(g); else root = g;
    for (const pr of P.prims) {
      if (pr.detail && !detail) continue;
      for (const m of meshFor(pr, primGeometry(pr, seg))) g.add(m);
    }
  }
  return { root, joints };
}
function copyPose(joints) {
  for (const n in joints) { const s = M[n], d = joints[n]; d.position.copy(s.position); d.quaternion.copy(s.quaternion); d.scale.copy(s.scale); }
}

  return { PAL, PARTS, M, ANIMS, blendPose, applyPose, buildMeshRig, copyPose, anim };
}
