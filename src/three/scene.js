import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { TILES } from '../game/board.js';
import { SIZE, CORNER, W, tileCenter, INWARD, tileAt } from './layout.js';
import { makeBoardTexture, DECK_AT } from './boardTexture.js';
import { buildScenery } from './scenery.js';
import { buildPrison, buildScimitar } from './landmarks.js';
import { PixelPass, toonify } from './pixelPass.js';
import { buildCharacter, animateRig, buildHouse, buildHotel, buildDie, dieRotationFor } from './characters.js';

const STEP_TIME = 0.24;
const PAWN_SCALE = 0.82;
const easeOut = (t) => 1 - Math.pow(1 - t, 3);

export class GameScene {
  constructor(container, { onTileClick, onDiceLanded } = {}) {
    this.container = container;
    this.onTileClick = onTileClick;
    this.onDiceLanded = onDiceLanded;
    this.pawns = new Map();
    this.buildings = new Map();
    this.markers = new Map();
    this.timer = new THREE.Timer();
    this.lastRollId = null;
    this.diceAnim = null;

    const r = (this.renderer = new THREE.WebGLRenderer({ antialias: false, preserveDrawingBuffer: true }));
    r.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    r.shadowMap.enabled = true;
    r.shadowMap.type = THREE.BasicShadowMap;
    r.toneMapping = THREE.ACESFilmicToneMapping;
    r.toneMappingExposure = 1.25;
    container.appendChild(r.domElement);

    const scene = (this.scene = new THREE.Scene());
    // coucher de soleil : ciel pêche → rose → lavande (dessiné par le PixelPass), brume rosée au loin
    scene.background = new THREE.Color('#ffc2b0');
    scene.fog = new THREE.Fog('#f7c0cf', 48, 95);

    this.camera = new THREE.PerspectiveCamera(42, 1, 0.5, 110);
    this.camera.position.set(0, 13.5, 12);
    const ctl = (this.controls = new OrbitControls(this.camera, r.domElement));
    ctl.enableDamping = true;
    ctl.maxPolarAngle = 1.36;
    ctl.minDistance = 5;
    ctl.maxDistance = 34;
    ctl.target.set(0, 0, 1.3);

    // Lumières : soleil doré qui éclaire le plateau de face, ciel lavande en remplissage, contre-jour rose
    scene.add(new THREE.HemisphereLight('#fff2ff', '#ffd2a8', 2.1));
    const sun = (this.sun = new THREE.DirectionalLight('#ffe9cf', 2.7));
    sun.position.set(-5, 14, 9);
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    const sc = sun.shadow.camera;
    sc.left = sc.bottom = -7.6;
    sc.right = sc.top = 7.6;
    sun.shadow.bias = -0.0004;
    sun.shadow.normalBias = 0.02;
    sc.near = 6;
    sc.far = 30;
    scene.add(sun);
    const rim = new THREE.DirectionalLight('#d9a8ff', 1.1);
    rim.position.set(4, 6, -12);
    scene.add(rim);
    const stageGlow = new THREE.PointLight('#ff6fd0', 30, 22, 1.6);
    stageGlow.position.set(13, 5, -5);
    scene.add(stageGlow);

    // Décor
    this.scenery = buildScenery(scene);

    // Plateau
    const tex = (this.boardTex = makeBoardTexture());
    tex.anisotropy = r.capabilities.getMaxAnisotropy();
    const side = new THREE.MeshStandardMaterial({ color: '#4a2a7a', roughness: 0.6 });
    const top = new THREE.MeshStandardMaterial({ map: tex, roughness: 0.75 });
    const board = (this.board = new THREE.Mesh(new THREE.BoxGeometry(SIZE, 0.25, SIZE), [side, side, top, side, side, side]));
    board.position.y = -0.125;
    board.receiveShadow = true;
    scene.add(board);
    // liseré néon
    const edge = new THREE.Mesh(new THREE.BoxGeometry(SIZE + 0.16, 0.1, SIZE + 0.16), new THREE.MeshStandardMaterial({ color: '#ffd04a', emissive: '#ffb020', emissiveIntensity: 0.25 }));
    edge.position.y = -0.2;
    scene.add(edge);

    // Paquets de cartes 3D
    const deck = (x, z, color) => {
      const g = new THREE.Group();
      for (let k = 0; k < 6; k++) {
        const c = new THREE.Mesh(new RoundedBoxGeometry(1.3, 0.03, 0.85, 2, 0.012), new THREE.MeshStandardMaterial({ color: k === 5 ? color : '#fafafa', roughness: 0.5 }));
        c.position.y = 0.02 + k * 0.032;
        c.rotation.y = (Math.random() - 0.5) * 0.08;
        c.castShadow = c.receiveShadow = true;
        g.add(c);
      }
      g.position.set(x, 0, z);
      g.rotation.y = Math.PI / 4;
      scene.add(g);
    };
    deck(SIZE * (DECK_AT - 0.5), SIZE * (DECK_AT - 0.5), '#7289ff');
    deck(SIZE * (0.5 - DECK_AT), SIZE * (0.5 - DECK_AT), '#ff9a3c');

    // Coins en 3D : la Prison islamique et le sabre de la Sanction
    const jt = tileCenter(10);
    this.prison = buildPrison();
    this.prison.position.set(jt.x - 0.2, 0, jt.z - 0.33);
    scene.add(this.prison);
    const st = tileCenter(30);
    this.scimitar = buildScimitar();
    this.scimitar.position.set(st.x - 0.22, 0.55, st.z + 0.22);
    scene.add(this.scimitar);

    // Anneau du joueur actif
    this.activeRing = new THREE.Mesh(new THREE.TorusGeometry(0.32, 0.03, 12, 40), new THREE.MeshStandardMaterial({ color: '#ffd400', emissive: '#ffd400', emissiveIntensity: 2 }));
    this.activeRing.rotation.x = Math.PI / 2;
    this.activeRing.visible = false;
    scene.add(this.activeRing);

    // Survol de case
    this.hover = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0.18, depthWrite: false }));
    this.hover.rotation.x = -Math.PI / 2;
    this.hover.position.y = 0.006;
    this.hover.visible = false;
    scene.add(this.hover);

    // Dés
    this.dice = [buildDie(), buildDie()];
    this.dice.forEach((d, k) => {
      d.position.set(0.1 + k * 0.8, 0.25, 2.75);
      const rot = dieRotationFor(k === 0 ? 5 : 2);
      d.userData.inner.rotation.set(...rot);
      d.rotation.y = 0.3 - k * 0.5;
      scene.add(d);
    });

    // Interactions
    this.raycaster = new THREE.Raycaster();
    this.pointer = new THREE.Vector2();
    let downAt = null;
    r.domElement.addEventListener('pointerdown', (e) => (downAt = [e.clientX, e.clientY]));
    r.domElement.addEventListener('pointermove', (e) => this._hover(e));
    r.domElement.addEventListener('pointerup', (e) => {
      if (!downAt || Math.hypot(e.clientX - downAt[0], e.clientY - downAt[1]) > 6) return;
      const i = this._pick(e);
      if (i >= 0 && this.onTileClick) this.onTileClick(i);
    });

    this.pixel = new PixelPass(r, { targetHeight: 400, near: 0.5, far: 110 });
    toonify(scene);
    this.ro = new ResizeObserver(() => this.resize());
    this.ro.observe(container);
    this.resize();
    this.running = true;
    const loop = () => {
      if (!this.running) return;
      this._raf = requestAnimationFrame(loop);
      this.timer.update();
      this.tick(Math.min(this.timer.getDelta(), 0.05));
    };
    loop();
  }

  _pick(e) {
    const rect = this.renderer.domElement.getBoundingClientRect();
    this.pointer.set(((e.clientX - rect.left) / rect.width) * 2 - 1, -((e.clientY - rect.top) / rect.height) * 2 + 1);
    this.raycaster.setFromCamera(this.pointer, this.camera);
    const hit = this.raycaster.intersectObject(this.board)[0];
    if (!hit) return -1;
    return tileAt(hit.point.x, hit.point.z);
  }
  _hover(e) {
    const i = this._pick(e);
    if (i < 0 || !TILES[i]) {
      this.hover.visible = false;
      this.renderer.domElement.style.cursor = '';
      return;
    }
    const t = tileCenter(i);
    const corner = i % 10 === 0;
    const along = corner ? CORNER : W;
    this.hover.scale.set(t.side % 2 === 0 ? along : CORNER, t.side % 2 === 0 ? CORNER : along, 1);
    this.hover.position.set(t.x, 0.006, t.z);
    this.hover.visible = true;
    this.renderer.domElement.style.cursor = 'pointer';
  }

  resize() {
    const w = this.container.clientWidth || 1, h = this.container.clientHeight || 1;
    this.renderer.setSize(w, h);
    this.pixel?.setSize(w, h);
    this.camera.aspect = w / h;
    // cadrage : en portrait on recule et on passe plus en vue de dessus pour voir tout le plateau
    const aspect = w / h;
    const portrait = aspect < 1;
    this.camera.fov = this.fovLock || (portrait ? 52 : 48);
    this.camera.updateProjectionMatrix();
    if (!this.lockCam && (this._fitAspect === undefined || Math.abs(this._fitAspect - aspect) > 0.05)) {
      this._fitAspect = aspect;
      const half = Math.tan((this.camera.fov * Math.PI) / 360);
      const dist = portrait ? Math.max(22, 7.4 / (half * aspect)) : Math.max(21, 8.2 / (half * aspect));
      const dir = portrait ? new THREE.Vector3(0, 0.66, 0.75).normalize() : new THREE.Vector3(0, 9.5, 19.5).normalize();
      this.controls.target.set(0, 0, portrait ? -5.2 : -2.3);
      this.camera.position.copy(this.controls.target).addScaledVector(dir, dist);
      this.controls.maxDistance = dist * 1.5;
    }
  }

  // Emplacement d'un pion sur une case (plusieurs pions = cercle)
  slot(tile, k, n, inJail) {
    const t = tileCenter(tile);
    const inw = INWARD[t.side];
    let x = t.x, z = t.z;
    if (tile === 10) {
      // Prison islamique : les prisonniers dans la cellule (au fond), les visiteurs à droite de la cellule
      if (inJail) {
        x += -0.2 + ((k % 2) - (Math.min(n, 2) - 1) / 2) * 0.3;
        z += -0.33 + (Math.floor(k / 2) - (Math.ceil(n / 2) - 1) / 2) * 0.26;
      } else {
        x += 0.5;
        z += -0.62 + k * 0.3 - (n > 3 ? (k % 2) * 0.15 : 0);
        x += n > 3 ? (k % 2 ? -0.08 : 0.08) : 0;
      }
      return new THREE.Vector3(x, 0, z);
    } else if (tile % 10 !== 0) {
      x -= inw.x * 0.18;
      z -= inw.z * 0.18;
    }
    if (n > 1) {
      if (tile % 10 === 0) {
        // coin : grille 3 x 3
        const cols = Math.min(3, Math.ceil(Math.sqrt(n)));
        const rows = Math.ceil(n / cols);
        const c = k % cols, r = Math.floor(k / cols);
        x += (c - (cols - 1) / 2) * 0.42;
        z += (r - (rows - 1) / 2) * 0.42;
      } else {
        // case normale : 2 colonnes le long de la case
        const perp = { x: -inw.z, z: inw.x };
        const cols = 2;
        const rows = Math.ceil(n / cols);
        const c = k % cols, r = Math.floor(k / cols);
        const cnt = Math.min(cols, n - r * cols);
        const po = (c - (cnt - 1) / 2) * 0.4;
        const ao = (r - (rows - 1) / 2) * 0.36 - 0.05;
        x += perp.x * po + inw.x * ao;
        z += perp.z * po + inw.z * ao;
      }
    }
    return new THREE.Vector3(x, 0, z);
  }

  update(state) {
    if (!state) return;
    this.state = state;
    const players = state.players || [];
    const alive = new Set();
    // grouper par case
    const byTile = {};
    players.forEach((p) => {
      if (p.bankrupt) return;
      const key = p.pos + (p.inJail ? 'J' : '');
      (byTile[key] ||= []).push(p.id);
    });

    players.forEach((p) => {
      if (p.bankrupt) return;
      alive.add(p.id);
      let pw = this.pawns.get(p.id);
      if (!pw) {
        const obj = buildCharacter(p.char, p.color);
        obj.scale.setScalar(PAWN_SCALE);
        this.scene.add(obj);
        pw = { obj, shown: p.pos, moveId: p.moveId, queue: [], anim: null, slotKey: null };
        obj.position.copy(this._slotFor(p, byTile));
        this.pawns.set(p.id, pw);
      }
      if (pw.moveId !== p.moveId) {
        pw.moveId = p.moveId;
        if (p.moveKind === 'walk') {
          const steps = (p.pos - pw.shown + 40) % 40;
          for (let s = 1; s <= steps; s++) pw.queue.push({ tile: (pw.shown + s) % 40 });
        } else {
          pw.queue.push({ tile: p.pos, jump: true });
        }
        pw.shown = p.pos;
      }
      pw.player = p;
      pw.final = () => this._slotFor(pw.player, this._byTile);
    });
    this._byTile = byTile;
    for (const [id, pw] of this.pawns) {
      if (!alive.has(id)) {
        this.scene.remove(pw.obj);
        this.pawns.delete(id);
      }
    }
    this._updateBuildings(state);
    toonify(this.scene);

    // Dés
    if (state.rollId != null && state.rollId !== this.lastRollId) {
      const first = this.lastRollId === null;
      this.lastRollId = state.rollId;
      if (!first && state.dice) this.rollDice(state.dice);
      else if (state.dice) this._setDice(state.dice);
    }
  }

  _slotFor(p, byTile) {
    const key = p.pos + (p.inJail ? 'J' : '');
    const list = byTile[key] || [p.id];
    const k = Math.max(0, list.indexOf(p.id));
    return this.slot(p.pos, k, list.length, p.inJail);
  }

  _updateBuildings(state) {
    const props = state.props || {};
    const colorOf = (id) => state.players.find((p) => p.id === id)?.color || '#fff';
    for (let i = 0; i < 40; i++) {
      const pr = props[i];
      const key = pr ? `${pr.houses}|${pr.owner}|${pr.mortgaged}` : '';
      const cur = this.buildings.get(i);
      if (cur && cur.key === key) continue;
      if (cur) this.scene.remove(cur.group);
      this.buildings.delete(i);
      if (!pr || !pr.owner) continue;
      const g = new THREE.Group();
      const t = tileCenter(i);
      const inw = INWARD[t.side];
      const perp = { x: -inw.z, z: inw.x };
      // marqueur de propriétaire (jeton)
      const along = i % 10 === 0 ? CORNER : W;
      const chip = new THREE.Mesh(new RoundedBoxGeometry(along * 0.86, 0.04, 0.08, 2, 0.015), new THREE.MeshStandardMaterial({ color: pr.mortgaged ? '#777' : colorOf(pr.owner), metalness: 0.3, roughness: 0.35, emissive: pr.mortgaged ? '#000' : colorOf(pr.owner), emissiveIntensity: 0.25 }));
      chip.position.set(t.x - inw.x * (CORNER / 2 - 0.06), 0.022, t.z - inw.z * (CORNER / 2 - 0.06));
      chip.rotation.y = Math.atan2(inw.x, inw.z);
      chip.castShadow = true;
      g.add(chip);
      if (pr.houses > 0) {
        const bx = t.x + inw.x * (CORNER / 2 - 0.17), bz = t.z + inw.z * (CORNER / 2 - 0.17);
        if (pr.houses === 5) {
          const h = buildHotel();
          h.position.set(bx, 0, bz);
          h.rotation.y = Math.atan2(inw.x, inw.z) + Math.PI;
          g.add(h);
        } else {
          for (let k = 0; k < pr.houses; k++) {
            const h = buildHouse();
            const o = (k - (pr.houses - 1) / 2) * 0.2;
            h.position.set(bx + perp.x * o, 0, bz + perp.z * o);
            h.rotation.y = Math.atan2(inw.x, inw.z) + Math.PI;
            g.add(h);
          }
        }
        g.children.forEach((c) => c.traverse((m) => (m.castShadow = true)));
      }
      // le groupe est centré sur la case : l'apparition grandit sur place
      g.position.set(t.x, 0, t.z);
      g.children.forEach((c) => {
        c.position.x -= t.x;
        c.position.z -= t.z;
      });
      // petite apparition
      g.scale.setScalar(0.01);
      g.userData.pop = 0;
      this.scene.add(g);
      this.buildings.set(i, { key, group: g });
    }
  }

  _setDice([a, b]) {
    [a, b].forEach((v, k) => this.dice[k].userData.inner.rotation.set(...dieRotationFor(v)));
  }

  rollDice(values) {
    const starts = this.dice.map((d, k) => ({
      from: new THREE.Vector3(-2.5 + k * 0.4, 2.4, 1.5 - k * 0.3),
      to: new THREE.Vector3(0.05 + k * 0.9 + (Math.random() - 0.5) * 0.2, 0.25, 2.75 + (Math.random() - 0.5) * 0.3),
      spin: new THREE.Vector3(8 + Math.random() * 6, 6 + Math.random() * 6, 7 + Math.random() * 5),
      yaw: (Math.random() - 0.5) * 1.2,
      final: dieRotationFor(values[k]),
    }));
    this.diceAnim = { t: 0, dur: 1.15, starts };
  }

  emote(playerId, mode, seconds = 2.2) {
    const pw = this.pawns.get(playerId);
    if (pw) pw.emote = { mode, until: this.timer.getElapsed() + seconds };
  }

  get busy() {
    if (this.diceAnim) return true;
    for (const pw of this.pawns.values()) if (pw.anim || pw.queue.length) return true;
    return false;
  }

  tick(dt) {
    const time = this.timer.getElapsed();
    this.controls.update();
    this.scenery.update(time, dt);
    this.prison.userData.update?.(time);
    this.scimitar.userData.update?.(time);

    // Dés
    if (this.diceAnim) {
      const a = this.diceAnim;
      a.t += dt;
      const u = Math.min(a.t / a.dur, 1);
      a.starts.forEach((s, k) => {
        const d = this.dice[k];
        const e = easeOut(u);
        d.position.lerpVectors(s.from, s.to, e);
        // rebonds
        d.position.y = s.to.y + Math.abs(Math.sin(u * Math.PI * 3)) * (1 - u) * 1.6 + (1 - e) * 1.2;
        d.rotation.y = s.yaw;
        const inner = d.userData.inner;
        const rem = 1 - e;
        inner.rotation.set(s.final[0] + s.spin.x * rem, s.final[1] + s.spin.y * rem, s.final[2] + s.spin.z * rem);
      });
      if (u >= 1) {
        this.diceAnim = null;
        this.onDiceLanded && this.onDiceLanded();
      }
    }

    // Pions
    for (const pw of this.pawns.values()) {
      const o = pw.obj;
      const rig = o.userData.rig;
      const S = PAWN_SCALE;
      if (!pw.anim && pw.queue.length && !this.diceAnim) {
        const step = pw.queue.shift();
        const last = pw.queue.length === 0;
        const to = last ? pw.final() : this.slot(step.tile, 0, 1, false);
        pw.anim = { from: o.position.clone(), to, t: 0, dur: step.jump ? 0.85 : STEP_TIME, h: step.jump ? 1.6 : 0.16, jump: !!step.jump };
        this.onStep && !step.jump && this.onStep(step);
      }
      let mode = 'idle';
      let faceDir = null;
      if (pw.anim) {
        const a = pw.anim;
        a.t += dt;
        const u = Math.min(a.t / a.dur, 1);
        const e = a.jump ? u * u * (3 - 2 * u) : u;
        o.position.lerpVectors(a.from, a.to, e);
        o.position.y = Math.sin(u * Math.PI) * a.h;
        const dx = a.to.x - a.from.x, dz = a.to.z - a.from.z;
        if (dx * dx + dz * dz > 0.001) faceDir = Math.atan2(dx, dz);
        mode = a.jump ? 'jump' : 'walk';
        if (u >= 1) {
          pw.anim = null;
          pw.land = 1;
          if (!pw.queue.length) this.onLand && this.onLand(pw.player);
        }
      } else if (!pw.queue.length) {
        const tgt = pw.final ? pw.final() : o.position;
        const k = Math.min(1, dt * 6);
        o.position.x += (tgt.x - o.position.x) * k;
        o.position.z += (tgt.z - o.position.z) * k;
        o.position.y += (0 - o.position.y) * Math.min(1, dt * 14);
        faceDir = Math.atan2(-o.position.x, -o.position.z) + (pw.emote?.mode === 'cheer' ? Math.atan2(this.camera.position.x - o.position.x, this.camera.position.z - o.position.z) - Math.atan2(-o.position.x, -o.position.z) : 0);
        if (pw.emote && time < pw.emote.until) mode = pw.emote.mode;
        else if (this.state?.phase === 'ended' && this.state.winner === pw.player?.id) mode = 'cheer';
      } else mode = 'walk';
      // rotation amortie vers la direction voulue
      if (faceDir !== null) {
        let diff = faceDir - o.rotation.y;
        diff = Math.atan2(Math.sin(diff), Math.cos(diff));
        o.rotation.y += diff * Math.min(1, dt * (mode === 'idle' ? 3 : 12));
      }
      // écrasement à l'atterrissage, avec retour élastique
      pw.land = Math.max(0, (pw.land || 0) - dt * 3.2);
      const l = pw.land;
      const squash = l > 0 ? Math.sin((1 - l) * Math.PI * 2.2) * l * 0.14 : 0;
      const stretch = pw.anim ? Math.sin(Math.min(pw.anim.t / pw.anim.dur, 1) * Math.PI) * (pw.anim.jump ? 0.12 : 0.04) : 0;
      o.scale.set(S * (1 + squash * 0.6 - stretch * 0.5), S * (1 - squash + stretch), S * (1 + squash * 0.6 - stretch * 0.5));
      if (rig) animateRig(rig, time, dt, mode);
    }

    // Anneau actif
    const cur = this.state && this.state.phase === 'playing' && this.pawns.get(this.state.players[this.state.turn]?.id);
    if (cur) {
      this.activeRing.visible = true;
      this.activeRing.position.set(cur.obj.position.x, 0.03, cur.obj.position.z);
      this.activeRing.scale.setScalar(1 + Math.sin(time * 5) * 0.08);
    } else this.activeRing.visible = false;

    // Animation d'apparition des bâtiments
    for (const b of this.buildings.values()) {
      if (b.group.userData.pop < 1) {
        b.group.userData.pop = Math.min(1, b.group.userData.pop + dt * 3);
        const p = b.group.userData.pop;
        b.group.scale.setScalar(1 + Math.sin(p * Math.PI) * 0.3 * (1 - p) + (p - 1) * 0.0001);
      }
    }

    this.pixel.render(this.scene, this.camera);
  }

  dispose() {
    this.running = false;
    cancelAnimationFrame(this._raf);
    this.ro.disconnect();
    this.controls.dispose();
    this.renderer.dispose();
    this.renderer.domElement.remove();
  }
}
