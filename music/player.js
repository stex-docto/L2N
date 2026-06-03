// ── Playing Bounded Context ───────────────────────────────────────────────────
//
// Transforms a Score into sound via the Web Audio API.
// Knows nothing about text or visual rendering.

let _ctx     = null;
let _oscs    = [];   // { osc, gain }[]
let _timers  = [];

function audioCtx() {
  if (!_ctx) _ctx = new (window.AudioContext || window.webkitAudioContext)();
  if (_ctx.state === 'suspended') _ctx.resume();
  return _ctx;
}

function _scheduleOsc(freq, duration, startTime) {
  const ac = audioCtx();

  function makeOsc(type, detuneC, vol) {
    const osc  = ac.createOscillator();
    const gain = ac.createGain();
    osc.type          = type;
    osc.frequency.value = freq;
    osc.detune.value  = detuneC;

    const atk    = Math.min(0.025, duration * 0.08);
    const rel    = Math.min(0.12,  duration * 0.25);
    const susEnd = Math.max(startTime + atk, startTime + duration - rel);

    gain.gain.setValueAtTime(0, startTime);
    gain.gain.linearRampToValueAtTime(vol, startTime + atk);
    gain.gain.setValueAtTime(vol, susEnd);
    gain.gain.exponentialRampToValueAtTime(0.0001, startTime + duration);

    osc.connect(gain);
    gain.connect(ac.destination);
    osc.start(startTime);
    osc.stop(startTime + duration + 0.05);
    _oscs.push({ osc, gain });
  }

  const vol = freq > midiToFreq(80) ? 0.18 : 0.26;
  makeOsc('triangle', 0,  vol);
  makeOsc('sine',     7,  vol * 0.35);
}

function midiToFreq(midi) { return 440 * Math.pow(2, (midi - 69) / 12); }

function _killAudio() {
  if (!_ctx) return;
  const now = _ctx.currentTime;
  _oscs.forEach(({ osc, gain }) => {
    try {
      gain.gain.cancelScheduledValues(now);
      gain.gain.setValueAtTime(0, now);
      osc.stop(now + 0.015);
    } catch (_) {}
    setTimeout(() => { try { osc.disconnect(); gain.disconnect(); } catch (_) {} }, 60);
  });
  _oscs = [];
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Play a Score at the given tempo.
 * @param {Score} score
 * @param {number} tempo  BPM — audio concern, not part of the domain
 * @param {{ onEventStart: (idx, event) => void, onDone: () => void }} callbacks
 */
export function playScore(score, tempo, { onEventStart, onDone }) {
  _killAudio();
  _timers.forEach(clearTimeout);
  _timers = [];

  const beatSec = 60 / tempo;
  const ac = audioCtx();
  const t0 = ac.currentTime + 0.06;
  let elapsed = 0;

  score.events.forEach((ev, evIdx) => {
    const slotSec = ev.beats * beatSec;

    if (ev.type === 'note') {
      // Single unmerged note: 40 ms gap for re-articulation.
      // Merged notes: full legato duration.
      const audioDur = ev.beats === 1
        ? Math.max(slotSec * 0.5, slotSec - 0.04)
        : slotSec;
      _scheduleOsc(ev.freq, audioDur, t0 + elapsed);
    }

    _timers.push(setTimeout(() => onEventStart(evIdx, ev), elapsed * 1000));
    elapsed += slotSec;
  });

  _timers.push(setTimeout(onDone, elapsed * 1000 + 150));
}

export function stopPlayback() {
  _killAudio();
  _timers.forEach(clearTimeout);
  _timers = [];
}
