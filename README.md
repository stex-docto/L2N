# Letter2Note

Type any text and hear it played as music.

## How it works

Letters have a **fixed** mapping to natural notes (A=La, B=Si, C=Do, …), cycling modulo 7 for H–Z:

| Letters | Natural note |
|---------|-------------|
| A H O V | La (A) |
| B I P W | Si (B) |
| C J Q X | Do (C) |
| D K R Y | Ré (D) |
| E L S Z | Mi (E) |
| F M T   | Fa (F) |
| G N U   | Sol (G) |

**Key + mode only add alterations** (sharps or flats from the key signature). For example, D major adds F# and C#, so every F/M/T plays Fa# and every C/J/Q/X plays Do#. A minor adds nothing — all letters stay natural.

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
