// Généré par tools/build_champs.py depuis styles-perso/ronin-pixel.html : ne pas modifier à la main.
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';

export function create() {
const PAL = {
  skin: '#e2ae84', stubble: '#c99470', hair: '#5b3424', band: '#e0402f', keff: '#22a8a0', keffR: '#178079',
  kimono: '#ecdcb8', collar: '#c9b48a', hakama: '#4d5f9e', obi: '#e9a93a', wrap: '#f1ece0', straw: '#f0d488', strawD: '#c79a4a',
  cord: '#8a4b2a', saya: '#4a3560', tsuka: '#f3ead6', gold: '#f0b93a', steel: '#dfe8ef', grass: '#7cc44e',
  eyeW: '#fbf5ec', pupil: '#1a0e09', lips: '#9a4f3c', white: '#ffffff',
};
const METAL = { steel: 1, gold: 1 };

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
  return [p, q];
});
const nrm = (v) => { const l = Math.hypot(...v); return v.map((x) => x / l); };
const add = (a, b, k = 1) => a.map((x, i) => x + b[i] * k);
// tronc de cône de a vers b (rayon r1 en a, r2 en b)
const seg = (a, b, r1, r2, n = 16, open = false, sz = 1) => () => {
  const A = new THREE.Vector3(...a), Bv = new THREE.Vector3(...b), d = Bv.clone().sub(A);
  const g = new THREE.CylinderGeometry(r2, r1, d.length(), n, 1, open);
  if (sz !== 1) g.scale(1, 1, sz);
  g.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), d.clone().normalize()));
  g.translate(...A.add(Bv).multiplyScalar(0.5).toArray());
  return g;
};
const spike = (base, dir, len, r) => G(seg(base, add(base, nrm(dir), len), r, 0.004, 10), 'hair');

// sabres glissés dans la ceinture, côté gauche : poignée devant, fourreau vers l'arrière
const KM = [0.215, 0.065, 0.12], KD = nrm([0.26, -0.33, -1]);
const WM = [0.17, 0.1, 0.13], WD = nrm([0.18, -0.24, -1]);

// haori ouvert devant, chapeau de paille dans le dos
const haori = () => new THREE.CylinderGeometry(0.205, 0.235, 0.39, 36, 1, true, 0.5, Math.PI * 2 - 1.0).scale(1, 1, 0.8).translate(0, 0.215, 0);
const skirt = () => new THREE.CylinderGeometry(0.205, 0.245, 0.17, 30, 1, true).translate(0, -0.045, 0);
const legTube = () => new THREE.CylinderGeometry(0.145, 0.2, 0.36, 22, 1, true).translate(0, -0.17, 0);
const obi = () => new THREE.CylinderGeometry(0.208, 0.208, 0.085, 32).scale(1, 1, 0.8).translate(0, 0.055, 0);
const hat = () => new THREE.ConeGeometry(0.31, 0.12, 40, 1).rotateX(-Math.PI / 2 + 0.22).translate(0, 0.2, -0.27);
const hatRing = (r) => () => new THREE.TorusGeometry(r, 0.008, 5, 36).rotateX(Math.PI / 2).translate(0, 0.06 - 0.12 * (r / 0.31) + 0.006, 0).rotateX(-Math.PI / 2 + 0.22).translate(0, 0.2, -0.27);
const hatRim = () => new THREE.TorusGeometry(0.305, 0.012, 6, 40).rotateX(0.22).translate(0, 0.2 - 0.065 * Math.sin(0.22), -0.27 + 0.065 * Math.cos(0.22));

const PARTS = [
  { n: 'hips', p: null, o: [0, 0.602, 0], prims: [
    B([0, 0, 0], [0.17, 0.1, 0.125], 0.07, 'hakama'), G(skirt, 'hakama', { ds: 1 }),
    G(obi, 'obi'), B([-0.09, 0.055, 0.16], [0.045, 0.032, 0.02], 0.012, 'obi', { rot: [0, 0.3, 0.2] }),
    // katana (fourreau)
    C(KM, add(KM, KD, 0.6), 0.024, 'saya'), S(add(KM, KD, 0.6), 0.03, 'gold'),
    // wakizashi complet (le petit sabre ne sort pas)
    C(WM, add(WM, WD, 0.4), 0.021, 'saya'), S(add(WM, WD, 0.4), 0.026, 'gold'),
    G(seg(add(WM, WD, -0.01), add(WM, WD, 0.012), 0.04, 0.04, 20), 'gold'),
    C(add(WM, WD, -0.02), add(WM, WD, -0.13), 0.019, 'tsuka'), S(add(WM, WD, -0.135), 0.022, 'gold'),
  ] },
  { n: 'hiltK', p: 'hips', o: KM, prims: [
    G(seg(add([0, 0, 0], KD, -0.012), add([0, 0, 0], KD, 0.012), 0.048, 0.048, 20), 'gold'),
    C(add([0, 0, 0], KD, -0.025), add([0, 0, 0], KD, -0.19), 0.022, 'tsuka'), S(add([0, 0, 0], KD, -0.195), 0.025, 'gold'),
  ] },
  { n: 'torso', p: 'hips', o: [0, 0.05, 0], prims: [
    B([0, 0.2, 0], [0.19, 0.21, 0.135], 0.11, 'kimono'),
    G(haori, 'keff', { ds: 1 }),
    ...mir([B([0.045, 0.28, 0.137], [0.016, 0.12, 0.012], 0.008, 'collar', { rot: [0, 0, 0.42] })]),
    C([0, 0.37, 0], [0, 0.47, 0], 0.066, 'skin'),
    // chapeau de paille dans le dos et sa cordelette
    G(hat, 'straw'), G(hatRim, 'strawD'), G(hatRing(0.21), 'strawD'), G(hatRing(0.11), 'strawD'),
    C([0.14, 0.4, 0.06], [0.155, 0.05, 0.155], 0.011, 'cord'),
    C([-0.14, 0.4, 0.06], [-0.155, 0.05, 0.155], 0.011, 'cord'),
  ] },
  { n: 'head', p: 'torso', o: [0, 0.45, 0], prims: [
    E([0, 0.27, 0], [0.262, 0.27, 0.25], 'skin'),
    Hm([0, 0.165, 0.008], [0.266, 0.175, 0.255], 'stubble', { rot: [Math.PI, 0, 0] }),
    S([0, 0.205, 0.24], 0.034, 'skin'),
    ...mir([S([0.258, 0.25, 0.0], 0.042, 'skin')]),
    // bouche en coin, brin d'herbe
    C([-0.055, 0.12, 0.244], [0.02, 0.114, 0.252], 0.012, 'lips'), C([0.02, 0.114, 0.252], [0.06, 0.128, 0.24], 0.012, 'lips'),
    C([0.045, 0.122, 0.25], [0.21, 0.17, 0.37], 0.012, 'grass'), S([0.215, 0.172, 0.375], 0.018, 'grass'),
    // sourcils froncés
    ...mir([C([0.155, 0.345, 0.198], [0.045, 0.312, 0.24], 0.021, 'hair')]),
    // pansement en croix sur la joue
    B([-0.145, 0.235, 0.205], [0.04, 0.013, 0.008], 0.006, 'wrap', { rot: [0, -0.55, 0.6] }),
    B([-0.145, 0.235, 0.205], [0.04, 0.013, 0.008], 0.006, 'wrap', { rot: [0, -0.55, -0.6] }),
    // cheveux en bataille
    E([0, 0.27, -0.05], [0.27, 0.25, 0.218], 'hair'),
    Hm([0, 0.33, -0.02], [0.282, 0.26, 0.27], 'hair', { rot: [-0.3, 0, 0] }),
    spike([0, 0.5, 0.1], [0.1, 1, 0.9], 0.2, 0.07), spike([0.12, 0.5, 0.05], [0.8, 0.9, 0.5], 0.19, 0.065),
    spike([-0.12, 0.52, 0.04], [-0.7, 1, 0.6], 0.2, 0.068), spike([0.05, 0.55, -0.08], [0.2, 1, -0.3], 0.18, 0.07),
    spike([-0.1, 0.5, -0.15], [-0.5, 0.6, -0.8], 0.19, 0.07), spike([0.13, 0.45, -0.17], [0.6, 0.3, -0.9], 0.17, 0.065),
    spike([0, 0.4, -0.24], [0, 0, -1], 0.17, 0.07), spike([-0.2, 0.38, -0.1], [-1, 0.1, -0.5], 0.14, 0.06),
    spike([0.2, 0.38, -0.1], [1, 0.05, -0.4], 0.14, 0.06),
    spike([0.08, 0.43, 0.2], [0.35, -0.5, 1], 0.15, 0.05), spike([-0.1, 0.43, 0.2], [-0.4, -0.55, 0.9], 0.16, 0.05),
    spike([0.22, 0.36, 0.08], [0.6, -0.9, 0.3], 0.12, 0.045), spike([-0.22, 0.36, 0.08], [-0.6, -0.9, 0.3], 0.12, 0.045),
    // bandeau
    G(() => new THREE.TorusGeometry(0.275, 0.026, 8, 40).scale(1, 1, 0.98).rotateX(Math.PI / 2 - 0.2).translate(0, 0.39, -0.01), 'band'),
    B([0, 0.355, -0.285], [0.035, 0.03, 0.025], 0.015, 'band', { rot: [-0.2, 0, 0] }),
  ] },
  { n: 'eyes', p: 'head', o: [0, 0.258, 0.2], prims: mir([
    E([0.095, 0, 0.012], [0.054, 0.044, 0.036], 'eyeW'),
    S([0.088, -0.004, 0.04], 0.027, 'pupil'),
  ]) },
  // les deux pans du bandeau (pendule physique)
  { n: 'braids', p: 'head', o: [0, 0.355, -0.3], prims: [
    B([0.035, -0.12, -0.01], [0.026, 0.12, 0.01], 0.008, 'band', { rot: [0, 0, 0.18] }),
    B([-0.03, -0.09, -0.02], [0.024, 0.09, 0.01], 0.008, 'band', { rot: [0.15, 0, -0.22] }),
  ] },
  ...['L', 'R'].flatMap((sd) => {
    const x = sd === 'L' ? 1 : -1;
    const fprims = [
      G(seg([0, 0.01, 0], [0, -0.09, 0], 0.074, 0.096, 18), 'keff'),
      C([0, -0.07, 0], [0, -0.17, 0], 0.052, 'wrap'),
      S([0, -0.225, 0.005], 0.064, 'skin'),
      S([-x * 0.035, -0.2, 0.045], 0.029, 'skin'),
    ];
    return [
      { n: 'uarm' + sd, p: 'torso', o: [x * 0.245, 0.34, 0], prims: [C([0, 0, 0], [0, -0.2, 0], 0.076, 'keff')] },
      { n: 'farm' + sd, p: 'uarm' + sd, o: [0, -0.21, 0], prims: fprims },
      { n: 'thigh' + sd, p: 'hips', o: [x * 0.095, -0.02, 0], prims: [C([0, 0, 0], [0, -0.25, 0], 0.08, 'hakama'), G(legTube, 'hakama', { ds: 1, c: [x * 0.02, 0, 0] })] },
      { n: 'shin' + sd, p: 'thigh' + sd, o: [0, -0.25, 0], prims: [C([0, 0, 0], [0, -0.2, 0], 0.07, 'wrap'), T([0, -0.13, 0], 0.07, 0.008, 'cord'), T([0, -0.06, 0], 0.07, 0.008, 'cord')] },
      { n: 'foot' + sd, p: 'shin' + sd, o: [0, -0.25, 0], prims: [
        B([0, -0.025, 0.045], [0.066, 0.04, 0.12], 0.038, 'skin'),
        B([0, -0.07, 0.045], [0.08, 0.014, 0.135], 0.01, 'straw'),
        B([0, -0.03, 0.09], [0.07, 0.012, 0.014], 0.006, 'cord', { rot: [0, 0, 0] }),
      ] },
    ];
  }),
  // katana dégainé (dans la main droite, sort pendant la victoire)
  { n: 'sword', p: 'farmR', o: [0, -0.225, 0.0], prims: [
    C([0, 0.05, 0], [0, -0.1, 0], 0.022, 'tsuka'), S([0, 0.06, 0], 0.025, 'gold'),
    G(seg([0, -0.1, 0], [0, -0.122, 0], 0.05, 0.05, 20), 'gold'),
    B([0, -0.43, 0], [0.028, 0.3, 0.012], 0.008, 'steel'),
    G(() => new THREE.ConeGeometry(0.024, 0.07, 4).scale(1, 1, 0.42).rotateY(Math.PI / 4).translate(0, -0.765, 0).rotateX(Math.PI).translate(0, -1.53, 0), 'steel'),
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

const BEAT = 60 / 92;
const pos = (x) => Math.max(0, x);
const ANIMS = {
  chill(t) {
    const b = t / BEAT, p = b % 1;
    const d = (1 + Math.cos(2 * Math.PI * p * 0.5)) / 2;
    const sw = Math.sin(Math.PI * b * 0.5), s4 = Math.sin((Math.PI * b) / 4);
    // toutes les 7 s il se gratte la barbe
    const q = (t % 7) / 7, sm = (a, b_, x) => { const k = clamp((x - a) / (b_ - a), 0, 1); return k * k * (3 - 2 * k); };
    const e = sm(0.52, 0.62, q) * (1 - sm(0.8, 0.9, q));
    const rub = Math.sin(t * 15) * e;
    const look = Math.sin(t * 0.45) * 0.5 + Math.sin(t * 0.17) * 0.5;
    return {
      hipP: [0.03 + 0.008 * sw, 0.592 - 0.012 * d, 0], hipR: [0, 0.18 + 0.05 * s4, -0.05 + 0.015 * sw],
      torR: [0.04 + 0.03 * d, -0.12 * s4 - 0.08, 0.04 - 0.01 * sw], headR: [-0.02 + 0.03 * d - 0.14 * e, 0.3 * look * (1 - e) - 0.15 * e, 0.06 * e + 0.02 * sw],
      braR: [0.28, 0, 0],
      handR: [-0.27 + 0.2 * e + 0.015 * rub, -0.08 + 0.55 * e + 0.01 * d, 0.03 + 0.23 * e], poleR: [-0.6, -1, -0.5 + 0.4 * e],
      handL: [0.2, 0.1 + 0.01 * d, 0.21], poleL: [1, -0.4, -0.6],
      footL: [0.14, 0.082, 0.02], footR: [-0.13, 0.082, 0.09],
      toeL: 0, toeR: 0, yawL: 0.3, yawR: -0.12, blinkBias: 0, draw: 0,
    };
  },
  walk(t) {
    const ph = (2 * Math.PI * t) / 0.95, s = Math.sin(ph), c = Math.cos(ph);
    return {
      hipP: [0.025 * s, 0.555 + 0.02 * -Math.cos(2 * ph), 0], hipR: [0.06, 0.15 * c, 0.05 * s],
      torR: [0.13, -0.2 * c, -0.05 * s], headR: [0.0 + 0.03 * Math.cos(2 * ph), 0.09 * c, 0.03 * s],
      braR: [0.75 + 0.1 * Math.cos(2 * ph), 0, 0],
      handR: [-0.29, -0.05 + 0.04 * Math.abs(c), -0.2 * c], poleR: [-0.6, -1, -0.8],
      handL: [0.2, 0.1 + 0.02 * Math.cos(2 * ph), 0.2 + 0.02 * c], poleL: [1, -0.4, -0.6],
      footL: [0.1, 0.082 + 0.085 * pos(s), -0.18 * c], footR: [-0.1, 0.082 + 0.085 * pos(-s), 0.18 * c],
      toeL: 0.4 * pos(s) * c, toeR: -0.4 * pos(-s) * c, yawL: 0.1, yawR: -0.1, blinkBias: 0, draw: 0,
    };
  },
  win(t) {
    const p = (t / 1.25) % 1;
    let y, air = 0;
    if (p < 0.42) { const s = p / 0.42; y = 0.27 * 4 * s * (1 - s); air = Math.sin(Math.PI * s); }
    else { const q = (p - 0.42) / 0.58; y = -0.11 * Math.sin(Math.PI * q) * Math.exp(-q); }
    const crouch = y < 0 ? -y / 0.11 : 0;
    const hy = 0.602 + y, fy = Math.max(0.082, hy - 0.02 - 0.47);
    return {
      hipP: [0, hy, 0], hipR: [0, 0.25, 0],
      torR: [0.2 * crouch - 0.1 * air, -0.2, 0.05], headR: [-0.22 * air + 0.1 * crouch, 0.15, 0],
      braR: [0.3, 0, 0],
      handR: [-0.3, 0.7 + 0.06 * air - 0.05 * crouch, 0.16], poleR: [-1, -0.4, -0.4],
      handL: [0.2, 0.11, 0.21], poleL: [1, -0.4, -0.6],
      footL: [0.13, fy, 0.03 + 0.05 * air], footR: [-0.13, fy, 0.0 + 0.05 * air],
      toeL: 0.45 * air, toeR: 0.45 * air, yawL: 0.2, yawR: -0.15, blinkBias: 0, draw: 1,
    };
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
function applyPose(P, dt, time) {
  M.hips.position.fromArray(P.hipP); M.hips.rotation.set(...P.hipR);
  M.torso.rotation.set(...P.torR); M.head.rotation.set(...P.headR);
  // clignement
  if (time > blink.next && blink.t < 0) blink.t = 0;
  let bl = 1;
  if (blink.t >= 0) { blink.t += dt; const k = blink.t / 0.16; bl = k < 1 ? 1 - 0.92 * Math.sin(Math.PI * k) : 1; if (k >= 1) { blink.t = -1; blink.next = time + 2.2 + Math.random() * 2.8; } }
  M.eyes.scale.set(1, bl, 1);
  { const k = clamp(((P.draw || 0) - 0.2) / 0.4, 0, 1), s1 = k * k * (3 - 2 * k);
    M.sword.scale.set(Math.min(1, s1 * 3 + 1e-3), Math.max(1e-3, s1), Math.min(1, s1 * 3 + 1e-3));
    M.hiltK.scale.setScalar(Math.max(1e-3, 1 - s1)); }
  // bras (espace du torse)
  solveLimb(M.uarmL, M.farmL, M.uarmL.position, _v.fromArray(P.handL).clone(), 0.21, 0.225, new THREE.Vector3(...P.poleL).normalize());
  solveLimb(M.uarmR, M.farmR, M.uarmR.position, _v.fromArray(P.handR).clone(), 0.21, 0.225, new THREE.Vector3(...P.poleR).normalize());
  // jambes : cibles dans le monde, pieds à plat
  M.hips.updateMatrix();
  const inv = M.hips.matrix.clone().invert();
  const hq = M.hips.quaternion.clone(), hqi = hq.clone().invert();
  for (const sd of ['L', 'R']) {
    const Tt = new THREE.Vector3(...P['foot' + sd]).applyMatrix4(inv);
    const pole = new THREE.Vector3(sd === 'L' ? 0.12 : -0.12, 0, 1).applyQuaternion(hqi).normalize();
    solveLimb(M['thigh' + sd], M['shin' + sd], M['thigh' + sd].position, Tt, 0.25, 0.25, pole);
    qa.copy(hq).multiply(M['thigh' + sd].quaternion).multiply(M['shin' + sd].quaternion).invert();
    qb.setFromEuler(eu.set(P['toe' + sd], P.hipR[1] * 0.5 + P['yaw' + sd], 0));
    M['foot' + sd].quaternion.copy(qa.multiply(qb));
  }
  // tresses : pendule physique, poussé par l'accélération de la tête
  M.hips.updateMatrixWorld(true);
  const hp = new THREE.Vector3().setFromMatrixPosition(M.braids.matrixWorld);
  if (braid.lastP && dt > 0) {
    const v = hp.clone().sub(braid.lastP).divideScalar(dt);
    const a = v.clone().sub(braid.lastV).divideScalar(dt);
    braid.acc.lerp(a, 0.5);
    braid.lastV.copy(v);
  }
  braid.lastP = hp;
  const steps = 4, h = dt / steps, L = 0.22, g = 9.8;
  for (let k = 0; k < steps; k++) {
    const Gy = -g - braid.acc.y, Gz = -braid.acc.z, Gx = -braid.acc.x;
    let ax = (Gy * Math.sin(braid.x) - Gz * Math.cos(braid.x)) / L;
    ax += -14 * (braid.x - P.braR[0]) - 5 * braid.vx;
    braid.vx += ax * h; braid.x += braid.vx * h;
    let az = (Gy * Math.sin(braid.z) + Gx * Math.cos(braid.z)) / L;
    az += -14 * braid.z - 5 * braid.vz;
    braid.vz += az * h; braid.z += braid.vz * h;
  }
  braid.x = clamp(braid.x, -0.4, 1.3); braid.z = clamp(braid.z, -0.6, 0.6);
  M.braids.rotation.set(braid.x - P.headR[0] * 0.6, 0, braid.z);
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
