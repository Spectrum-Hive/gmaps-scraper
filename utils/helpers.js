/**
 * Shared helpers: delays, user agents, query building, job state updates.
 */

/** @returns {number} Random integer in [min, max] inclusive */
function randomDelay(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

/** Sleep for ms milliseconds */
function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Realistic desktop Chrome user agents for Playwright */
const USER_AGENTS = [
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:121.0) Gecko/20100101 Firefox/121.0',
];

function pickUserAgent() {
  return USER_AGENTS[Math.floor(Math.random() * USER_AGENTS.length)];
}

/**
 * Build search query string from form fields (country, state, zip, industry).
 */
function buildSearchQuery({ country, state, zip, industry }) {
  const parts = [industry, zip, state, country].filter(
    (p) => p && String(p).trim().length > 0
  );
  return parts.join(' ');
}

/**
 * Normalize job status payload for GET /api/status
 * status may be: running | done | failed | blocked
 */
function statusPayload(job) {
  return {
    status: job.status,
    scraped: job.scraped,
    total: job.total,
    currentBusiness: job.currentBusiness || null,
    error: job.error || null,
  };
}

module.exports = {
  randomDelay,
  sleep,
  pickUserAgent,
  USER_AGENTS,
  buildSearchQuery,
  statusPayload,
};
