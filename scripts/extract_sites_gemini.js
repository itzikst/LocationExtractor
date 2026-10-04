import { execSync } from 'node:child_process';
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';

const BUCKET = 'tsvika';
const OUTPUT_PREFIX = `gs://${BUCKET}/output/`;
const PROJECT_ID = 'geotrends-2026';
const LOCATION = 'us-central1';
const MODEL = 'gemini-2.5-flash';

let cachedToken = null;
let tokenExpiry = 0;

function getAccessToken(force = false) {
  const now = Date.now();
  if (!force && cachedToken && now < tokenExpiry) {
    return cachedToken;
  }
  console.log('Fetching Google Cloud OAuth access token...');
  cachedToken = execSync('gcloud auth print-access-token', { encoding: 'utf-8' }).trim();
  tokenExpiry = now + 45 * 60 * 1000;
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
        console.warn('Access token expired (401). Invalidating and fetching fresh token...');
        cachedToken = null;
        getAccessToken(true);
        throw new Error('Token expired, retrying with fresh token');
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
      console.warn(`[Retry ${attempt}/${retries}] Batch request error: ${err.message}. Retrying in 3s...`);
      await new Promise(r => setTimeout(r, 3000));
    }
  }
}

const SYSTEM_PROMPT = `
You are an expert biblical and archaeological GIS scholar specializing in the archaeology of ancient Israel, the Levant, and ancient water systems (wells, shafts, tunnels, cisterns, springs, pools).
Your task is to analyze the provided text extracted from Dr. Zvika Tzuk's academic dissertation ("Ancient Water Systems in Settlements in Israel from the Neolithic to the Iron Age") and extract all archaeological sites, place names, geographical locations, and water installation sites.

For every distinct site/location identified in the text, extract:
1. "site_name_he": Standard Hebrew name (e.g., "תל חצור", "תל מגידו", "ירושלים (עיר דוד)", "תל גזר", "תל באר שבע", "גבעון", "תל דן", "חורבת רדנה", "תל ערד", "תל בית שמש", "מצר", "תל דלית", "העי", "תל שילה", "חירבת בנת-בר", "תל א-נצבה", "תל גריסה", "קומראן", "דיר אל-מדינה")
2. "site_name_en": English Name / Standard transliteration (e.g., "Tel Hazor", "Tel Megiddo", "City of David, Jerusalem", "Tel Gezer", "Tel Beersheba", "Gibeon", "Tel Dan", "Khirbet Raddana", "Tel Arad", "Tel Beit Shemesh", "Mezer", "Tel Dalit", "Ai (et-Tell)", "Tel Shiloh", "Khirbet Bint-Barr", "Tel en-Nasbeh", "Tel Gerisa", "Qumran", "Deir el-Medina")
3. "other_names": Array of alternate names, Arabic names, or biblical names if mentioned (e.g. ["Tell el-Qedah", "Hazor"])
4. "site_type": Classification (e.g., "Tel / Settlement", "Fortress", "Cave / Spring", "Water System / Shaft & Tunnel", "Well / Cistern complex")
5. "region": Geographic region (e.g., "Upper Galilee", "Lower Galilee", "Jezreel Valley", "Coastal Plain", "Shephelah", "Judean Hills", "Samaria", "Negev", "Jordan Valley / Dead Sea", "Egypt / Sinai")
6. "archaeological_periods": Array of periods mentioned (e.g., ["Neolithic", "Chalcolithic", "Early Bronze", "Middle Bronze", "Late Bronze", "Iron Age I", "Iron Age II", "Persian", "Hellenistic", "Roman"])
7. "raw_grid_ref": Original grid coordinate or נ.צ. mentioned in text if available (e.g. "203.8/269.4", "1968/2693", or "")
8. "latitude": Precise WGS84 decimal latitude (e.g. 33.0175). Provide accurate decimal coordinates in Israel/Levant for every site.
9. "longitude": Precise WGS84 decimal longitude (e.g. 35.5681).
10. "water_system_type": Main type of water installation at the site (e.g., "Stepped shaft to groundwater", "Plastered cisterns", "Karstic cave spring tunnel", "Hezekiah water tunnel", "Masonry well", "Open reservoir")
11. "water_system_summary": Concise description in Hebrew and/or English of the water installation.
12. "source_pages": Array of page numbers where this site is mentioned in the provided text.

Return a JSON array of objects conforming to this schema. If no sites are mentioned in the slice, return [].
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

// Concurrency pool helper with delay
async function mapConcurrent(items, limit, fn) {
  const results = [];
  let index = 0;

  async function worker() {
    while (index < items.length) {
      const currentIndex = index++;
      results[currentIndex] = await fn(items[currentIndex], currentIndex);
      await new Promise(r => setTimeout(r, 400));
    }
  }

  const workers = Array.from({ length: Math.min(limit, items.length) }, () => worker());
  await Promise.all(workers);
  return results;
}

async function main() {
  console.log('Starting Archaeological Sites & Coordinates Extraction with Gemini...');

  let textContent = '';
  const localTxt = join(process.cwd(), '.ocr_tmp', 'document_extracted.txt');
  if (existsSync(localTxt)) {
    console.log('Loading local OCR text...');
    textContent = readFileSync(localTxt, 'utf-8');
  } else {
    console.log('Downloading document_extracted.txt from GCS...');
    mkdirSync('.ocr_tmp', { recursive: true });
    execSync(`gcloud storage cp "${OUTPUT_PREFIX}document_extracted.txt" "${localTxt}"`, { stdio: 'inherit' });
    textContent = readFileSync(localTxt, 'utf-8');
  }

  const allPages = parsePagesFromDoc(textContent);
  console.log(`Loaded ${allPages.length} pages.`);

  // Use 10-page slices with 1-page overlap for fast, reliable extraction
  const BATCH_SIZE = 10;
  const OVERLAP = 1;
  const batches = [];

  for (let i = 0; i < allPages.length; i += (BATCH_SIZE - OVERLAP)) {
    const slice = allPages.slice(i, i + BATCH_SIZE);
    const startPage = slice[0].pageNum;
    const endPage = slice[slice.length - 1].pageNum;
    const sliceText = slice.map(p => `[PAGE ${p.pageNum}]\n${p.text}`).join('\n\n');
    batches.push({ startPage, endPage, sliceText });
  }

  console.log(`Prepared ${batches.length} batches (10 pages each). Running with concurrency of 2 workers...`);
  let completedCount = 0;

  const batchResults = await mapConcurrent(batches, 2, async (batch, bIndex) => {
    const prompt = `Analyze the following text (Pages ${batch.startPage} to ${batch.endPage}) and extract all archaeological sites, place names, water systems, and geographical coordinates:\n\n${batch.sliceText}`;
    try {
      const extractedList = await callGemini(prompt, SYSTEM_PROMPT);
      completedCount++;
      const percent = Math.round((completedCount / batches.length) * 100);
      console.log(`[Progress ${completedCount}/${batches.length} (${percent}%)] Pages ${batch.startPage}-${batch.endPage} -> ${extractedList?.length || 0} sites extracted`);
      return extractedList || [];
    } catch (err) {
      console.error(`Error in batch ${bIndex + 1} (Pages ${batch.startPage}-${batch.endPage}):`, err.message);
      return [];
    }
  });

  // Consolidate & deduplicate all sites
  const siteMap = new Map();

  for (const list of batchResults) {
    if (!Array.isArray(list)) continue;
    for (const item of list) {
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
        if ((!existing.latitude || isNaN(existing.latitude)) && item.latitude) {
          existing.latitude = item.latitude;
          existing.longitude = item.longitude;
        }
        if (!existing.raw_grid_ref && item.raw_grid_ref) {
          existing.raw_grid_ref = item.raw_grid_ref;
        }
        if (!existing.water_system_type && item.water_system_type) {
          existing.water_system_type = item.water_system_type;
        }
        if (!existing.water_system_summary && item.water_system_summary) {
          existing.water_system_summary = item.water_system_summary;
        }
      } else {
        siteMap.set(normKey, item);
      }
    }
  }

  const uniqueSites = Array.from(siteMap.values());
  console.log(`\n======================================================`);
  console.log(`Extraction Complete! Total Unique Sites Extracted: ${uniqueSites.length}`);
  console.log(`======================================================\n`);

  uniqueSites.sort((a, b) => (a.site_name_he || '').localeCompare(b.site_name_he || '', 'he'));

  const dataDir = join(process.cwd(), 'data');
  mkdirSync(dataDir, { recursive: true });

  const jsonPath = join(dataDir, 'archaeological_sites.json');
  const csvPath = join(dataDir, 'archaeological_sites.csv');
  const geoJsonPath = join(dataDir, 'archaeological_sites.geojson');
  const summaryMdPath = join(dataDir, 'archaeological_sites_summary.md');

  writeFileSync(jsonPath, JSON.stringify(uniqueSites, null, 2), 'utf-8');
  writeFileSync(csvPath, convertToCsv(uniqueSites), 'utf-8');
  writeFileSync(geoJsonPath, JSON.stringify(convertToGeoJson(uniqueSites), null, 2), 'utf-8');
  writeFileSync(summaryMdPath, convertToMarkdownSummary(uniqueSites), 'utf-8');

  console.log('Saved local datasets to data/:');
  console.log(` - ${jsonPath}`);
  console.log(` - ${csvPath}`);
  console.log(` - ${geoJsonPath}`);
  console.log(` - ${summaryMdPath}`);

  console.log(`\nUploading dataset files to ${OUTPUT_PREFIX}...`);
  execSync(`gcloud storage cp "${jsonPath}" "${OUTPUT_PREFIX}archaeological_sites.json"`, { stdio: 'inherit' });
  execSync(`gcloud storage cp "${csvPath}" "${OUTPUT_PREFIX}archaeological_sites.csv"`, { stdio: 'inherit' });
  execSync(`gcloud storage cp "${geoJsonPath}" "${OUTPUT_PREFIX}archaeological_sites.geojson"`, { stdio: 'inherit' });
  execSync(`gcloud storage cp "${summaryMdPath}" "${OUTPUT_PREFIX}archaeological_sites_summary.md"`, { stdio: 'inherit' });

  console.log(`\nAll datasets uploaded successfully to ${OUTPUT_PREFIX}`);
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
