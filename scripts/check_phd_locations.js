import { readFileSync } from 'node:fs';

const geocodedCsv = readFileSync('data/geocoded_locations.csv', 'utf-8').split('\n').filter(l => l.trim());
const phdLocations = [];
for (let i = 1; i < geocodedCsv.length; i++) {
  const line = geocodedCsv[i];
  const m = line.match(/^"([^"]+)","([^"]+)","([^"]+)",(\d+),(true|false),"([^"]+)"/);
  if (m) {
    const [, name, coords, source, num, isBest, mapUrl] = m;
    if (source.trim() === 'PhD') {
      phdLocations.push({ name: name.trim(), coords: coords.trim(), mapUrl: mapUrl.trim() });
    }
  }
}

console.log(`Found ${phdLocations.length} locations with Source === 'PhD' in data/geocoded_locations.csv:\n`);
phdLocations.forEach((loc, i) => {
  console.log(`${i + 1}. "${loc.name}" -> ${loc.coords}`);
});
