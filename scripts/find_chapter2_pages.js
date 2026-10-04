import fs from 'node:fs';

const txt = fs.readFileSync('.ocr_tmp/document_extracted.txt', 'utf-8');
const pages = txt.split(/--- Page (\d+) ---/);

console.log('--- Searching for Chapter 2 Headings in Text ---');
for (let i = 1; i < pages.length; i += 2) {
  const pageNum = parseInt(pages[i], 10);
  const content = pages[i + 1] || '';
  if (pageNum >= 35 && pageNum <= 200) {
    const lines = content.split('\n').map(l => l.trim()).filter(Boolean);
    const headings = lines.filter(l => /^2\.\d/i.test(l) || /תקופת ה/i.test(l) && l.length < 60);
    if (headings.length > 0) {
      console.log(`Page ${pageNum}:`, headings.join(' | '));
    }
  }
}
