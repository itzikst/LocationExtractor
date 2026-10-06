import fs from 'fs';
import path from 'path';
import { MASTER_ARCHAEOLOGICAL_GAZETTEER } from './archaeological_gazetteer.js';

const pages = JSON.parse(fs.readFileSync('./data/post_processed_pages.json', 'utf8'));
const locs = JSON.parse(fs.readFileSync('./data/locations_dissertation.json', 'utf8'));

// High-confidence map of curated sites and their exact whole-word search regex
const CURATED_SITE_REGEXES = {
  'תל חצור': /(?:^|[^\u0590-\u05FFa-zA-Z0-9])(?:תל\s+)?חצור(?:[^\u0590-\u05FFa-zA-Z0-9]|$)|Hazor/i,
  'תל ערד': /(?:^|[^\u0590-\u05FFa-zA-Z0-9])(?:תל\s+)?ערד(?:[^\u0590-\u05FFa-zA-Z0-9]|$)|Arad/i,
  'תל מגידו': /(?:^|[^\u0590-\u05FFa-zA-Z0-9])(?:תל\s+)?מגידו(?:[^\u0590-\u05FFa-zA-Z0-9]|$)|Megiddo/i,
  'תל גזר': /(?:^|[^\u0590-\u05FFa-zA-Z0-9])(?:תל\s+)?גזר(?:[^\u0590-\u05FFa-zA-Z0-9]|$)|Gezer/i,
  'תל בית שמש': /(?:^|[^\u0590-\u05FFa-zA-Z0-9])(?:תל\s+)?בית[\s\-]שמש(?:[^\u0590-\u05FFa-zA-Z0-9]|$)|Beth[\s\-]Shemesh/i,
  'תל לכיש': /(?:^|[^\u0590-\u05FFa-zA-Z0-9])(?:תל\s+)?לכיש(?:[^\u0590-\u05FFa-zA-Z0-9]|$)|Lachish/i,
  'תל באר שבע': /(?:^|[^\u0590-\u05FFa-zA-Z0-9])(?:תל\s+)?באר[\s\-]שבע(?:[^\u0590-\u05FFa-zA-Z0-9]|$)|Be'er[\s\-]Sheva/i,
  'חורבת עוזה': /(?:^|[^\u0590-\u05FFa-zA-Z0-9])(?:חורבת|חירבת|ח\'רבת|חרבת)\s+(?:עוזה|עזה)(?:[^\u0590-\u05FFa-zA-Z0-9]|$)|Horvat Uza/i,
  'חורבת טוב': /(?:^|[^\u0590-\u05FFa-zA-Z0-9])(?:חורבת|חירבת|ח\'רבת|חרבת|נחל)\s+טוב(?:[^\u0590-\u05FFa-zA-Z0-9]|$)|Horbat Tov/i,
  'חורבת ראש זית': /(?:^|[^\u0590-\u05FFa-zA-Z0-9])(?:חורבת\s+)?ראש[\s\-]זית(?:[^\u0590-\u05FFa-zA-Z0-9]|$)|Rosh Zayit/i,
  'חורבת רדום': /(?:^|[^\u0590-\u05FFa-zA-Z0-9])(?:חורבת|חירבת|ח\'רבת|חרבת)\s+רדום(?:[^\u0590-\u05FFa-zA-Z0-9]|$)|Horbat Radum/i,
  'תל דלית': /(?:^|[^\u0590-\u05FFa-zA-Z0-9])(?:תל\s+)?דלית(?:[^\u0590-\u05FFa-zA-Z0-9]|$)|Tel Dalit/i,
  'עתלית ים': /(?:^|[^\u0590-\u05FFa-zA-Z0-9])עתלית[\s\-]ים(?:[^\u0590-\u05FFa-zA-Z0-9]|$)|Atlit[\s\-]Yam/i,
  'תל יקנעם': /(?:^|[^\u0590-\u05FFa-zA-Z0-9])(?:תל\s+)?יקנעם(?:[^\u0590-\u05FFa-zA-Z0-9]|$)|Yokneam/i,
  'תל יבלעם': /(?:^|[^\u0590-\u05FFa-zA-Z0-9])(?:תל\s+)?יבלעם(?:[^\u0590-\u05FFa-zA-Z0-9]|$)|Ibleam/i,
  'תל דור': /(?:^|[^\u0590-\u05FFa-zA-Z0-9])(?:תל\s+)?ד[וֹ]?אר|דור(?:\s+שבחוף)?(?:[^\u0590-\u05FFa-zA-Z0-9]|$)|Tel Dor/i,
  'תל גבעון': /(?:^|[^\u0590-\u05FFa-zA-Z0-9])(?:תל\s+)?גבעון(?:[^\u0590-\u05FFa-zA-Z0-9]|$)|Gibeon/i,
  'תל כברי': /(?:^|[^\u0590-\u05FFa-zA-Z0-9])(?:תל\s+)?כברי(?:[^\u0590-\u05FFa-zA-Z0-9]|$)|Kabri/i,
  'תל א-סעידיה (ירדן)': /(?:^|[^\u0590-\u05FFa-zA-Z0-9])(?:תל\s+)?(?:א[\s\-])?סעידיה(?:[^\u0590-\u05FFa-zA-Z0-9]|$)|Sa'idiyeh/i,
  'תל בית ירח': /(?:^|[^\u0590-\u05FFa-zA-Z0-9])(?:תל\s+)?בית[\s\-]ירח(?:[^\u0590-\u05FFa-zA-Z0-9]|$)|Bet Yerah/i,
  'תל גריסה': /(?:^|[^\u0590-\u05FFa-zA-Z0-9])(?:תל\s+)?גריסה(?:[^\u0590-\u05FFa-zA-Z0-9]|$)|Gerisa/i,
  'קלע': /(?:^|[^\u0590-\u05FFa-zA-Z0-9])(?:אתר|חורבת|ח\'רבת)?\s*קלע(?:[^\u0590-\u05FFa-zA-Z0-9]|$)|Site of Qal'a/i
};

console.log('Running clean curated location page enrichment...');

let updatedCount = 0;

for (const [siteName, regex] of Object.entries(CURATED_SITE_REGEXES)) {
  const loc = locs.find(l => l.location_name === siteName);
  if (!loc) {
    console.log(`Note: site "${siteName}" not found by exact location_name, searching similar...`);
    continue;
  }

  const existingPages = new Set(loc.all_pages || []);
  let added = 0;

  for (const p of pages) {
    const text = (p.clean_markdown || '') + '\n' + (p.clean_html || '') + '\n' + (p.section_title || '');
    if (regex.test(text)) {
      if (!existingPages.has(p.page_number)) {
        existingPages.add(p.page_number);
        added++;
      }
    }
  }

  if (added > 0) {
    updatedCount++;
    const sorted = Array.from(existingPages).sort((a, b) => a - b);
    loc.all_pages = sorted;
    loc.pages_mentioned = sorted.join(', ');
    loc.page_count = sorted.length;
    loc.first_page = sorted[0];
    console.log(` - Updated "${siteName}": added ${added} pages (total now ${sorted.length}).`);
  }
}

console.log(`\nUpdated ${updatedCount} curated site entities.`);

// Specific verification for Tel Hazor
const hazor = locs.find(l => l.location_name === 'תל חצור');
console.log('\nTel Hazor pages count:', hazor.all_pages.length);
console.log('Tel Hazor pages sample:', hazor.all_pages.slice(0, 25).join(', '), '...');
console.log('Includes page 119?', hazor.all_pages.includes(119));
console.log('Coordinates of Tel Hazor:', hazor.latitude, hazor.longitude);

// Save updated JSON
fs.writeFileSync('./data/locations_dissertation.json', JSON.stringify(locs, null, 2), 'utf8');
console.log('Saved updated data/locations_dissertation.json');

// Rebuild CSV
function escapeCsv(val) {
  if (val === undefined || val === null) return '""';
  const str = String(val).replace(/"/g, '""');
  return `"${str}"`;
}

const headers = [
  'location_name',
  'english_name',
  'hebrew_aliases',
  'english_aliases',
  'site_type',
  'pages_mentioned',
  'first_page',
  'page_count',
  'iaa_survey_map',
  'iaa_site_id',
  'iaa_portal_url',
  'iaa_eng_portal_url',
  'latitude',
  'longitude'
];

const csvRows = [headers.join(',')];
for (const l of locs) {
  csvRows.push(headers.map(h => escapeCsv(l[h])).join(','));
}
fs.writeFileSync('./data/locations_dissertation.csv', csvRows.join('\n'), 'utf8');
console.log('Saved updated data/locations_dissertation.csv');
