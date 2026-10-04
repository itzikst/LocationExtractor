import fs from 'node:fs';

const txt = fs.readFileSync('.ocr_tmp/document_extracted.txt', 'utf-8');
console.log('Total characters:', txt.length);
const pages = txt.split(/--- Page \d+ ---/);
console.log('Total pages:', pages.length);

for (let i = 1; i <= 25; i++) {
  const p = pages[i] || '';
  const lines = p.split('\n').map(l => l.trim()).filter(Boolean).slice(0, 5);
  console.log(`Page ${i}:`, lines.join(' | '));
}
