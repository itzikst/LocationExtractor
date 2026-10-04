import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

// Conversion function from Old Israel Grid (ICS) / New Israel Grid (ITM) to WGS84
// Standard Cassin-Soldner / ITM approximation or accurate conversion
function gridToWgs84(gridStr) {
  if (!gridStr) return null;
  const clean = gridStr.replace(/\D/g, '');
  let east, north;
  if (clean.length === 8) {
    east = parseInt(clean.slice(0, 4), 10) * 100;
    north = parseInt(clean.slice(4, 8), 10) * 100;
  } else if (clean.length === 6) {
    east = parseInt(clean.slice(0, 3), 10) * 1000;
    north = parseInt(clean.slice(3, 6), 10) * 1000;
  } else {
    return null;
  }

  // Rough approximation for Israel Old Grid (ICS) to WGS84:
  // Easting ~ 100000 - 250000, Northing ~ 050000 - 300000
  // Reference: ICS origin (Jerusalem) approx 31.77° N, 35.21° E (170000, 112500)
  // 1 km East ~ 0.0105 deg Lon, 1 km North ~ 0.0090 deg Lat
  const lat = 31.77 + (north - 112500) * (1 / 111000);
  const lon = 35.21 + (east - 170000) * (1 / (111000 * Math.cos(31.77 * Math.PI / 180)));
  return { lat: Number(lat.toFixed(4)), lon: Number(lon.toFixed(4)), rawEast: east, rawNorth: north };
}

const geoJson = JSON.parse(readFileSync('data/water_installations.geojson', 'utf-8'));
const sitesCsv = readFileSync('data/archaeological_sites.csv', 'utf-8');

console.log('=== Auditing All 170 Extracted Sites ===');
const issues = [];

for (const f of geoJson.features) {
  const p = f.properties;
  const name = p['location name'];
  const heb = p.location_name_he || '';
  const [lon, lat] = f.geometry.coordinates;
  const region = p.region || '';
  const section = p.section_ref || '';

  // Check 1: Default fallback coords (30.8, 34.8) used for missing Negev/Judean desert points
  if (Math.abs(lat - 30.8) < 0.01 && Math.abs(lon - 34.8) < 0.01) {
    issues.push({ type: 'DEFAULT_FALLBACK_COORD', name, heb, lat, lon, region, section });
  }

  // Check 2: Low precision coordinates (< 2 decimals for Israeli sites)
  const latDec = (lat.toString().split('.')[1] || '').length;
  const lonDec = (lon.toString().split('.')[1] || '').length;
  if ((latDec < 2 || lonDec < 2) && region !== 'Greece' && region !== 'Turkey' && region !== 'Iraq' && region !== 'Mesopotamia' && region !== 'Phrygia') {
    issues.push({ type: 'LOW_PRECISION', name, heb, lat, lon, region, section });
  }

  // Check 3: Coordinates outside Southern Levant / Near East
  if (lat < 27 || lat > 42 || lon < 20 || lon > 50) {
    issues.push({ type: 'OUT_OF_BOUNDS', name, heb, lat, lon, region, section });
  }
}

console.log(`Found ${issues.length} potential coordinate issues:`);
issues.forEach(i => console.log(`[${i.type}] ${i.name} (${i.heb}) -> ${i.lat}, ${i.lon} [${i.region}] Section: ${i.section}`));
