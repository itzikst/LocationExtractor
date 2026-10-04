import { readFileSync } from 'node:fs';

const geoJson = JSON.parse(readFileSync('data/water_installations.geojson', 'utf-8'));
const features = geoJson.features;

console.log('Total GeoJSON features:', features.length);

const tierCounts = {};
const tierSites = {};
const uniqueSitesByTier = {};

for (const f of features) {
  const p = f.properties;
  const name = p['location name'];
  const t = p.location_precision;

  tierCounts[t] = (tierCounts[t] || 0) + 1;
  if (!tierSites[t]) tierSites[t] = [];
  tierSites[t].push({ name, era: p.era });

  if (!uniqueSitesByTier[t]) uniqueSitesByTier[t] = new Set();
  uniqueSitesByTier[t].add(name);
}

console.log('\n--- Breakdown in 166-Record My Maps / GeoJSON Dataset ---');
for (const [t, count] of Object.entries(tierCounts)) {
  console.log(`Tier: "${t}" -> Total Records (occurrences): ${count} | Unique Places: ${uniqueSitesByTier[t].size}`);
}

console.log('\n--- Multi-Period Sites in Tier 1 / Exact Archaeological Sites ---');
const siteOccurrences = {};
for (const f of features) {
  const name = f.properties['location name'];
  const t = f.properties.location_precision;
  if (t === 'Tier 1: High Precision (Pinpoint Well/Installation < 50m)' || t === 'Exact Archaeological Site / IAA Grid') {
    siteOccurrences[name] = (siteOccurrences[name] || 0) + 1;
  }
}

const multiEra = Object.entries(siteOccurrences).filter(([k, v]) => v > 1);
console.log('Multi-era sites list (Name: number of eras):');
console.log(multiEra);
console.log('Number of multi-era sites:', multiEra.length);
const sumExtra = multiEra.reduce((sum, [k, v]) => sum + (v - 1), 0);
console.log('Extra occurrences from multi-era duplicate visits:', sumExtra);

console.log('\n--- The 9 Regional Survey Centroids (Tier 5) ---');
if (tierSites['Regional Survey Area (Centroid / Multiple Sites)']) {
  console.log(tierSites['Regional Survey Area (Centroid / Multiple Sites)']);
} else if (tierSites['Tier 5: Regional Survey Area Centroid (Multiple Sites)']) {
  console.log(tierSites['Tier 5: Regional Survey Area Centroid (Multiple Sites)']);
}
