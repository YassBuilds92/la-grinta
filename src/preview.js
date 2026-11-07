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
import { newGame, addPlayer, applyAction } from './game/engine.js';

const params = new URLSearchParams(location.search);
if (window.__onlyBoard) params.set('only', 'board');

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
  const narrow = innerWidth < 640;
  const sc = new GameScene(document.getElementById('board'), { insets: { top: 56, bottom: narrow ? 118 : 72 } });
  // démo jouable avec le vrai moteur de règles : 4 joueurs joués automatiquement, tour par tour
  let g = newGame();
  const names = ['Yassine', 'Akram', 'Mateja', 'Ace'];
  names.forEach((n, k) => (g = addPlayer(g, { id: 'p' + k, name: n, char: CHARACTERS[k % CHARACTERS.length].id })));
  g = applyAction(g, 'p0', { type: 'start' }, { isHost: true });
  // quelques terrains déjà achetés pour voir des loyers tout de suite
  const ids = g.players.map((p) => p.id);
  const own = { 6: [1, 1], 8: [1, 2], 9: [1, 0], 11: [2, 3], 13: [2, 2], 14: [2, 0], 16: [3, 1], 18: [3, 1], 19: [3, 0], 21: [0, 1], 24: [1, 5], 26: [2, 0], 31: [3, 2], 34: [0, 0], 37: [1, 4], 39: [2, 5], 5: [3, 0], 15: [0, 0] };
  for (const [t, [o, h]] of Object.entries(own)) g.props[t] = { owner: ids[o], houses: h, mortgaged: false };
  g.players.forEach((p, k) => (p.pos = [0, 7, 17, 27][k]));
  g.settings.freeParking = true;
  g.pot = 150;
  sc.meId = g.players[0].id;
  sc.update(g);
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));
  const settle = async () => {
    await wait(300);
    while (sc.busy) await wait(150);
  };
  let running = false;
  const act = (a) => {
    try {
      g = applyAction(g, g.players[g.turn].id, a);
      sc.update(g);
      return true;
    } catch {
      return false;
    }
  };
  window.__roll = async () => {
    if (running || g.phase !== 'playing') return;
    running = true;
    const me = g.players[g.turn];
    if (me.inJail && me.cash >= 50) act({ type: 'payJail' });
    for (let guard = 0; guard < 4; guard++) {
      if (!act({ type: 'roll' })) break;
      await settle();
      if (g.pending?.type === 'buy') {
        await wait(900);
        if (!act({ type: 'buy' })) act({ type: 'decline' });
        await settle();
      }
      if (g.rolled) break;
    }
    await wait(500);
    act({ type: 'endTurn' });
    await settle();
    running = false;
  };
  const cam = params.get('cam') || (window.__cam || '');
  if (cam.includes(',')) {
    const v = cam.split(',').map(Number);
    sc.camera.position.set(v[0], v[1], v[2]);
    sc.controls.target.set(v[3], v[4], v[5]);
    sc.lockCam = true;
    if (v[6]) { sc.camera.fov = v[6]; sc.camera.updateProjectionMatrix(); sc.fovLock = v[6]; }
  }
  window.__scene = sc;
}
if (params.get('only') !== 'board') cast(); else document.getElementById('cast').remove();
if (params.get('only') !== 'cast') board(); else document.getElementById('board').remove();
