// ── Music Domain — Published Language ─────────────────────────────────────────
//
// These types are the contract between all bounded contexts.
// Reading produces them. Viewing and Playing consume them.

// ── Constants ─────────────────────────────────────────────────────────────────

export const NATURAL_MIDI = { A:69, B:71, C:60, D:62, E:64, F:65, G:67 };
export const LETTER_SOL   = { A:'La', B:'Si', C:'Do', D:'Ré', E:'Mi', F:'Fa', G:'Sol' };

// Key signatures: which base letter names get +1 (sharp) or -1 (flat).
// Order of sharps: F C G D A E B — order of flats: B E A D G C F
export const KEY_SIGS = {
  major: {
    0:  {},                                       // C  major
    7:  { F:1 },                                  // G  major
    2:  { F:1, C:1 },                             // D  major
    9:  { F:1, C:1, G:1 },                        // A  major
    4:  { F:1, C:1, G:1, D:1 },                   // E  major
    11: { F:1, C:1, G:1, D:1, A:1 },              // B  major
    6:  { F:1, C:1, G:1, D:1, A:1, E:1 },         // F#/Gb major
    5:  { B:-1 },                                 // F  major
    10: { B:-1, E:-1 },                           // Bb major
    3:  { B:-1, E:-1, A:-1 },                     // Eb major
    8:  { B:-1, E:-1, A:-1, D:-1 },               // Ab major
    1:  { B:-1, E:-1, A:-1, D:-1, G:-1 },         // Db major
  },
  minor: {
    9:  {},                                       // A  minor
    4:  { F:1 },                                  // E  minor
    11: { F:1, C:1 },                             // B  minor
    6:  { F:1, C:1, G:1 },                        // F# minor
    1:  { F:1, C:1, G:1, D:1 },                   // C# minor
    8:  { F:1, C:1, G:1, D:1, A:1 },              // G# minor
    3:  { F:1, C:1, G:1, D:1, A:1, E:1 },         // D# minor
    2:  { B:-1 },                                 // D  minor
    7:  { B:-1, E:-1 },                           // G  minor
    0:  { B:-1, E:-1, A:-1 },                     // C  minor
    5:  { B:-1, E:-1, A:-1, D:-1 },               // F  minor
    10: { B:-1, E:-1, A:-1, D:-1, G:-1 },         // Bb minor
  },
};

export const KEY_NAMES = {
  major: {
    0:'Do Majeur',   7:'Sol Majeur',  2:'Ré Majeur',  9:'La Majeur',
    4:'Mi Majeur',   11:'Si Majeur',  6:'Fa#/Solb Majeur',
    5:'Fa Majeur',   10:'Sib Majeur', 3:'Mib Majeur',
    8:'Lab Majeur',  1:'Réb Majeur',
  },
  minor: {
    9:'La Mineur',   4:'Mi Mineur',   11:'Si Mineur', 6:'Fa# Mineur',
    1:'Do# Mineur',  8:'Sol# Mineur', 3:'Ré# Mineur',
    2:'Ré Mineur',   7:'Sol Mineur',  0:'Do Mineur',
    5:'Fa Mineur',   10:'Sib Mineur',
  },
};

// ── Helpers ───────────────────────────────────────────────────────────────────

// A–Z → A–G (modulo 7 cycling)
export function baseLetter(letter) {
  const idx = letter.toUpperCase().charCodeAt(0) - 65;
  return String.fromCharCode(65 + (idx % 7));
}

export function midiToFreq(midi) {
  return 440 * Math.pow(2, (midi - 69) / 12);
}

// Solfège display name for a letter in a given key signature
export function letterNoteName(letter, keySig) {
  const bl  = baseLetter(letter);
  const alt = keySig.altFor(bl);
  const acc = alt === 1 ? '#' : alt === -1 ? 'b' : '';
  return LETTER_SOL[bl] + acc;
}

// ── Domain types ──────────────────────────────────────────────────────────────

export class KeySignature {
  constructor(rootSemi, mode) {
    this.rootSemi = rootSemi;
    this.mode     = mode;
    this._alts    = (KEY_SIGS[mode] || {})[rootSemi] || {};
  }

  altFor(baseLtr) { return this._alts[baseLtr] || 0; }

  get name() { return (KEY_NAMES[this.mode] || {})[this.rootSemi] || ''; }
}

export class Note {
  constructor({ letter, baseLetter, alt, midi, freq, solName, beats }) {
    this.type       = 'note';
    this.letter     = letter;      // original letter (A–Z)
    this.baseLetter = baseLetter;  // A–G after modulo
    this.alt        = alt;         // -1 | 0 | +1
    this.midi       = midi;
    this.freq       = freq;
    this.solName    = solName;     // e.g. "Fa#"
    this.beats      = beats;       // duration in quarter-note beats
  }
}

export class Rest {
  constructor({ beats }) {
    this.type  = 'rest';
    this.beats = beats;
  }
}

export class Score {
  constructor({ events, keySig, tempo }) {
    this.events = events;   // (Note | Rest)[]
    this.keySig = keySig;   // KeySignature
    this.tempo  = tempo;    // BPM
  }

  get beatSec() { return 60 / this.tempo; }
}
