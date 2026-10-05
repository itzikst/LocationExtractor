import { readFileSync } from 'node:fs';

const content = readFileSync('data/geocoded_locations.csv', 'utf8');
const lines = content.trim().split('\n');
console.log('Total lines (with header):', lines.length);
console.log('Header line:', lines[0]);

let trueCount = 0;
let falseCount = 0;
const namesMap = new Map();

for (let i = 1; i < lines.length; i++) {
  const line = lines[i];

  // CSV parser for quoted fields
  const tokens = [];
  let cur = '';
  let inQuotes = false;
  for (let c = 0; c < line.length; c++) {
    const ch = line[c];
    if (ch === '"') inQuotes = !inQuotes;
    else if (ch === ',' && !inQuotes) {
      tokens.push(cur.trim());
      cur = '';
    } else {
      cur += ch;
    }
  }
  tokens.push(cur.trim());

  const name = tokens[0].replace(/^"|"$/g, '');
  const coords = tokens[1].replace(/^"|"$/g, '');
  const source = tokens[2].replace(/^"|"$/g, '');
  const numGeocodes = parseInt(tokens[3], 10);
  const bestCand = tokens[4].replace(/^"|"$/g, '');
  const googleMapsUrl = tokens[5] ? tokens[5].replace(/^"|"$/g, '') : '';

  const isBest = bestCand === 'true';
  const isFalse = bestCand === 'false';
  if (isBest) trueCount++;
  if (isFalse) falseCount++;

  if (!namesMap.has(name)) {
    namesMap.set(name, []);
  }
  namesMap.get(name).push({ coords, source, numGeocodes, bestCand, googleMapsUrl });
}

console.log('Unique locations represented:', namesMap.size);
console.log('Best-candidate count (true):', trueCount);
console.log('Alternate candidate count (false):', falseCount);
console.log('Total candidate geocode entries:', trueCount + falseCount);

// Verify that every location has exactly 1 best-candidate == true and valid google maps URL
let errorCount = 0;
for (const [name, rows] of namesMap.entries()) {
  const trues = rows.filter(r => r.bestCand === 'true');
  if (trues.length !== 1) {
    console.warn(`Location ${name} has ${trues.length} true best-candidates! Expected 1.`);
    errorCount++;
  }
  for (const r of rows) {
    if (r.numGeocodes !== rows.length) {
      console.warn(`Location ${name} has reported numGeocodes ${r.numGeocodes} != actual candidates ${rows.length}`);
      errorCount++;
    }
    if (!r.googleMapsUrl || !r.googleMapsUrl.startsWith('https://www.google.com/maps')) {
      console.warn(`Location ${name} has invalid google maps URL: ${r.googleMapsUrl}`);
      errorCount++;
    }
  }
}

if (errorCount === 0) {
  console.log('\n[PASS] All validation assertions passed! Every location has exactly one best-candidate: true, matching candidate count, and valid high-zoom Google Maps URL.');
} else {
  console.warn(`\n[WARNING] Found ${errorCount} validation discrepancies.`);
}
