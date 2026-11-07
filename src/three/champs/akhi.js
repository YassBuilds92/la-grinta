// Généré par tools/build_champs.py depuis styles-perso/akhi-pixel.html : ne pas modifier à la main.
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';

export function create() {
const PAL = {
  skin: '#c98a5c', beard: '#3a2a22', keff: '#f1ece1', keffR: '#c62828', agal: '#151515', qamis: '#f2efe8',
  vest: '#5e7a3a', pants: '#6d6253', shoe: '#f3f1ee', sole: '#2e9d48', eyeW: '#fbf5ec', pupil: '#1a0e09',
  lips: '#7a3b2b', beads: '#2e9d48', white: '#ffffff',
};
const METAL = {};
const RING = [0.18, 0.62, 0.28];

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

// keffieh : calotte, tour du visage ouvert devant, retombée sur les épaules
const KS = [0.3, 0.29, 0.285];
const kCrown = () => new THREE.SphereGeometry(1, 36, 12, 0, Math.PI * 2, 0, Math.PI * 0.4).scale(...KS).translate(0, 0.27, -0.005);
const kSide = () => new THREE.SphereGeometry(1, 36, 10, Math.PI / 2 + 0.8, Math.PI * 2 - 1.6, Math.PI * 0.4, Math.PI * 0.3).scale(...KS).translate(0, 0.27, -0.005);
const kDrape = () => new THREE.CylinderGeometry(0.25, 0.33, 0.25, 36, 1, true, 0.85, Math.PI * 2 - 1.7).translate(0, -0.025, -0.005);
const skirt = () => new THREE.CylinderGeometry(0.2, 0.235, 0.18, 28, 1, true).translate(0, -0.04, 0);
// le bas du qamis suit chaque cuisse : le genou reste toujours dessous
const robeLeg = () => new THREE.CylinderGeometry(0.14, 0.165, 0.4, 22, 1, true).translate(0, -0.19, 0);

const PARTS = [
  { n: 'hips', p: null, o: [0, 0.602, 0], prims: [B([0, 0, 0], [0.17, 0.1, 0.125], 0.07, 'qamis'), G(skirt, 'qamis', { ds: 1 })] },
  { n: 'torso', p: 'hips', o: [0, 0.05, 0], prims: [
    B([0, 0.2, 0], [0.19, 0.21, 0.135], 0.11, 'vest'),
    B([0, 0.2, 0.118], [0.06, 0.205, 0.03], 0.02, 'qamis'),
    C([0, 0.37, 0], [0, 0.47, 0], 0.066, 'skin'),
    T([0, 0.4, 0], 0.07, 0.02, 'qamis'),
    ...mir([B([0.105, 0.32, 0.157], [0.058, 0.1, 0.016], 0.012, 'keff', { rot: [-0.08, 0, 0] })]),
  ] },
  { n: 'head', p: 'torso', o: [0, 0.45, 0], prims: [
    E([0, 0.27, 0], [0.27, 0.26, 0.25], 'skin'),
    S([0, 0.195, 0.235], 0.032, 'skin'),
    Hm([0, 0.19, 0.005], [0.272, 0.2, 0.256], 'beard', { rot: [Math.PI, 0, 0] }),
    C([-0.05, 0.152, 0.255], [0.05, 0.152, 0.255], 0.016, 'beard'),
    C([-0.038, 0.118, 0.246], [0.038, 0.118, 0.246], 0.012, 'lips'),
    ...mir([C([0.145, 0.33, 0.206], [0.05, 0.34, 0.236], 0.02, 'beard')]),
    G(kCrown, 'keff', { ds: 1 }), G(kSide, 'keff', { ds: 1 }), G(kDrape, 'keff', { ds: 1 }),
    T([0, 0.47, -0.01], 0.214, 0.019, 'agal', { rot: [-0.12, 0, 0] }),
    T([0, 0.505, -0.016], 0.182, 0.019, 'agal', { rot: [-0.12, 0, 0] }),
  ] },
  { n: 'eyes', p: 'head', o: [0, 0.255, 0.2], prims: mir([
    E([0.095, 0, 0.012], [0.055, 0.062, 0.036], 'eyeW'),
    S([0.09, -0.005, 0.04], 0.031, 'pupil'),
  ]) },
  // le pan arrière du keffieh (articulé, il balance)
  { n: 'braids', p: 'head', o: [0, 0.33, -0.12], prims: [B([0, -0.42, -0.2], [0.16, 0.16, 0.014], 0.012, 'keff', { rot: [0.12, 0, 0] })] },
  ...['L', 'R'].flatMap((sd) => {
    const x = sd === 'L' ? 1 : -1;
    const fprims = [
      C([0, 0, 0], [0, -0.15, 0], 0.064, 'qamis'),
      S([0, -0.225, 0.005], 0.064, 'skin'),
      S([-x * 0.035, -0.2, 0.045], 0.029, 'skin'),
    ];
    if (sd === 'L') fprims.push(
      T([0, -0.31, 0.02], 0.05, 0.013, 'beads', { rot: [Math.PI / 2, 0, 0] }),
      S([0, -0.375, 0.02], 0.02, 'beads'),
    );
    return [
      { n: 'uarm' + sd, p: 'torso', o: [x * 0.245, 0.34, 0], prims: [C([0, 0, 0], [0, -0.2, 0], 0.072, 'qamis')] },
      { n: 'farm' + sd, p: 'uarm' + sd, o: [0, -0.21, 0], prims: fprims },
      { n: 'thigh' + sd, p: 'hips', o: [x * 0.095, -0.02, 0], prims: [C([0, 0, 0], [0, -0.25, 0], 0.08, 'pants'), G(robeLeg, 'qamis', { ds: 1, c: [x * 0.02, 0, 0] })] },
      { n: 'shin' + sd, p: 'thigh' + sd, o: [0, -0.25, 0], prims: [C([0, 0, 0], [0, -0.2, 0], 0.074, 'pants')] },
      { n: 'foot' + sd, p: 'shin' + sd, o: [0, -0.25, 0], prims: [
        B([0, -0.03, 0.045], [0.075, 0.042, 0.125], 0.04, 'shoe'),
        B([0, -0.07, 0.045], [0.082, 0.012, 0.132], 0.01, 'sole'),
        B([0, -0.01, -0.08], [0.03, 0.035, 0.012], 0.01, 'sole'),
      ] },
    ];
  }),
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
    const b = t / BEAT, p = b % 1, i = Math.floor(b);
    const d = (1 + Math.cos(2 * Math.PI * p)) / 2;
    const dh = (1 + Math.cos(2 * Math.PI * (p - 0.12))) / 2;
    const sw = Math.sin(Math.PI * b), s4 = Math.sin((Math.PI * b) / 2);
    const tap = i % 2 === 1 ? Math.pow(Math.sin(Math.PI * p), 2) : 0;
    const chop = Math.pow(1 - d, 1.5);
    return {
      hipP: [0.012 * sw, 0.602 - 0.018 * d, 0], hipR: [0, 0.16 * s4, 0.035 * sw],
      torR: [0.05 + 0.07 * d, -0.1 * s4, -0.03 * sw], headR: [-0.03 + 0.08 * dh, 0.18 * s4, 0.03 * sw],
      braR: [0.1, 0, 0],
      handR: [-0.28 - 0.01 * sw, -0.07 + 0.015 * d, 0.03 + 0.03 * s4], poleR: [-0.5, -0.3, -1],
      handL: [0.13, 0.13 + 0.03 * chop, 0.26], poleL: [1, -0.8, -0.2],
      footL: [0.115, 0.082, 0.03], footR: [-0.125, 0.082 + 0.035 * tap, 0.06],
      toeL: 0, toeR: -0.3 * tap, yawL: 0.15, yawR: -0.2, blinkBias: 0,
    };
  },
  walk(t) {
    const ph = (2 * Math.PI * t) / 0.9, s = Math.sin(ph), c = Math.cos(ph);
    return {
      hipP: [0.02 * s, 0.56 + 0.018 * -Math.cos(2 * ph), 0], hipR: [0.05, 0.16 * c, 0.04 * s],
      torR: [0.1, -0.22 * c, -0.04 * s], headR: [0.02 + 0.03 * Math.cos(2 * ph), 0.08 * c, 0.02 * s],
      braR: [0.22, 0, 0],
      handR: [-0.28, -0.06 + 0.03 * Math.abs(c), -0.17 * c], poleR: [-0.6, -1, -0.8],
      handL: [0.2, 0.08, 0.2 + 0.04 * c], poleL: [1, -1, -0.3],
      footL: [0.1, 0.082 + 0.08 * pos(s), -0.17 * c], footR: [-0.1, 0.082 + 0.08 * pos(-s), 0.17 * c],
      toeL: 0.4 * pos(s) * c, toeR: -0.4 * pos(-s) * c, yawL: 0.08, yawR: -0.08, blinkBias: 0,
    };
  },
  win(t) {
    const p = (t / 1.15) % 1;
    let y, air = 0;
    if (p < 0.45) { const s = p / 0.45; y = 0.3 * 4 * s * (1 - s); air = Math.sin(Math.PI * s); }
    else { const q = (p - 0.45) / 0.55; y = -0.1 * Math.sin(Math.PI * q); }
    const crouch = y < 0 ? -y / 0.1 : 0;
    const hy = 0.602 + y, fy = Math.max(0.082, hy - 0.02 - 0.47);
    return {
      hipP: [0, hy, 0], hipR: [0, 0, 0],
      torR: [0.22 * crouch - 0.12 * air, 0, 0], headR: [-0.28 * air + 0.12 * crouch, 0, 0],
      braR: [0.1, 0, 0],
      handR: [-0.47, 0.68 + 0.05 * air, 0.12], poleR: [-1, -0.3, -0.5],
      handL: [0.47, 0.6 + 0.14 * air - 0.12 * crouch, 0.16], poleL: [1, -0.3, -0.5],
      footL: [0.12, fy, 0.02 + 0.05 * air], footR: [-0.12, fy, 0.02 + 0.05 * air],
      toeL: 0.45 * air, toeR: 0.45 * air, yawL: 0.15, yawR: -0.15, blinkBias: 0,
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
