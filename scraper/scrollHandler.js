/**
 * Scroll the Google Maps results feed until we have enough listing anchors or hit end.
 */

const { randomDelay, sleep } = require('../utils/helpers');

/**
 * Collect unique place hrefs from the feed (limit collection).
 * @param {import('playwright').Page} page
 * @param {number} limit
 * @returns {Promise<string[]>}
 */
async function collectPlaceHrefs(page, limit) {
  const buffer = Math.min(80, Math.max(5, Math.ceil(limit / 200)));
  return page.evaluate((max) => {
    const feed = document.querySelector('div[role="feed"]');
    if (!feed) return [];
    const anchors = Array.from(feed.querySelectorAll('a[href*="/maps/place/"]'));
    const hrefs = [];
    const seen = new Set();
    for (const a of anchors) {
      const h = a.href.split('?')[0];
      if (h && !seen.has(h)) {
        seen.add(h);
        hrefs.push(a.href);
        if (hrefs.length >= max) break;
      }
    }
    return hrefs;
  }, limit + buffer);
}

/**
 * Scroll feed panel until desired count or no growth after attempts.
 * @param {import('playwright').Page} page
 * @param {number} limit - target number of listings
 * @param {object} [options]
 * @param {number} [options.maxNoGrowthRounds=8]
 */
async function scrollFeedUntilCount(page, limit, options = {}) {
  /** Large limits need many scroll cycles before the feed stops loading new cards. */
  const maxNoGrowthRounds =
    options.maxNoGrowthRounds ??
    Math.min(350, Math.max(10, Math.ceil(limit / 28)));
  const scrollStep = limit > 400 ? 2200 : limit > 120 ? 1600 : 1000;
  let noGrowth = 0;
  let lastCount = 0;

  while (noGrowth < maxNoGrowthRounds) {
    const feed = await page.$('div[role="feed"]');
    if (!feed) break;

    const count = await page.evaluate(() => {
      const f = document.querySelector('div[role="feed"]');
      if (!f) return 0;
      return new Set(
        Array.from(f.querySelectorAll('a[href*="/maps/place/"]')).map((a) =>
          a.href.split('?')[0]
        )
      ).size;
    });

    if (count >= limit) break;

    if (count <= lastCount) {
      noGrowth += 1;
    } else {
      noGrowth = 0;
      lastCount = count;
    }

    await feed.evaluate(
      (el, step) => {
        el.scrollBy(0, step);
      },
      scrollStep
    );
    const delayHi = limit > 500 ? 2800 : 2000;
    const delayLo = limit > 500 ? 1400 : 1000;
    await sleep(randomDelay(delayLo, delayHi));
  }
}

module.exports = {
  scrollFeedUntilCount,
  collectPlaceHrefs,
};
