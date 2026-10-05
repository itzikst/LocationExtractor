import { readFileSync } from 'node:fs';

const lines = readFileSync('data/geocoded_locations.csv', 'utf8').trim().split('\n').slice(1);
const rows = [];

for (const line of lines) {
  const match = line.match(/^"([^"]+)","([^"]+)","([^"]+)",(\d+),(true|false),"([^"]+)"$/);
  if (!match) continue;
  const [_, name, coords, source, numGeocodes, isBestStr, gmapsUrl] = match;
  if (isBestStr === 'true') {
    rows.push({ name, coords, source, gmapsUrl });
  }
}

console.log(`Total best-candidate rows: ${rows.length}`);

// Let's check specific suspicious cases
const suspicious = [];
for (const r of rows) {
  // 1. Egypt / Mersa Matruh assigned to Metzer (32.47469, 35.03584)
  if ((r.name.includes('מצרים') || r.name.includes('מרסה')) && r.coords === '32.47469, 35.03584') {
    suspicious.push({ issue: 'Egypt matched Metzer', ...r });
  }
  // 2. Gibeon assigned to Ai (31.91690, 35.26080)
  if (r.name.includes('גבעון') && r.coords === '31.91690, 35.26080') {
    suspicious.push({ issue: 'Gibeon matched Ai', ...r });
  }
  // 3. Tel Dan assigned to Western Wall
  if (r.name.includes('דן') && r.coords === '31.77698, 35.23447') {
    suspicious.push({ issue: 'Tel Dan matched Western Wall', ...r });
  }
  // 4. Any name containing tell / city that got Jerusalem or strange coords
  if (r.name.includes('חצור') && !r.coords.startsWith('33.01')) {
    suspicious.push({ issue: 'Hazor not near Hazor', ...r });
  }
  if (r.name.includes('מגידו') && !r.coords.startsWith('32.58')) {
    suspicious.push({ issue: 'Megiddo not near Megiddo', ...r });
  }
  if (r.name.includes('דן') && !r.coords.startsWith('33.24') && !r.name.includes('ירדן')) {
    suspicious.push({ issue: 'Dan not near Tel Dan', ...r });
  }
}

console.log(`Found ${suspicious.length} specific suspicious cases:`);
console.log(JSON.stringify(suspicious, null, 2));
