import { readFileSync } from 'node:fs';

const html = readFileSync('data/dissertation_reader.html', 'utf-8');

const matches = [...html.matchAll(/<a href="([^"]+)"[^>]*class="grid-coord-link"[^>]*>([\s\S]*?)<\/a>/g)];

console.log(`=== VERIFYING GRID COORDINATE LINKS IN DISSERTATION READER (${matches.length} total) ===\n`);

matches.forEach((m, idx) => {
  console.log(`${idx + 1}. Exact Text: "${m[2]}"`);
  console.log(`   Map URL:    ${m[1]}`);
});
