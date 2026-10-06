import { readFileSync } from 'node:fs';
import { parseGridRef } from './archaeological_gazetteer.js';

const pages = JSON.parse(readFileSync('data/post_processed_pages.json', 'utf-8'));
const gridRegex = /((?:ב|ל)?נ[\.״\"\'\s]*[י]?[\.״\"\'\s]*[צץ][\.״\"\'\s]*(?:(?:\.U\.T\.M|\.UTM|UTM)[\.\s]*)?[:\-]?\s*)([0-9]{3,6}(?:[\.\/\-–\s]+[0-9]{3,6})|[0-9]{6,10})/gi;

console.log('=== ALL IN-TEXT GRID COORDINATES IN DISSERTATION ===\n');

const occurrences = [];

pages.forEach(p => {
  const text = p.clean_markdown || p.clean_html || '';
  let match;
  // reset regex
  gridRegex.lastIndex = 0;
  while ((match = gridRegex.exec(text)) !== null) {
    const idx = match.index;
    const start = Math.max(0, idx - 200);
    const end = Math.min(text.length, idx + 200);
    const context = text.slice(start, end).replace(/\s+/g, ' ');
    const geo = parseGridRef(match[2]);
    occurrences.push({
      page: p.page_number,
      match: match[0],
      coordStr: match[2],
      geo,
      context
    });
  }
});

console.log(`Found ${occurrences.length} in-text grid occurrences:\n`);
occurrences.forEach((occ, i) => {
  console.log(`--- [${i + 1}] Page ${occ.page}: "${occ.match}" (Coords: ${occ.geo ? `${occ.geo.lat}, ${occ.geo.lon}` : 'N/A'}) ---`);
  console.log(`Context: ${occ.context}\n`);
});
