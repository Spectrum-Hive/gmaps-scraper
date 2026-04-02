/**
 * Builds public/data/postal-by-region.json from GeoNames postal files.
 * Run from repo root: node scripts/build-postal-data.mjs
 *
 * Prerequisites (place in project root):
 *   geonames-us/US.txt   from https://download.geonames.org/export/zip/US.zip
 *   geonames-ca/CA_full.txt from https://download.geonames.org/export/zip/CA_full.csv.zip
 *   geonames-in/IN.txt   from https://download.geonames.org/export/zip/IN.zip
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');

const CA_GEO_TO_FORM = {
  'Northwest Territory': 'Northwest Territories',
  'Nunavut Territory': 'Nunavut',
};

const IN_GEO_TO_FORM = {
  Chattisgarh: 'Chhattisgarh',
  Pondicherry: 'Puducherry',
};

function normInGeo(s) {
  return s.replace(/\s*&\s*/g, ' and ').trim();
}

function readLines(p) {
  if (!fs.existsSync(p)) {
    console.warn('Missing file:', p);
    return [];
  }
  return fs.readFileSync(p, 'utf8').split(/\r?\n/);
}

function buildUS() {
  const p = path.join(root, 'geonames-us', 'US.txt');
  const by = {};
  for (const line of readLines(p)) {
    if (!line) continue;
    const c = line.split('\t');
    const zip = c[1];
    const stateName = c[3];
    if (!zip || !stateName) continue;
    if (!by[stateName]) by[stateName] = new Set();
    by[stateName].add(zip);
  }
  const out = {};
  for (const [st, set] of Object.entries(by)) {
    out[st] = [...set].sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
  }
  return out;
}

/**
 * Canada: use 3-character FSA (forward sortation area) — unique full postcodes
 * per province are hundreds of thousands (browser-unfriendly in <select>).
 */
function buildCA() {
  const p = path.join(root, 'geonames-ca', 'CA_full.txt');
  const by = {};
  for (const line of readLines(p)) {
    if (!line) continue;
    const c = line.split('\t');
    const postal = c[1];
    let prov = c[3];
    if (!postal || !prov) continue;
    prov = CA_GEO_TO_FORM[prov] || prov;
    const compact = postal.replace(/\s/g, '');
    const fsa = compact.slice(0, 3).toUpperCase();
    if (fsa.length < 3) continue;
    if (!by[prov]) by[prov] = new Set();
    by[prov].add(fsa);
  }
  const out = {};
  for (const [st, set] of Object.entries(by)) {
    out[st] = [...set].sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
  }
  return out;
}

function buildIN() {
  const p = path.join(root, 'geonames-in', 'IN.txt');
  const by = {};
  for (const line of readLines(p)) {
    if (!line) continue;
    const c = line.split('\t');
    const pin = c[1];
    let region = c[3];
    if (!pin || !region) continue;
    region = normInGeo(region);
    region = IN_GEO_TO_FORM[region] || region;
    if (!by[region]) by[region] = new Set();
    by[region].add(pin);
  }
  /** Ladakh often missing from older GeoNames bundles */
  if (!by.Ladakh) by.Ladakh = new Set();
  for (const z of ['194101', '194102', '194103', '194104']) by.Ladakh.add(z);
  const out = {};
  for (const [st, set] of Object.entries(by)) {
    out[st] = [...set].sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
  }
  return out;
}

const US = buildUS();
const CA = buildCA();
const IN = buildIN();

const outDir = path.join(root, 'public', 'data');
fs.mkdirSync(outDir, { recursive: true });
const outPath = path.join(outDir, 'postal-by-region.json');
fs.writeFileSync(outPath, JSON.stringify({ US, CA, IN }));

const sizeKb = (fs.statSync(outPath).size / 1024).toFixed(1);
console.log('Wrote', outPath, `(${sizeKb} KB)`);
console.log('US states:', Object.keys(US).length, 'sample TX zips:', US.Texas?.length);
console.log('CA provinces:', Object.keys(CA).length, 'sample ON FSAs:', CA.Ontario?.length);
console.log('IN regions:', Object.keys(IN).length, 'sample UP PINs:', IN['Uttar Pradesh']?.length);
