// ── Reading Bounded Context ───────────────────────────────────────────────────
//
// Reads raw text and expresses it in the Music published language.
// Knows nothing about audio or visual rendering.

import {
  baseLetter, midiToFreq, NATURAL_MIDI, LETTER_SOL,
  KeySignature, Note, Rest, Score,
} from './domain.js';

export function readText(text, { rootSemi, mode, merge }) {
  const keySig = new KeySignature(rootSemi, mode);
  const events = [];
  const upper  = text.toUpperCase();
  let i = 0;

  while (i < text.length) {
    const ch = upper[i];

    if (ch >= 'A' && ch <= 'Z') {
      let count = 1;
      if (merge) {
        while (i + count < text.length && upper[i + count] === ch) count++;
      }

      const bl   = baseLetter(ch);
      const alt  = keySig.altFor(bl);
      const midi = NATURAL_MIDI[bl] + alt;
      const acc  = alt === 1 ? '#' : alt === -1 ? 'b' : '';

      events.push(new Note({
        letter:     ch,
        baseLetter: bl,
        alt,
        midi,
        freq:    midiToFreq(midi),
        solName: LETTER_SOL[bl] + acc,
        beats:   count,
      }));
      i += count;

    } else {
      // Space or any other char → one beat of silence
      events.push(new Rest({ beats: 1 }));
      i++;
    }
  }

  return new Score({ events, keySig });
}
