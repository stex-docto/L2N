# Letter2Note

Type any text and hear it played as music.

## How it works

Each letter maps to a **scale degree** via modulo 7 — all 26 letters loop on the same single octave:

| Letters | Degree |
|---------|--------|
| A H O V | 1 (root) |
| B I P W | 2 |
| C J Q X | 3 |
| D K R Y | 4 |
| E L S Z | 5 |
| F M T   | 6 |
| G N U   | 7 |

`A → La` in the default key (La / A). The connection is direct: in standard notation, **A = La**, so the English alphabet starting at A naturally maps to solfège starting at La.

## Controls

- **Key** — choose any of the 12 chromatic roots (Do to Si, with # / ♭)
- **Mode** — Major or Minor scale intervals
- **Tempo** — 40 to 240 BPM; one letter = one beat
- **Space** in text = one beat of silence
- **Merge repeated letters** — consecutive identical letters become a single longer note (AAA = 3 beats tied)
- **Space bar** — Play / Stop shortcut

## Tech

Pure HTML + CSS + JavaScript. Sound synthesis via the [Web Audio API](https://developer.mozilla.org/en-US/docs/Web/API/Web_Audio_API) — no dependencies, no build step.

## Live

[https://stex-docto.github.io/L2N](https://stex-docto.github.io/L2N)
