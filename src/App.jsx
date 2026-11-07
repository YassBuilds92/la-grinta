import { useEffect, useMemo, useRef, useState, useCallback } from 'react';
import { TILES, GROUPS, CHARACTERS, groupTiles, STATION_RENT } from './game/board.js';
import { hasMonopoly, JAIL_FINE, netWorth, MAX_PLAYERS } from './game/engine.js';
import { Room, makeCode, getIdentity, saveIdentity, isHostOf, markHost } from './net/room.js';
import { GameScene } from './three/scene.js';
import { loadFonts } from './three/boardTexture.js';
import { sfx, unlockAudio, isMuted, setMuted } from './audio.js';
import CharPreview, { usePortraits } from './ui/CharPreview.jsx';
import PixelLogo from './ui/PixelLogo.jsx';
import PxIcon from './ui/PxIcon.jsx';

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
// Sélection façon jeu de combat : portraits pixel, le perso choisi saute sur son socle.
function CharPicker({ value, onChange, taken = [] }) {
  const portraits = usePortraits();
  return (
    <div className="roster">
      {CHARACTERS.map((c) => {
        const dis = taken.includes(c.id) && c.id !== value;
        return (
          <button key={c.id} className={'slot' + (c.id === value ? ' on' : '')} disabled={dis} onClick={() => onChange(c.id)} style={{ '--c': c.color }} title={c.name}>
            {portraits[c.id] ? <img src={portraits[c.id]} alt={c.name} /> : <span className="slot-ph" />}
            {dis && <span className="slot-taken">PRIS</span>}
          </button>
        );
      })}
    </div>
  );
}
function cycleChar(cur, dir, taken = []) {
  const ids = CHARACTERS.map((c) => c.id).filter((id) => id === cur || !taken.includes(id));
  const i = ids.indexOf(cur);
  return ids[(i + dir + ids.length) % ids.length];
}
function Stage({ char, size, onCycle }) {
  return (
    <div className="stage">
      <button className="arrow l" onClick={() => onCycle(-1)} aria-label="Perso précédent" />
      <div className="stage-mid" style={{ '--champ': CHARACTERS.find((c) => c.id === char)?.color }}>
        <CharPreview char={char} size={size} />
        <div className="pedestal" />
        <div className="stage-name">{charName(char)}</div>
      </div>
      <button className="arrow r" onClick={() => onCycle(1)} aria-label="Perso suivant" />
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
      <PixelSky />
      <div className="title">
        <PixelLogo />
        <div className="select">
          <Stage char={me.char} size={typeof window !== "undefined" && window.innerWidth < 640 ? 168 : 210} onCycle={(d) => update({ char: cycleChar(me.char, d) })} />
          <div className="select-side">
            <label className="blaze">
              <span>Ton blaze</span>
              <input value={me.name} maxLength={16} placeholder="Yassine" spellCheck={false} onChange={(e) => update({ name: e.target.value })} autoFocus />
            </label>
            <CharPicker value={me.char} onChange={(char) => update({ char })} />
          </div>
        </div>
        <div className="title-actions">
          {urlCode ? (
            <button className="key go" disabled={!ok} onClick={() => onEnter(urlCode, false)}>
              Rejoindre {urlCode}
            </button>
          ) : (
            <>
              <button className="key go" disabled={!ok} onClick={() => onEnter(makeCode(), true)}>
                Créer une partie
              </button>
              <div className="join-row">
                <input value={code} placeholder="CODE" maxLength={5} spellCheck={false} onChange={(e) => setCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ''))} />
                <button className="key" disabled={!ok || code.length !== 5} onClick={() => onEnter(code, false)}>
                  Rejoindre
                </button>
              </div>
            </>
          )}
          <p className={'hint' + (ok ? ' ok' : '')}>{ok ? `Prêt, ${me.name.trim()} ?` : 'Écris ton blaze pour jouer'}</p>
        </div>
      </div>
    </div>
  );
}

// Ciel couchant en bandes franches, nuages pixel qui dérivent, collines au loin.
function PixelSky() {
  return (
    <div className="psky" aria-hidden="true">
      <div className="sun" />
      <div className="cloud c1" />
      <div className="cloud c2" />
      <div className="cloud c3" />
      <div className="hills far" />
      <div className="hills near" />
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
      const narrow = window.innerWidth < 700;
      // zone cachée par l'interface (barre des joueurs en haut, actions en bas) : la caméra cadre le plateau dans le reste
      sc = new GameScene(boxRef.current, {
        onTileClick: (i) => setTile(i),
        insets: narrow ? { top: 72, bottom: 112 } : { top: 76, bottom: 128 },
      });
      sc.onStep = () => sfx.step();
      sc.meId = me.id;
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
        toast(`${name(e.player)} ramasse la cagnotte : ${money(e.amount)} !`, 'good');
        break;
      case 'trade':
        if (e.to === me.id) {
          sfx.turn();
          toast(`${name(e.from)} te propose un échange`, 'good');
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
        toast(`${name(e.player)} fait faillite !`, 'bad');
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
          <TopBar state={state} me={me} status={status} host={host} muted={muted} onRecenter={() => sceneRef.current?.recenter()} onMute={() => { setMuted(!muted); setMutedState(!muted); }} onLeave={onLeave} onPlayer={(p) => p.id !== me.id && mine && !mine.bankrupt && state.phase === 'playing' && setTradeWith(p.id)} />
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
function TopBar({ state, me, status, host, muted, onMute, onLeave, onPlayer, onRecenter }) {
  return (
    <div className="topbar">
      <div className="players">
        {state.players.map((p, i) => {
          const isTurn = state.phase === 'playing' && i === state.turn;
          return (
            <button key={p.id} className={'pcard' + (isTurn ? ' turn' : '') + (p.bankrupt ? ' out' : '') + (p.id === me.id ? ' me' : '')} style={{ '--c': p.color }} onClick={() => onPlayer(p)} title={p.id !== me.id ? 'Proposer un échange' : ''}>
              <LobbyFace char={p.char} />
              <span className="pinfo">
                <span className="pname">
                  {p.name}
                  {p.id === me.id && ' (toi)'}
                  {!p.connected && <span className="ptag" title="Déconnecté">OFF</span>}
                  {p.inJail && <span className="ptag jail" title="En prison">PRISON</span>}
                </span>
                <span className={'pcash' + (p.cash < 0 ? ' neg' : '')}>{p.bankrupt ? 'Faillite' : money(p.cash)}</span>
              </span>
            </button>
          );
        })}
      </div>
      <div className="top-actions">
        {state.pot > 0 && <span className="pot" title="Cagnotte de la case AFK"><PxIcon name="zzz" size={16} /> {money(state.pot)}</span>}
        {status !== 'online' && <span className="net-badge">{status === 'reconnecting' || status === 'connecting' ? 'Reconnexion…' : 'Hors ligne'}</span>}
        {host && <span className="host-badge">Hôte</span>}
        <button className="icon-btn" onClick={onRecenter} title="Recentrer la caméra">
          <PxIcon name="target" size={16} />
        </button>
        <button className="icon-btn" onClick={onMute} title="Son">
          <PxIcon name={muted ? 'mute' : 'sound'} size={16} />
        </button>
        <button className="icon-btn" onClick={() => confirm('Quitter la partie ?') && onLeave()} title="Quitter">
          <PxIcon name="close" size={16} />
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
      <div className="lobby">
        <div className="lobby-head">
          <span>Salon</span>
          <div className="code-slots">{code.split('').map((ch, i) => <b key={i}>{ch}</b>)}</div>
        </div>
        <div className="invite">
          <input readOnly value={link} onFocus={(e) => e.target.select()} />
          <button className="key small" onClick={share}>
            {copied ? 'Copié !' : navigator.share ? 'Partager' : 'Copier'}
          </button>
        </div>
        <div className="lobby-grid">
          <div>
            <h3>Joueurs {state.players.length}/{MAX_PLAYERS}</h3>
            <ul className="lobby-players">
              {state.players.map((p) => (
                <li key={p.id} style={{ '--c': p.color }}>
                  <LobbyFace char={p.char} />
                  <span className="lp-name">{p.name}{p.id === me.id && <em> (toi)</em>}</span>
                  <span className="lp-char">{charName(p.char)}</span>
                  {host && p.id !== me.id && (
                    <button className="mini" onClick={() => onKick(p.id)}>
                      retirer
                    </button>
                  )}
                </li>
              ))}
              {Array.from({ length: Math.max(0, 2 - state.players.length) }, (_, i) => (
                <li key={'e' + i} className="empty">En attente d'un pote…</li>
              ))}
            </ul>
          </div>
          {my && (
            <div className="lobby-me">
              <Stage char={my.char} size={150} onCycle={(d) => onChange({ char: cycleChar(my.char, d, state.players.map((p) => p.char)) })} />
              <CharPicker value={my.char} taken={state.players.map((p) => p.char)} onChange={(char) => onChange({ char })} />
            </div>
          )}
        </div>
        {host ? (
          <>
            <label className="check">
              <input type="checkbox" checked={freeParking} onChange={(e) => setFreeParking(e.target.checked)} />
              <span>Les taxes vont dans la cagnotte de la case AFK</span>
            </label>
            <button className="key go wide" disabled={state.players.length < 2} onClick={() => onStart({ freeParking })}>
              {state.players.length < 2 ? 'Il faut 2 joueurs' : 'Lancer la partie'}
            </button>
          </>
        ) : (
          <p className="waiting">L'hôte va lancer la partie</p>
        )}
      </div>
    </div>
  );
}
function LobbyFace({ char }) {
  const portraits = usePortraits();
  return <span className="face">{portraits[char] && <img src={portraits[char]} alt="" />}</span>;
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
          <DieFace n={state.dice[0]} /><DieFace n={state.dice[1]} />
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
          <PxIcon name="house" size={16} /> Mes biens
        </button>
        <button className="btn ghost" onClick={() => onPanel('log')}>
          <PxIcon name="scroll" size={16} /> Journal
        </button>
      </div>
    </div>
  );
}

/* ---------- Carte de propriété (style pixel, épurée) ---------- */
const tileColor = (t) => (t.group ? GROUPS[t.group].color : t.type === 'station' ? '#5b6b78' : t.type === 'utility' ? '#14a08e' : '#6a5cd6');
const tileKicker = (t) => (t.group ? GROUPS[t.group].name : t.type === 'station' ? 'Salon vocal' : t.type === 'utility' ? 'Bot du serveur' : 'Case spéciale');
// Texte clair ou foncé selon la couleur du bandeau (le jaune veut du texte foncé).
const PIPS = { 1: [4], 2: [0, 8], 3: [0, 4, 8], 4: [0, 2, 6, 8], 5: [0, 2, 4, 6, 8], 6: [0, 2, 3, 5, 6, 8] };
function DieFace({ n }) {
  return <span className="die">{Array.from({ length: 9 }, (_, i) => <i key={i} className={PIPS[n]?.includes(i) ? 'on' : ''} />)}</span>;
}
const inkOn = (hex) => {
  const n = parseInt(hex.slice(1), 16);
  const l = (0.299 * (n >> 16) + 0.587 * ((n >> 8) & 255) + 0.114 * (n & 255)) / 255;
  return l > 0.68 ? '#2a1030' : '#fff';
};

// Qui possède quoi dans le même quartier / la même famille : la vraie info pour décider.
function SetPips({ state, tile, meId }) {
  const t = TILES[tile];
  const set = t.group ? groupTiles(t.group) : TILES.map((x, i) => (x.type === t.type ? i : -1)).filter((i) => i >= 0);
  const owners = set.map((i) => state.props[i]?.owner || null);
  const mineN = owners.filter((o) => o === meId).length;
  const others = [...new Set(owners.filter((o) => o && o !== meId))].map((id) => state.players.find((p) => p.id === id));
  const freeN = owners.filter((o) => !o).length;
  let hint = null;
  if (!state.props[tile] && meId) {
    if (mineN === set.length - 1 && t.group) hint = { cls: 'go', text: 'Complète ton quartier !' };
    else if (others.length === 1 && owners.filter((o) => o === others[0].id).length === set.length - 1 && t.group) hint = { cls: 'block', text: `Bloque ${others[0].name} !` };
    else if (mineN > 0) hint = { cls: '', text: `Tu en as ${mineN}/${set.length}` };
  }
  return (
    <div className="pips">
      <span className="pip-group">{tileKicker(t)}</span>
      {set.map((i) => {
        const o = state.props[i]?.owner;
        const pl = o && state.players.find((p) => p.id === o);
        return <span key={i} className={'pip' + (i === tile ? ' cur' : '') + (pl ? ' own' : '')} style={pl ? { '--c': pl.color } : null} title={TILES[i].name} />;
      })}
      {hint ? <span className={'pip-hint ' + hint.cls}>{hint.text}</span> : freeN === set.length && <span className="pip-hint">{t.group ? 'Quartier encore libre' : "Personne n'en a"}</span>}
    </div>
  );
}

function RentTable({ state, tile }) {
  const t = TILES[tile];
  const pr = state.props[tile];
  if (t.type === 'utility') return <p className="px-note">4 × les dés, ou 10 × si le même proprio a Maki et Jockie Music.</p>;
  const rows =
    t.type === 'station'
      ? [1, 2, 3, 4].map((n) => [`${n} salon${n > 1 ? 's' : ''}`, STATION_RENT[n], false])
      : [
          ['Terrain nu', t.rents[0], pr && !pr.houses],
          ['Tout le quartier', t.rents[0] * 2, false],
          ...[1, 2, 3, 4].map((h) => [`${h} maison${h > 1 ? 's' : ''}`, t.rents[h], pr?.houses === h]),
          ['Hôtel', t.rents[5], pr?.houses === 5],
        ];
  return (
    <div className="rent-grid">
      {rows.map(([k, v, hl]) => (
        <div key={k} className={hl ? 'hl' : ''}><span>{k}</span><b>{money(v)}</b></div>
      ))}
      {t.group && <div className="sub"><span>Construire 1 maison</span><b>{money(GROUPS[t.group].houseCost)}</b></div>}
      <div className="sub"><span>Hypothèque</span><b>{money(t.price / 2)}</b></div>
    </div>
  );
}

function PropertyCard({ state, tile, meId, full = false, children }) {
  const t = TILES[tile];
  const pr = state.props[tile];
  const owner = pr && state.players.find((p) => p.id === pr.owner);
  const color = tileColor(t);
  const ink = inkOn(color);
  const big = (n) => <>{n.toLocaleString('fr-FR')}<i> €</i></>;
  const baseRent = t.type === 'prop' ? big(t.rents[0]) : t.type === 'station' ? big(STATION_RENT[1]) : '4× dés';
  return (
    <div className="px-card">
      <div className={"px-head" + (ink === "#fff" ? "" : " light")} style={{ "--g": color, color: ink }}>
        <h3>{t.name}</h3>
      </div>
      <div className="px-body">
        {t.price ? (
          <>
            <div className="px-stats">
              <div><small>Prix</small><b>{big(t.price)}</b></div>
              <div><small>Loyer</small><b>{baseRent}</b>{t.type === 'prop' && <em>×2 avec le quartier</em>}{t.type === 'station' && <em>double par salon en +</em>}</div>
            </div>
            <SetPips state={state} tile={tile} meId={meId} />
            {full ? (
              <RentTable state={state} tile={tile} />
            ) : (
              <details className="px-more">
                <summary>Tous les loyers</summary>
                <RentTable state={state} tile={tile} />
              </details>
            )}
          </>
        ) : (
          <p className="px-note big">{tileDesc(t)}</p>
        )}
        {owner && (
          <div className="owner" style={{ '--c': owner.color }}>
            <span className="dot" /> À {owner.name}
            {pr.mortgaged && ' · hypothéquée'}
            {pr.houses > 0 && ` · ${pr.houses === 5 ? '1 hôtel' : pr.houses + ' maison' + (pr.houses > 1 ? 's' : '')}`}
          </div>
        )}
        {children}
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
      <div className="px-modal" onClick={(e) => e.stopPropagation()}>
        <PropertyCard state={state} tile={tile} meId={me.id} full>
          <ManageButtons state={state} tile={tile} me={me} act={act} />
          <button className="pxbtn full" onClick={onClose}>
            Fermer
          </button>
        </PropertyCard>
      </div>
    </div>
  );
}

function BuyModal({ state, tile, mine, act }) {
  const t = TILES[tile];
  const short = mine.cash < t.price;
  return (
    <div className="modal-wrap soft buy-wrap">
      <div className="px-modal pop">
        <PropertyCard state={state} tile={tile} meId={mine.id}>
          <div className="buy-row">
            <button className="pxbtn go" disabled={short} onClick={() => act({ type: 'buy' })}>
              Acheter
              <small>{short ? `manque ${money(t.price - mine.cash)}` : `reste ${money(mine.cash - t.price)}`}</small>
            </button>
            <button className="pxbtn" onClick={() => act({ type: 'decline' })}>
              Passer
            </button>
          </div>
        </PropertyCard>
      </div>
    </div>
  );
}

function CardPopup({ ev, state, onClose }) {
  const who = state.players.find((p) => p.id === ev.player);
  return (
    <div className="card-popup" onClick={onClose}>
      <div className={'game-card ' + ev.deck}>
        <div className="gc-head"><PxIcon name={ev.deck === 'chance' ? 'bell' : 'case'} size={32} />{ev.deck === 'chance' ? 'Ping @everyone' : 'Grinta Corp'}</div>
        <p>{ev.text}</p>
        <small>Tirée par {who?.name}</small>
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
          <PxIcon name="house" size={16} /> Mes biens
        </button>
        <button className={panel === 'log' ? 'on' : ''} onClick={() => setPanel('log')}>
          <PxIcon name="scroll" size={16} /> Journal
        </button>
        <button className="close" onClick={() => setPanel(null)}>
          <PxIcon name="close" size={16} />
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
          {my && <div className="worth">Fortune totale : <b>{money(netWorth(state, my))}</b>{my.jailCards?.length > 0 && ' · carte « Unmute »'}</div>}
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
                    {pr.mortgaged ? ' · hypothéqué' : pr.houses === 5 ? ' · hôtel' : pr.houses ? ' · ' + pr.houses + ' maison' + (pr.houses > 1 ? 's' : '') : ''}
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
            Proposer
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
      {side.cash > 0 && <li>{money(side.cash)}</li>}
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
        <h2><PxIcon name="crown" size={24} /> {w?.name} gagne !</h2>
        <p className="muted">Le vrai boss de La Grinta, respect.</p>
        <button className="btn big primary full" onClick={onLeave}>Retour à l'accueil</button>
      </div>
    </div>
  );
}
