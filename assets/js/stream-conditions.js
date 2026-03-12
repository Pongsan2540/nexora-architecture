/* =========================================================
   Nexora Register / Stream Conditions
   Full JS (camera + hls + events api + rules ui)
   ========================================================= */

/* ══════════════════════════════════════════════════════════
   CONFIG
   ══════════════════════════════════════════════════════════ */
const API_BASE = 'http://172.16.1.31:8001';

const EVENT_API_CANDIDATES = [
  (cam) => `${API_BASE}/nexora/api/listEventCam?id_cam=${encodeURIComponent(cam.id_cam)}`,
];

const SETTINGS_API_CANDIDATES = [
  (cam) => `${API_BASE}/nexora/api/listSetting?id_cam=${encodeURIComponent(cam.id_cam)}`,
  (cam) => `${API_BASE}/nexora/api/settings?id_cam=${encodeURIComponent(cam.id_cam)}`,
  (cam) => `${API_BASE}/nexora/api/listEventCam?id_cam=${encodeURIComponent(cam.id_cam)}`
];

/* ══════════════════════════════════════════════════════════
   STATE
   ══════════════════════════════════════════════════════════ */
let CAMERAS = [];
let currentEvents = [];
let currentEventIndex = 0;
let activeCam = -1;
let currentCamera = null;
let hlsInst = null;
let thumbTimer = null;
let lastJSONData = null;
let currentSettings = [];
let currentSettingIndex = 0;

/* rules */
let ruleId = 0;
const rules = [];

const TYPE_META = {
  match:     { label: 'Match',     cls: 'rule-match',     tag: 'tag-match'     },
  block:     { label: 'Block',     cls: 'rule-block',     tag: 'tag-block'     },
  flag:      { label: 'Flag',      cls: 'rule-flag',      tag: 'tag-flag'      },
  transform: { label: 'Transform', cls: 'rule-transform', tag: 'tag-transform' },
  route:     { label: 'Route',     cls: 'rule-route',     tag: 'tag-route'     },
};

const FIELDS = [
  'token_text',
  'chunk_text',
  'sentiment_score',
  'topic_score',
  'confidence',
  'category',
  'lang',
  'token_count',
  'latency_ms',
  'model_id',
  'session_id',
  'role',
];

const NUMBER_FIELDS = [
  'sentiment_score',
  'topic_score',
  'confidence',
  'token_count',
  'latency_ms',
];

const OPS_TEXT = [
  'contains',
  'not_contains',
  'equals',
  'not_equals',
  'regex',
  'starts_with',
  'ends_with',
];

const OPS_NUM = [
  'gt',
  'gte',
  'lt',
  'lte',
  'equals',
  'not_equals',
];

const getOps = (field) => NUMBER_FIELDS.includes(field) ? OPS_NUM : OPS_TEXT;

const TEMPLATES = {
  match: {
    name: 'Tag Match',
    conditions: [
      { field: 'category', op: 'contains', value: 'event' },
    ],
    logic: 'OR',
    action: { type: 'match', label: 'event_detected', threshold: 0.7 },
    model_params: { temperature: 0.2, top_p: 0.9, max_tokens: 512 },
  },
  block: {
    name: 'Low Confidence Block',
    conditions: [
      { field: 'confidence', op: 'lt', value: '0.30' },
    ],
    logic: 'AND',
    action: { type: 'block', replacement: '[BLOCKED]', notify: true },
    model_params: { temperature: 0, top_p: 1, max_tokens: 256 },
  },
  flag: {
    name: 'Zone Flag',
    conditions: [
      { field: 'chunk_text', op: 'contains', value: 'zone' },
    ],
    logic: 'OR',
    action: { type: 'flag', tag: 'zone_activity', severity: 'medium' },
    model_params: { temperature: 0.1, top_p: 0.95, max_tokens: 512 },
  },
  transform: {
    name: 'Normalize Output',
    conditions: [
      { field: 'lang', op: 'not_equals', value: 'en' },
    ],
    logic: 'AND',
    action: { type: 'transform', prompt: 'Translate to English.', inject_before: '' },
    model_params: { temperature: 0.3, top_p: 0.9, max_tokens: 1024 },
  },
  route: {
    name: 'Security Route',
    conditions: [
      { field: 'category', op: 'contains', value: 'security' },
    ],
    logic: 'OR',
    action: { type: 'route', target_agent: 'security-agent', priority: 'high' },
    model_params: { temperature: 0.1, top_p: 0.95, max_tokens: 2048 },
  },
};

/* ══════════════════════════════════════════════════════════
   SMALL HELPERS
   ══════════════════════════════════════════════════════════ */
function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function safeText(value, fallback = '-') {
  if (value === null || value === undefined || value === '') return fallback;
  return String(value);
}

function toShortJson(obj) {
  try {
    return JSON.stringify(obj, null, 2);
  } catch {
    return '{}';
  }
}

function getCurrentEvent() {
  if (!currentEvents.length) return null;
  if (currentEventIndex < 0 || currentEventIndex >= currentEvents.length) {
    currentEventIndex = 0;
  }
  return currentEvents[currentEventIndex] || null;
}

function normalizeCamera(cam, idx = 0) {
  return {
    id_cam: cam?.id_cam ?? cam?.camera_id ?? cam?.id ?? `unknown-${idx}`,
    name: cam?.name ?? cam?.location_name ?? cam?.sub ?? 'No name',
    name_cam: cam?.name_cam ?? cam?.camera_name ?? `CAM-${idx + 1}`,
    type_event: cam?.type_event ?? cam?.event_type ?? 'No event',
    hls: cam?.hls ?? cam?.hls_url ?? cam?.stream_url ?? null,
    img: cam?.img ?? null,
    raw: cam,
    isValidStream: !!(cam?.hls ?? cam?.hls_url ?? cam?.stream_url),
  };
}

function setText(id, value) {
  const el = document.getElementById(id);
  if (el) el.textContent = value;
}

function setHtml(id, html) {
  const el = document.getElementById(id);
  if (el) el.innerHTML = html;
}

function showPlaceholder(title, sub, isError = false) {
  const ph = document.getElementById('vidPlaceholder');
  if (!ph) return;

  ph.style.display = 'flex';
  ph.innerHTML = `
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
      <polygon points="23,7 16,12 23,17"></polygon>
      <rect x="1" y="5" width="15" height="14" rx="2"></rect>
    </svg>
    <div class="vid-placeholder-title" style="${isError ? 'color:var(--red);' : ''}">${escapeHtml(title)}</div>
    <div class="vid-placeholder-sub">${escapeHtml(sub)}</div>
  `;
}

function hidePlaceholder() {
  const ph = document.getElementById('vidPlaceholder');
  if (ph) ph.style.display = 'none';
}

/* ══════════════════════════════════════════════════════════
   CAMERAS
   ══════════════════════════════════════════════════════════ */
async function loadCameras() {
  try {
    const res = await fetch(`${API_BASE}/nexora/api/listCam`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);

    const data = await res.json();
    const arr = Array.isArray(data) ? data : [];

    CAMERAS = arr.map((cam, idx) => normalizeCamera(cam, idx));

    renderCamCards();
    renderJSON();

    const onlineCount = CAMERAS.filter((c) => c.isValidStream).length;
    const onlineBadge = document.querySelector('.lp-status-2');
    if (onlineBadge) {
      onlineBadge.textContent = `${onlineCount} online`;
    }

    if (CAMERAS.length > 0) {
      await selectCam(0);
    } else {
      showPlaceholder('No camera', 'ไม่พบรายการกล้องจาก API', true);
      currentEvents = [];
      currentEventIndex = 0;
      renderEvents([]);
      renderDetectionFromEvents([]);
      renderStats();
    }
  } catch (err) {
    console.error('loadCameras error:', err);
    CAMERAS = [];
    currentEvents = [];
    currentEventIndex = 0;
    renderCamCards();
    renderJSON();
    showPlaceholder('Camera load failed', err.message || 'โหลดรายการกล้องไม่สำเร็จ', true);
    renderEvents([]);
    renderDetectionFromEvents([]);
    renderStats();
  }
}

function getCamCardHTML(cam, i, listKey) {
  const isActive = i === activeCam;
  const badgeText = isActive ? 'LIVE' : (cam.isValidStream ? 'READY' : 'NO SIGNAL');
  const badgeClass = isActive
    ? 'badge-live'
    : (cam.isValidStream ? 'badge-ready' : 'badge-no-signal');

  return `
    <div class="cam-card ${isActive ? 'active' : ''}" data-cam-index="${i}" data-cam-list="${listKey}">
      <div class="cam-card-thumb">
        <canvas class="cam-thumb" data-thumb-index="${i}" data-thumb-list="${listKey}" width="128" height="72"></canvas>
        <div class="cam-card-live"></div>
      </div>

      <div class="cam-card-body">
        <div class="cam-card-sub">${escapeHtml(cam.name)}</div>
        <div class="cam-card-name">${escapeHtml(cam.name_cam)} — ${escapeHtml(cam.type_event)}</div>
        <div class="cam-card-url">${escapeHtml(cam.hls || 'No HLS stream')}</div>
      </div>

      <div class="cam-card-badge ${badgeClass}">
        ${badgeText}
      </div>
    </div>
  `;
}

function renderCamCards() {
  const containers = document.querySelectorAll('#camCards');
  containers.forEach((container, listIdx) => {
    container.innerHTML = CAMERAS.map((cam, i) => getCamCardHTML(cam, i, `list-${listIdx}`)).join('');
  });

  bindCamCardClicks();
  animateThumbs();
}

function bindCamCardClicks() {
  const containers = document.querySelectorAll('#camCards');

  containers.forEach((container) => {
    if (container.dataset.bound === '1') return;

    container.addEventListener('click', async (e) => {
      const card = e.target.closest('.cam-card');
      if (!card) return;

      const idx = Number(card.dataset.camIndex);
      if (Number.isNaN(idx)) return;

      await selectCam(idx);
    });

    container.dataset.bound = '1';
  });
}

function animateThumbs() {
  if (thumbTimer) clearInterval(thumbTimer);

  thumbTimer = setInterval(() => {
    const canvases = document.querySelectorAll('.cam-thumb');

    canvases.forEach((canvas) => {
      const idx = Number(canvas.dataset.thumbIndex);
      if (Number.isNaN(idx)) return;

      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      const W = canvas.width;
      const H = canvas.height;

      ctx.fillStyle = idx === activeCam ? '#0a1a0a' : '#050504';
      ctx.fillRect(0, 0, W, H);

      const y = (Date.now() / 8 + idx * 33) % H;
      ctx.fillStyle = 'rgba(212,196,160,.06)';
      ctx.fillRect(0, y, W, 1);

      for (let n = 0; n < 30; n++) {
        ctx.fillStyle = `rgba(255,255,255,${Math.random() * 0.04})`;
        ctx.fillRect(Math.random() * W, Math.random() * H, 1, 1);
      }

      ctx.fillStyle = idx === activeCam ? '#4ade80' : 'rgba(248,113,113,.7)';
      ctx.beginPath();
      ctx.arc(W - 7, 7, 3, 0, Math.PI * 2);
      ctx.fill();
    });
  }, 100);
}

async function selectCam(i) {
  if (!CAMERAS[i]) return;

  activeCam = i;
  currentCamera = CAMERAS[i];
  currentEvents = [];
  currentEventIndex = 0;
  currentSettings = [];
  currentSettingIndex = 0;

  renderCamCards();

  const cam = currentCamera;
  setText('camNameHud', `${cam.name_cam} — ${cam.type_event} | ${cam.name}`);

  const hudClock = document.getElementById('hudClock');
  if (hudClock) hudClock.style.display = 'flex';

  if (!cam.hls) {
    connectHLS(null);
  } else {
    connectHLS(cam.hls);
  }

  renderStats();

  await Promise.all([
    loadEventsByCamera(cam),
    loadSettingsByCamera(cam),
  ]);
}

/* ══════════════════════════════════════════════════════════
   HLS PLAYER
   ══════════════════════════════════════════════════════════ */
function connectHLS(url) {
  const video = document.getElementById('videoEl');
  const stEl = document.getElementById('hlsState');
  const liveEl = document.getElementById('liveIndicator');

  if (!video) return;

  if (hlsInst) {
    hlsInst.destroy();
    hlsInst = null;
  }

  video.pause();
  video.removeAttribute('src');
  video.load();

  function onConnected() {
    hidePlaceholder();
    if (stEl) {
      stEl.textContent = '● HLS live';
      stEl.style.color = 'var(--green)';
    }
    if (liveEl) {
      liveEl.style.background = 'var(--green)';
      liveEl.style.animation = 'pulse 2s infinite';
    }
  }

  function onError(msg) {
    if (stEl) {
      stEl.textContent = msg;
      stEl.style.color = 'var(--red)';
    }
    if (liveEl) {
      liveEl.style.background = 'var(--red)';
      liveEl.style.animation = 'none';
    }

    showPlaceholder('Connection failed', msg, true);
  }

  if (!url) {
    onError('No HLS URL for this camera');
    return;
  }

  if (stEl) {
    stEl.textContent = 'Connecting…';
    stEl.style.color = 'var(--amber)';
  }
  if (liveEl) {
    liveEl.style.background = 'var(--amber)';
    liveEl.style.animation = 'none';
  }

  hidePlaceholder();

  if (window.Hls && Hls.isSupported()) {
    hlsInst = new Hls({
      enableWorker: true,
      lowLatencyMode: true,
      backBufferLength: 0,
    });

    hlsInst.loadSource(url);
    hlsInst.attachMedia(video);

    hlsInst.on(Hls.Events.MANIFEST_PARSED, () => {
      video.play().catch(() => {});
      onConnected();
    });

    hlsInst.on(Hls.Events.ERROR, (_, data) => {
      if (data?.fatal) {
        onError(data?.details || 'Fatal HLS error');
      }
    });

    return;
  }

  if (video.canPlayType('application/vnd.apple.mpegurl')) {
    video.src = url;

    video.addEventListener('loadedmetadata', () => {
      video.play().catch(() => {});
      onConnected();
    }, { once: true });

    video.addEventListener('error', () => {
      onError('Native HLS error');
    }, { once: true });

    return;
  }

  onError('HLS not supported');
}

setInterval(() => {
  const el = document.getElementById('hudClock');
  if (el && el.style.display !== 'none') {
    el.textContent = new Date().toLocaleTimeString('th-TH');
  }
}, 1000);

/* ══════════════════════════════════════════════════════════
   EVENT API
   ══════════════════════════════════════════════════════════ */
async function tryFetchJson(url) {
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`HTTP ${res.status}`);
  }

  const data = await res.json();
  return data;
}

async function loadEventsByCamera(cam) {
  setHtml(
    'streamFeed',
    `<div class="det-empty">Loading events for ${escapeHtml(cam.name_cam)}...</div>`
  );
  setHtml(
    'detResults',
    `<div class="det-empty">Loading detection results...</div>`
  );
  setHtml(
    'statsPanel',
    `<div style="padding:16px;font-size:11px;color:var(--t2)">Loading settings for ${escapeHtml(cam.name_cam)}...</div>`
  );

  let lastErr = null;

  for (const buildUrl of EVENT_API_CANDIDATES) {
    const url = buildUrl(cam);

    try {
      const data = await tryFetchJson(url);

      let events = [];
      if (Array.isArray(data)) {
        events = data;
      } else if (Array.isArray(data?.data)) {
        events = data.data;
      } else if (Array.isArray(data?.events)) {
        events = data.events;
      } else if (Array.isArray(data?.items)) {
        events = data.items;
      }

      currentEvents = events;
      currentEventIndex = 0;

      renderEvents(currentEvents);
      renderDetectionFromEvents(currentEvents);
      renderStats();
      renderJSON();
      return;
    } catch (err) {
      lastErr = err;
    }
  }

  console.error('loadEventsByCamera error:', lastErr);
  currentEvents = [];
  currentEventIndex = 0;

  setHtml(
    'streamFeed',
    `<div class="det-empty" style="color:var(--red)">โหลด event ไม่สำเร็จ${lastErr?.message ? `: ${escapeHtml(lastErr.message)}` : ''}</div>`
  );

  setHtml(
    'detResults',
    `<div class="det-empty" style="color:var(--red)">ไม่สามารถโหลด detection results ได้</div>`
  );

  renderStats();
  renderJSON();
}

async function loadSettingsByCamera(cam) {
  setHtml(
    'statsPanel',
    `<div style="padding:16px;font-size:11px;color:var(--t2)">Loading settings for ${escapeHtml(cam.name_cam)}...</div>`
  );

  let lastErr = null;

  for (const buildUrl of SETTINGS_API_CANDIDATES) {
    const url = buildUrl(cam);

    try {
      const data = await tryFetchJson(url);

      let items = [];
      if (Array.isArray(data)) {
        items = data;
      } else if (Array.isArray(data?.data)) {
        items = data.data;
      } else if (Array.isArray(data?.settings)) {
        items = data.settings;
      } else if (Array.isArray(data?.items)) {
        items = data.items;
      }

      currentSettings = items;
      currentSettingIndex = 0;

      renderStats();
      renderJSON();
      return;
    } catch (err) {
      lastErr = err;
    }
  }

  console.error('loadSettingsByCamera error:', lastErr);
  currentSettings = [];
  currentSettingIndex = 0;
  renderStats();
}



/* ══════════════════════════════════════════════════════════
   EVENT RENDER
   ══════════════════════════════════════════════════════════ */
function renderEvents(events = []) {
  const feed = document.getElementById('streamFeed');
  if (!feed) return;

  if (!currentCamera) {
    feed.innerHTML = `<div class="det-empty">ยังไม่ได้เลือกกล้อง</div>`;
    setText('tokenCount', '0');
    return;
  }

  if (!events.length) {
    feed.innerHTML = `<div class="det-empty">ไม่พบ event ของกล้อง ${escapeHtml(currentCamera.name_cam)}</div>`;
    setText('tokenCount', '0');
    setText('hitCount', '0');
    return;
  }

  feed.innerHTML = events.map((ev, idx) => {
    const title = ev.name || '-';
    const sub = ev.sub || '-';
    const desc = ev.desc || '-';
    const tag = ev.tag || '-';
    const level = ev.level || '-';
    const hours = ev.hours || '-';
    const img = ev.img || '';
    const matchedRule = getMatchedRule(ev);

    const badgeHtml = matchedRule
      ? `<span class="event-card-badge ${TYPE_META[matchedRule.type].tag}">${TYPE_META[matchedRule.type].label}</span>`
      : `<span class="event-card-badge">${escapeHtml(tag)}</span>`;

    return `
      <div class="event-card ${matchedRule ? `hit-${matchedRule.type}` : ''}">
        <div class="event-card-thumb">
          ${
            img
              ? `<img src="${escapeHtml(img)}" alt="${escapeHtml(title)}" onerror="this.style.display='none'; this.nextElementSibling.style.display='flex';">`
              : ''
          }
          <div class="event-card-thumb-fallback" style="${img ? 'display:none;' : 'display:flex;'}">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7">
              <rect x="3" y="4" width="18" height="16" rx="2"></rect>
              <circle cx="9" cy="10" r="2"></circle>
              <path d="M21 15l-5-5L5 20"></path>
            </svg>
          </div>
        </div>

        <div class="event-card-body">
          <div class="event-card-top">
            <div class="event-card-index">${String(idx + 1).padStart(2, '0')}</div>
            ${badgeHtml}
          </div>

          <div class="event-card-title">${escapeHtml(title)}</div>
          <div class="event-card-sub">${escapeHtml(sub)}</div>

          <div class="event-card-meta">
            <span class="event-meta-chip">Cam: ${escapeHtml(currentCamera.name_cam)}</span>
            <span class="event-meta-chip">Level: ${escapeHtml(level)}</span>
            <span class="event-meta-chip">Tag: ${escapeHtml(tag)}</span>
          </div>

          <div class="event-card-desc">${escapeHtml(desc)}</div>

          <div class="event-card-footer">
            <span class="event-hours">Hours: ${escapeHtml(hours)}</span>
          </div>
        </div>
      </div>
    `;
  }).join('');

  setText('tokenCount', String(events.length));
  setText('hitCount', String(events.filter((ev) => !!getMatchedRule(ev)).length));
}

function recalcRuleStats(events = []) {
  rules.forEach((r) => {
    r.stats.hits = 0;
    r.stats.total = 0;
  });

  if (!events.length) return;

  for (const ev of events) {
    for (const rule of rules) {
      if (!rule.enabled) continue;
      rule.stats.total += 1;
    }

    const matchedRule = getMatchedRule(ev);
    if (matchedRule) {
      matchedRule.stats.hits += 1;
    }
  }
}

function renderDetectionFromEvents(events = []) {
  const det = document.getElementById('detResults');
  if (!det) return;

  if (!currentCamera) {
    det.innerHTML = `<div class="det-empty">ยังไม่ได้เลือกกล้อง</div>`;
    recalcRuleStats([]);
    return;
  }

  recalcRuleStats(events);

  if (!events.length) {
    det.innerHTML = `<div class="det-empty">No detection results for ${escapeHtml(currentCamera.name_cam)}</div>`;
    return;
  }

  det.innerHTML = events.map((ev, idx) => {
    const title = ev.name || 'Event';
    const sub = ev.sub || '-';
    const tag = ev.tag || '-';
    const level = ev.level || '-';
    const matchedRule = getMatchedRule(ev);

    const typeName = matchedRule ? matchedRule.type : 'match';
    const typeMeta = TYPE_META[typeName];

    return `
      <div class="det-item ${matchedRule ? (typeName === 'block' ? 'blocked' : 'hit') : 'miss'}" style="animation-delay:${idx * 40}ms">
        <div class="det-icon" style="background:${matchedRule ? `var(--${typeName}-b)` : 'rgba(255,255,255,.04)'};border:1px solid ${matchedRule ? `var(--${typeName}-bd)` : 'var(--bd)'}">
          <svg viewBox="0 0 24 24" fill="none" stroke="${matchedRule ? `var(--${typeName})` : 'var(--t2)'}" stroke-width="2.5">
            ${matchedRule
              ? '<polyline points="20,6 9,17 4,12"></polyline>'
              : '<line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line>'
            }
          </svg>
        </div>

        <div style="display:flex;flex-direction:column;gap:3px;flex:1;">
          <div class="det-name">${escapeHtml(title)}</div>
          <div style="font-size:10px;color:var(--t2)">
            Cam: ${escapeHtml(currentCamera.name_cam)} | ${escapeHtml(sub)} | Tag: ${escapeHtml(tag)} | Level: ${escapeHtml(level)}
          </div>
        </div>

        <span class="det-badge ${matchedRule ? typeMeta.tag : 'tag-match'}">
          ${matchedRule ? typeMeta.label : escapeHtml(tag)}
        </span>
      </div>
    `;
  }).join('');
}

/* ══════════════════════════════════════════════════════════
   RULE ENGINE
   ══════════════════════════════════════════════════════════ */
function eventToEvalContext(ev) {
  return {
    token_text: String(ev.name || ''),
    chunk_text: String(ev.desc || ''),
    sentiment_score: Number(ev.sentiment_score ?? 0),
    topic_score: Number(ev.topic_score ?? 0),
    confidence: ev.confidence == null ? null : Number(ev.confidence),
    category: String(ev.tag || ''),
    lang: String(ev.lang || ''),
    token_count: Number(ev.token_count ?? 0),
    latency_ms: Number(ev.latency_ms ?? 0),
    model_id: String(ev.model_id || ''),
    session_id: String(ev.session_id || ''),
    role: String(ev.role || ''),
  };
}

function compareValue(actual, op, expected, isNumberField) {
  if (isNumberField) {
    if (actual === null || actual === undefined || actual === '') {
      return false;
    }

    const a = Number(actual);
    const e = Number(expected);

    switch (op) {
      case 'gt': return a > e;
      case 'gte': return a >= e;
      case 'lt': return a < e;
      case 'lte': return a <= e;
      case 'equals': return a === e;
      case 'not_equals': return a !== e;
      default: return false;
    }
  }

  const a = String(actual ?? '').toLowerCase();
  const e = String(expected ?? '').toLowerCase();

  switch (op) {
    case 'contains': return a.includes(e);
    case 'not_contains': return !a.includes(e);
    case 'equals': return a === e;
    case 'not_equals': return a !== e;
    case 'starts_with': return a.startsWith(e);
    case 'ends_with': return a.endsWith(e);
    case 'regex':
      try {
        return new RegExp(expected, 'i').test(String(actual ?? ''));
      } catch {
        return false;
      }
    default:
      return false;
  }
}

function getMatchedRule(ev) {
  const ctx = eventToEvalContext(ev);

  for (const rule of rules) {
    if (!rule.enabled) continue;

    const results = rule.conditions.map((cond) => {
      const actual = ctx[cond.field];
      const isNumberField = NUMBER_FIELDS.includes(cond.field);
      return compareValue(actual, cond.op, cond.value, isNumberField);
    });

    const hit = rule.logic === 'AND' ? results.every(Boolean) : results.some(Boolean);
    if (hit) return rule;
  }

  return null;
}

/* ══════════════════════════════════════════════════════════
   RULE UI
   ══════════════════════════════════════════════════════════ */
function addRule(type) {
  hideAddMenu();

  const tpl = TEMPLATES[type];
  if (!tpl) return;

  const rule = {
    id: ++ruleId,
    type,
    name: tpl.name,
    enabled: true,
    _open: true,
    conditions: JSON.parse(JSON.stringify(tpl.conditions)),
    logic: tpl.logic,
    action: JSON.parse(JSON.stringify(tpl.action)),
    model_params: JSON.parse(JSON.stringify(tpl.model_params)),
    stats: { hits: 0, total: 0 },
  };

  rules.push(rule);
  renderRules();

  setTimeout(() => {
    document.getElementById(`card-${rule.id}`)?.scrollIntoView({
      behavior: 'smooth',
      block: 'nearest',
    });
  }, 60);
}

function renderRules() {
  const c = document.getElementById('rulesContainer');
  if (!c) return;

  c.innerHTML = '';
  rules.forEach((r) => c.appendChild(buildCard(r)));

  const badge = document.getElementById('ruleCountBadge');
  if (badge) badge.textContent = String(rules.length);

  renderJSON();
}

function buildCard(rule) {
  const meta = TYPE_META[rule.type];
  const card = document.createElement('div');

  card.className = `rule-card ${rule.enabled ? meta.cls : ''}`;
  card.id = `card-${rule.id}`;

  card.innerHTML = `
    <div class="rc-head" onclick="toggleCard(${rule.id})">
      <div class="rc-dot tc-${rule.type}"></div>
      <div class="rc-name">${escapeHtml(rule.name)}</div>
      <span class="rc-type-badge ${meta.tag}">${meta.label}</span>
      <button class="rc-toggle ${rule.enabled ? 'on' : ''}" id="tog-${rule.id}" onclick="event.stopPropagation();toggleEnable(${rule.id})"></button>
      <div class="rc-chevron ${rule._open ? 'open' : ''}" id="chev-${rule.id}">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
          <polyline points="9,18 15,12 9,6"></polyline>
        </svg>
      </div>
      <button class="rc-del" onclick="event.stopPropagation();deleteRule(${rule.id})">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M3 6h18M19 6l-1 14H6L5 6M8 6V4h8v2"></path>
        </svg>
      </button>
    </div>
    <div class="rc-body ${rule._open ? 'open' : ''}" id="body-${rule.id}">
      ${buildBody(rule)}
    </div>
  `;

  return card;
}

function buildBody(rule) {
  const a = rule.action;
  const p = rule.model_params;
  const condRows = rule.conditions.map((c, ci) => buildCondRow(rule.id, ci, c, rule.conditions.length)).join('');

  let aHtml = '';

  if (rule.type === 'match') {
    aHtml = `
      <div class="action-block">
        <div class="action-row">
          <span class="action-key">Label</span>
          <input class="inp" value="${escapeHtml(a.label || '')}" oninput="setAction(${rule.id},'label',this.value)">
        </div>
        <div class="action-row">
          <span class="action-key">Threshold</span>
          <div class="slider-row" style="flex:1">
            <input type="range" class="slider" min="0" max="1" step="0.05" value="${a.threshold || 0.5}" oninput="setAction(${rule.id},'threshold',parseFloat(this.value));this.nextElementSibling.textContent=parseFloat(this.value).toFixed(2)">
            <span class="slider-val">${Number(a.threshold || 0.5).toFixed(2)}</span>
          </div>
        </div>
      </div>
    `;
  } else if (rule.type === 'block') {
    aHtml = `
      <div class="action-block">
        <div class="action-row">
          <span class="action-key">Replace</span>
          <input class="inp" value="${escapeHtml(a.replacement || '')}" oninput="setAction(${rule.id},'replacement',this.value)">
        </div>
        <div class="action-row">
          <span class="action-key">Notify</span>
          <select class="sel w-sm" onchange="setAction(${rule.id},'notify',this.value==='true')">
            <option value="true" ${a.notify ? 'selected' : ''}>Yes</option>
            <option value="false" ${!a.notify ? 'selected' : ''}>No</option>
          </select>
        </div>
      </div>
    `;
  } else if (rule.type === 'flag') {
    aHtml = `
      <div class="action-block">
        <div class="action-row">
          <span class="action-key">Tag</span>
          <input class="inp" value="${escapeHtml(a.tag || '')}" oninput="setAction(${rule.id},'tag',this.value)">
        </div>
        <div class="action-row">
          <span class="action-key">Severity</span>
          <select class="sel w-md" onchange="setAction(${rule.id},'severity',this.value)">
            ${['low', 'medium', 'high', 'critical'].map((s) => `
              <option value="${s}" ${s === a.severity ? 'selected' : ''}>${s}</option>
            `).join('')}
          </select>
        </div>
      </div>
    `;
  } else if (rule.type === 'transform') {
    aHtml = `
      <div class="action-block">
        <div class="action-row" style="align-items:flex-start">
          <span class="action-key" style="padding-top:3px">Prompt</span>
          <textarea class="ta" oninput="setAction(${rule.id},'prompt',this.value)">${escapeHtml(a.prompt || '')}</textarea>
        </div>
        <div class="action-row">
          <span class="action-key">Inject</span>
          <input class="inp" value="${escapeHtml(a.inject_before || '')}" oninput="setAction(${rule.id},'inject_before',this.value)">
        </div>
      </div>
    `;
  } else if (rule.type === 'route') {
    aHtml = `
      <div class="action-block">
        <div class="action-row">
          <span class="action-key">Target</span>
          <input class="inp" value="${escapeHtml(a.target_agent || '')}" oninput="setAction(${rule.id},'target_agent',this.value)">
        </div>
        <div class="action-row">
          <span class="action-key">Priority</span>
          <select class="sel w-md" onchange="setAction(${rule.id},'priority',this.value)">
            ${['low', 'normal', 'high', 'critical'].map((pr) => `
              <option value="${pr}" ${pr === a.priority ? 'selected' : ''}>${pr}</option>
            `).join('')}
          </select>
        </div>
      </div>
    `;
  }

  return `
    <div class="cond-block">
      <div class="cond-label">
        Conditions
        <select class="sel w-sm" style="font-size:9px;padding:2px 18px 2px 6px" onchange="setLogic(${rule.id},this.value)">
          <option value="AND" ${rule.logic === 'AND' ? 'selected' : ''}>ALL (AND)</option>
          <option value="OR" ${rule.logic === 'OR' ? 'selected' : ''}>ANY (OR)</option>
        </select>
      </div>
      <div id="conds-${rule.id}">${condRows}</div>
      <button class="add-cond" onclick="addCond(${rule.id})">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
          <line x1="12" y1="5" x2="12" y2="19"></line>
          <line x1="5" y1="12" x2="19" y2="12"></line>
        </svg>
        Add condition
      </button>
    </div>

    <div class="cond-block">
      <div class="cond-label">Action</div>
      ${aHtml}
    </div>

    <div class="cond-block" style="margin-bottom:0">
      <div class="cond-label">Model Parameters</div>
      <div class="param-grid">
        <div class="param-item">
          <div class="param-name">Temperature</div>
          <div class="slider-row">
            <input type="range" class="slider" min="0" max="2" step="0.05" value="${p.temperature}" oninput="setParam(${rule.id},'temperature',parseFloat(this.value));this.nextElementSibling.textContent=this.value">
            <span class="slider-val">${p.temperature}</span>
          </div>
        </div>

        <div class="param-item">
          <div class="param-name">Top-P</div>
          <div class="slider-row">
            <input type="range" class="slider" min="0.01" max="1" step="0.01" value="${p.top_p}" oninput="setParam(${rule.id},'top_p',parseFloat(this.value));this.nextElementSibling.textContent=this.value">
            <span class="slider-val">${p.top_p}</span>
          </div>
        </div>

        <div class="param-item" style="grid-column:span 2">
          <div class="param-name">Max Tokens</div>
          <div class="slider-row">
            <input type="range" class="slider" min="64" max="4096" step="64" value="${p.max_tokens}" oninput="setParam(${rule.id},'max_tokens',parseInt(this.value,10));this.nextElementSibling.textContent=this.value">
            <span class="slider-val">${p.max_tokens}</span>
          </div>
        </div>
      </div>
    </div>
  `;
}

function buildCondRow(rid, ci, cond, total) {
  const ops = getOps(cond.field);

  return `
    <div class="cond-row" id="cr-${rid}-${ci}">
      <span class="cond-logic">${ci === 0 ? 'IF' : 'AND'}</span>

      <select class="sel w-md" onchange="updateCond(${rid},${ci},'field',this.value);rerenderOps(${rid},${ci})">
        ${FIELDS.map((f) => `<option value="${f}" ${f === cond.field ? 'selected' : ''}>${f}</option>`).join('')}
      </select>

      <select class="sel w-sm" id="opsel-${rid}-${ci}" onchange="updateCond(${rid},${ci},'op',this.value)">
        ${ops.map((op) => `<option value="${op}" ${op === cond.op ? 'selected' : ''}>${op}</option>`).join('')}
      </select>

      <input class="inp" placeholder="value…" value="${escapeHtml(cond.value || '')}" oninput="updateCond(${rid},${ci},'value',this.value)">

      ${total > 1 ? `
        <button
          style="width:19px;height:19px;display:flex;align-items:center;justify-content:center;border-radius:4px;background:none;border:none;color:var(--t2);cursor:pointer;flex-shrink:0"
          onmouseenter="this.style.background='var(--red-b)';this.style.color='var(--red)'"
          onmouseleave="this.style.background='none';this.style.color='var(--t2)'"
          onclick="removeCond(${rid},${ci})"
        >
          <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
            <line x1="18" y1="6" x2="6" y2="18"></line>
            <line x1="6" y1="6" x2="18" y2="18"></line>
          </svg>
        </button>
      ` : ''}
    </div>
  `;
}

function deleteRule(id) {
  const idx = rules.findIndex((r) => r.id === id);
  if (idx >= 0) rules.splice(idx, 1);
  renderRules();
  renderEvents(currentEvents);
  renderDetectionFromEvents(currentEvents);
  renderStats();
  renderJSON();
}

function toggleEnable(id) {
  const r = rules.find((x) => x.id === id);
  if (!r) return;

  r.enabled = !r.enabled;

  const card = document.getElementById(`card-${id}`);
  if (card) {
    card.className = `rule-card ${r.enabled ? TYPE_META[r.type].cls : ''}`;
  }

  const tog = document.getElementById(`tog-${id}`);
  if (tog) tog.classList.toggle('on', r.enabled);

  renderEvents(currentEvents);
  renderDetectionFromEvents(currentEvents);
  renderStats();
  renderJSON();
}

function toggleCard(id) {
  const r = rules.find((x) => x.id === id);
  if (!r) return;

  r._open = !r._open;
  document.getElementById(`body-${id}`)?.classList.toggle('open', r._open);
  document.getElementById(`chev-${id}`)?.classList.toggle('open', r._open);
}

function setLogic(id, value) {
  const r = rules.find((x) => x.id === id);
  if (!r) return;
  r.logic = value;
  renderEvents(currentEvents);
  renderDetectionFromEvents(currentEvents);
  renderStats();
  renderJSON();
}

function addCond(id) {
  const r = rules.find((x) => x.id === id);
  if (!r) return;

  r.conditions.push({ field: 'token_text', op: 'contains', value: '' });
  document.getElementById(`conds-${id}`).innerHTML =
    r.conditions.map((c, ci) => buildCondRow(id, ci, c, r.conditions.length)).join('');

  renderEvents(currentEvents);
  renderDetectionFromEvents(currentEvents);
  renderStats();
  renderJSON();
}

function removeCond(id, ci) {
  const r = rules.find((x) => x.id === id);
  if (!r) return;

  r.conditions.splice(ci, 1);
  document.getElementById(`conds-${id}`).innerHTML =
    r.conditions.map((c, xci) => buildCondRow(id, xci, c, r.conditions.length)).join('');

  renderEvents(currentEvents);
  renderDetectionFromEvents(currentEvents);
  renderStats();
  renderJSON();
}

function updateCond(id, ci, key, value) {
  const r = rules.find((x) => x.id === id);
  if (!r || !r.conditions[ci]) return;

  r.conditions[ci][key] = value;
  renderEvents(currentEvents);
  renderDetectionFromEvents(currentEvents);
  renderStats();
  renderJSON();
}

function rerenderOps(id, ci) {
  const r = rules.find((x) => x.id === id);
  if (!r || !r.conditions[ci]) return;

  const cond = r.conditions[ci];
  const el = document.getElementById(`opsel-${id}-${ci}`);
  if (!el) return;

  const ops = getOps(cond.field);
  el.innerHTML = ops.map((op) => `<option value="${op}">${op}</option>`).join('');
  cond.op = ops[0];
  el.value = cond.op;

  renderEvents(currentEvents);
  renderDetectionFromEvents(currentEvents);
  renderStats();
  renderJSON();
}

function setAction(id, key, value) {
  const r = rules.find((x) => x.id === id);
  if (!r) return;

  r.action[key] = value;
  renderJSON();
}

function setParam(id, key, value) {
  const r = rules.find((x) => x.id === id);
  if (!r) return;

  r.model_params[key] = value;
  renderJSON();
}

function showAddMenu() {
  const el = document.getElementById('addMenu');
  if (el) el.style.display = 'flex';
}

function hideAddMenu(e) {
  const menu = document.getElementById('addMenu');
  if (!menu) return;

  if (!e || e.target === menu) {
    menu.style.display = 'none';
  }
}

function importRules() {
  const inp = document.createElement('input');
  inp.type = 'file';
  inp.accept = '.json';

  inp.onchange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const data = JSON.parse(ev.target.result);
        const incoming = Array.isArray(data?.rules) ? data.rules : [];

        incoming.forEach((rule) => {
          rules.push({
            ...rule,
            id: ++ruleId,
            _open: false,
            stats: { hits: 0, total: 0 },
          });
        });

        renderRules();
        renderEvents(currentEvents);
        renderDetectionFromEvents(currentEvents);
        renderStats();
        renderJSON();
      } catch {
        alert('Invalid JSON');
      }
    };

    reader.readAsText(file);
  };

  inp.click();
}

/* ══════════════════════════════════════════════════════════
   JSON / STATS
   ══════════════════════════════════════════════════════════ */
function buildExportData() {
  return {
    version: '1.0',
    pipeline: 'camera-stream',
    selected_camera: currentCamera ? {
      id_cam: currentCamera.id_cam,
      name: currentCamera.name,
      name_cam: currentCamera.name_cam,
      type_event: currentCamera.type_event,
      hls: currentCamera.hls,
    } : null,
    selected_event_index: currentEventIndex,
    selected_event: getCurrentEvent(),
    cameras: CAMERAS.map((c) => ({
      id: c.id_cam,
      name: c.name,
      name_cam: c.name_cam,
      type_event: c.type_event,
      hls: c.hls,
    })),
    event_count: currentEvents.length,
    events: currentEvents,
    rules: rules.filter((r) => r.enabled).map((r) => ({
      id: r.id,
      name: r.name,
      type: r.type,
      logic: r.logic,
      conditions: r.conditions,
      action: r.action,
      model_params: r.model_params,
      stats: r.stats,
    })),
  };
}

function syntaxHL(jsonStr) {
  return jsonStr
    .replace(/("[\w_]+")\s*:/g, '<span class="json-key">$1</span>:')
    .replace(/:\s*(".*?")/g, ': <span class="json-str">$1</span>')
    .replace(/:\s*(true|false)/g, ': <span class="json-bool">$1</span>')
    .replace(/:\s*(-?\d+\.?\d*)/g, ': <span class="json-num">$1</span>');
}

function renderJSON() {
  const data = buildExportData();
  lastJSONData = data;

  const jsonBox = document.getElementById('jsonBox');
  if (!jsonBox) return;

  jsonBox.innerHTML = syntaxHL(toShortJson(data));
}

async function copyJSON() {
  try {
    const data = lastJSONData || buildExportData();
    await navigator.clipboard.writeText(JSON.stringify(data, null, 2));

    const btn = document.querySelector('.exp-btn.hi');
    if (btn) {
      const old = btn.textContent;
      btn.textContent = 'Copied!';
      setTimeout(() => {
        btn.textContent = old || 'Copy JSON';
      }, 1500);
    }
  } catch (err) {
    console.error('copyJSON error:', err);
  }
}

function downloadJSON() {
  const data = lastJSONData || buildExportData();
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json;charset=utf-8' });
  const url = URL.createObjectURL(blob);

  const a = document.createElement('a');
  a.href = url;
  a.download = 'camera-stream.json';
  a.click();

  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function getCurrentSetting() {
  if (!currentSettings.length) return null;
  if (currentSettingIndex < 0 || currentSettingIndex >= currentSettings.length) {
    currentSettingIndex = 0;
  }
  return currentSettings[currentSettingIndex] || null;
}

function renderStats() {
  const p = document.getElementById('statsPanel');
  if (!p) return;

  if (!currentCamera) {
    p.innerHTML = `
      <div style="padding:16px;font-size:11px;font-style:italic;color:var(--t2)">
        No camera selected.
      </div>
    `;
    return;
  }

  if (!currentSettings || !currentSettings.length) {
    p.innerHTML = `
      <div class="stat-card" style="padding:14px;">
        <div class="stat-row" style="margin-bottom:12px;">
          <span class="stat-name">Detection Settings</span>
          <span class="stat-val">${escapeHtml(currentCamera.name_cam)}</span>
        </div>
        <div style="font-size:11px;color:var(--t2);">
          No settings data from API for this camera.
        </div>
      </div>
    `;
    return;
  }

  const item = getCurrentSetting();
  if (!item) return;

  const optionsHtml = currentSettings.map((s, idx) => {
    const label = s.name || s.tag || `Setting ${idx + 1}`;
    return `<option value="${idx}" ${idx === currentSettingIndex ? 'selected' : ''}>${escapeHtml(label)}</option>`;
  }).join('');

  p.innerHTML = `
    <div class="stat-card" style="padding:14px;">
      <div class="stat-row" style="margin-bottom:12px;">
        <span class="stat-name">Detection Settings</span>
        <span class="stat-val">${escapeHtml(currentCamera.name_cam)}</span>
      </div>

      <div class="edit-grid" style="display:grid;grid-template-columns:1fr;gap:10px;">
        <div>
          <label class="stat-name">Model Prompt</label>
          <input class="inp" id="edit-name" value="${escapeHtml(item.model_prompt || '')}">
        </div>

        <div>
          <label class="stat-name">Text Prompt</label>
          <input class="inp" id="edit-sub" value="${escapeHtml(item.config_prompt || '')}">
        </div>
        
        <div>
          <label class="stat-name">Status Prompt</label>
          <span class="status-badge ${item.status_prompt ? 'status-on' : 'status-off'}">
            ${escapeHtml(formatBool(item.status_prompt))}
          </span>
        </div>

        <div>
          <label class="stat-name">Status Sub Prompt</label>
          <span class="status-badge ${item.status_sub_prompt ? 'status-on' : 'status-off'}">
            ${escapeHtml(formatBool(item.status_sub_prompt))}
          </span>
        </div>

        <div>
          <label class="stat-name">Activate Prompt</label>
          <div class="param-item bool-param-item">
            <div class="bool-switch">
              <label class="bool-opt">
                <input type="radio" name="use_prompt" value="true" ${item.use_prompt ? 'checked' : ''}>
                <span>ON</span>
              </label>
              <label class="bool-opt">
                <input type="radio" name="use_prompt" value="false" ${!item.use_prompt ? 'checked' : ''}>
                <span>OFF</span>
              </label>
            </div>
          </div>
        </div>

        <div>
          <label class="stat-name">Activate Sub Prompt</label>
          <div class="param-item bool-param-item">
            <div class="bool-switch">
              <label class="bool-opt">
                <input type="radio" name="use_sub_prompt" value="true" ${item.use_sub_prompt ? 'checked' : ''}>
                <span>ON</span>
              </label>
              <label class="bool-opt">
                <input type="radio" name="use_sub_prompt" value="false" ${!item.use_sub_prompt ? 'checked' : ''}>
                <span>OFF</span>
              </label>
            </div>
          </div>
        </div>

        <hr class="divider">

        <div>
          <label class="stat-name">Model Detect</label>
          <input class="inp" id="edit-lat" value="${escapeHtml(item.model_detect ?? '')}">
        </div>

        <div>
          <label class="stat-name">Valus Threshold</label>
          <input class="inp" id="edit-lng" value="${escapeHtml(item.config_detect ?? '')}">
        </div>

        <div>
          <label class="stat-name">Status Detect</label>
          <span class="status-badge ${item.status_detect ? 'status-on' : 'status-off'}">
            ${escapeHtml(formatBool(item.status_detect))}
          </span>
        </div>

        <div>
          <label class="stat-name">Activate Detect</label>
          <div class="param-item bool-param-item">
            <div class="bool-switch">
              <label class="bool-opt">
                <input type="radio" name="use_detect" value="true" ${item.use_detect ? 'checked' : ''}>
                <span>ON</span>
              </label>
              <label class="bool-opt">
                <input type="radio" name="use_detect" value="false" ${!item.use_detect ? 'checked' : ''}>
                <span>OFF</span>
              </label>
            </div>
          </div>
        </div>

        <div style="display:flex;gap:8px;justify-content:flex-end;margin-top:6px;">
          <button class="exp-btn" onclick="resetStatsForm()">Reset</button>
          <button class="exp-btn hi" onclick="saveCurrentSetting()">Save</button>
        </div>
        
      </div>
    </div>
  `;
}

function formatBool(v){
  if (v === true) return "on";
  if (v === false) return "off";
  if (v === null || v === undefined) return "";
  return String(v);
}

function changeStatsEvent(idx) {
  currentEventIndex = Number(idx) || 0;
  renderStats();
}

function resetStatsForm() {
  renderStats();
}

async function saveCurrentEvent() {
  const original = getCurrentEvent();
  if (!original) {
    alert('No event to save');
    return;
  }

  const payload = {
    _id: original._id,
    id_cam: original.id_cam,
    name: document.getElementById('edit-name')?.value?.trim() || '',
    sub: document.getElementById('edit-sub')?.value?.trim() || '',
    tag: document.getElementById('edit-tag')?.value?.trim() || '',
    level: document.getElementById('edit-level')?.value?.trim() || '',
    hours: document.getElementById('edit-hours')?.value?.trim() || '',
    img: document.getElementById('edit-img')?.value?.trim() || '',
    desc: document.getElementById('edit-desc')?.value?.trim() || '',
    lat: parseFloat(document.getElementById('edit-lat')?.value || '0'),
    lng: parseFloat(document.getElementById('edit-lng')?.value || '0'),
  };

  try {
    const res = await fetch(`${API_BASE}/nexora/api/updateEvent`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      throw new Error(`HTTP ${res.status}`);
    }

    const data = await res.json();
    console.log('saveCurrentEvent success:', data);

    currentEvents[currentEventIndex] = {
      ...currentEvents[currentEventIndex],
      ...payload,
    };

    renderEvents(currentEvents);
    renderDetectionFromEvents(currentEvents);
    renderJSON();
    renderStats();

    alert('Saved successfully');
  } catch (err) {
    console.error('saveCurrentEvent error:', err);
    alert(`Save failed: ${err.message}`);
  }
}

function switchTab(tab) {
  document.querySelectorAll('.rp-tab').forEach((t) => {
    t.classList.toggle('on', t.dataset.tab === tab);
  });

  document.querySelectorAll('.rp-panel').forEach((p) => {
    p.classList.toggle('on', p.id === `tab-${tab}`);
  });

  if (tab === 'json') renderJSON();
  if (tab === 'stats') renderStats();
}

/* ══════════════════════════════════════════════════════════
   MISC
   ══════════════════════════════════════════════════════════ */
function clearFeed() {
  currentEvents = [];
  currentEventIndex = 0;
  renderEvents([]);
  renderDetectionFromEvents([]);
  renderStats();
  renderJSON();
  setText('tokenCount', '0');
  setText('hitCount', '0');
}

/* ══════════════════════════════════════════════════════════
   INIT
   ══════════════════════════════════════════════════════════ */
window.addEventListener('load', async () => {
  ['match', 'block', 'route'].forEach((t) => {
    addRule(t);
    rules[rules.length - 1]._open = false;
  });
  renderRules();

  showPlaceholder('เลือกกล้องด้านบน', 'คลิกที่ card กล้องเพื่อเริ่มดู stream');

  await loadCameras();
});


async function saveCurrentSetting() {
  const original = getCurrentSetting();
  if (!original) {
    alert('No setting to save');
    return;
  }

  const payload = {
    _id: original._id,
    id_cam: original.id_cam,
    name: document.getElementById('edit-name')?.value?.trim() || '',
    sub: document.getElementById('edit-sub')?.value?.trim() || '',
    tag: document.getElementById('edit-tag')?.value?.trim() || '',
    level: document.getElementById('edit-level')?.value?.trim() || '',
    hours: document.getElementById('edit-hours')?.value?.trim() || '',
    img: document.getElementById('edit-img')?.value?.trim() || '',
    desc: document.getElementById('edit-desc')?.value?.trim() || '',
    lat: parseFloat(document.getElementById('edit-lat')?.value || '0'),
    lng: parseFloat(document.getElementById('edit-lng')?.value || '0'),
  };

  try {
    const res = await fetch(`${API_BASE}/nexora/api/updateSetting`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    if (!res.ok) throw new Error(`HTTP ${res.status}`);

    const data = await res.json();
    console.log('saveCurrentSetting success:', data);

    currentSettings[currentSettingIndex] = {
      ...currentSettings[currentSettingIndex],
      ...payload,
    };

    renderStats();
    renderJSON();
    alert('Saved successfully');
  } catch (err) {
    console.error('saveCurrentSetting error:', err);
    alert(`Save failed: ${err.message}`);
  }
}

function changeStatsSetting(idx) {
  currentSettingIndex = Number(idx) || 0;
  renderStats();
}



async function submitRules(){

  const payload = {
    stream_id: currentStream,
    rules: RULES   // array ที่คุณเก็บจาก addRule()
  };

  try{

    const res = await fetch("/nexora/api/addRule",{
      method:"POST",
      headers:{
        "Content-Type":"application/json"
      },
      body: JSON.stringify(payload)
    });

    const data = await res.json();

    console.log("API result:",data);

    hideAddMenu();

  }catch(err){
    console.error("submit error:",err);
  }

}


/* expose for inline onclick in HTML */
window.selectCam = selectCam;
window.switchTab = switchTab;
window.copyJSON = copyJSON;
window.downloadJSON = downloadJSON;
window.clearFeed = clearFeed;
window.showAddMenu = showAddMenu;
window.hideAddMenu = hideAddMenu;
window.addRule = addRule;
window.deleteRule = deleteRule;
window.toggleEnable = toggleEnable;
window.toggleCard = toggleCard;
window.setLogic = setLogic;
window.addCond = addCond;
window.removeCond = removeCond;
window.updateCond = updateCond;
window.rerenderOps = rerenderOps;
window.setAction = setAction;
window.setParam = setParam;
window.importRules = importRules;
window.saveCurrentEvent = saveCurrentEvent;
window.resetStatsForm = resetStatsForm;
window.changeStatsEvent = changeStatsEvent;
window.changeStatsSetting = changeStatsSetting;
window.saveCurrentSetting = saveCurrentSetting;
window.resetStatsForm = resetStatsForm;