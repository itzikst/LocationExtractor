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

// Exact Chapter 2 Era Definitions from Dr. Zvika Tzuk's Dissertation
const CHAPTER_2_ERAS = [
  {
    id: '2.1',
    name: 'Paleolithic_Epipaleolithic',
    hebrewTitle: 'התקופה הפליאוליתית והאפי-פליאוליתית',
    startYear: -20000,
    endYear: -10000,
    startPage: 43,
    endPage: 44
  },
  {
    id: '2.2',
    name: 'Pre_Pottery_Neolithic',
    hebrewTitle: 'התקופה הניאוליתית הקדם קרמית',
    startYear: -8300,
    endYear: -5500,
    startPage: 45,
    endPage: 48
  },
  {
    id: '2.3',
    name: 'Pottery_Neolithic',
    hebrewTitle: 'התקופה הניאוליתית הקירמית',
    startYear: -5500,
    endYear: -4500,
    startPage: 49,
    endPage: 51
  },
  {
    id: '2.4',
    name: 'Chalcolithic',
    hebrewTitle: 'התקופה הכלקוליתית',
    startYear: -4500,
    endYear: -3300,
    startPage: 51,
    endPage: 54
  },
  {
    id: '2.5',
    name: 'Early_Bronze',
    hebrewTitle: 'תקופת הברונזה הקדומה (EB I-IV)',
    startYear: -3300,
    endYear: -2200,
    startPage: 55,
    endPage: 71
  },
  {
    id: '2.6',
    name: 'Middle_Bronze',
    hebrewTitle: 'תקופת הברונזה התיכונה (MB I-II)',
    startYear: -2200,
    endYear: -1550,
    startPage: 72,
    endPage: 94
  },
  {
    id: '2.7',
    name: 'Late_Bronze',
    hebrewTitle: 'תקופת הברונזה המאוחרת (LB I-II)',
    startYear: -1550,
    endYear: -1200,
    startPage: 95,
    endPage: 104
  },
  {
    id: '2.8',
    name: 'Iron_Age_I',
    hebrewTitle: 'תקופת הברזל 1 (Iron I)',
    startYear: -1200,
    endYear: -1000,
    startPage: 105,
    endPage: 114
  },
  {
    id: '2.9',
    name: 'Iron_Age_II',
    hebrewTitle: 'תקופת הברזל 2 (Iron IIA-IIC)',
    startYear: -1000,
    endYear: -586,
    startPage: 115,
    endPage: 192
  },
  {
    id: '3.7',
    name: 'Classical_Later',
    hebrewTitle: 'התפתחות מפעלי המים לקראת התקופות הקלאסיות (פרסית, הלניסטית, רומית, ביזנטית)',
    startYear: -586,
    endYear: 638,
    startPage: 207,
    endPage: 214
  }
];

const SYSTEM_PROMPT = `
You are an expert biblical and archaeological GIS scholar specializing in the archaeology of ancient Israel and the Levant, and ancient water systems (wells, shafts, tunnels, cisterns, springs, pools).
Your task is to analyze text from Dr. Zvika Tzuk's academic dissertation ("Ancient Water Systems in Settlements in Israel from the Neolithic to the Iron Age") for a specific archaeological ERA in Chapter 2.

For EVERY archaeological site and water installation discussed in this era section, extract:
1. "site_name_en": Standard English Name / transliteration (e.g., "Tel Hazor", "Tel Megiddo", "City of David, Jerusalem", "Tel Gezer", "Tel Beersheba", "Gibeon", "Tel Dan", "Khirbet Raddana", "Tel Arad", "Tel Beit Shemesh", "Mezer", "Atlit-Yam", "Kfar Samir", "Ein Huf", "Tel Gerisa", "Jezreel", "Khirbet Bel'ameh", "Tell es-Sa'idiyeh")
2. "site_name_he": Standard Hebrew Name (e.g., "תל חצור", "תל מגידו", "ירושלים (עיר דוד)", "תל גזר", "עתלית ים", "כפר סמיר", "גבעון", "יבלעם")
3. "section_ref": The section number from the text if present (e.g., "2.6.7", "2.9.1", "2.2.1")
4. "region": Geographic region (e.g., "Upper Galilee", "Lower Galilee", "Jezreel Valley", "Coastal Plain", "Shephelah", "Judean Hills", "Samaria", "Negev", "Jordan Valley", "Jordan", "Syria", "Sinai / Egypt", "Mesopotamia", "Urartu", "Greece")
5. "site_type": Classification (e.g., "Tel / Settlement", "Fortress", "Village", "Cave / Spring", "Open-air site")
6. "water_installation_category": ONE of standard categories:
   - "Water_Tunnel_Shaft" (stepped tunnels, shafts reaching groundwater)
   - "Deep_Well" (wells cut in rock/soil)
   - "Plastered_Cistern" (bell-shaped or bottle-shaped cisterns)
   - "Water_Reservoir" (internal/subterranean plastered reservoirs, cruciform reservoirs, open pools/dams)
   - "Spring_Cave_Capture" (spring tunnels, karst cave water captures)
   - "Aqueduct_Channel" (aqueducts, feeder channels, qanats)
   - "Ancient_City_Water_System" (general urban water system)
7. "water_installation_summary": Concise 1-2 sentence description of the specific water facility constructed or used in THIS era at this site.
8. "latitude": Accurate decimal WGS84 latitude (e.g. 33.0175). Provide true coordinates for every site in the Levant/Near East.
9. "longitude": Accurate decimal WGS84 longitude (e.g. 35.5681).
10. "source_pages": Array of page numbers.

Return a JSON array of objects. If no sites are found, return [].
`;

function parsePagesFromDoc(txt) {
  const parts = txt.split(/--- Page (\d+) ---/);
  const pages = new Map();
  for (let i = 1; i < parts.length; i += 2) {
    const pageNum = parseInt(parts[i], 10);
    const text = (parts[i + 1] || '').trim();
    pages.set(pageNum, text);
  }
  return pages;
}

function escapeCsv(val) {
  if (val === null || val === undefined) return '""';
  const str = String(val).replace(/"/g, '""').replace(/\r?\n/g, ' ').trim();
  return `"${str}"`;
}

async function main() {
  console.log('================================================================');
  console.log('Extracting Water Installations by Chapter 2 Chronological Eras');
  console.log('================================================================\n');

  const localTxt = join(process.cwd(), '.ocr_tmp', 'document_extracted.txt');
  const textContent = readFileSync(localTxt, 'utf-8');
  const pageMap = parsePagesFromDoc(textContent);
  console.log(`Loaded ${pageMap.size} document pages.`);

  const allEraRecords = [];

  for (const era of CHAPTER_2_ERAS) {
    console.log(`\n------------------------------------------------------------`);
    console.log(`Processing Section ${era.id}: ${era.hebrewTitle} (${era.name})`);
    console.log(`Chronology: ${era.startYear} to ${era.endYear} | Pages: ${era.startPage} - ${era.endPage}`);
    console.log(`------------------------------------------------------------`);

    // For large sections (like 2.9 which is 77 pages), split into 10-12 page chunks
    const eraPages = [];
    for (let p = era.startPage; p <= era.endPage; p++) {
      if (pageMap.has(p)) {
        eraPages.push({ pageNum: p, text: pageMap.get(p) });
      }
    }

    const CHUNK_SIZE = 12;
    for (let i = 0; i < eraPages.length; i += CHUNK_SIZE) {
      const chunk = eraPages.slice(i, i + CHUNK_SIZE);
      const chunkStartPage = chunk[0].pageNum;
      const chunkEndPage = chunk[chunk.length - 1].pageNum;

      const chunkText = chunk.map(p => `[PAGE ${p.pageNum}]\n${p.text}`).join('\n\n');
      console.log(` -> Parsing Pages ${chunkStartPage} - ${chunkEndPage} for Era: ${era.name}...`);

      const prompt = `Section: ${era.id} - ${era.hebrewTitle} (${era.name})
Period Date Range: ${era.startYear} to ${era.endYear}
Text from Pages ${chunkStartPage} to ${chunkEndPage}:

${chunkText}`;

      try {
        const sites = await callGemini(prompt, SYSTEM_PROMPT);
        if (Array.isArray(sites)) {
          console.log(`    Extracted ${sites.length} site installations for ${era.name}.`);
          for (const s of sites) {
            if (!s.site_name_en && !s.site_name_he) continue;

            allEraRecords.push({
              era_id: era.id,
              era_name: era.name,
              start_year: era.startYear,
              end_year: era.endYear,
              location_name: (s.site_name_en || s.site_name_he).trim().replace(/\s+/g, ' '),
              site_name_he: s.site_name_he || '',
              latitude: typeof s.latitude === 'number' && !isNaN(s.latitude) ? s.latitude : null,
              longitude: typeof s.longitude === 'number' && !isNaN(s.longitude) ? s.longitude : null,
              region: s.region || '',
              site_type: s.site_type || '',
              title: s.water_installation_category || 'Water_Installation',
              description: s.water_installation_summary || '',
              section_ref: s.section_ref || era.id,
              source_pages: s.source_pages || [chunkStartPage]
            });
          }
        }
      } catch (err) {
        console.error(`Error in ${era.name} (Pages ${chunkStartPage}-${chunkEndPage}):`, err.message);
      }

      await new Promise(r => setTimeout(r, 500));
    }
  }

  console.log(`\n======================================================`);
  console.log(`Total Era-Specific Site Records Extracted: ${allEraRecords.length}`);
  console.log(`======================================================\n`);

  // Build CSV rows
  const csvRows = [];
  const geoJsonFeatures = [];

  for (const record of allEraRecords) {
    if (!record.latitude || !record.longitude) continue;

    // Compose rich description
    const descParts = [];
    if (record.description) {
      descParts.push(record.description);
    }
    if (record.site_name_he) {
      descParts.push(`Hebrew: ${record.site_name_he}`);
    }
    if (record.region) {
      descParts.push(`Region: ${record.region}`);
    }
    descParts.push(`Era: ${record.era_name.replace(/_/g, ' ')} (${record.start_year} to ${record.end_year})`);
    if (record.section_ref) {
      descParts.push(`Chapter Section: ${record.section_ref}`);
    }
    if (record.source_pages && record.source_pages.length > 0) {
      descParts.push(`Pages: ${record.source_pages.join(', ')}`);
    }

    const fullDescription = descParts.join(' | ');

    csvRows.push([
      escapeCsv(record.location_name),
      record.latitude,
      record.longitude,
      record.start_year,
      record.end_year,
      escapeCsv(record.title),
      escapeCsv(fullDescription)
    ].join(','));

    geoJsonFeatures.push({
      type: 'Feature',
      geometry: {
        type: 'Point',
        coordinates: [record.longitude, record.latitude]
      },
      properties: {
        'location name': record.location_name,
        'location_name_he': record.site_name_he,
        latitude: record.latitude,
        longitude: record.longitude,
        'start year': record.start_year,
        'end time': record.end_year,
        title: record.title,
        description: fullDescription,
        era: record.era_name,
        region: record.region,
        section_ref: record.section_ref,
        source_pages: record.source_pages
      }
    });
  }

  const csvHeader = 'location name,latitude,longitude,start year,end time,title,description';
  const fullCsvContent = [csvHeader, ...csvRows].join('\n');

  const outCsvPath = join(process.cwd(), 'data', 'water_installations.csv');
  const outGeoJsonPath = join(process.cwd(), 'data', 'water_installations.geojson');

  writeFileSync(outCsvPath, fullCsvContent, 'utf-8');
  console.log(`Wrote refined GeoTrends CSV: ${outCsvPath} (${csvRows.length} chronological period records)`);

  const geoJsonData = {
    type: 'FeatureCollection',
    features: geoJsonFeatures
  };
  writeFileSync(outGeoJsonPath, JSON.stringify(geoJsonData, null, 2), 'utf-8');
  console.log(`Wrote refined GeoTrends GeoJSON: ${outGeoJsonPath} (${geoJsonFeatures.length} features)`);

  // Upload to GCS
  console.log(`\nUploading refined datasets to ${OUTPUT_PREFIX}...`);
  execSync(`gcloud storage cp "${outCsvPath}" "${OUTPUT_PREFIX}water_installations.csv"`, { stdio: 'inherit' });
  execSync(`gcloud storage cp "${outGeoJsonPath}" "${OUTPUT_PREFIX}water_installations.geojson"`, { stdio: 'inherit' });

  console.log('\nEra-based dataset generation completed successfully!');
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
