import { readFileSync, writeFileSync } from 'node:fs';
import { parseGridRef } from './archaeological_gazetteer.js';

// 1. Load all post processed pages
const pages = JSON.parse(readFileSync('data/post_processed_pages.json', 'utf-8'));
const gridRegex = /((?:ב|ל)?נ[\.״\"\'\s]*[י]?[\.״\"\'\s]*[צץ][\.״\"\'\s]*(?:(?:\.U\.T\.M|\.UTM|UTM)[\.\s]*)?[:\-]?\s*)([0-9]{3,6}(?:[\.\/\-–\s]+[0-9]{3,6})|[0-9]{6,10})/gi;

const inTextGrids = [];
pages.forEach(p => {
  const text = p.clean_markdown || p.clean_html || '';
  let match;
  gridRegex.lastIndex = 0;
  while ((match = gridRegex.exec(text)) !== null) {
    const idx = match.index;
    const start = Math.max(0, idx - 250);
    const end = Math.min(text.length, idx + 250);
    const context = text.slice(start, end).replace(/\s+/g, ' ');
    const geo = parseGridRef(match[2]);
    inTextGrids.push({
      page: p.page_number,
      match: match[0],
      coordStr: match[2],
      geo,
      context,
      rawIndex: idx,
      fullText: text
    });
  }
});

// 2. Load geocoded_locations.csv
const geocodedCsv = readFileSync('data/geocoded_locations.csv', 'utf-8').split('\n').filter(l => l.trim());
const phdLocations = [];
for (let i = 1; i < geocodedCsv.length; i++) {
  const line = geocodedCsv[i];
  const m = line.match(/^"([^"]+)","([^"]+)","([^"]+)",(\d+),(true|false),"([^"]+)"/);
  if (m) {
    const [, name, coords, source, num, isBest, mapUrl] = m;
    if (source.trim() === 'PhD') {
      phdLocations.push({ name, coords, source, mapUrl });
    }
  }
}

let report = '=== ALL IN-TEXT GRID COORDINATES ANALYSIS ===\n\n';

inTextGrids.forEach((g, idx) => {
  report += `================================================================\n`;
  report += `[#${idx + 1}] Page ${g.page} (Dissertation Page ${g.page - 4})\n`;
  report += `Raw Match: "${g.match}" | Grid: ${g.coordStr} | WGS84: ${g.geo ? `${g.geo.lat}, ${g.geo.lon}` : 'N/A'}\n`;
  report += `Context: "${g.context}"\n\n`;
});

writeFileSync('scripts/intext_grid_analysis.txt', report, 'utf-8');
console.log('Saved analysis to scripts/intext_grid_analysis.txt');
