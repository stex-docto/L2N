// ── Scales & naming ───────────────────────────────────────────────────────────

const MAJOR = [0, 2, 4, 5, 7, 9, 11];
const MINOR = [0, 2, 3, 5, 7, 8, 10];

// Both sharp and flat names — we pick sharp for display (cleaner in context)
const SOL_NAMES = ['Do','Do#','Ré','Ré#','Mi','Fa','Fa#','Sol','Sol#','La','La#','Si'];
const FULL_KEY_NAMES = [
  'Do Maj','Do#/Réb Maj','Ré Maj','Ré#/Mib Maj','Mi Maj','Fa Maj',
  'Fa#/Solb Maj','Sol Maj','Sol#/Lab Maj','La Maj','La#/Sib Maj','Si Maj'
];

// Mapping starts at C3 (MIDI 48).
// Letter index 0 (A) → root of chosen key at octave 3.
// Every 7 letters = one octave up.
const BASE_MIDI = 48;

// ── Note math ─────────────────────────────────────────────────────────────────

function letterMidi(letter, rootSemi, mode) {
  const idx   = letter.toUpperCase().charCodeAt(0) - 65;   // 0-25
  const deg   = idx % 7;
  const scale = mode === 'major' ? MAJOR : MINOR;
  return BASE_MIDI + rootSemi + scale[deg];
}

function midiToFreq(midi) {
  return 440 * Math.pow(2, (midi - 69) / 12);
}

function midiName(midi) {
  const octave = Math.floor(midi / 12) - 1;
  return SOL_NAMES[midi % 12] + octave;
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
      const midi    = letterMidi(ch, rootSemi, mode);
      const slotDur = beatSec * count;
      // Unmerged (single) notes: play 80% of the slot so back-to-back same-
      // frequency notes have a clear gap and sound distinct from a linked note.
      const audioDur = count === 1 ? slotDur * 0.80 : slotDur;
      events.push({
        type:        'note',
        letter:      ch,
        midi,
        noteName:    midiName(midi),
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
    const midi   = letterMidi(letter, rootSemi, mode);
    const name   = midiName(midi);

    const card   = document.createElement('div');
    card.className = 'letter-card';
    card.id = `lc-${letter}`;
    card.innerHTML =
      `<div class="lc-letter">${letter}</div><div class="lc-note">${name}</div>`;
    grid.appendChild(card);
  }

  const keyName  = SOL_NAMES[rootSemi];
  const modeName = mode === 'major' ? 'Majeur' : 'Mineur';
  document.getElementById('key-label').textContent = `${keyName} ${modeName}`;
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
