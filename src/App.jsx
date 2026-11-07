import { useEffect, useMemo, useRef, useState, useCallback } from 'react';
import { TILES, GROUPS, CHARACTERS, groupTiles, STATION_RENT } from './game/board.js';
import { hasMonopoly, JAIL_FINE, netWorth } from './game/engine.js';
import { Room, makeCode, getIdentity, saveIdentity, isHostOf, markHost } from './net/room.js';
import { GameScene } from './three/scene.js';
import { loadFonts } from './three/boardTexture.js';
import { sfx, unlockAudio, isMuted, setMuted } from './audio.js';
import CharPreview from './ui/CharPreview.jsx';

const money = (n) => `${n < 0 ? '-' : ''}${Math.abs(n).toLocaleString('fr-FR')} €`;
const charName = (id) => CHARACTERS.find((c) => c.id === id)?.name || '';

function roomFromUrl() {
  const p = new URLSearchParams(location.search);
  return (p.get('r') || '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 5) || null;
}

export default function App() {
  const [me, setMe] = useState(getIdentity);
  const [room, setRoom] = useState(null); // { code, host }
  const urlCode = useMemo(roomFromUrl, []);

  const enter = (code, host) => {
    if (host) markHost(code);
    history.replaceState(null, '', '?r=' + code);
    unlockAudio();
    setRoom({ code, host: host || isHostOf(code) });
  };
  const leave = () => {
    history.replaceState(null, '', location.pathname);
    setRoom(null);
  };

  if (!room) return <Home me={me} setMe={setMe} urlCode={urlCode} onEnter={enter} />;
  return <Game key={room.code} code={room.code} host={room.host} me={me} setMe={setMe} onLeave={leave} />;
}

/* ===================== Accueil ===================== */
function CharPicker({ value, onChange, taken = [] }) {
  return (
    <div className="char-grid">
      {CHARACTERS.map((c) => {
        const dis = taken.includes(c.id) && c.id !== value;
        return (
          <button key={c.id} className={'char-btn' + (c.id === value ? ' on' : '')} disabled={dis} onClick={() => onChange(c.id)} style={{ '--c': c.color }}>
            <span className="dot" />
            {c.name}
          </button>
        );
      })}
    </div>
  );
}

function Home({ me, setMe, urlCode, onEnter }) {
  const [code, setCode] = useState(urlCode || '');
  const update = (patch) => {
    const next = { ...me, ...patch };
    setMe(next);
    saveIdentity(next);
  };
  const ok = me.name.trim().length > 0;
  return (
    <div className="home">
      <div className="home-bg" />
      <div className="home-card">
        <h1 className="logo">
          LA <span>GRINTA</span>
        </h1>
        <p className="tag">Le jeu de plateau du serveur. Achète, construis, encaisse.</p>
        <div className="home-grid">
          <CharPreview char={me.char} size={200} />
          <div className="home-form">
            <label>Ton blaze</label>
            <input value={me.name} maxLength={16} placeholder="Ex : Yassine" onChange={(e) => update({ name: e.target.value })} autoFocus />
            <label>Ton perso</label>
            <CharPicker value={me.char} onChange={(char) => update({ char })} />
          </div>
        </div>
        {urlCode ? (
          <button className="btn big primary" disabled={!ok} onClick={() => onEnter(urlCode, false)}>
            Rejoindre la partie {urlCode}
          </button>
        ) : (
          <>
            <button className="btn big primary" disabled={!ok} onClick={() => onEnter(makeCode(), true)}>
              Créer une partie
            </button>
            <div className="join-row">
              <input value={code} placeholder="CODE" maxLength={5} onChange={(e) => setCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ''))} />
              <button className="btn" disabled={!ok || code.length !== 5} onClick={() => onEnter(code, false)}>
                Rejoindre
              </button>
            </div>
          </>
        )}
        {!ok && <p className="hint">Mets ton blaze pour jouer 😉</p>}
      </div>
    </div>
  );
}

/* ===================== Partie ===================== */
function Game({ code, host, me, setMe, onLeave }) {
  const [state, setState] = useState(null);
  const [status, setStatus] = useState('connecting');
  const [toasts, setToasts] = useState([]);
  const [settled, setSettled] = useState(true);
  const [tile, setTile] = useState(null);
  const [panel, setPanel] = useState(null); // 'props' | 'log' | null
  const [tradeWith, setTradeWith] = useState(null);
  const [cardShown, setCardShown] = useState(null);
  const [muted, setMutedState] = useState(isMuted());
  const roomRef = useRef(null);
  const sceneRef = useRef(null);
  const boxRef = useRef(null);
  const lastEv = useRef(null);
  const lastTurn = useRef(null);
  const emotes = useRef([]);
  const emote = (id, mode, sec) => id && emotes.current.push([id, mode, sec]);

  const toast = useCallback((text, kind = 'info') => {
    const id = Math.random();
    setToasts((t) => [...t.slice(-3), { id, text, kind }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 3800);
  }, []);

  // Réseau
  useEffect(() => {
    const r = new Room({
      code,
      host,
      me,
      onState: setState,
      onStatus: setStatus,
      onError: (m) => {
        sfx.error();
        toast(m, 'error');
      },
    });
    roomRef.current = r;
    return () => r.close();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [code, host]);

  // Scène 3D
  useEffect(() => {
    let sc;
    let alive = true;
    loadFonts().then(() => {
      if (!alive) return;
      sc = new GameScene(boxRef.current, {
        onTileClick: (i) => setTile(i),
      });
      sc.onStep = () => sfx.step();
      sceneRef.current = sc;
      if (roomRef.current?.state) sc.update(roomRef.current.state);
    });
    const iv = setInterval(() => sceneRef.current && setSettled(!sceneRef.current.busy), 120);
    return () => {
      alive = false;
      clearInterval(iv);
      sc?.dispose();
      sceneRef.current = null;
    };
  }, []);

  useEffect(() => {
    if (state) sceneRef.current?.update(state);
  }, [state]);

  const mine = state?.players.find((p) => p.id === me.id);
  const cur = state?.players[state.turn];
  const myTurn = state?.phase === 'playing' && cur?.id === me.id;

  // Sons + événements
  useEffect(() => {
    if (!state?.event) return;
    if (lastEv.current === null) {
      lastEv.current = state.event.id;
      return;
    }
    if (state.event.id === lastEv.current) return;
    lastEv.current = state.event.id;
    const e = state.event;
    const name = (id) => state.players.find((p) => p.id === id)?.name;
    switch (e.type) {
      case 'roll':
        sfx.dice();
        break;
      case 'buy':
        setTimeout(() => sfx.buy(), 50);
        emote(e.player, 'cheer', 2);
        break;
      case 'rent':
        emote(e.from, 'sad', 2.4);
        emote(e.to, 'cheer', 2.4);
        setTimeout(() => (e.to === me.id ? sfx.cash() : sfx.pay()), 1400);
        if (e.from === me.id || e.to === me.id) setTimeout(() => toast(`${name(e.from)} → ${name(e.to)} : ${money(e.amount)} de loyer`, e.to === me.id ? 'good' : 'bad'), 1400);
        break;
      case 'card':
        setCardShown({ ...e, at: Date.now() });
        break;
      case 'jail':
        emote(e.player, 'sad', 2.5);
        setTimeout(() => sfx.jail(), 900);
        break;
      case 'build':
        sfx.build();
        emote(e.player, 'cheer', 1.6);
        break;
      case 'pot':
        emote(e.player, 'cheer', 2.5);
        setTimeout(() => sfx.cash(), 1300);
        toast(`${name(e.player)} ramasse la cagnotte : ${money(e.amount)} 🤑`, 'good');
        break;
      case 'trade':
        if (e.to === me.id) {
          sfx.turn();
          toast(`${name(e.from)} te propose un échange 🤝`, 'good');
        }
        break;
      case 'tradeDone':
        sfx.cash();
        emote(e.from, 'cheer', 1.6);
        emote(e.to, 'cheer', 1.6);
        break;
      case 'bankrupt':
        emote(e.player, 'sad', 3);
        sfx.bankrupt();
        toast(`💀 ${name(e.player)} fait faillite`, 'bad');
        break;
      case 'tax':
        emote(e.player, 'sad', 2);
        break;
      case 'win':
        sfx.win();
        break;
      case 'start':
        sfx.turn();
        break;
    }
  }, [state, me.id, toast]);

  useEffect(() => {
    if (!state || state.phase !== 'playing') return;
    const key = state.turn + ':' + state.log.length;
    if (lastTurn.current !== state.turn) {
      if (lastTurn.current !== null && myTurn) setTimeout(() => sfx.turn(), 300);
      lastTurn.current = state.turn;
    }
    void key;
  }, [state, myTurn]);

  useEffect(() => {
    if (!settled || !sceneRef.current) return;
    emotes.current.splice(0).forEach(([id, m, sec]) => sceneRef.current.emote(id, m, sec));
  });

  // la carte reste affichée quelques secondes après l'arrivée du pion
  useEffect(() => {
    if (!cardShown || !settled) return;
    sfx.card();
    const t = setTimeout(() => setCardShown(null), 3800);
    return () => clearTimeout(t);
  }, [cardShown, settled]);

  const act = (a) => {
    unlockAudio();
    roomRef.current?.act(a);
  };

  const link = `${location.origin}${location.pathname}?r=${code}`;

  return (
    <div className="game">
      <div className="scene" ref={boxRef} />
      {!state ? (
        <div className="center-msg">
          <div className="spinner" />
          {statusText(status, host)}
        </div>
      ) : (
        <>
          <TopBar state={state} me={me} status={status} host={host} muted={muted} onMute={() => { setMuted(!muted); setMutedState(!muted); }} onLeave={onLeave} onPlayer={(p) => p.id !== me.id && mine && !mine.bankrupt && state.phase === 'playing' && setTradeWith(p.id)} />
          {state.phase === 'lobby' && (
            <Lobby state={state} me={me} host={host} link={link} code={code} onStart={(o) => act({ type: 'start', ...o })} onKick={(id) => act({ type: 'kick', id })}
              onChange={(patch) => { const next = { ...me, ...patch }; setMe(next); saveIdentity(next); roomRef.current.updateMe(next); }} />
          )}
          {state.phase === 'playing' && (
            <>
              <ActionBar state={state} me={me} mine={mine} cur={cur} myTurn={myTurn} settled={settled} act={act} onPanel={setPanel} />
              {myTurn && settled && state.pending?.type === 'buy' && !cardShown && <BuyModal state={state} tile={state.pending.tile} mine={mine} act={act} />}
              {state.trade && (state.trade.to === me.id || state.trade.from === me.id) && <TradeView state={state} me={me} act={act} />}
            </>
          )}
          {panel && <SidePanel state={state} me={me} panel={panel} setPanel={setPanel} act={act} onTile={setTile} />}
          {tile !== null && <TileModal state={state} tile={tile} me={me} act={act} onClose={() => setTile(null)} />}
          {tradeWith && <TradeBuilder state={state} me={me} other={tradeWith} act={act} onClose={() => setTradeWith(null)} />}
          {cardShown && settled && <CardPopup ev={cardShown} state={state} onClose={() => setCardShown(null)} />}
          {state.phase === 'ended' && <Winner state={state} onLeave={onLeave} />}
          <div className="toasts">
            {toasts.map((t) => (
              <div key={t.id} className={'toast ' + t.kind}>
                {t.text}
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

function statusText(status, host) {
  if (status === 'nohost') return "Partie introuvable… l'hôte est peut-être pas encore connecté. On réessaie.";
  if (status === 'offline') return 'Pas de connexion au serveur, on réessaie…';
  if (host) return 'Ouverture du salon…';
  return 'Connexion à la partie…';
}

/* ---------- Barre du haut : joueurs ---------- */
function TopBar({ state, me, status, host, muted, onMute, onLeave, onPlayer }) {
  return (
    <div className="topbar">
      <div className="players">
        {state.players.map((p, i) => {
          const isTurn = state.phase === 'playing' && i === state.turn;
          return (
            <button key={p.id} className={'pcard' + (isTurn ? ' turn' : '') + (p.bankrupt ? ' out' : '') + (p.id === me.id ? ' me' : '')} style={{ '--c': p.color }} onClick={() => onPlayer(p)} title={p.id !== me.id ? 'Proposer un échange' : ''}>
              <span className="avatar">{p.name.slice(0, 1).toUpperCase()}</span>
              <span className="pinfo">
                <span className="pname">
                  {p.name}
                  {p.id === me.id && ' (toi)'}
                  {!p.connected && <span title="Déconnecté"> 📴</span>}
                  {p.inJail && <span title="En prison"> 🕌</span>}
                </span>
                <span className={'pcash' + (p.cash < 0 ? ' neg' : '')}>{p.bankrupt ? 'Faillite' : money(p.cash)}</span>
              </span>
            </button>
          );
        })}
      </div>
      <div className="top-actions">
        {state.pot > 0 && <span className="pot" title="Cagnotte de la case AFK">💤 {money(state.pot)}</span>}
        {status !== 'online' && <span className="net-badge">{status === 'reconnecting' || status === 'connecting' ? 'Reconnexion…' : 'Hors ligne'}</span>}
        {host && <span className="host-badge">Hôte</span>}
        <button className="icon-btn" onClick={onMute} title="Son">
          {muted ? '🔇' : '🔊'}
        </button>
        <button className="icon-btn" onClick={() => confirm('Quitter la partie ?') && onLeave()} title="Quitter">
          ✕
        </button>
      </div>
    </div>
  );
}

/* ---------- Salon ---------- */
function Lobby({ state, me, host, link, code, onStart, onKick, onChange }) {
  const [copied, setCopied] = useState(false);
  const [freeParking, setFreeParking] = useState(true);
  const my = state.players.find((p) => p.id === me.id);
  const share = async () => {
    try {
      if (navigator.share) await navigator.share({ title: 'La Grinta', text: 'Viens jouer à La Grinta !', url: link });
      else {
        await navigator.clipboard.writeText(link);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      }
    } catch {
      /* annulé */
    }
  };
  return (
    <div className="modal-wrap lobby-wrap">
      <div className="modal lobby">
        <h2>Salon {code}</h2>
        <p className="muted">Envoie le lien à tes potes, ils arrivent direct dans la partie.</p>
        <div className="invite">
          <input readOnly value={link} onFocus={(e) => e.target.select()} />
          <button className="btn primary" onClick={share}>
            {copied ? 'Copié ✓' : navigator.share ? 'Partager' : 'Copier'}
          </button>
        </div>
        <div className="lobby-grid">
          <div>
            <h3>Joueurs ({state.players.length}/8)</h3>
            <ul className="lobby-players">
              {state.players.map((p) => (
                <li key={p.id} style={{ '--c': p.color }}>
                  <span className="dot" />
                  <b>{p.name}</b> <span className="muted">· {charName(p.char)}</span>
                  {p.id === me.id && <span className="muted"> (toi)</span>}
                  {host && p.id !== me.id && (
                    <button className="mini" onClick={() => onKick(p.id)}>
                      retirer
                    </button>
                  )}
                </li>
              ))}
            </ul>
          </div>
          {my && (
            <div className="lobby-me">
              <CharPreview char={my.char} size={130} />
              <CharPicker value={my.char} taken={state.players.map((p) => p.char)} onChange={(char) => onChange({ char })} />
            </div>
          )}
        </div>
        {host ? (
          <>
            <label className="check">
              <input type="checkbox" checked={freeParking} onChange={(e) => setFreeParking(e.target.checked)} /> Les taxes vont dans la cagnotte de la case « AFK »
            </label>
            <button className="btn big primary" disabled={state.players.length < 2} onClick={() => onStart({ freeParking })}>
              {state.players.length < 2 ? 'Il faut au moins 2 joueurs' : 'Lancer la partie 🎲'}
            </button>
          </>
        ) : (
          <p className="waiting">En attente que l'hôte lance la partie…</p>
        )}
      </div>
    </div>
  );
}

/* ---------- Barre d'actions ---------- */
function ActionBar({ state, mine, cur, myTurn, settled, act, onPanel }) {
  const canRoll = myTurn && !state.rolled && !state.pending && mine.cash >= 0;
  const canEnd = myTurn && state.rolled && !state.pending && mine.cash >= 0;
  const inJail = myTurn && mine.inJail && !state.rolled;
  const busy = !settled;
  return (
    <div className="actionbar">
      <div className="turn-label" style={{ '--c': cur.color }}>
        {myTurn ? <b>À toi de jouer !</b> : <>Tour de <b>{cur.name}</b></>}
        <span className="dice-val">
          🎲 {state.dice[0]} + {state.dice[1]}
        </span>
      </div>
      {mine && !mine.bankrupt && mine.cash < 0 && (
        <div className="debt">
          T'es dans le rouge ({money(mine.cash)}). Vends des maisons ou hypothèque dans « Mes biens », sinon faillite.
          <button className="mini danger" onClick={() => confirm('Déclarer faillite ? Tu sors de la partie.') && act({ type: 'bankrupt' })}>
            Faillite
          </button>
        </div>
      )}
      <div className="actions">
        {inJail && (
          <>
            <button className="btn" disabled={busy || mine.cash < JAIL_FINE} onClick={() => act({ type: 'payJail' })}>
              Payer {JAIL_FINE} € de caution
            </button>
            {mine.jailCards.length > 0 && (
              <button className="btn" disabled={busy} onClick={() => act({ type: 'jailCard' })}>
                Utiliser « Unmute »
              </button>
            )}
          </>
        )}
        {myTurn && (
          <button className={'btn big primary' + (canRoll && !busy ? ' pulse' : '')} disabled={!canRoll || busy} onClick={() => act({ type: 'roll' })}>
            {mine.inJail ? 'Tenter un double' : state.doubles > 0 && !state.rolled ? 'Relancer (double !)' : 'Lancer les dés'}
          </button>
        )}
        {myTurn && (
          <button className="btn big" disabled={!canEnd || busy} onClick={() => act({ type: 'endTurn' })}>
            Fin du tour
          </button>
        )}
        <button className="btn ghost" onClick={() => onPanel('props')}>
          🏠 Mes biens
        </button>
        <button className="btn ghost" onClick={() => onPanel('log')}>
          📜 Journal
        </button>
      </div>
    </div>
  );
}

/* ---------- Carte de propriété ---------- */
function PropertyCard({ state, tile }) {
  const t = TILES[tile];
  const pr = state.props[tile];
  const owner = pr && state.players.find((p) => p.id === pr.owner);
  const color = t.group ? GROUPS[t.group].color : t.type === 'station' ? '#455a64' : t.type === 'utility' ? '#00897b' : '#5c6bc0';
  return (
    <div className="prop-card">
      <div className="prop-head" style={{ background: color }}>
        <span className="prop-icon">{t.icon}</span>
        <div>
          {t.group && <small>{GROUPS[t.group].name}</small>}
          <h3>{t.name}</h3>
        </div>
      </div>
      <div className="prop-body">
        {t.type === 'prop' && (
          <table>
            <tbody>
              <tr><td>Loyer terrain nu</td><td>{money(t.rents[0])}</td></tr>
              <tr><td>Avec tout le quartier</td><td>{money(t.rents[0] * 2)}</td></tr>
              {[1, 2, 3, 4].map((h) => (
                <tr key={h} className={pr?.houses === h ? 'hl' : ''}><td>Avec {h} maison{h > 1 ? 's' : ''}</td><td>{money(t.rents[h])}</td></tr>
              ))}
              <tr className={pr?.houses === 5 ? 'hl' : ''}><td>Avec un hôtel</td><td>{money(t.rents[5])}</td></tr>
              <tr className="sep"><td>Prix d'une maison</td><td>{money(GROUPS[t.group].houseCost)}</td></tr>
            </tbody>
          </table>
        )}
        {t.type === 'station' && (
          <table>
            <tbody>
              {[1, 2, 3, 4].map((n) => (
                <tr key={n}><td>{n} salon{n > 1 ? 's' : ''} vocal{n > 1 ? 'aux' : ''}</td><td>{money(STATION_RENT[n])}</td></tr>
              ))}
            </tbody>
          </table>
        )}
        {t.type === 'utility' && <p>Loyer = 4 × les dés, ou 10 × les dés si le même proprio a les deux bots (Maki et Jockie Music).</p>}
        {!t.price && <p className="muted">{tileDesc(t)}</p>}
        {t.price && (
          <div className="prop-foot">
            <span>Prix : <b>{money(t.price)}</b></span>
            <span>Hypothèque : {money(t.price / 2)}</span>
          </div>
        )}
        {owner && (
          <div className="owner" style={{ '--c': owner.color }}>
            <span className="dot" /> À {owner.name}
            {pr.mortgaged && ' · hypothéqué'}
            {pr.houses > 0 && ` · ${pr.houses === 5 ? '1 hôtel' : pr.houses + ' maison' + (pr.houses > 1 ? 's' : '')}`}
          </div>
        )}
      </div>
    </div>
  );
}
function tileDesc(t) {
  return {
    go: 'Touche 200 € à chaque passage.',
    jail: 'Juste en visite… sauf si un modo t\'y envoie.',
    parking: 'AFK : si la cagnotte est activée, tu ramasses les taxes accumulées.',
    gotojail: 'Sanction pour les voleurs : direct en Prison islamique, sans passer par le DÉPART.',
    chance: 'Pioche une carte Ping @everyone.',
    chest: 'Pioche une carte Grinta Corp.',
    tax: `Paie ${t.amount} € à la banque.`,
  }[t.type];
}

function ManageButtons({ state, tile, me, act }) {
  const t = TILES[tile];
  const pr = state.props[tile];
  if (!pr || pr.owner !== me.id || state.phase !== 'playing') return null;
  const mono = t.group && hasMonopoly(state, t.group, me.id);
  const groupHouses = t.group ? groupTiles(t.group).some((i) => (state.props[i]?.houses || 0) > 0) : false;
  return (
    <div className="manage">
      {t.type === 'prop' && mono && !pr.mortgaged && pr.houses < 5 && (
        <button className="btn small primary" onClick={() => act({ type: 'build', tile })}>
          + {pr.houses === 4 ? 'Hôtel' : 'Maison'} ({money(GROUPS[t.group].houseCost)})
        </button>
      )}
      {pr.houses > 0 && (
        <button className="btn small" onClick={() => act({ type: 'sell', tile })}>
          Vendre {pr.houses === 5 ? "l'hôtel" : 'une maison'} (+{money(GROUPS[t.group].houseCost / 2)})
        </button>
      )}
      {!pr.mortgaged && !groupHouses && (
        <button className="btn small" onClick={() => act({ type: 'mortgage', tile })}>
          Hypothéquer (+{money(t.price / 2)})
        </button>
      )}
      {pr.mortgaged && (
        <button className="btn small" onClick={() => act({ type: 'unmortgage', tile })}>
          Lever l'hypothèque (-{money(Math.ceil(t.price * 0.55))})
        </button>
      )}
    </div>
  );
}

function TileModal({ state, tile, me, act, onClose }) {
  return (
    <div className="modal-wrap" onClick={onClose}>
      <div className="modal narrow" onClick={(e) => e.stopPropagation()}>
        <PropertyCard state={state} tile={tile} />
        <ManageButtons state={state} tile={tile} me={me} act={act} />
        <button className="btn ghost full" onClick={onClose}>
          Fermer
        </button>
      </div>
    </div>
  );
}

function BuyModal({ state, tile, mine, act }) {
  const t = TILES[tile];
  return (
    <div className="modal-wrap soft">
      <div className="modal narrow pop">
        <PropertyCard state={state} tile={tile} />
        <div className="buy-row">
          <button className="btn big primary" disabled={mine.cash < t.price} onClick={() => act({ type: 'buy' })}>
            Acheter {money(t.price)}
          </button>
          <button className="btn big" onClick={() => act({ type: 'decline' })}>
            Passer
          </button>
        </div>
        {mine.cash < t.price && <p className="hint">T'as pas assez de thunes ({money(mine.cash)}).</p>}
      </div>
    </div>
  );
}

function CardPopup({ ev, state, onClose }) {
  const who = state.players.find((p) => p.id === ev.player);
  return (
    <div className="card-popup" onClick={onClose}>
      <div className={'game-card ' + ev.deck}>
        <div className="gc-head">{ev.deck === 'chance' ? '🔔 PING @EVERYONE' : '💼 GRINTA CORP'}</div>
        <p>{ev.text}</p>
        <small>{who?.name}</small>
      </div>
    </div>
  );
}

/* ---------- Panneau latéral ---------- */
function SidePanel({ state, me, panel, setPanel, act, onTile }) {
  const logRef = useRef(null);
  useEffect(() => {
    if (logRef.current) logRef.current.scrollTop = logRef.current.scrollHeight;
  }, [state.log.length, panel]);
  const mine = Object.keys(state.props).map(Number).filter((i) => state.props[i].owner === me.id).sort((a, b) => a - b);
  const my = state.players.find((p) => p.id === me.id);
  return (
    <div className="side">
      <div className="side-tabs">
        <button className={panel === 'props' ? 'on' : ''} onClick={() => setPanel('props')}>
          🏠 Mes biens
        </button>
        <button className={panel === 'log' ? 'on' : ''} onClick={() => setPanel('log')}>
          📜 Journal
        </button>
        <button className="close" onClick={() => setPanel(null)}>
          ✕
        </button>
      </div>
      {panel === 'log' ? (
        <div className="log" ref={logRef}>
          {state.log.map((l, i) => (
            <div key={i}>{l}</div>
          ))}
        </div>
      ) : (
        <div className="myprops">
          {my && <div className="worth">Fortune totale : <b>{money(netWorth(state, my))}</b>{my.jailCards?.length > 0 && ' · 🎟️ carte « Unmute »'}</div>}
          {!mine.length && <p className="muted">T'as encore rien acheté. Tombe sur une case libre et achète-la !</p>}
          {mine.map((i) => {
            const t = TILES[i];
            const pr = state.props[i];
            return (
              <div key={i} className={'myprop' + (pr.mortgaged ? ' mort' : '')}>
                <button className="myprop-name" onClick={() => onTile(i)} style={{ '--c': t.group ? GROUPS[t.group].color : '#90a4ae' }}>
                  <span className="bar" />
                  {t.icon} {t.name}
                  <span className="muted small">
                    {pr.mortgaged ? ' · hypothéqué' : pr.houses === 5 ? ' · 🏨' : pr.houses ? ' · ' + '🏠'.repeat(pr.houses) : ''}
                  </span>
                </button>
                <ManageButtons state={state} tile={i} me={me} act={act} />
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

/* ---------- Échanges ---------- */
function tradable(state, owner) {
  return Object.keys(state.props)
    .map(Number)
    .filter((i) => {
      const pr = state.props[i];
      if (pr.owner !== owner) return false;
      const t = TILES[i];
      return !(t.group && groupTiles(t.group).some((k) => (state.props[k]?.houses || 0) > 0));
    })
    .sort((a, b) => a - b);
}

function PropChips({ list, sel, toggle }) {
  if (!list.length) return <p className="muted small">Aucun terrain échangeable</p>;
  return (
    <div className="chips">
      {list.map((i) => {
        const t = TILES[i];
        return (
          <button key={i} className={'chip' + (sel.includes(i) ? ' on' : '')} style={{ '--c': t.group ? GROUPS[t.group].color : '#90a4ae' }} onClick={() => toggle(i)}>
            {t.icon} {t.name}
          </button>
        );
      })}
    </div>
  );
}

function TradeBuilder({ state, me, other, act, onClose }) {
  const o = state.players.find((p) => p.id === other);
  const my = state.players.find((p) => p.id === me.id);
  const [give, setGive] = useState([]);
  const [get, setGet] = useState([]);
  const [giveCash, setGiveCash] = useState(0);
  const [getCash, setGetCash] = useState(0);
  const tog = (arr, set) => (i) => set(arr.includes(i) ? arr.filter((x) => x !== i) : [...arr, i]);
  if (state.trade) {
    return (
      <div className="modal-wrap" onClick={onClose}>
        <div className="modal narrow" onClick={(e) => e.stopPropagation()}>
          <p>Un échange est déjà en cours, attends qu'il se termine.</p>
          <button className="btn full" onClick={onClose}>OK</button>
        </div>
      </div>
    );
  }
  return (
    <div className="modal-wrap" onClick={onClose}>
      <div className="modal trade" onClick={(e) => e.stopPropagation()}>
        <h2>Échange avec {o.name}</h2>
        <div className="trade-cols">
          <div>
            <h3>Tu donnes</h3>
            <PropChips list={tradable(state, me.id)} sel={give} toggle={tog(give, setGive)} />
            <label className="cash-in">
              + <input type="number" min={0} max={Math.max(0, my.cash)} step={10} value={giveCash} onChange={(e) => setGiveCash(Math.max(0, +e.target.value))} /> €
            </label>
          </div>
          <div>
            <h3>Tu reçois</h3>
            <PropChips list={tradable(state, other)} sel={get} toggle={tog(get, setGet)} />
            <label className="cash-in">
              + <input type="number" min={0} step={10} value={getCash} onChange={(e) => setGetCash(Math.max(0, +e.target.value))} /> €
            </label>
          </div>
        </div>
        <div className="buy-row">
          <button className="btn primary big" onClick={() => { act({ type: 'proposeTrade', to: other, give: { props: give, cash: giveCash }, get: { props: get, cash: getCash } }); onClose(); }}>
            Proposer 🤝
          </button>
          <button className="btn big" onClick={onClose}>Annuler</button>
        </div>
      </div>
    </div>
  );
}

function TradeView({ state, me, act }) {
  const tr = state.trade;
  const from = state.players.find((p) => p.id === tr.from);
  const to = state.players.find((p) => p.id === tr.to);
  const list = (side) => (
    <ul className="trade-list">
      {side.props.map((i) => (
        <li key={i} style={{ '--c': TILES[i].group ? GROUPS[TILES[i].group].color : '#90a4ae' }}>
          <span className="dot" /> {TILES[i].icon} {TILES[i].name}
        </li>
      ))}
      {side.cash > 0 && <li>💶 {money(side.cash)}</li>}
      {!side.props.length && !side.cash && <li className="muted">rien</li>}
    </ul>
  );
  const incoming = tr.to === me.id;
  return (
    <div className={'trade-float' + (incoming ? ' incoming' : '')}>
      <h3>{incoming ? `${from.name} te propose un échange` : `Proposition envoyée à ${to.name}`}</h3>
      <div className="trade-cols">
        <div>
          <small>{from.name} donne</small>
          {list(tr.give)}
        </div>
        <div>
          <small>{to.name} donne</small>
          {list(tr.get)}
        </div>
      </div>
      {incoming ? (
        <div className="buy-row">
          <button className="btn primary" onClick={() => act({ type: 'acceptTrade' })}>Accepter</button>
          <button className="btn" onClick={() => act({ type: 'rejectTrade' })}>Refuser</button>
        </div>
      ) : (
        <button className="btn full" onClick={() => act({ type: 'rejectTrade' })}>Annuler la proposition</button>
      )}
    </div>
  );
}

function Winner({ state, onLeave }) {
  const w = state.players.find((p) => p.id === state.winner);
  return (
    <div className="modal-wrap">
      <div className="modal narrow winner pop">
        <CharPreview char={w?.char} size={180} />
        <h2>🏆 {w?.name} gagne !</h2>
        <p className="muted">Le vrai boss de La Grinta, respect.</p>
        <button className="btn big primary full" onClick={onLeave}>Retour à l'accueil</button>
      </div>
    </div>
  );
}
