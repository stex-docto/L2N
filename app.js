// ── Orchestration ─────────────────────────────────────────────────────────────
//
// Wires UI events to the three bounded contexts.
// Contains no music logic — only coordination.

import { readText }                            from './music/reader.js';
import { renderScore, highlightEvent,
         clearHighlights }                     from './music/viewer.js';
import { playScore, stopPlayback }             from './music/player.js';
import { baseLetter, letterNoteName,
         KeySignature, KEY_NAMES }             from './music/domain.js';

// ── State ─────────────────────────────────────────────────────────────────────

let playing = false;

// ── UI helpers ────────────────────────────────────────────────────────────────

function settings() {
  return {
    rootSemi: parseInt(document.getElementById('key-select').value),
    mode:     document.querySelector('.toggle-btn.active').dataset.mode,
    tempo:    parseInt(document.getElementById('tempo-input').value),
    merge:    document.getElementById('merge-repeats').checked,
  };
}

function sheetContainer() {
  return document.getElementById('sheet-music');
}

function currentScore() {
  const text = document.getElementById('text-input').value;
  if (!text.trim()) return null;
  const { rootSemi, mode, merge } = settings();
  return readText(text, { rootSemi, mode, merge });
}

// ── Playback ──────────────────────────────────────────────────────────────────

function startPlayback() {
  const score = currentScore();
  if (!score) return;

  endPlayback(true);

  renderScore(score, sheetContainer());

  playing = true;
  document.getElementById('play-btn').disabled = true;
  document.getElementById('stop-btn').disabled = false;

  playScore(score, settings().tempo, {
    onEventStart(evIdx, ev) {
      if (!playing) return;
      highlightEvent(evIdx);
      document.querySelectorAll('.letter-card.lit')
        .forEach(c => c.classList.remove('lit'));
      if (ev.type === 'note') {
        document.getElementById(`lc-${ev.letter}`)?.classList.add('lit');
        document.getElementById('current-note').textContent =
          `${ev.letter}  →  ${ev.solName}`;
      } else {
        document.getElementById('current-note').textContent = '·';
      }
    },
    onDone() { endPlayback(false); },
  });
}

function endPlayback(reset = true) {
  playing = false;
  stopPlayback();
  clearHighlights();
  document.getElementById('play-btn').disabled = false;
  document.getElementById('stop-btn').disabled = true;
  document.querySelectorAll('.letter-card.lit').forEach(c => c.classList.remove('lit'));

  if (reset) {
    document.getElementById('current-note').textContent = '—';
  } else {
    const el = document.getElementById('current-note');
    el.textContent = '✓';
    setTimeout(() => { el.textContent = '—'; }, 1200);
  }
}

// ── Live preview (debounced) ──────────────────────────────────────────────────

let _refreshTimer = null;
function scheduleRefresh() {
  clearTimeout(_refreshTimer);
  _refreshTimer = setTimeout(() => {
    if (playing) return;
    const score = currentScore();
    if (score) renderScore(score, sheetContainer());
    else       sheetContainer().innerHTML = '';
  }, 280);
}

// ── Mapping grid ──────────────────────────────────────────────────────────────

function updateMappingGrid() {
  const { rootSemi, mode } = settings();
  const keySig = new KeySignature(rootSemi, mode);
  const grid   = document.getElementById('mapping-grid');
  grid.innerHTML = '';

  for (let i = 0; i < 26; i++) {
    const letter = String.fromCharCode(65 + i);
    const name   = letterNoteName(letter, keySig);
    const card   = document.createElement('div');
    card.className = 'letter-card';
    card.id        = `lc-${letter}`;
    card.innerHTML =
      `<div class="lc-letter">${letter}</div><div class="lc-note">${name}</div>`;
    grid.appendChild(card);
  }

  document.getElementById('key-label').textContent =
    KEY_NAMES[mode][rootSemi] || '';
}

// ── Init ──────────────────────────────────────────────────────────────────────

document.addEventListener('DOMContentLoaded', () => {

  if (typeof VexFlow !== 'undefined') VexFlow.loadFonts().catch(() => {});

  // Mode toggle
  document.querySelectorAll('.toggle-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.toggle-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      updateMappingGrid();
      scheduleRefresh();
    });
  });

  // Key
  document.getElementById('key-select').addEventListener('change', () => {
    updateMappingGrid();
    scheduleRefresh();
  });

  // Tempo
  document.getElementById('tempo-input').addEventListener('input', function () {
    document.getElementById('tempo-val').textContent = this.value;
    scheduleRefresh();
  });

  // Merge
  document.getElementById('merge-repeats').addEventListener('change', scheduleRefresh);

  // Text
  document.getElementById('text-input').addEventListener('input', scheduleRefresh);

  // Buttons
  document.getElementById('play-btn').addEventListener('click', startPlayback);
  document.getElementById('stop-btn').addEventListener('click', () => endPlayback(true));

  // Space bar shortcut
  document.addEventListener('keydown', e => {
    if (e.code === 'Space' && e.target.tagName !== 'TEXTAREA') {
      e.preventDefault();
      playing ? endPlayback(true) : startPlayback();
    }
  });

  updateMappingGrid();
});
