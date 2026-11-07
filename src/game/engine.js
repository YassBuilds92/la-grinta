// Moteur de jeu pur : l'hôte applique les actions et diffuse l'état.
import { TILES, GROUPS, groupTiles, STATION_RENT, CHANCE, CHEST, CHARACTERS } from './board.js';

export const START_CASH = 1500;
export const GO_BONUS = 200;
export const JAIL_FINE = 50;
export const MAX_PLAYERS = 4; // un champion par joueur

const clone = (o) => JSON.parse(JSON.stringify(o));
const rnd = (n) => Math.floor(Math.random() * n);
function shuffle(a) {
  for (let i = a.length - 1; i > 0; i--) {
    const j = rnd(i + 1);
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export function newGame() {
  return {
    phase: 'lobby',
    players: [],
    props: {},
    turn: 0,
    dice: [3, 4],
    rollId: 0,
    rolled: false,
    doubles: 0,
    pending: null, // { type: 'buy', tile }
    trade: null,
    pot: 0,
    log: [],
    ev: 0,
    event: null, // dernier événement visible (carte, loyer…)
    events: [],
    chanceDeck: shuffle(CHANCE.map((_, i) => i)),
    chestDeck: shuffle(CHEST.map((_, i) => i)),
    winner: null,
    settings: { freeParking: true },
  };
}

const playerById = (s, id) => s.players.find((p) => p.id === id);
const nameOf = (s, id) => playerById(s, id)?.name || '?';
const log = (s, text) => {
  s.log.push(text);
  if (s.log.length > 60) s.log.shift();
};
const emit = (s, event) => {
  s.ev++;
  s.event = { id: s.ev, ...event };
  // historique court : la scène 3D rejoue chaque événement, même s'il y en a plusieurs dans la même action
  s.events = [...(s.events || []).slice(-11), s.event];
};

export const current = (s) => s.players[s.turn];
export const alivePlayers = (s) => s.players.filter((p) => !p.bankrupt);

export function ownedIn(s, group, owner) {
  return groupTiles(group).filter((i) => s.props[i]?.owner === owner);
}
export function hasMonopoly(s, group, owner) {
  return groupTiles(group).every((i) => s.props[i]?.owner === owner);
}

export function rentFor(s, tile, diceSum, mult = 1) {
  const t = TILES[tile];
  const pr = s.props[tile];
  if (!pr || !pr.owner || pr.mortgaged) return 0;
  if (t.type === 'prop') {
    if (pr.houses > 0) return t.rents[pr.houses];
    return t.rents[0] * (hasMonopoly(s, t.group, pr.owner) ? 2 : 1);
  }
  if (t.type === 'station') {
    const n = [5, 15, 25, 35].filter((i) => s.props[i]?.owner === pr.owner).length;
    return STATION_RENT[n] * mult;
  }
  if (t.type === 'utility') {
    const both = [12, 28].every((i) => s.props[i]?.owner === pr.owner);
    return diceSum * (mult > 1 ? 10 : both ? 10 : 4);
  }
  return 0;
}

// Paiement : le joueur peut passer en négatif, il devra hypothéquer/vendre ou faire faillite.
function pay(s, fromId, toId, amount, why) {
  const from = playerById(s, fromId);
  from.cash -= amount;
  if (toId) playerById(s, toId).cash += amount;
  else if (why === 'tax' && s.settings.freeParking) s.pot += amount;
  if (from.cash < 0) from.debtTo = toId || null;
}

function moveTo(s, p, dest, { collectGo = true, kind = 'walk' } = {}) {
  if (collectGo && dest < p.pos) {
    p.cash += GO_BONUS;
    log(s, `${p.name} passe par le DÉPART : +${GO_BONUS} €`);
    emit(s, { type: 'go', player: p.id, amount: GO_BONUS });
  }
  p.pos = dest;
  p.moveId++;
  p.moveKind = kind;
}

function sendToJail(s, p) {
  p.pos = 10;
  p.inJail = true;
  p.jailTurns = 0;
  p.moveId++;
  p.moveKind = 'jump';
  s.doubles = 0;
  s.rolled = true;
  log(s, `${p.name} part en Prison islamique 🕌`);
  emit(s, { type: 'jail', player: p.id });
}

function drawCard(s, p, deckName) {
  const key = deckName === 'chance' ? 'chanceDeck' : 'chestDeck';
  const cards = deckName === 'chance' ? CHANCE : CHEST;
  if (!s[key].length) s[key] = shuffle(cards.map((_, i) => i));
  const idx = s[key].shift();
  const c = cards[idx];
  // la carte "libéré" sort du paquet tant qu'elle est gardée
  if (c.kind !== 'jailCard') s[key].push(idx);
  emit(s, { type: 'card', deck: deckName, text: c.text, player: p.id });
  log(s, `${p.name} pioche : « ${c.text} »`);
  switch (c.kind) {
    case 'money':
      if (c.amount >= 0) p.cash += c.amount;
      else pay(s, p.id, null, -c.amount, 'tax');
      break;
    case 'move':
      moveTo(s, p, c.to, { kind: 'walk' });
      landOn(s, p);
      break;
    case 'moveRel':
      p.pos = (p.pos + c.amount + 40) % 40;
      p.moveId++;
      p.moveKind = 'jump';
      landOn(s, p);
      break;
    case 'jail':
      sendToJail(s, p);
      break;
    case 'jailCard':
      p.jailCards.push(deckName);
      break;
    case 'eachPay':
      alivePlayers(s).forEach((o) => o.id !== p.id && pay(s, p.id, o.id, c.amount));
      break;
    case 'eachGet':
      alivePlayers(s).forEach((o) => o.id !== p.id && pay(s, o.id, p.id, c.amount));
      break;
    case 'repairs': {
      let total = 0;
      for (const [i, pr] of Object.entries(s.props)) {
        if (pr.owner !== p.id) continue;
        if (pr.houses === 5) total += c.hotel;
        else total += pr.houses * c.house;
        void i;
      }
      if (total) pay(s, p.id, null, total, 'tax');
      log(s, `${p.name} paie ${total} € de travaux`);
      break;
    }
    case 'nearest': {
      const list = c.what === 'station' ? [5, 15, 25, 35] : [12, 28];
      let dest = list.find((i) => i > p.pos);
      if (dest === undefined) dest = list[0];
      moveTo(s, p, dest, { kind: 'walk' });
      landOn(s, p, 2);
      break;
    }
  }
}

function landOn(s, p, mult = 1) {
  const t = TILES[p.pos];
  const sum = s.dice[0] + s.dice[1];
  if (t.price) {
    const pr = s.props[p.pos];
    if (!pr || !pr.owner) {
      s.pending = { type: 'buy', tile: p.pos };
    } else if (pr.owner !== p.id && !pr.mortgaged) {
      const owner = playerById(s, pr.owner);
      if (owner.bankrupt) return;
      const amount = rentFor(s, p.pos, sum, mult);
      pay(s, p.id, pr.owner, amount);
      log(s, `${p.name} paie ${amount} € de loyer à ${owner.name} (${t.name})`);
      emit(s, { type: 'rent', from: p.id, to: owner.id, amount, tile: p.pos });
    }
    return;
  }
  switch (t.type) {
    case 'tax':
      pay(s, p.id, null, t.amount, 'tax');
      log(s, `${p.name} paie ${t.amount} € (${t.name})`);
      emit(s, { type: 'tax', player: p.id, amount: t.amount });
      break;
    case 'chance':
      drawCard(s, p, 'chance');
      break;
    case 'chest':
      drawCard(s, p, 'chest');
      break;
    case 'gotojail':
      sendToJail(s, p);
      break;
    case 'parking':
      if (s.pot > 0) {
        p.cash += s.pot;
        log(s, `${p.name} ramasse la cagnotte AFK : ${s.pot} € 🤑`);
        emit(s, { type: 'pot', player: p.id, amount: s.pot });
        s.pot = 0;
      }
      break;
  }
}

function nextTurn(s) {
  const n = s.players.length;
  let k = s.turn;
  for (let i = 0; i < n; i++) {
    k = (k + 1) % n;
    if (!s.players[k].bankrupt) break;
  }
  s.turn = k;
  s.rolled = false;
  s.doubles = 0;
  s.pending = null;
  log(s, `C'est au tour de ${s.players[k].name}`);
}

function checkWinner(s) {
  const alive = alivePlayers(s);
  if (alive.length === 1 && s.players.length > 1) {
    s.phase = 'ended';
    s.winner = alive[0].id;
    log(s, `🏆 ${alive[0].name} remporte la partie !`);
    emit(s, { type: 'win', player: alive[0].id });
  }
}

function canTrade(s, tile, owner) {
  const pr = s.props[tile];
  if (!pr || pr.owner !== owner) return false;
  const t = TILES[tile];
  if (t.group && groupTiles(t.group).some((i) => (s.props[i]?.houses || 0) > 0)) return false;
  return true;
}

export class GameError extends Error {}
const fail = (m) => {
  throw new GameError(m);
};

// Ajout d'un joueur dans le salon (côté hôte)
export function addPlayer(state, { id, name, char }) {
  const s = clone(state);
  const existing = playerById(s, id);
  if (existing) {
    existing.connected = true;
    if (s.phase === 'lobby') {
      existing.name = cleanName(name) || existing.name;
      if (char && !s.players.some((p) => p.char === char && p.id !== id)) {
        existing.char = char;
        existing.color = (CHARACTERS.find((c) => c.id === char) || CHARACTERS[0]).color;
      }
    }
    return s;
  }
  if (s.phase !== 'lobby') fail('La partie a déjà commencé');
  if (s.players.length >= MAX_PLAYERS) fail(`Salon plein (${MAX_PLAYERS} max)`);
  const taken = new Set(s.players.map((p) => p.char));
  const c = CHARACTERS.find((c) => c.id === char && !taken.has(c.id)) || CHARACTERS.find((c) => !taken.has(c.id));
  s.players.push({
    id,
    name: cleanName(name) || 'Joueur ' + (s.players.length + 1),
    char: c.id,
    color: c.color,
    cash: START_CASH,
    pos: 0,
    inJail: false,
    jailTurns: 0,
    jailCards: [],
    bankrupt: false,
    connected: true,
    moveId: 0,
    moveKind: 'jump',
    debtTo: null,
  });
  log(s, `${s.players.at(-1).name} rejoint la partie`);
  return s;
}
const cleanName = (n) => String(n || '').trim().slice(0, 16);

export function setConnected(state, id, connected) {
  const s = clone(state);
  const p = playerById(s, id);
  if (!p) return state;
  p.connected = connected;
  if (s.phase === 'lobby' && !connected) {
    s.players = s.players.filter((x) => x.id !== id);
  }
  return s;
}

// Applique une action d'un joueur. Lève GameError si invalide.
export function applyAction(state, actorId, a, { isHost = false } = {}) {
  const s = clone(state);
  const me = playerById(s, actorId);
  const cur = current(s);
  const myTurn = cur && cur.id === actorId && s.phase === 'playing';

  switch (a.type) {
    case 'start': {
      if (!isHost) fail("Seul l'hôte peut lancer la partie");
      if (s.phase !== 'lobby') fail('Déjà lancée');
      if (s.players.length < 2) fail('Il faut au moins 2 joueurs');
      shuffle(s.players);
      s.phase = 'playing';
      s.turn = 0;
      s.settings.freeParking = a.freeParking !== false;
      log(s, `🎲 La partie commence ! ${s.players[0].name} ouvre le bal.`);
      emit(s, { type: 'start' });
      return s;
    }
    case 'kick': {
      if (!isHost) fail("Seul l'hôte peut faire ça");
      const p = playerById(s, a.id);
      if (!p) return s;
      if (s.phase === 'lobby') s.players = s.players.filter((x) => x.id !== a.id);
      else return bankrupt(s, p, true);
      return s;
    }
  }

  if (!me) fail('Joueur inconnu');
  if (s.phase !== 'playing') fail("La partie n'est pas en cours");
  if (me.bankrupt) fail('Tu es en faillite');

  switch (a.type) {
    case 'roll': {
      if (!myTurn) fail("C'est pas ton tour");
      if (s.rolled) fail('Déjà lancé');
      if (s.pending) fail('Décide d\'abord pour la case');
      if (me.cash < 0) fail('Rembourse tes dettes avant de jouer');
      const d1 = 1 + rnd(6), d2 = 1 + rnd(6);
      s.dice = [d1, d2];
      s.rollId++;
      const dbl = d1 === d2;
      emit(s, { type: 'roll', player: me.id, dice: [d1, d2] });
      log(s, `${me.name} fait ${d1} + ${d2}${dbl ? ' (double !)' : ''}`);
      if (me.inJail) {
        if (dbl) {
          me.inJail = false;
          me.jailTurns = 0;
          log(s, `${me.name} sort de prison grâce au double`);
          moveTo(s, me, (me.pos + d1 + d2) % 40);
          s.rolled = true;
          landOn(s, me);
        } else {
          me.jailTurns++;
          if (me.jailTurns >= 3) {
            pay(s, me.id, null, JAIL_FINE, 'tax');
            me.inJail = false;
            me.jailTurns = 0;
            log(s, `${me.name} paie ${JAIL_FINE} € de caution et sort`);
            moveTo(s, me, (me.pos + d1 + d2) % 40);
            landOn(s, me);
          }
          s.rolled = true;
        }
        return s;
      }
      if (dbl) {
        s.doubles++;
        if (s.doubles >= 3) {
          log(s, `Trois doubles de suite… suspect 👀`);
          sendToJail(s, me);
          return s;
        }
      }
      moveTo(s, me, (me.pos + d1 + d2) % 40);
      s.rolled = !dbl;
      landOn(s, me);
      if (me.inJail) s.rolled = true;
      return s;
    }
    case 'buy': {
      if (!myTurn || !s.pending || s.pending.type !== 'buy') fail('Rien à acheter');
      const t = TILES[s.pending.tile];
      if (me.cash < t.price) fail("T'as pas assez de thunes");
      me.cash -= t.price;
      s.props[s.pending.tile] = { owner: me.id, houses: 0, mortgaged: false };
      log(s, `${me.name} achète ${t.name} pour ${t.price} €`);
      emit(s, { type: 'buy', player: me.id, tile: s.pending.tile });
      s.pending = null;
      return s;
    }
    case 'decline': {
      if (!myTurn || !s.pending) fail('Rien à refuser');
      log(s, `${me.name} laisse passer ${TILES[s.pending.tile].name}`);
      s.pending = null;
      return s;
    }
    case 'endTurn': {
      if (!myTurn) fail("C'est pas ton tour");
      if (!s.rolled) fail('Lance les dés d\'abord');
      if (s.pending) fail('Décide d\'abord pour la case');
      if (me.cash < 0) fail('Tu es dans le rouge : hypothèque, vends ou déclare faillite');
      nextTurn(s);
      return s;
    }
    case 'payJail': {
      if (!myTurn || !me.inJail || s.rolled) fail('Impossible maintenant');
      if (me.cash < JAIL_FINE) fail('Pas assez de thunes');
      pay(s, me.id, null, JAIL_FINE, 'tax');
      me.inJail = false;
      me.jailTurns = 0;
      log(s, `${me.name} paie sa caution (${JAIL_FINE} €)`);
      return s;
    }
    case 'jailCard': {
      if (!myTurn || !me.inJail || s.rolled || !me.jailCards.length) fail('Impossible maintenant');
      const deck = me.jailCards.pop();
      const key = deck === 'chance' ? 'chanceDeck' : 'chestDeck';
      const cards = deck === 'chance' ? CHANCE : CHEST;
      s[key].push(cards.findIndex((c) => c.kind === 'jailCard'));
      me.inJail = false;
      me.jailTurns = 0;
      log(s, `${me.name} utilise sa carte « Unmute »`);
      return s;
    }
    case 'build': {
      const t = TILES[a.tile];
      const pr = s.props[a.tile];
      if (!pr || pr.owner !== me.id || t.type !== 'prop') fail("C'est pas à toi");
      if (!hasMonopoly(s, t.group, me.id)) fail('Il te faut tout le quartier');
      const tiles = groupTiles(t.group);
      if (tiles.some((i) => s.props[i].mortgaged)) fail('Un terrain du quartier est hypothéqué');
      if (pr.houses >= 5) fail('Déjà un hôtel');
      const min = Math.min(...tiles.map((i) => s.props[i].houses));
      if (pr.houses > min) fail('Construis équitablement sur le quartier');
      const cost = GROUPS[t.group].houseCost;
      if (me.cash < cost) fail('Pas assez de thunes');
      me.cash -= cost;
      pr.houses++;
      log(s, `${me.name} construit ${pr.houses === 5 ? 'un hôtel' : 'une maison'} sur ${t.name}`);
      emit(s, { type: 'build', player: me.id, tile: a.tile });
      return s;
    }
    case 'sell': {
      const t = TILES[a.tile];
      const pr = s.props[a.tile];
      if (!pr || pr.owner !== me.id || !pr.houses) fail('Rien à vendre');
      const tiles = groupTiles(t.group);
      const max = Math.max(...tiles.map((i) => s.props[i].houses));
      if (pr.houses < max) fail('Vends équitablement sur le quartier');
      const refund = GROUPS[t.group].houseCost / 2;
      pr.houses--;
      me.cash += refund;
      log(s, `${me.name} revend un bâtiment sur ${t.name} (+${refund} €)`);
      return s;
    }
    case 'mortgage': {
      const t = TILES[a.tile];
      const pr = s.props[a.tile];
      if (!pr || pr.owner !== me.id || pr.mortgaged) fail('Impossible');
      if (t.group && groupTiles(t.group).some((i) => (s.props[i]?.houses || 0) > 0)) fail("Vends d'abord les maisons du quartier");
      pr.mortgaged = true;
      me.cash += t.price / 2;
      log(s, `${me.name} hypothèque ${t.name} (+${t.price / 2} €)`);
      return s;
    }
    case 'unmortgage': {
      const t = TILES[a.tile];
      const pr = s.props[a.tile];
      if (!pr || pr.owner !== me.id || !pr.mortgaged) fail('Impossible');
      const cost = Math.ceil((t.price / 2) * 1.1);
      if (me.cash < cost) fail('Pas assez de thunes');
      me.cash -= cost;
      pr.mortgaged = false;
      log(s, `${me.name} lève l'hypothèque de ${t.name} (-${cost} €)`);
      return s;
    }
    case 'bankrupt':
      return bankrupt(s, me, false);
    case 'proposeTrade': {
      if (s.trade) fail('Un échange est déjà en cours');
      const other = playerById(s, a.to);
      if (!other || other.bankrupt || other.id === me.id) fail('Joueur invalide');
      const give = a.give || { props: [], cash: 0 };
      const get = a.get || { props: [], cash: 0 };
      give.cash = Math.max(0, Math.floor(+give.cash || 0));
      get.cash = Math.max(0, Math.floor(+get.cash || 0));
      if (give.props.some((i) => !canTrade(s, i, me.id))) fail('Tu ne peux pas échanger ces terrains (maisons dessus ?)');
      if (get.props.some((i) => !canTrade(s, i, other.id))) fail('Ces terrains ne sont pas échangeables');
      if (!give.props.length && !get.props.length && !give.cash && !get.cash) fail('Échange vide');
      if (give.cash > Math.max(0, me.cash)) fail("T'as pas cette somme");
      s.trade = { id: s.ev + 1, from: me.id, to: other.id, give, get };
      log(s, `${me.name} propose un échange à ${other.name}`);
      emit(s, { type: 'trade', from: me.id, to: other.id });
      return s;
    }
    case 'acceptTrade': {
      const tr = s.trade;
      if (!tr || tr.to !== me.id) fail('Aucun échange pour toi');
      const from = playerById(s, tr.from);
      if (tr.give.props.some((i) => !canTrade(s, i, from.id)) || tr.get.props.some((i) => !canTrade(s, i, me.id))) {
        s.trade = null;
        fail("L'échange n'est plus valable");
      }
      if (tr.give.cash > Math.max(0, from.cash) || tr.get.cash > Math.max(0, me.cash)) fail("Pas assez d'argent pour cet échange");
      tr.give.props.forEach((i) => (s.props[i].owner = me.id));
      tr.get.props.forEach((i) => (s.props[i].owner = from.id));
      from.cash += tr.get.cash - tr.give.cash;
      me.cash += tr.give.cash - tr.get.cash;
      log(s, `🤝 Échange conclu entre ${from.name} et ${me.name}`);
      emit(s, { type: 'tradeDone', from: from.id, to: me.id });
      s.trade = null;
      return s;
    }
    case 'rejectTrade': {
      const tr = s.trade;
      if (!tr || (tr.to !== me.id && tr.from !== me.id)) fail('Aucun échange');
      log(s, tr.from === me.id ? `${me.name} annule sa proposition` : `${me.name} refuse l'échange`);
      s.trade = null;
      return s;
    }
  }
  fail('Action inconnue');
}

function bankrupt(s, p, kicked) {
  for (const [i, pr] of Object.entries(s.props)) {
    if (pr.owner === p.id) delete s.props[i];
  }
  p.bankrupt = true;
  p.cash = 0;
  p.inJail = false;
  if (s.trade && (s.trade.from === p.id || s.trade.to === p.id)) s.trade = null;
  log(s, kicked ? `${p.name} a été retiré de la partie` : `💀 ${p.name} fait faillite ! Ses biens retournent à la banque.`);
  emit(s, { type: 'bankrupt', player: p.id });
  const wasTurn = current(s).id === p.id;
  checkWinner(s);
  if (s.phase === 'playing' && wasTurn) nextTurn(s);
  return s;
}

export function netWorth(s, p) {
  let w = p.cash;
  for (const [i, pr] of Object.entries(s.props)) {
    if (pr.owner !== p.id) continue;
    const t = TILES[i];
    w += pr.mortgaged ? t.price / 2 : t.price;
    if (t.group) w += pr.houses * GROUPS[t.group].houseCost;
  }
  return w;
}
