export const DEFAULT_CAPTION_SETTINGS = Object.freeze({
  fontSize: 80, overlayY: 0.933, fontFamily: 'noto', fontWeight: 400,
  letterSpacing: 'tight', lineSpacing: 'standard', textColor: 'white', textOpacity: 100,
  backgroundColor: 'black', backgroundOpacity: 0, edgeStyle: 'shadow',
});

const choices = {
  fontFamily: ['noto', 'youtube', 'ud', 'serif', 'mono'],
  fontWeight: [400, 500, 600, 700],
  letterSpacing: ['tight', 'standard', 'wide'],
  lineSpacing: ['compact', 'standard', 'wide'],
  textColor: ['white', 'yellow', 'cyan', 'green'],
  textOpacity: [50, 75, 100],
  backgroundColor: ['black', 'navy'],
  backgroundOpacity: [0, 25, 50, 75, 100],
  edgeStyle: ['outline', 'shadow', 'none'],
};

const fonts = {
  noto: '"Noto Sans JP", "Hiragino Kaku Gothic ProN", "Yu Gothic", Meiryo, sans-serif',
  youtube: 'Roboto, "Noto Sans JP", "Hiragino Kaku Gothic ProN", Arial, sans-serif',
  ud: '"BIZ UDPGothic", "BIZ UDゴシック", "Noto Sans JP", Meiryo, sans-serif',
  serif: '"Noto Serif JP", "Yu Mincho", "Hiragino Mincho ProN", serif',
  mono: '"Noto Sans Mono CJK JP", Consolas, "Noto Sans JP", monospace',
};
const tracking = { tight: '0', standard: '0.025em', wide: '0.06em' };
const leading = { compact: 1.25, standard: 1.45, wide: 1.7 };
const colors = { white: '255, 255, 255', yellow: '255, 235, 112', cyan: '137, 231, 241', green: '173, 239, 157' };
const backgrounds = { black: '0, 0, 0', navy: '12, 26, 46' };

export function normalizeSettings(saved, config) {
  const source = saved && typeof saved === 'object' ? saved : {};
  const preferredMode = source.mode || config.defaultSubtitleMode;
  const size = Number(source.fontSize);
  const result = {
    mode: config.allowOverlaySubtitles && preferredMode === 'overlay' ? 'overlay' : 'below',
    fontSize: Number.isInteger(size) && size >= 10 && size <= 300
      ? Math.round(size / 10) * 10 : DEFAULT_CAPTION_SETTINGS.fontSize,
    overlayY: typeof source.overlayY === 'number' && Number.isFinite(source.overlayY)
      && source.overlayY >= 0 && source.overlayY <= 1 ? source.overlayY : DEFAULT_CAPTION_SETTINGS.overlayY,
  };
  for (const [key, allowed] of Object.entries(choices)) {
    const stored = key === 'fontFamily' && source[key] === 'sans' ? 'noto' : source[key];
    const value = ['fontWeight', 'textOpacity', 'backgroundOpacity'].includes(key) && stored != null
      ? Number(stored) : stored;
    result[key] = allowed.includes(value) ? value : DEFAULT_CAPTION_SETTINGS[key];
  }
  return result;
}

export function captionAppearance(settings) {
  return {
    scale: String(settings.fontSize / 100),
    font: fonts[settings.fontFamily],
    weight: String(settings.fontWeight),
    tracking: tracking[settings.letterSpacing],
    leading: String(leading[settings.lineSpacing]),
    fourLines: `${4 * leading[settings.lineSpacing]}em`,
    color: `rgba(${colors[settings.textColor]}, ${settings.textOpacity / 100})`,
    background: `rgba(${backgrounds[settings.backgroundColor]}, ${settings.backgroundOpacity / 100})`,
    edge: settings.edgeStyle,
  };
}
