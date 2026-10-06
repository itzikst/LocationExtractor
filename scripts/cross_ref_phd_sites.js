import { readFileSync } from 'node:fs';
import { parseGridRef } from './archaeological_gazetteer.js';

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

const pages = JSON.parse(readFileSync('data/post_processed_pages.json', 'utf-8'));

console.log(`Analyzing ${phdLocations.length} locations with Source='PhD'...\n`);

// Check each PhD location against the dissertation text
const results = [];

phdLocations.forEach(loc => {
  // Find where this location is mentioned in pages
  const mentioningPages = [];
  pages.forEach(p => {
    const text = p.clean_markdown || p.clean_html || '';
    if (text.includes(loc.name)) {
      mentioningPages.push(p.page_number);
    }
  });

  results.push({
    name: loc.name,
    coords: loc.coords,
    pages: mentioningPages
  });
});

console.log(JSON.stringify(results.slice(0, 30), null, 2));
