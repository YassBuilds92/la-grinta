import * as THREE from 'three';
import { SIZE } from './layout.js';

// Caméra de jeu : vue d'ensemble qui tient tout le plateau dans la zone libre de l'écran,
// pivote vers le côté du joueur actif (ses cases se lisent à l'endroit), suit le pion pendant
// qu'il avance, puis revient en douceur. Tout passe par des ressorts amortis : départ avec élan,
// arrivée sans à-coup. Dès que le joueur touche la caméra, elle lui appartient jusqu'au
// prochain événement de jeu (ou au bouton « recentrer »).

const H = SIZE / 2 + 0.15;
const CORNERS = [];
for (const x of [-H, H]) for (const z of [-H, H]) for (const y of [0, 0.9]) CORNERS.push(new THREE.Vector3(x, y, z));
const wrap = (a) => Math.atan2(Math.sin(a), Math.cos(a));

class Spring {
  constructor(v = 0) {
    this.v = v;
    this.vel = 0;
  }
  step(target, dt, w) {
    // ressort critique (pas d'oscillation)
    const a = w * w * (target - this.v) - 2 * w * this.vel;
    this.vel += a * dt;
    this.v += this.vel * dt;
  }
}

export class CameraDirector {
  constructor(camera, controls) {
    this.camera = camera;
    this.controls = controls;
    this.insets = { top: 0, bottom: 0, left: 0, right: 0 };
    this.theta = 0; // côté regardé (0 = bas du plateau)
    this.manual = false;
    this.mode = 'overview';
    this.follow = null;
    this.returnAt = 0;
    this.s = { th: new Spring(), ph: new Spring(), r: new Spring(20), tx: new Spring(), ty: new Spring(), tz: new Spring() };
    this._sph = new THREE.Spherical();
    this._v = new THREE.Vector3();
    this._cam = camera.clone();
    controls.addEventListener('start', () => {
      this.manual = true;
    });
    this.fit = null;
  }

  sideAngle(side) {
    return -side * (Math.PI / 2);
  }

  // Calcule la vue d'ensemble pour un angle donné : distance et décalage pour que les 4 coins
  // tombent dans la zone visible (hors interface), avec une marge
  overview(theta, w, h) {
    const portrait = w < h;
    const ph = portrait ? 0.92 : 1.17; // angle depuis la verticale : caméra basse en paysage pour voir le décor
    const cam = this._cam;
    cam.fov = this.camera.fov;
    cam.aspect = w / h;
    cam.near = this.camera.near;
    cam.far = this.camera.far;
    cam.updateProjectionMatrix();
    const ins = this.insets;
    const sx0 = -1 + (2 * ins.left) / w, sx1 = 1 - (2 * ins.right) / w;
    const sy0 = -1 + (2 * ins.bottom) / h, sy1 = 1 - (2 * ins.top) / h;
    const fwd = new THREE.Vector3(-Math.sin(theta), 0, -Math.cos(theta));
    let r = 20, shift = 0;
    const tgt = new THREE.Vector3(), p = new THREE.Vector3();
    for (let it = 0; it < 40; it++) {
      tgt.copy(fwd).multiplyScalar(shift);
      cam.position.setFromSphericalCoords(r, ph, theta).add(tgt);
      cam.lookAt(tgt);
      cam.updateMatrixWorld();
      let x0 = 9, x1 = -9, y0 = 9, y1 = -9;
      for (const c of CORNERS) {
        p.copy(c).project(cam);
        x0 = Math.min(x0, p.x); x1 = Math.max(x1, p.x);
        y0 = Math.min(y0, p.y); y1 = Math.max(y1, p.y);
      }
      const k = Math.max((x1 - x0) / ((sx1 - sx0) * 0.94), (y1 - y0) / ((sy1 - sy0) * 0.94));
      r *= 1 + (k - 1) * 0.6;
      // plateau calé en bas de la zone libre : le décor occupe le haut de l'écran
      const dy = y0 - (sy0 + 0.03);
      shift += dy * r * 0.25;
    }
    return { th: theta, ph, r, t: tgt.clone() };
  }

  setSize(w, h) {
    this.w = w;
    this.h = h;
    this.fit = this.overview(this.theta, w, h);
    this.controls.maxDistance = this.fit.r * 1.35;
    this.controls.minDistance = Math.max(5, this.fit.r * 0.32);
  }

  // place la caméra immédiatement sur la vue d'ensemble
  snap() {
    this._goal();
    const g = this.goal;
    Object.entries({ th: g.th, ph: g.ph, r: g.r, tx: g.t.x, ty: g.t.y, tz: g.t.z }).forEach(([k, v]) => {
      this.s[k].v = v;
      this.s[k].vel = 0;
    });
    this._apply();
  }

  // reprend la main en partant de la position actuelle de la caméra
  _takeOver() {
    if (!this.manual && !this._fresh) return;
    this.manual = false;
    this._fresh = false;
    const t = this.controls.target;
    this._sph.setFromVector3(this._v.copy(this.camera.position).sub(t));
    const S = this.s;
    S.th.v = this._sph.theta; S.ph.v = this._sph.phi; S.r.v = this._sph.radius;
    S.tx.v = t.x; S.ty.v = t.y; S.tz.v = t.z;
    for (const k in S) S[k].vel = 0;
  }

  // Le joueur actif change : on se place de son côté
  focusSide(side) {
    this._takeOver();
    this.theta = this.sideAngle(side);
    this.mode = 'overview';
    this.follow = null;
  }
  // Un pion se met à avancer : on le suit
  followPawn(obj, side) {
    this._takeOver();
    this.theta = this.sideAngle(side);
    this.mode = 'follow';
    this.follow = obj;
  }
  // Le pion est arrivé : retour à la vue d'ensemble après une courte pause
  release(time, delay = 0.9) {
    if (this.mode === 'follow') this.returnAt = time + delay;
  }
  recenter() {
    this._fresh = true;
    this._takeOver();
    this.mode = 'overview';
    this.follow = null;
  }

  _goal() {
    if (!this.fit || Math.abs(wrap(this.fit.th - this.theta)) > 1e-3) this.fit = this.overview(this.theta, this.w || 1280, this.h || 720);
    const f = this.fit;
    if (this.mode === 'follow' && this.follow) {
      const p = this.follow.position;
      this.goal = { th: this.theta, ph: f.ph - 0.06, r: f.r * 0.7, t: new THREE.Vector3(f.t.x + (p.x - f.t.x) * 0.6, 0, f.t.z + (p.z - f.t.z) * 0.6) };
    } else this.goal = { th: this.theta, ph: f.ph, r: f.r, t: f.t };
  }

  _apply() {
    const S = this.s;
    const t = this.controls.target.set(S.tx.v, S.ty.v, S.tz.v);
    this.camera.position.setFromSphericalCoords(S.r.v, S.ph.v, S.th.v).add(t);
    this.camera.lookAt(t);
  }

  update(dt, time) {
    // garde-fous valables même en mode manuel : on ne perd jamais le plateau
    const t = this.controls.target;
    t.x = THREE.MathUtils.clamp(t.x, -7, 7);
    t.z = THREE.MathUtils.clamp(t.z, -7, 7);
    t.y = THREE.MathUtils.clamp(t.y, -0.5, 2);
    if (this.manual) return;
    if (this.mode === 'follow' && this.returnAt && time >= this.returnAt) {
      this.mode = 'overview';
      this.follow = null;
      this.returnAt = 0;
    }
    this._goal();
    const g = this.goal;
    const S = this.s;
    const w = this.mode === 'follow' ? 3.2 : 2.6;
    S.th.step(S.th.v + wrap(g.th - S.th.v), dt, 2.2);
    S.ph.step(g.ph, dt, w);
    S.r.step(g.r, dt, w);
    S.tx.step(g.t.x, dt, w);
    S.ty.step(g.t.y, dt, w);
    S.tz.step(g.t.z, dt, w);
    this._apply();
  }
}
