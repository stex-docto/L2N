// ── Note mapping ──────────────────────────────────────────────────────────────
//
// Fixed assignment: A=La(A4), B=Si(B4), C=Do(C4), D=Ré(D4),
//                   E=Mi(E4), F=Fa(F4), G=Sol(G4) — then modulo 7 for H-Z.
// Choosing a key/mode only applies the key signature's alterations
// (sharps or flats) to the base natural notes.

const NATURAL_MIDI = { A:69, B:71, C:60, D:62, E:64, F:65, G:67 };
const LETTER_SOL   = { A:'La', B:'Si', C:'Do', D:'Ré', E:'Mi', F:'Fa', G:'Sol' };

// Key signatures: which base letter names get +1 (sharp) or -1 (flat).
// Order of sharps: F C G D A E B  — order of flats: B E A D G C F
const KEY_SIGS = {
  major: {
    0:  {},                                       // C  major
    7:  { F:1 },                                  // G  major (1#)
    2:  { F:1, C:1 },                             // D  major (2#)
    9:  { F:1, C:1, G:1 },                        // A  major (3#)
    4:  { F:1, C:1, G:1, D:1 },                   // E  major (4#)
    11: { F:1, C:1, G:1, D:1, A:1 },              // B  major (5#)
    6:  { F:1, C:1, G:1, D:1, A:1, E:1 },         // F#/Gb major (6#)
    5:  { B:-1 },                                 // F  major (1b)
    10: { B:-1, E:-1 },                           // Bb major (2b)
    3:  { B:-1, E:-1, A:-1 },                     // Eb major (3b)
    8:  { B:-1, E:-1, A:-1, D:-1 },               // Ab major (4b)
    1:  { B:-1, E:-1, A:-1, D:-1, G:-1 },         // Db major (5b)
  },
  minor: {
    9:  {},                                       // A  minor
    4:  { F:1 },                                  // E  minor (1#)
    11: { F:1, C:1 },                             // B  minor (2#)
    6:  { F:1, C:1, G:1 },                        // F# minor (3#)
    1:  { F:1, C:1, G:1, D:1 },                   // C# minor (4#)
    8:  { F:1, C:1, G:1, D:1, A:1 },              // G# minor (5#)
    3:  { F:1, C:1, G:1, D:1, A:1, E:1 },         // D# minor (6#)
    2:  { B:-1 },                                 // D  minor (1b)
    7:  { B:-1, E:-1 },                           // G  minor (2b)
    0:  { B:-1, E:-1, A:-1 },                     // C  minor (3b)
    5:  { B:-1, E:-1, A:-1, D:-1 },               // F  minor (4b)
    10: { B:-1, E:-1, A:-1, D:-1, G:-1 },         // Bb minor (5b)
  }
};

// Proper display names for each key (avoids showing "La# Majeur" for Bb major)
const KEY_NAMES = {
  major: {
    0:'Do Majeur',  7:'Sol Majeur', 2:'Ré Majeur',  9:'La Majeur',
    4:'Mi Majeur',  11:'Si Majeur', 6:'Fa#/Solb Majeur',
    5:'Fa Majeur',  10:'Sib Majeur', 3:'Mib Majeur',
    8:'Lab Majeur', 1:'Réb Majeur',
  },
  minor: {
    9:'La Mineur',  4:'Mi Mineur',  11:'Si Mineur', 6:'Fa# Mineur',
    1:'Do# Mineur', 8:'Sol# Mineur', 3:'Ré# Mineur',
    2:'Ré Mineur',  7:'Sol Mineur', 0:'Do Mineur',
    5:'Fa Mineur',  10:'Sib Mineur',
  }
};

// ── Note math ─────────────────────────────────────────────────────────────────

function baseLetter(letter) {
  const idx = letter.toUpperCase().charCodeAt(0) - 65;
  return String.fromCharCode(65 + (idx % 7));   // A-G
}

function letterMidi(letter, rootSemi, mode) {
  const bl  = baseLetter(letter);
  const alt = (KEY_SIGS[mode][rootSemi] || {})[bl] || 0;
  return NATURAL_MIDI[bl] + alt;
}

function letterNoteName(letter, rootSemi, mode) {
  const bl  = baseLetter(letter);
  const alt = (KEY_SIGS[mode][rootSemi] || {})[bl] || 0;
  const acc = alt === 1 ? '#' : alt === -1 ? 'b' : '';
  return LETTER_SOL[bl] + acc;
}

function midiToFreq(midi) {
  return 440 * Math.pow(2, (midi - 69) / 12);
}

// ── Audio engine ──────────────────────────────────────────────────────────────

let audioCtx = null;
let scheduledOscs = [];     // { osc, gain } pairs for early stop

function ctx() {
  if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  if (audioCtx.state === 'suspended') audioCtx.resume();
  return audioCtx;
}

function scheduleNote(midi, duration, startTime) {
  const ac = ctx();
  const freq = midiToFreq(midi);

  // Two oscillators: triangle (body) + sine slight detune (shimmer)
  function makeOsc(type, detuneC, vol) {
    const osc  = ac.createOscillator();
    const gain = ac.createGain();
    osc.type = type;
    osc.frequency.value = freq;
    osc.detune.value = detuneC;

    const atk = Math.min(0.025, duration * 0.08);
    const rel = Math.min(0.12, duration * 0.25);
    const susEnd = Math.max(startTime + atk, startTime + duration - rel);

    gain.gain.setValueAtTime(0, startTime);
    gain.gain.linearRampToValueAtTime(vol, startTime + atk);
    gain.gain.setValueAtTime(vol, susEnd);
    gain.gain.exponentialRampToValueAtTime(0.0001, startTime + duration);

    osc.connect(gain);
    gain.connect(ac.destination);
    osc.start(startTime);
    osc.stop(startTime + duration + 0.05);
    scheduledOscs.push({ osc, gain });
  }

  // Scale volume down slightly for high notes to avoid harshness
  const volScale = midi > 80 ? 0.18 : 0.26;
  makeOsc('triangle', 0, volScale);
  makeOsc('sine', 7, volScale * 0.35);
}

function killAudio() {
  if (!audioCtx) return;
  const now = audioCtx.currentTime;
  scheduledOscs.forEach(({ osc, gain }) => {
    try {
      gain.gain.cancelScheduledValues(now);
      gain.gain.setValueAtTime(0, now);
      osc.stop(now + 0.015);
    } catch (_) {}
    setTimeout(() => { try { osc.disconnect(); gain.disconnect(); } catch(_) {} }, 60);
  });
  scheduledOscs = [];
}

// ── Event builder ─────────────────────────────────────────────────────────────

function buildEvents(text, rootSemi, mode, beatSec, merge) {
  const upper  = text.toUpperCase();
  const events = [];
  let i = 0;

  while (i < text.length) {
    const ch = upper[i];

    if (ch >= 'A' && ch <= 'Z') {
      let count = 1;
      if (merge) {
        while (i + count < text.length && upper[i + count] === ch) count++;
      }
      const midi     = letterMidi(ch, rootSemi, mode);
      const slotDur  = beatSec * count;
      const audioDur = count === 1
        ? Math.max(slotDur * 0.5, slotDur - 0.04)
        : slotDur;
      events.push({
        type:        'note',
        letter:      ch,
        midi,
        noteName:    letterNoteName(ch, rootSemi, mode),
        slotDur,
        audioDur,
        charIndices: Array.from({ length: count }, (_, k) => i + k),
      });
      i += count;

    } else if (ch === ' ') {
      events.push({ type: 'rest', slotDur: beatSec, audioDur: 0, charIndices: [i] });
      i++;

    } else {
      events.push({ type: 'rest', slotDur: beatSec * 0.5, audioDur: 0, charIndices: [i] });
      i++;
    }
  }

  return events;
}

// ── Playback state ────────────────────────────────────────────────────────────

let playing      = false;
let uiTimeouts   = [];

function startPlayback() {
  const text = document.getElementById('text-input').value;
  if (!text.trim()) return;

  stopPlayback(true);

  const rootSemi = parseInt(document.getElementById('key-select').value);
  const mode     = document.querySelector('.toggle-btn.active').dataset.mode;
  const tempo    = parseInt(document.getElementById('tempo-input').value);
  const merge    = document.getElementById('merge-repeats').checked;
  const beatSec  = 60 / tempo;

  const events = buildEvents(text, rootSemi, mode, beatSec, merge);

  playing = true;
  document.getElementById('play-btn').disabled = true;
  document.getElementById('stop-btn').disabled = false;

  buildTextDisplay(text);

  const ac = ctx();
  const t0 = ac.currentTime + 0.06;
  let elapsed = 0;

  events.forEach(ev => {
    const evStart = elapsed;

    if (ev.type === 'note') {
      scheduleNote(ev.midi, ev.audioDur, t0 + evStart);
    }

    const tms = evStart * 1000;
    uiTimeouts.push(setTimeout(() => {
      if (!playing) return;
      // Clear previous active
      document.querySelectorAll('.ch.active').forEach(s => {
        s.classList.remove('active');
        s.classList.add('played');
      });
      // Highlight current chars
      ev.charIndices.forEach(idx => {
        const el = document.querySelector(`.ch[data-i="${idx}"]`);
        if (el) {
          el.classList.remove('played');
          el.classList.add('active');
          el.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        }
      });
      // Light up grid card
      document.querySelectorAll('.letter-card.lit').forEach(c => c.classList.remove('lit'));
      if (ev.type === 'note') {
        const card = document.getElementById(`lc-${ev.letter}`);
        if (card) card.classList.add('lit');
        document.getElementById('current-note').textContent =
          `${ev.letter}  →  ${ev.noteName}`;
      } else {
        document.getElementById('current-note').textContent = '·';
      }
    }, tms));

    elapsed += ev.slotDur;
  });

  // End of playback
  uiTimeouts.push(setTimeout(() => stopPlayback(false), elapsed * 1000 + 150));
}

function stopPlayback(reset = true) {
  playing = false;
  uiTimeouts.forEach(clearTimeout);
  uiTimeouts = [];
  killAudio();

  document.getElementById('play-btn').disabled = false;
  document.getElementById('stop-btn').disabled = true;
  document.querySelectorAll('.letter-card.lit').forEach(c => c.classList.remove('lit'));

  if (reset) {
    document.getElementById('current-note').textContent = '—';
    document.querySelectorAll('.ch').forEach(s => s.classList.remove('active', 'played'));
  } else {
    document.querySelectorAll('.ch.active').forEach(s => {
      s.classList.remove('active'); s.classList.add('played');
    });
    const el = document.getElementById('current-note');
    el.textContent = '✓';
    setTimeout(() => { el.textContent = '—'; }, 1200);
  }
}

// ── Display builders ──────────────────────────────────────────────────────────

function buildTextDisplay(text) {
  const display = document.getElementById('note-display');
  display.innerHTML = '';
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    const span = document.createElement('span');
    span.className = 'ch' + (ch === ' ' ? ' space' : '');
    span.dataset.i = i;
    span.textContent = ch === ' ' ? ' ' : ch;
    display.appendChild(span);
  }
}

function updateMappingGrid() {
  const rootSemi = parseInt(document.getElementById('key-select').value);
  const mode     = document.querySelector('.toggle-btn.active').dataset.mode;

  const grid = document.getElementById('mapping-grid');
  grid.innerHTML = '';

  for (let i = 0; i < 26; i++) {
    const letter = String.fromCharCode(65 + i);
    const name   = letterNoteName(letter, rootSemi, mode);

    const card   = document.createElement('div');
    card.className = 'letter-card';
    card.id = `lc-${letter}`;
    card.innerHTML =
      `<div class="lc-letter">${letter}</div><div class="lc-note">${name}</div>`;
    grid.appendChild(card);
  }

  document.getElementById('key-label').textContent =
    KEY_NAMES[mode][rootSemi] || `${rootSemi} ${mode}`;
}

// ── Init ──────────────────────────────────────────────────────────────────────

document.addEventListener('DOMContentLoaded', () => {

  // Mode toggle
  document.querySelectorAll('.toggle-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.toggle-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      updateMappingGrid();
    });
  });

  // Key select
  document.getElementById('key-select').addEventListener('change', updateMappingGrid);

  // Tempo
  document.getElementById('tempo-input').addEventListener('input', function () {
    document.getElementById('tempo-val').textContent = this.value;
  });

  // Text live preview
  document.getElementById('text-input').addEventListener('input', function () {
    if (!playing) {
      if (this.value.trim()) {
        buildTextDisplay(this.value);
      } else {
        document.getElementById('note-display').innerHTML =
          '<span class="hint">Press ▶ Play to hear your text as music</span>';
      }
    }
  });

  // Buttons
  document.getElementById('play-btn').addEventListener('click', startPlayback);
  document.getElementById('stop-btn').addEventListener('click', () => stopPlayback(true));

  // Space bar shortcut (not when typing in textarea)
  document.addEventListener('keydown', e => {
    if (e.code === 'Space' && e.target.tagName !== 'TEXTAREA') {
      e.preventDefault();
      playing ? stopPlayback(true) : startPlayback();
    }
  });

  updateMappingGrid();
});
