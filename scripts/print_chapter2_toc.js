import fs from 'node:fs';

const txt = fs.readFileSync('.ocr_tmp/document_extracted.txt', 'utf-8');
const pages = txt.split(/--- Page (\d+) ---/);

console.log('--- Full TOC of Chapter 2 (Pages 8-14) ---');
for (let i = 1; i < pages.length; i += 2) {
  const pageNum = parseInt(pages[i], 10);
  const content = pages[i + 1] || '';
  if (pageNum >= 8 && pageNum <= 14) {
    console.log(`\n=================== Page ${pageNum} ===================`);
    console.log(content);
  }
}
