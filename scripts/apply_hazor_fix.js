import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const HAZOR_LAT = '33.01764';
const HAZOR_LON = '35.56806';
const HAZOR_COORDS = `${HAZOR_LAT}, ${HAZOR_LON}`;
const HAZOR_MAP_URL = `https://www.google.com/maps?q=${HAZOR_LAT},${HAZOR_LON}&ll=${HAZOR_LAT},${HAZOR_LON}&z=17`;

// 1. Update data/locations_dissertation.json
const jsonPath = 'data/locations_dissertation.json';
const locs = JSON.parse(readFileSync(jsonPath, 'utf-8'));
let updatedJsonCount = 0;
locs.forEach(loc => {
  if (loc.location_name === 'תל חצור' || (loc.english_name && loc.english_name.toLowerCase() === 'hazor')) {
    loc.latitude = HAZOR_LAT;
    loc.longitude = HAZOR_LON;
    updatedJsonCount++;
  }
});
writeFileSync(jsonPath, JSON.stringify(locs, null, 2), 'utf-8');
console.log(`Updated ${updatedJsonCount} entries in ${jsonPath}`);

// 2. Update data/locations_dissertation.csv
const csvPath = 'data/locations_dissertation.csv';
const csvLines = readFileSync(csvPath, 'utf-8').split('\n');
const newCsvLines = csvLines.map(line => {
  if (line.startsWith('"תל חצור"') || line.includes('"Hazor"')) {
    // Replace old lat/lon
    return line.replace(/"33\.01843","35\.56828"/, `"${HAZOR_LAT}","${HAZOR_LON}"`)
               .replace(/,"33\.01843",/g, `,"${HAZOR_LAT}",`)
               .replace(/,"35\.56828"/g, `,"${HAZOR_LON}"`);
  }
  return line;
});
writeFileSync(csvPath, newCsvLines.join('\n'), 'utf-8');
console.log(`Updated ${csvPath}`);

// 3. Update data/geocoded_locations.csv
const geocodedPath = 'data/geocoded_locations.csv';
const geoLines = readFileSync(geocodedPath, 'utf-8').split('\n');
const newGeoLines = geoLines.map(line => {
  if (line.includes('חצור') && (line.includes('33.01843') || line.includes('33.01750'))) {
    // Replace coordinates and map url
    return line.replace(/33\.(01843|01750),\s*35\.(56828|56833)/g, HAZOR_COORDS)
               .replace(/https:\/\/www\.google\.com\/maps\?q=[0-9\.,]+&ll=[0-9\.,]+&z=17/g, HAZOR_MAP_URL);
  }
  return line;
});
writeFileSync(geocodedPath, newGeoLines.join('\n'), 'utf-8');
console.log(`Updated ${geocodedPath}`);
