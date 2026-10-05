import { readFileSync } from 'node:fs';

// Let's inspect scripts/geocode_all_locations.js COMPREHENSIVE_ARCHAEOLOGICAL_DIRECTORY
const code = readFileSync('scripts/geocode_all_locations.js', 'utf8');
const match = code.match(/const COMPREHENSIVE_ARCHAEOLOGICAL_DIRECTORY = {([\s\S]*?)};/);
if (!match) {
  console.error('Could not find COMPREHENSIVE_ARCHAEOLOGICAL_DIRECTORY');
  process.exit(1);
}

// Evaluate directory entries
const entries = [];
const lines = match[1].split('\n');
for (const line of lines) {
  const m = line.match(/'([^']+)':\s*{\s*coords:\s*'([^']+)',\s*source:\s*'([^']+)',\s*notes:\s*'([^']+)'\s*}/);
  if (m) {
    entries.push({
      name: m[1],
      coords: m[2],
      source: m[3],
      notes: m[4]
    });
  }
}

console.log(`Found ${entries.length} entries in COMPREHENSIVE_ARCHAEOLOGICAL_DIRECTORY.`);

// Check those with wikipedia URLs
const wikiEntries = entries.filter(e => e.source.startsWith('http'));
console.log(`Of which ${wikiEntries.length} cite a Wikipedia/web URL as source:`);

async function verifyWikiEntries() {
  const HEADERS = {
    'User-Agent': 'PreciseLocationExtractor/1.0 (academic research; contact: archaeology.geotrends@gmail.com)'
  };

  const discrepancies = [];

  for (const entry of wikiEntries) {
    try {
      // Extract lang and title from URL
      // e.g. https://en.wikipedia.org/wiki/Hacilar or https://he.wikipedia.org/wiki/%D7%A2%D7%99%D7%9F_%D7%92%D7%91
      const u = new URL(entry.source);
      const lang = u.hostname.split('.')[0];
      let title = decodeURIComponent(u.pathname.replace(/^\/wiki\//, ''));

      const apiUrl = `https://${lang}.wikipedia.org/w/api.php?action=query&prop=coordinates|info&inprop=url&redirects=1&titles=${encodeURIComponent(title)}&format=json`;
      const res = await fetch(apiUrl, { headers: HEADERS });
      const data = await res.json();
      const pages = Object.values(data.query?.pages || {});
      const p = pages[0];

      if (!p || p.missing !== undefined) {
        discrepancies.push({
          name: entry.name,
          source: entry.source,
          issue: 'Page not found / missing',
          currentCoords: entry.coords
        });
        continue;
      }

      if (!p.coordinates || p.coordinates.length === 0) {
        discrepancies.push({
          name: entry.name,
          source: entry.source,
          issue: 'Page has no coordinates (possibly disambiguation or missing geo tag)',
          currentCoords: entry.coords
        });
        continue;
      }

      const wikiLat = Number(p.coordinates[0].lat.toFixed(5));
      const wikiLon = Number(p.coordinates[0].lon.toFixed(5));
      const [curLat, curLon] = entry.coords.split(',').map(n => parseFloat(n.trim()));

      const dLat = Math.abs(wikiLat - curLat);
      const dLon = Math.abs(wikiLon - curLon);

      // Flag if difference > 0.005 (~500m)
      if (dLat > 0.005 || dLon > 0.005) {
        discrepancies.push({
          name: entry.name,
          source: entry.source,
          issue: `Coordinate difference > 500m: cur=(${curLat}, ${curLon}) vs wiki=(${wikiLat}, ${wikiLon})`,
          currentCoords: entry.coords,
          wikiCoords: `${wikiLat.toFixed(5)}, ${wikiLon.toFixed(5)}`,
          wikiUrl: p.fullurl
        });
      }
    } catch (e) {
      console.warn(`Error checking ${entry.name}:`, e.message);
    }
  }

  console.log(`\n=== Verification Results ===`);
  console.log(`Total checked: ${wikiEntries.length}`);
  console.log(`Discrepancies found: ${discrepancies.length}`);
  for (const d of discrepancies) {
    console.log(JSON.stringify(d, null, 2));
  }
}

verifyWikiEntries().catch(console.error);
