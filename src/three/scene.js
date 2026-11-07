import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { TILES } from '../game/board.js';
import { SIZE, CORNER, W, tileCenter, INWARD, tileAt } from './layout.js';
import { makeBoardTexture, DECK_AT } from './boardTexture.js';
import { buildScenery } from './scenery.js';
import { buildPrison, buildScimitar } from './landmarks.js';
import { CameraDirector } from './cameraDirector.js';
import { Fx } from './fx.js';
import { PixelPass, toonify } from './pixelPass.js';
import { buildCharacter, animateRig, buildHouse, buildHotel, buildDie, dieRotationFor } from './characters.js';

const STEP_TIME = 0.24;
const PAWN_SCALE = 0.82;
const easeOut = (t) => 1 - Math.pow(1 - t, 3);

export class GameScene {
  constructor(container, { onTileClick, onDiceLanded, insets } = {}) {
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
    scene.fog = new THREE.Fog('#e9a9cf', 28, 105);

    this.camera = new THREE.PerspectiveCamera(42, 1, 0.5, 160);
    this.camera.position.set(0, 13.5, 12);
    const ctl = (this.controls = new OrbitControls(this.camera, r.domElement));
    ctl.enableDamping = true;
    ctl.dampingFactor = 0.08;
    ctl.minPolarAngle = 0.25;
    ctl.maxPolarAngle = 1.3;
    ctl.minDistance = 6;
    ctl.maxDistance = 34;
    ctl.rotateSpeed = 0.7;
    ctl.zoomSpeed = 0.8;
    ctl.screenSpacePanning = false;
    ctl.target.set(0, 0, 0);
    this.director = new CameraDirector(this.camera, ctl);
    if (insets) Object.assign(this.director.insets, insets);
    this.fx = new Fx(scene, this.camera);
    this._fxQueue = [];
    this._fxNext = 0;
    this._shake = 0;
    this._shakeOff = new THREE.Vector3();

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
      return g;
    };
    this.deckChanceObj = deck(SIZE * (DECK_AT - 0.5), SIZE * (DECK_AT - 0.5), '#7289ff');
    this.deckChestObj = deck(SIZE * (0.5 - DECK_AT), SIZE * (0.5 - DECK_AT), '#ff9a3c');
    this.deckChance = this.deckChanceObj.position.clone();
    this.deckChest = this.deckChestObj.position.clone();

    // Coins en 3D : la Prison islamique et le sabre de la Sanction
    const jt = tileCenter(10);
    this.prison = buildPrison();
    this.prison.position.set(jt.x - 0.2, 0, jt.z - 0.27);
    this.prison.scale.setScalar(1.15);
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

    this.pixel = new PixelPass(r, { targetHeight: 400, near: 0.5, far: 160 });
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
    this.camera.userData.viewH = h;
    this.camera.userData.viewW = w;
    // cadrage : en portrait on recule et on passe plus en vue de dessus pour voir tout le plateau
    const aspect = w / h;
    const portrait = aspect < 1;
    this.camera.fov = this.fovLock || (portrait ? 56 : 60);
    this.camera.updateProjectionMatrix();
    this.director.setSize(w, h);
    if (!this._snapped) {
      this._snapped = true;
      this.director.snap();
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
        z += -0.27 + (Math.floor(k / 2) - (Math.ceil(n / 2) - 1) / 2) * 0.26;
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
    // caméra : au changement de joueur, on se place de son côté
    const cur = state.phase === 'playing' ? players[state.turn] : null;
    if (cur && this._lastTurn !== cur.id) {
      const first = this._lastTurn === undefined;
      this._lastTurn = cur.id;
      this.director.focusSide(tileCenter(cur.pos).side);
      if (!first) this._fxQueue.push({ type: 'turn', player: cur.id, name: cur.name });
      if (first) this.director.snap();
    }
    for (const [id, pw] of this.pawns) {
      if (!alive.has(id)) {
        this.scene.remove(pw.obj);
        this.pawns.delete(id);
      }
    }
    this._updateBuildings(state);
    this._collect(state);
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

  get moving() {
    if (this.diceAnim) return true;
    for (const pw of this.pawns.values()) if (pw.anim || pw.queue.length) return true;
    return false;
  }
  // occupé tant que ça bouge ou qu'un moment de jeu est encore en train de se jouer
  get busy() {
    return this.moving || this._fxQueue.length > 0 || this.timer.getElapsed() < this._fxNext - 0.3;
  }

  tick(dt) {
    const time = this.timer.getElapsed();
    this.camera.position.sub(this._shakeOff);
    this._shakeOff.set(0, 0, 0);
    if (!this.lockCam) this.director.update(dt, time);
    this.controls.update();
    this.scenery.update(time, dt, this.camera);
    // file des moments de jeu : un à la fois, quand plus rien ne bouge
    if (this._fxQueue.length && time >= this._fxNext && !this.moving) {
      const e = this._fxQueue.shift();
      this._fxNext = time + this._play(e, time);
    }
    this.fx.update(dt);
    if (this.deckLift) {
      const d = this.deckLift;
      d.t += dt;
      const obj = d.deck === 'chance' ? this.deckChanceObj : this.deckChestObj;
      const top = obj.children[obj.children.length - 1];
      const u = Math.min(1, d.t / 1.4);
      top.position.y = 0.18 + Math.sin(u * Math.PI) * 0.9;
      top.rotation.z = u * Math.PI * 2;
      if (u >= 1) this.deckLift = null;
    }
    if (this._shake > 0.001) {
      this._shake *= Math.exp(-dt * 5);
      this._shakeOff.set((Math.random() - 0.5) * this._shake, (Math.random() - 0.5) * this._shake, (Math.random() - 0.5) * this._shake);
      this.camera.position.add(this._shakeOff);
    }
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
        this.director.followPawn(o, tileCenter(step.tile).side);
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
          if (!pw.queue.length) {
            this.director.release(time);
            this._onLanded(pw.player);
            this.onLand && this.onLand(pw.player);
          }
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

  // ---------- Mise en scène des événements de la partie ----------
  // Chaque changement (événement du moteur, argent, tour) est mis en file et joué quand les pions
  // ont fini de bouger : on voit l'action dans l'ordre où elle se passe, un moment après l'autre.
  _collect(state) {
    const players = state.players || [];
    const nameOf = (id) => players.find((p) => p.id === id)?.name || '?';
    const cash = {};
    players.forEach((p) => (cash[p.id] = p.cash));
    const evs = state.events || [];
    if (!this._fxReady) {
      this._fxReady = true;
      this._cash = cash;
      this._lastEv = evs.length ? evs[evs.length - 1].id : 0;
      return;
    }
    const diff = {};
    for (const p of players) diff[p.id] = (cash[p.id] ?? 0) - (this._cash[p.id] ?? cash[p.id] ?? 0);
    this._cash = cash;
    const fresh = evs.filter((e) => e.id > this._lastEv);
    if (evs.length) this._lastEv = Math.max(this._lastEv, evs[evs.length - 1].id);
    for (const e of fresh) {
      // l'argent déjà raconté par un événement n'est pas répété en générique
      if (e.type === 'rent') { diff[e.from] += e.amount; diff[e.to] -= e.amount; }
      if (e.type === 'tax') diff[e.player] += e.amount;
      if (e.type === 'go' || e.type === 'pot') diff[e.player] -= e.amount;
      if (e.type === 'buy') diff[e.player] += TILES[e.tile]?.price || 0;
      this._fxQueue.push({ ...e, names: { from: nameOf(e.from), to: nameOf(e.to), player: nameOf(e.player) } });
    }
    for (const id in diff) if (Math.abs(diff[id]) >= 1) this._fxQueue.push({ type: 'money', player: id, amount: diff[id] });
  }

  _pawnPos(id) {
    const pw = this.pawns.get(id);
    return pw ? pw.obj.position.clone() : new THREE.Vector3();
  }
  _colorOf(id) {
    return this.state?.players.find((p) => p.id === id)?.color || '#ffffff';
  }
  _money(amount) {
    return (amount > 0 ? '+' : '−') + Math.abs(Math.round(amount)) + ' €';
  }

  _play(e, time) {
    const fx = this.fx;
    const G = '#3ee07a', R = '#ff4f6a', GOLD = '#ffd23f';
    switch (e.type) {
      case 'money': {
        fx.pop({ text: this._money(e.amount), size: 44, color: e.amount > 0 ? G : R }, this._pawnPos(e.player));
        return 0.5;
      }
      case 'go': {
        const at = new THREE.Vector3(tileCenter(0).x, 0, tileCenter(0).z);
        fx.pop([{ text: 'DÉPART', size: 30, color: '#ffffff' }, { text: '+' + e.amount + ' €', size: 50, color: G }], this._pawnPos(e.player), { dur: 2.4 });
        fx.coins(at, this._pawnPos(e.player), 6);
        fx.shock(at, GOLD);
        return 0.8;
      }
      case 'rent': {
        const from = this._pawnPos(e.from), to = this._pawnPos(e.to);
        const t = tileCenter(e.tile);
        fx.label([{ text: TILES[e.tile].name.toUpperCase(), size: 24, color: '#2a1030', stroke: false }, { text: `Loyer à ${e.names.to}`, size: 22, color: '#7a3a8a', stroke: false }], new THREE.Vector3(t.x, 0, t.z), { dur: 2.6 });
        fx.pop({ text: this._money(-e.amount), size: 48, color: R }, from);
        fx.coins(from, to, Math.min(16, 4 + Math.round(e.amount / 25)), {
          delay: 0.3,
          onArrive: () => {
            fx.pop({ text: this._money(e.amount), size: 48, color: G }, this._pawnPos(e.to), { dur: 1.8 });
            fx.shock(this._pawnPos(e.to), GOLD, 1);
          },
        });
        this.emote(e.from, 'sad', 2.4);
        this.emote(e.to, 'cheer', 2.4);
        // gros loyer : le dragon rugit et la caméra tremble
        if (e.amount >= 150) {
          this.scenery.roar();
          this._shake = 0.25;
        }
        return 1.6;
      }
      case 'tax': {
        const from = this._pawnPos(e.player);
        fx.pop({ text: this._money(-e.amount), size: 48, color: R }, from);
        fx.coins(from, new THREE.Vector3(0, 0, 0), 8, { delay: 0.2 });
        this.emote(e.player, 'sad', 2);
        return 1.2;
      }
      case 'pot': {
        fx.coins(new THREE.Vector3(0, 0, 0), this._pawnPos(e.player), 14);
        fx.pop([{ text: 'CAGNOTTE AFK', size: 28, color: '#ffffff' }, { text: this._money(e.amount), size: 54, color: G }], this._pawnPos(e.player), { delay: 0.8, dur: 2.6 });
        fx.confetti(this._pawnPos(e.player).setY(0.6), [GOLD, '#ffffff', G], 40);
        return 1.8;
      }
      case 'buy': {
        const t = tileCenter(e.tile);
        const at = new THREE.Vector3(t.x, 0.2, t.z);
        const c = this._colorOf(e.player);
        fx.confetti(at, [c, '#ffffff', GOLD], 50);
        fx.shock(at, c, 1.3);
        fx.pop([{ text: 'ACHETÉ !', size: 40, color: '#ffffff', outline: c }, { text: this._money(-(TILES[e.tile].price || 0)), size: 30, color: R }], at, { dur: 2.2 });
        return 1.0;
      }
      case 'build': {
        const t = tileCenter(e.tile);
        const at = new THREE.Vector3(t.x, 0.2, t.z);
        const hotel = this.state?.props?.[e.tile]?.houses === 5;
        fx.confetti(at, [this._colorOf(e.player), '#ffffff'], 26, 0.8);
        fx.shock(at, '#ffffff', 0.9);
        fx.pop({ text: hotel ? 'HÔTEL !' : 'MAISON !', size: 38, color: hotel ? '#ff6b6b' : G }, at, { dur: 1.8 });
        return 0.8;
      }
      case 'jail': {
        // moment fort : la caméra va voir la prison, le dragon rugit
        const jt = this.prison.position.clone();
        this.director.moment(jt, time, 2.6, 0.5);
        this.scenery.roar();
        fx.pop([{ text: 'PRISON', size: 52, color: '#ff4f6a' }, { text: 'ISLAMIQUE', size: 34, color: '#ffffff' }], jt.clone().setY(0.5), { delay: 0.6, dur: 2.4 });
        fx.shock(jt, '#ff4f6a', 1.6);
        this._shake = 0.18;
        this.emote(e.player, 'sad', 2.5);
        return 2.6;
      }
      case 'card': {
        const deckPos = e.deck === 'chance' ? this.deckChance : this.deckChest;
        fx.shock(deckPos, e.deck === 'chance' ? '#7289ff' : '#ff9a3c', 1);
        fx.pop({ text: e.deck === 'chance' ? 'PING @EVERYONE !' : 'GRINTA CORP', size: 34, color: '#ffffff', outline: e.deck === 'chance' ? '#3b4fd0' : '#c25a00' }, deckPos, { dur: 2 });
        this.deckLift = { deck: e.deck, t: 0 };
        return 1.0;
      }
      case 'bankrupt': {
        this.scenery.roar();
        this._shake = 0.3;
        fx.pop([{ text: 'FAILLITE', size: 56, color: '#9aa0b5' }, { text: e.names.player, size: 30, color: '#ffffff' }], this._pawnPos(e.player), { dur: 3 });
        return 2.0;
      }
      case 'win': {
        const at = this._pawnPos(e.player);
        this.director.moment(at, time, 4, 0.45);
        this.scenery.roar();
        const c = this._colorOf(e.player);
        for (let k = 0; k < 4; k++) setTimeout(() => this.fx.confetti(at.clone().setY(0.8), [c, GOLD, '#ffffff', '#ff6fb5'], 60, 1.3), k * 450);
        fx.pop([{ text: e.names.player, size: 40, color: '#ffffff', outline: c }, { text: 'GAGNE LA PARTIE !', size: 50, color: GOLD }], at, { dur: 5, rise: 1.2 });
        return 4;
      }
      case 'turn': {
        const me = e.player === this.meId;
        fx.pop({ text: me ? 'À TOI !' : 'À ' + e.name.toUpperCase(), size: me ? 52 : 40, color: '#ffffff', outline: this._colorOf(e.player) }, this._pawnPos(e.player), { dur: 1.7, rise: 0.5 });
        fx.shock(this._pawnPos(e.player), this._colorOf(e.player), 0.8);
        return 0.4;
      }
      case 'start':
        return 0.2;
    }
    return 0;
  }

  // Le pion du joueur actif vient d'arriver : on affiche ce qu'il y a sur la case
  _onLanded(p) {
    if (!this.state || this.state.phase !== 'playing') return;
    if (this.state.players[this.state.turn]?.id !== p.id) return;
    const i = p.pos;
    const t = TILES[i];
    const at = new THREE.Vector3(tileCenter(i).x, 0, tileCenter(i).z);
    this.fx.shock(at, this._colorOf(p.id), 0.7);
    if (!t.price) return;
    const pr = this.state.props?.[i];
    if (!pr || !pr.owner) {
      const pending = () => this.state?.pending?.type === 'buy' && this.state.pending.tile === i;
      this.fx.label([{ text: t.name.toUpperCase(), size: 24, color: '#2a1030', stroke: false }, { text: `À vendre · ${t.price} €`, size: 26, color: '#c2410c', stroke: false }], at, { hold: () => pending(), dur: 1.5 });
    } else if (pr.owner === p.id) {
      this.fx.label([{ text: t.name.toUpperCase(), size: 22, color: '#2a1030', stroke: false }, { text: 'Chez toi 🏠', size: 22, color: '#0f9a5c', stroke: false }], at, { dur: 1.6 });
    } else if (pr.mortgaged) {
      this.fx.label([{ text: t.name.toUpperCase(), size: 22, color: '#2a1030', stroke: false }, { text: 'Hypothéquée : rien à payer', size: 20, color: '#555', stroke: false }], at, { dur: 2 });
    }
  }

  recenter() {
    this.lockCam = false;
    this.director.recenter();
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
