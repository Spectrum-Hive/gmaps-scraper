/**
 * Extract structured fields from the Google Maps place detail side panel.
 * Uses multiple selector fallbacks because Google changes class names periodically.
 */

const { URL } = require('url');

/**
 * Turn Maps redirect links (google.com/url?q=…) into the real website URL; trim UTM noise lightly.
 * @param {string|null} href
 * @returns {string|null}
 */
function normalizeWebsiteUrl(href) {
  if (!href || typeof href !== 'string') return null;
  let u = href.trim();
  try {
    const parsed = new URL(u);
    const host = parsed.hostname.toLowerCase();
    if (
      (host === 'www.google.com' || host === 'google.com') &&
      (parsed.pathname === '/url' || parsed.pathname.startsWith('/url'))
    ) {
      const inner = parsed.searchParams.get('q') || parsed.searchParams.get('url');
      if (inner) u = decodeURIComponent(inner);
    }
  } catch {
    return null;
  }
  try {
    const final = new URL(u);
    if (!/^https?:$/i.test(final.protocol)) return null;
    if (/support\.google\.com|business\.google\.com/i.test(final.hostname)) return null;
    ['utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term'].forEach(
      (k) => final.searchParams.delete(k)
    );
    return final.href;
  } catch {
    return null;
  }
}

/**
 * Parse US-style address parts (best effort).
 * @param {string} full
 * @param {string|null} countryHint
 */
function parseAddressParts(full, countryHint) {
  if (!full || typeof full !== 'string') {
    return {
      address: full || null,
      zip: null,
      city: null,
      state: null,
      country: countryHint || null,
    };
  }

  let zip = null;
  const zipMatch = full.match(/\b(\d{5})(?:-\d{4})?\b/);
  if (zipMatch) zip = zipMatch[1];

  const usTail = full.match(
    /,\s*([^,]+),\s*([A-Z]{2})\s+(\d{5}(?:-\d{4})?)(?:,\s*([^,]+))?\s*$/i
  );
  if (usTail) {
    return {
      address: full,
      zip: usTail[3] || zip,
      city: usTail[1].trim(),
      state: usTail[2].trim(),
      country: usTail[4]?.trim() || countryHint || 'US',
    };
  }

  const parts = full.split(',').map((s) => s.trim()).filter(Boolean);
  const country =
    parts.length > 0 ? parts[parts.length - 1] : countryHint || null;
  const state = parts.length > 2 ? parts[parts.length - 2] : null;
  const city = parts.length > 3 ? parts[parts.length - 3] : parts[0] || null;

  return {
    address: full,
    zip,
    city,
    state,
    country: countryHint || country,
  };
}

/**
 * Run inside page: scrape visible detail panel into a plain object.
 * This function is stringified for evaluate — keep it self-contained.
 */
function scrapePanelInPage() {
  const nullSafe = (v) => (v === undefined || v === '' ? null : v);

  const textOf = (sel) => {
    const el = document.querySelector(sel);
    return el ? el.textContent.trim() : null;
  };

  /** Business name */
  let businessName = null;
  const nameEl =
    document.querySelector('h1.DUwDvf') ||
    document.querySelector('h1.fontHeadlineSmall') ||
    document.querySelector('[data-entity-overview] h1') ||
    document.querySelector('div[role="main"] h1');
  if (nameEl) businessName = nameEl.textContent.trim();

  /** Category / type — often button or span under title */
  let category = null;
  const catBtn = document.querySelector('button.DkEaL');
  if (catBtn) category = catBtn.textContent.trim();
  if (!category) {
    const alt = document.querySelector(
      'div.fontBodyMedium span, div.JapzE span, .aSftqf'
    );
    if (alt) category = alt.textContent.trim();
  }

  /** Full address from data-item-id="address" block */
  let addressBlock = null;
  const addrButton = document.querySelector('button[data-item-id="address"]');
  if (addrButton) {
    const addrText =
      addrButton.querySelector('.Io6YTe') || addrButton.querySelector('span');
    if (addrText) addressBlock = addrText.textContent.replace(/\n/g, ' ').trim();
  }
  if (!addressBlock) {
    const addrDiv = document.querySelector('[data-tooltip="Copy address"]');
    if (addrDiv) addressBlock = addrDiv.textContent.replace(/\n/g, ' ').trim();
  }

  /** Phones */
  const phones = [];
  document.querySelectorAll('button[data-item-id^="phone"]').forEach((btn) => {
    const t =
      btn.querySelector('.Io6YTe')?.textContent ||
      btn.getAttribute('aria-label') ||
      '';
    const digits = t.replace(/[^\d+()\s.-]/g, '').trim();
    if (digits && digits.length >= 7) phones.push(t.replace(/\n/g, ' ').trim());
  });
  if (phones.length === 0) {
    document.querySelectorAll('a[href^="tel:"]').forEach((a) => {
      const raw = decodeURIComponent(a.href.replace(/^tel:/i, '')).split('?')[0];
      if (raw) phones.push(raw);
    });
  }
  const phone = phones[0] ? phones[0] : null;
  const secondaryPhone = phones[1] ? phones[1] : null;

  /** Website — Maps links are often google.com/url?q=…; unwrap in normalizeWebsiteUrl (Node). */
  function unwrapHref(href) {
    if (!href) return null;
    try {
      const u = new URL(href);
      const h = u.hostname.toLowerCase();
      if (
        (h === 'www.google.com' || h === 'google.com') &&
        (u.pathname === '/url' || u.pathname.startsWith('/url'))
      ) {
        const q = u.searchParams.get('q') || u.searchParams.get('url');
        if (q) return decodeURIComponent(q);
      }
    } catch (e) {
      /* ignore */
    }
    return href;
  }

  function externalBusinessUrl(href) {
    const raw = unwrapHref(href);
    if (!raw || !raw.startsWith('http')) return null;
    const bad =
      /google\.com\/maps|maps\.google\.|support\.google\.com|business\.google\.com|gstatic\.com|googleusercontent\.com|schema\.org|\/search\?/i.test(
        raw
      );
    if (bad) return null;
    return raw;
  }

  let website = null;
  const main = document.querySelector('div[role="main"]') || document.body;

  const webAuthority = document.querySelector('a[data-item-id="authority"]');
  if (webAuthority && webAuthority.href) {
    website = externalBusinessUrl(webAuthority.href);
  }

  if (!website) {
    const wa = document.querySelector('a[href*="http"][data-tooltip*="website" i]');
    if (wa && wa.href) website = externalBusinessUrl(wa.href);
  }

  if (!website) {
    main.querySelectorAll('a[href^="http"], a[href*="/url?q="]').forEach((a) => {
      if (website) return;
      const h = unwrapHref(a.href);
      const label = (a.getAttribute('aria-label') || a.textContent || '').toLowerCase();
      if (
        label.includes('website') ||
        label.includes('web site') ||
        label.includes('visit site') ||
        label.includes('open website') ||
        (label.includes('visit') && !label.includes('direction'))
      ) {
        website = externalBusinessUrl(h);
      }
    });
  }

  /** Fallback: first external link in the overview that looks like a business site */
  if (!website) {
    main.querySelectorAll('a[href^="http"], a[href*="google.com/url"]').forEach((a) => {
      if (website) return;
      const cand = externalBusinessUrl(a.href);
      if (!cand) return;
      const label = (a.getAttribute('aria-label') || '').toLowerCase();
      if (label.includes('menu') || label.includes('order') || label.includes('reservation'))
        return;
      if (/instagram\.com|facebook\.com|twitter\.com|tiktok\.com|youtube\.com/i.test(cand))
        return;
      website = cand;
    });
  }

  /** Email on Maps (rare) */
  let mapsEmails = [];
  document.querySelectorAll('a[href^="mailto:"]').forEach((a) => {
    const e = decodeURIComponent(a.href.replace(/^mailto:/i, '').split('?')[0]);
    if (e) mapsEmails.push(e);
  });
  mapsEmails = [...new Set(mapsEmails)];

  /** Rating */
  let rating = null;
  const ratingEl = document.querySelector(
    'div.F7nice span, span[aria-hidden="true"].MW4etd, div.fontDisplayLarge'
  );
  if (ratingEl) {
    const num = parseFloat(ratingEl.textContent.replace(',', '.').trim());
    if (!Number.isNaN(num)) rating = num;
  }
  const ratingSpan = document.querySelector('span[aria-label*="stars"]');
  if (!rating && ratingSpan) {
    const m = ratingSpan.getAttribute('aria-label')?.match(/([\d.,]+)\s*star/i);
    if (m) {
      const num = parseFloat(m[1].replace(',', '.'));
      if (!Number.isNaN(num)) rating = num;
    }
  }

  /** Review count */
  let reviewCount = null;
  const revBtn = document.querySelector('button[jsaction*="reviews"]');
  const revText =
    revBtn?.textContent ||
    document.querySelector('span[aria-label*="reviews"]')?.getAttribute('aria-label');
  if (revText) {
    const m = revText.replace(/,/g, '').match(/(\d[\d\s]*)/);
    if (m) reviewCount = parseInt(m[1].replace(/\s/g, ''), 10);
  }
  if (reviewCount === null) {
    const spans = document.querySelectorAll('span');
    for (const s of spans) {
      const t = s.textContent || '';
      if (/^\([\d,\s]+\)$/.test(t.trim())) {
        reviewCount = parseInt(t.replace(/[^\d]/g, ''), 10);
        break;
      }
    }
  }

  /** Price range e.g. $$ */
  let priceRange = null;
  document.querySelectorAll('span[aria-label], div[aria-label]').forEach((el) => {
    const al = el.getAttribute('aria-label') || '';
    if (/^\$\$*\.?$/.test(el.textContent.trim())) priceRange = el.textContent.trim();
    if (al.toLowerCase().includes('price')) {
      const m = al.match(/(\$+)/);
      if (m) priceRange = m[1];
    }
  });
  if (!priceRange) {
    const money = document.querySelector('.mgr77e, .tAiQdd span');
    if (money && /^\$+$/.test(money.textContent.trim())) {
      priceRange = money.textContent.trim();
    }
  }

  /** Open / closed */
  let isOpen = null;
  const hoursEl = document.querySelector('[data-item-id="oh"]');
  const statusText =
    hoursEl?.textContent ||
    document.querySelector('.ZDu2Lc')?.textContent ||
    '';
  if (/open/i.test(statusText) && !/closed/i.test(statusText)) isOpen = true;
  else if (/closed/i.test(statusText)) isOpen = false;

  /** Business hours */
  const businessHours = {};
  const rows = document.querySelectorAll('tr.y0skZc, table.WgFkxc tr');
  rows.forEach((tr) => {
    const day = tr.querySelector('td.ylH6lf, td:first-child');
    const time = tr.querySelector('td.mxowUb, td:last-child');
    if (day && time) {
      const d = day.textContent.trim();
      const t = time.textContent.replace(/\n/g, ' ').trim();
      if (d && t) businessHours[d] = t;
    }
  });
  const table = document.querySelector('div[aria-label*="Hours"] table');
  if (table && Object.keys(businessHours).length === 0) {
    table.querySelectorAll('tr').forEach((tr) => {
      const cells = tr.querySelectorAll('td');
      if (cells.length >= 2) {
        businessHours[cells[0].textContent.trim()] = cells[1].textContent
          .replace(/\n/g, ' ')
          .trim();
      }
    });
  }

  /** Maps URL */
  const canon = document.querySelector('link[rel="canonical"]');
  let googleMapsUrl = canon?.href || window.location.href;

  /** Plus code */
  let plusCode = null;
  document.querySelectorAll('button[data-item-id="oloc"], .Io6YTe').forEach((el) => {
    const tx = el.textContent || '';
    if (/^[23456789CFGHJMPQRVWX+]{4,}/i.test(tx.trim()) && tx.includes('+')) {
      plusCode = tx.trim();
    }
  });

  /** About */
  let about = null;
  const aboutSection = document.querySelector('[data-section-id="summary"]');
  if (aboutSection) about = aboutSection.textContent.replace(/\s+/g, ' ').trim();

  /** Amenities */
  const amenities = [];
  document.querySelectorAll('li.hpMY2, div[aria-label*="Accessibility"]').forEach((el) => {
    const t = el.textContent?.trim();
    if (t && t.length < 120) amenities.push(t);
  });
  document.querySelectorAll('ul.NV0Qu li, div.Io6YTe.fontBodyMedium').forEach((el) => {
    const t = el.textContent?.trim();
    if (
      t &&
      t.length < 100 &&
      !amenities.includes(t) &&
      /wheelchair|wi-?fi|parking|accessible|restroom/i.test(t)
    ) {
      amenities.push(t);
    }
  });

  /** Photo count */
  let photoCount = null;
  const ph = document.querySelector('button[jsaction*="pane.heroImage"]');
  const phLabel = ph?.getAttribute('aria-label') || '';
  const pm = phLabel.match(/(\d+)\s*photo/i);
  if (pm) photoCount = parseInt(pm[1], 10);

  /** Claimed listing heuristic */
  let isClaimed = null;
  const claim = document.querySelector('a[href*="claim"]');
  if (claim) isClaimed = false;
  const own = document.querySelector('[data-item-id="merchant"]');
  if (own || document.body.innerText.includes('Own this business')) {
    isClaimed = false;
  }
  if (document.querySelector('[data-value="Claim this business"]')) isClaimed = false;
  if (isClaimed === null && document.querySelector('button[data-item-id="edit"]')) {
    isClaimed = true;
  }

  return {
    businessName: nullSafe(businessName),
    category: nullSafe(category),
    addressFull: nullSafe(addressBlock),
    phone: nullSafe(phone),
    secondaryPhone: nullSafe(secondaryPhone),
    mapsEmails,
    website: nullSafe(website),
    rating,
    reviewCount: Number.isFinite(reviewCount) ? reviewCount : null,
    priceRange: nullSafe(priceRange),
    isOpen,
    businessHours: Object.keys(businessHours).length ? businessHours : null,
    googleMapsUrl: nullSafe(googleMapsUrl),
    plusCode: nullSafe(plusCode),
    about: nullSafe(about),
    amenities: amenities.length ? [...new Set(amenities)] : null,
    photoCount,
    isClaimed,
  };
}

/**
 * @param {import('playwright').Page} page
 * @param {{ country?: string, state?: string, zip?: string }} locationHints
 * @returns {Promise<object>}
 */
async function extractDetailPanel(page, locationHints = {}) {
  const raw = await page.evaluate(scrapePanelInPage);
  const parsed = parseAddressParts(
    raw.addressFull,
    locationHints.country || null
  );

  /** Prefer parsed zip from address if we have hints */
  const zip = parsed.zip || locationHints.zip || null;
  const state = parsed.state || locationHints.state || null;
  const country = parsed.country || locationHints.country || null;
  const city = parsed.city;

  return {
    businessName: raw.businessName,
    category: raw.category,
    address: parsed.address || raw.addressFull,
    city,
    state,
    zip,
    country,
    phone: raw.phone,
    secondaryPhone: raw.secondaryPhone,
    emailsFromMaps: raw.mapsEmails || [],
    website: normalizeWebsiteUrl(raw.website),
    rating: raw.rating,
    reviewCount: raw.reviewCount,
    priceRange: raw.priceRange,
    isOpen: raw.isOpen,
    businessHours: raw.businessHours,
    googleMapsUrl: raw.googleMapsUrl,
    plusCode: raw.plusCode,
    about: raw.about,
    amenities: raw.amenities,
    photoCount: raw.photoCount,
    isClaimed: raw.isClaimed,
  };
}

module.exports = {
  extractDetailPanel,
  parseAddressParts,
  scrapePanelInPage,
  normalizeWebsiteUrl,
};
