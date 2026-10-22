export function activeCuesAt(cues, timeMs) {
  if (!Number.isFinite(timeMs) || timeMs < 0) return [];
  // Cues are ordered by start time. An earlier cue may still overlap later ones.
  let low = 0;
  let high = cues.length;
  while (low < high) {
    const mid = (low + high) >>> 1;
    if (cues[mid].startMs <= timeMs) low = mid + 1;
    else high = mid;
  }
  const active = [];
  for (let i = 0; i < low; i++) {
    if (timeMs < cues[i].endMs) active.push(cues[i]);
  }
  return active;
}

export class SubtitleSync {
  constructor(player, onCues) {
    this.player = player;
    this.onCues = onCues;
    this.cues = [];
    this.playing = false;
    this.timer = null;
    this.lastKey = null;
  }

  setCues(cues) {
    this.cues = cues;
    this.lastKey = null;
    this.refresh();
  }

  setPlaying(playing) {
    this.playing = playing;
    this.refresh();
  }

  refresh() {
    clearTimeout(this.timer);
    let seconds = 0;
    try { seconds = this.player?.getCurrentTime?.() ?? 0; } catch { /* Player is not ready yet. */ }
    const active = activeCuesAt(this.cues, Math.round(seconds * 1000));
    const key = active.map(cue => `${cue.startMs}:${cue.endMs}:${cue.text}`).join('\u0000');
    if (key !== this.lastKey) {
      this.lastKey = key;
      this.onCues(active);
    }
    // The API has no seek event, so poll slowly when paused and promptly when playing.
    this.timer = setTimeout(() => this.refresh(), document.hidden ? 500 : this.playing ? 80 : 250);
  }

  stop() {
    clearTimeout(this.timer);
    this.timer = null;
  }
}
