/**
 * Express routes for scrape jobs: start, poll status, fetch results, CSV export.
 * Jobs are stored in-memory in a Map keyed by jobId.
 */

const express = require('express');
const { v4: uuidv4 } = require('uuid');
const { Parser } = require('json2csv');
const { statusPayload } = require('../utils/helpers');
const { runGoogleMapsScrape } = require('../scraper/googleMaps');

/** @type {Map<string, object>} */
const jobs = new Map();

/**
 * Flatten one business record to CSV row object (exact column order for spec).
 * @param {object} r
 */
function recordToCsvRow(r) {
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

const CSV_FIELDS = [
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

function resultsToCsv(results) {
  const rows = (results || []).map(recordToCsvRow);
  const parser = new Parser({ fields: CSV_FIELDS });
  return parser.parse(rows);
}

const router = express.Router();

/** Maps UI may not expose 10k distinct pins; we still allow requesting up to this many. */
const MAX_RESULTS = 10000;

/**
 * POST /api/scrape — body: { country, state, zip, industry, limit }
 */
router.post('/scrape', express.json(), (req, res) => {
  const { country, state, zip, industry, limit: limitRaw } = req.body || {};

  if (!industry || String(industry).trim() === '') {
    return res.status(400).json({ error: 'industry is required' });
  }

  const limit = Math.min(
    MAX_RESULTS,
    Math.max(1, parseInt(String(limitRaw || 10), 10) || 10)
  );

  const jobId = uuidv4();
  const job = {
    id: jobId,
    status: 'running',
    scraped: 0,
    total: limit,
    currentBusiness: null,
    results: [],
    error: null,
    params: { country, state, zip, industry, limit },
    createdAt: new Date().toISOString(),
  };

  jobs.set(jobId, job);

  /** Fire-and-forget scrape */
  runGoogleMapsScrape(job, {
    country: country || '',
    state: state || '',
    zip: zip || '',
    industry: String(industry).trim(),
    limit,
  }).catch((err) => {
    job.status = 'failed';
    job.error = err.message || String(err);
  });

  return res.json({ jobId });
});

/**
 * GET /api/status/:jobId
 */
router.get('/status/:jobId', (req, res) => {
  const job = jobs.get(req.params.jobId);
  if (!job) {
    return res.status(404).json({ error: 'Job not found' });
  }
  return res.json(statusPayload(job));
});

/**
 * GET /api/results/:jobId
 */
router.get('/results/:jobId', (req, res) => {
  const job = jobs.get(req.params.jobId);
  if (!job) {
    return res.status(404).json({ error: 'Job not found' });
  }
  return res.json(job.results || []);
});

/**
 * GET /api/export/csv/:jobId — download CSV for one job's results
 */
router.get('/export/csv/:jobId', (req, res) => {
  const job = jobs.get(req.params.jobId);
  if (!job) {
    return res.status(404).json({ error: 'Job not found' });
  }
  try {
    const csv = resultsToCsv(job.results);
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="scrape-${req.params.jobId}.csv"`
    );
    return res.send(csv);
  } catch (e) {
    return res.status(500).json({ error: e.message || 'CSV export failed' });
  }
});

module.exports = router;
module.exports.jobs = jobs;
module.exports.resultsToCsv = resultsToCsv;
module.exports.recordToCsvRow = recordToCsvRow;
