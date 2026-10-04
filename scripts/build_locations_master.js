import { readFileSync, writeFileSync, readdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { MASTER_ARCHAEOLOGICAL_GAZETTEER } from './archaeological_gazetteer.js';

const RAW_DIR = join(process.cwd(), 'data', 'locations_raw');
const IAA_CACHE_PATH = join(process.cwd(), '.iaa_cache', 'iaa_all_sites.json');
const OUTPUT_CSV = join(process.cwd(), 'data', 'locations_dissertation.csv');
const OUTPUT_JSON = join(process.cwd(), 'data', 'locations_dissertation.json');

// Normalizer for Hebrew matching
function normalizeHebrew(str) {
  if (!str) return '';
  return str
    .replace(/[\u0591-\u05C7]/g, '') // remove nikud
    .replace(/['"״׳`\-־]/g, '')     // remove quotes, hyphens
    .replace(/\(.*?\)/g, '')         // remove parentheses
    .replace(/^(תל|חורבת|חירבת|ח'רבת|חרבת|עין|באר|מערת|בריכת|נחל|הר|קאסר|מצד|מצודת|אתר)\s+/g, '') // strip common prefixes for base stem matching
    .replace(/^ה/g, '')              // strip definite article
    .replace(/\s+/g, ' ')
    .trim();
}

function normalizeEnglish(str) {
  if (!str) return '';
  return str
    .toLowerCase()
    .replace(/['"`\-_]/g, '')
    .replace(/^(tel|tell|khirbet|horbat|ein|en|beer|bir|cave|mount|nahal|wadi|fort|fortress)\s+/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function escapeCsv(val) {
  if (val === undefined || val === null) return '""';
  const str = String(val).replace(/"/g, '""');
  return `"${str}"`;
}

async function run() {
  console.log('=== Step 3 & 4: Consolidation, Aliasing & IAA Enrichment ===');

  // 1. Read all extracted raw chunks
  const rawFiles = readdirSync(RAW_DIR).filter(f => f.endsWith('.json'));
  console.log(`Found ${rawFiles.length} raw extraction chunk files.`);

  const allRawMentions = [];
  for (const file of rawFiles) {
    const filePath = join(RAW_DIR, file);
    try {
      const items = JSON.parse(readFileSync(filePath, 'utf8'));
      if (Array.isArray(items)) {
        allRawMentions.push(...items);
      }
    } catch (e) {
      console.warn(`Could not read ${file}: ${e.message}`);
    }
  }
  console.log(`Loaded ${allRawMentions.length} total raw location mentions.`);

  // 2. Build gazetteer lookup map
  const gazetteerLookup = new Map();
  for (const [key, gaz] of Object.entries(MASTER_ARCHAEOLOGICAL_GAZETTEER)) {
    const normH = normalizeHebrew(gaz.hebName);
    if (normH) gazetteerLookup.set(normH, gaz);
    const normE = normalizeEnglish(gaz.name);
    if (normE) gazetteerLookup.set(normE, gaz);
  }

  // 3. Aggregate by Base Stem Entity Key
  const entityMap = new Map();

  for (const item of allRawMentions) {
    let rawHeb = (item.canonical_hebrew || item.name_hebrew || item.name || '').trim();
    if (!rawHeb || rawHeb.length < 2) continue;

    // Clean up unwanted punctuation or quotes
    rawHeb = rawHeb.replace(/^["']|["']$/g, '').trim();

    const baseKey = normalizeHebrew(rawHeb);
    if (!baseKey) continue;

    const pageNum = parseInt(item.page_number, 10);
    if (!pageNum || isNaN(pageNum)) continue;

    if (!entityMap.has(baseKey)) {
      entityMap.set(baseKey, {
        primary_hebrew: rawHeb,
        primary_english: (item.canonical_english || item.name_english || '').trim(),
        hebrew_aliases: new Set(),
        english_aliases: new Set(),
        site_types: new Map(),
        pages: new Set([pageNum]),
        contexts: []
      });
    }

    const rec = entityMap.get(baseKey);

    // Preferred primary name heuristics: prefer Tell/Khirbet/Site over generic "באר X" or "X"
    if (rawHeb !== rec.primary_hebrew) {
      if (rawHeb.startsWith('תל ') || rawHeb.startsWith("ח'רבת ") || rawHeb.startsWith('חורבת ') || rawHeb.startsWith('עין ') || rawHeb.startsWith('מערת ')) {
        rec.hebrew_aliases.add(rec.primary_hebrew);
        rec.primary_hebrew = rawHeb;
      } else if (rec.primary_hebrew.startsWith('באר ') && !rawHeb.startsWith('באר ')) {
        rec.hebrew_aliases.add(rec.primary_hebrew);
        rec.primary_hebrew = rawHeb;
      } else {
        rec.hebrew_aliases.add(rawHeb);
      }
    }

    const eng = (item.canonical_english || '').trim();
    if (eng) {
      if (!rec.primary_english) {
        rec.primary_english = eng;
      } else if (eng !== rec.primary_english) {
        rec.english_aliases.add(eng);
      }
    }

    if (Array.isArray(item.hebrew_aliases)) {
      for (const a of item.hebrew_aliases) {
        const cleanA = (a || '').trim();
        if (cleanA && cleanA !== rec.primary_hebrew) {
          rec.hebrew_aliases.add(cleanA);
        }
      }
    }

    if (Array.isArray(item.english_aliases)) {
      for (const a of item.english_aliases) {
        const cleanE = (a || '').trim();
        if (cleanE && cleanE !== rec.primary_english) {
          rec.english_aliases.add(cleanE);
        }
      }
    }

    const st = (item.site_type || 'Archaeological Site').trim();
    if (st) {
      rec.site_types.set(st, (rec.site_types.get(st) || 0) + 1);
    }

    rec.pages.add(pageNum);
    if (item.context_summary) {
      rec.contexts.push({ page: pageNum, context: item.context_summary });
    }
  }

  console.log(`Consolidated into ${entityMap.size} distinct archaeological/geographical entities.`);

  // 4. Load IAA Catalog
  let iaaSites = [];
  if (existsSync(IAA_CACHE_PATH)) {
    iaaSites = JSON.parse(readFileSync(IAA_CACHE_PATH, 'utf8'));
    console.log(`Loaded ${iaaSites.length} IAA surveyed sites for matching.`);
  }

  const iaaByHebrew = new Map();
  const iaaByEnglish = new Map();
  for (const s of iaaSites) {
    const hKey = normalizeHebrew(s.name_heb);
    if (hKey && !iaaByHebrew.has(hKey)) iaaByHebrew.set(hKey, s);
    const eKey = normalizeEnglish(s.name_eng);
    if (eKey && !iaaByEnglish.has(eKey)) iaaByEnglish.set(eKey, s);
  }

  // 5. Construct Consolidated Records & Perform IAA & Gazetteer Matching
  const records = [];

  for (const [baseKey, entity] of entityMap.entries()) {
    const pagesArr = Array.from(entity.pages).sort((a, b) => a - b);
    const firstPage = pagesArr[0];

    // Determine primary Site Type
    let bestType = 'Archaeological Site';
    let maxTypeCount = 0;
    for (const [st, count] of entity.site_types.entries()) {
      if (count > maxTypeCount) {
        maxTypeCount = count;
        bestType = st;
      }
    }

    const normHeb = normalizeHebrew(entity.primary_hebrew);
    const normEng = normalizeEnglish(entity.primary_english);

    // Check Gazetteer
    const gazMatch = gazetteerLookup.get(normHeb) || gazetteerLookup.get(baseKey) || (normEng ? gazetteerLookup.get(normEng) : null);

    // Check IAA
    let iaaMatch = iaaByHebrew.get(normHeb) || iaaByHebrew.get(baseKey);
    if (!iaaMatch) {
      for (const a of entity.hebrew_aliases) {
        const normA = normalizeHebrew(a);
        if (iaaByHebrew.has(normA)) {
          iaaMatch = iaaByHebrew.get(normA);
          break;
        }
      }
    }
    if (!iaaMatch && normEng) {
      iaaMatch = iaaByEnglish.get(normEng);
    }

    let iaaSurveyMap = '';
    let iaaSiteId = '';
    let iaaPortalUrl = '';
    let iaaEngPortalUrl = '';
    let latitude = '';
    let longitude = '';

    if (gazMatch) {
      latitude = gazMatch.lat.toFixed(5);
      longitude = gazMatch.lon.toFixed(5);
      if (!entity.primary_english && gazMatch.name) {
        entity.primary_english = gazMatch.name;
      }
      if (gazMatch.tier && gazMatch.tier.includes('International')) {
        bestType = 'Comparative Site';
      }
    }

    if (iaaMatch) {
      iaaSurveyMap = `${iaaMatch.map_name_heb || ''} (${iaaMatch.map_number || ''})`.trim();
      iaaSiteId = String(iaaMatch.id || '');
      iaaPortalUrl = `https://survey.iaa.org.il/#/MapSurvey/${iaaMatch.map_id}/site/${iaaMatch.id}`;
      iaaEngPortalUrl = `https://survey.iaa.org.il//index_Eng.html#/MapSurvey/${iaaMatch.map_id}/site/${iaaMatch.id}`;
      if (!entity.primary_english && iaaMatch.name_eng) {
        entity.primary_english = iaaMatch.name_eng;
      }
    }

    // Ensure aliases don't include the primary name
    entity.hebrew_aliases.delete(entity.primary_hebrew);
    if (entity.primary_english) {
      entity.english_aliases.delete(entity.primary_english);
    }

    const hebrewAliasesStr = Array.from(entity.hebrew_aliases).join('; ');
    const englishAliasesStr = Array.from(entity.english_aliases).join('; ');
    const pageListStr = pagesArr.join(', ');

    records.push({
      location_name: entity.primary_hebrew,
      english_name: entity.primary_english,
      hebrew_aliases: hebrewAliasesStr,
      english_aliases: englishAliasesStr,
      site_type: bestType,
      pages_mentioned: pageListStr,
      first_page: firstPage,
      page_count: pagesArr.length,
      iaa_survey_map: iaaSurveyMap,
      iaa_site_id: iaaSiteId,
      iaa_portal_url: iaaPortalUrl,
      iaa_eng_portal_url: iaaEngPortalUrl,
      latitude: latitude,
      longitude: longitude,
      all_pages: pagesArr
    });
  }

  // 6. Sort Strictly by First Occurrence Page (1 -> 446)
  records.sort((a, b) => {
    if (a.first_page !== b.first_page) {
      return a.first_page - b.first_page;
    }
    return a.location_name.localeCompare(b.location_name, 'he');
  });

  console.log(`Successfully prepared ${records.length} sorted location records.`);

  // 7. Generate Master CSV
  const csvHeaders = [
    'Location Name',
    'English Name',
    'Hebrew Aliases',
    'English Aliases',
    'Site Type',
    'List of pages where the location is mentioned',
    'First Occurrence Page',
    'IAA Survey Map',
    'IAA Site ID',
    'IAA Portal URL',
    'IAA English Portal URL',
    'Latitude (WGS84)',
    'Longitude (WGS84)'
  ];

  const csvRows = [csvHeaders.map(escapeCsv).join(',')];
  for (const r of records) {
    const row = [
      escapeCsv(r.location_name),
      escapeCsv(r.english_name),
      escapeCsv(r.hebrew_aliases),
      escapeCsv(r.english_aliases),
      escapeCsv(r.site_type),
      escapeCsv(r.pages_mentioned),
      escapeCsv(r.first_page),
      escapeCsv(r.iaa_survey_map),
      escapeCsv(r.iaa_site_id),
      escapeCsv(r.iaa_portal_url),
      escapeCsv(r.iaa_eng_portal_url),
      escapeCsv(r.latitude),
      escapeCsv(r.longitude)
    ];
    csvRows.push(row.join(','));
  }

  writeFileSync(OUTPUT_CSV, '\uFEFF' + csvRows.join('\r\n'), 'utf8');
  console.log(`Saved master CSV to ${OUTPUT_CSV} (${records.length} rows).`);

  // 8. Generate Master JSON
  writeFileSync(OUTPUT_JSON, JSON.stringify(records, null, 2), 'utf8');
  console.log(`Saved master JSON to ${OUTPUT_JSON}.`);

  console.log('=== Step 3 & 4 Pipeline Completed Successfully! ===');
}

run().catch(err => {
  console.error('Fatal error in builder script:', err);
  process.exit(1);
});
