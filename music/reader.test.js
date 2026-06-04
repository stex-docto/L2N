import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { readText }           from './reader.js';
import { Note, Rest, Score }  from './domain.js';

// Shorthand: read a single character with given settings
const read = (text, overrides = {}) =>
  readText(text, { rootSemi: 9, mode: 'major', merge: false, ...overrides });

// ── Score ─────────────────────────────────────────────────────────────────────

describe('Score', () => {
  it('returns a Score', () => {
    assert.ok(read('A') instanceof Score);
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

  it('merge=true: rests are never merged (3 spaces → 3 rests)', () => {
    const events = read('   ', { merge: true }).events;
    assert.equal(events.length, 3);
    events.forEach(e => assert.ok(e instanceof Rest));
    events.forEach(e => assert.equal(e.beats, 1));
  });

  it('merge=true: case-insensitive — "aA" merges into 1 note of 2 beats', () => {
    const events = read('aA', { merge: true }).events;
    assert.equal(events.length, 1);
    assert.equal(events[0].beats, 2);
  });

  it('merge=true: cyclic same note — "AH" (A and H both → base A) → 1 note of 2 beats', () => {
    const events = read('AH', { merge: true }).events;
    assert.equal(events.length, 1);
    assert.equal(events[0].beats, 2);
    assert.equal(events[0].baseLetter, 'A');
  });

  it('merge=true: cyclic same note — "AHO" → 1 note of 3 beats', () => {
    const events = read('AHO', { merge: true }).events;
    assert.equal(events.length, 1);
    assert.equal(events[0].beats, 3);
  });

  it('merge=true: cyclic merge stops at different base letter — "AHOB" → A(3) B(1)', () => {
    const events = read('AHOB', { merge: true }).events;
    assert.equal(events.length, 2);
    assert.equal(events[0].beats, 3);
    assert.equal(events[1].beats, 1);
    assert.equal(events[1].baseLetter, 'B');
  });

  it('merge=true: note-rest-note stays 3 events', () => {
    const events = read('A A', { merge: true }).events;
    assert.equal(events.length, 3);
    assert.ok(events[0] instanceof Note);
    assert.ok(events[1] instanceof Rest);
    assert.ok(events[2] instanceof Note);
    assert.equal(events[0].beats, 1);
    assert.equal(events[2].beats, 1);
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

// ── All 24 key signatures — "ABCDEFG" as canonical test vector ────────────────
//
// Each row: [rootSemi, mode, label, [solName, midi] × 7 for A B C D E F G]

const SCALE_TABLE = [
  // ── Major ──────────────────────────────────────────────────────────────────
  // C  major — no alterations
  [0,  'major', 'C major',      [['La',69],['Si',71],['Do', 60],['Ré', 62],['Mi', 64],['Fa', 65], ['Sol',67]]],
  // G  major — F#
  [7,  'major', 'G major',      [['La',69],['Si',71],['Do', 60],['Ré', 62],['Mi', 64],['Fa#',66], ['Sol',67]]],
  // D  major — F# C#
  [2,  'major', 'D major',      [['La',69],['Si',71],['Do#',61],['Ré', 62],['Mi', 64],['Fa#',66], ['Sol',67]]],
  // A  major — F# C# G#
  [9,  'major', 'A major',      [['La',69],['Si',71],['Do#',61],['Ré', 62],['Mi', 64],['Fa#',66], ['Sol#',68]]],
  // E  major — F# C# G# D#
  [4,  'major', 'E major',      [['La',69],['Si',71],['Do#',61],['Ré#',63],['Mi', 64],['Fa#',66], ['Sol#',68]]],
  // B  major — F# C# G# D# A#
  [11, 'major', 'B major',      [['La#',70],['Si',71],['Do#',61],['Ré#',63],['Mi', 64],['Fa#',66],['Sol#',68]]],
  // F# major — F# C# G# D# A# E#
  [6,  'major', 'F#/Gb major',  [['La#',70],['Si',71],['Do#',61],['Ré#',63],['Mi#',65],['Fa#',66],['Sol#',68]]],
  // F  major — Bb
  [5,  'major', 'F major',      [['La',69],['Sib',70],['Do', 60],['Ré', 62],['Mi', 64],['Fa', 65],['Sol',67]]],
  // Bb major — Bb Eb
  [10, 'major', 'Bb major',     [['La',69],['Sib',70],['Do', 60],['Ré', 62],['Mib',63],['Fa', 65],['Sol',67]]],
  // Eb major — Bb Eb Ab
  [3,  'major', 'Eb major',     [['Lab',68],['Sib',70],['Do', 60],['Ré', 62],['Mib',63],['Fa', 65],['Sol',67]]],
  // Ab major — Bb Eb Ab Db
  [8,  'major', 'Ab major',     [['Lab',68],['Sib',70],['Do', 60],['Réb',61],['Mib',63],['Fa', 65],['Sol',67]]],
  // Db major — Bb Eb Ab Db Gb
  [1,  'major', 'Db major',     [['Lab',68],['Sib',70],['Do', 60],['Réb',61],['Mib',63],['Fa', 65],['Solb',66]]],

  // ── Minor ──────────────────────────────────────────────────────────────────
  // A  minor — no alterations
  [9,  'minor', 'A minor',      [['La',69],['Si',71],['Do', 60],['Ré', 62],['Mi', 64],['Fa', 65], ['Sol',67]]],
  // E  minor — F#
  [4,  'minor', 'E minor',      [['La',69],['Si',71],['Do', 60],['Ré', 62],['Mi', 64],['Fa#',66], ['Sol',67]]],
  // B  minor — F# C#
  [11, 'minor', 'B minor',      [['La',69],['Si',71],['Do#',61],['Ré', 62],['Mi', 64],['Fa#',66], ['Sol',67]]],
  // F# minor — F# C# G#
  [6,  'minor', 'F# minor',     [['La',69],['Si',71],['Do#',61],['Ré', 62],['Mi', 64],['Fa#',66], ['Sol#',68]]],
  // C# minor — F# C# G# D#
  [1,  'minor', 'C# minor',     [['La',69],['Si',71],['Do#',61],['Ré#',63],['Mi', 64],['Fa#',66], ['Sol#',68]]],
  // G# minor — F# C# G# D# A#
  [8,  'minor', 'G# minor',     [['La#',70],['Si',71],['Do#',61],['Ré#',63],['Mi', 64],['Fa#',66],['Sol#',68]]],
  // D# minor — F# C# G# D# A# E#
  [3,  'minor', 'D# minor',     [['La#',70],['Si',71],['Do#',61],['Ré#',63],['Mi#',65],['Fa#',66],['Sol#',68]]],
  // D  minor — Bb
  [2,  'minor', 'D minor',      [['La',69],['Sib',70],['Do', 60],['Ré', 62],['Mi', 64],['Fa', 65],['Sol',67]]],
  // G  minor — Bb Eb
  [7,  'minor', 'G minor',      [['La',69],['Sib',70],['Do', 60],['Ré', 62],['Mib',63],['Fa', 65],['Sol',67]]],
  // C  minor — Bb Eb Ab
  [0,  'minor', 'C minor',      [['Lab',68],['Sib',70],['Do', 60],['Ré', 62],['Mib',63],['Fa', 65],['Sol',67]]],
  // F  minor — Bb Eb Ab Db
  [5,  'minor', 'F minor',      [['Lab',68],['Sib',70],['Do', 60],['Réb',61],['Mib',63],['Fa', 65],['Sol',67]]],
  // Bb minor — Bb Eb Ab Db Gb
  [10, 'minor', 'Bb minor',     [['Lab',68],['Sib',70],['Do', 60],['Réb',61],['Mib',63],['Fa', 65],['Solb',66]]],
];

const LETTERS = ['A','B','C','D','E','F','G'];

for (const [rootSemi, mode, label, expected] of SCALE_TABLE) {
  describe(`All notes — ${label}`, () => {
    const events = readText('ABCDEFG', { rootSemi, mode, merge: false }).events;

    for (let i = 0; i < LETTERS.length; i++) {
      const letter            = LETTERS[i];
      const [solName, midi]   = expected[i];

      it(`${letter} → ${solName} (midi ${midi})`, () => {
        const n = events[i];
        assert.ok(n instanceof Note, `expected Note for ${letter}`);
        assert.equal(n.solName, solName, `solName mismatch for ${letter}`);
        assert.equal(n.midi,    midi,    `midi mismatch for ${letter}`);
      });
    }
  });
}

// ── Phrase: "This is a test" in all 24 key signatures ────────────────────────
//
// "This is a test" maps to base letters: F A B E [R] B E [R] A [R] F E E F
// Only A, B, E, F vary across keys — C, D, G don't appear in this phrase.
// That collapses 24 scales into 7 distinct output patterns.
//
// null = Rest, [solName, midi] = Note

const PHRASE_PATTERNS = {
  // A0 B0 E0 F0 — C major, A minor
  natural:            [['Fa',65],['La',69],['Si',71],['Mi',64],null,['Si',71],['Mi',64],null,['La',69],null,['Fa',65],['Mi',64],['Mi',64],['Fa',65]],
  // A0 B0 E0 F# — G/D/A/E major, E/B/F#/C# minor
  fsharp:             [['Fa#',66],['La',69],['Si',71],['Mi',64],null,['Si',71],['Mi',64],null,['La',69],null,['Fa#',66],['Mi',64],['Mi',64],['Fa#',66]],
  // A# B0 E0 F# — B major, G# minor
  fsharp_asharp:      [['Fa#',66],['La#',70],['Si',71],['Mi',64],null,['Si',71],['Mi',64],null,['La#',70],null,['Fa#',66],['Mi',64],['Mi',64],['Fa#',66]],
  // A# B0 E# F# — F#/Gb major, D# minor
  fsharp_asharp_esharp:[['Fa#',66],['La#',70],['Si',71],['Mi#',65],null,['Si',71],['Mi#',65],null,['La#',70],null,['Fa#',66],['Mi#',65],['Mi#',65],['Fa#',66]],
  // A0 Bb E0 F0 — F major, D minor
  bflat:              [['Fa',65],['La',69],['Sib',70],['Mi',64],null,['Sib',70],['Mi',64],null,['La',69],null,['Fa',65],['Mi',64],['Mi',64],['Fa',65]],
  // A0 Bb Eb F0 — Bb major, G minor
  bflat_eflat:        [['Fa',65],['La',69],['Sib',70],['Mib',63],null,['Sib',70],['Mib',63],null,['La',69],null,['Fa',65],['Mib',63],['Mib',63],['Fa',65]],
  // Ab Bb Eb F0 — Eb/Ab/Db major, C/F/Bb minor
  bflat_eflat_aflat:  [['Fa',65],['Lab',68],['Sib',70],['Mib',63],null,['Sib',70],['Mib',63],null,['Lab',68],null,['Fa',65],['Mib',63],['Mib',63],['Fa',65]],
};

const PHRASE_SCALE_TABLE = [
  [0,  'major', 'C major',     'natural'],
  [7,  'major', 'G major',     'fsharp'],
  [2,  'major', 'D major',     'fsharp'],
  [9,  'major', 'A major',     'fsharp'],
  [4,  'major', 'E major',     'fsharp'],
  [11, 'major', 'B major',     'fsharp_asharp'],
  [6,  'major', 'F#/Gb major', 'fsharp_asharp_esharp'],
  [5,  'major', 'F major',     'bflat'],
  [10, 'major', 'Bb major',    'bflat_eflat'],
  [3,  'major', 'Eb major',    'bflat_eflat_aflat'],
  [8,  'major', 'Ab major',    'bflat_eflat_aflat'],
  [1,  'major', 'Db major',    'bflat_eflat_aflat'],
  [9,  'minor', 'A minor',     'natural'],
  [4,  'minor', 'E minor',     'fsharp'],
  [11, 'minor', 'B minor',     'fsharp'],
  [6,  'minor', 'F# minor',    'fsharp'],
  [1,  'minor', 'C# minor',    'fsharp'],
  [8,  'minor', 'G# minor',    'fsharp_asharp'],
  [3,  'minor', 'D# minor',    'fsharp_asharp_esharp'],
  [2,  'minor', 'D minor',     'bflat'],
  [7,  'minor', 'G minor',     'bflat_eflat'],
  [0,  'minor', 'C minor',     'bflat_eflat_aflat'],
  [5,  'minor', 'F minor',     'bflat_eflat_aflat'],
  [10, 'minor', 'Bb minor',    'bflat_eflat_aflat'],
];

// Readable position labels matching "This is a test"
const PHRASE_LABELS = ['T','h','i','s',' ','i','s',' ','a',' ','t','e','s','t'];

for (const [rootSemi, mode, label, patternKey] of PHRASE_SCALE_TABLE) {
  describe(`"This is a test" — ${label}`, () => {
    const expected = PHRASE_PATTERNS[patternKey];
    const events   = readText('This is a test', { rootSemi, mode, merge: false }).events;

    it('produces 14 events', () => {
      assert.equal(events.length, 14);
    });

    for (let i = 0; i < expected.length; i++) {
      const ch  = PHRASE_LABELS[i];
      const exp = expected[i];

      if (exp === null) {
        it(`pos ${i} '${ch}' → Rest`, () => {
          assert.ok(events[i] instanceof Rest);
        });
      } else {
        const [solName, midi] = exp;
        it(`pos ${i} '${ch}' → ${solName} (midi ${midi})`, () => {
          const n = events[i];
          assert.ok(n instanceof Note);
          assert.equal(n.solName, solName);
          assert.equal(n.midi,    midi);
        });
      }
    }
  });
}
