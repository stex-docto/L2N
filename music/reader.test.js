import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { readText }           from './reader.js';
import { Note, Rest, Score }  from './domain.js';

// Shorthand: read a single character with given settings
const read = (text, overrides = {}) =>
  readText(text, { rootSemi: 9, mode: 'major', tempo: 120, merge: false, ...overrides });

// ── Score ─────────────────────────────────────────────────────────────────────

describe('Score', () => {
  it('returns a Score', () => {
    assert.ok(read('A') instanceof Score);
  });

  it('carries tempo and beatSec', () => {
    const score = read('A', { tempo: 60 });
    assert.equal(score.tempo, 60);
    assert.equal(score.beatSec, 1);
  });

  it('is empty for blank text', () => {
    assert.equal(read('').events.length, 0);
  });
});

// ── Letter → Note mapping ─────────────────────────────────────────────────────

describe('Letter → Note (natural, A minor — no alterations)', () => {
  const nat = text => read(text, { rootSemi: 9, mode: 'minor' }).events[0];

  it('A → La (A4, midi 69)', () => {
    const n = nat('A');
    assert.ok(n instanceof Note);
    assert.equal(n.letter,     'A');
    assert.equal(n.baseLetter, 'A');
    assert.equal(n.solName,    'La');
    assert.equal(n.midi,       69);
    assert.equal(n.alt,        0);
  });

  it('B → Si (B4, midi 71)', () => {
    const n = nat('B');
    assert.equal(n.solName, 'Si');
    assert.equal(n.midi,    71);
  });

  it('C → Do (C4, midi 60)', () => {
    const n = nat('C');
    assert.equal(n.solName, 'Do');
    assert.equal(n.midi,    60);
  });

  it('D → Ré (D4, midi 62)', () => {
    assert.equal(nat('D').solName, 'Ré');
  });

  it('E → Mi (E4, midi 64)', () => {
    assert.equal(nat('E').solName, 'Mi');
  });

  it('F → Fa (F4, midi 65)', () => {
    assert.equal(nat('F').solName, 'Fa');
  });

  it('G → Sol (G4, midi 67)', () => {
    assert.equal(nat('G').solName, 'Sol');
  });
});

// ── Modulo-7 cycling ──────────────────────────────────────────────────────────

describe('Modulo-7 cycling (H–Z)', () => {
  const nat = text => read(text, { rootSemi: 9, mode: 'minor' }).events[0];

  it('H shares baseLetter A (same pitch as A)', () => {
    const a = nat('A');
    const h = nat('H');
    assert.equal(h.baseLetter, 'A');
    assert.equal(h.midi, a.midi);
  });

  it('I shares baseLetter B', () => {
    assert.equal(nat('I').baseLetter, 'B');
  });

  it('Z has baseLetter E (25 % 7 = 4 → E)', () => {
    assert.equal(nat('Z').baseLetter, 'E');
  });

  it('lowercase is treated identically to uppercase', () => {
    const upper = read('A').events[0];
    const lower = read('a').events[0];
    assert.equal(lower.midi,    upper.midi);
    assert.equal(lower.solName, upper.solName);
  });
});

// ── Key signature alterations ─────────────────────────────────────────────────

describe('Sharps — A major (F# C# G#)', () => {
  const am = text => read(text, { rootSemi: 9, mode: 'major' }).events[0];

  it('F → Fa# (alt +1, midi 66)', () => {
    const n = am('F');
    assert.equal(n.alt,     1);
    assert.equal(n.solName, 'Fa#');
    assert.equal(n.midi,    66);
  });

  it('C → Do# (alt +1, midi 61)', () => {
    const n = am('C');
    assert.equal(n.alt,     1);
    assert.equal(n.solName, 'Do#');
    assert.equal(n.midi,    61);
  });

  it('G → Sol# (alt +1, midi 68)', () => {
    const n = am('G');
    assert.equal(n.alt,     1);
    assert.equal(n.solName, 'Sol#');
    assert.equal(n.midi,    68);
  });

  it('A stays natural (not in key sig)', () => {
    const n = am('A');
    assert.equal(n.alt,     0);
    assert.equal(n.solName, 'La');
  });
});

describe('Flats — F major (Bb)', () => {
  const fm = text => read(text, { rootSemi: 5, mode: 'major' }).events[0];

  it('B → Sib (alt -1, midi 70)', () => {
    const n = fm('B');
    assert.equal(n.alt,     -1);
    assert.equal(n.solName, 'Sib');
    assert.equal(n.midi,    70);
  });

  it('E stays natural', () => {
    const n = fm('E');
    assert.equal(n.alt, 0);
  });
});

describe('Flats — Eb major (Bb Eb Ab)', () => {
  const eb = text => read(text, { rootSemi: 3, mode: 'major' }).events[0];

  it('A → Lab (alt -1)', () => {
    assert.equal(eb('A').solName, 'Lab');
  });

  it('B → Sib (alt -1)', () => {
    assert.equal(eb('B').solName, 'Sib');
  });

  it('E → Mib (alt -1)', () => {
    assert.equal(eb('E').solName, 'Mib');
  });

  it('D stays natural', () => {
    assert.equal(eb('D').alt, 0);
  });
});

// ── Beat count ────────────────────────────────────────────────────────────────

describe('Beat count', () => {
  it('single letter = 1 beat', () => {
    assert.equal(read('A').events[0].beats, 1);
  });

  it('merge=false: each letter is 1 beat even when repeated', () => {
    const events = read('AAA', { merge: false }).events;
    assert.equal(events.length, 3);
    events.forEach(e => assert.equal(e.beats, 1));
  });

  it('merge=true: AAA → 1 note of 3 beats', () => {
    const events = read('AAA', { merge: true }).events;
    assert.equal(events.length, 1);
    assert.equal(events[0].beats, 3);
  });

  it('merge=true: AABB → A(2) B(2)', () => {
    const events = read('AABB', { merge: true }).events;
    assert.equal(events.length, 2);
    assert.equal(events[0].beats, 2);
    assert.equal(events[1].beats, 2);
  });

  it('merge=true: ABA → three separate notes', () => {
    const events = read('ABA', { merge: true }).events;
    assert.equal(events.length, 3);
    events.forEach(e => assert.equal(e.beats, 1));
  });
});

// ── Rests ─────────────────────────────────────────────────────────────────────

describe('Rests', () => {
  it('space → Rest', () => {
    const ev = read('A B').events[1];
    assert.ok(ev instanceof Rest);
    assert.equal(ev.type, 'rest');
  });

  it('non-letter character → Rest', () => {
    const ev = read('A!B').events[1];
    assert.ok(ev instanceof Rest);
  });

  it('rest has 1 beat', () => {
    assert.equal(read(' ').events[0].beats, 1);
  });

  it('sequence: Note Rest Note', () => {
    const evs = read('A B').events;
    assert.equal(evs.length, 3);
    assert.ok(evs[0] instanceof Note);
    assert.ok(evs[1] instanceof Rest);
    assert.ok(evs[2] instanceof Note);
  });
});

// ── Frequency ────────────────────────────────────────────────────────────────

describe('Frequency', () => {
  it('A (midi 69) = 440 Hz', () => {
    const n = read('A', { rootSemi: 9, mode: 'minor' }).events[0];
    assert.equal(n.midi,  69);
    assert.equal(n.freq,  440);
  });

  it('freq is consistent with midi', () => {
    const n = read('C', { rootSemi: 9, mode: 'minor' }).events[0];
    const expected = 440 * Math.pow(2, (60 - 69) / 12);
    assert.equal(n.freq, expected);
  });
});
