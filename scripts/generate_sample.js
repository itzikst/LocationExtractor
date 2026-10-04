import { readFileSync, writeFileSync } from 'node:fs';

const csv = readFileSync('data/water_installations_mymaps.csv', 'utf-8');
const lines = csv.trim().split('\n').slice(1);

function parseCsvLine(line) {
  const result = [];
  let cur = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (c === '"') {
      if (inQuotes && line[i + 1] === '"') {
        cur += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (c === ',' && !inQuotes) {
      result.push(cur);
      cur = '';
    } else {
      cur += c;
    }
  }
  result.push(cur);
  return result;
}

const parsed = lines.map(parseCsvLine);
// Filter for precise locations
const precise = parsed.filter(row => row[7] === 'Exact Archaeological Site / IAA Grid');

// Select 20 random sites
function shuffle(array, seed = 42) {
  let m = array.length, t, i;
  let s = seed;
  function rnd() {
    s = (s * 9301 + 49297) % 233280;
    return s / 233280;
  }
  while (m) {
    i = Math.floor(rnd() * m--);
    t = array[m];
    array[m] = array[i];
    array[i] = t;
  }
  return array;
}

const sampled = shuffle([...precise], 777).slice(0, 20);

console.log('=== Sample of 20 Precise Archaeological Sites for Review ===\n');

sampled.forEach((s, idx) => {
  const name = s[0];
  const lat = s[1];
  const lon = s[2];
  const era = s[3];
  const type = s[4];
  const heb = s[5];
  const region = s[6];
  const dates = s[8];
  const section = s[9];
  const pages = s[10];
  const desc = s[11];
  const gmapsUrl = `https://www.google.com/maps/search/?api=1&query=${lat},${lon}`;

  console.log(`${idx + 1}. ${name}`);
  console.log(`   - Era: ${era}`);
  console.log(`   - Installation: ${type} | Region: ${region}`);
  console.log(`   - Coordinates: ${lat}, ${lon} -> Maps: ${gmapsUrl}`);
  console.log(`   - Dissertation: Section ${section || 'N/A'}, Pages: ${pages}`);
  console.log(`   - Summary: ${desc.slice(0, 140)}...\n`);
});
