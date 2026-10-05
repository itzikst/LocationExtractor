import { readFileSync } from 'node:fs';

const text = readFileSync('.ocr_tmp/document_extracted.txt', 'utf8');
const pages = text.split(/--- Page (\d+) ---/);

function findInPages(term) {
  console.log(`\n=== Finding: "${term}" ===`);
  for (let i = 1; i < pages.length; i += 2) {
    const pageNum = pages[i];
    const pageContent = pages[i + 1] || '';
    if (pageContent.includes(term)) {
      console.log(`Page ${pageNum}:`);
      const lines = pageContent.split('\n');
      lines.forEach((l, idx) => {
        if (l.includes(term)) {
          console.log(`  L${idx}: ${lines.slice(Math.max(0, idx - 2), Math.min(lines.length, idx + 3)).join(' | ')}`);
        }
      });
    }
  }
}

findInPages('בור מים מס');
findInPages('מס\' 1');
findInPages('בור 40');
findInPages('בור מס');
findInPages('ג\'ית');
findInPages('סמוס');
