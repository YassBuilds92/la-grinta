import { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { buildCharacter } from '../three/characters.js';
import { CHARACTERS } from '../game/board.js';

// Petit aperçu 3D tournant du perso choisi
export default function CharPreview({ char, size = 180 }) {
  const ref = useRef(null);
  const api = useRef(null);

  useEffect(() => {
    const el = ref.current;
    const r = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    r.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    r.setSize(size, size);
    r.toneMapping = THREE.ACESFilmicToneMapping;
    r.shadowMap.enabled = true;
    el.appendChild(r.domElement);
    const s = new THREE.Scene();
    const cam = new THREE.PerspectiveCamera(30, 1, 0.5, 20);
    cam.position.set(0, 0.9, 3.4);
    cam.lookAt(0, 0.5, 0);
    s.add(new THREE.HemisphereLight('#ffffff', '#f2d9b8', 1.8));
    const sun = new THREE.DirectionalLight('#fff3e0', 2.5);
    sun.position.set(2, 4, 3);
    s.add(sun);
    const rim = new THREE.DirectionalLight('#ff3fd8', 1.6);
    rim.position.set(-3, 2, -3);
    s.add(rim);
    const holder = new THREE.Group();
    s.add(holder);
    const timer = new THREE.Timer();
    let raf;
    let pop = 1;
    const loop = () => {
      raf = requestAnimationFrame(loop);
      timer.update();
      const t = timer.getElapsed();
      const dt = Math.min(timer.getDelta(), 0.05);
      pop = Math.min(1, pop + dt * 3.5);
      const e = 1 + Math.sin(pop * Math.PI) * 0.25 * (1 - pop);
      holder.rotation.y = Math.sin(t * 0.9) * 0.6;
      holder.position.y = Math.sin(pop * Math.PI) * 0.25;
      const b = Math.sin(t * 2.4) * 0.02;
      holder.scale.set(1.25 * e * (1 - b * 0.5), 1.25 * e * (1 + b), 1.25 * e * (1 - b * 0.5));
      r.render(s, cam);
    };
    loop();
    api.current = {
      set(id) {
        holder.clear();
        const c = CHARACTERS.find((c) => c.id === id) || CHARACTERS[0];
        holder.add(buildCharacter(c.id, c.color));
        pop = 0;
      },
    };
    return () => {
      cancelAnimationFrame(raf);
      r.dispose();
      r.domElement.remove();
    };
  }, [size]);

  useEffect(() => {
    api.current?.set(char);
  }, [char, size]);

  return <div className="char-preview" ref={ref} style={{ width: size, height: size }} />;
}
