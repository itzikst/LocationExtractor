import fs from 'node:fs';

const txt = fs.readFileSync('.ocr_tmp/document_extracted.txt', 'utf-8');
const pages = txt.split(/--- Page (\d+) ---/);

// Look for pages with lists of sites, tables, coordinate mentions, or catalogue
console.log('Searching for coordinate patterns and site catalogues...');

// Israel grid coordinates often look like: נ.צ. 1234/5678 or 123456/123456 or 6-figure / 8-figure grid refs, or "אתר", "תל", "חורבת", "חירבת", "עין"
const gridMatches = [];
for (let i = 1; i < pages.length; i += 2) {
  const pageNum = pages[i];
  const content = pages[i + 1] || '';
  
  if (/נ\.?צ\.?|נקודת ציון|קואורדינט|רשת ישראל|Israel Grid|grid/i.test(content)) {
    gridMatches.push(pageNum);
  }
}

console.log('Pages mentioning coordinates/grid/נ.צ.:', gridMatches.slice(0, 30));

// Let's see some excerpts from pages mentioning נ.צ.
for (const pageNum of gridMatches.slice(0, 5)) {
  const pageIdx = pages.indexOf(pageNum);
  const content = pages[pageIdx + 1] || '';
  console.log(`\n=== Excerpt Page ${pageNum} ===`);
  const lines = content.split('\n').filter(l => /נ\.?צ|אתר|תל|חורב|ח'רב|עין|באר/i.test(l)).slice(0, 8);
  console.log(lines.join('\n'));
}
