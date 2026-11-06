import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { buildCharacter, animateRig } from './three/characters.js';
import { CHARACTERS } from './game/board.js';

const el = document.getElementById('stage');
const r = new THREE.WebGLRenderer({ antialias: true });
r.setPixelRatio(Math.min(devicePixelRatio, 2));
r.shadowMap.enabled = true;
r.shadowMap.type = THREE.PCFShadowMap;
r.toneMapping = THREE.ACESFilmicToneMapping;
el.appendChild(r.domElement);
const scene = new THREE.Scene();
scene.background = new THREE.Color('#120d10');
scene.fog = new THREE.Fog('#120d10', 9, 20);
const cam = new THREE.PerspectiveCamera(36, 1, 0.3, 30);
const ctl = new OrbitControls(cam, r.domElement);
ctl.enableDamping = true;
ctl.target.set(0, 0.5, -1.1);
ctl.maxPolarAngle = 1.45;
ctl.minDistance = 2;
ctl.maxDistance = 12;

scene.add(new THREE.HemisphereLight('#ffe6dc', '#2a1416', 1.0));
const sun = new THREE.DirectionalLight('#fff1e6', 2.4);
sun.position.set(2.5, 6, 5);
sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
Object.assign(sun.shadow.camera, { left: -5, right: 5, top: 4, bottom: -4, near: 1, far: 16 });
sun.shadow.normalBias = 0.02;
sun.shadow.bias = -0.0003;
scene.add(sun);
const rim = new THREE.DirectionalLight('#ff5a1a', 2.2);
rim.position.set(-4, 3, -5);
scene.add(rim);
const rim2 = new THREE.DirectionalLight('#e0245e', 1.4);
rim2.position.set(4, 2, -5);
scene.add(rim2);

const floor = new THREE.Mesh(new THREE.CircleGeometry(14, 96), new THREE.MeshStandardMaterial({ color: '#2a1a1e', roughness: 0.85 }));
floor.rotation.x = -Math.PI / 2;
floor.receiveShadow = true;
scene.add(floor);

// estrade en arc, chaque perso sur son spot avec de l'espace
const N = CHARACTERS.length;
const R = 7;
const chars = CHARACTERS.map((c, k) => {
  const a = ((k - (N - 1) / 2) / (N - 1)) * 1.05;
  const x = Math.sin(a) * R;
  const z = -Math.cos(a) * R + R - 1.4;
  const pad = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.46, 0.06, 48), new THREE.MeshStandardMaterial({ color: '#1a1114', roughness: 0.4, metalness: 0.3 }));
  pad.position.set(x, 0.03, z);
  pad.receiveShadow = true;
  scene.add(pad);
  const glow = new THREE.Mesh(new THREE.RingGeometry(0.43, 0.47, 64), new THREE.MeshBasicMaterial({ color: c.color }));
  glow.rotation.x = -Math.PI / 2;
  glow.position.set(x, 0.062, z);
  scene.add(glow);
  const o = buildCharacter(c.id, c.color);
  o.position.set(x, 0.06, z);
  o.rotation.y = -a * 0.6;
  o.scale.setScalar(1.15);
  o.userData.rig.ring.visible = false;
  o.traverse((m) => m.isMesh && !m.material.transparent && (m.castShadow = true));
  scene.add(o);
  const lbl = document.createElement('div');
  lbl.className = 'lbl';
  lbl.style.setProperty('--c', c.color);
  lbl.textContent = c.name;
  document.getElementById('labels').appendChild(lbl);
  return { o, rig: o.userData.rig, lbl, x, z, a, mode: null, until: 0, c };
});

let globalMode = 'idle';
const modes = [['idle', 'Chacun son style'], ['walk', 'Marche'], ['cheer', 'Victoire'], ['sad', 'Dégoûté'], ['jump', 'Saut']];
const bar = document.getElementById('bar');
modes.forEach(([m, label]) => {
  const b = document.createElement('button');
  b.textContent = label;
  b.className = m === 'idle' ? 'on' : '';
  b.onclick = () => {
    globalMode = m;
    [...bar.children].forEach((x) => x.classList.toggle('on', x === b));
  };
  bar.appendChild(b);
});

const ray = new THREE.Raycaster();
const ptr = new THREE.Vector2();
let down = null;
r.domElement.addEventListener('pointerdown', (e) => (down = [e.clientX, e.clientY]));
r.domElement.addEventListener('pointerup', (e) => {
  if (!down || Math.hypot(e.clientX - down[0], e.clientY - down[1]) > 6) return;
  const rect = r.domElement.getBoundingClientRect();
  ptr.set(((e.clientX - rect.left) / rect.width) * 2 - 1, -((e.clientY - rect.top) / rect.height) * 2 + 1);
  ray.setFromCamera(ptr, cam);
  const hit = ray.intersectObjects(chars.map((c) => c.o), true)[0];
  if (!hit) return;
  const ch = chars.find((c) => { let p = hit.object; while (p) { if (p === c.o) return true; p = p.parent; } return false; });
  if (ch) { ch.mode = 'cheer'; ch.until = timer.getElapsed() + 2.2; }
});

function resize() {
  const w = el.clientWidth, h = el.clientHeight;
  r.setSize(w, h);
  cam.aspect = w / h;
  const portrait = w / h < 0.9;
  cam.fov = portrait ? 70 : 40;
  cam.updateProjectionMatrix();
  if (!resize.done) {
    cam.position.set(0, portrait ? 2.8 : 1.9, portrait ? 9.5 : 6.3);
    resize.done = true;
  }
}
addEventListener('resize', resize);
resize();

const timer = new THREE.Timer();
const v = new THREE.Vector3();
function loop() {
  requestAnimationFrame(loop);
  timer.update();
  const t = timer.getElapsed();
  const dt = Math.min(timer.getDelta(), 0.05);
  ctl.update();
  for (const ch of chars) {
    const m = ch.mode && t < ch.until ? ch.mode : globalMode;
    let y = 0.06;
    if (m === 'jump') y += Math.abs(Math.sin((t + ch.a) * 3)) * 0.5;
    ch.o.position.y += (y - ch.o.position.y) * Math.min(1, dt * 14);
    animateRig(ch.rig, t, dt, m);
    v.set(ch.x, 1.32, ch.z).project(cam);
    ch.lbl.style.left = ((v.x + 1) / 2) * innerWidth + 'px';
    ch.lbl.style.top = ((1 - v.y) / 2) * innerHeight - 34 + 'px';
  }
  r.render(scene, cam);
}
loop();
const f = new URLSearchParams(location.search).get('focus');
if (f !== null) { const c = chars[+f]; ctl.target.set(c.x, 0.6, c.z); cam.position.set(c.x, 0.9, c.z + 2.2); }
window.__ready = true;
