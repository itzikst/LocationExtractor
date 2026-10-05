import { writeFileSync, readFileSync, existsSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';

const CACHE_DIR = join(process.cwd(), '.iaa_cache');
mkdirSync(CACHE_DIR, { recursive: true });

const HEADERS = {
  'Content-Type': 'application/json; charset=utf-8',
  'Accept': 'application/json, text/javascript, */*',
  'X-Requested-With': 'XMLHttpRequest',
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) LocationExtractor/1.0'
};

async function fetchJson(url, retries = 3, delayMs = 500) {
  for (let i = 1; i <= retries; i++) {
    try {
      const res = await fetch(url, { headers: HEADERS });
      if (!res.ok) throw new Error(`HTTP ${res.status}: ${res.statusText}`);
      const text = await res.text();
      return JSON.parse(text);
    } catch (err) {
      if (i === retries) throw err;
      await new Promise(r => setTimeout(r, delayMs * i));
    }
  }
}

async function main() {
  console.log('=== Fetching & Caching All IAA Site Geometries & Coordinates ===');

  const gridPath = join(CACHE_DIR, 'israel_grid.json');
  if (!existsSync(gridPath)) {
    console.error('Missing israel_grid.json');
    process.exit(1);
  }

  const gridData = JSON.parse(readFileSync(gridPath, 'utf8'));
  const mapFeatures = gridData.features.filter(f => f.properties && f.properties.itemid);
  console.log(`Found ${mapFeatures.length} map sheets with itemid.`);

  const mapMetaMap = new Map();
  mapFeatures.forEach(f => {
    mapMetaMap.set(String(f.properties.itemid), {
      map_id: f.properties.itemid,
      map_number: f.properties.name,
      map_name_heb: f.properties.infoContent
    });
  });

  const masterSitesPath = join(CACHE_DIR, 'iaa_sites_with_coords.json');
  const allSitesWithCoords = [];
  const CONCURRENCY = 8;

  let completed = 0;
  for (let i = 0; i < mapFeatures.length; i += CONCURRENCY) {
    const batch = mapFeatures.slice(i, i + CONCURRENCY);
    await Promise.all(batch.map(async (feat) => {
      const mapId = feat.properties.itemid;
      const meta = mapMetaMap.get(String(mapId));
      try {
        const url = `https://survey.iaa.org.il/aspxService/Service.aspx/GetPolygonsSites?MapId=${mapId}&sitesId=null`;
        const data = await fetchJson(url);
        const geojson = typeof data.d === 'string' ? JSON.parse(data.d) : data.d;

        if (geojson && Array.isArray(geojson.features)) {
          for (const f of geojson.features) {
            const props = {};
            if (Array.isArray(f.properties)) {
              f.properties.forEach(p => { props[p.key] = p.value; });
            } else if (typeof f.properties === 'object' && f.properties !== null) {
              Object.assign(props, f.properties);
            }

            let lon = null;
            let lat = null;
            if (f.geometry && f.geometry.coordinates) {
              if (f.geometry.type === 'point' || f.geometry.type === 'Point') {
                lon = f.geometry.coordinates[0];
                lat = f.geometry.coordinates[1];
              } else if (Array.isArray(f.geometry.coordinates[0])) {
                lon = f.geometry.coordinates[0][0];
                lat = f.geometry.coordinates[0][1];
              }
            }

            allSitesWithCoords.push({
              iaa_id: props.id || '',
              site_num: props.site_num || '',
              map_id: mapId,
              map_number: meta ? meta.map_number : '',
              map_name_heb: meta ? meta.map_name_heb : '',
              name_heb: props.name_heb ? props.name_heb.trim() : '',
              description_heb: props.description_heb || '',
              bibliography_heb: props.bibliography_heb || '',
              latitude: lat ? Number(lat.toFixed(6)) : null,
              longitude: lon ? Number(lon.toFixed(6)) : null,
              portal_url: `https://survey.iaa.org.il/#/MapSurvey/${mapId}/site/${props.id || ''}`
            });
          }
        }
      } catch (err) {
        console.warn(`[Map ${mapId}] Failed to fetch sites: ${err.message}`);
      }
      completed++;
    }));
    if (completed % 20 === 0 || completed === mapFeatures.length) {
      console.log(`Progress: ${completed}/${mapFeatures.length} maps processed... (Collected ${allSitesWithCoords.length} sites so far)`);
    }
  }

  writeFileSync(masterSitesPath, JSON.stringify(allSitesWithCoords, null, 2), 'utf8');
  console.log(`\nSuccessfully cached ${allSitesWithCoords.length} IAA sites with coordinates to: ${masterSitesPath}`);
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
