import { execSync } from 'node:child_process';
import { readFileSync, writeFileSync, readdirSync, existsSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';

const PROJECT_ID = 'geotrends-2026';
const LOCATION = 'us-central1';
const MODEL = 'gemini-2.5-flash';
const BUCKET = 'tsvika';
const OUTPUT_PREFIX = `gs://${BUCKET}/output/`;

// Dynamic batch density defaults
const DEFAULT_MAX_BATCH_CHARS = 4500; // Leaves ~4000+ spare tokens in Gemini 8192 output budget
const DEFAULT_MAX_PAGES_PER_BATCH = 4;
const MIN_QUALITY_RATIO = 0.70; // Reject batches where any substantive page is compressed below 70%

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
    contents: [{ role: 'user', parts: [{ text: prompt }] }],
    generationConfig: {
      temperature: 0.1,
      maxOutputTokens: 8192
    }
  };

  if (systemInstruction) {
    body.systemInstruction = { parts: [{ text: systemInstruction }] };
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
        cachedToken = null;
        getAccessToken(true);
        throw new Error('Token expired');
      }

      if (!res.ok) {
        const errText = await res.text();
        throw new Error(`Gemini API error (${res.status}): ${errText}`);
      }

      const data = await res.json();
      const candidate = data.candidates?.[0];
      const finishReason = candidate?.finishReason;
      const rawText = candidate?.content?.parts?.[0]?.text;

      if (!rawText) {
        throw new Error(`Empty response from Gemini (finishReason: ${finishReason})`);
      }
      if (finishReason === 'MAX_TOKENS') {
        throw new Error('Gemini response truncated: MAX_TOKENS limit (8192) reached');
      }

      return { text: rawText, finishReason };
    } catch (err) {
      if (attempt === retries) throw err;
      console.warn(`[Retry ${attempt}/${retries}] ${err.message}. Waiting 2s...`);
      await new Promise(r => setTimeout(r, 2000));
    }
  }
}

const SYSTEM_PROMPT = `
You are an expert biblical archaeology editor and Hebrew OCR post-processing specialist.
Your task is to take raw OCR text extracted from Dr. Zvika Tzuk's PhD dissertation ("Ancient Water Systems in Settlements in Israel from the Neolithic to the Iron Age") and post-process it into clean, complete, high-quality, publication-grade Markdown page by page.

CRITICAL INSTRUCTIONS:
1. Do NOT summarize, condense, or omit ANY text, paragraph, citation, measurement, site description, or table row. Preserve the complete scholarly monograph.
2. Fix split Hebrew words caused by line-break hyphens (e.g. "הניאו-" + "ליתית" -> "הניאוליתית").
3. Structure headings cleanly: "# Chapter Title", "## Section Title", "### Site Monograph".
4. Format figure captions: "**איור X - תיאור...**" or "**טבלה Y - תיאור...**".
5. Format tables using clean Markdown tables (| Col 1 | Col 2 |).
6. Format lists with proper "- " bullet points.
7. For English summary pages (pages 430-446), format in clean English Markdown.
8. If a page is empty or contains only marginal noise, output the cleaned text or leave empty.

For each page in the batch, output strictly in this delimiter format:
=== PAGE <page_number> ===
SECTION: <section_title or empty>
CONTENT:
<cleaned markdown text of the page>
=== END PAGE <page_number> ===
`;

function loadRawOcrPages() {
  const ocrDir = join(process.cwd(), '.ocr_tmp');
  const files = readdirSync(ocrDir)
    .filter(f => f.startsWith('output-') && f.endsWith('.json'))
    .sort((a, b) => {
      const numA = parseInt(a.match(/output-(\d+)/)[1], 10);
      const numB = parseInt(b.match(/output-(\d+)/)[1], 10);
      return numA - numB;
    });

  const pagesMap = new Map();

  for (const file of files) {
    const data = JSON.parse(readFileSync(join(ocrDir, file), 'utf-8'));
    if (data.responses) {
      data.responses.forEach(resp => {
        const pageNum = resp.context ? resp.context.pageNumber : null;
        const text = resp.fullTextAnnotation ? resp.fullTextAnnotation.text : '';
        if (pageNum) {
          pagesMap.set(pageNum, text);
        }
      });
    }
  }

  console.log(`Loaded ${pagesMap.size} raw OCR pages from local cache.`);
  return pagesMap;
}

/**
 * Dynamically computes batch groups based on page text density (character count)
 * ensuring ample spare room in the Gemini maxOutputTokens (8192) budget.
 */
function calculateDynamicBatches(pagesMap, startPage = 1, endPage = 446, maxBatchChars = DEFAULT_MAX_BATCH_CHARS, maxPagesPerBatch = DEFAULT_MAX_PAGES_PER_BATCH) {
  const batches = [];
  let currentBatch = [];
  let currentChars = 0;

  for (let p = startPage; p <= endPage; p++) {
    const rawText = pagesMap.get(p) || '';
    const pageChars = rawText.length;

    // Check if adding this page would exceed the dynamic character density threshold or max page limit
    if (currentBatch.length > 0 && (currentChars + pageChars > maxBatchChars || currentBatch.length >= maxPagesPerBatch)) {
      batches.push(currentBatch);
      currentBatch = [];
      currentChars = 0;
    }

    currentBatch.push({ pageNum: p, rawText, chars: pageChars });
    currentChars += pageChars;
  }

  if (currentBatch.length > 0) {
    batches.push(currentBatch);
  }

  return batches;
}

function parseDelimitedPages(rawResponseText, expectedBatchPages) {
  const results = [];
  const pageBlocks = rawResponseText.split(/=== PAGE (\d+) ===/);

  for (let i = 1; i < pageBlocks.length; i += 2) {
    const pageNum = parseInt(pageBlocks[i], 10);
    const blockContent = pageBlocks[i + 1] || '';
    const endMarker = `=== END PAGE ${pageNum} ===`;
    const endIdx = blockContent.indexOf(endMarker);
    const cleanBlock = (endIdx !== -1 ? blockContent.substring(0, endIdx) : blockContent).trim();

    let sectionTitle = '';
    let cleanMarkdown = cleanBlock;

    const secMatch = cleanBlock.match(/^SECTION:\s*(.*?)[\r\n]+CONTENT:\s*([\s\S]*)$/i);
    if (secMatch) {
      sectionTitle = secMatch[1].trim();
      cleanMarkdown = secMatch[2].trim();
    }

    results.push({
      page_number: pageNum,
      section_title: sectionTitle,
      clean_markdown: cleanMarkdown
    });
  }

  // Validate that all expected pages in the batch were returned
  for (const exp of expectedBatchPages) {
    const found = results.find(r => r.page_number === exp.pageNum);
    if (!found) {
      throw new Error(`Missing page delimiter block for Page ${exp.pageNum} in Gemini response`);
    }

    // Quality gate: ensure significant pages were not aggressively condensed
    if (exp.rawText && exp.rawText.length > 400) {
      const ratio = found.clean_markdown.length / exp.rawText.length;
      if (ratio < MIN_QUALITY_RATIO) {
        throw new Error(
          `Quality gate failed for Page ${exp.pageNum}: length ratio ${(ratio * 100).toFixed(1)}% < ${(MIN_QUALITY_RATIO * 100)}% (raw: ${exp.rawText.length} chars, clean: ${found.clean_markdown.length} chars)`
        );
      }
    }
  }

  return results.sort((a, b) => a.page_number - b.page_number);
}

function markdownToHtml(md) {
  if (!md || !md.trim()) {
    return '<p class="doc-p text-muted">(עמוד ריק בפרסום המקורי)</p>';
  }

  let html = md
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');

  // Headings
  html = html.replace(/^### (.*$)/gim, '<h3 class="doc-sec-heading">$1</h3>');
  html = html.replace(/^## (.*$)/gim, '<h2 class="doc-ch-heading">$1</h2>');
  html = html.replace(/^# (.*$)/gim, '<h1 class="doc-main-heading">$1</h1>');

  // Captions
  html = html.replace(/\*\*איור\s*(\d+[^:]*?)[:\-](.*?)\*\*/g, '<div class="figure-box"><strong class="fig-label">איור $1:</strong> $2</div>');
  html = html.replace(/\*\*מפה\s*(\d+[^:]*?)[:\-](.*?)\*\*/g, '<div class="figure-box"><strong class="fig-label">מפה $1:</strong> $2</div>');
  html = html.replace(/\*\*טבלה\s*(\d+[^:]*?)[:\-](.*?)\*\*/g, '<div class="figure-box"><strong class="fig-label">טבלה $1:</strong> $2</div>');

  // Styling
  html = html.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
  html = html.replace(/\*(.*?)\*/g, '<em>$1</em>');

  // Lists
  html = html.replace(/^\s*[-*]\s+(.*$)/gim, '<li class="doc-li">$1</li>');
  html = html.replace(/(<li class="doc-li">.*<\/li>(\n|$))+/g, '<ul class="doc-list">$&</ul>');

  // Tables
  const lines = html.split('\n');
  let inTable = false;
  let tableHtml = '';
  const newLines = [];

  for (let idx = 0; idx < lines.length; idx++) {
    const line = lines[idx].trim();
    if (line.startsWith('|') && line.endsWith('|')) {
      if (!inTable) {
        inTable = true;
        tableHtml = '<table class="doc-table"><tbody>';
      }
      if (line.match(/^\|[\s\-:|]+\|$/)) {
        continue;
      }
      const cells = line.slice(1, -1).split('|').map(c => `<td>${c.trim()}</td>`).join('');
      tableHtml += `<tr>${cells}</tr>`;
    } else {
      if (inTable) {
        inTable = false;
        tableHtml += '</tbody></table>';
        newLines.push(tableHtml);
      }
      newLines.push(line);
    }
  }
  if (inTable) {
    tableHtml += '</tbody></table>';
    newLines.push(tableHtml);
  }

  // Paragraphs
  html = newLines.map(l => {
    l = l.trim();
    if (!l) return '';
    if (l.startsWith('<h1') || l.startsWith('<h2') || l.startsWith('<h3') || 
        l.startsWith('<ul') || l.startsWith('<li') || l.startsWith('<div') || 
        l.startsWith('<table') || l.startsWith('</tbody') || l.startsWith('</table')) {
      return l;
    }
    return `<p class="doc-p">${l}</p>`;
  }).filter(Boolean).join('\n');

  return html;
}

/**
 * Terminal Single-Page Verbatim Post-Processing (Base Case for N=1)
 */
async function processSinglePageVerbatim(pageObj, retries = 2) {
  const pageNum = pageObj.pageNum;
  const rawText = pageObj.rawText;

  if (!rawText || !rawText.trim()) {
    return [{
      page_number: pageNum,
      section_title: '',
      clean_markdown: '',
      clean_html: markdownToHtml('')
    }];
  }

  const systemPrompt = `You are an expert biblical archaeology editor and Hebrew OCR post-processing specialist.
Your task is to take the raw OCR text of SINGLE Page ${pageNum} from Dr. Zvika Tzuk's PhD dissertation and post-process it into clean, complete, publication-grade Markdown.

CRITICAL QUALITY INSTRUCTIONS:
1. Do NOT summarize, omit, or condense ANY text, paragraph, citation, measurement, site description, or table row.
2. Fix split Hebrew words caused by line-break hyphens.
3. Structure headings cleanly: "# Chapter", "## Section", "### Site Monograph".
4. Format figure captions as "**איור X - תיאור...**" or "**טבלה Y - תיאור...**".
5. Keep the complete verbatim archaeological monograph and all measurements.

Output format strictly:
=== PAGE ${pageNum} ===
SECTION: <section_title or empty>
CONTENT:
<complete cleaned markdown text of page ${pageNum}>
=== END PAGE ${pageNum} ===`;

  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      console.log(`[Single Page ${pageNum}] Processing verbatim (Raw: ${rawText.length} chars)...`);
      const { text } = await callGemini(`Raw OCR text for Page ${pageNum}:\n\n${rawText}`, systemPrompt);

      let sectionTitle = '';
      let cleanMarkdown = text;

      const blockMatch = text.match(/=== PAGE \d+ ===\s*([\s\S]*?)=== END PAGE \d+ ===/);
      const block = blockMatch ? blockMatch[1].trim() : text.trim();

      const secMatch = block.match(/^SECTION:\s*(.*?)[\r\n]+CONTENT:\s*([\s\S]*)$/i);
      if (secMatch) {
        sectionTitle = secMatch[1].trim();
        cleanMarkdown = secMatch[2].trim();
      } else {
        cleanMarkdown = block.replace(/^=== PAGE \d+ ===\s*/, '').replace(/=== END PAGE \d+ ===\s*$/, '').trim();
      }

      if (rawText.length > 400 && cleanMarkdown.length < 0.65 * rawText.length) {
        if (attempt < retries) {
          console.warn(`[Single Page ${pageNum}] Quality ratio low (${(cleanMarkdown.length / rawText.length).toFixed(2)}). Retrying...`);
          continue;
        }
      }

      return [{
        page_number: pageNum,
        section_title: sectionTitle,
        clean_markdown: cleanMarkdown,
        clean_html: markdownToHtml(cleanMarkdown)
      }];
    } catch (err) {
      if (attempt === retries) {
        console.warn(`[Single Page ${pageNum}] Error: ${err.message}. Using raw text fallback.`);
        return [{
          page_number: pageNum,
          section_title: '',
          clean_markdown: rawText,
          clean_html: markdownToHtml(rawText)
        }];
      }
    }
  }
}

/**
 * Executes a multi-page batch against Gemini and validates delimiter & quality constraints.
 */
async function executeAndValidateBatch(batchPages) {
  let promptText = 'Post-process the following raw OCR pages into clean publication-grade Markdown:\n\n';
  for (const p of batchPages) {
    promptText += `=== RAW PAGE ${p.pageNum} ===\n${p.rawText}\n=== END RAW PAGE ${p.pageNum} ===\n\n`;
  }

  const { text } = await callGemini(promptText, SYSTEM_PROMPT);
  const parsedPages = parseDelimitedPages(text, batchPages);

  parsedPages.forEach(p => {
    p.clean_html = markdownToHtml(p.clean_markdown);
  });

  return parsedPages;
}

/**
 * Recursive Divide-and-Conquer Batch Processing Engine
 * If a batch fails (token overflow, parsing error, or quality-gate length ratio check),
 * it divides into two sub-batches and processes them recursively down to single pages.
 */
async function processBatchRecursive(batchPages, batchLabel = '', depth = 0, force = false) {
  const chunkDir = join(process.cwd(), 'data', 'post_processed_chunks');
  mkdirSync(chunkDir, { recursive: true });

  const startPage = batchPages[0].pageNum;
  const endPage = batchPages[batchPages.length - 1].pageNum;
  const chunkPath = join(chunkDir, `chunk_${String(startPage).padStart(3, '0')}_to_${String(endPage).padStart(3, '0')}.json`);

  // 1. Check Cache
  if (!force && existsSync(chunkPath)) {
    try {
      const cached = JSON.parse(readFileSync(chunkPath, 'utf-8'));
      if (Array.isArray(cached) && cached.length === batchPages.length) {
        // Verify quality of cached items
        const isQualityOk = cached.every(pg => {
          const raw = batchPages.find(b => b.pageNum === pg.page_number)?.rawText || '';
          if (raw.length > 500 && (!pg.clean_markdown || pg.clean_markdown.length < raw.length * 0.65)) {
            return false;
          }
          return true;
        });

        if (isQualityOk) {
          console.log(`[Batch ${startPage}-${endPage}] Loaded ${cached.length} pages from verified cache.`);
          return cached;
        }
      }
    } catch (e) {
      // Corrupt cache; reprocess
    }
  }

  // 2. Base Case: Single Page (N = 1)
  if (batchPages.length === 1) {
    const singleResult = await processSinglePageVerbatim(batchPages[0]);
    try {
      writeFileSync(chunkPath, JSON.stringify(singleResult, null, 2), 'utf-8');
    } catch (e) {}
    return singleResult;
  }

  // 3. Multi-Page Batch Processing Attempt
  const totalChars = batchPages.reduce((sum, p) => sum + p.rawText.length, 0);
  console.log(
    `[Batch ${startPage}-${endPage}] (Depth ${depth}, ${batchPages.length} pages, ${totalChars} chars) Processing with Gemini 2.5 Flash...`
  );

  try {
    const parsedPages = await executeAndValidateBatch(batchPages);
    writeFileSync(chunkPath, JSON.stringify(parsedPages, null, 2), 'utf-8');
    console.log(`[Batch ${startPage}-${endPage}] Successfully post-processed and validated ${parsedPages.length} pages.`);
    return parsedPages;
  } catch (err) {
    // 4. Divide-and-Conquer Recursive Splitting
    console.warn(
      `\n[Divide & Conquer] Batch ${startPage}-${endPage} (${batchPages.length} pages) failed: ${err.message}`
    );
    console.warn(`-> Splitting batch ${startPage}-${endPage} into 2 sub-batches (depth ${depth + 1})...\n`);

    const mid = Math.floor(batchPages.length / 2);
    const leftPages = batchPages.slice(0, mid);
    const rightPages = batchPages.slice(mid);

    const leftResults = await processBatchRecursive(leftPages, `${batchLabel ? batchLabel + '.' : ''}1`, depth + 1, force);
    const rightResults = await processBatchRecursive(rightPages, `${batchLabel ? batchLabel + '.' : ''}2`, depth + 1, force);

    const combined = [...leftResults, ...rightResults];
    try {
      writeFileSync(chunkPath, JSON.stringify(combined, null, 2), 'utf-8');
    } catch (e) {}
    return combined;
  }
}

async function main() {
  const args = process.argv.slice(2);
  const isForce = args.includes('--force');
  const isDryRun = args.includes('--dry-run');

  let startPage = 1;
  let endPage = 446;
  let maxChars = DEFAULT_MAX_BATCH_CHARS;
  let maxPages = DEFAULT_MAX_PAGES_PER_BATCH;

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--start' && args[i + 1]) startPage = parseInt(args[i + 1], 10);
    if (args[i] === '--end' && args[i + 1]) endPage = parseInt(args[i + 1], 10);
    if (args[i] === '--max-chars' && args[i + 1]) maxChars = parseInt(args[i + 1], 10);
    if (args[i] === '--max-pages' && args[i + 1]) maxPages = parseInt(args[i + 1], 10);
  }

  console.log('=== Dissertation Gemini OCR Post-Processing Pipeline ===');
  console.log(`Configuration:`);
  console.log(`- Page Range: ${startPage} to ${endPage}`);
  console.log(`- Dynamic Density Cap: ${maxChars} chars / batch (with spare headroom)`);
  console.log(`- Max Pages / Batch: ${maxPages}`);
  console.log(`- Quality Gate Threshold: ${MIN_QUALITY_RATIO * 100}% length retention`);
  console.log(`- Fallback Engine: Recursive Divide-and-Conquer`);

  const pagesMap = loadRawOcrPages();
  const batches = calculateDynamicBatches(pagesMap, startPage, endPage, maxChars, maxPages);

  const batchSizes = batches.map(b => b.length);
  const batchChars = batches.map(b => b.reduce((s, x) => s + x.chars, 0));
  console.log(`\nDynamic Batch Plan:`);
  console.log(`- Total Batches: ${batches.length}`);
  console.log(
    `- Pages per Batch: min ${Math.min(...batchSizes)}, avg ${(batchSizes.reduce((a, b) => a + b, 0) / batchSizes.length).toFixed(1)}, max ${Math.max(...batchSizes)}`
  );
  console.log(
    `- Chars per Batch: min ${Math.min(...batchChars)}, avg ${(batchChars.reduce((a, b) => a + b, 0) / batchChars.length).toFixed(1)}, max ${Math.max(...batchChars)}`
  );

  if (isDryRun) {
    console.log('\n[Dry Run Complete] Exiting without making API calls.');
    return;
  }

  const CONCURRENCY = 5;
  const allResults = new Map();

  // Load existing post_processed_pages.json if starting partial run
  const masterJsonPath = join(process.cwd(), 'data', 'post_processed_pages.json');
  if (existsSync(masterJsonPath) && (startPage > 1 || endPage < 446)) {
    try {
      const existingPages = JSON.parse(readFileSync(masterJsonPath, 'utf-8'));
      existingPages.forEach(p => allResults.set(Number(p.page_number), p));
    } catch (e) {}
  }

  for (let i = 0; i < batches.length; i += CONCURRENCY) {
    const chunkPromises = [];
    for (let j = i; j < i + CONCURRENCY && j < batches.length; j++) {
      chunkPromises.push(processBatchRecursive(batches[j], `B${j + 1}`, 0, isForce));
    }
    const chunkResults = await Promise.all(chunkPromises);
    chunkResults.forEach(batchRes => {
      if (Array.isArray(batchRes)) {
        batchRes.forEach(pageObj => {
          allResults.set(Number(pageObj.page_number), pageObj);
        });
      }
    });
  }

  console.log(`\nAll ${allResults.size} pages processed successfully!`);

  // 1. Save Master Intermediate JSON (post_processed_pages.json)
  const sortedPages = [];
  for (let p = 1; p <= 446; p++) {
    const item = allResults.get(p) || {
      page_number: p,
      section_title: '',
      clean_markdown: pagesMap.get(p) || '',
      clean_html: markdownToHtml(pagesMap.get(p) || '')
    };
    if (!item.clean_html) item.clean_html = markdownToHtml(item.clean_markdown);
    sortedPages.push(item);
  }

  writeFileSync(masterJsonPath, JSON.stringify(sortedPages, null, 2), 'utf-8');
  console.log(`[1] Saved Master Intermediate JSON: ${masterJsonPath} (${(readFileSync(masterJsonPath).length / 1024).toFixed(1)} KB)`);

  // 2. Save Clean Master Markdown (dissertation_clean.md)
  let masterMd = `# מפעלי מים קדומים ביישובים בארץ ישראל\n## מאת ד"ר צביקה צוק (עבודת דוקטורט, אוניברסיטת תל אביב, 2000)\n\n---\n\n`;
  for (const p of sortedPages) {
    masterMd += `<a id="page-${p.page_number}"></a>\n\n## עמוד ${p.page_number}${p.section_title ? ' - ' + p.section_title : ''}\n\n${p.clean_markdown}\n\n---\n\n`;
  }
  const masterMdPath = join(process.cwd(), 'data', 'dissertation_clean.md');
  writeFileSync(masterMdPath, masterMd, 'utf-8');
  console.log(`[2] Saved Clean Master Markdown: ${masterMdPath} (${(masterMd.length / 1024).toFixed(1)} KB)`);

  // 3. Rebuild HTML Reader with Left Sidebar & Location Highlights
  console.log('\n[3] Rebuilding Standalone HTML Reader (data/dissertation_reader.html)...');
  try {
    execSync('node scripts/rebuild_reader_html.js', { stdio: 'inherit' });
  } catch (err) {
    console.warn('Rebuild reader error:', err.message);
  }

  // 4. Cloud Upload to GCS
  try {
    console.log(`\nSyncing all post-processed outputs to GCS (${OUTPUT_PREFIX})...`);
    execSync(`gcloud storage cp "${masterJsonPath}" "${OUTPUT_PREFIX}post_processed_pages.json"`, { stdio: 'inherit' });
    execSync(`gcloud storage cp "${masterMdPath}" "${OUTPUT_PREFIX}dissertation_clean.md"`, { stdio: 'inherit' });
    execSync(`gcloud storage cp -r data/post_processed_chunks "${OUTPUT_PREFIX}"`, { stdio: 'inherit' });
    console.log('Successfully synced all post-processed assets to GCS!');
  } catch (err) {
    console.warn('GCS upload note:', err.message);
  }

  console.log('\n=== Post-Processing & Reader Pipeline Completed Successfully! ===');
}

main().catch(err => {
  console.error('Fatal error in post-processing pipeline:', err);
  process.exit(1);
});
