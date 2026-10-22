export function renderCaptions(cues, elements, { mode }) {
  const text = cues.map(cue => cue.text).join('\n');
  elements.overlayText.textContent = mode === 'overlay' ? text : '';
  elements.belowText.textContent = mode === 'below' ? text : '';
  elements.overlay.hidden = mode !== 'overlay' || !text;
  elements.below.hidden = mode !== 'below';
}
