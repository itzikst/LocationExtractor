import { execSync } from 'node:child_process';
import { writeFileSync } from 'node:fs';

const res = execSync('gcloud storage cat gs://tsvika/output/document_extracted.txt', { encoding: 'utf-8', maxBuffer: 50 * 1024 * 1024 });

const idx = res.indexOf('2.9.30');
if (idx !== -1) {
  const snippet = res.slice(Math.max(0, idx - 400), idx + 1200);
  console.log('=== OCR Snippet around 2.9.30 ===\n');
  console.log(snippet);
} else {
  console.log('2.9.30 not found, searching for סמרא...');
  const idx2 = res.indexOf('סמרא');
  if (idx2 !== -1) {
    console.log(res.slice(Math.max(0, idx2 - 400), idx2 + 800));
  }
}
