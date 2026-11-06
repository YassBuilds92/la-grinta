// Sons synthétisés en direct (WebAudio), aucun fichier audio.
let ctx = null;
let muted = false;
try {
  muted = localStorage.getItem('hc-muted') === '1';
} catch {
  /* */
}

function ac() {
  if (!ctx) {
    const C = window.AudioContext || window.webkitAudioContext;
    if (!C) return null;
    ctx = new C();
  }
  if (ctx.state === 'suspended') ctx.resume();
  return ctx;
}
export const isMuted = () => muted;
export function setMuted(m) {
  muted = m;
  try {
    localStorage.setItem('hc-muted', m ? '1' : '0');
  } catch {
    /* */
  }
}
export function unlockAudio() {
  ac();
}

function tone(freq, { at = 0, dur = 0.15, type = 'sine', vol = 0.2, slide = 0 } = {}) {
  const c = ac();
  if (!c || muted) return;
  const t = c.currentTime + at;
  const o = c.createOscillator();
  const g = c.createGain();
  o.type = type;
  o.frequency.setValueAtTime(freq, t);
  if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(30, freq + slide), t + dur);
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(vol, t + 0.01);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g).connect(c.destination);
  o.start(t);
  o.stop(t + dur + 0.05);
}
function noise({ at = 0, dur = 0.05, vol = 0.25, freq = 2500 } = {}) {
  const c = ac();
  if (!c || muted) return;
  const t = c.currentTime + at;
  const buf = c.createBuffer(1, Math.ceil(c.sampleRate * dur), c.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / d.length);
  const src = c.createBufferSource();
  src.buffer = buf;
  const f = c.createBiquadFilter();
  f.type = 'bandpass';
  f.frequency.value = freq;
  f.Q.value = 1.2;
  const g = c.createGain();
  g.gain.value = vol;
  src.connect(f).connect(g).connect(c.destination);
  src.start(t);
}

export const sfx = {
  dice() {
    // cliquetis qui ralentit
    let at = 0;
    for (let i = 0; i < 9; i++) {
      noise({ at, dur: 0.04, vol: 0.35 - i * 0.03, freq: 1800 + Math.random() * 1600 });
      at += 0.06 + i * 0.018;
    }
  },
  step() {
    tone(520 + Math.random() * 60, { dur: 0.06, type: 'triangle', vol: 0.08 });
  },
  land() {
    tone(220, { dur: 0.12, type: 'sine', vol: 0.18, slide: -80 });
  },
  cash() {
    tone(1318, { dur: 0.12, type: 'square', vol: 0.06 });
    tone(1760, { at: 0.08, dur: 0.25, type: 'square', vol: 0.06 });
  },
  pay() {
    tone(660, { dur: 0.12, type: 'triangle', vol: 0.15 });
    tone(440, { at: 0.1, dur: 0.2, type: 'triangle', vol: 0.15 });
  },
  buy() {
    [523, 659, 784, 1047].forEach((f, i) => tone(f, { at: i * 0.07, dur: 0.18, type: 'triangle', vol: 0.14 }));
  },
  build() {
    noise({ dur: 0.06, vol: 0.3, freq: 900 });
    noise({ at: 0.12, dur: 0.06, vol: 0.3, freq: 1100 });
    tone(880, { at: 0.24, dur: 0.2, type: 'triangle', vol: 0.12 });
  },
  card() {
    noise({ dur: 0.18, vol: 0.18, freq: 4000 });
    tone(740, { at: 0.12, dur: 0.15, type: 'sine', vol: 0.12 });
  },
  jail() {
    tone(196, { dur: 0.35, type: 'sawtooth', vol: 0.08 });
    tone(147, { at: 0.3, dur: 0.5, type: 'sawtooth', vol: 0.08 });
  },
  turn() {
    tone(988, { dur: 0.12, vol: 0.14 });
    tone(1319, { at: 0.12, dur: 0.3, vol: 0.14 });
  },
  error() {
    tone(180, { dur: 0.15, type: 'square', vol: 0.06 });
  },
  win() {
    [523, 659, 784, 1047, 784, 1047, 1319].forEach((f, i) => tone(f, { at: i * 0.12, dur: 0.25, type: 'triangle', vol: 0.15 }));
  },
  bankrupt() {
    [392, 330, 262, 196].forEach((f, i) => tone(f, { at: i * 0.18, dur: 0.3, type: 'sawtooth', vol: 0.07 }));
  },
};
