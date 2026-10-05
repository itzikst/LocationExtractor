import { readFileSync } from 'node:fs';

const text = readFileSync('.ocr_tmp/document_extracted.txt', 'utf8');
const pages = text.split(/--- Page (\d+) ---/);

const targets = [
  "בור מים מס' 1", "בור מים מס' 15", "בור מים מס' 17", "בור מים מס' 18", "בור מים מס' 19",
  "בור מס' 2", "בור מס' 20", "בור מס' 51", "בור מס' 52", "בור מס' 53", "בור מס' 40",
  "תעלה IV", "תעלה V", "תעלה VI", "תעלה VII", "הבריכה העליונה", "הבריכה העשויה", "הבריכה התחתונה",
  "בריכה מטויחת בתוך הארמון", "מגדל הבריכה", "מגדל המעיין", "הבריכה של בליס", "שלוש הבריכות"
];

for (const t of targets) {
  let found = false;
  for (let i = 1; i < pages.length; i += 2) {
    const pageNum = pages[i];
    const pageContent = pages[i + 1] || '';
    if (pageContent.includes(t)) {
      found = true;
      console.log(`- "${t}" -> found on Page ${pageNum}`);
      // find surrounding text
      const idx = pageContent.indexOf(t);
      const snippet = pageContent.slice(Math.max(0, idx - 100), Math.min(pageContent.length, idx + 100)).replace(/\n/g, ' ');
      console.log(`    Context: ${snippet}`);
    }
  }
  if (!found) {
    console.log(`- "${t}" NOT found in text verbatim`);
  }
}
