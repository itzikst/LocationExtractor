import { execSync } from 'node:child_process';
import { readFileSync, writeFileSync, readdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';

const PROJECT_ID = 'geotrends-2026';
const LOCATION = 'us-central1';
const MODEL = 'gemini-2.5-flash';
const OUTPUT_PREFIX = 'gs://tsvika/output/';

let cachedToken = null;
function getAccessToken() {
  if (!cachedToken) {
    cachedToken = execSync('gcloud auth print-access-token', { encoding: 'utf-8' }).trim();
  }
  return cachedToken;
}

async function callGeminiSinglePage(pageNum, rawText) {
  const endpoint = `https://${LOCATION}-aiplatform.googleapis.com/v1/projects/${PROJECT_ID}/locations/${LOCATION}/publishers/google/models/${MODEL}:generateContent`;

  const systemPrompt = `You are an expert biblical archaeology editor and Hebrew OCR post-processing specialist.
Your task is to take the raw OCR text of SINGLE Page ${pageNum} from Dr. Zvika Tzuk's PhD dissertation and post-process it into clean, complete, publication-grade Markdown.

CRITICAL INSTRUCTIONS:
1. Do NOT summarize or omit ANY text, paragraph, citation, measurement, site description, or table row.
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

  const body = {
    contents: [{ role: 'user', parts: [{ text: `Raw OCR text for Page ${pageNum}:\n\n${rawText}` }] }],
    systemInstruction: { parts: [{ text: systemPrompt }] },
    generationConfig: {
      temperature: 0.1,
      maxOutputTokens: 8192
    }
  };

  const res = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${getAccessToken()}`,
      'Content-Type': 'application/json',
      'X-Goog-User-Project': PROJECT_ID
    },
    body: JSON.stringify(body)
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Gemini error (${res.status}): ${err}`);
  }

  const data = await res.json();
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
  
  // Parse delimiter
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

  return { sectionTitle, cleanMarkdown };
}

function markdownToHtml(md) {
  if (!md || !md.trim()) return '<p class="doc-p text-muted">(עמוד ריק בפרסום המקורי)</p>';
  let html = md.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  html = html.replace(/^### (.*$)/gim, '<h3 class="doc-sec-heading">$1</h3>');
  html = html.replace(/^## (.*$)/gim, '<h2 class="doc-ch-heading">$1</h2>');
  html = html.replace(/^# (.*$)/gim, '<h1 class="doc-main-heading">$1</h1>');
  html = html.replace(/\*\*איור\s*(\d+[^:]*?)[:\-](.*?)\*\*/g, '<div class="figure-box"><strong class="fig-label">איור $1:</strong> $2</div>');
  html = html.replace(/\*\*טבלה\s*(\d+[^:]*?)[:\-](.*?)\*\*/g, '<div class="figure-box"><strong class="fig-label">טבלה $1:</strong> $2</div>');
  html = html.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
  html = html.replace(/\*(.*?)\*/g, '<em>$1</em>');
  html = html.replace(/^\s*[-*]\s+(.*$)/gim, '<li class="doc-li">$1</li>');
  html = html.replace(/(<li class="doc-li">.*<\/li>(\n|$))+/g, '<ul class="doc-list">$&</ul>');
  
  const lines = html.split('\n');
  let inTable = false;
  let tableHtml = '';
  const newLines = [];
  for (let idx = 0; idx < lines.length; idx++) {
    const line = lines[idx].trim();
    if (line.startsWith('|') && line.endsWith('|')) {
      if (!inTable) { inTable = true; tableHtml = '<table class="doc-table"><tbody>'; }
      if (line.match(/^\|[\s\-:|]+\|$/)) continue;
      const cells = line.slice(1, -1).split('|').map(c => `<td>${c.trim()}</td>`).join('');
      tableHtml += `<tr>${cells}</tr>`;
    } else {
      if (inTable) { inTable = false; tableHtml += '</tbody></table>'; newLines.push(tableHtml); }
      newLines.push(line);
    }
  }
  if (inTable) { tableHtml += '</tbody></table>'; newLines.push(tableHtml); }
  
  return newLines.map(l => {
    l = l.trim();
    if (!l) return '';
    if (l.startsWith('<h1') || l.startsWith('<h2') || l.startsWith('<h3') || 
        l.startsWith('<ul') || l.startsWith('<li') || l.startsWith('<div') || 
        l.startsWith('<table') || l.startsWith('</tbody') || l.startsWith('</table')) return l;
    return `<p class="doc-p">${l}</p>`;
  }).filter(Boolean).join('\n');
}

async function main() {
  console.log('=== Reprocessing Clipped Pages with Single-Page Precision ===');
  
  const pagesJsonPath = join(process.cwd(), 'data', 'post_processed_pages.json');
  const pages = JSON.parse(readFileSync(pagesJsonPath, 'utf-8'));
  
  // Load raw OCR
  const ocrDir = join(process.cwd(), '.ocr_tmp');
  const files = readdirSync(ocrDir).filter(f => f.startsWith('output-') && f.endsWith('.json'));
  const ocrMap = new Map();
  for (const file of files) {
    const data = JSON.parse(readFileSync(join(ocrDir, file), 'utf-8'));
    if (data.responses) {
      data.responses.forEach(r => {
        const p = r.context?.pageNumber;
        const t = r.fullTextAnnotation?.text || '';
        if (p) ocrMap.set(p, t);
      });
    }
  }

  // Identify all pages where clean is < 70% of raw text
  const targetPages = [];
  for (let p = 1; p <= 446; p++) {
    const raw = ocrMap.get(p) || '';
    const pg = pages.find(x => x.page_number === p);
    const clean = pg?.clean_markdown || '';
    if (raw.length > 500 && clean.length < raw.length * 0.70) {
      targetPages.push(p);
    }
  }

  console.log(`Identified ${targetPages.length} pages to re-process:`, targetPages);

  for (const pageNum of targetPages) {
    const raw = ocrMap.get(pageNum);
    console.log(`Reprocessing Page ${pageNum} (Raw length: ${raw.length} chars)...`);
    const { sectionTitle, cleanMarkdown } = await callGeminiSinglePage(pageNum, raw);
    
    console.log(` -> Recovered Page ${pageNum}: ${cleanMarkdown.length} chars (ratio: ${(cleanMarkdown.length / raw.length).toFixed(2)})`);
    
    const idx = pages.findIndex(x => x.page_number === pageNum);
    if (idx !== -1) {
      pages[idx].section_title = sectionTitle || pages[idx].section_title;
      pages[idx].clean_markdown = cleanMarkdown;
      pages[idx].clean_html = markdownToHtml(cleanMarkdown);
    }
  }

  // Save updated post_processed_pages.json
  writeFileSync(pagesJsonPath, JSON.stringify(pages, null, 2), 'utf-8');
  console.log(`\nUpdated ${pagesJsonPath}`);

  // Save Clean Master Markdown
  let masterMd = `# מפעלי מים קדומים ביישובים בארץ ישראל\n## מאת ד"ר צביקה צוק (עבודת דוקטורט, אוניברסיטת תל אביב, 2000)\n\n---\n\n`;
  for (const p of pages) {
    masterMd += `<a id="page-${p.page_number}"></a>\n\n## עמוד ${p.page_number}${p.section_title ? ' - ' + p.section_title : ''}\n\n${p.clean_markdown}\n\n---\n\n`;
  }
  const masterMdPath = join(process.cwd(), 'data', 'dissertation_clean.md');
  writeFileSync(masterMdPath, masterMd, 'utf-8');
  console.log(`Updated ${masterMdPath}`);

  // Trigger rebuild of HTML reader
  console.log('Rebuilding dissertation_reader.html...');
  execSync('node scripts/rebuild_reader_html.js', { stdio: 'inherit' });

  // Sync to GCS
  console.log('Syncing all updated assets to GCS...');
  execSync(`gcloud storage cp "${pagesJsonPath}" "${OUTPUT_PREFIX}post_processed_pages.json"`, { stdio: 'inherit' });
  execSync(`gcloud storage cp "${masterMdPath}" "${OUTPUT_PREFIX}dissertation_clean.md"`, { stdio: 'inherit' });
  console.log('=== Finished Successfully! ===');
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
