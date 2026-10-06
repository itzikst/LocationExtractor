import { readFileSync, writeFileSync } from 'node:fs';

const HAZOR_WATER_SHAFT = { lat: '33.01685', lon: '35.56635' };
const HAZOR_NORTH_WEST = { lat: '33.01915', lon: '35.54889' }; // 20169/26938
const HAZOR_NORTH_EAST = { lat: '33.01770', lon: '35.55703' }; // 20245/26922
const HAZOR_SOUTH = { lat: '33.00715', lon: '35.55645' };      // 20240/26805

function getMapUrl(lat, lon) {
  return `https://www.google.com/maps?q=${lat},${lon}&ll=${lat},${lon}&z=17`;
}

// 1. Update data/locations_dissertation.json
const jsonPath = 'data/locations_dissertation.json';
const locs = JSON.parse(readFileSync(jsonPath, 'utf-8'));
locs.forEach(loc => {
  if (loc.location_name === 'תל חצור' || (loc.english_name && loc.english_name.toLowerCase() === 'hazor')) {
    loc.latitude = HAZOR_WATER_SHAFT.lat;
    loc.longitude = HAZOR_WATER_SHAFT.lon;
  }
});
writeFileSync(jsonPath, JSON.stringify(locs, null, 2), 'utf-8');
console.log(`Updated ${jsonPath}`);

// 2. Update data/locations_dissertation.csv
const csvPath = 'data/locations_dissertation.csv';
const csvLines = readFileSync(csvPath, 'utf-8').split('\n');
const newCsvLines = csvLines.map(line => {
  if (line.startsWith('"תל חצור"') || line.includes('"Hazor"')) {
    return line.replace(/"33\.[0-9]+","35\.[0-9]+"/, `"${HAZOR_WATER_SHAFT.lat}","${HAZOR_WATER_SHAFT.lon}"`);
  }
  return line;
});
writeFileSync(csvPath, newCsvLines.join('\n'), 'utf-8');
console.log(`Updated ${csvPath}`);

// 3. Update data/geocoded_locations.csv
const geocodedPath = 'data/geocoded_locations.csv';
const geoLines = readFileSync(geocodedPath, 'utf-8').split('\n');
const newGeoLines = [];

for (const line of geoLines) {
  if (!line.trim()) continue;

  if (line.includes('אמת המים הדרומית') || line.includes('התעלה החצובה הדרומית') || line.includes('בנחל חצור')) {
    const m = line.match(/^"([^"]+)"/);
    const name = m ? m[1] : '';
    const mapUrl = getMapUrl(HAZOR_SOUTH.lat, HAZOR_SOUTH.lon);
    newGeoLines.push(`"${name}","${HAZOR_SOUTH.lat}, ${HAZOR_SOUTH.lon}","PhD",1,true,"${mapUrl}"`);
  } else if (line.includes('מחוליות') || line.includes('מעיין ליד תל חצור')) {
    const m = line.match(/^"([^"]+)"/);
    const name = m ? m[1] : '';
    const mapUrl = getMapUrl(HAZOR_NORTH_EAST.lat, HAZOR_NORTH_EAST.lon);
    newGeoLines.push(`"${name}","${HAZOR_NORTH_EAST.lat}, ${HAZOR_NORTH_EAST.lon}","PhD",1,true,"${mapUrl}"`);
  } else if (line.includes('אמת המים הצפונית') || line.includes('התעלה החצובה הצפונית')) {
    const m = line.match(/^"([^"]+)"/);
    const name = m ? m[1] : '';
    const mapUrl = getMapUrl(HAZOR_NORTH_WEST.lat, HAZOR_NORTH_WEST.lon);
    newGeoLines.push(`"${name}","${HAZOR_NORTH_WEST.lat}, ${HAZOR_NORTH_WEST.lon}","PhD",1,true,"${mapUrl}"`);
  } else if (line.startsWith('"תל חצור"') && line.includes('true')) {
    const mapUrl = getMapUrl(HAZOR_WATER_SHAFT.lat, HAZOR_WATER_SHAFT.lon);
    newGeoLines.push(`"תל חצור","${HAZOR_WATER_SHAFT.lat}, ${HAZOR_WATER_SHAFT.lon}","PhD",21,true,"${mapUrl}"`);
  } else if (line.includes('חצור') && line.includes('true')) {
    const m = line.match(/^"([^"]+)"/);
    const name = m ? m[1] : '';
    const mapUrl = getMapUrl(HAZOR_WATER_SHAFT.lat, HAZOR_WATER_SHAFT.lon);
    newGeoLines.push(`"${name}","${HAZOR_WATER_SHAFT.lat}, ${HAZOR_WATER_SHAFT.lon}","PhD",1,true,"${mapUrl}"`);
  } else {
    newGeoLines.push(line);
  }
}

writeFileSync(geocodedPath, newGeoLines.join('\n'), 'utf-8');
console.log(`Updated ${geocodedPath}`);
