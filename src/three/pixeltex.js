import * as THREE from 'three';

// Textures de détail en pixel art (niveaux de gris clairs, multipliés par la couleur du matériau).
// Agrandies au plus proche voisin pour garder le pixel net, réduites avec mipmaps pour ne jamais fourmiller au loin.

function rng(seed) {
  let s = seed >>> 0;
  return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296);
}

function make(size, draw) {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const x = c.getContext('2d');
  draw(x, size);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.magFilter = THREE.NearestFilter;
  t.minFilter = THREE.LinearMipmapLinearFilter;
  t.anisotropy = 8;
  return t;
}
const g = (v) => `rgb(${v},${v},${v})`;

const DRAW = {
  rock(x, n) {
    const r = rng(4);
    x.fillStyle = g(232);
    x.fillRect(0, 0, n, n);
    // blocs de pierre irréguliers
    for (let k = 0; k < 60; k++) {
      const w = 3 + Math.floor(r() * 7), h = 2 + Math.floor(r() * 3);
      x.fillStyle = g(205 + Math.floor(r() * 50));
      x.fillRect(Math.floor(r() * n), Math.floor(r() * n), w, h);
    }
    // strates
    for (let y = 6; y < n; y += 11 + Math.floor(r() * 5)) {
      for (let px = 0; px < n; px++) {
        const yy = y + Math.round(Math.sin(px * 0.3 + y) * 1.2);
        x.fillStyle = g(176);
        x.fillRect(px, yy, 1, 1);
        x.fillStyle = g(250);
        x.fillRect(px, yy - 1, 1, 1);
      }
    }
    for (let k = 0; k < 40; k++) {
      x.fillStyle = g(r() < 0.5 ? 255 : 190);
      x.fillRect(Math.floor(r() * n), Math.floor(r() * n), 1, 1);
    }
  },
  grass(x, n) {
    const r = rng(8);
    x.fillStyle = g(236);
    x.fillRect(0, 0, n, n);
    for (let k = 0; k < 90; k++) {
      const px = Math.floor(r() * n), py = Math.floor(r() * n);
      x.fillStyle = g(r() < 0.5 ? 205 : 255);
      x.fillRect(px, py, 1, 2);
    }
    for (let k = 0; k < 6; k++) {
      x.fillStyle = g(214);
      x.fillRect(Math.floor(r() * n), Math.floor(r() * n), 3, 2);
    }
  },
  roof(x, n) {
    x.fillStyle = g(240);
    x.fillRect(0, 0, n, n);
    for (let row = 0; row < n; row += 8) {
      x.fillStyle = g(196);
      x.fillRect(0, row + 6, n, 2);
      x.fillStyle = g(255);
      x.fillRect(0, row, n, 1);
      for (let c = (row / 8) % 2 ? 4 : 0; c < n; c += 8) {
        x.fillStyle = g(214);
        x.fillRect(c, row, 1, 7);
      }
    }
  },
  wall(x, n) {
    const r = rng(2);
    x.fillStyle = g(246);
    x.fillRect(0, 0, n, n);
    for (let k = 0; k < 30; k++) {
      x.fillStyle = g(r() < 0.5 ? 232 : 255);
      x.fillRect(Math.floor(r() * n), Math.floor(r() * n), 2, 1);
    }
    x.fillStyle = g(226);
    x.fillRect(0, n - 3, n, 3);
  },
  wood(x, n) {
    x.fillStyle = g(230);
    x.fillRect(0, 0, n, n);
    for (let c = 0; c < n; c += 6) {
      x.fillStyle = g(190);
      x.fillRect(c, 0, 1, n);
      x.fillStyle = g(250);
      x.fillRect(c + 1, 0, 1, n);
    }
    x.fillStyle = g(200);
    for (let k = 0; k < 8; k++) x.fillRect((k * 13) % n, (k * 7) % n, 1, 3);
  },
  scales(x, n) {
    x.fillStyle = g(236);
    x.fillRect(0, 0, n, n);
    for (let row = 0; row < n; row += 6) {
      for (let c = (row / 6) % 2 ? 4 : 0; c < n + 8; c += 8) {
        x.fillStyle = g(200);
        x.fillRect(c - 3, row + 3, 6, 1);
        x.fillRect(c - 4, row + 2, 1, 1);
        x.fillRect(c + 3, row + 2, 1, 1);
        x.fillStyle = g(255);
        x.fillRect(c - 2, row, 4, 1);
      }
    }
  },
  truss(x, n) {
    x.fillStyle = g(150);
    x.fillRect(0, 0, n, n);
    x.fillStyle = g(250);
    x.fillRect(0, 0, n, 3);
    x.fillRect(0, n - 3, n, 3);
    x.fillRect(0, 0, 3, n);
    x.fillRect(n - 3, 0, 3, n);
    for (let k = 0; k < n; k++) {
      x.fillRect(k, k, 2, 2);
      x.fillRect(n - k - 2, k, 2, 2);
    }
  },
  water(x, n) {
    const r = rng(12);
    x.fillStyle = g(232);
    x.fillRect(0, 0, n, n);
    for (let k = 0; k < 26; k++) {
      x.fillStyle = g(r() < 0.6 ? 255 : 212);
      x.fillRect(Math.floor(r() * n), Math.floor(r() * n), 3 + Math.floor(r() * 6), 1);
    }
  },
};

const cache = new Map();
export function detailTex(kind) {
  if (!cache.has(kind)) cache.set(kind, make(kind === 'rock' || kind === 'water' ? 64 : 32, DRAW[kind]));
  return cache.get(kind);
}

// UV en coordonnées monde (projection boîte) : même densité de pixels partout, pas d'étirement
export function worldUV(geo, texelsPerUnit = 16, size = 32) {
  const p = geo.attributes.position, nrm = geo.attributes.normal;
  const uv = new Float32Array(p.count * 2);
  const s = texelsPerUnit / size;
  for (let i = 0; i < p.count; i++) {
    const nx = Math.abs(nrm.getX(i)), ny = Math.abs(nrm.getY(i)), nz = Math.abs(nrm.getZ(i));
    const x = p.getX(i), y = p.getY(i), z = p.getZ(i);
    let u, v;
    if (ny >= nx && ny >= nz) { u = x; v = z; }
    else if (nx >= nz) { u = z; v = y; }
    else { u = x; v = y; }
    uv[i * 2] = u * s;
    uv[i * 2 + 1] = v * s;
  }
  geo.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  return geo;
}

// Halo lumineux (sprite additif) : donne l'impression de lueur sans post-traitement coûteux
let glowTex = null;
export function glow(color, size, opacity = 0.7) {
  if (!glowTex) {
    const c = document.createElement('canvas');
    c.width = c.height = 64;
    const x = c.getContext('2d');
    const gr = x.createRadialGradient(32, 32, 0, 32, 32, 32);
    gr.addColorStop(0, 'rgba(255,255,255,1)');
    gr.addColorStop(0.25, 'rgba(255,255,255,0.55)');
    gr.addColorStop(1, 'rgba(255,255,255,0)');
    x.fillStyle = gr;
    x.fillRect(0, 0, 64, 64);
    glowTex = new THREE.CanvasTexture(c);
  }
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, color, transparent: true, opacity, blending: THREE.AdditiveBlending, depthWrite: false, fog: false }));
  s.scale.setScalar(size);
  return s;
}
