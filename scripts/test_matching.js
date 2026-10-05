import { readFileSync } from 'node:fs';
import { MASTER_ARCHAEOLOGICAL_GAZETTEER } from './archaeological_gazetteer.js';

const locs = JSON.parse(readFileSync('data/locations_dissertation.json', 'utf8'));
const EXCLUDED_TYPES = new Set(['region', 'valley', 'mountain', 'river', 'lake', 'bay', 'fortifications', 'sea']);
const pointLocs = locs.filter(l => !EXCLUDED_TYPES.has((l.site_type || '').toLowerCase().trim()));

const iaaSites = JSON.parse(readFileSync('.iaa_cache/iaa_sites_with_coords.json', 'utf8'));
console.log('Point locations to geocode:', pointLocs.length);
console.log('IAA sites in cache:', iaaSites.length);

function normH(s) {
  if (!s) return '';
  return s
    .replace(/[\u0591-\u05C7]/g, '')
    .replace(/['"״׳`\-־]/g, '')
    .replace(/\(.*?\)/g, '')
    .replace(/^(תל|חורבת|חירבת|ח'רבת|חרבת|עין|באר|מערת|בריכת|נחל|הר|קאסר|מצד|מצודת|אתר)\s+/g, '')
    .replace(/^ה/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

const iaaMap = new Map();
iaaSites.forEach(s => {
  const k = normH(s.name_heb);
  if (k) {
    if (!iaaMap.has(k)) iaaMap.set(k, []);
    iaaMap.get(k).push(s);
  }
});

let gazMatches = 0;
let iaaMatches = 0;
let multipleIaa = 0;
let unmatched = [];

pointLocs.forEach(l => {
  const k = normH(l.location_name);
  let hasGaz = false;
  for (const [gKey, gVal] of Object.entries(MASTER_ARCHAEOLOGICAL_GAZETTEER)) {
    if (normH(gVal.hebName) === k || normH(gKey) === k) {
      hasGaz = true;
      break;
    }
  }
  if (hasGaz) gazMatches++;

  if (iaaMap.has(k)) {
    iaaMatches++;
    if (iaaMap.get(k).length > 1) multipleIaa++;
  } else {
    unmatched.push(l.location_name);
  }
});

console.log('Gazetteer (PhD) matches:', gazMatches);
console.log('IAA matches:', iaaMatches, '(of which multiple candidates:', multipleIaa, ')');
console.log('Unmatched in direct base-stem IAA:', unmatched.length);
console.log('Sample unmatched:', unmatched.slice(0, 20));
