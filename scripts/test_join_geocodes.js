import { readFileSync } from 'node:fs';

const locJson = JSON.parse(readFileSync('data/locations_dissertation.json', 'utf-8'));
const csvText = readFileSync('data/geocoded_locations.csv', 'utf-8');

// Parse CSV
const csvLines = csvText.split('\n').filter(l => l.trim());
const geocodedMap = new Map();

for (let i = 1; i < csvLines.length; i++) {
  const line = csvLines[i];
  // name,coordinates,source,number of possible geocodes,best-candidate,google_maps_url
  const m = line.match(/^"([^"]+)","([^"]+)","([^"]+)",(\d+),(true|false),"([^"]+)"/);
  if (m) {
    const [, name, coords, source, num, isBest, mapUrl] = m;
    if (isBest === 'true') {
      const [lat, lon] = coords.split(',').map(s => s.trim());
      geocodedMap.set(name.trim(), {
        lat,
        lon,
        source: source.trim(),
        numCandidates: parseInt(num, 10),
        mapUrl: mapUrl.trim()
      });
    }
  }
}

console.log(`Loaded ${geocodedMap.size} best geocodes from geocoded_locations.csv`);

let matchedCount = 0;
let missingCoords = [];

for (const loc of locJson) {
  const name = loc.location_name.trim();
  const geo = geocodedMap.get(name);
  if (geo) {
    matchedCount++;
  } else {
    // Check if loc has its own latitude / longitude
    if (loc.latitude && loc.longitude) {
      matchedCount++;
    } else {
      missingCoords.push(name);
    }
  }
}

console.log(`Matched with coordinates: ${matchedCount} / ${locJson.length}`);
console.log(`Missing coordinates count: ${missingCoords.length}`);
if (missingCoords.length > 0) {
  console.log('Sample missing:', missingCoords.slice(0, 20));
}
