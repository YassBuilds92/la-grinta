import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { buildCharacter, animateRig } from '../three/characters.js';
import { toonify } from '../three/pixelPass.js';
import { CHARACTERS } from '../game/board.js';

const DPR = () => Math.min(window.devicePixelRatio || 1, 2);

function lights(s) {
  s.add(new THREE.HemisphereLight('#ffffff', '#c9b3a0', 1.25));
  const sun = new THREE.DirectionalLight('#fff3e0', 1.9);
  sun.position.set(2, 4, 3);
  s.add(sun);
  const rim = new THREE.DirectionalLight('#ffb36b', 1.4);
  rim.position.set(-3, 2, -3);
  s.add(rim);
}

// Perso choisi, rendu net qui tourne doucement sur son socle.
export default function CharPreview({ char, size = 180, mode = 'idle' }) {
  const ref = useRef(null);
  const api = useRef(null);

  useEffect(() => {
    const el = ref.current;
    // rendu net à la résolution de l'écran, comme le plateau (pas de gros pixels)
    const r = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    r.setPixelRatio(DPR());
    r.setSize(size, size);
    el.appendChild(r.domElement);
    const s = new THREE.Scene();
    const cam = new THREE.PerspectiveCamera(30, 1, 0.5, 20);
    cam.position.set(0, 0.9, 3.4);
    cam.lookAt(0, 0.55, 0);
    lights(s);
    const holder = new THREE.Group();
    s.add(holder);
    const timer = new THREE.Timer();
    let raf;
    let pop = 1;
    let rig = null;
    const loop = () => {
      raf = requestAnimationFrame(loop);
      timer.update();
      const t = timer.getElapsed();
      const dt = Math.min(timer.getDelta(), 0.05);
      pop = Math.min(1, pop + dt * 3);
      // arrivée : petit saut qui retombe en douceur
      const jump = Math.sin(pop * Math.PI) * 0.35 * (1 - pop * 0.4);
      holder.position.y = jump;
      holder.rotation.y = Math.sin(t * 0.8) * 0.5 + (1 - pop) * Math.PI * 2;
      holder.scale.setScalar(1.25);
      if (rig) animateRig(rig, t, dt, pop < 1 ? 'jump' : api.current.mode);
      r.render(s, cam);
    };
    api.current = {
      mode,
      set(id) {
        holder.clear();
        const c = CHARACTERS.find((c) => c.id === id) || CHARACTERS[0];
        const g = buildCharacter(c.id, c.color);
        toonify(g);
        rig = g.userData.rig || null;
        holder.add(g);
        pop = 0;
      },
    };
    api.current.set(char);
    loop();
    return () => {
      cancelAnimationFrame(raf);
      r.dispose();
      r.domElement.remove();
    };
  }, [size]);

  useEffect(() => {
    if (api.current) api.current.mode = mode;
  }, [mode]);
  useEffect(() => {
    api.current?.set(char);
  }, [char]);

  return <div className="char-preview" ref={ref} style={{ width: size, height: size }} />;
}

// Portraits pixel de tous les persos, rendus une seule fois avec un seul contexte WebGL.
let portraitCache = null;
function renderPortraits() {
  if (portraitCache) return portraitCache;
  const N = 200;
  const r = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true });
  r.setPixelRatio(1);
  r.setSize(N, N, false);
  const cam = new THREE.PerspectiveCamera(20, 1, 0.5, 20);
    const out = {};
  for (const c of CHARACTERS) {
    const s = new THREE.Scene();
    lights(s);
    const g = buildCharacter(c.id, c.color);
    toonify(g);
    if (g.userData.rig) animateRig(g.userData.rig, 0, 0, 'idle');
    g.rotation.y = 0.35;
    s.add(g);
    // cadrage sur la tête de chaque champion (le Fauve est accroupi, pas les autres)
    g.updateMatrixWorld(true);
    const head = new THREE.Vector3();
    g.userData.rig?.joints?.head?.getWorldPosition(head);
    if (!head.y) head.set(0, 0.95, 0);
    cam.position.set(head.x + 0.45, head.y + 0.3, head.z + 2.5);
    cam.lookAt(head.x, head.y - 0.05, head.z);
    r.render(s, cam);
    out[c.id] = r.domElement.toDataURL();
  }
  r.dispose();
  r.forceContextLoss?.();
  portraitCache = out;
  return out;
}
export function usePortraits() {
  const [p, setP] = useState(portraitCache);
  useEffect(() => {
    if (!p) setP(renderPortraits());
  }, [p]);
  return p || {};
}
