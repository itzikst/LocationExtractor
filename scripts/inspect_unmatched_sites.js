import { readFileSync, writeFileSync } from 'node:fs';
import { MASTER_ARCHAEOLOGICAL_GAZETTEER } from './archaeological_gazetteer.js';

const locs = JSON.parse(readFileSync('data/locations_dissertation.json', 'utf8'));

const EXCLUDED_TYPES = new Set(['region', 'valley', 'mountain', 'river', 'lake', 'bay', 'fortifications', 'sea']);
const GENERIC_TYPOLOGY = new Set([
  'אמת מים', 'באר', 'בארות שרשרת', 'בור', 'בריכה וסכר', 'מאגר תת קרקעי',
  'מעיין', 'מעיין חתום', 'מפעל מים החצוב אל מי תהום', 'נחל/נהר', 'תמילה'
]);

const pointLocs = locs.filter(l => {
  const type = (l.site_type || '').toLowerCase().trim();
  return !EXCLUDED_TYPES.has(type) && !GENERIC_TYPOLOGY.has(l.location_name);
});

console.log('Total point locations:', pointLocs.length);

const iaaSites = JSON.parse(readFileSync('.iaa_cache/iaa_sites_with_coords.json', 'utf8'));

function normalizeHeb(s) {
  if (!s) return '';
  return s
    .replace(/[\u0591-\u05C7]/g, '')
    .replace(/['"״׳`\-־]/g, '')
    .replace(/\(.*?\)/g, '')
    .replace(/^(תל|חורבת|חירבת|ח'רבת|חרבת|עין|באר|מערת|בריכת|קאסר|מצד|מצודת|אתר)\s+/g, '')
    .replace(/^ה/g, '')
    .replace(/^אל/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

const gazMap = new Map();
for (const [k, v] of Object.entries(MASTER_ARCHAEOLOGICAL_GAZETTEER)) {
  gazMap.set(normalizeHeb(v.hebName), v);
  gazMap.set(v.hebName.trim(), v);
}

const iaaMap = new Map();
iaaSites.forEach(s => {
  if (s.latitude && s.longitude) {
    const raw = s.name_heb.trim();
    const stem = normalizeHeb(raw);
    if (!iaaMap.has(raw)) iaaMap.set(raw, []);
    iaaMap.get(raw).push(s);
    if (stem) {
      if (!iaaMap.has(stem)) iaaMap.set(stem, []);
      iaaMap.get(stem).push(s);
    }
  }
});

let gazMatches = 0;
let iaaMatches = 0;
const remaining = [];

pointLocs.forEach(l => {
  const name = l.location_name.trim();
  const stem = normalizeHeb(name);
  if (gazMap.has(name) || gazMap.has(stem)) {
    gazMatches++;
  } else if (iaaMap.has(name) || iaaMap.has(stem)) {
    iaaMatches++;
  } else {
    remaining.push(l);
  }
});

console.log('Gazetteer (PhD) matches:', gazMatches);
console.log('IAA matches:', iaaMatches);
console.log('Remaining entities to resolve:', remaining.length);
console.log('\nFirst 40 remaining entities:');
remaining.slice(0, 40).forEach((r, i) => {
  console.log(`${i+1}. ${r.location_name} | Eng: ${r.english_name || '-'} | Type: ${r.site_type} | Pages: ${r.pages_mentioned}`);
});

writeFileSync('.geocode_cache/unmatched_entities.json', JSON.stringify(remaining, null, 2), 'utf8');
