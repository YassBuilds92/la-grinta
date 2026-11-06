// Multijoueur pair-à-pair via PeerJS : l'hôte fait tourner le moteur, les autres envoient leurs actions.
import Peer from 'peerjs';
import { newGame, addPlayer, applyAction, setConnected, GameError } from '../game/engine.js';

const PREFIX = 'hustlecity-v1-';
const ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';

export function makeCode() {
  let c = '';
  for (let i = 0; i < 5; i++) c += ALPHABET[Math.floor(Math.random() * ALPHABET.length)];
  return c;
}

const store = {
  get(k) {
    try {
      return localStorage.getItem(k);
    } catch {
      return null;
    }
  },
  set(k, v) {
    try {
      localStorage.setItem(k, v);
    } catch {
      /* stockage indisponible */
    }
  },
};

export function getIdentity() {
  let id = store.get('hc-id');
  if (!id) {
    id = 'u' + Math.random().toString(36).slice(2, 10);
    store.set('hc-id', id);
  }
  return { id, name: store.get('hc-name') || '', char: store.get('hc-char') || 'boss' };
}
export function saveIdentity({ name, char }) {
  if (name != null) store.set('hc-name', name);
  if (char) store.set('hc-char', char);
}
export const isHostOf = (code) => store.get('hc-host-' + code) === '1';
export const markHost = (code) => store.set('hc-host-' + code, '1');

const env = import.meta.env || {};
const PEER_OPTS = {
  debug: 0,
  ...(env.VITE_PEER_HOST
    ? { host: env.VITE_PEER_HOST, port: +(env.VITE_PEER_PORT || 443), path: env.VITE_PEER_PATH || '/', secure: env.VITE_PEER_SECURE !== 'false' }
    : {}),
  config: {
    iceServers: [
      { urls: 'stun:stun.l.google.com:19302' },
      { urls: 'stun:stun1.l.google.com:19302' },
      { urls: 'stun:global.stun.twilio.com:3478' },
    ],
  },
};

export class Room {
  constructor({ code, host, me, onState, onError, onStatus }) {
    this.code = code;
    this.host = host;
    this.me = me;
    this.onState = onState;
    this.onError = onError;
    this.onStatus = onStatus;
    this.conns = new Map(); // conn -> playerId
    this.closed = false;
    this.retries = 0;
    if (host) this._startHost();
    else this._startClient();
  }

  // ---------- Hôte ----------
  _startHost() {
    let saved = null;
    try {
      saved = JSON.parse(store.get('hc-state-' + this.code));
    } catch {
      saved = null;
    }
    this.state = saved || newGame();
    // tout le monde est hors-ligne tant qu'il ne s'est pas reconnecté
    this.state.players.forEach((p) => (p.connected = p.id === this.me.id));
    try {
      this.state = addPlayer(this.state, this.me);
    } catch {
      /* partie en cours sans moi : spectateur */
    }
    this._publish();
    this.onStatus('connecting');
    const peer = (this.peer = new Peer(PREFIX + this.code, PEER_OPTS));
    peer.on('open', () => {
      this.retries = 0;
      this.onStatus('online');
    });
    peer.on('connection', (conn) => {
      conn.on('data', (msg) => this._hostOnData(conn, msg));
      conn.on('close', () => this._hostOnClose(conn));
      conn.on('error', () => this._hostOnClose(conn));
    });
    peer.on('disconnected', () => {
      if (!this.closed) setTimeout(() => !this.closed && peer.reconnect(), 1500);
    });
    peer.on('error', (e) => {
      if (e.type === 'unavailable-id' && this.retries++ < 15) {
        // ancien onglet encore enregistré : on réessaie
        this.onStatus('connecting');
        peer.destroy();
        setTimeout(() => !this.closed && this._startHost(), 2500);
      } else if (e.type === 'network' || e.type === 'server-error' || e.type === 'socket-error') {
        this.onStatus('offline');
      } else if (e.type !== 'peer-unavailable') {
        this.onError(String(e.message || e.type));
      }
    });
  }

  _hostOnData(conn, msg) {
    if (!msg || typeof msg !== 'object') return;
    try {
      if (msg.t === 'hello') {
        this.conns.set(conn, msg.id);
        this.state = addPlayer(this.state, { id: msg.id, name: msg.name, char: msg.char });
        this._publish();
      } else if (msg.t === 'act') {
        const pid = this.conns.get(conn);
        if (!pid) return;
        this.state = applyAction(this.state, pid, msg.a, { isHost: false });
        this._publish();
      }
    } catch (e) {
      if (e instanceof GameError) {
        if (msg.t === 'hello') this.conns.set(conn, null);
        conn.send({ t: 'err', msg: e.message });
        if (msg.t === 'hello') conn.send({ t: 'state', s: this.state });
      } else console.error(e);
    }
  }

  _hostOnClose(conn) {
    const pid = this.conns.get(conn);
    this.conns.delete(conn);
    if (pid && ![...this.conns.values()].includes(pid)) {
      this.state = setConnected(this.state, pid, false);
      this._publish();
    }
  }

  _publish() {
    store.set('hc-state-' + this.code, JSON.stringify(this.state));
    this.onState(this.state);
    for (const c of this.conns.keys()) {
      if (c.open) c.send({ t: 'state', s: this.state });
    }
  }

  // ---------- Client ----------
  _startClient() {
    this.onStatus('connecting');
    const peer = (this.peer = new Peer(PEER_OPTS));
    peer.on('open', () => this._connect());
    peer.on('disconnected', () => {
      if (!this.closed) setTimeout(() => !this.closed && peer.reconnect(), 1500);
    });
    peer.on('error', (e) => {
      if (e.type === 'peer-unavailable') {
        this.onStatus('nohost');
        this._retry();
      } else if (e.type === 'network' || e.type === 'server-error' || e.type === 'socket-error') {
        this.onStatus('offline');
        this._retry();
      }
    });
  }
  _retry() {
    clearTimeout(this._rt);
    this._rt = setTimeout(() => {
      if (this.closed) return;
      if (this.peer.disconnected) this.peer.reconnect();
      else this._connect();
    }, 3000);
  }
  _connect() {
    if (this.closed) return;
    const conn = (this.conn = this.peer.connect(PREFIX + this.code, { reliable: true, serialization: 'json' }));
    conn.on('open', () => {
      this.onStatus('online');
      conn.send({ t: 'hello', id: this.me.id, name: this.me.name, char: this.me.char });
    });
    conn.on('data', (msg) => {
      if (msg?.t === 'state') {
        this.state = msg.s;
        this.onState(msg.s);
      } else if (msg?.t === 'err') this.onError(msg.msg);
    });
    conn.on('close', () => {
      if (this.closed) return;
      this.onStatus('reconnecting');
      this._retry();
    });
  }

  // ---------- Actions ----------
  act(a) {
    if (this.host) {
      try {
        this.state = applyAction(this.state, this.me.id, a, { isHost: true });
        this._publish();
      } catch (e) {
        if (e instanceof GameError) this.onError(e.message);
        else console.error(e);
      }
    } else if (this.conn?.open) {
      this.conn.send({ t: 'act', a });
    } else this.onError('Connexion perdue, reconnexion en cours…');
  }

  // L'hôte met à jour son propre pseudo/perso dans le salon
  updateMe(me) {
    this.me = { ...this.me, ...me };
    if (this.host) {
      try {
        this.state = addPlayer(this.state, this.me);
        this._publish();
      } catch {
        /* ignore */
      }
    } else if (this.conn?.open) {
      this.conn.send({ t: 'hello', id: this.me.id, name: this.me.name, char: this.me.char });
    }
  }

  close() {
    this.closed = true;
    clearTimeout(this._rt);
    this.peer?.destroy();
  }
}
