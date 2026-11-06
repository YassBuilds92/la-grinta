import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';

// Persos chibi articulés (hanches, torse, tête, épaules, coudes, jambes) animés en procédural.
// Tout est construit en code : aucun modèle externe.

const mats = new Map();
function mat(color, opts = {}) {
  const key = color + JSON.stringify(opts);
  if (!mats.has(key)) mats.set(key, new THREE.MeshStandardMaterial({ color, roughness: 0.55, metalness: 0, ...opts }));
  return mats.get(key);
}
const gold = () => mat('#ffc83d', { metalness: 0.95, roughness: 0.22 });
const geoCache = new Map();
const G = (key, make) => {
  if (!geoCache.has(key)) geoCache.set(key, make());
  return geoCache.get(key);
};
const capsule = (r, l) => G(`cap${r}_${l}`, () => new THREE.CapsuleGeometry(r, l, 8, 16));
const sphere = (r, w = 24, h = 16) => G(`sph${r}_${w}`, () => new THREE.SphereGeometry(r, w, h));
const rbox = (x, y, z, r = 0.02) => G(`rb${x}_${y}_${z}_${r}`, () => new RoundedBoxGeometry(x, y, z, 3, r));

function mesh(geo, material, x = 0, y = 0, z = 0) {
  const m = new THREE.Mesh(geo, material);
  m.position.set(x, y, z);
  m.castShadow = true;
  m.receiveShadow = true;
  return m;
}
function lathe(points, segs = 32) {
  return new THREE.LatheGeometry(points.map(([x, y]) => new THREE.Vector2(x, y)), segs);
}

/* ---------------- Squelette ---------------- */
function makeRig(o) {
  const {
    skin = '#e0ac69',
    top = '#333',
    pants = '#2b2b38',
    shoes = '#f5f5f5',
    sole = '#ffffff',
    torsoProfile = [[0, 0], [0.14, 0.0], [0.165, 0.07], [0.172, 0.15], [0.16, 0.23], [0.13, 0.29], [0.07, 0.33], [0, 0.34]],
    sleeves = top,
    headR = 0.21,
    hideLegs = false,
  } = o;
  const root = new THREE.Group();
  const hips = new THREE.Group();
  hips.position.y = 0.3;
  root.add(hips);

  const legs = [-1, 1].map((sx) => {
    const pivot = new THREE.Group();
    pivot.position.set(sx * 0.075, 0, 0);
    hips.add(pivot);
    if (!hideLegs) {
      pivot.add(mesh(capsule(0.056, 0.13), mat(pants), 0, -0.11, 0));
      const shoe = mesh(capsule(0.055, 0.07), mat(shoes, { roughness: 0.35 }), 0, -0.25, 0.035);
      shoe.rotation.x = Math.PI / 2;
      shoe.scale.set(1.05, 1, 0.85);
      pivot.add(shoe);
      pivot.add(mesh(rbox(0.11, 0.028, 0.2, 0.012), mat(sole), 0, -0.284, 0.035));
    }
    return pivot;
  });

  const torso = new THREE.Group();
  hips.add(torso);
  torso.add(mesh(lathe(torsoProfile), mat(top)));
  if (!hideLegs) torso.add(mesh(sphere(0.135), mat(pants), 0, 0.01, 0));

  const arms = [-1, 1].map((sx) => {
    const shoulder = new THREE.Group();
    shoulder.position.set(sx * 0.165, 0.255, 0);
    torso.add(shoulder);
    shoulder.add(mesh(sphere(0.055), mat(sleeves)));
    shoulder.add(mesh(capsule(0.048, 0.08), mat(sleeves), 0, -0.07, 0));
    const elbow = new THREE.Group();
    elbow.position.y = -0.14;
    shoulder.add(elbow);
    elbow.add(mesh(capsule(0.043, 0.06), mat(o.forearm || sleeves), 0, -0.055, 0));
    const hand = new THREE.Group();
    hand.position.y = -0.125;
    elbow.add(hand);
    hand.add(mesh(sphere(0.052), mat(o.gloves || skin)));
    hand.add(mesh(sphere(0.022), mat(o.gloves || skin), 0, 0.01, 0.045));
    return { shoulder, elbow, hand, sx };
  });

  const head = new THREE.Group();
  head.position.y = 0.33;
  torso.add(head);
  head.add(mesh(capsule(0.05, 0.03), mat(skin), 0, 0.02, 0));
  const skull = new THREE.Group();
  skull.position.y = headR * 0.95;
  head.add(skull);

  return { root, hips, torso, head, skull, arms, legs, headR, eyes: null, blinkAt: 1 + Math.random() * 3, mouth: null, props: {} };
}

function face(rig, { skin, eyes = true, mouth = true, brows = '#2b1d14', ears = true, cheeks = true, lashes = false } = {}) {
  const r = rig.headR;
  const s = rig.skull;
  const ball = mesh(sphere(r, 40, 28), mat(skin, { roughness: 0.6 }));
  ball.scale.set(1.04, 0.96, 1);
  s.add(ball);
  if (eyes) {
    const eg = new THREE.Group();
    s.add(eg);
    for (const sx of [-1, 1]) {
      const w = mesh(sphere(r * 0.2, 20, 14), mat('#ffffff', { roughness: 0.15 }), sx * r * 0.36, r * 0.06, r * 0.8);
      w.scale.set(0.95, 1.1, 0.5);
      eg.add(w);
      eg.add(mesh(sphere(r * 0.13, 16, 12), mat('#20152b', { roughness: 0.1 }), sx * r * 0.36, r * 0.04, r * 0.88));
      eg.add(mesh(sphere(r * 0.045, 8, 6), mat('#ffffff', { emissive: '#ffffff', emissiveIntensity: 0.4 }), sx * r * 0.36 + r * 0.05, r * 0.1, r * 0.97));
      if (lashes) {
        const l = mesh(capsule(r * 0.025, r * 0.12), mat('#111'), sx * r * 0.52, r * 0.2, r * 0.78);
        l.rotation.z = sx * 1.1;
        eg.add(l);
      }
    }
    rig.eyes = eg;
    if (brows) {
      const bg = new THREE.Group();
      s.add(bg);
      for (const sx of [-1, 1]) {
        const b = mesh(capsule(r * 0.035, r * 0.16), mat(brows), sx * r * 0.36, r * 0.36, r * 0.85);
        b.rotation.z = Math.PI / 2 + sx * 0.12;
        bg.add(b);
      }
      rig.brows = bg;
    }
  }
  if (mouth) {
    const m = new THREE.Group();
    m.position.set(0, -r * 0.3, r * 0.9);
    const smile = mesh(new THREE.TorusGeometry(r * 0.14, r * 0.032, 8, 18, Math.PI), mat('#5d1f1f'));
    smile.rotation.z = Math.PI;
    m.add(smile);
    s.add(m);
    rig.mouth = m;
  }
  if (cheeks) {
    const cm = mat('#ff7f7f', { transparent: true, opacity: 0.45, depthWrite: false });
    for (const sx of [-1, 1]) {
      const c = mesh(sphere(r * 0.12, 12, 8), cm, sx * r * 0.62, -r * 0.18, r * 0.74);
      c.castShadow = false;
      c.scale.z = 0.4;
      s.add(c);
    }
  }
  if (ears) for (const sx of [-1, 1]) s.add(mesh(sphere(r * 0.2, 12, 10), mat(skin), sx * r * 1.0, 0, 0));
  return ball;
}

function hair(rig, color, { top = 0.36, back = 0.68, scale = 1.07, rough = 0.75 } = {}) {
  const m = mat(color, { roughness: rough });
  const R = rig.headR * scale;
  const cap = mesh(new THREE.SphereGeometry(R, 36, 18, 0, Math.PI * 2, 0, Math.PI * top), m);
  const shell = mesh(new THREE.SphereGeometry(R, 36, 18, Math.PI, Math.PI, 0, Math.PI * back), m);
  cap.scale.set(1.04, 0.96, 1);
  shell.scale.set(1.04, 0.96, 1);
  rig.skull.add(cap, shell);
  return m;
}

function chain(parent, y, z = 0.12) {
  const c = mesh(new THREE.TorusGeometry(0.1, 0.014, 8, 32), gold(), 0, y, z * 0.3);
  c.rotation.x = Math.PI / 2.6;
  const pend = mesh(new THREE.CylinderGeometry(0.035, 0.035, 0.014, 20), gold(), 0, y - 0.08, z + 0.03);
  pend.rotation.x = Math.PI / 2.3;
  parent.add(c, pend);
}

// Blason Grinta (rond orange) sur les maillots
export function grintaBadge(parent, y, z, s = 1) {
  const g = new THREE.Group();
  g.add(mesh(new THREE.CircleGeometry(0.06 * s, 32), mat('#ff7a1a', { roughness: 0.4, emissive: '#ff5a00', emissiveIntensity: 0.15 })));
  g.add(mesh(new THREE.RingGeometry(0.044 * s, 0.05 * s, 32), mat('#1a1a1a'), 0, 0, 0.002));
  g.add(mesh(new THREE.PlaneGeometry(0.014 * s, 0.05 * s), mat('#1a1a1a'), 0, -0.004 * s, 0.003));
  g.add(mesh(new THREE.PlaneGeometry(0.04 * s, 0.012 * s), mat('#1a1a1a'), 0, 0.016 * s, 0.003));
  g.position.set(0, y, z);
  parent.add(g);
  return g;
}

/* ---------------- Les 8 persos ---------------- */
const BUILDERS = {
  boss(color) {
    const skin = '#c68642';
    const rig = makeRig({ skin, top: '#1b1b26', pants: '#1b1b26', shoes: '#141414', sole: '#3a2a1a', torsoProfile: [[0, 0], [0.15, 0], [0.175, 0.07], [0.185, 0.15], [0.175, 0.23], [0.14, 0.29], [0.07, 0.33], [0, 0.34]] });
    const shirt = mesh(new THREE.ConeGeometry(0.07, 0.16, 3), mat('#fafafa'), 0, 0.25, 0.135);
    shirt.rotation.x = Math.PI;
    shirt.rotation.y = Math.PI;
    shirt.scale.z = 0.3;
    rig.torso.add(shirt);
    const tie = mesh(new THREE.ConeGeometry(0.032, 0.15, 4), mat(color, { roughness: 0.3 }), 0, 0.2, 0.172);
    tie.rotation.x = Math.PI;
    tie.scale.z = 0.4;
    rig.torso.add(tie);
    for (const sx of [-1, 1]) {
      const lap = mesh(rbox(0.04, 0.16, 0.02, 0.008), mat('#2a2a3a'), sx * 0.06, 0.23, 0.152);
      lap.rotation.z = sx * 0.35;
      rig.torso.add(lap);
    }
    face(rig, { skin });
    hair(rig, '#111', { top: 0.3, back: 0.6 });
    const beard = mesh(new THREE.SphereGeometry(rig.headR * 1.01, 32, 16, 0, Math.PI * 2, Math.PI * 0.62, Math.PI * 0.3), mat('#1a1a1a', { roughness: 0.9 }));
    beard.scale.set(1.04, 0.96, 1.02);
    rig.skull.add(beard);
    const glass = mat('#0b0b12', { metalness: 0.7, roughness: 0.06 });
    for (const sx of [-1, 1]) rig.skull.add(mesh(rbox(0.12, 0.07, 0.03, 0.02), glass, sx * 0.075, 0.03, rig.headR * 0.93));
    rig.skull.add(mesh(rbox(0.05, 0.014, 0.02, 0.005), gold(), 0, 0.05, rig.headR * 0.97));
    rig.eyes.visible = false;
    rig.brows.visible = false;
    chain(rig.torso, 0.29, 0.14);
    const watch = mesh(new THREE.TorusGeometry(0.045, 0.012, 8, 20), gold(), 0, -0.1, 0);
    watch.rotation.x = Math.PI / 2;
    rig.arms[1].elbow.add(watch);
    rig.style = 'boss';
    return rig;
  },

  rap(color) {
    const skin = '#8d5524';
    const rig = makeRig({ skin, top: color, pants: '#2d2d3a', shoes: '#fafafa', sole: color });
    rig.torso.add(mesh(rbox(0.18, 0.08, 0.03, 0.015), mat(new THREE.Color(color).multiplyScalar(0.75).getStyle()), 0, 0.08, 0.158));
    const hood = mesh(new THREE.TorusGeometry(0.13, 0.045, 12, 28), mat(color), 0, 0.33, -0.03);
    hood.rotation.x = Math.PI / 2.2;
    rig.torso.add(hood);
    for (const sx of [-1, 1]) rig.torso.add(mesh(capsule(0.008, 0.08), mat('#fff'), sx * 0.04, 0.24, 0.162));
    face(rig, { skin, lashes: true, brows: '#1a1a1a' });
    hair(rig, '#141414', { top: 0.4, back: 0.75 });
    rig.skull.add(mesh(new THREE.SphereGeometry(rig.headR * 1.1, 32, 14, 0, Math.PI * 2, 0, Math.PI * 0.45), mat('#111', { roughness: 0.5 }), 0, 0.012, 0));
    const brim = mesh(new THREE.CylinderGeometry(0.12, 0.12, 0.018, 24, 1, false, 0, Math.PI), mat('#111'), 0, 0.06, -rig.headR * 0.95);
    brim.rotation.y = Math.PI / 2;
    brim.rotation.z = 0.15;
    brim.scale.set(1, 1, 1.3);
    rig.skull.add(brim);
    for (const sx of [-1, 1]) {
      const br = mesh(capsule(0.024, 0.16), mat('#141414'), sx * rig.headR * 0.85, -0.1, -0.06);
      br.rotation.z = sx * 0.15;
      rig.skull.add(br);
      rig.skull.add(mesh(sphere(0.022), gold(), sx * rig.headR * 0.88, -0.22, -0.07));
      const e = mesh(new THREE.TorusGeometry(0.032, 0.008, 8, 20), gold(), sx * rig.headR * 1.04, -0.06, 0.02);
      e.rotation.y = Math.PI / 2;
      rig.skull.add(e);
    }
    chain(rig.torso, 0.3, 0.14);
    const mic = new THREE.Group();
    mic.add(mesh(new THREE.CylinderGeometry(0.018, 0.024, 0.14, 12), mat('#151515', { roughness: 0.3 })));
    mic.add(mesh(sphere(0.042), mat('#c0c0c0', { metalness: 0.9, roughness: 0.35 }), 0, 0.09, 0));
    mic.position.set(0, 0.01, 0.03);
    mic.rotation.x = 0.2;
    rig.arms[1].hand.add(mic);
    rig.style = 'rap';
    return rig;
  },

  chef(color) {
    const skin = '#f1c27d';
    const rig = makeRig({ skin, top: '#fafafa', pants: '#3b3b48', shoes: '#222', sole: '#222', torsoProfile: [[0, 0], [0.16, 0], [0.19, 0.07], [0.195, 0.15], [0.175, 0.23], [0.14, 0.29], [0.07, 0.33], [0, 0.34]] });
    for (let i = 0; i < 3; i++) for (const sx of [-1, 1]) rig.torso.add(mesh(sphere(0.014), mat(color), sx * 0.05, 0.24 - i * 0.06, 0.177 - i * 0.004));
    rig.torso.add(mesh(rbox(0.24, 0.16, 0.02, 0.01), mat(color), 0, 0.03, 0.172));
    const scarf = mesh(new THREE.TorusGeometry(0.1, 0.03, 10, 24), mat('#e53935'), 0, 0.32, 0.01);
    scarf.rotation.x = Math.PI / 2;
    rig.torso.add(scarf);
    face(rig, { skin });
    hair(rig, '#6d4c41', { top: 0.2, back: 0.55 });
    const hat = new THREE.Group();
    hat.add(mesh(new THREE.CylinderGeometry(rig.headR * 0.95, rig.headR * 0.9, 0.12, 32), mat('#ffffff', { roughness: 0.8 })));
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2;
      hat.add(mesh(sphere(0.075), mat('#ffffff', { roughness: 0.85 }), Math.cos(a) * 0.09, 0.11, Math.sin(a) * 0.09));
    }
    hat.add(mesh(sphere(0.1), mat('#ffffff', { roughness: 0.85 }), 0, 0.15, 0));
    hat.position.y = rig.headR * 0.85;
    rig.skull.add(hat);
    for (const sx of [-1, 1]) {
      const m = mesh(capsule(0.022, 0.07), mat('#4e342e'), sx * 0.045, -0.035, rig.headR * 0.95);
      m.rotation.z = Math.PI / 2 - sx * 0.35;
      rig.skull.add(m);
      rig.skull.add(mesh(sphere(0.02), mat('#4e342e'), sx * 0.09, -0.01, rig.headR * 0.88));
    }
    const pan = new THREE.Group();
    pan.add(mesh(new THREE.CylinderGeometry(0.11, 0.09, 0.03, 28), mat('#2b2b2b', { metalness: 0.6, roughness: 0.35 }), 0, 0, 0.14));
    const handle = mesh(new THREE.CylinderGeometry(0.014, 0.014, 0.13, 10), mat('#5d4037'), 0, 0, 0.03);
    handle.rotation.x = Math.PI / 2;
    pan.add(handle);
    pan.rotation.x = -Math.PI / 2;
    rig.arms[1].hand.add(pan);
    const crepe = mesh(new THREE.CylinderGeometry(0.075, 0.075, 0.015, 24), mat('#f6c26b', { roughness: 0.8 }));
    rig.root.add(crepe);
    rig.props.pan = pan;
    rig.props.crepe = crepe;
    rig.style = 'chef';
    return rig;
  },

  astro(color) {
    const skin = '#ffe0bd';
    const rig = makeRig({ skin, top: '#eceff1', pants: '#eceff1', shoes: '#b0bec5', sole: '#78909c', gloves: '#cfd8dc', torsoProfile: [[0, 0], [0.16, 0], [0.19, 0.08], [0.195, 0.16], [0.18, 0.24], [0.14, 0.3], [0.07, 0.335], [0, 0.34]] });
    rig.torso.add(mesh(rbox(0.13, 0.09, 0.03, 0.012), mat(color), 0, 0.17, 0.185));
    rig.torso.add(mesh(sphere(0.016), mat('#ff5252', { emissive: '#ff1744', emissiveIntensity: 1.5 }), 0.035, 0.18, 0.205));
    rig.torso.add(mesh(sphere(0.016), mat('#69f0ae', { emissive: '#00e676', emissiveIntensity: 1.5 }), 0, 0.18, 0.205));
    rig.torso.add(mesh(rbox(0.25, 0.27, 0.12, 0.03), mat('#cfd8dc'), 0, 0.17, -0.2));
    const collar = mesh(new THREE.TorusGeometry(0.16, 0.03, 12, 32), mat(color), 0, 0.33, 0);
    collar.rotation.x = Math.PI / 2;
    rig.torso.add(collar);
    for (const a of rig.arms) {
      const band = mesh(new THREE.TorusGeometry(0.05, 0.012, 8, 20), mat(color), 0, -0.02, 0);
      band.rotation.x = Math.PI / 2;
      a.elbow.add(band);
    }
    face(rig, { skin });
    hair(rig, '#8d6e63', { top: 0.32, back: 0.5 });
    const helmet = new THREE.Mesh(sphere(rig.headR * 1.5, 40, 28), new THREE.MeshPhysicalMaterial({ color: '#d6f1ff', transparent: true, opacity: 0.22, roughness: 0.02, metalness: 0, clearcoat: 1, depthWrite: false }));
    helmet.position.y = -0.01;
    rig.skull.add(helmet);
    rig.skull.add(mesh(new THREE.CylinderGeometry(0.008, 0.008, 0.12, 8), mat('#90a4ae'), 0.1, rig.headR * 1.45, 0));
    const tip = mesh(sphere(0.024), mat('#ff5252', { emissive: '#ff1744', emissiveIntensity: 2 }), 0.1, rig.headR * 1.45 + 0.07, 0);
    rig.skull.add(tip);
    rig.props.tip = tip;
    rig.style = 'astro';
    return rig;
  },

  ninja(color) {
    const skin = '#f1c27d';
    const dark = '#1d1d26';
    const rig = makeRig({ skin, top: dark, pants: dark, shoes: '#111', sole: '#111', gloves: dark });
    const belt = mesh(new THREE.TorusGeometry(0.165, 0.025, 10, 32), mat(color), 0, 0.05, 0);
    belt.rotation.x = Math.PI / 2;
    rig.torso.add(belt);
    for (const sx of [-1, 1]) {
      const k = mesh(capsule(0.018, 0.06), mat(color), sx * 0.03, 0.0, 0.175);
      k.rotation.z = sx * 0.4;
      rig.torso.add(k);
    }
    face(rig, { skin: dark, mouth: false, cheeks: false, brows: false, ears: false });
    // bande de peau au niveau des yeux
    const slit = mesh(new THREE.SphereGeometry(rig.headR * 1.012, 36, 8, Math.PI * 0.18, Math.PI * 0.64, Math.PI * 0.4, Math.PI * 0.16), mat(skin));
    slit.scale.set(1.04, 0.96, 1);
    rig.skull.add(slit);
    rig.eyes.position.z = 0.014;
    const band = mesh(new THREE.TorusGeometry(rig.headR * 1.02, 0.022, 10, 36), mat('#e53935'), 0, rig.headR * 0.42, 0);
    band.rotation.x = Math.PI / 2;
    band.scale.set(1.04, 1, 1);
    rig.skull.add(band);
    const tails = new THREE.Group();
    tails.position.set(0, rig.headR * 0.42, -rig.headR * 1.02);
    for (const [sx, rz] of [[-1, 0.5], [1, -0.4]]) {
      const t = mesh(rbox(0.035, 0.16, 0.012, 0.005), mat('#e53935'), sx * 0.025, -0.07, 0);
      t.rotation.z = rz;
      tails.add(t);
    }
    rig.skull.add(tails);
    rig.props.tails = tails;
    const k = new THREE.Group();
    k.add(mesh(rbox(0.026, 0.44, 0.01, 0.004), mat('#dfe6ea', { metalness: 0.95, roughness: 0.15 }), 0, 0.12, 0));
    k.add(mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.01, 16), gold(), 0, -0.1, 0));
    k.add(mesh(new THREE.CylinderGeometry(0.017, 0.017, 0.13, 10), mat('#4e342e'), 0, -0.17, 0));
    k.position.set(0, 0.2, -0.18);
    k.rotation.z = 0.7;
    rig.torso.add(k);
    rig.style = 'ninja';
    return rig;
  },

  robot(color) {
    const metal = mat('#b8c4cc', { metalness: 0.85, roughness: 0.28 });
    const darkM = mat('#5b6b75', { metalness: 0.8, roughness: 0.3 });
    const rig = makeRig({ skin: '#b8c4cc', top: '#b8c4cc', pants: '#5b6b75', hideLegs: true });
    rig.legs.forEach((p) => {
      p.add(mesh(rbox(0.08, 0.2, 0.08, 0.02), darkM, 0, -0.12, 0));
      p.add(mesh(rbox(0.12, 0.07, 0.17, 0.025), metal, 0, -0.26, 0.025));
    });
    rig.torso.remove(rig.torso.children[0]);
    rig.torso.add(mesh(rbox(0.34, 0.3, 0.26, 0.05), metal, 0, 0.17, 0));
    rig.torso.add(mesh(rbox(0.19, 0.12, 0.012, 0.01), mat('#0d1a20'), 0, 0.18, 0.13));
    const heart = mesh(new THREE.PlaneGeometry(0.15, 0.08), mat(color, { emissive: color, emissiveIntensity: 1.6 }), 0, 0.18, 0.138);
    rig.torso.add(heart);
    rig.props.heart = heart;
    rig.arms.forEach((a) => {
      a.shoulder.children.forEach((c) => c.isMesh && (c.material = darkM));
      a.elbow.children.forEach((c) => c.isMesh && (c.material = metal));
      a.hand.children.forEach((c) => (c.material = darkM));
    });
    rig.skull.position.y = 0.13;
    rig.head.children[0].material = darkM;
    rig.skull.add(mesh(rbox(0.32, 0.24, 0.26, 0.06), metal));
    rig.skull.add(mesh(rbox(0.25, 0.13, 0.012, 0.03), mat('#0d1a20'), 0, 0.005, 0.132));
    const eyeM = mat(color, { emissive: color, emissiveIntensity: 2.2 });
    const eg = new THREE.Group();
    for (const sx of [-1, 1]) eg.add(mesh(rbox(0.06, 0.05, 0.01, 0.015), eyeM, sx * 0.06, 0.01, 0.142));
    rig.skull.add(eg);
    rig.eyes = eg;
    for (const sx of [-1, 1]) {
      const e = mesh(new THREE.CylinderGeometry(0.045, 0.045, 0.04, 20), mat(color, { metalness: 0.4, roughness: 0.3 }), sx * 0.175, 0, 0);
      e.rotation.z = Math.PI / 2;
      rig.skull.add(e);
    }
    rig.skull.add(mesh(new THREE.CylinderGeometry(0.008, 0.008, 0.12, 8), metal, 0, 0.17, 0));
    const tip = mesh(sphere(0.03), mat('#ff5252', { emissive: '#ff1744', emissiveIntensity: 2 }), 0, 0.24, 0);
    rig.skull.add(tip);
    rig.props.tip = tip;
    rig.style = 'robot';
    return rig;
  },

  queen(color) {
    const skin = '#e0ac69';
    const rig = makeRig({ skin, top: color, pants: color, hideLegs: true, sleeves: color, forearm: skin, torsoProfile: [[0, 0], [0.12, 0], [0.13, 0.08], [0.125, 0.15], [0.14, 0.22], [0.13, 0.28], [0.07, 0.33], [0, 0.34]] });
    const skirt = mesh(lathe([[0, 0.02], [0.13, 0.02], [0.17, -0.06], [0.23, -0.17], [0.27, -0.27], [0.285, -0.295], [0, -0.295]], 40), mat(color, { roughness: 0.4 }));
    rig.hips.add(skirt);
    const hem = mesh(new THREE.TorusGeometry(0.28, 0.016, 10, 48), gold(), 0, -0.278, 0);
    hem.rotation.x = Math.PI / 2;
    rig.hips.add(hem);
    rig.props.skirt = skirt;
    const belt = mesh(new THREE.TorusGeometry(0.128, 0.015, 8, 32), gold(), 0, 0.02, 0);
    belt.rotation.x = Math.PI / 2;
    rig.torso.add(belt);
    for (let i = 0; i < 11; i++) {
      const a = Math.PI * 0.12 + (i / 10) * Math.PI * 0.76;
      rig.torso.add(mesh(sphere(0.013, 8, 6), mat('#fff', { roughness: 0.1 }), Math.cos(a) * 0.088, 0.31 - Math.sin(a) * 0.02, Math.sin(a) * 0.088));
    }
    face(rig, { skin, lashes: true, brows: '#3e2723' });
    hair(rig, '#3e2723', { top: 0.34, back: 0.85, scale: 1.1 });
    const pony = mesh(capsule(rig.headR * 0.55, 0.16), mat('#3e2723', { roughness: 0.75 }), 0, -0.1, -rig.headR * 0.95);
    rig.skull.add(pony);
    rig.props.pony = pony;
    const crown = new THREE.Group();
    crown.add(mesh(new THREE.CylinderGeometry(0.11, 0.1, 0.06, 28, 1, true), gold()));
    for (let i = 0; i < 7; i++) {
      const a = (i / 7) * Math.PI * 2;
      crown.add(mesh(new THREE.ConeGeometry(0.024, 0.075, 10), gold(), Math.cos(a) * 0.1, 0.065, Math.sin(a) * 0.1));
      crown.add(mesh(sphere(0.014, 10, 8), mat(i % 2 ? '#e53935' : '#29b6f6', { roughness: 0.05, metalness: 0.2, emissive: i % 2 ? '#b71c1c' : '#0277bd', emissiveIntensity: 0.4 }), Math.cos(a) * 0.108, 0.005, Math.sin(a) * 0.108));
    }
    crown.position.y = rig.headR * 0.95;
    crown.rotation.x = -0.12;
    rig.skull.add(crown);
    rig.style = 'queen';
    return rig;
  },

  foot(color) {
    const skin = '#a1665e';
    const rig = makeRig({ skin, top: color, pants: '#fafafa', shoes: '#111', sole: color, sleeves: color, forearm: skin });
    const collar = mesh(new THREE.TorusGeometry(0.075, 0.016, 8, 24, Math.PI), mat('#fff'), 0, 0.325, 0.06);
    collar.rotation.x = -0.3;
    rig.torso.add(collar);
    const back = new THREE.Group();
    back.add(mesh(rbox(0.025, 0.1, 0.01, 0.004), mat('#fff'), -0.035, 0, 0));
    const zero = mesh(new THREE.TorusGeometry(0.03, 0.011, 8, 20), mat('#fff'), 0.03, 0, 0);
    zero.scale.y = 1.6;
    back.add(zero);
    back.position.set(0, 0.17, -0.18);
    back.rotation.y = Math.PI;
    rig.torso.add(back);
    grintaBadge(rig.torso, 0.21, 0.172, 0.75).rotation.x = -0.15;
    face(rig, { skin, brows: '#111' });
    const curls = mat('#121212', { roughness: 0.9 });
    for (let ring = 0; ring < 2; ring++) {
      const n = ring ? 9 : 14;
      for (let i = 0; i < n; i++) {
        const a = (i / n) * Math.PI * 2 + ring;
        const rr = ring ? rig.headR * 0.45 : rig.headR * 0.8;
        rig.skull.add(mesh(sphere(0.058, 12, 10), curls, Math.cos(a) * rr, rig.headR * (ring ? 0.85 : 0.55), Math.sin(a) * rr - 0.02));
      }
    }
    const band = mesh(new THREE.TorusGeometry(rig.headR * 1.0, 0.02, 10, 36), mat('#fff'), 0, rig.headR * 0.35, 0);
    band.rotation.x = Math.PI / 2;
    rig.skull.add(band);
    const ball = new THREE.Group();
    ball.add(mesh(sphere(0.085, 28, 20), mat('#fafafa', { roughness: 0.35 })));
    const ico = new THREE.IcosahedronGeometry(1, 0).attributes.position;
    const v = new THREE.Vector3();
    const pm = mat('#151515');
    const seen = new Set();
    for (let i = 0; i < ico.count; i++) {
      v.fromBufferAttribute(ico, i).normalize();
      const key = v.toArray().map((n) => n.toFixed(2)).join();
      if (seen.has(key)) continue;
      seen.add(key);
      const patch = mesh(sphere(0.03, 10, 8), pm);
      patch.scale.set(1, 1, 0.35);
      patch.position.copy(v.clone().multiplyScalar(0.077));
      patch.lookAt(v.clone().multiplyScalar(2));
      ball.add(patch);
    }
    rig.root.add(ball);
    rig.props.ball = ball;
    rig.style = 'foot';
    return rig;
  },
};

/* ---------------- Animation ---------------- */
const damp = (cur, target, k) => cur + (target - cur) * k;
const ease = (u) => u * u * (3 - 2 * u);
const pulse = (t, period, len) => {
  const u = (t % period) / len;
  return u < 1 ? Math.sin(u * Math.PI) : 0;
};
function setRot(obj, x, y, z, k) {
  obj.rotation.x = damp(obj.rotation.x, x, k);
  obj.rotation.y = damp(obj.rotation.y, y, k);
  obj.rotation.z = damp(obj.rotation.z, z, k);
}

// Calcule la pose cible du perso (selon le mode) puis l'atteint en douceur.
export function animateRig(rig, t, dt, mode = 'idle') {
  const k = 1 - Math.exp(-dt * 10);
  const kf = 1 - Math.exp(-dt * 22);
  const T = t + rig.phase;
  const breathe = Math.sin(T * 2.2);
  const [aL, aR] = rig.arms;
  const [lL, lR] = rig.legs;

  const P = {
    hipsY: 0.3 + breathe * 0.004,
    torso: [0.03 + breathe * 0.015, Math.sin(T * 0.6) * 0.06, Math.sin(T * 0.9) * 0.035],
    head: [Math.sin(T * 1.1) * 0.05, Math.sin(T * 0.45) * 0.45 + Math.sin(T * 1.7) * 0.08, Math.sin(T * 0.7) * 0.07],
    sL: [Math.sin(T * 0.9) * 0.07, 0, -0.14 - breathe * 0.03],
    sR: [-Math.sin(T * 0.9) * 0.07, 0, 0.14 + breathe * 0.03],
    eL: [-0.18, 0, 0],
    eR: [-0.18, 0, 0],
    legL: [0, 0, -0.02],
    legR: [0, 0, 0.02],
    fast: false,
  };

  if (mode === 'walk') {
    const w = T * 15;
    const s = Math.sin(w);
    P.legL = [s * 0.75, 0, -0.03];
    P.legR = [-s * 0.75, 0, 0.03];
    P.sL = [-s * 0.7, 0, -0.18];
    P.sR = [s * 0.7, 0, 0.18];
    P.eL = [-0.6, 0, 0];
    P.eR = [-0.6, 0, 0];
    P.torso = [0.16, s * 0.12, 0];
    P.head = [-0.08, -s * 0.06, 0];
    P.hipsY = 0.3 + Math.abs(Math.cos(w)) * 0.025;
    P.fast = true;
  } else if (mode === 'jump') {
    P.legL = [-0.9, 0, -0.1];
    P.legR = [-0.5, 0, 0.1];
    P.sL = [-0.4, 0, -2.4];
    P.sR = [-0.4, 0, 2.4];
    P.eL = [-0.4, 0, 0];
    P.eR = [-0.4, 0, 0];
    P.torso = [0.1, 0, 0];
    P.fast = true;
  } else if (mode === 'cheer') {
    const w = T * 9;
    const hop = Math.abs(Math.sin(w * 0.5));
    P.sL = [-0.2, 0, -2.6 + Math.sin(w) * 0.25];
    P.sR = [-0.2, 0, 2.6 - Math.sin(w) * 0.25];
    P.eL = [-0.3, 0, Math.sin(w) * 0.4];
    P.eR = [-0.3, 0, -Math.sin(w) * 0.4];
    P.hipsY = 0.3 + hop * 0.09;
    P.legL = [-hop * 0.4, 0, -0.08];
    P.legR = [-hop * 0.4, 0, 0.08];
    P.head = [-0.25, Math.sin(w * 0.5) * 0.3, 0];
    P.torso = [-0.08, 0, Math.sin(w * 0.5) * 0.08];
    P.fast = true;
  } else if (mode === 'sad') {
    P.torso = [0.28, 0, 0];
    P.head = [0.45, Math.sin(T * 1.5) * 0.35, 0];
    P.sL = [0.15, 0, -0.04];
    P.sR = [0.15, 0, 0.04];
    P.eL = [-0.05, 0, 0];
    P.eR = [-0.05, 0, 0];
  } else {
    personality(rig, T, P);
  }

  const kk = P.fast ? kf : k;
  rig.hips.position.y = damp(rig.hips.position.y, P.hipsY, kk);
  setRot(rig.torso, ...P.torso, kk);
  setRot(rig.head, ...P.head, P.headK ? 1 - Math.exp(-dt * P.headK) : kk);
  setRot(aL.shoulder, ...P.sL, kk);
  setRot(aR.shoulder, ...P.sR, kk);
  setRot(aL.elbow, ...P.eL, kk);
  setRot(aR.elbow, ...P.eR, kk);
  setRot(lL, ...P.legL, kk);
  setRot(lR, ...P.legR, kk);

  if (rig.eyes) {
    rig.blinkAt -= dt;
    let sy = 1;
    if (rig.blinkAt < 0.14) sy = Math.max(0.08, Math.abs(rig.blinkAt - 0.07) / 0.07);
    if (rig.blinkAt < 0) rig.blinkAt = 2 + Math.random() * 3.5;
    if (mode === 'cheer') sy = 0.55;
    rig.eyes.scale.y = rig.style === 'robot' ? Math.max(0.15, sy) : sy;
  }
  if (rig.mouth) {
    rig.mouth.scale.y = damp(rig.mouth.scale.y, mode === 'cheer' ? 1.6 : mode === 'sad' ? -1 : 1, k);
    rig.mouth.scale.x = damp(rig.mouth.scale.x, mode === 'cheer' ? 1.3 : 1, k);
  }
  if (rig.brows) rig.brows.position.y = damp(rig.brows.position.y, mode === 'sad' ? -0.015 : mode === 'cheer' ? 0.02 : 0, k);
  props(rig, T, dt, mode);
}

function personality(rig, T, P) {
  switch (rig.style) {
    case 'boss': {
      // regarde sa montre de temps en temps, main gauche dans la poche
      const w = ease(Math.min(1, pulse(T, 7, 2.2) * 1.6));
      P.sR = [-0.15 - w * 0.95, 0, 0.18 - w * 0.55];
      P.eR = [-0.2 - w * 1.5, 0, w * 0.3];
      P.head[0] += w * 0.35;
      P.head[1] = P.head[1] * (1 - w) + w * 0.25;
      P.sL = [0.12, 0, -0.06];
      P.eL = [-0.35, 0, 0];
      P.torso[0] = -0.04;
      break;
    }
    case 'rap': {
      const beat = T * 1.6;
      const b = Math.sin(beat * Math.PI * 2);
      const bounce = Math.abs(Math.sin(beat * Math.PI));
      P.hipsY = 0.3 - bounce * 0.012;
      P.head = [b * 0.16 - 0.05, Math.sin(beat * 0.5) * 0.3, Math.sin(beat * Math.PI) * 0.08];
      P.torso = [0.06 + bounce * 0.05, Math.sin(beat * Math.PI) * 0.12, 0];
      P.sR = [-1.25, -0.25, 0.42];
      P.eR = [-1.55, 0, 0];
      P.sL = [-0.7 - b * 0.35, 0, -0.35];
      P.eL = [-0.9 + b * 0.3, 0, 0];
      P.legL = [0, 0, -0.06];
      P.legR = [0, 0, 0.06];
      break;
    }
    case 'chef': {
      const u = (T % 3.2) / 3.2;
      const flick = u < 0.12 ? Math.sin((u / 0.12) * Math.PI) : 0;
      P.sR = [-0.75 - flick * 0.45, 0.1, 0.25];
      P.eR = [-0.85 - flick * 0.5, 0, 0];
      P.sL = [0.1, 0, -0.75];
      P.eL = [-0.3, 0, 1.6];
      const look = u > 0.1 && u < 0.6 ? -0.35 * Math.sin(((u - 0.1) / 0.5) * Math.PI) : 0;
      P.head = [0.05 - flick * 0.1 + look, 0.15, P.head[2]];
      P.torso[0] = -0.02;
      rig._crepeU = u;
      break;
    }
    case 'astro': {
      P.hipsY = 0.36 + Math.sin(T * 1.3) * 0.05;
      P.sL = [Math.sin(T * 0.8) * 0.3, 0, -0.65 - Math.sin(T * 1.1) * 0.25];
      P.sR = [Math.sin(T * 0.8 + 1) * 0.3, 0, 0.65 + Math.sin(T * 1.1 + 1) * 0.25];
      P.eL = [-0.4, 0, 0];
      P.eR = [-0.4, 0, 0];
      P.legL = [Math.sin(T * 0.9) * 0.3, 0, -0.12];
      P.legR = [-Math.sin(T * 0.9) * 0.3, 0, 0.12];
      P.torso = [Math.sin(T * 0.6) * 0.1, Math.sin(T * 0.5) * 0.25, Math.sin(T * 0.7) * 0.12];
      break;
    }
    case 'ninja': {
      const hop = Math.abs(Math.sin(T * 4.5));
      const strike = pulse(T, 4.5, 0.35);
      P.hipsY = 0.3 + hop * 0.018;
      P.legL = [0.25, 0, -0.18];
      P.legR = [-0.25, 0, 0.18];
      P.torso = [0.12, -0.35 + strike * 0.5, 0];
      P.sL = [-1.0, 0.2, -0.25];
      P.eL = [-1.6, 0, 0];
      P.sR = [-1.0 - strike * 0.55, -0.2, 0.25 - strike * 0.1];
      P.eR = [-1.5 + strike * 1.4, 0, 0];
      P.head = [-0.05, 0.3 - strike * 0.3, 0];
      P.fast = strike > 0.05;
      break;
    }
    case 'robot': {
      const step = Math.floor(T / 1.4);
      const look = [0, 0.7, 0.7, 0, -0.7, -0.7][step % 6];
      const tilt = [0, 0, 0.25, 0, 0, -0.25][step % 6];
      P.head = [0, look, tilt];
      P.headK = 30;
      const sw = Math.sign(Math.sin(T * 2.2)) * 0.25;
      P.sL = [sw, 0, -0.12];
      P.sR = [-sw, 0, 0.12];
      P.eL = [-0.9, 0, 0];
      P.eR = [-0.9, 0, 0];
      P.torso = [0, look * 0.2, 0];
      P.hipsY = 0.3;
      break;
    }
    case 'queen': {
      const w = Math.sin(T * 5);
      P.sR = [-0.3, 0, 2.2];
      P.eR = [-0.2, 0, 0.5 + w * 0.45];
      P.sL = [-0.35, 0, -0.35];
      P.eL = [-1.4, 0, 0.3];
      P.head = [Math.sin(T * 0.8) * 0.06 - 0.06, Math.sin(T * 0.5) * 0.35, 0.12 + Math.sin(T * 0.9) * 0.05];
      P.torso = [0.0, Math.sin(T * 0.5) * 0.12, -0.05];
      break;
    }
    case 'foot': {
      const period = 0.9;
      const u = (T % period) / period;
      const kick = u < 0.18 ? Math.sin((u / 0.18) * Math.PI) : 0;
      const which = Math.floor(T / period) % 2;
      const lift = -0.25 - kick * 0.85;
      P.legR = which ? [lift, 0, 0.04] : [0, 0, 0.06];
      P.legL = which ? [0, 0, -0.06] : [lift, 0, -0.04];
      P.sL = [-0.2, 0, -0.75];
      P.sR = [-0.2, 0, 0.75];
      P.eL = [-0.4, 0, 0];
      P.eR = [-0.4, 0, 0];
      const by = 0.24 + 4 * 0.42 * u * (1 - u);
      P.head = [0.5 - by * 0.6, 0, 0];
      P.torso = [0.08, which ? -0.1 : 0.1, 0];
      P.hipsY = 0.3;
      rig._ballU = u;
      rig._ballSide = which ? 1 : -1;
      break;
    }
  }
}

const _v = new THREE.Vector3();
function props(rig, T, dt, mode) {
  const p = rig.props;
  if (p.tip) p.tip.material.emissiveIntensity = 0.6 + (Math.sin(T * 6) > 0 ? 2 : 0);
  if (p.heart) p.heart.scale.setScalar(1 + Math.max(0, Math.sin(T * 7)) * 0.08);
  if (p.tails) p.tails.rotation.x = 0.3 + Math.sin(T * 6) * 0.25;
  if (p.pony) p.pony.rotation.x = Math.sin(T * 2) * 0.1;
  if (p.crepe) {
    const idle = mode === 'idle';
    p.crepe.visible = idle;
    if (idle) {
      rig.root.updateMatrixWorld(true);
      _v.set(0, 0.03, 0.14);
      p.pan.localToWorld(_v);
      rig.root.worldToLocal(_v);
      const u = rig._crepeU || 0;
      const air = u > 0.06 && u < 0.6 ? Math.sin(((u - 0.06) / 0.54) * Math.PI) : 0;
      p.crepe.position.set(_v.x, _v.y + air * 0.42, _v.z);
      p.crepe.rotation.set(air > 0 ? ((u - 0.06) / 0.54) * Math.PI * 2 : 0, 0, 0);
    }
  }
  if (p.ball) {
    if (mode === 'idle') {
      const u = rig._ballU || 0;
      const by = 0.24 + 4 * 0.42 * u * (1 - u);
      const side = rig._ballSide || 1;
      const x = side * 0.075;
      p.ball.position.set(damp(p.ball.position.x, x, 0.25), by, damp(p.ball.position.z, 0.17, 0.3));
      p.ball.rotation.x += dt * 8;
    } else {
      p.ball.position.set(damp(p.ball.position.x, 0.17, 0.2), damp(p.ball.position.y, 0.085, 0.3), damp(p.ball.position.z, 0.12, 0.2));
      if (mode === 'walk') p.ball.rotation.x += dt * 14;
    }
  }
}

export function buildCharacter(id, color) {
  const rig = (BUILDERS[id] || BUILDERS.boss)(color);
  rig.phase = Math.random() * 20;
  const ring = new THREE.Mesh(new THREE.RingGeometry(0.2, 0.25, 48), new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: 0.9, transparent: true, opacity: 0.9, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2 }));
  ring.rotation.x = -Math.PI / 2;
  ring.position.y = 0.004;
  ring.renderOrder = 1;
  rig.root.add(ring);
  rig.ring = ring;
  rig.root.userData.rig = rig;
  rig.root.userData.charId = id;
  animateRig(rig, 0, 1, 'idle');
  return rig.root;
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
