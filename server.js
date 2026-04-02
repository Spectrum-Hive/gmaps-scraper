/**
 * Express server: static frontend + /api/scrape/* Playwright-backed endpoints.
 */

require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const scrapeRoutes = require('./routes/scrapeRoutes');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
/** Large scrape jobs return big JSON from GET /api/results — allow a generous cap. */
app.use(express.json({ limit: '50mb' }));
app.use(express.static(path.join(__dirname, 'public')));

app.use('/api', scrapeRoutes);

/** SPA fallback — serve index.html for non-API routes */
app.get('*', (req, res, next) => {
  if (req.path.startsWith('/api')) return next();
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`GMaps scraper server listening on http://localhost:${PORT}`);
});
