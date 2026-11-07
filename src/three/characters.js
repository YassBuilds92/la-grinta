import * as THREE from 'three';

// Les champions de yaskow (L'Akhi, Le Cheikh, Le Rōnin, Le Fauve), générés depuis leurs pages d'aperçu validées
// par tools/build_champs.py : squelette, IK et anims (attente / marche / victoire) identiques à l'aperçu.

const mats = new Map();
function mat(color, opts = {}) {
  const key = color + JSON.stringify(opts);
  if (!mats.has(key)) mats.set(key, new THREE.MeshStandardMaterial({ color, roughness: 0.55, metalness: 0, ...opts }));
  return mats.get(key);
}

function mesh(geo, material, x = 0, y = 0, z = 0) {
  const m = new THREE.Mesh(geo, material);
  m.position.set(x, y, z);
  m.castShadow = true;
  m.receiveShadow = true;
  return m;
}
import { create as akhi } from './champs/akhi.js';
import { create as cheikh } from './champs/cheikh.js';
import { create as ronin } from './champs/ronin.js';
import { create as fauve } from './champs/fauve.js';

const CHAMPS = { akhi, cheikh, ronin, fauve };
const SCALE = 0.64; // taille sur le plateau (≈ 1,1 unité de haut debout)

// Motif tissé du keffieh (et du haori du rōnin) : quadrillage diagonal deux tons.
function weave(base, line) {
  const c = document.createElement('canvas');
  c.width = c.height = 32;
  const x = c.getContext('2d');
  x.fillStyle = base;
  x.fillRect(0, 0, 32, 32);
  x.fillStyle = line;
  for (let i = 0; i < 32; i += 16) {
    x.fillRect(i, 0, 5, 32);
    x.fillRect(0, i, 32, 5);
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(2, 2);
  t.anisotropy = 4;
  return t;
}

// mode du jeu → anim du champion
const MODE = { idle: 'chill', walk: 'walk', jump: 'win', cheer: 'win', sad: 'chill' };

export function animateRig(rig, t, dt, mode = 'idle') {
  const c = rig.champ;
  const want = MODE[mode] || 'chill';
  if (want !== rig.cur) {
    rig.prev = rig.cur;
    rig.cur = want;
    rig.w = 0;
  }
  rig.time += dt;
  rig.w = Math.min(1, rig.w + dt / 0.35);
  const w = rig.w * rig.w * (3 - 2 * rig.w);
  const T = rig.time + rig.phase;
  const pose = w >= 1 ? c.ANIMS[rig.cur](T) : c.blendPose(c.ANIMS[rig.prev](T), c.ANIMS[rig.cur](T), w);
  c.applyPose(pose, Math.max(dt, 1e-4), T);
  c.copyPose(rig.joints);
}

export function buildCharacter(id, color) {
  const make = CHAMPS[id] || CHAMPS.akhi;
  const c = make();
  const mats = {};
  const matFor = (k, ds) => {
    const key = k + (ds ? 'D' : '');
    if (!mats[key]) {
      const col = c.PAL[k] || '#cccccc';
      mats[key] =
        k === 'keff' && c.PAL.keffR
          ? new THREE.MeshStandardMaterial({ map: weave(col, c.PAL.keffR), roughness: 0.85, side: ds ? THREE.DoubleSide : THREE.FrontSide })
          : new THREE.MeshStandardMaterial({ color: col, roughness: 0.7, metalness: 0, side: THREE.DoubleSide });
    }
    return mats[key];
  };
  const built = c.buildMeshRig((pr, g) => {
    const m = new THREE.Mesh(g, matFor(pr.m, pr.ds));
    m.castShadow = true;
    return [m];
  });
  const body = new THREE.Group();
  body.scale.setScalar(SCALE);
  body.add(built.root);
  const root = new THREE.Group();
  root.add(body);
  const ring = new THREE.Mesh(new THREE.RingGeometry(0.2, 0.25, 48), new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: 0.9, transparent: true, opacity: 0.9, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2 }));
  ring.rotation.x = -Math.PI / 2;
  ring.position.y = 0.004;
  ring.renderOrder = 1;
  root.add(ring);
  const rig = { root, champ: c, joints: built.joints, ring, cur: 'chill', prev: 'chill', w: 1, time: 0, phase: Math.random() * 20 };
  root.userData.rig = rig;
  root.userData.charId = id;
  animateRig(rig, 0, 1 / 60, 'idle');
  return root;
}

// ---- Maisons / hôtels ----
export function buildHouse() {
  const g = new THREE.Group();
  g.add(mesh(new THREE.BoxGeometry(0.16, 0.12, 0.16), mat('#2ecc71'), 0, 0.06, 0));
  const roof = mesh(new THREE.ConeGeometry(0.135, 0.1, 4), mat('#1e8449'), 0, 0.17, 0);
  roof.rotation.y = Math.PI / 4;
  g.add(roof);
  g.add(mesh(new THREE.BoxGeometry(0.04, 0.06, 0.01), mat('#5d4037'), 0, 0.03, 0.081));
  return g;
}
export function buildHotel() {
  const g = new THREE.Group();
  g.add(mesh(new THREE.BoxGeometry(0.42, 0.26, 0.2), mat('#e74c3c'), 0, 0.13, 0));
  g.add(mesh(new THREE.BoxGeometry(0.44, 0.03, 0.22), mat('#922b21'), 0, 0.275, 0));
  const win = mat('#fff59d', { emissive: '#ffeb3b', emissiveIntensity: 0.6 });
  for (let r = 0; r < 2; r++) for (let c = 0; c < 4; c++) g.add(mesh(new THREE.BoxGeometry(0.05, 0.05, 0.01), win, -0.15 + c * 0.1, 0.08 + r * 0.1, 0.101));
  g.add(mesh(new THREE.BoxGeometry(0.16, 0.05, 0.02), mat('#ffcc33', { emissive: '#ffb300', emissiveIntensity: 0.5 }), 0, 0.33, 0));
  return g;
}

// ---- Dés ----
function pipTexture(n) {
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const x = c.getContext('2d');
  x.fillStyle = '#fdfdfd';
  x.fillRect(0, 0, 128, 128);
  x.fillStyle = n === 1 ? '#e53935' : '#1a1a2e';
  const P = { 1: [[64, 64]], 2: [[34, 34], [94, 94]], 3: [[30, 30], [64, 64], [98, 98]], 4: [[34, 34], [94, 34], [34, 94], [94, 94]], 5: [[30, 30], [98, 30], [64, 64], [30, 98], [98, 98]], 6: [[34, 28], [94, 28], [34, 64], [94, 64], [34, 100], [94, 100]] };
  for (const [px, py] of P[n]) {
    x.beginPath();
    x.arc(px, py, n === 1 ? 18 : 12, 0, Math.PI * 2);
    x.fill();
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}
// Ordre des faces BoxGeometry : +x, -x, +y, -y, +z, -z
export const DIE_FACES = [3, 4, 1, 6, 2, 5];
export function buildDie() {
  const geo = new THREE.BoxGeometry(0.5, 0.5, 0.5, 4, 4, 4);
  // arrondir les coins
  const p = geo.attributes.position;
  const v = new THREE.Vector3();
  for (let i = 0; i < p.count; i++) {
    v.fromBufferAttribute(p, i);
    const inner = v.clone().clampScalar(-0.17, 0.17);
    const d = v.clone().sub(inner);
    if (d.length() > 0) d.setLength(0.08);
    p.setXYZ(i, inner.x + d.x, inner.y + d.y, inner.z + d.z);
  }
  geo.computeVertexNormals();
  const materials = DIE_FACES.map((n) => new THREE.MeshStandardMaterial({ map: pipTexture(n), roughness: 0.25 }));
  const inner = new THREE.Mesh(geo, materials);
  inner.castShadow = true;
  const outer = new THREE.Group();
  outer.add(inner);
  outer.userData.inner = inner;
  return outer;
}
export function dieRotationFor(v) {
  return { 1: [0, 0, 0], 6: [Math.PI, 0, 0], 2: [-Math.PI / 2, 0, 0], 5: [Math.PI / 2, 0, 0], 3: [0, 0, Math.PI / 2], 4: [0, 0, -Math.PI / 2] }[v];
}
