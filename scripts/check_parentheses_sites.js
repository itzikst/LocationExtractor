import { readFileSync } from 'node:fs';

const locs = JSON.parse(readFileSync('data/locations_dissertation.json', 'utf8'));
const inParens = [];

for (const l of locs) {
  const m = l.location_name.match(/\(([^)]+)\)/);
  if (m) {
    inParens.push({ name: l.location_name, parent: m[1].trim() });
  }
}

console.log(`Found ${inParens.length} locations with parent site in parentheses:`);
const uniqueParents = [...new Set(inParens.map(p => p.parent))];
console.log('Unique parent names inside parentheses:', uniqueParents.join(', '));

for (const p of inParens) {
  console.log(`- "${p.name}" (Parent: "${p.parent}")`);
}
