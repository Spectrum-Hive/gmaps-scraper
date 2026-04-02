/**
 * Visit business website(s) to extract emails, social links, and meta description.
 * Enforces a hard timeout so slow sites do not block the job.
 */

const { URL } = require('url');

const EMAIL_REGEX = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;

const SOCIAL_PATTERNS = {
  facebook: [/facebook\.com/i, /fb\.com/i],
  instagram: [/instagram\.com/i],
  twitter: [/twitter\.com/i, /x\.com/i],
  linkedin: [/linkedin\.com/i],
  youtube: [/youtube\.com/i, /youtu\.be/i],
  tiktok: [/tiktok\.com/i],
};

/** Paths to try after homepage */
const EXTRA_PATHS = ['/contact', '/contact-us', '/about', '/about-us'];

/**
 * @param {string} baseUrl
 * @returns {string[]} full URLs to fetch
 */
function urlsToVisit(baseUrl) {
  let origin;
  try {
    const u = new URL(baseUrl);
    origin = `${u.protocol}//${u.host}`;
  } catch {
    return [];
  }
  const list = [baseUrl];
  for (const p of EXTRA_PATHS) {
    try {
      list.push(new URL(p, origin).href);
    } catch {
      /* skip */
    }
  }
  return list;
}

/**
 * Extract unique emails from HTML string (mailto + regex on text).
 * @param {string} html
 */
function extractEmailsFromHtml(html) {
  const found = new Set();
  if (!html) return [];

  const mailtoRe = /href\s*=\s*["']mailto:([^"']+)["']/gi;
  let m;
  while ((m = mailtoRe.exec(html)) !== null) {
    const addr = decodeURIComponent(m[1].split('?')[0]).trim();
    if (addr && !addr.startsWith('//')) found.add(addr);
  }

  let rm;
  const text = html.replace(/<script[\s\S]*?<\/script>/gi, ' ');
  while ((rm = EMAIL_REGEX.exec(text)) !== null) {
    const e = rm[0].replace(/[.,;)]+$/, '');
    if (e.length < 100) found.add(e);
  }

  return [...found];
}

/**
 * Classify href into social bucket; return { key, url } or null
 * @param {string} href
 */
function classifySocial(href) {
  if (!href || href.startsWith('mailto:')) return null;
  let normalized = href;
  try {
    normalized = new URL(href, 'https://example.com').href;
  } catch {
    return null;
  }
  for (const [key, patterns] of Object.entries(SOCIAL_PATTERNS)) {
    for (const pat of patterns) {
      if (pat.test(normalized)) return { key, url: normalized };
    }
  }
  return null;
}

/**
 * Parse social links and meta description from HTML
 * @param {string} html
 * @param {string} pageUrl
 */
function parsePageForSocialAndMeta(html, pageUrl) {
  const social = {
    facebook: null,
    instagram: null,
    twitter: null,
    linkedin: null,
    youtube: null,
    tiktok: null,
  };

  if (!html) {
    return { social, metaDescription: null };
  }

  const metaMatch = html.match(
    /<meta\s+name=["']description["']\s+content=["']([^"']*)["']/i
  );
  const metaOg = html.match(
    /<meta\s+property=["']og:description["']\s+content=["']([^"']*)["']/i
  );
  const metaDescription = metaMatch?.[1] || metaOg?.[1] || null;

  const anchorRe = /<a\s+[^>]*href\s*=\s*["']([^"']+)["'][^>]*>/gi;
  let am;
  while ((am = anchorRe.exec(html)) !== null) {
    const classified = classifySocial(am[1]);
    if (classified && !social[classified.key]) {
      social[classified.key] = classified.url;
    }
  }

  return { social, metaDescription };
}

/**
 * Merge social objects (first non-null wins per key)
 */
function mergeSocial(target, incoming) {
  for (const key of Object.keys(target)) {
    if (!target[key] && incoming[key]) target[key] = incoming[key];
  }
}

/**
 * Scrape website with global timeout (default 10s).
 * @param {import('playwright').BrowserContext} context
 * @param {string} websiteUrl
 * @param {number} [timeoutMs=10000]
 * @returns {Promise<{ emails: string[], socialLinks: object, metaDescription: string|null }>}
 */
async function scrapeWebsite(context, websiteUrl, timeoutMs = 10000) {
  const empty = {
    emails: [],
    socialLinks: {
      facebook: null,
      instagram: null,
      twitter: null,
      linkedin: null,
      youtube: null,
      tiktok: null,
    },
    metaDescription: null,
  };

  if (!websiteUrl || !/^https?:\/\//i.test(websiteUrl)) {
    return empty;
  }

  const run = async () => {
    const page = await context.newPage();
    const emails = new Set();
    const social = { ...empty.socialLinks };
    let metaDescription = null;

    try {
      const urls = urlsToVisit(websiteUrl);
      for (const url of urls) {
        try {
          const response = await page.goto(url, {
            waitUntil: 'domcontentloaded',
            timeout: 8000,
          });
          if (!response || response.status() >= 400) continue;
          const html = await page.content();
          extractEmailsFromHtml(html).forEach((e) => emails.add(e));
          const parsed = parsePageForSocialAndMeta(html, url);
          mergeSocial(social, parsed.social);
          if (!metaDescription && parsed.metaDescription) {
            metaDescription = parsed.metaDescription;
          }
        } catch {
          /* skip this URL */
        }
      }
    } finally {
      await page.close().catch(() => {});
    }

    return {
      emails: [...emails],
      socialLinks: social,
      metaDescription,
    };
  };

  return Promise.race([
    run(),
    new Promise((resolve) => {
      setTimeout(() => resolve(empty), timeoutMs);
    }),
  ]);
}

module.exports = {
  scrapeWebsite,
  extractEmailsFromHtml,
  urlsToVisit,
  EMAIL_REGEX,
};
