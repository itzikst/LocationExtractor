import { readFileSync } from 'node:fs';

const text = readFileSync('.ocr_tmp/document_extracted.txt', 'utf8');
const pages = text.split(/--- Page (\d+) ---/);

function searchTerms(query) {
  console.log(`\n=== Query: "${query}" ===`);
  for (let i = 1; i < pages.length; i += 2) {
    const pageNum = pages[i];
    const pageContent = pages[i + 1] || '';
    if (pageContent.includes(query)) {
      console.log(`Found on Page ${pageNum}:`);
      const lines = pageContent.split('\n').filter(l => l.includes(query));
      for (const l of lines.slice(0, 3)) {
        console.log(`  ${l.trim()}`);
      }
    }
  }
}

searchTerms('ערד');
searchTerms('בור 147');
searchTerms('216');
searchTerms('אירביל');
searchTerms('חינס');
searchTerms('סאמוס');
searchTerms('אופלינוס');
searchTerms('גבעון');
searchTerms('תל דן');
