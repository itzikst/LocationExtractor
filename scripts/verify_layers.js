import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

const kmlDir = join(process.cwd(), 'data', 'kml_layers');
const files = readdirSync(kmlDir).filter(f => f.endsWith('.kml'));

console.log('=== Checking KML Layer Files for Duplicates ===');
let grandTotalDups = 0;

for (const file of files) {
  const content = readFileSync(join(kmlDir, file), 'utf-8');
  const names = [];
  const regex = /<Placemark>[\s\S]*?<name>(.*?)<\/name>/g;
  let match;
  while ((match = regex.exec(content)) !== null) {
    names.push(match[1]);
  }

  const counts = {};
  for (const n of names) {
    counts[n] = (counts[n] || 0) + 1;
  }
  const dups = Object.entries(counts).filter(([k, v]) => v > 1);
  if (dups.length > 0) {
    console.log(`[DUPLICATES FOUND in ${file}]:`, dups);
    grandTotalDups += dups.length;
  } else {
    console.log(`[OK] ${file}: ${names.length} unique sites`);
  }
}

console.log('\n=== Checking Tel Lachish occurrences ===');
for (const file of files) {
  const content = readFileSync(join(kmlDir, file), 'utf-8');
  if (content.toLowerCase().includes('lachish') || content.includes('לכיש')) {
    const lachishMatches = content.match(/<Placemark>[\s\S]*?<\/Placemark>/g) || [];
    const siteMatches = lachishMatches.filter(p => p.toLowerCase().includes('lachish') || p.includes('לכיש'));
    console.log(`In ${file}: found ${siteMatches.length} Tel Lachish placemark(s)`);
  }
}

console.log(`\nGrand Total Duplicate Placemarks across all layers: ${grandTotalDups}`);
