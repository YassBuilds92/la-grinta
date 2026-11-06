import '@fontsource/bungee';
import '@fontsource/pixelify-sans/400.css';
import '@fontsource/pixelify-sans/600.css';
import '@fontsource/pixelify-sans/700.css';
import '@fontsource/rubik/600.css';
import '@fontsource/rubik/700.css';
import * as THREE from 'three';
import { GameScene } from './three/scene.js';
import { loadFonts } from './three/boardTexture.js';
import { buildCharacter } from './three/characters.js';
import { CHARACTERS } from './game/board.js';

const params = new URLSearchParams(location.search);

function cast() {
  const el = document.getElementById('cast');
  const r = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
  r.setPixelRatio(Math.min(devicePixelRatio, 2));
  r.setSize(el.clientWidth, el.clientHeight);
  r.shadowMap.enabled = true;
  r.shadowMap.type = THREE.PCFShadowMap;
  r.toneMapping = THREE.ACESFilmicToneMapping;
  el.appendChild(r.domElement);
  const s = new THREE.Scene();
  s.background = new THREE.Color('#14122e');
  const cam = new THREE.PerspectiveCamera(30, el.clientWidth / el.clientHeight, 0.5, 40);
  cam.position.set(0, 1.7, 9.2);
  cam.lookAt(0, 0.45, 0);
  s.add(new THREE.HemisphereLight('#dfe6ff', '#2a1f3d', 1.2));
  const sun = new THREE.DirectionalLight('#fff3e0', 2.6);
  sun.position.set(3, 6, 5);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  Object.assign(sun.shadow.camera, { left: -6, right: 6, top: 4, bottom: -2, near: 1, far: 20 });
  sun.shadow.normalBias = 0.02;
  s.add(sun);
  const rim = new THREE.DirectionalLight('#ff3fd8', 1.5);
  rim.position.set(-4, 3, -4);
  s.add(rim);
  const floor = new THREE.Mesh(new THREE.CircleGeometry(12, 64), new THREE.MeshStandardMaterial({ color: '#221f45', roughness: 0.8 }));
  floor.rotation.x = -Math.PI / 2;
  floor.receiveShadow = true;
  s.add(floor);
  const chars = CHARACTERS.map((c, k) => {
    const g = buildCharacter(c.id, c.color);
    g.position.x = (k - 3.5) * 0.95;
    g.scale.setScalar(1.25);
    s.add(g);
    return g;
  });
  const clock = new THREE.Clock();
  const loop = () => {
    const t = clock.getElapsedTime();
    chars.forEach((g, k) => {
      g.rotation.y = Math.sin(t * 0.8 + k) * 0.5;
      const b = Math.sin(t * 2.2 + k) * 0.015;
      g.scale.set(1.25 * (1 - b * 0.5), 1.25 * (1 + b), 1.25 * (1 - b * 0.5));
    });
    r.render(s, cam);
    requestAnimationFrame(loop);
  };
  loop();
}

async function board() {
  await loadFonts();
  const sc = new GameScene(document.getElementById('board'));
  const players = CHARACTERS.map((c, k) => ({ id: 'p' + k, name: c.name, char: c.id, color: c.color, pos: [0, 0, 3, 10, 10, 24, 39, 16][k], inJail: k === 4, moveId: 0, moveKind: 'jump', bankrupt: false }));
  const props = {
    1: { owner: 'p0', houses: 2 }, 3: { owner: 'p0', houses: 3 },
    37: { owner: 'p1', houses: 5 }, 39: { owner: 'p1', houses: 4 },
    21: { owner: 'p2', houses: 0 }, 23: { owner: 'p2', houses: 1, mortgaged: false }, 5: { owner: 'p3', houses: 0 }, 12: { owner: 'p6', mortgaged: true, houses: 0 },
  };
  sc.update({ phase: 'playing', players, props, turn: 0, dice: [5, 2], rollId: 1 });
  if (params.get('cam') === 'close') {
    sc.camera.position.set(2.2, 2.6, 7.6);
    sc.controls.target.set(3.3, 0.2, 4.4);
  }
  window.__scene = sc;
  window.__roll = () => sc.update({ phase: 'playing', players, props, turn: 0, dice: [6, 3], rollId: Math.random() });
}
if (params.get('only') !== 'board') cast();
if (params.get('only') !== 'cast') board();
