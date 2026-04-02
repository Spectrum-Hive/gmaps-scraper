/**
 * Frontend: tab UI, scrape polling, localStorage persistence, export helpers.
 */

const LS_KEY = 'gmaps_scrape_sessions';

/** @returns {typeof window.scraperFormData} */
function getFormConfig() {
  return window.scraperFormData || {};
}

/**
 * Replace `<select>` options (keeps first placeholder opt if clearFirst).
 * @param {HTMLSelectElement} el
 * @param {{ value: string, label: string }[]} options
 * @param {string} placeholder
 */
function setSelectOptions(el, options, placeholder) {
  el.innerHTML = '';
  const ph = document.createElement('option');
  ph.value = '';
  ph.textContent = placeholder;
  el.appendChild(ph);
  options.forEach((o) => {
    const opt = document.createElement('option');
    opt.value = o.value;
    opt.textContent = o.label;
    el.appendChild(opt);
  });
}

function onCountryChanged() {
  const cfg = getFormConfig();
  const country = $('field-country').value;
  updateZipFieldHint(country);
  const stateEl = $('field-state');
  const zipEl = $('field-zip');

  if (country === 'United States' && cfg.usStates) {
    const rows = Object.keys(cfg.usStates)
      .map((code) => ({
        value: cfg.usStates[code].name,
        label: cfg.usStates[code].name,
        code,
      }))
      .sort((a, b) => a.label.localeCompare(b.label));
    setSelectOptions(stateEl, rows, 'Select state / province');
    setSelectOptions(zipEl, [], 'Select ZIP / postal code');
    stateEl.disabled = false;
    zipEl.disabled = false;
    if (rows.length) {
      stateEl.selectedIndex = 1;
      onStateChanged();
    }
    return;
  }

  if (country === 'Canada' && cfg.canadaProvinces) {
    const rows = Object.keys(cfg.canadaProvinces)
      .map((code) => ({
        value: cfg.canadaProvinces[code].name,
        label: cfg.canadaProvinces[code].name,
        code,
      }))
      .sort((a, b) => a.label.localeCompare(b.label));
    setSelectOptions(stateEl, rows, 'Select province / territory');
    setSelectOptions(zipEl, [], 'Select postal code');
    stateEl.disabled = false;
    zipEl.disabled = false;
    if (rows.length) {
      stateEl.selectedIndex = 1;
      onStateChanged();
    }
    return;
  }

  if (country === 'India' && cfg.indiaStates) {
    const rows = Object.keys(cfg.indiaStates)
      .map((code) => ({
        value: cfg.indiaStates[code].name,
        label: cfg.indiaStates[code].name,
        code,
      }))
      .sort((a, b) => a.label.localeCompare(b.label));
    setSelectOptions(stateEl, rows, 'Select state / union territory');
    setSelectOptions(zipEl, [], 'Select PIN code');
    stateEl.disabled = false;
    zipEl.disabled = false;
    if (rows.length) {
      stateEl.selectedIndex = 1;
      onStateChanged();
    }
    return;
  }

  const intl = cfg.international && cfg.international[country];
  if (intl) {
    const rows = (intl.regions || []).map((r) => ({ value: r, label: r }));
    setSelectOptions(stateEl, rows, 'Select region');
    const zips = (intl.zips || []).map((z) => ({ value: z, label: z }));
    setSelectOptions(zipEl, zips, 'Select postal code / area code');
    stateEl.disabled = false;
    zipEl.disabled = false;
    if (rows.length) stateEl.selectedIndex = 1;
    if (zips.length) zipEl.selectedIndex = 1;
    return;
  }

  /** Other: location not narrowed — keep selects enabled so values submit with the form. */
  stateEl.innerHTML = '';
  zipEl.innerHTML = '';
  const sOpt = document.createElement('option');
  sOpt.value = '';
  sOpt.textContent = 'Not specified';
  stateEl.appendChild(sOpt);
  const zOpt = document.createElement('option');
  zOpt.value = '';
  zOpt.textContent = 'Not specified';
  zipEl.appendChild(zOpt);
  stateEl.disabled = false;
  zipEl.disabled = false;
}

/** Populate country & industry lists; wire dependent state/ZIP selects. */
function initFormDropdowns() {
  const cfg = getFormConfig();
  const countryEl = $('field-country');
  const industryEl = $('field-industry');

  setSelectOptions(
    countryEl,
    (cfg.countries || []).map((c) => ({ value: c, label: c })),
    'Select country'
  );

  setSelectOptions(
    industryEl,
    (cfg.industries || []).map((i) => ({ value: i, label: i })),
    'Select industry'
  );

  countryEl.addEventListener('change', onCountryChanged);
  $('field-state').addEventListener('change', () => {
    void onStateChanged();
  });

  /** Default to United States for quicker starts */
  const us = (cfg.countries || []).indexOf('United States');
  if (us >= 0) countryEl.selectedIndex = us + 1;
  onCountryChanged();
}

const CSV_COLUMNS = [
  'Business Name',
  'Category',
  'Address',
  'City',
  'State',
  'Zip',
  'Country',
  'Phone',
  'Secondary Phone',
  'Emails',
  'Website',
  'Rating',
  'Review Count',
  'Price Range',
  'Is Open',
  'Business Hours',
  'Google Maps URL',
  'Plus Code',
  'Facebook',
  'Instagram',
  'Twitter',
  'LinkedIn',
  'YouTube',
  'TikTok',
  'Meta Description',
  'About',
  'Amenities',
  'Photo Count',
  'Is Claimed',
  'Scraped At',
];

/**
 * Saved-session expand table: same fields as CSV (one column per field).
 * @type {{ label: string, get: (r: object) => unknown, isUrl?: boolean }[]}
 */
const SAVED_EXPAND_COLUMNS = [
  { label: 'Business name', get: (r) => r.businessName },
  { label: 'Category', get: (r) => r.category },
  { label: 'Address', get: (r) => r.address },
  { label: 'City', get: (r) => r.city },
  { label: 'State', get: (r) => r.state },
  { label: 'Zip', get: (r) => r.zip },
  { label: 'Country', get: (r) => r.country },
  { label: 'Phone', get: (r) => r.phone },
  { label: 'Secondary phone', get: (r) => r.secondaryPhone },
  { label: 'Emails', get: (r) => (r.emails || []).join('; ') },
  { label: 'Website', get: (r) => r.website, isUrl: true },
  { label: 'Rating', get: (r) => r.rating },
  { label: 'Review count', get: (r) => r.reviewCount },
  { label: 'Price range', get: (r) => r.priceRange },
  {
    label: 'Open',
    get: (r) => (r.isOpen == null ? '' : String(r.isOpen)),
  },
  {
    label: 'Hours',
    get: (r) =>
      r.businessHours && typeof r.businessHours === 'object'
        ? JSON.stringify(r.businessHours)
        : '',
  },
  { label: 'Google Maps URL', get: (r) => r.googleMapsUrl, isUrl: true },
  { label: 'Plus code', get: (r) => r.plusCode },
  { label: 'Facebook', get: (r) => r.socialLinks?.facebook, isUrl: true },
  { label: 'Instagram', get: (r) => r.socialLinks?.instagram, isUrl: true },
  { label: 'Twitter/X', get: (r) => r.socialLinks?.twitter, isUrl: true },
  { label: 'LinkedIn', get: (r) => r.socialLinks?.linkedin, isUrl: true },
  { label: 'YouTube', get: (r) => r.socialLinks?.youtube, isUrl: true },
  { label: 'TikTok', get: (r) => r.socialLinks?.tiktok, isUrl: true },
  { label: 'Meta description', get: (r) => r.metaDescription },
  { label: 'About', get: (r) => r.about },
  { label: 'Amenities', get: (r) => (r.amenities || []).join('; ') },
  { label: 'Photo count', get: (r) => r.photoCount },
  {
    label: 'Claimed',
    get: (r) => (r.isClaimed == null ? '' : String(r.isClaimed)),
  },
  { label: 'Scraped at', get: (r) => r.scrapedAt },
];

function savedExpandHeaderCell(label) {
  return `<th class="saved-expand-th px-1.5 py-2 text-left font-semibold whitespace-nowrap bg-slate-100 border-b border-slate-200 text-slate-600">${escapeHtml(label)}</th>`;
}

/**
 * One data cell for expanded saved row.
 * @param {object} r
 * @param {{ label: string, get: (r: object) => unknown, isUrl?: boolean }} col
 */
function savedExpandDataCell(r, col) {
  const raw = col.get(r);
  const str = raw == null || raw === '' ? '' : String(raw);
  const title = escapeAttr(str);
  let inner;
  if (col.isUrl && str && /^https?:\/\//i.test(str)) {
    inner = `<a href="${escapeAttr(str)}" class="text-teal-700 underline break-all" target="_blank" rel="noopener">${escapeHtml(str)}</a>`;
  } else {
    inner = escapeHtml(str);
  }
  return `<td class="px-1.5 py-1.5 align-top text-slate-800 border-t border-slate-100 min-w-[7rem] max-w-xs" title="${title}"><div class="max-h-32 overflow-y-auto text-[11px] leading-snug break-words">${inner || '—'}</div></td>`;
}

// --- localStorage helpers -------------------------------------------------

function readRawSessions() {
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeRawSessions(sessions) {
  localStorage.setItem(LS_KEY, JSON.stringify(sessions));
}

/**
 * Stable fingerprint for “same scrape” detection (query + size + sample of place ids).
 * @param {object} query
 * @param {object[]} results
 */
function scrapeFingerprint(query, results) {
  const q = JSON.stringify(query || {});
  const arr = results || [];
  const n = arr.length;
  const head = arr
    .slice(0, 5)
    .map((r) => String(r.googleMapsUrl || r.businessName || '').trim())
    .join('\x1e');
  const tail = arr
    .slice(Math.max(0, n - 5))
    .map((r) => String(r.googleMapsUrl || r.businessName || '').trim())
    .join('\x1e');
  return `${q}\x1e${n}\x1e${head}\x1e${tail}`;
}

/**
 * Save a new session (append). Handles quota errors with user alert.
 * Skips writing if the newest stored session is the same data within DUPLICATE_WINDOW_MS
 * (stops auto-save + manual save doubling, or double form submit).
 * @param {{ query: object, results: object[] }} sessionData
 * @returns {string|null} sessionId or null on failure / duplicate (returns existing id if duplicate)
 */
function saveSession(sessionData) {
  const DUPLICATE_WINDOW_MS = 120000;
  const fp = scrapeFingerprint(sessionData.query, sessionData.results);
  const all = readRawSessions();
  if (all.length > 0) {
    const newest = all[0];
    const ageMs = Date.now() - new Date(newest.createdAt).getTime();
    if (
      ageMs >= 0 &&
      ageMs < DUPLICATE_WINDOW_MS &&
      scrapeFingerprint(newest.query, newest.results) === fp
    ) {
      return newest.sessionId;
    }
  }

  const sessionId =
    crypto.randomUUID?.() ||
    `sess-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
  const session = {
    sessionId,
    createdAt: new Date().toISOString(),
    query: sessionData.query || {},
    totalRecords: (sessionData.results || []).length,
    results: sessionData.results || [],
  };
  all.unshift(session);
  try {
    writeRawSessions(all);
  } catch (e) {
    if (e && (e.name === 'QuotaExceededError' || e.code === 22)) {
      alert(
        'Browser storage is full (> ~5MB). Export important sessions to CSV/JSON, then delete old sessions or clear all data.'
      );
      return null;
    }
    throw e;
  }
  return sessionId;
}

function getAllSessions() {
  return readRawSessions();
}

function getSession(sessionId) {
  return readRawSessions().find((s) => s.sessionId === sessionId) || null;
}

function deleteSession(sessionId) {
  const next = readRawSessions().filter((s) => s.sessionId !== sessionId);
  writeRawSessions(next);
}

function clearAllSessions() {
  localStorage.removeItem(LS_KEY);
}

/**
 * Search across every record in every session.
 * @param {string} query
 * @returns {{ sessionId: string, record: object }[]}
 */
function searchAllRecords(query) {
  const q = String(query || '')
    .trim()
    .toLowerCase();
  if (!q) return null;
  const out = [];
  for (const s of readRawSessions()) {
    for (const r of s.results || []) {
      const hay = [
        r.businessName,
        r.phone,
        r.secondaryPhone,
        (r.emails || []).join(' '),
        r.zip,
        r.address,
        r.city,
        r.website,
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
      if (hay.includes(q)) out.push({ sessionId: s.sessionId, record: r });
    }
  }
  return out;
}

function recordToCsvObject(r) {
  const hours =
    r.businessHours && typeof r.businessHours === 'object'
      ? JSON.stringify(r.businessHours)
      : '';
  const emails = Array.isArray(r.emails) ? r.emails.join('; ') : '';
  const amenities = Array.isArray(r.amenities) ? r.amenities.join('; ') : '';
  const soc = r.socialLinks || {};
  return {
    'Business Name': r.businessName ?? '',
    Category: r.category ?? '',
    Address: r.address ?? '',
    City: r.city ?? '',
    State: r.state ?? '',
    Zip: r.zip ?? '',
    Country: r.country ?? '',
    Phone: r.phone ?? '',
    'Secondary Phone': r.secondaryPhone ?? '',
    Emails: emails,
    Website: r.website ?? '',
    Rating: r.rating ?? '',
    'Review Count': r.reviewCount ?? '',
    'Price Range': r.priceRange ?? '',
    'Is Open':
      r.isOpen === null || r.isOpen === undefined ? '' : String(r.isOpen),
    'Business Hours': hours,
    'Google Maps URL': r.googleMapsUrl ?? '',
    'Plus Code': r.plusCode ?? '',
    Facebook: soc.facebook ?? '',
    Instagram: soc.instagram ?? '',
    Twitter: soc.twitter ?? '',
    LinkedIn: soc.linkedin ?? '',
    YouTube: soc.youtube ?? '',
    TikTok: soc.tiktok ?? '',
    'Meta Description': r.metaDescription ?? '',
    About: r.about ?? '',
    Amenities: amenities,
    'Photo Count': r.photoCount ?? '',
    'Is Claimed':
      r.isClaimed === null || r.isClaimed === undefined
        ? ''
        : String(r.isClaimed),
    'Scraped At': r.scrapedAt ?? '',
  };
}

function escapeCsvField(val) {
  const s = String(val ?? '');
  if (/[",\r\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

function recordsToCsvString(records) {
  const lines = [CSV_COLUMNS.join(',')];
  for (const r of records) {
    const o = recordToCsvObject(r);
    lines.push(CSV_COLUMNS.map((c) => escapeCsvField(o[c])).join(','));
  }
  return lines.join('\r\n');
}

function triggerDownload(filename, content, mime) {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function exportSessionToCSV(sessionId) {
  const s = getSession(sessionId);
  if (!s || !s.results?.length) return;
  const csv = recordsToCsvString(s.results);
  triggerDownload(`session-${sessionId}.csv`, csv, 'text/csv;charset=utf-8');
}

function exportAllToCSV() {
  const sessions = getAllSessions();
  const all = [];
  sessions.forEach((s) => {
    (s.results || []).forEach((r) => all.push(r));
  });
  if (!all.length) return;
  const csv = recordsToCsvString(all);
  triggerDownload('all-sessions-export.csv', csv, 'text/csv;charset=utf-8');
}

function exportSessionToJSON(sessionId) {
  const s = getSession(sessionId);
  if (!s) return;
  const json = JSON.stringify(s, null, 2);
  triggerDownload(`session-${sessionId}.json`, json, 'application/json');
}

// Expose for debugging in console
window.gmapsStore = {
  saveSession,
  getAllSessions,
  getSession,
  deleteSession,
  clearAllSessions,
  searchAllRecords,
  exportSessionToCSV,
  exportAllToCSV,
  exportSessionToJSON,
};

// --- UI state --------------------------------------------------------------

let currentJobId = null;
let currentResults = [];
let lastQuery = {};
let selectedSessionId = null;
/** Prevents overlapping scrapes if the form is submitted twice quickly. */
let scrapeInFlight = false;
/** Each job is auto-saved at most once when it finishes. */
const autoSavedJobIds = new Set();

function $(id) {
  return document.getElementById(id);
}

function setTab(name) {
  const scrapePanel = $('panel-scrape');
  const savedPanel = $('panel-saved');
  const btnScrape = $('tab-scrape');
  const btnSaved = $('tab-saved');
  const active =
    'rounded-t-lg px-4 py-2 text-sm font-medium text-teal-800 bg-teal-50 ring-1 ring-teal-200';
  const idle =
    'rounded-t-lg px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100';
  if (name === 'scrape') {
    scrapePanel.classList.remove('hidden');
    savedPanel.classList.add('hidden');
    btnScrape.className = `tab-btn ${active}`;
    btnSaved.className = `tab-btn ${idle}`;
  } else {
    scrapePanel.classList.add('hidden');
    savedPanel.classList.remove('hidden');
    btnSaved.className = `tab-btn ${active}`;
    btnScrape.className = `tab-btn ${idle}`;
    renderSavedTab();
  }
}

function updateProgress(scraped, total, label) {
  const pct = total > 0 ? Math.min(100, Math.round((scraped / total) * 100)) : 0;
  $('progress-fill').style.width = `${pct}%`;
  const counter = $('progress-counter');
  if (total > 0) {
    counter.textContent = `Scraped ${scraped} of ${total} results...`;
    if (label) counter.textContent += ` (${label})`;
  } else counter.textContent = '';
}

function setError(msg) {
  const el = $('error-line');
  if (!msg) {
    el.classList.add('hidden');
    el.textContent = '';
    return;
  }
  el.textContent = msg;
  el.classList.remove('hidden');
}

const PREVIEW_ROW_CAP = 400;

function renderPreview(rows) {
  const tb = $('preview-body');
  tb.innerHTML = '';
  const total = rows.length;
  const slice = total > PREVIEW_ROW_CAP ? rows.slice(0, PREVIEW_ROW_CAP) : rows;
  slice.forEach((r) => {
    const tr = document.createElement('tr');
    tr.className = 'border-t border-slate-100';
    const em = (r.emails || []).join('; ');
    const web = r.website || '';
    const webCell = web
      ? `<a href="${escapeAttr(web)}" class="text-teal-700 underline break-all" target="_blank" rel="noopener">${escapeHtml(web)}</a>`
      : '';
    tr.innerHTML = `
      <td class="px-2 py-2">${escapeHtml(r.businessName)}</td>
      <td class="px-2 py-2">${escapeHtml(r.phone)}</td>
      <td class="px-2 py-2 max-w-[140px] truncate" title="${escapeAttr(em)}">${escapeHtml(em)}</td>
      <td class="px-2 py-2 max-w-[180px] truncate align-top" title="${escapeAttr(web)}">${webCell}</td>
      <td class="px-2 py-2">${escapeHtml(r.city)}</td>
      <td class="px-2 py-2">${escapeHtml(r.zip)}</td>
      <td class="px-2 py-2">${r.rating ?? ''}</td>`;
    tb.appendChild(tr);
  });
  if (total > PREVIEW_ROW_CAP) {
    const tr = document.createElement('tr');
    tr.className = 'border-t border-slate-200 bg-slate-50';
    tr.innerHTML = `<td colspan="7" class="px-2 py-2 text-[11px] text-slate-600">Showing ${PREVIEW_ROW_CAP} of ${total} rows in the browser preview; export and API results include all records.</td>`;
    tb.appendChild(tr);
  }
}

function escapeHtml(s) {
  if (s == null) return '';
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function escapeAttr(s) {
  return escapeHtml(s).replace(/"/g, '&quot;');
}

/** GeoNames-derived postal lists (US + IN full codes; CA = FSA only). */
let postalBundleCache = null;
let postalBundlePromise = null;

async function getPostalBundle() {
  if (postalBundleCache) return postalBundleCache;
  if (!postalBundlePromise) {
    postalBundlePromise = fetch('/data/postal-by-region.json')
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error('postal json'))))
      .then((json) => {
        postalBundleCache = json;
        return json;
      })
      .catch(() => {
        postalBundlePromise = null;
        return null;
      });
  }
  return postalBundlePromise;
}

function setSelectOptionsFromZips(zipEl, zips, placeholder) {
  const parts = [`<option value="">${escapeHtml(placeholder)}</option>`];
  for (let i = 0; i < zips.length; i += 1) {
    const z = String(zips[i]);
    parts.push(
      `<option value="${escapeAttr(z)}">${escapeHtml(z)}</option>`
    );
  }
  zipEl.innerHTML = parts.join('');
}

function updateZipFieldHint(country) {
  const el = $('field-zip-hint');
  if (!el) return;
  if (country === 'Canada') {
    el.textContent =
      'Canada uses postal areas (FSA): the first 3 characters of the code. Full 6-character codes are not listed as separate rows (too many); Maps search still works well.';
  } else if (country === 'United States') {
    el.textContent =
      'ZIPs are the full set of unique codes for this state (GeoNames).';
  } else if (country === 'India') {
    el.textContent =
      'PINs are unique India Post codes for this state/UT (GeoNames).';
  } else {
    el.textContent = '';
  }
}

/**
 * Load ZIP / FSA / PIN list for the selected state from /data/postal-by-region.json
 * (fallback: short sample list from form-options.js if the file is missing).
 */
async function onStateChanged() {
  const cfg = getFormConfig();
  const country = $('field-country').value;
  const stateName = $('field-state').value;
  const zipEl = $('field-zip');

  updateZipFieldHint(country);

  if (!stateName) {
    setSelectOptions(zipEl, [], 'Select ZIP / postal code');
    return;
  }

  let placeholder = 'Select ZIP / postal code';
  let fallback = [];
  /** @type {'US'|'CA'|'IN'|null} */
  let bucket = null;

  if (country === 'United States' && cfg.usStates) {
    placeholder = 'Select ZIP code';
    const entry = Object.values(cfg.usStates).find((s) => s.name === stateName);
    fallback = (entry && entry.zips) || [];
    bucket = 'US';
  } else if (country === 'Canada' && cfg.canadaProvinces) {
    placeholder = 'Select postal area (FSA)';
    const entry = Object.values(cfg.canadaProvinces).find(
      (s) => s.name === stateName
    );
    fallback = (entry && entry.zips) || [];
    bucket = 'CA';
  } else if (country === 'India' && cfg.indiaStates) {
    placeholder = 'Select PIN code';
    const entry = Object.values(cfg.indiaStates).find(
      (s) => s.name === stateName
    );
    fallback = (entry && entry.zips) || [];
    bucket = 'IN';
  } else {
    return;
  }

  zipEl.disabled = true;
  zipEl.innerHTML = `<option value="">${escapeHtml('Loading postal codes…')}</option>`;

  try {
    const data = await getPostalBundle();
    let list =
      data && bucket && stateName && data[bucket] && data[bucket][stateName]
        ? data[bucket][stateName]
        : [];
    if (!list.length) list = fallback;
    setSelectOptionsFromZips(zipEl, list, placeholder);
    if (list.length) zipEl.selectedIndex = 1;
  } finally {
    zipEl.disabled = false;
  }
}

async function pollJob(jobId) {
  const statusLine = $('status-line');
  currentJobId = jobId;
  $('btn-start').disabled = true;
  $('btn-save-session').disabled = true;
  setError('');

  for (;;) {
    const res = await fetch(`/api/status/${jobId}`);
    if (!res.ok) {
      statusLine.textContent = 'Failed to read job status.';
      break;
    }
    const st = await res.json();
    updateProgress(st.scraped, st.total, st.currentBusiness || '');
    statusLine.textContent =
      st.status === 'running'
        ? 'Scraping…'
        : st.status === 'done'
          ? 'Completed.'
          : st.status === 'blocked'
            ? 'Stopped: blocked by Google (partial results may be available).'
            : st.status === 'failed'
              ? 'Failed.'
              : String(st.status);

    if (st.error) setError(st.error);

    if (st.status !== 'running') {
      const r2 = await fetch(`/api/results/${jobId}`);
      if (r2.ok) {
        currentResults = await r2.json();
        renderPreview(currentResults);
      }
      $('btn-start').disabled = false;
      $('btn-save-session').disabled = currentResults.length === 0;
      if (st.status === 'done' || st.status === 'blocked') {
        autoSaveSession(jobId);
      }
      break;
    }
    await new Promise((r) => setTimeout(r, 1200));
  }
}

function queryForStorage() {
  return {
    country: locStr(lastQuery.country),
    state: locStr(lastQuery.state),
    zip: locStr(lastQuery.zip),
    industry: locStr(lastQuery.industry),
  };
}

function locStr(v) {
  return v == null ? '' : String(v);
}

function autoSaveSession(jobId) {
  if (!currentResults.length || !jobId) return;
  if (autoSavedJobIds.has(jobId)) return;
  autoSavedJobIds.add(jobId);
  if (autoSavedJobIds.size > 500) {
    autoSavedJobIds.clear();
    autoSavedJobIds.add(jobId);
  }
  try {
    saveSession({ query: queryForStorage(), results: currentResults });
  } catch (e) {
    if (e && (e.name === 'QuotaExceededError' || e.code === 22)) {
      alert(
        'Browser storage is full. Export or clear old sessions, then use "Save to Local Storage".'
      );
    }
  }
}

function filterRecords(records, q) {
  const s = String(q || '').trim().toLowerCase();
  if (!s) return records;
  return records.filter((r) => {
    const hay = [
      r.businessName,
      r.category,
      r.phone,
      r.secondaryPhone,
      (r.emails || []).join(' '),
      r.website,
      r.zip,
      r.address,
      r.city,
      r.googleMapsUrl,
      r.about,
      r.metaDescription,
    ]
      .filter(Boolean)
      .join(' ')
      .toLowerCase();
    return hay.includes(s);
  });
}

function renderSavedTab() {
  const q = $('saved-search').value;
  const list = $('sessions-list');
  const empty = $('no-sessions');
  const sessions = getAllSessions();
  list.innerHTML = '';

  if (!sessions.length) {
    empty.classList.remove('hidden');
    updateExportSelectedState();
    return;
  }
  empty.classList.add('hidden');

  sessions.forEach((s) => {
    const filtered = filterRecords(s.results || [], q);
    if (q.trim() && filtered.length === 0) return;

    const card = document.createElement('div');
    card.className =
      'rounded-lg border border-slate-200 bg-slate-50/80 overflow-hidden';
    const isSel = selectedSessionId === s.sessionId;
    const queryBits = s.query || {};
    const summary = [
      queryBits.industry,
      queryBits.zip,
      queryBits.state,
      queryBits.country,
    ]
      .filter(Boolean)
      .join(' · ');

    card.innerHTML = `
      <div class="flex flex-wrap items-center gap-2 px-4 py-3 bg-white border-b border-slate-100">
        <input type="radio" name="session-pick" class="session-radio accent-teal-600" value="${s.sessionId}" ${
      isSel ? 'checked' : ''
    } />
        <div class="flex-1 min-w-[200px]">
          <div class="text-sm font-semibold text-slate-800">${escapeHtml(summary || 'Scrape')}</div>
          <div class="text-xs text-slate-500">${new Date(s.createdAt).toLocaleString()} · ${
      filtered.length
    } records</div>
        </div>
        <button type="button" class="expand-btn text-xs font-medium text-teal-700 hover:underline" data-id="${s.sessionId}">
          <span class="expand-label">Expand</span>
        </button>
        <button type="button" class="del-session text-xs font-semibold text-red-600 hover:underline" data-id="${s.sessionId}">
          Delete Session
        </button>
      </div>
      <div class="session-body px-2 sm:px-4" data-body="${s.sessionId}">
        <div class="table-wrap saved-expand-wrap max-h-[min(70vh,720px)] overflow-auto py-3">
          <table class="border-separate border-spacing-0 text-left text-[11px] text-slate-700 min-w-max w-full">
            <thead class="text-slate-600 tracking-tight">
              <tr>
                ${SAVED_EXPAND_COLUMNS.map((c) => savedExpandHeaderCell(c.label)).join('')}
              </tr>
            </thead>
            <tbody class="saved-rows-${s.sessionId}"></tbody>
          </table>
        </div>
      </div>`;

    list.appendChild(card);
    const tbody = card.querySelector(`.saved-rows-${s.sessionId}`);
    filtered.forEach((r) => {
      const tr = document.createElement('tr');
      tr.className = 'align-top hover:bg-slate-50/80';
      tr.innerHTML = SAVED_EXPAND_COLUMNS.map((col) =>
        savedExpandDataCell(r, col)
      ).join('');
      tbody.appendChild(tr);
    });

    const body = card.querySelector(`[data-body="${s.sessionId}"]`);
    const expandBtn = card.querySelector('.expand-btn');
    const expandLabel = card.querySelector('.expand-label');
    expandBtn.addEventListener('click', () => {
      body.classList.toggle('open');
      expandLabel.textContent = body.classList.contains('open')
        ? 'Collapse'
        : 'Expand';
    });

    card.querySelector('.del-session').addEventListener('click', () => {
      if (confirm('Delete this session from local storage?')) {
        deleteSession(s.sessionId);
        if (selectedSessionId === s.sessionId) selectedSessionId = null;
        renderSavedTab();
      }
    });

    card.querySelector('.session-radio').addEventListener('change', (e) => {
      selectedSessionId = e.target.value;
      updateExportSelectedState();
    });
  });

  updateExportSelectedState();
}

function updateExportSelectedState() {
  const hasSel = !!selectedSessionId && !!getSession(selectedSessionId);
  $('export-sel-csv').disabled = !hasSel;
  $('export-sel-json').disabled = !hasSel;
}

// --- Init ------------------------------------------------------------------

document.querySelectorAll('.tab-btn').forEach((btn) => {
  btn.addEventListener('click', () => setTab(btn.dataset.tab));
});

$('scrape-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  if (scrapeInFlight) return;
  scrapeInFlight = true;
  const fd = new FormData(e.target);
  const rawLimit =
    parseInt(String(fd.get('limit') || '10'), 10) || 10;
  const limitClamped = Math.min(10000, Math.max(1, rawLimit));

  lastQuery = {
    country: fd.get('country') || '',
    state: fd.get('state') || '',
    zip: fd.get('zip') || '',
    industry: fd.get('industry') || '',
    limit: String(limitClamped),
  };

  if (!lastQuery.country || !lastQuery.industry) {
    alert('Please choose a country and industry.');
    scrapeInFlight = false;
    return;
  }
  const cfg = getFormConfig();
  const needsLocation =
    lastQuery.country !== 'Other' &&
    (lastQuery.country === 'United States' ||
      lastQuery.country === 'Canada' ||
      lastQuery.country === 'India' ||
      (cfg.international && cfg.international[lastQuery.country]));
  if (needsLocation && (!lastQuery.state || !lastQuery.zip)) {
    alert('Please choose a state/region and ZIP or postal code.');
    scrapeInFlight = false;
    return;
  }

  setError('');
  $('status-line').textContent = 'Starting job…';
  updateProgress(0, limitClamped, '');

  try {
    const res = await fetch('/api/scrape', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        country: lastQuery.country,
        state: lastQuery.state,
        zip: lastQuery.zip,
        industry: lastQuery.industry,
        limit: limitClamped,
      }),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      $('status-line').textContent = 'Could not start scrape.';
      setError(err.error || res.statusText);
      $('btn-start').disabled = false;
      return;
    }
    const { jobId } = await res.json();
    await pollJob(jobId);
  } finally {
    scrapeInFlight = false;
  }
});

$('btn-save-session').addEventListener('click', () => {
  if (!currentResults.length) return;
  const beforeLen = getAllSessions().length;
  const id = saveSession({ query: queryForStorage(), results: currentResults });
  if (!id) return;
  if (getAllSessions().length === beforeLen) {
    alert(
      'This scrape is already saved (same query and data as the newest session).'
    );
  } else {
    alert('Session saved to localStorage.');
  }
  renderSavedTab();
});

$('saved-search').addEventListener('input', () => renderSavedTab());

$('export-sel-csv').addEventListener('click', () => {
  if (selectedSessionId) exportSessionToCSV(selectedSessionId);
});

$('export-sel-json').addEventListener('click', () => {
  if (selectedSessionId) exportSessionToJSON(selectedSessionId);
});

$('export-all-csv').addEventListener('click', () => exportAllToCSV());

$('btn-clear-all').addEventListener('click', () => {
  if (
    confirm(
      'Clear ALL saved sessions from this browser? This cannot be undone.'
    )
  ) {
    clearAllSessions();
    selectedSessionId = null;
    renderSavedTab();
  }
});

initFormDropdowns();
setTab('scrape');
renderPreview([]);
