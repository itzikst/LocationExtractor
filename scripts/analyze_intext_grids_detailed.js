import { readFileSync } from 'node:fs';
import { parseGridRef, icsToWgs84 } from './archaeological_gazetteer.js';

// 1. Post processed pages
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
      dissPage: p.page_number - 4,
      match: match[0],
      coordStr: match[2],
      geo,
      context,
      rawIndex: idx,
      fullText: text
    });
  }
});

console.log(`Analyzing ${inTextGrids.length} in-text grid coordinates:\n`);

inTextGrids.forEach((g, i) => {
  console.log(`================================================================`);
  console.log(`[#${i + 1}] Page ${g.page} (Dissertation p. ${g.dissPage})`);
  console.log(`Match: "${g.match}" | ICS: ${g.coordStr} | WGS84: ${g.geo ? `${g.geo.lat}, ${g.geo.lon}` : 'N/A'}`);
  console.log(`Context:\n${g.context}`);
});
