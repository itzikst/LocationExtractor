import { readFileSync } from 'node:fs';

const lines = readFileSync('data/geocoded_locations.csv', 'utf8').trim().split('\n').slice(1);
const bestCoordCounts = {};
const allCandidatesCount = {};
const unmapped = [];

for (const line of lines) {
  // name,coordinates,source,number of possible geocodes,best-candidate,google_maps_url
  const match = line.match(/^"([^"]+)","([^"]+)","([^"]+)",(\d+),(true|false),"([^"]+)"$/);
  if (!match) continue;
  const [_, name, coords, source, numGeocodes, isBestStr, gmapsUrl] = match;
  const isBest = isBestStr === 'true';

  allCandidatesCount[coords] = (allCandidatesCount[coords] || 0) + 1;
  if (isBest) {
    if (!bestCoordCounts[coords]) bestCoordCounts[coords] = [];
    bestCoordCounts[coords].push({ name, source });
  }
}

console.log('Top repeated coordinates among best candidates:');
const sorted = Object.entries(bestCoordCounts).sort((a, b) => b[1].length - a[1].length).slice(0, 15);
for (const [coords, items] of sorted) {
  console.log(`${coords} (Count: ${items.length}) -> Sources: [${[...new Set(items.map(i => i.source))].join(', ')}]`);
  console.log(`   Sample sites: ${items.slice(0, 5).map(i => i.name).join(', ')}`);
}
