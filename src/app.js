import { SITE_CONFIG } from '../config.js';
import { parseSrt } from './srt.js';
import { SubtitleSync } from './sync.js';
import { renderCaptions } from './render.js';
import { normalizeSettings, captionAppearance } from './caption-settings.js';
import { captionBaseSize, overlayTopFromRatio, overlayReferenceTop, overlayRatioFromTop, fullscreenVideoWidth } from './caption-geometry.js';

const $ = id => document.getElementById(id);
const ui = {
  list: $('episode-list'), title: $('watch-heading'), number: $('current-number'),
  officialLink: $('official-link'), status: $('status'), placeholder: $('player-placeholder'),
  overlay: $('overlay-caption'), overlayText: $('overlay-caption-text'),
  below: $('below-caption'), belowText: $('below-caption-text'), viewer: $('viewer'), playerShell: $('player-shell'),
  overlayOption: $('overlay-option'), modeNote: $('mode-note'), fontSize: $('font-size'),
  overlayPositionGroup: $('overlay-position-group'), overlayPosition: $('overlay-position'),
  overlayPositionPixels: $('overlay-position-pixels'),
  fontSizeValue: $('font-size-value'), fullscreenButton: $('fullscreen-button'), fullscreenLabel: $('fullscreen-label'),
  fontFamily: $('font-family'), fontWeight: $('font-weight'),
  letterSpacing: $('letter-spacing'), lineSpacing: $('line-spacing'),
  textColor: $('text-color'), textOpacity: $('text-opacity'),
  backgroundColor: $('background-color'), backgroundOpacity: $('background-opacity'),
  edgeStyle: $('edge-style'), resetAppearance: $('reset-appearance'),
};

const settings = readSettings();
let episodes = [];
let selected = null;
let selectionToken = 0;
let playerPromise = null;
let player = null;
let sync = null;
let activeCues = [];

function readSettings() {
  let saved = {};
  try { saved = JSON.parse(localStorage.getItem('backrooms-settings') || '{}'); } catch { /* Storage can be disabled. */ }
  return normalizeSettings(saved, SITE_CONFIG);
}

function saveSettings() {
  try { localStorage.setItem('backrooms-settings', JSON.stringify(settings)); } catch { /* Storage can be disabled. */ }
}

function renderCurrentCaptions(cues = activeCues) {
  activeCues = cues;
  renderCaptions(cues, ui, settings);
  updateOverlayGeometry();
}

function updateOverlayGeometry() {
  const frameHeight = ui.playerShell.getBoundingClientRect().height;
  const captionHeight = ui.overlay.getBoundingClientRect().height;
  const { top } = overlayTopFromRatio(settings.overlayY, frameHeight, captionHeight);
  const reference = overlayReferenceTop(settings.overlayY, frameHeight);
  ui.overlay.style.top = `${top}px`;
  ui.overlayPosition.max = String(reference.maxTop);
  ui.overlayPosition.value = String(reference.top);
  ui.overlayPositionPixels.max = String(reference.maxTop);
  ui.overlayPositionPixels.value = String(reference.top);
}

function setOverlayReferenceTop(value) {
  const maxTop = Number(ui.overlayPosition.max);
  const top = Math.min(maxTop, Math.max(0, Math.round(value)));
  if (!Number.isFinite(top)) return;
  settings.overlayY = overlayRatioFromTop(top, maxTop);
  updateOverlayGeometry();
}

function setOverlayTop(value) {
  const frameHeight = ui.playerShell.getBoundingClientRect().height;
  const captionHeight = ui.overlay.getBoundingClientRect().height;
  const { maxTop } = overlayTopFromRatio(settings.overlayY, frameHeight, captionHeight);
  if (!Number.isFinite(value)) return;
  settings.overlayY = overlayRatioFromTop(Math.round(value), maxTop);
  updateOverlayGeometry();
}

function updateVideoGeometry() {
  const width = ui.playerShell.getBoundingClientRect().width;
  ui.viewer.style.setProperty('--caption-base-size', `${captionBaseSize(width)}px`);
  updateOverlayGeometry();
}

function updateFullscreenLayout() {
  if (document.fullscreenElement !== ui.viewer) return;
  const width = fullscreenVideoWidth(ui.viewer.clientWidth, ui.viewer.clientHeight, settings);
  ui.viewer.style.setProperty('--fullscreen-player-width', `${width}px`);
  updateVideoGeometry();
}

function setStatus(message, error = false) {
  ui.status.textContent = message;
  ui.status.classList.toggle('error', error);
}

function updateSettingsUI() {
  ui.overlayOption.disabled = !SITE_CONFIG.allowOverlaySubtitles;
  ui.modeNote.hidden = SITE_CONFIG.allowOverlaySubtitles;
  ui.overlayPositionGroup.hidden = settings.mode !== 'overlay';
  document.querySelector(`input[name="subtitle-mode"][value="${settings.mode}"]`).checked = true;
  ui.fontSize.value = String(settings.fontSize);
  ui.fontSizeValue.textContent = `${settings.fontSize}%`;
  for (const key of ['fontFamily', 'fontWeight', 'letterSpacing', 'lineSpacing', 'textColor', 'textOpacity', 'backgroundColor', 'backgroundOpacity', 'edgeStyle']) {
    ui[key].value = String(settings[key]);
  }
  const appearance = captionAppearance(settings);
  ui.viewer.style.setProperty('--caption-scale', appearance.scale);
  ui.viewer.style.setProperty('--caption-font', appearance.font);
  ui.viewer.style.setProperty('--caption-weight', appearance.weight);
  ui.viewer.style.setProperty('--caption-tracking', appearance.tracking);
  ui.viewer.style.setProperty('--caption-leading', appearance.leading);
  ui.viewer.style.setProperty('--caption-four-lines', appearance.fourLines);
  ui.viewer.style.setProperty('--caption-color', appearance.color);
  ui.viewer.style.setProperty('--caption-background', appearance.background);
  ui.viewer.dataset.edge = appearance.edge;
  updateFullscreenLayout();
  renderCurrentCaptions();
}

function makeEpisodeButton(episode) {
  const item = document.createElement('li');
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'episode-button';
  button.dataset.episodeId = episode.id;
  button.disabled = !episode.youtubeId;
  if (!episode.youtubeId) button.title = '公式動画を確認できていません';
  const number = document.createElement('span');
  number.className = 'episode-number';
  number.textContent = episode.id;
  const title = document.createElement('span');
  title.className = 'episode-title';
  title.textContent = episode.title + (episode.youtubeId ? '' : ' （動画未設定）');
  button.append(number, title);
  button.addEventListener('click', () => selectEpisode(episode));
  item.append(button);
  return item;
}

function showSelected(episode) {
  ui.title.textContent = episode.title;
  ui.number.textContent = episode.id;
  ui.officialLink.href = episode.youtubeId ? `https://www.youtube.com/watch?v=${episode.youtubeId}` : 'https://www.youtube.com/@kanepixels';
  ui.officialLink.textContent = episode.youtubeId ? '公式動画を開く ↗' : '公式チャンネル ↗';
  for (const button of ui.list.querySelectorAll('button')) {
    if (button.dataset.episodeId === episode.id) button.setAttribute('aria-current', 'true');
    else button.removeAttribute('aria-current');
  }
}

function loadYouTubeAPI() {
  if (window.YT?.Player) return Promise.resolve(window.YT);
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error('YouTube APIが応答しません。')), 15000);
    window.onYouTubeIframeAPIReady = () => { clearTimeout(timeout); resolve(window.YT); };
    const script = document.createElement('script');
    script.src = 'https://www.youtube.com/iframe_api';
    script.onerror = () => { clearTimeout(timeout); reject(new Error('YouTube APIを読み込めませんでした。')); };
    document.head.append(script);
  });
}

function ensurePlayer() {
  if (playerPromise) return playerPromise;
  playerPromise = loadYouTubeAPI().then(YT => new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error('プレーヤーの準備が完了しませんでした。')), 15000);
    new YT.Player('player', {
      width: '1280', height: '720',
      videoId: selected?.youtubeId,
      playerVars: {
        controls: 1, playsinline: 1, rel: 0,
        // The site's own button expands the caption container on supporting browsers.
        fs: document.fullscreenEnabled ? 0 : 1,
        origin: location.origin,
      },
      events: {
        onReady: event => {
          clearTimeout(timeout);
          player = event.target;
          sync = new SubtitleSync(player, renderCurrentCaptions);
          ui.placeholder.hidden = true;
          resolve(player);
        },
        onStateChange: event => {
          if (!sync) return;
          sync.setPlaying(event.data === YT.PlayerState.PLAYING);
          if (event.data === YT.PlayerState.ENDED) sync.refresh();
        },
        onPlaybackRateChange: () => sync?.refresh(),
        onError: event => {
          const reason = event.data === 101 || event.data === 150 ? 'この動画は埋め込み再生が許可されていません。' :
            event.data === 153 ? 'YouTubeへの参照元情報が必要です。ローカルサーバーから開いてください。' :
            'YouTube動画を再生できませんでした。';
          setStatus(`${reason}「公式動画を開く」からご覧ください。`, true);
        },
      },
    });
  })).catch(error => {
    playerPromise = null;
    throw error;
  });
  return playerPromise;
}

async function selectEpisode(episode) {
  const token = ++selectionToken;
  selected = episode;
  showSelected(episode);
  activeCues = [];
  renderCurrentCaptions([]);
  sync?.setCues([]);
  sync?.setPlaying(false);
  try { player?.stopVideo(); } catch { /* Player may not be ready. */ }

  if (!episode.youtubeId) {
    setStatus('この作品の公式動画IDは未設定です。', true);
    return;
  }
  setStatus('公式動画と日本語字幕を読み込んでいます…');
  const subtitleTask = episode.subtitle
    ? fetch(new URL(episode.subtitle, new URL('../', import.meta.url)))
        .then(response => { if (!response.ok) throw new Error(`HTTP ${response.status}`); return response.text(); })
        .then(parseSrt)
    : Promise.reject(new Error('字幕が未設定です。'));

  // Playback and subtitle loading can proceed independently, but stale results
  // from a rapid episode switch must never be applied to the new selection.
  const playerTask = ensurePlayer().then(readyPlayer => {
    if (token !== selectionToken) return;
    readyPlayer.cueVideoById(episode.youtubeId);
  });
  const [subtitleResult, playerResult] = await Promise.allSettled([subtitleTask, playerTask]);
  if (token !== selectionToken) return;

  if (subtitleResult.status === 'fulfilled') sync?.setCues(subtitleResult.value);
  else sync?.setCues([]);
  if (playerResult.status === 'rejected') {
    setStatus(`${playerResult.reason.message} 公式動画リンクからご覧ください。`, true);
  } else if (subtitleResult.status === 'rejected') {
    setStatus(`日本語字幕を読み込めませんでした。${subtitleResult.reason.message}`, true);
  } else if (subtitleResult.value.length === 0) {
    setStatus('この作品の字幕ファイルには表示するテキストがありません。');
  } else {
    setStatus('');
  }
}

function wireControls() {
  document.querySelectorAll('input[name="subtitle-mode"]').forEach(input => input.addEventListener('change', () => {
    if (input.value === 'overlay' && !SITE_CONFIG.allowOverlaySubtitles) return;
    settings.mode = input.value;
    saveSettings();
    updateSettingsUI();
  }));
  ui.fontSize.addEventListener('input', () => {
    settings.fontSize = Number(ui.fontSize.value);
    saveSettings();
    updateSettingsUI();
  });
  ui.overlayPosition.addEventListener('input', () => { setOverlayReferenceTop(Number(ui.overlayPosition.value)); saveSettings(); });
  ui.overlayPositionPixels.addEventListener('input', () => {
    if (ui.overlayPositionPixels.value === '') return;
    setOverlayReferenceTop(Number(ui.overlayPositionPixels.value));
    saveSettings();
  });
  let drag = null;
  ui.overlayText.addEventListener('pointerdown', event => {
    if (settings.mode !== 'overlay' || event.button !== 0) return;
    event.preventDefault();
    drag = { id: event.pointerId, y: event.clientY, top: Number.parseInt(ui.overlay.style.top, 10) };
    ui.overlayText.setPointerCapture(event.pointerId);
  });
  ui.overlayText.addEventListener('pointermove', event => {
    if (!drag || event.pointerId !== drag.id) return;
    setOverlayTop(drag.top + event.clientY - drag.y);
  });
  const endDrag = event => {
    if (!drag || event.pointerId !== drag.id) return;
    drag = null;
    saveSettings();
  };
  ui.overlayText.addEventListener('pointerup', endDrag);
  ui.overlayText.addEventListener('pointercancel', endDrag);
  for (const key of ['fontFamily', 'fontWeight', 'letterSpacing', 'lineSpacing', 'textColor', 'textOpacity', 'backgroundColor', 'backgroundOpacity', 'edgeStyle']) {
    ui[key].addEventListener('change', () => {
      settings[key] = ['fontWeight', 'textOpacity', 'backgroundOpacity'].includes(key) ? Number(ui[key].value) : ui[key].value;
      saveSettings();
      updateSettingsUI();
    });
  }
  ui.resetAppearance.addEventListener('click', () => {
    Object.assign(settings, normalizeSettings({}, SITE_CONFIG));
    saveSettings();
    updateSettingsUI();
  });
  ui.fullscreenButton.disabled = !document.fullscreenEnabled;
  if (!document.fullscreenEnabled) ui.fullscreenButton.title = 'このブラウザではサイト全体の全画面表示を利用できません';
  ui.fullscreenButton.addEventListener('click', async () => {
    try {
      if (document.fullscreenElement === ui.viewer) await document.exitFullscreen();
      else await ui.viewer.requestFullscreen();
    } catch {
      setStatus('このブラウザでは字幕を含む全画面表示を利用できません。通常表示でご覧ください。', true);
    }
  });
  document.addEventListener('fullscreenchange', () => {
    ui.fullscreenLabel.textContent = document.fullscreenElement === ui.viewer ? '全画面を終了' : '全画面表示';
    updateFullscreenLayout();
    updateVideoGeometry();
    sync?.refresh();
  });
  window.addEventListener('resize', () => { updateFullscreenLayout(); updateVideoGeometry(); });
  if (window.ResizeObserver) {
    const observer = new ResizeObserver(() => updateVideoGeometry());
    observer.observe(ui.playerShell);
    observer.observe(ui.overlay);
  }
  document.addEventListener('visibilitychange', () => sync?.refresh());
  window.addEventListener('beforeunload', () => sync?.stop());
}

async function init() {
  updateSettingsUI();
  wireControls();
  updateVideoGeometry();
  try {
    const response = await fetch(new URL('../episodes.json', import.meta.url));
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    episodes = (await response.json()).filter(entry => entry.enabled);
    ui.list.replaceChildren(...episodes.map(makeEpisodeButton));
    const first = episodes.find(episode => episode.youtubeId);
    if (first) await selectEpisode(first);
    else setStatus('視聴できる作品がありません。', true);
  } catch (error) {
    setStatus(`作品一覧を読み込めませんでした。${error.message}`, true);
  }
}

init();
