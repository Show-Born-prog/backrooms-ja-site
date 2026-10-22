const TIMECODE = /^(\d{2,}):(\d{2}):(\d{2})[,\.](\d{3})$/;
const RANGE = /^(.+?)\s+-->\s+(.+?)$/;

function timeToMs(value) {
  const match = TIMECODE.exec(value.trim());
  if (!match) return null;
  const [, hours, minutes, seconds, milliseconds] = match;
  if (Number(minutes) > 59 || Number(seconds) > 59) return null;
  return ((Number(hours) * 3600 + Number(minutes) * 60 + Number(seconds)) * 1000) + Number(milliseconds);
}

export function parseSrt(source) {
  const blocks = source.replace(/^\uFEFF/, '').replace(/\r\n?/g, '\n').trim().split(/\n\s*\n/);
  if (!source.trim()) throw new Error('字幕ファイルが空です。');

  const cues = blocks.map((block, index) => {
    const lines = block.split('\n');
    if (/^\d+$/.test(lines[0].trim())) lines.shift();
    const range = RANGE.exec((lines.shift() || '').trim());
    const startMs = range ? timeToMs(range[1]) : null;
    const endMs = range ? timeToMs(range[2]) : null;
    const text = lines.join('\n').trim();
    if (startMs === null || endMs === null || endMs <= startMs) {
      throw new Error(`字幕 ${index + 1} の形式が正しくありません。`);
    }
    return text ? { startMs, endMs, text } : null;
  });

  return cues.filter(Boolean).sort((a, b) => a.startMs - b.startMs || a.endMs - b.endMs);
}
