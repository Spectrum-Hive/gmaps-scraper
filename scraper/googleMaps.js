/**
 * Main Google Maps scraping orchestration: browser launch, search, scroll,
 * per-listing detail extraction, optional website scrape, CAPTCHA handling.
 */

const { chromium } = require('playwright');
const {
  randomDelay,
  sleep,
  pickUserAgent,
  buildSearchQuery,
} = require('../utils/helpers');
const { scrollFeedUntilCount, collectPlaceHrefs } = require('./scrollHandler');
const { extractDetailPanel } = require('./detailExtractor');
const { scrapeWebsite } = require('./websiteScraper');

/**
 * Detect Google interstitial / CAPTCHA pages.
 * @param {import('playwright').Page} page
 */
async function isBlocked(page) {
  const url = page.url();
  if (url.includes('/sorry/') || url.includes('/interstitial')) return true;
  const content = await page
    .content()
    .catch(() => '');
  if (
    /unusual traffic/i.test(content) ||
    /captcha/i.test(content) ||
    /verify you're not a robot/i.test(content)
  ) {
    return true;
  }
  return false;
}

/**
 * Dismiss cookie / "Before you continue" dialogs when possible.
 * @param {import('playwright').Page} page
 */
async function dismissOverlays(page) {
  /** Try common consent buttons (Playwright text/role selectors, not CSS-only). */
  const attempts = [
    () => page.getByRole('button', { name: /accept all/i }).first().click({ timeout: 2500 }),
    () => page.getByRole('button', { name: /^I agree$/i }).first().click({ timeout: 2000 }),
    () => page.locator('[aria-label="Accept all"]').first().click({ timeout: 2000 }),
    () => page.locator('form[action*="consent"] button[type="submit"]').first().click({ timeout: 2000 }),
  ];
  for (const fn of attempts) {
    try {
      await fn();
      await sleep(600);
    } catch {
      /* ignore */
    }
  }
}

/**
 * Run the full scrape; mutates `job` (results, status, scraped, currentBusiness).
 * @param {object} job - { results: [], status, scraped, total, currentBusiness, error }
 * @param {object} params - { country, state, zip, industry, limit }
 */
async function runGoogleMapsScrape(job, params) {
  const { country, state, zip, industry, limit } = params;
  const searchQuery = buildSearchQuery({ country, state, zip, industry });
  job.total = limit;
  job.scraped = 0;
  job.results = [];
  job.currentBusiness = null;
  job.error = null;

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1366, height: 768 },
    locale: 'en-US',
    userAgent: pickUserAgent(),
  });

  await context.setExtraHTTPHeaders({
    'Accept-Language': 'en-US,en;q=0.9',
  });

  const page = await context.newPage();

  try {
    const mapsUrl = `https://www.google.com/maps/search/${encodeURIComponent(
      searchQuery
    )}`;

    await page.goto(mapsUrl, { waitUntil: 'domcontentloaded', timeout: 60000 });
    await dismissOverlays(page);

    if (await isBlocked(page)) {
      job.status = 'blocked';
      job.error = 'Google blocked the request (CAPTCHA or unusual traffic).';
      return;
    }

    /** Wait for results feed or detect empty state */
    try {
      await page.waitForSelector('div[role="feed"]', { timeout: 45000 });
    } catch {
      job.status = 'failed';
      job.error = 'No results found for this query';
      return;
    }

    await sleep(randomDelay(1500, 2500));
    await dismissOverlays(page);

    /** Scroll until we have enough listing links */
    await scrollFeedUntilCount(page, limit);

    let hrefs = await collectPlaceHrefs(page, limit);
    /** De-duplicate and cap */
    const seen = new Set();
    hrefs = hrefs.filter((h) => {
      const k = h.split('?')[0];
      if (seen.has(k)) return false;
      seen.add(k);
      return true;
    }).slice(0, limit);

    if (hrefs.length === 0) {
      job.status = 'failed';
      job.error = 'No results found for this query';
      return;
    }

    const locationHints = { country, state, zip };

    for (let i = 0; i < hrefs.length && job.results.length < limit; i += 1) {
      if (job.status === 'cancelled') break;

      const href = hrefs[i];
      try {
        await page.goto(href, {
          waitUntil: 'domcontentloaded',
          timeout: 45000,
        });
        await sleep(randomDelay(800, 1500));

        if (await isBlocked(page)) {
          job.status = 'blocked';
          job.error = 'Blocked mid-scrape (CAPTCHA). Partial results returned.';
          break;
        }

        await dismissOverlays(page);

        /** Wait for title / panel */
        try {
          await page.waitForSelector('div[role="main"] h1', { timeout: 15000 });
        } catch {
          /* skip this listing */
          continue;
        }

        const detail = await extractDetailPanel(page, locationHints);

        job.currentBusiness = detail.businessName || href;

        /** Merge emails: Maps first, then website */
        const emailsSet = new Set(detail.emailsFromMaps || []);
        let socialLinks = {
          facebook: null,
          instagram: null,
          twitter: null,
          linkedin: null,
          youtube: null,
          tiktok: null,
        };
        let metaDescription = null;

        if (detail.website) {
          const webData = await scrapeWebsite(context, detail.website, 10000);
          webData.emails.forEach((e) => emailsSet.add(e));
          socialLinks = { ...socialLinks, ...webData.socialLinks };
          metaDescription = webData.metaDescription;
        }

        const record = {
          businessName: detail.businessName,
          category: detail.category,
          address: detail.address,
          city: detail.city,
          state: detail.state,
          zip: detail.zip,
          country: detail.country,
          phone: detail.phone,
          secondaryPhone: detail.secondaryPhone,
          emails: [...emailsSet],
          website: detail.website,
          rating: detail.rating,
          reviewCount: detail.reviewCount,
          priceRange: detail.priceRange,
          isOpen: detail.isOpen,
          businessHours: detail.businessHours,
          googleMapsUrl: detail.googleMapsUrl || href,
          plusCode: detail.plusCode,
          about: detail.about,
          amenities: detail.amenities,
          photoCount: detail.photoCount,
          isClaimed: detail.isClaimed,
          socialLinks,
          metaDescription,
          scrapedAt: new Date().toISOString(),
        };

        job.results.push(record);
        job.scraped = job.results.length;
      } catch (err) {
        /** Missing field → null already; skip bad listing */
        console.error('Listing scrape error:', err.message);
      }

      await sleep(randomDelay(1500, 3000));
    }

    if (job.status !== 'blocked' && job.status !== 'failed') {
      job.status = 'done';
    }
  } catch (err) {
    job.status = 'failed';
    job.error = err.message || String(err);
  } finally {
    job.currentBusiness = null;
    await browser.close().catch(() => {});
  }
}

module.exports = {
  runGoogleMapsScrape,
  isBlocked,
  dismissOverlays,
};
