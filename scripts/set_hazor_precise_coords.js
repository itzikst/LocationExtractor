import fs from 'fs';
import path from 'path';

const LAT = 33.016567;
const LON = 35.567483;
const LAT_STR = '33.016567';
const LON_STR = '35.567483';

console.log(`Setting Tel Hazor water installation coordinates to: ${LAT}, ${LON}`);

// 1. Update scripts/archaeological_gazetteer.js
const gazPath = './scripts/archaeological_gazetteer.js';
let gazContent = fs.readFileSync(gazPath, 'utf8');
gazContent = gazContent.replace(
  /'tel_hazor':\s*\{[\s\S]*?lat:\s*[0-9\.]+,\s*lon:\s*[0-9\.]+,/m,
  `'tel_hazor': {\n    name: 'Tel Hazor',\n    hebName: 'תל חצור',\n    lat: ${LAT},\n    lon: ${LON},`
);
fs.writeFileSync(gazPath, gazContent, 'utf8');
console.log('Updated scripts/archaeological_gazetteer.js');

// 2. Update data/locations_dissertation.json
const locsPath = './data/locations_dissertation.json';
const locs = JSON.parse(fs.readFileSync(locsPath, 'utf8'));
for (const l of locs) {
  if (
    l.location_name === 'תל חצור' ||
    l.location_name === 'מפעל המים של תל חצור' ||
    l.location_name === 'מפעל המים בתל חצור' ||
    l.location_name === 'מפעל מים בחצור' ||
    l.location_name === 'מנהרת המים בחצור' ||
    l.location_name === 'בור 6243 (חצור)' ||
    l.location_name === 'בור 9017 (חצור)' ||
    l.location_name === 'בור 9024 (חצור)' ||
    l.location_name === 'בור 9027 (חצור)' ||
    l.location_name === 'בור 7021 (חצור)' ||
    l.location_name === 'מאגר המים (תל חצור)'
  ) {
    l.latitude = LAT_STR;
    l.longitude = LON_STR;
  }
}
fs.writeFileSync(locsPath, JSON.stringify(locs, null, 2), 'utf8');
console.log('Updated data/locations_dissertation.json');

// 3. Update data/locations_dissertation.csv
function escapeCsv(val) {
  if (val === undefined || val === null) return '""';
  const str = String(val).replace(/"/g, '""');
  return `"${str}"`;
}
const headers = [
  'location_name',
  'english_name',
  'hebrew_aliases',
  'english_aliases',
  'site_type',
  'pages_mentioned',
  'first_page',
  'page_count',
  'iaa_survey_map',
  'iaa_site_id',
  'iaa_portal_url',
  'iaa_eng_portal_url',
  'latitude',
  'longitude'
];
const csvRows = [headers.join(',')];
for (const l of locs) {
  csvRows.push(headers.map(h => escapeCsv(l[h])).join(','));
}
fs.writeFileSync('./data/locations_dissertation.csv', csvRows.join('\n'), 'utf8');
console.log('Updated data/locations_dissertation.csv');

// 4. Update data/geocoded_locations.csv
const geocodedCsvPath = './data/geocoded_locations.csv';
let geocodedCsv = fs.readFileSync(geocodedCsvPath, 'utf8');
const oldCoordsRegex = /"33\.01685,\s*35\.56635"/g;
const oldMapUrlRegex = /https:\/\/www\.google\.com\/maps\?q=33\.01685,35\.56635&ll=33\.01685,35\.56635&z=17/g;
const newMapUrl = `https://www.google.com/maps?q=${LAT},${LON}&ll=${LAT},${LON}&z=17`;

geocodedCsv = geocodedCsv.replace(oldCoordsRegex, `"${LAT}, ${LON}"`);
geocodedCsv = geocodedCsv.replace(oldMapUrlRegex, newMapUrl);
fs.writeFileSync(geocodedCsvPath, geocodedCsv, 'utf8');
console.log('Updated data/geocoded_locations.csv');
