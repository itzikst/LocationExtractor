import { writeFileSync, readFileSync, existsSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';

const CACHE_DIR = join(process.cwd(), '.iaa_cache');
if (!existsSync(CACHE_DIR)) {
  mkdirSync(CACHE_DIR, { recursive: true });
}

const HEADERS = {
  'Content-Type': 'application/json; charset=utf-8',
  'X-Requested-With': 'XMLHttpRequest',
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) LocationExtractor/1.0'
};

async function fetchWithRetry(url, retries = 3, delayMs = 1000) {
  for (let i = 1; i <= retries; i++) {
    try {
      const res = await fetch(url, { headers: HEADERS });
      if (!res.ok) throw new Error(`HTTP ${res.status}: ${res.statusText}`);
      const text = await res.text();
      try {
        return JSON.parse(text);
      } catch (e) {
        throw new Error(`JSON parse error on ${url}: ${text.slice(0, 100)}`);
      }
    } catch (err) {
      if (i === retries) throw err;
      await new Promise(r => setTimeout(r, delayMs * i));
    }
  }
}

async function run() {
  console.log('=== Step 1: Pre-fetching & Caching IAA Survey Data ===');
  
  // 1. Fetch Master Grid (All 331 Map Sheets)
  const gridPath = join(CACHE_DIR, 'israel_grid.json');
  let gridData;
  if (existsSync(gridPath)) {
    console.log('Using cached Israel Grid GeoJSON...');
    gridData = JSON.parse(readFileSync(gridPath, 'utf8'));
  } else {
    console.log('Fetching Israel Grid GeoJSON from IAA...');
    gridData = await fetchWithRetry('https://survey.iaa.org.il/aspxService/GetIsraelGrid.aspx');
    writeFileSync(gridPath, JSON.stringify(gridData, null, 2), 'utf8');
    console.log(`Saved ${gridData.features.length} map sheets to ${gridPath}`);
  }

  const mapSheets = gridData.features.map(f => ({
    map_id: f.properties.itemid,
    map_number: f.properties.name,
    map_name: f.properties.infoContent,
    geometry: f.geometry
  }));

  console.log(`Found ${mapSheets.length} survey map sheets in IAA registry.`);

  // 2. Fetch Sites for each Map Sheet
  const masterSitesPath = join(CACHE_DIR, 'iaa_all_sites.json');
  let allSites = [];
  if (existsSync(masterSitesPath)) {
    console.log('Using cached IAA all sites catalog...');
    allSites = JSON.parse(readFileSync(masterSitesPath, 'utf8'));
    console.log(`Loaded ${allSites.length} cached IAA sites.`);
  } else {
    console.log('Fetching sites for each map sheet in batches...');
    const CONCURRENCY = 10;
    let completed = 0;

    for (let i = 0; i < mapSheets.length; i += CONCURRENCY) {
      const batch = mapSheets.slice(i, i + CONCURRENCY);
      await Promise.all(batch.map(async (sheet) => {
        try {
          const mapId = sheet.map_id;
          const [hebRes, engRes] = await Promise.all([
            fetchWithRetry(`https://survey.iaa.org.il/aspxService/Service.aspx/GetSites?mapId=${mapId}`).catch(() => ({ d: [] })),
            fetchWithRetry(`https://survey.iaa.org.il/aspxService/Service_Eng.aspx/GetSites?mapId=${mapId}`).catch(() => ({ d: [] }))
          ]);

          const hebSites = hebRes.d || [];
          const engSites = engRes.d || [];
          const engMap = new Map();
          for (const es of engSites) {
            engMap.set(es.id, es.name_heb || es.name_eng || '');
          }

          for (const hs of hebSites) {
            allSites.push({
              id: hs.id,
              site_num: hs.site_num,
              name_heb: hs.name_heb || '',
              name_eng: engMap.get(hs.id) || '',
              map_id: sheet.map_id,
              map_number: sheet.map_number,
              map_name_heb: sheet.map_name,
              shape_type: hs.shape_type
            });
          }
        } catch (e) {
          console.warn(`Warning: Failed to fetch sites for map ${sheet.map_number} (${sheet.map_name}): ${e.message}`);
        }
      }));

      completed += batch.length;
      if (completed % 50 === 0 || completed === mapSheets.length) {
        console.log(`Processed ${completed}/${mapSheets.length} map sheets... (${allSites.length} total sites collected)`);
      }
    }

    writeFileSync(masterSitesPath, JSON.stringify(allSites, null, 2), 'utf8');
    console.log(`Successfully indexed and cached ${allSites.length} IAA sites into ${masterSitesPath}`);
  }

  console.log('IAA caching completed successfully!');
}

run().catch(err => {
  console.error('Fatal error in IAA cache script:', err);
  process.exit(1);
});
