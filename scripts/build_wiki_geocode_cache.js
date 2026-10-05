import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';

const CACHE_DIR = join(process.cwd(), '.geocode_cache');
mkdirSync(CACHE_DIR, { recursive: true });

const CACHE_FILE = join(CACHE_DIR, 'wiki_coords.json');

const HEADERS = {
  'User-Agent': 'PreciseLocationExtractor/1.0 (academic research; contact: archaeology.geotrends@gmail.com)'
};

async function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

// Batch fetch coordinates for up to 50 titles from MediaWiki API
async function batchFetchWikiCoords(titles, lang = 'he') {
  if (!titles || titles.length === 0) return {};
  const url = `https://${lang}.wikipedia.org/w/api.php?action=query&prop=coordinates|info&inprop=url&redirects=1&titles=${encodeURIComponent(titles.join('|'))}&format=json`;

  try {
    const res = await fetch(url, { headers: HEADERS });
    if (!res.ok) return {};
    const text = await res.text();
    const data = JSON.parse(text);
    const pages = data.query?.pages || {};
    const results = {};

    for (const p of Object.values(pages)) {
      if (p.title && p.coordinates?.[0]) {
        results[p.title] = {
          lat: Number(p.coordinates[0].lat.toFixed(5)),
          lon: Number(p.coordinates[0].lon.toFixed(5)),
          url: p.fullurl,
          title: p.title
        };
      }
    }
    return results;
  } catch (err) {
    console.warn(`[Wiki ${lang}] Error fetching batch:`, err.message);
    return {};
  }
}

// Search individual title with opensearch / query search if direct batch misses
async function searchWikiCoords(query, lang = 'he') {
  const url = `https://${lang}.wikipedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(query)}&srlimit=3&format=json`;
  try {
    const res = await fetch(url, { headers: HEADERS });
    if (!res.ok) return null;
    const data = await res.json();
    const hits = data.query?.search || [];
    if (hits.length === 0) return null;

    const titles = hits.map(h => h.title);
    const coordsMap = await batchFetchWikiCoords(titles, lang);
    for (const t of titles) {
      if (coordsMap[t]) return coordsMap[t];
    }
    return null;
  } catch (e) {
    return null;
  }
}

async function main() {
  console.log('=== Building High-Precision Wikipedia / Wikidata Geocoding Cache ===');

  const locsPath = join(process.cwd(), 'data', 'locations_dissertation.json');
  const allLocs = JSON.parse(readFileSync(locsPath, 'utf8'));

  const EXCLUDED_TYPES = new Set([
    'region',
    'valley',
    'mountain',
    'river',
    'lake',
    'bay',
    'fortifications',
    'sea'
  ]);

  const pointLocs = allLocs.filter(l => {
    const type = (l.site_type || '').toLowerCase().trim();
    return !EXCLUDED_TYPES.has(type);
  });

  console.log(`Processing ${pointLocs.length} point location entities...`);

  let wikiCache = {};
  if (existsSync(CACHE_FILE)) {
    try {
      wikiCache = JSON.parse(readFileSync(CACHE_FILE, 'utf8'));
      console.log(`Loaded ${Object.keys(wikiCache).length} existing cached entries.`);
    } catch (e) {}
  }

  // 1. Gather all candidate query terms (Hebrew primary, aliases, English primary, English aliases)
  const querySet = new Set();
  pointLocs.forEach(l => {
    const nameH = l.location_name.trim();
    if (nameH) {
      querySet.add(nameH);
      querySet.add(`תל ${nameH}`);
      querySet.add(`חורבת ${nameH}`);
      querySet.add(`אתר ${nameH}`);
      querySet.add(`עין ${nameH}`);
      querySet.add(`מבצר ${nameH}`);
    }
    if (l.hebrew_aliases) {
      l.hebrew_aliases.split(';').forEach(a => {
        const tr = a.trim();
        if (tr) querySet.add(tr);
      });
    }
  });

  const queryList = Array.from(querySet).filter(q => !wikiCache[q]);
  console.log(`Querying ${queryList.length} candidate terms against Hebrew Wikipedia in batches of 50...`);

  // Batch query Hebrew Wikipedia
  const BATCH_SIZE = 50;
  for (let i = 0; i < queryList.length; i += BATCH_SIZE) {
    const batch = queryList.slice(i, i + BATCH_SIZE);
    const results = await batchFetchWikiCoords(batch, 'he');
    for (const [title, val] of Object.entries(results)) {
      wikiCache[title] = val;
    }
    if ((i + BATCH_SIZE) % 200 === 0 || i + BATCH_SIZE >= queryList.length) {
      console.log(`Hebrew Wiki Batch Progress: ${Math.min(i + BATCH_SIZE, queryList.length)}/${queryList.length} (Cached: ${Object.keys(wikiCache).length})`);
    }
    await sleep(250);
  }

  // 2. Batch query English Wikipedia for English names & aliases
  const engQuerySet = new Set();
  pointLocs.forEach(l => {
    if (l.english_name) engQuerySet.add(l.english_name.trim());
    if (l.english_aliases) {
      l.english_aliases.split(';').forEach(a => {
        const tr = a.trim();
        if (tr) engQuerySet.add(tr);
      });
    }
  });

  const engQueryList = Array.from(engQuerySet).filter(q => !wikiCache[q]);
  console.log(`Querying ${engQueryList.length} terms against English Wikipedia in batches of 50...`);

  for (let i = 0; i < engQueryList.length; i += BATCH_SIZE) {
    const batch = engQueryList.slice(i, i + BATCH_SIZE);
    const results = await batchFetchWikiCoords(batch, 'en');
    for (const [title, val] of Object.entries(results)) {
      wikiCache[title] = val;
    }
    await sleep(250);
  }

  // 3. Search Fallback for remaining un-cached point locations
  console.log('Running search fallback for remaining entities...');
  let searched = 0;
  for (const l of pointLocs) {
    const nameH = l.location_name.trim();
    if (wikiCache[nameH]) continue;

    // Try search Hebrew
    const resH = await searchWikiCoords(nameH, 'he');
    if (resH) {
      wikiCache[nameH] = resH;
      searched++;
      await sleep(200);
      continue;
    }

    // Try search English
    if (l.english_name) {
      const resE = await searchWikiCoords(l.english_name, 'en');
      if (resE) {
        wikiCache[nameH] = resE;
        searched++;
        await sleep(200);
        continue;
      }
    }
    await sleep(100);
  }

  console.log(`Search fallback resolved ${searched} additional entities.`);

  writeFileSync(CACHE_FILE, JSON.stringify(wikiCache, null, 2), 'utf8');
  console.log(`\nSuccessfully saved ${Object.keys(wikiCache).length} geocoded entries to ${CACHE_FILE}`);
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
