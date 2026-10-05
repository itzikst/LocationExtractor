import { readFileSync } from 'node:fs';
import { parseGridRefAccurate } from './test_grid_conversion_accurate.js';

const pages = JSON.parse(readFileSync('data/post_processed_pages.json', 'utf-8'));

// Flexible regex for in-text coordinate matching across line breaks and Hebrew affixes
const comprehensiveGridRegex = /(?:ב|ל)?נ[\.״\"\'\s]*[י]?[\.״\"\'\s]*[צץ][\.״\"\'\s]*(?:(?:\.U\.T\.M|\.UTM|UTM)[\.\s]*)?[:\-]?\s*([0-9]{3,6}(?:[\.\/\-–\s]+[0-9]{3,6})|[0-9]{6,10})/gi;

const allFound = [];
for (const p of pages) {
  const content = p.clean_html || p.clean_markdown || '';
  let m;
  while ((m = comprehensiveGridRegex.exec(content)) !== null) {
    const full = m[0];
    const rawCoords = m[1];
    const geo = parseGridRefAccurate(rawCoords);
    allFound.push({
      page: p.page_number,
      fullText: full.replace(/\s+/g, ' '),
      rawCoords,
      geo,
      mapUrl: geo ? `https://www.google.com/maps?q=${geo.lat},${geo.lon}&ll=${geo.lat},${geo.lon}&z=17` : null
    });
  }
}

console.log(`Total found with comprehensive regex: ${allFound.length}`);
allFound.forEach(m => {
  console.log(`P.${m.page}: "${m.fullText}" -> coords: "${m.rawCoords}" -> ${m.geo ? `${m.geo.lat},${m.geo.lon}` : 'FAILED'} -> ${m.mapUrl}`);
});
