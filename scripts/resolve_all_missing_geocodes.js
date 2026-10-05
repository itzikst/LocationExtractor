import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';

const CACHE_DIR = join(process.cwd(), '.geocode_cache');
mkdirSync(CACHE_DIR, { recursive: true });
const MASTER_RESOLVED_CACHE = join(CACHE_DIR, 'resolved_geocodes.json');

const HEADERS = {
  'User-Agent': 'LocationExtractorAcademic/1.0 (archaeology.geotrends@gmail.com)'
};

async function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

// 1. Wikipedia Geocoding Resolver (Hebrew + English)
async function resolveViaWikipedia(query) {
  if (!query || query.trim().length < 2) return null;

  // Try Hebrew Wikipedia Search
  try {
    const heUrl = `https://he.wikipedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(query)}&srlimit=5&format=json`;
    const res = await fetch(heUrl, { headers: HEADERS });
    if (res.ok) {
      const data = await res.json();
      const hits = data.query?.search || [];
      if (hits.length > 0) {
        const titles = hits.map(h => h.title);
        const coordUrl = `https://he.wikipedia.org/w/api.php?action=query&prop=coordinates|info&inprop=url&redirects=1&titles=${encodeURIComponent(titles.join('|'))}&format=json`;
        const cRes = await fetch(coordUrl, { headers: HEADERS });
        if (cRes.ok) {
          const cData = await cRes.json();
          const pages = cData.query?.pages || {};
          for (const p of Object.values(pages)) {
            if (p.coordinates?.[0]) {
              return {
                lat: Number(p.coordinates[0].lat.toFixed(5)),
                lon: Number(p.coordinates[0].lon.toFixed(5)),
                url: p.fullurl,
                title: p.title,
                source: 'Wikipedia (Hebrew)'
              };
            }
          }
        }
      }
    }
  } catch (e) {}

  await sleep(150);

  // Try English Wikipedia Search
  try {
    const enUrl = `https://en.wikipedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(query)}&srlimit=5&format=json`;
    const res = await fetch(enUrl, { headers: HEADERS });
    if (res.ok) {
      const data = await res.json();
      const hits = data.query?.search || [];
      if (hits.length > 0) {
        const titles = hits.map(h => h.title);
        const coordUrl = `https://en.wikipedia.org/w/api.php?action=query&prop=coordinates|info&inprop=url&redirects=1&titles=${encodeURIComponent(titles.join('|'))}&format=json`;
        const cRes = await fetch(coordUrl, { headers: HEADERS });
        if (cRes.ok) {
          const cData = await cRes.json();
          const pages = cData.query?.pages || {};
          for (const p of Object.values(pages)) {
            if (p.coordinates?.[0]) {
              return {
                lat: Number(p.coordinates[0].lat.toFixed(5)),
                lon: Number(p.coordinates[0].lon.toFixed(5)),
                url: p.fullurl,
                title: p.title,
                source: 'Wikipedia (English)'
              };
            }
          }
        }
      }
    }
  } catch (e) {}

  return null;
}

// 2. OpenStreetMap Nominatim Resolver
async function resolveViaNominatim(query) {
  try {
    const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query)}&format=json&limit=1`;
    const res = await fetch(url, { headers: HEADERS });
    if (res.ok) {
      const data = await res.json();
      if (Array.isArray(data) && data.length > 0) {
        return {
          lat: Number(parseFloat(data[0].lat).toFixed(5)),
          lon: Number(parseFloat(data[0].lon).toFixed(5)),
          url: `https://www.openstreetmap.org/?mlat=${data[0].lat}&mlon=${data[0].lon}`,
          title: data[0].display_name,
          source: 'OpenStreetMap'
        };
      }
    }
  } catch (e) {}
  return null;
}

async function main() {
  console.log('=== Resolving Coordinates for All Extracted Locations ===');

  let resolvedCache = {};
  if (existsSync(MASTER_RESOLVED_CACHE)) {
    try {
      resolvedCache = JSON.parse(readFileSync(MASTER_RESOLVED_CACHE, 'utf8'));
      console.log(`Loaded ${Object.keys(resolvedCache).length} already resolved geocodes from cache.`);
    } catch (e) {}
  }

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

  const GENERIC_TYPOLOGY = new Set([
    'אמת מים', 'באר', 'בארות שרשרת', 'בור', 'בריכה וסכר', 'מאגר תת קרקעי',
    'מעיין', 'מעיין חתום', 'מפעל מים החצוב אל מי תהום', 'נחל/נהר', 'תמילה'
  ]);

  const pointLocs = allLocs.filter(l => {
    const type = (l.site_type || '').toLowerCase().trim();
    return !EXCLUDED_TYPES.has(type) && !GENERIC_TYPOLOGY.has(l.location_name);
  });

  console.log(`Auditing ${pointLocs.length} point location entities...`);

  // Load IAA cache
  const iaaCachePath = join(process.cwd(), '.iaa_cache', 'iaa_sites_with_coords.json');
  const iaaSites = JSON.parse(readFileSync(iaaCachePath, 'utf8'));

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

  const iaaStemMap = new Map();
  for (const s of iaaSites) {
    if (!s.latitude || !s.longitude) continue;
    const stem = normalizeHeb(s.name_heb);
    if (stem) {
      if (!iaaStemMap.has(stem)) iaaStemMap.set(stem, []);
      iaaStemMap.get(stem).push(s);
    }
  }

  let unresolved = 0;
  let newlyResolved = 0;

  for (let idx = 0; idx < pointLocs.length; idx++) {
    const l = pointLocs[idx];
    const name = l.location_name.trim();

    if (resolvedCache[name] && resolvedCache[name].lat && resolvedCache[name].lon && resolvedCache[name].coords !== '31.76830, 35.21370') {
      continue;
    }

    // Check IAA stem match
    const stem = normalizeHeb(name);
    const iaaMatches = iaaStemMap.get(stem);
    if (iaaMatches && iaaMatches.length > 0) {
      const best = iaaMatches[0];
      resolvedCache[name] = {
        lat: Number(best.latitude.toFixed(5)),
        lon: Number(best.longitude.toFixed(5)),
        url: best.portal_url,
        title: best.name_heb,
        source: 'IAA'
      };
      newlyResolved++;
      continue;
    }

    // Query Wikipedia
    console.log(`[${idx + 1}/${pointLocs.length}] Resolving '${name}' (${l.english_name || ''}) via Wikipedia API...`);
    let wikiRes = await resolveViaWikipedia(name);
    if (!wikiRes && l.english_name) {
      wikiRes = await resolveViaWikipedia(l.english_name);
    }
    if (!wikiRes && l.hebrew_aliases) {
      for (const al of l.hebrew_aliases.split(';')) {
        const alTr = al.trim();
        if (alTr) {
          wikiRes = await resolveViaWikipedia(alTr);
          if (wikiRes) break;
        }
      }
    }

    if (wikiRes) {
      resolvedCache[name] = wikiRes;
      newlyResolved++;
      console.log(` -> Found Wiki: ${wikiRes.title} (${wikiRes.lat}, ${wikiRes.lon})`);
      await sleep(200);
      continue;
    }

    // Query Nominatim
    let nomRes = await resolveViaNominatim(name);
    if (!nomRes && l.english_name) {
      nomRes = await resolveViaNominatim(l.english_name);
    }
    if (nomRes) {
      resolvedCache[name] = nomRes;
      newlyResolved++;
      console.log(` -> Found OSM: ${nomRes.title} (${nomRes.lat}, ${nomRes.lon})`);
      await sleep(500);
      continue;
    }

    unresolved++;
    console.warn(` -> Could not auto-resolve: ${name}`);
    await sleep(150);
  }

  writeFileSync(MASTER_RESOLVED_CACHE, JSON.stringify(resolvedCache, null, 2), 'utf8');
  console.log(`\n=== Resolution Complete ===`);
  console.log(`- Newly resolved entities: ${newlyResolved}`);
  console.log(`- Total resolved entities in cache: ${Object.keys(resolvedCache).length}`);
  console.log(`- Unresolved entities: ${unresolved}`);
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
