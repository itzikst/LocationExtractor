import { execSync } from 'node:child_process';
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';

const PROJECT_ID = 'geotrends-2026';
const LOCATION = 'us-central1';
const MODEL = 'gemini-2.5-flash';

const RAW_DIR = join(process.cwd(), 'data', 'locations_raw');
if (!existsSync(RAW_DIR)) {
  mkdirSync(RAW_DIR, { recursive: true });
}

let cachedToken = null;
let tokenExpiry = 0;

function getAccessToken(force = false) {
  const now = Date.now();
  if (!force && cachedToken && now < tokenExpiry) {
    return cachedToken;
  }
  console.log('Refreshing Google Cloud OAuth access token...');
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
        console.warn('Access token expired (401). Retrying with fresh token...');
        cachedToken = null;
        getAccessToken(true);
        throw new Error('Token expired, retrying');
      }

      if (!res.ok) {
        const errText = await res.text();
        throw new Error(`Gemini API error (${res.status}): ${errText}`);
      }

      const json = await res.json();
      const text = json.candidates?.[0]?.content?.parts?.[0]?.text;
      if (!text) {
        throw new Error('No candidate content returned by Gemini');
      }

      return JSON.parse(text);
    } catch (err) {
      console.warn(`Attempt ${attempt}/${retries} failed: ${err.message}`);
      if (attempt === retries) throw err;
      await new Promise(r => setTimeout(r, 2000 * attempt));
    }
  }
}

const SYSTEM_INSTRUCTION = `You are a world-class archaeological entity extractor specializing in Levantine archaeology, historical geography, and ancient water systems in Dr. Zvika Tzuk's PhD dissertation.
Your task is to analyze the provided Hebrew pages from the dissertation and extract ALL locations, archaeological sites, water installations, geographical regions, and comparative international sites mentioned on each page.

For each entity mentioned on a page, return a JSON object with:
- "canonical_hebrew": Standardized primary Hebrew name (e.g. "תל מגידו", "עתלית ים", "תל חצור", "בריכת גבעון", "בקעת עובדה", "מערת נחל קנה").
- "canonical_english": Standardized primary English / Romanized name (e.g. "Tel Megiddo", "Atlit-Yam", "Tel Hazor", "Gibeon Pool", "Uvda Valley", "Nahal Qanah Cave").
- "hebrew_aliases": Array of alternative Hebrew names or historical/Arabic variants mentioned in the text (e.g. ["מגידו", "תל אל-מותסלם"], ["עתלית"]).
- "english_aliases": Array of alternative English / Romanized names (e.g. ["Megiddo", "Tell el-Mutesellim", "Armageddon"]).
- "site_type": Classification of the location: "Tell", "Cave", "Installation", "Well", "Spring", "Pool", "Cistern System", "Aqueduct", "Tunnel", "Fortress", "Settlement", "Region", "Valley", "Mountain", "Comparative Site", or "Other".
- "page_number": The exact page number integer where this mention appears.
- "context_summary": A short snippet (1-2 sentences in Hebrew or English) of what is described about this site on this page.

Rules:
1. Extract ALL ancient and historical locations (e.g., Tel Megiddo, Tel Gezer, Tel Dan, Jerusalem, Jericho, Arad, Hazor, Lachish, Bet Shean, Jawa, Ebla, Mycenae, etc.).
2. Extract specific water installations that are named locations (e.g., Siloam Tunnel / נקבת השילוח, Gibeon Pool / בריכת גבעון, Biyarat Abu Nabut / ביארת אבו נאבוט).
3. Extract geographical regions, valleys, and rivers when discussed as archaeological/hydrological locations (e.g., הר מנשה, בקעת באר שבע, הר הנגב, נחל הירקון).
4. Do NOT extract non-geographical personal names or modern institutions (e.g. Tel Aviv University, Israel Antiquities Authority as an organization).
5. Output format must be a valid JSON array of objects.`;

async function main() {
  console.log('=== Step 2: Extracting Locations with Gemini 2.5 Flash ===');
  
  const pagesPath = join(process.cwd(), 'data', 'post_processed_pages.json');
  const pages = JSON.parse(readFileSync(pagesPath, 'utf8'));
  console.log(`Loaded ${pages.length} pages from ${pagesPath}`);

  const CHUNK_SIZE = 10;
  const chunks = [];
  for (let i = 0; i < pages.length; i += CHUNK_SIZE) {
    chunks.push(pages.slice(i, i + CHUNK_SIZE));
  }
  console.log(`Split into ${chunks.length} processing chunks (10 pages each).`);

  const CONCURRENCY = 4;
  for (let i = 0; i < chunks.length; i += CONCURRENCY) {
    const batch = chunks.slice(i, i + CONCURRENCY);
    await Promise.all(batch.map(async (chunk, bIdx) => {
      const chunkIdx = i + bIdx;
      const startPage = chunk[0].page_number;
      const endPage = chunk[chunk.length - 1].page_number;
      const padStart = String(startPage).padStart(3, '0');
      const padEnd = String(endPage).padStart(3, '0');
      const chunkFile = join(RAW_DIR, `chunk_${padStart}_to_${padEnd}.json`);

      if (existsSync(chunkFile)) {
        console.log(`[Chunk ${chunkIdx + 1}/${chunks.length}] Pages ${startPage}-${endPage} already cached. Skipping.`);
        return;
      }

      console.log(`[Chunk ${chunkIdx + 1}/${chunks.length}] Processing pages ${startPage}-${endPage}...`);

      const pagesText = chunk.map(p => `--- PAGE ${p.page_number} ---\n${p.clean_markdown || p.clean_html || ''}`).join('\n\n');
      const prompt = `Extract all archaeological, geographical, and water installation locations from the following pages:\n\n${pagesText}`;

      try {
        const extracted = await callGemini(prompt, SYSTEM_INSTRUCTION);
        const validList = Array.isArray(extracted) ? extracted : (extracted.locations || extracted.sites || []);
        writeFileSync(chunkFile, JSON.stringify(validList, null, 2), 'utf8');
        console.log(`[Chunk ${chunkIdx + 1}/${chunks.length}] Extracted ${validList.length} location mentions for pages ${startPage}-${endPage}.`);
      } catch (err) {
        console.error(`Error processing chunk ${startPage}-${endPage}:`, err.message);
      }
    }));
  }

  console.log('Gemini location extraction completed for all chunks.');
}

main().catch(err => {
  console.error('Fatal error in Gemini extraction script:', err);
  process.exit(1);
});
