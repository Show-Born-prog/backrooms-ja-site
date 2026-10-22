import { captionAppearance } from './caption-settings.js';

export function captionBaseSize(videoWidth) {
  return Math.max(16, videoWidth * 0.027);
}

export function overlayTopFromRatio(ratio, frameHeight, captionHeight) {
  const maxTop = Math.max(0, Math.floor(frameHeight - captionHeight));
  return { top: Math.round(Math.min(1, Math.max(0, ratio)) * maxTop), maxTop };
}

export function overlayReferenceTop(ratio, frameHeight) {
  const maxTop = Math.max(0, Math.floor(frameHeight));
  return { top: Math.round(Math.min(1, Math.max(0, ratio)) * maxTop), maxTop };
}

export function overlayRatioFromTop(top, maxTop) {
  return maxTop > 0 ? Math.min(1, Math.max(0, top / maxTop)) : 0;
}

export function fullscreenVideoWidth(viewportWidth, viewportHeight, settings) {
  const leading = Number(captionAppearance(settings).leading);
  const reserve = width => settings.mode === 'below'
    ? 4 * leading * captionBaseSize(width) * settings.fontSize / 100 + 21 : 0;
  let low = 0;
  let high = Math.max(0, Math.min(viewportWidth, viewportHeight * 16 / 9));
  for (let i = 0; i < 22; i++) {
    const mid = (low + high) / 2;
    if (mid * 9 / 16 + reserve(mid) + 46 <= viewportHeight) low = mid;
    else high = mid;
  }
  return Math.floor(low);
}
