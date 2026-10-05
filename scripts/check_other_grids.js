import { readFileSync } from 'node:fs';

const ocrText = readFileSync('.ocr_tmp/document_extracted.txt', 'utf-8');
const lines = ocrText.split('\n');

for (let i = 0; i < lines.length; i++) {
  const l = lines[i];
  // check for grid references, e.g. 6-digit or 8-digit or 10-digit grids
  if (/\b\d{3,5}[\/\-]\d{3,5}\b/.test(l)) {
    // filter out typical date ranges (e.g. 1926-1935, 859-884, 1993/4)
    const isYearRange = /(?:19\d\d|18\d\d|20\d\d|8\d\d)[\/\-](?:19\d\d|18\d\d|20\d\d|8\d\d|\d{2})/.test(l);
    if (!isYearRange) {
      console.log(`L.${i+1}: ${l.trim()}`);
    }
  }
}
