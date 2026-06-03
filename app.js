// ── Note mapping ──────────────────────────────────────────────────────────────
//
// Fixed assignment: A=La(A4), B=Si(B4), C=Do(C4), D=Ré(D4),
//                   E=Mi(E4), F=Fa(F4), G=Sol(G4) — then modulo 7 for H-Z.
// Choosing a key/mode only applies the key signature's alterations
// (sharps or flats) to the base natural notes.

const NATURAL_MIDI = { A:69, B:71, C:60, D:62, E:64, F:65, G:67 };
const LETTER_SOL   = { A:'La', B:'Si', C:'Do', D:'Ré', E:'Mi', F:'Fa', G:'Sol' };

// Key signatures: which base letter names get +1 (sharp) or -1 (flat).
const KEY_SIGS = {
  major: {
    0:  {},
    7:  { F:1 },
    2:  { F:1, C:1 },
    9:  { F:1, C:1, G:1 },
    4:  { F:1, C:1, G:1, D:1 },
    11: { F:1, C:1, G:1, D:1, A:1 },
    6:  { F:1, C:1, G:1, D:1, A:1, E:1 },
    5:  { B:-1 },
    10: { B:-1, E:-1 },
    3:  { B:-1, E:-1, A:-1 },
    8:  { B:-1, E:-1, A:-1, D:-1 },
    1:  { B:-1, E:-1, A:-1, D:-1, G:-1 },
  },
  minor: {
    9:  {},
    4:  { F:1 },
    11: { F:1, C:1 },
    6:  { F:1, C:1, G:1 },
    1:  { F:1, C:1, G:1, D:1 },
    8:  { F:1, C:1, G:1, D:1, A:1 },
    3:  { F:1, C:1, G:1, D:1, A:1, E:1 },
    2:  { B:-1 },
    7:  { B:-1, E:-1 },
    0:  { B:-1, E:-1, A:-1 },
    5:  { B:-1, E:-1, A:-1, D:-1 },
    10: { B:-1, E:-1, A:-1, D:-1, G:-1 },
  }
};

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
  return String.fromCharCode(65 + (idx % 7));
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
let scheduledOscs = [];

function ctx() {
  if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  if (audioCtx.state === 'suspended') audioCtx.resume();
  return audioCtx;
}

function scheduleNote(midi, duration, startTime) {
  const ac = ctx();
  const freq = midiToFreq(midi);

  function makeOsc(type, detuneC, vol) {
    const osc  = ac.createOscillator();
    const gain = ac.createGain();
    osc.type = type;
    osc.frequency.value = freq;
    osc.detune.value = detuneC;

    const atk    = Math.min(0.025, duration * 0.08);
    const rel    = Math.min(0.12, duration * 0.25);
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
        type:     'note',
        letter:   ch,
        midi,
        noteName: letterNoteName(ch, rootSemi, mode),
        beats:    count,
        slotDur,
        audioDur,
      });
      i += count;

    } else if (ch === ' ') {
      events.push({ type: 'rest', beats: 1, slotDur: beatSec, audioDur: 0 });
      i++;

    } else {
      events.push({ type: 'rest', beats: 1, slotDur: beatSec * 0.5, audioDur: 0 });
      i++;
    }
  }

  return events;
}

// ── Sheet music ───────────────────────────────────────────────────────────────

let vfNoteMap = {};  // eventIdx → VF StaveNote (first visual note for the event)

function letterToVFKey(letter, rootSemi, mode) {
  const bl  = baseLetter(letter);
  const alt = (KEY_SIGS[mode][rootSemi] || {})[bl] || 0;
  const acc = alt === 1 ? '#' : alt === -1 ? 'b' : '';
  return `${bl.toLowerCase()}${acc}/4`;
}

// Beat count → { dur, dots } for VexFlow 5 (dotted notes need explicit dots)
function beatsToDur(beats) {
  if (beats >= 4) return { dur: 'w', dots: 0 };
  if (beats >= 3) return { dur: 'h', dots: 1 };
  if (beats >= 2) return { dur: 'h', dots: 0 };
  return { dur: 'q', dots: 0 };
}

function makeVFNote({ beats, key, alt, isRest }) {
  const { StaveNote, Accidental, Dot } = VexFlow;
  const { dur, dots } = beatsToDur(beats);
  const n = new StaveNote({
    keys:     [isRest ? 'b/4' : key],
    duration: isRest ? `${dur}r` : dur,
    dots,
  });
  if (dots) n.addDotToAll();
  if (!isRest && alt) n.addModifier(new Accidental(alt > 0 ? '#' : 'b'), 0);
  return n;
}

// Decompose a beat count into valid VF durations (largest first)
function splitBeats(total) {
  const out = [];
  let r = total;
  for (const d of [4, 3, 2, 1]) {
    while (r >= d - 0.01) { out.push(d); r -= d; }
  }
  return out.length ? out : [1];
}

function renderSheetMusic(events, rootSemi, mode, tempo) {
  vfNoteMap = {};
  const container = document.getElementById('sheet-music');
  container.innerHTML = '';

  if (!events.length || typeof VexFlow === 'undefined') return;

  const { Renderer, Stave, Voice, Formatter, StaveTie } = VexFlow;
  const beatSec = 60 / tempo;

  // ── 1. Flatten events → render items ────────────────────────────────────────
  // Each item: { isNote, beats, key, alt, evIdx, first }
  // Merged notes > 4 beats are split; ties connect the pieces.
  const items = [];

  events.forEach((ev, evIdx) => {
    const rawBeats = Math.max(1, Math.round(ev.slotDur / beatSec));

    if (ev.type === 'note') {
      const key   = letterToVFKey(ev.letter, rootSemi, mode);
      const alt   = (KEY_SIGS[mode][rootSemi] || {})[baseLetter(ev.letter)] || 0;
      const parts = splitBeats(rawBeats);
      parts.forEach((b, pi) => {
        items.push({
          isNote: true,
          beats:  b,
          key, alt, evIdx,
          first:    pi === 0,
          tieFrom:  pi > 0,
          tieTo:    pi < parts.length - 1,
        });
      });
    } else {
      // Rest — keep max 4 beats per item
      splitBeats(Math.min(4, Math.max(1, rawBeats))).forEach(b => {
        items.push({ isNote: false, beats: b, evIdx });
      });
    }
  });

  // ── 2. Pack into 4-beat measures ─────────────────────────────────────────────
  const BEATS_PER_MEASURE = 4;
  const measures = [];
  let cur = [], curB = 0;

  function pushMeasure() {
    // pad remaining space with rests
    const pad = BEATS_PER_MEASURE - curB;
    if (pad > 0.01) {
      splitBeats(pad).forEach(b =>
        cur.push({ isNote: false, beats: b, evIdx: -1, isPad: true })
      );
    }
    measures.push(cur);
    cur = []; curB = 0;
  }

  for (const item of items) {
    if (curB + item.beats > BEATS_PER_MEASURE + 0.01) pushMeasure();
    cur.push(item);
    curB += item.beats;
    if (Math.abs(curB - BEATS_PER_MEASURE) < 0.01) pushMeasure();
  }
  if (cur.length) pushMeasure();
  if (!measures.length) return;

  // ── 3. Render ────────────────────────────────────────────────────────────────
  const W   = Math.max(400, container.clientWidth || 700);
  const mpr = Math.max(1, Math.floor((W - 30) / 230));  // measures per row
  const sw  = Math.floor((W - 30) / mpr);                // stave width
  const RH  = 140;
  const rows = Math.ceil(measures.length / mpr);

  const renderer = new Renderer(container, Renderer.Backends.SVG);
  renderer.resize(W, rows * RH + 20);
  const gCtx = renderer.getContext();

  // Collect tie pairs: { fromNote, toNote }
  const tiePairs = [];
  let pendingTie = null;  // { note: VF.StaveNote }

  measures.forEach((mItems, mIdx) => {
    const row = Math.floor(mIdx / mpr);
    const col = mIdx % mpr;
    const x   = col * sw + 15;
    const y   = row * RH + 35;

    const stave = new Stave(x, y, sw - 5);
    if (col === 0)  stave.addClef('treble');
    if (mIdx === 0) stave.addTimeSignature('4/4');
    stave.setContext(gCtx).draw();

    const vfNotes = mItems.map(item => {
      if (item.isNote) {
        const n = makeVFNote({ beats: item.beats, key: item.key, alt: item.alt });
        if (item.evIdx >= 0 && item.first) vfNoteMap[item.evIdx] = n;
        if (item.tieFrom && pendingTie) tiePairs.push({ from: pendingTie.note, to: n });
        pendingTie = item.tieTo ? { note: n } : null;
        return n;
      }
      pendingTie = null;
      return makeVFNote({ beats: item.beats, isRest: true });
    });

    // Intra-measure ties
    mItems.forEach((item, i) => {
      if (item.tieTo && i + 1 < mItems.length && mItems[i + 1].tieFrom) {
        tiePairs.push({ from: vfNotes[i], to: vfNotes[i + 1] });
      }
    });

    try {
      const voice = new Voice({ num_beats: BEATS_PER_MEASURE, beat_value: 4 });
      voice.setStrict(false);
      voice.addTickables(vfNotes);
      new Formatter().joinVoices([voice]).formatToStave([voice], stave);
      voice.draw(gCtx, stave);
    } catch (e) { console.warn('VexFlow measure', mIdx, e); }
  });

  // Draw ties after all notes are positioned
  tiePairs.forEach(({ from, to }) => {
    try {
      new StaveTie({
        first_note: from, last_note: to,
        first_indices: [0], last_indices: [0],
      }).setContext(gCtx).draw();
    } catch (_) {}
  });
}

function highlightSheetNote(evIdx) {
  document.getElementById('sheet-music')
    .querySelectorAll('.vf-active').forEach(el => el.classList.remove('vf-active'));
  const note = vfNoteMap[evIdx];
  if (note?.attrs?.el) note.attrs.el.classList.add('vf-active');
}

let _refreshTimer = null;
function scheduleSheetRefresh() {
  clearTimeout(_refreshTimer);
  _refreshTimer = setTimeout(() => {
    if (playing) return;
    const text = document.getElementById('text-input').value;
    if (!text.trim()) { document.getElementById('sheet-music').innerHTML = ''; return; }
    const rootSemi = parseInt(document.getElementById('key-select').value);
    const mode     = document.querySelector('.toggle-btn.active').dataset.mode;
    const tempo    = parseInt(document.getElementById('tempo-input').value);
    const merge    = document.getElementById('merge-repeats').checked;
    const beatSec  = 60 / tempo;
    renderSheetMusic(buildEvents(text, rootSemi, mode, beatSec, merge), rootSemi, mode, tempo);
  }, 280);
}

// ── Playback state ────────────────────────────────────────────────────────────

let playing    = false;
let uiTimeouts = [];

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

  renderSheetMusic(events, rootSemi, mode, tempo);

  playing = true;
  document.getElementById('play-btn').disabled = true;
  document.getElementById('stop-btn').disabled = false;

  const ac = ctx();
  const t0 = ac.currentTime + 0.06;
  let elapsed = 0;

  events.forEach((ev, evIdx) => {
    const evStart = elapsed;

    if (ev.type === 'note') {
      scheduleNote(ev.midi, ev.audioDur, t0 + evStart);
    }

    uiTimeouts.push(setTimeout(() => {
      if (!playing) return;

      highlightSheetNote(evIdx);

      // Grid card
      document.querySelectorAll('.letter-card.lit').forEach(c => c.classList.remove('lit'));
      if (ev.type === 'note') {
        document.getElementById(`lc-${ev.letter}`)?.classList.add('lit');
        document.getElementById('current-note').textContent =
          `${ev.letter}  →  ${ev.noteName}`;
      } else {
        document.getElementById('current-note').textContent = '·';
      }
    }, evStart * 1000));

    elapsed += ev.slotDur;
  });

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
  document.getElementById('sheet-music')
    .querySelectorAll('.vf-active').forEach(el => el.classList.remove('vf-active'));

  if (reset) {
    document.getElementById('current-note').textContent = '—';
  } else {
    const el = document.getElementById('current-note');
    el.textContent = '✓';
    setTimeout(() => { el.textContent = '—'; }, 1200);
  }
}

// ── Mapping grid ──────────────────────────────────────────────────────────────

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

  // Pre-load VexFlow fonts so first render is instant
  if (typeof VexFlow !== 'undefined') VexFlow.loadFonts().catch(() => {});

  document.querySelectorAll('.toggle-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.toggle-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      updateMappingGrid();
      scheduleSheetRefresh();
    });
  });

  document.getElementById('key-select').addEventListener('change', () => {
    updateMappingGrid();
    scheduleSheetRefresh();
  });

  document.getElementById('tempo-input').addEventListener('input', function () {
    document.getElementById('tempo-val').textContent = this.value;
    scheduleSheetRefresh();
  });

  document.getElementById('merge-repeats').addEventListener('change', scheduleSheetRefresh);

  document.getElementById('text-input').addEventListener('input', scheduleSheetRefresh);

  document.getElementById('play-btn').addEventListener('click', startPlayback);
  document.getElementById('stop-btn').addEventListener('click', () => stopPlayback(true));

  document.addEventListener('keydown', e => {
    if (e.code === 'Space' && e.target.tagName !== 'TEXTAREA') {
      e.preventDefault();
      playing ? stopPlayback(true) : startPlayback();
    }
  });

  updateMappingGrid();
});
