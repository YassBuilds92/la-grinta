import * as THREE from 'three';

// Effets de partie dans le monde 3D : textes flottants, pièces qui volent, confettis, étiquettes de case.
// Tout est visible par tous les joueurs, au-dessus du plateau, au moment où ça se passe.

const easeOut = (t) => 1 - Math.pow(1 - t, 3);
const easeInOut = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
const backOut = (t) => 1 + 2.2 * Math.pow(t - 1, 3) + 1.2 * Math.pow(t - 1, 2);

// Carte de texte (canvas) : lignes avec taille/couleur, fond arrondi optionnel
function textSprite(lines, { bg = null, border = null, pad = 18, width = null } = {}) {
  const c = document.createElement('canvas');
  const x = c.getContext('2d');
  const S = 2;
  const font = (l) => `700 ${l.size}px "Pixelify Sans", Rubik, sans-serif`;
  let w = 0, h = 0;
  for (const l of lines) {
    x.font = font(l);
    w = Math.max(w, x.measureText(l.text).width);
    h += l.size * 1.15;
  }
  w = width || w + pad * 2 + 12;
  h += pad * 2;
  c.width = Math.ceil(w * S);
  c.height = Math.ceil(h * S);
  x.scale(S, S);
  if (bg) {
    x.fillStyle = bg;
    x.strokeStyle = border || '#2a1030';
    x.lineWidth = 5;
    const r = 16;
    x.beginPath();
    x.moveTo(r, 3); x.arcTo(w - 3, 3, w - 3, h - 3, r); x.arcTo(w - 3, h - 3, 3, h - 3, r); x.arcTo(3, h - 3, 3, 3, r); x.arcTo(3, 3, w - 3, 3, r);
    x.closePath();
    x.fill();
    x.stroke();
  }
  x.textAlign = 'center';
  x.textBaseline = 'middle';
  x.lineJoin = 'round';
  let y = pad;
  for (const l of lines) {
    x.font = font(l);
    const yy = y + (l.size * 1.15) / 2;
    if (l.stroke !== false) {
      x.lineWidth = Math.max(5, l.size * 0.22);
      x.strokeStyle = l.outline || '#2a1030';
      x.strokeText(l.text, w / 2, yy);
    }
    x.fillStyle = l.color || '#fff';
    x.fillText(l.text, w / 2, yy);
    y += l.size * 1.15;
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.minFilter = THREE.LinearMipmapLinearFilter;
  tex.anisotropy = 4;
  const m = new THREE.SpriteMaterial({ map: tex, transparent: true, depthTest: false, depthWrite: false, fog: false, toneMapped: false });
  const sp = new THREE.Sprite(m);
  sp.renderOrder = 20;
  sp.userData.aspect = w / h;
  sp.userData.h = h;
  return sp;
}

export class Fx {
  constructor(scene, camera) {
    this.scene = scene;
    this.camera = camera;
    this.items = [];
    this.coinGeo = new THREE.CylinderGeometry(0.11, 0.11, 0.035, 12);
    this.coinMat = new THREE.MeshToonMaterial({ color: '#ffcf3a', emissive: '#a86a00', emissiveIntensity: 0.25 });
    this.confGeo = new THREE.PlaneGeometry(0.07, 0.11);
    this._v = new THREE.Vector3();
  }

  // taille d'un sprite en unités monde pour une hauteur à l'écran à peu près constante
  _size(sp, pos, px) {
    const d = this.camera.position.distanceTo(pos);
    const h = (2 * Math.tan((this.camera.fov * Math.PI) / 360) * d * px) / (this.camera.userData.viewH || 800);
    sp.scale.set(h * sp.userData.aspect, h, 1);
    // jamais coupé par le bord de l'écran ni caché sous l'interface (pion au bord, téléphone)
    const vw = this.camera.userData.viewW || 1280, vh = this.camera.userData.viewH || 800;
    const v = this._v.copy(pos).project(this.camera);
    if (v.z > 1) return;
    const hx = Math.min(0.95, (px * sp.userData.aspect) / vw + 0.02), hy = px / vh + 0.02;
    const x = THREE.MathUtils.clamp(v.x, -1 + hx, 1 - hx);
    const y = Math.min(Math.max(v.y, -1 + 240 / vh + hy), 1 - 150 / vh - hy);
    if (x !== v.x || y !== v.y) pos.copy(v.set(x, y, v.z).unproject(this.camera));
  }

  // Texte qui jaillit et monte : +200 €, -48 €, « À toi ! »…
  pop(lines, pos, { px = 46, dur = 2.2, rise = 0.9, delay = 0, bg = null } = {}) {
    const sp = textSprite(Array.isArray(lines) ? lines : [lines], { bg });
    sp.visible = false;
    this.scene.add(sp);
    this.items.push({ kind: 'pop', sp, base: pos.clone(), t: -delay, dur, rise, px });
    return sp;
  }

  // Pièces qui volent en arc d'un point à un autre
  coins(from, to, n = 8, { delay = 0, onArrive } = {}) {
    for (let k = 0; k < n; k++) {
      const m = new THREE.Mesh(this.coinGeo, this.coinMat);
      m.visible = false;
      this.scene.add(m);
      this.items.push({ kind: 'coin', m, from: from.clone(), to: to.clone(), t: -delay - k * 0.07, dur: 0.75, h: 1.4 + Math.random() * 0.5, spin: 8 + Math.random() * 6, last: k === n - 1, onArrive });
    }
  }

  // Confettis aux couleurs d'un joueur
  confetti(pos, colors, n = 46, power = 1) {
    for (let k = 0; k < n; k++) {
      const mat = new THREE.MeshBasicMaterial({ color: colors[k % colors.length], side: THREE.DoubleSide, transparent: true });
      const m = new THREE.Mesh(this.confGeo, mat);
      m.position.copy(pos);
      const a = Math.random() * Math.PI * 2, s = (0.8 + Math.random() * 1.6) * power;
      this.scene.add(m);
      this.items.push({ kind: 'conf', m, v: new THREE.Vector3(Math.cos(a) * s, (3 + Math.random() * 2.5) * power, Math.sin(a) * s), r: new THREE.Vector3(Math.random() * 9, Math.random() * 9, Math.random() * 9), t: 0, dur: 2.2 + Math.random() * 0.6 });
    }
  }

  // Étiquette d'info posée au-dessus d'une case (reste tant que hold() renvoie vrai, ou dur secondes)
  label(lines, pos, { px = 34, dur = 3.2, hold = null, bg = '#fffaf0' } = {}) {
    const sp = textSprite(lines, { bg, pad: 14 });
    sp.visible = false;
    this.scene.add(sp);
    const it = { kind: 'label', sp, base: pos.clone(), t: 0, dur, hold, px, out: 0 };
    this.items.push(it);
    return it;
  }

  // Anneau qui s'élargit au sol (impact, atterrissage important)
  shock(pos, color, size = 1.6) {
    const m = new THREE.Mesh(new THREE.RingGeometry(0.3, 0.42, 40), new THREE.MeshBasicMaterial({ color, transparent: true, depthWrite: false, side: THREE.DoubleSide }));
    m.rotation.x = -Math.PI / 2;
    m.position.copy(pos).setY(0.03);
    this.scene.add(m);
    this.items.push({ kind: 'shock', m, t: 0, dur: 0.7, size });
  }

  update(dt) {
    const keep = [];
    const shown = []; // étiquettes d'abord (liées à une case), puis les textes du plus ancien au plus récent
    for (const it of this.items) {
      it.t += dt;
      let alive = true;
      if (it.t < 0) {
        keep.push(it);
        continue;
      }
      const u = Math.min(1, it.t / it.dur);
      if (it.kind === 'pop') {
        it.sp.visible = true;
        const p = it.sp.position.copy(it.base);
        p.y += 1.25 + easeOut(u) * it.rise;
        this._size(it.sp, p, it.px);
        const grow = u < 0.12 ? backOut(u / 0.12) : 1;
        it.sp.scale.multiplyScalar(Math.max(0.01, grow));
        it.curPx = it.px * Math.max(0.01, grow);
        if (u < 1) shown.push(it);
        it.sp.material.opacity = u < 0.75 ? 1 : 1 - (u - 0.75) / 0.25;
        alive = u < 1;
        if (!alive) this._drop(it.sp);
      } else if (it.kind === 'coin') {
        it.m.visible = true;
        const e = easeInOut(u);
        it.m.position.lerpVectors(it.from, it.to, e);
        it.m.position.y += Math.sin(u * Math.PI) * it.h + 0.5;
        it.m.rotation.set(Math.PI / 2, it.t * it.spin, 0);
        alive = u < 1;
        if (!alive) {
          this.scene.remove(it.m);
          if (it.last && it.onArrive) it.onArrive();
        }
      } else if (it.kind === 'conf') {
        it.v.y -= 7 * dt;
        it.v.multiplyScalar(1 - dt * 1.2);
        it.m.position.addScaledVector(it.v, dt);
        if (it.m.position.y < 0.02) {
          it.m.position.y = 0.02;
          it.v.set(0, 0, 0);
        } else {
          it.m.rotation.x += it.r.x * dt;
          it.m.rotation.y += it.r.y * dt;
        }
        it.m.material.opacity = u < 0.8 ? 1 : 1 - (u - 0.8) / 0.2;
        alive = u < 1;
        if (!alive) {
          this.scene.remove(it.m);
          it.m.material.dispose();
        }
      } else if (it.kind === 'label') {
        it.sp.visible = true;
        const holding = it.hold ? it.hold() : it.t < it.dur;
        if (!holding) it.out += dt * 3;
        const k = it.t < 0.25 ? backOut(it.t / 0.25) : 1;
        const p = it.sp.position.copy(it.base);
        p.y += 1.7 + Math.sin(it.t * 2) * 0.04 - it.out * 0.3;
        this._size(it.sp, p, it.px);
        it.sp.scale.multiplyScalar(Math.max(0.01, k));
        it.curPx = it.px * Math.max(0.01, k);
        if (it.out < 1) shown.unshift(it);
        it.sp.material.opacity = Math.max(0, 1 - it.out);
        alive = it.out < 1;
        if (!alive) this._drop(it.sp);
      } else if (it.kind === 'shock') {
        it.m.scale.setScalar(1 + easeOut(u) * it.size * 2);
        it.m.material.opacity = 1 - u;
        alive = u < 1;
        if (!alive) this.scene.remove(it.m);
      }
      if (alive) keep.push(it);
    }
    this.items = keep;
    this._layout(shown, dt);
  }

  // Deux textes au même endroit (tour + loyer, loyer + étiquette) : le plus récent se pose au-dessus,
  // en glissant, au lieu de se chevaucher
  _layout(list, dt) {
    const cam = this.camera, vw = cam.userData.viewW || 1280, vh = cam.userData.viewH || 800;
    const placed = [];
    const top = 1 - 150 / vh;
    for (const it of list) {
      const v = this._v.copy(it.sp.position).project(cam);
      if (v.z > 1) continue;
      const hx = (it.curPx * it.sp.userData.aspect) / vw, hy = it.curPx / vh;
      let y = v.y;
      for (let pass = 0; pass < 4; pass++) {
        let moved = false;
        for (const q of placed) {
          if (Math.abs(v.x - q.x) < hx + q.hx && Math.abs(y - q.y) < hy + q.hy) {
            y = q.y + q.hy + hy + 0.008;
            moved = true;
          }
        }
        if (!moved) break;
      }
      const need = y - v.y;
      it.lift = it.lift === undefined ? need : it.lift + (need - it.lift) * Math.min(1, dt * 12);
      const fy = Math.min(v.y + it.lift, top - hy);
      placed.push({ x: v.x, y: fy, hx, hy });
      if (fy !== v.y) it.sp.position.copy(v.setY(fy).unproject(cam));
    }
  }

  _drop(sp) {
    this.scene.remove(sp);
    sp.material.map.dispose();
    sp.material.dispose();
  }
}
