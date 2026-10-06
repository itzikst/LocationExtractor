import { readFileSync } from 'node:fs';

const locs = JSON.parse(readFileSync('data/locations_dissertation.json', 'utf-8'));
const hazorLocs = locs.filter(l => 
  (l.location_name && l.location_name.includes('חצור')) || 
  (l.english_name && l.english_name.toLowerCase().includes('hazor')) ||
  (l.location_name && l.location_name.includes('התעלה החצובה')) ||
  (l.location_name && l.location_name.includes('אמת המים'))
);

console.log('=== Locations matching Hazor in locations_dissertation.json ===');
hazorLocs.forEach(l => {
  console.log(`- "${l.location_name}" (${l.english_name}) | Coords: ${l.latitude}, ${l.longitude} | Pages: ${l.pages_mentioned}`);
});

const geocodedCsv = readFileSync('data/geocoded_locations.csv', 'utf-8').split('\n');
console.log('\n=== Entries in geocoded_locations.csv ===');
geocodedCsv.forEach(line => {
  if (line.includes('חצור') || line.toLowerCase().includes('hazor') || line.includes('התעלה')) {
    console.log(line);
  }
});
