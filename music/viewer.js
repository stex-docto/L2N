// ── Viewing Bounded Context ───────────────────────────────────────────────────
//
// Renders a Score as sheet music using VexFlow.
// Knows nothing about text parsing or audio.

// ── VexFlow helpers ───────────────────────────────────────────────────────────

function vfKey(note) {
  const acc = note.alt === 1 ? '#' : note.alt === -1 ? 'b' : '';
  return `${note.baseLetter.toLowerCase()}${acc}/4`;
}

// Decompose beat count into valid note values (largest first)
function splitBeats(total) {
  const out = [];
  let r = total;
  for (const d of [4, 3, 2, 1]) {
    while (r >= d - 0.01) { out.push(d); r -= d; }
  }
  return out.length ? out : [1];
}

function noteShape(beats) {
  if (beats >= 4) return { dur: 'w', dots: 0 };
  if (beats >= 3) return { dur: 'h', dots: 1 };
  if (beats >= 2) return { dur: 'h', dots: 0 };
  return { dur: 'q', dots: 0 };
}

function makeVFNote({ beats, key, alt, isRest }) {
  const VF = window.VexFlow;
  const { dur, dots } = noteShape(beats);
  const n = new VF.StaveNote({
    keys:     [isRest ? 'b/4' : key],
    duration: isRest ? `${dur}r` : dur,
    dots,
  });
  if (dots)                n.addDotToAll();
  if (!isRest && alt !== 0) n.addModifier(new VF.Accidental(alt > 0 ? '#' : 'b'), 0);
  return n;
}

// ── Module state ──────────────────────────────────────────────────────────────

let _vfNoteMap = {};   // evIdx → VF.StaveNote (first visual note for the event)
let _container = null;

// ── Render ────────────────────────────────────────────────────────────────────

/**
 * Render a Score as sheet music into a DOM container.
 * @param {Score} score
 * @param {HTMLElement} container
 */
export function renderScore(score, container) {
  _vfNoteMap = {};
  _container = container;
  container.innerHTML = '';

  if (!score.events.length || typeof VexFlow === 'undefined') return;

  const VF = window.VexFlow;
  const { Renderer, Stave, Voice, Formatter, StaveTie } = VF;

  // ── 1. Flatten Score events → render items ────────────────────────────────
  // Items represent individual VexFlow notes/rests.
  // Merged notes with >4 beats are split and connected with ties.
  const items = [];

  score.events.forEach((ev, evIdx) => {
    if (ev.type === 'note') {
      const key   = vfKey(ev);
      const parts = splitBeats(ev.beats);
      parts.forEach((b, pi) => {
        items.push({
          isNote:  true,
          beats:   b,
          key,
          alt:     ev.alt,
          evIdx,
          first:   pi === 0,
          tieFrom: pi > 0,
          tieTo:   pi < parts.length - 1,
        });
      });
    } else {
      splitBeats(Math.min(4, ev.beats)).forEach(b => {
        items.push({ isNote: false, beats: b, evIdx });
      });
    }
  });

  // ── 2. Pack into 4-beat measures ─────────────────────────────────────────
  const BEATS = 4;
  const measures = [];
  let cur = [], curB = 0;

  function closeMeasure() {
    const pad = BEATS - curB;
    if (pad > 0.01) {
      splitBeats(pad).forEach(b =>
        cur.push({ isNote: false, beats: b, evIdx: -1 })
      );
    }
    measures.push(cur);
    cur = []; curB = 0;
  }

  for (const item of items) {
    if (curB + item.beats > BEATS + 0.01) closeMeasure();
    cur.push(item);
    curB += item.beats;
    if (Math.abs(curB - BEATS) < 0.01) closeMeasure();
  }
  if (cur.length) closeMeasure();
  if (!measures.length) return;

  // ── 3. Layout ─────────────────────────────────────────────────────────────
  const W   = Math.max(400, container.clientWidth || 700);
  const mpr = Math.max(1, Math.floor((W - 30) / 230));
  const sw  = Math.floor((W - 30) / mpr);
  const RH  = 140;
  const rows = Math.ceil(measures.length / mpr);

  const renderer = new Renderer(container, Renderer.Backends.SVG);
  renderer.resize(W, rows * RH + 20);
  const gCtx = renderer.getContext();

  const tiePairs   = [];
  let   pendingTie = null;

  // ── 4. Draw measures ──────────────────────────────────────────────────────
  measures.forEach((mItems, mIdx) => {
    const row = Math.floor(mIdx / mpr);
    const col = mIdx % mpr;
    const x   = col * sw + 15;
    const y   = row * RH + 35;

    const stave = new Stave(x, y, sw - 5);
    if (col === 0)  stave.addClef('treble');
    if (mIdx === 0) stave.addTimeSignature('4/4');
    stave.setContext(gCtx).draw();

    const vfNotes = mItems.map((item, i) => {
      const n = makeVFNote(item);

      if (item.isNote) {
        if (item.evIdx >= 0 && item.first) _vfNoteMap[item.evIdx] = n;
        if (item.tieFrom && pendingTie)    tiePairs.push({ from: pendingTie, to: n });
        pendingTie = item.tieTo ? n : null;
        // intra-measure tie
        if (item.tieTo && i + 1 < mItems.length) {
          tiePairs.push({ from: n, to: null, deferTo: i + 1, measure: mIdx });
        }
      } else {
        pendingTie = null;
      }

      return n;
    });

    try {
      const voice = new Voice({ num_beats: BEATS, beat_value: 4 });
      voice.setStrict(false);
      voice.addTickables(vfNotes);
      new Formatter().joinVoices([voice]).formatToStave([voice], stave);
      voice.draw(gCtx, stave);
    } catch (e) { console.warn('VexFlow measure', mIdx, e); }
  });

  // ── 5. Draw ties ──────────────────────────────────────────────────────────
  tiePairs
    .filter(p => p.from && p.to)
    .forEach(({ from, to }) => {
      try {
        new StaveTie({
          first_note:    from, last_note: to,
          first_indices: [0],  last_indices: [0],
        }).setContext(gCtx).draw();
      } catch (_) {}
    });
}

// ── Highlight ─────────────────────────────────────────────────────────────────

export function highlightEvent(evIdx) {
  if (!_container) return;
  _container.querySelectorAll('.vf-active').forEach(el => el.classList.remove('vf-active'));
  const note = _vfNoteMap[evIdx];
  if (note?.attrs?.el) note.attrs.el.classList.add('vf-active');
}

export function clearHighlights() {
  if (!_container) return;
  _container.querySelectorAll('.vf-active').forEach(el => el.classList.remove('vf-active'));
}
