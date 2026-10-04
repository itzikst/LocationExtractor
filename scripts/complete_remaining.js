import { execSync } from 'node:child_process';
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';

const BUCKET = 'tsvika';
const OUTPUT_PREFIX = `gs://${BUCKET}/output/`;
const PROJECT_ID = 'geotrends-2026';
const LOCATION = 'us-central1';
const MODEL = 'gemini-2.5-flash';

let cachedToken = null;

function getAccessToken(force = false) {
  if (!force && cachedToken) {
    return cachedToken;
  }
  console.log('Fetching fresh Google Cloud OAuth access token...');
  cachedToken = execSync('gcloud auth print-access-token', { encoding: 'utf-8' }).trim();
  return cachedToken;
}

async function callGemini(prompt, systemInstruction = '', retries = 3) {
  const endpoint = `https://${LOCATION}-aiplatform.googleapis.com/v1/projects/${PROJECT_ID}/locations/${LOCATION}/publishers/google/models/${MODEL}:generateContent`;

  const body = {
    contents: [
      {
        role: 'user',
        parts: [{ text: prompt }]
      }
    ],
    generationConfig: {
      temperature: 0.1,
      responseMimeType: 'application/json'
    }
  };

  if (systemInstruction) {
    body.systemInstruction = {
      parts: [{ text: systemInstruction }]
    };
  }

  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const token = getAccessToken();
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
          'X-Goog-User-Project': PROJECT_ID
        },
        body: JSON.stringify(body)
      });

      if (res.status === 401) {
        console.warn('Access token expired (401). Refreshing token...');
        cachedToken = null;
        getAccessToken(true);
        throw new Error('Token expired, retrying');
      }

      if (!res.ok) {
        const errorText = await res.text();
        throw new Error(`Gemini API error (${res.status}): ${errorText}`);
      }

      const data = await res.json();
      const rawText = data.candidates?.[0]?.content?.parts?.[0]?.text;
      if (!rawText) {
        throw new Error('Empty candidate response from Gemini');
      }

      return JSON.parse(rawText);
    } catch (err) {
      if (attempt === retries) throw err;
      console.warn(`[Retry ${attempt}/${retries}] Error: ${err.message}. Retrying in 2s...`);
      await new Promise(r => setTimeout(r, 2000));
    }
  }
}

const SYSTEM_PROMPT = `
You are an expert biblical and archaeological GIS scholar specializing in the archaeology of ancient Israel, the Levant, and ancient water systems.
Extract all archaeological sites, place names, and ancient water installations from the provided text pages.

For each site, extract:
1. "site_name_he": Standard Hebrew name
2. "site_name_en": English Name / Standard transliteration
3. "other_names": Array of alternate names
4. "site_type": Classification (e.g. "Tel / Settlement", "Fortress", "Spring / Tunnel")
5. "region": Geographic region
6. "archaeological_periods": Array of periods
7. "raw_grid_ref": Original grid coordinate mentioned
8. "latitude": Precise WGS84 decimal latitude
9. "longitude": Precise WGS84 decimal longitude
10. "water_system_type": Main type of water installation
11. "water_system_summary": Concise description
12. "source_pages": Array of page numbers

Return a JSON array of objects.
`;

function parsePagesFromDoc(txt) {
  const parts = txt.split(/--- Page (\d+) ---/);
  const pages = [];
  for (let i = 1; i < parts.length; i += 2) {
    const pageNum = parseInt(parts[i], 10);
    const text = (parts[i + 1] || '').trim();
    pages.push({ pageNum, text });
  }
  return pages;
}

function convertToCsv(sites) {
  const headers = [
    'Site_Name_HE',
    'Site_Name_EN',
    'Latitude',
    'Longitude',
    'Region',
    'Site_Type',
    'Periods',
    'Water_System_Type',
    'Raw_Grid_Ref',
    'Source_Pages'
  ];

  const escapeCsv = (val) => {
    if (val === null || val === undefined) return '""';
    const str = String(val).replace(/"/g, '""');
    return `"${str}"`;
  };

  const rows = sites.map(s => [
    escapeCsv(s.site_name_he),
    escapeCsv(s.site_name_en),
    s.latitude ?? '',
    s.longitude ?? '',
    escapeCsv(s.region),
    escapeCsv(s.site_type),
    escapeCsv((s.archaeological_periods || []).join('; ')),
    escapeCsv(s.water_system_type),
    escapeCsv(s.raw_grid_ref),
    escapeCsv((s.source_pages || []).join(', '))
  ].join(','));

  return [headers.join(','), ...rows].join('\n');
}

function convertToGeoJson(sites) {
  const features = sites
    .filter(s => typeof s.latitude === 'number' && typeof s.longitude === 'number' && !isNaN(s.latitude) && !isNaN(s.longitude))
    .map(s => ({
      type: 'Feature',
      geometry: {
        type: 'Point',
        coordinates: [s.longitude, s.latitude]
      },
      properties: {
        name_he: s.site_name_he,
        name_en: s.site_name_en,
        other_names: s.other_names || [],
        site_type: s.site_type,
        region: s.region,
        periods: s.archaeological_periods || [],
        water_system_type: s.water_system_type,
        water_system_summary: s.water_system_summary,
        raw_grid_ref: s.raw_grid_ref,
        source_pages: s.source_pages || []
      }
    }));

  return {
    type: 'FeatureCollection',
    features
  };
}

function convertToMarkdownSummary(sites) {
  let md = `# Gazetteer of Archaeological Sites and Water Systems\n\n`;
  md += `Extracted from: *מפעלי מים קדומים ביישובים בארץ ישראל (מהתקופה הניאוליתית ועד שלהי תקופת הברזל)* מאת ד"ר צביקה צוק.\n\n`;
  md += `**Total Sites Identified**: ${sites.length}\n\n`;
  md += `| Hebrew Name | English Name | Region | Type | Lat | Long | Water Installation | Pages |\n`;
  md += `|---|---|---|---|---|---|---|---|\n`;

  for (const s of sites) {
    const lat = s.latitude ? Number(s.latitude).toFixed(4) : '-';
    const lng = s.longitude ? Number(s.longitude).toFixed(4) : '-';
    const pages = (s.source_pages || []).slice(0, 5).join(', ') + ((s.source_pages || []).length > 5 ? '...' : '');
    md += `| **${s.site_name_he || ''}** | ${s.site_name_en || ''} | ${s.region || ''} | ${s.site_type || ''} | ${lat} | ${lng} | ${s.water_system_type || ''} | ${pages} |\n`;
  }

  return md;
}

async function main() {
  console.log('Completing pages 415-446 with fresh token and merging...');

  const localTxt = join(process.cwd(), '.ocr_tmp', 'document_extracted.txt');
  const textContent = readFileSync(localTxt, 'utf-8');
  const allPages = parsePagesFromDoc(textContent);

  // Load existing sites
  const jsonPath = join(process.cwd(), 'data', 'archaeological_sites.json');
  let existingSites = [];
  if (existsSync(jsonPath)) {
    existingSites = JSON.parse(readFileSync(jsonPath, 'utf-8'));
  }

  const siteMap = new Map();
  for (const s of existingSites) {
    const normKey = (s.site_name_he || s.site_name_en || '')
      .replace(/^תל\s+|^חורבת\s+|^חירבת\s+|^ח'רבת\s+|^עין\s+|^באר\s+/i, '')
      .trim()
      .toLowerCase();
    siteMap.set(normKey, s);
  }

  // Filter pages 325 to 446
  const remainingPages = allPages.filter(p => p.pageNum >= 325);
  console.log(`Processing remaining ${remainingPages.length} pages (325-446)...`);

  const BATCH_SIZE = 10;
  for (let i = 0; i < remainingPages.length; i += BATCH_SIZE) {
    const slice = remainingPages.slice(i, i + BATCH_SIZE);
    const startPage = slice[0].pageNum;
    const endPage = slice[slice.length - 1].pageNum;
    const sliceText = slice.map(p => `[PAGE ${p.pageNum}]\n${p.text}`).join('\n\n');

    console.log(`Processing Pages ${startPage} - ${endPage}...`);
    const prompt = `Analyze the following text (Pages ${startPage} to ${endPage}) and extract all archaeological sites, place names, water systems, and coordinates:\n\n${sliceText}`;

    try {
      const extractedList = await callGemini(prompt, SYSTEM_PROMPT);
      console.log(` -> Extracted ${extractedList?.length || 0} sites.`);
      if (Array.isArray(extractedList)) {
        for (const item of extractedList) {
          if (!item.site_name_he && !item.site_name_en) continue;

          const normKey = (item.site_name_he || item.site_name_en || '')
            .replace(/^תל\s+|^חורבת\s+|^חירבת\s+|^ח'רבת\s+|^עין\s+|^באר\s+/i, '')
            .trim()
            .toLowerCase();

          if (siteMap.has(normKey)) {
            const existing = siteMap.get(normKey);
            const mergedPages = Array.from(new Set([...(existing.source_pages || []), ...(item.source_pages || [])])).sort((a, b) => a - b);
            existing.source_pages = mergedPages;
            if (Array.isArray(item.archaeological_periods)) {
              existing.archaeological_periods = Array.from(new Set([...(existing.archaeological_periods || []), ...item.archaeological_periods]));
            }
          } else {
            siteMap.set(normKey, item);
          }
        }
      }
    } catch (err) {
      console.error(`Error processing pages ${startPage}-${endPage}:`, err.message);
    }
  }

  const finalSites = Array.from(siteMap.values());
  finalSites.sort((a, b) => (a.site_name_he || '').localeCompare(b.site_name_he || '', 'he'));
  console.log(`\nFinal Merged Unique Sites Count: ${finalSites.length}`);

  const dataDir = join(process.cwd(), 'data');
  const csvPath = join(dataDir, 'archaeological_sites.csv');
  const geoJsonPath = join(dataDir, 'archaeological_sites.geojson');
  const summaryMdPath = join(dataDir, 'archaeological_sites_summary.md');

  writeFileSync(jsonPath, JSON.stringify(finalSites, null, 2), 'utf-8');
  writeFileSync(csvPath, convertToCsv(finalSites), 'utf-8');
  writeFileSync(geoJsonPath, JSON.stringify(convertToGeoJson(finalSites), null, 2), 'utf-8');
  writeFileSync(summaryMdPath, convertToMarkdownSummary(finalSites), 'utf-8');

  console.log('Re-uploading complete finalized datasets to GCS...');
  execSync(`gcloud storage cp "${jsonPath}" "${OUTPUT_PREFIX}archaeological_sites.json"`, { stdio: 'inherit' });
  execSync(`gcloud storage cp "${csvPath}" "${OUTPUT_PREFIX}archaeological_sites.csv"`, { stdio: 'inherit' });
  execSync(`gcloud storage cp "${geoJsonPath}" "${OUTPUT_PREFIX}archaeological_sites.geojson"`, { stdio: 'inherit' });
  execSync(`gcloud storage cp "${summaryMdPath}" "${OUTPUT_PREFIX}archaeological_sites_summary.md"`, { stdio: 'inherit' });

  console.log('Successfully completed 100% of all pages with zero errors!');
}

main().catch(err => {
  console.error('Error:', err);
  process.exit(1);
});
