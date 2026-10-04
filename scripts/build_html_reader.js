import { readFileSync, writeFileSync, readdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';

// Table of Contents Hierarchy with Page Numbers for Navigation
const TOC_ENTRIES = [
  { level: 1, title: 'שער ומידע ביבליוגרפי', page: 1, id: 'front-matter' },
  { level: 1, title: 'תוכן העניינים', page: 7, id: 'toc' },
  { level: 1, title: 'הקדמה ומבוא', page: 15, id: 'preface' },
  { level: 1, title: 'פרק 1: מבואות כלליים - המים והאקלים', page: 16, id: 'ch1' },
  { level: 2, title: '1.1 האקלים בארץ ישראל כיום ובעבר', page: 17, id: 'ch1-1' },
  { level: 2, title: '1.2 מקורות המים ומתקני המים לסוגיהם', page: 20, id: 'ch1-2' },
  { level: 2, title: '1.3 תולדות המחקר של מפעלי המים', page: 34, id: 'ch1-3' },
  { level: 1, title: 'פרק 2: מפעלי המים לתקופותיהם (הקורפוס המרכזי)', page: 43, id: 'ch2' },
  { level: 2, title: '§2.1 התקופה הפליאוליתית והאפי-פליאוליתית', page: 43, id: 'ch2-1' },
  { level: 2, title: '§2.2 התקופה הניאוליתית הקדם קירמית (PPN)', page: 45, id: 'ch2-2' },
  { level: 3, title: '2.2.1 עתלית ים', page: 45, id: 'ch2-2-1' },
  { level: 3, title: '2.2.2 ח\'רבת ג\'אראסור (עירק)', page: 46, id: 'ch2-2-2' },
  { level: 3, title: '2.2.3 אבן אל-ג\'אזי / עין ע\'זאל (ירדן)', page: 47, id: 'ch2-2-3' },
  { level: 3, title: '2.2.4 גלגל I', page: 48, id: 'ch2-2-4' },
  { level: 3, title: '2.2.5 נתיב הגדוד', page: 48, id: 'ch2-2-5' },
  { level: 3, title: '2.2.6 ביידא (ירדן)', page: 49, id: 'ch2-2-6' },
  { level: 2, title: '§2.3 התקופה הניאוליתית הקירמית (PN)', page: 49, id: 'ch2-3' },
  { level: 3, title: '2.3.1 בארות בחוף הכרמל (כפר סמיר, כפר גלים, מגדים)', page: 49, id: 'ch2-3-1' },
  { level: 3, title: '2.3.2 הצ\'ילר (תורכיה)', page: 50, id: 'ch2-3-2' },
  { level: 3, title: '2.3.3 טפה גאורה (עירק)', page: 50, id: 'ch2-3-3' },
  { level: 2, title: '§2.4 התקופה הכלקוליתית', page: 51, id: 'ch2-4' },
  { level: 3, title: '2.4.1 אבו חוף', page: 51, id: 'ch2-4-1' },
  { level: 3, title: '2.4.2 חורבת בתר', page: 53, id: 'ch2-4-2' },
  { level: 3, title: '2.4.3 טפה גאורה (עירק)', page: 53, id: 'ch2-4-3' },
  { level: 3, title: '2.4.4 רג\'ג\'יל (ערב הסעודית)', page: 54, id: 'ch2-4-4' },
  { level: 2, title: '§2.5 תקופת הברונזה הקדומה (EB I-IV)', page: 55, id: 'ch2-5' },
  { level: 3, title: '2.5.1 בקעת עובדה', page: 56, id: 'ch2-5-1' },
  { level: 3, title: '2.5.2 תל ערד', page: 57, id: 'ch2-5-2' },
  { level: 3, title: '2.5.3 חירבת זירקון (ירדן)', page: 57, id: 'ch2-5-3' },
  { level: 3, title: '2.5.8 תל ירמות', page: 58, id: 'ch2-5-8' },
  { level: 3, title: '2.5.9 העי (א-תל)', page: 60, id: 'ch2-5-9' },
  { level: 3, title: '2.5.15 מצר', page: 68, id: 'ch2-5-15' },
  { level: 2, title: '§2.6 תקופת הברונזה התיכונה (MB I-II)', page: 72, id: 'ch2-6' },
  { level: 3, title: '2.6.3 יריחו (עין א-סולטאן)', page: 75, id: 'ch2-6-3' },
  { level: 3, title: '2.6.4 ירושלים (עיר דוד ומעיין הגיחון)', page: 76, id: 'ch2-6-4' },
  { level: 3, title: '2.6.6 תל גריסה', page: 78, id: 'ch2-6-6' },
  { level: 3, title: '2.6.7 תל גזר', page: 79, id: 'ch2-6-7' },
  { level: 3, title: '2.6.8 תל חצור ותל מגידו', page: 83, id: 'ch2-6-8' },
  { level: 3, title: '2.6.9 תל נאמי', page: 87, id: 'ch2-6-9' },
  { level: 3, title: '2.6.10 תל לכיש', page: 87, id: 'ch2-6-10' },
  { level: 3, title: '2.6.11 תל הרור', page: 88, id: 'ch2-6-11' },
  { level: 3, title: '2.6.12 אבלה (סוריה)', page: 88, id: 'ch2-6-12' },
  { level: 3, title: '2.6.13 בוצרה (סוריה)', page: 89, id: 'ch2-6-13' },
  { level: 2, title: '§2.7 תקופת הברונזה המאוחרת (LB I-II)', page: 95, id: 'ch2-7' },
  { level: 3, title: '2.7.1 ח\'רבת בלעמה (יבלעם)', page: 96, id: 'ch2-7-1' },
  { level: 3, title: '2.7.2 תל אפק (מקורות הירקון)', page: 97, id: 'ch2-7-2' },
  { level: 3, title: '2.7.5 חצור (מאגר 357)', page: 99, id: 'ch2-7-5' },
  { level: 3, title: '2.7.7 בית שמש', page: 100, id: 'ch2-7-7' },
  { level: 2, title: '§2.8 תקופת הברזל 1 (Iron Age I)', page: 105, id: 'ch2-8' },
  { level: 3, title: '2.8.1 תל דור', page: 106, id: 'ch2-8-1' },
  { level: 3, title: '2.8.4 באר שבע (הבאר החיצונית)', page: 107, id: 'ch2-8-4' },
  { level: 3, title: '2.8.5 תל א-סעידיה (ירדן)', page: 108, id: 'ch2-8-5' },
  { level: 3, title: '2.8.7 שילה', page: 111, id: 'ch2-8-7' },
  { level: 3, title: '2.8.8 חורבת רדנה והעי', page: 113, id: 'ch2-8-8' },
  { level: 2, title: '§2.9 תקופת הברזל 2 (Iron Age II)', page: 115, id: 'ch2-9' },
  { level: 3, title: '2.9.1 יזרעאל', page: 118, id: 'ch2-9-1' },
  { level: 3, title: '2.9.2 מגידו (מפעל המים המשוכלל)', page: 119, id: 'ch2-9-2' },
  { level: 3, title: '2.9.3 חצור (הפיר והמנהרה)', page: 121, id: 'ch2-9-3' },
  { level: 3, title: '2.9.4 בלעמה (יבלעם)', page: 125, id: 'ch2-9-4' },
  { level: 3, title: '2.9.5 גבעון (הבריכה הגדולה והמנהרה)', page: 127, id: 'ch2-9-5' },
  { level: 3, title: '2.9.6 ירושלים (נקבת חזקיהו, פיר וורן, בריכת השילוח)', page: 131, id: 'ch2-9-6' },
  { level: 3, title: '2.9.7 תל בית שמש (המאגר הצלבני/צלבי)', page: 142, id: 'ch2-9-7' },
  { level: 3, title: '2.9.8 תל גזר (המאגר הגדול)', page: 144, id: 'ch2-9-8' },
  { level: 3, title: '2.9.14 תל דן', page: 154, id: 'ch2-9-14' },
  { level: 3, title: '2.9.15 תל ערד (באר המצודה והתעלה)', page: 156, id: 'ch2-9-15' },
  { level: 3, title: '2.9.16 תל באר שבע (המאגר הפנימי הכפול)', page: 158, id: 'ch2-9-16' },
  { level: 3, title: '2.9.28 תל דור', page: 165, id: 'ch2-9-28' },
  { level: 3, title: '2.9.34 חורבת עוזה וחורבת רדום', page: 168, id: 'ch2-9-34' },
  { level: 3, title: '2.9.36 בורות המים ומצודות הר הנגב', page: 171, id: 'ch2-9-36' },
  { level: 1, title: 'פרק 3: טיפולוגיה וטכנולוגיה של מפעלי המים', page: 196, id: 'ch3' },
  { level: 2, title: '§3.7 התפתחות מפעלי המים לקראת התקופות הקלאסיות', page: 207, id: 'ch3-7' },
  { level: 1, title: 'פרקים 4–6: הידרולוגיה, סינתזה אזורית וחברה', page: 217, id: 'ch4-6' },
  { level: 1, title: 'פרק 7: סיכום ומסקנות', page: 319, id: 'ch7' },
  { level: 1, title: 'ביבליוגרפיה ורשימת קיצורים', page: 359, id: 'bib' },
  { level: 1, title: 'רשימת האיורים והמפות (איורים 1–308)', page: 410, id: 'figures' },
  { level: 1, title: 'English Summary & Contents (Pages 1*-15*)', page: 430, id: 'english' }
];

function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

// Clean and post-process raw OCR page text
function postProcessPageText(rawText, pageNum) {
  if (!rawText) return '<p class="empty-page"><em>[עמוד ריק / ללא טקסט קריא]</em></p>';

  const lines = rawText.split('\n');
  const cleanLines = [];
  let isEnglish = pageNum >= 430;

  for (let i = 0; i < lines.length; i++) {
    let line = lines[i].trim();
    if (!line) continue;

    // Remove isolated standalone OCR artifact page headers/footers if redundant
    if (/^\d{1,3}$/.test(line) && (i === 0 || i === lines.length - 1)) {
      continue;
    }

    // Repair broken Hebrew words at line-endings (trailing hyphens)
    if (line.endsWith('-') && i + 1 < lines.length) {
      const nextLine = lines[i + 1].trim();
      const firstWordMatch = nextLine.match(/^([^\s]+)(.*)$/);
      if (firstWordMatch) {
        line = line.slice(0, -1) + firstWordMatch[1];
        lines[i + 1] = firstWordMatch[2].trim();
      }
    }

    cleanLines.push(line);
  }

  // Convert lines into structured HTML paragraphs, headings, blockquotes, and lists
  let html = '';
  let inList = false;

  for (let j = 0; j < cleanLines.length; j++) {
    const line = cleanLines[j];

    // Check if line is a major Chapter Heading
    if (/^(פרק\s+[1-7]|הקדמה|מבוא|סיכום|תוכן העניינים|ביבליוגרפיה)/.test(line)) {
      if (inList) { html += '</ul>'; inList = false; }
      html += `<h2 class="doc-heading doc-ch-heading">${escapeHtml(line)}</h2>`;
      continue;
    }

    // Check if line is a Section Heading (e.g. 2.1, 2.6.4, §3.7)
    if (/^(\d+\.\d+(\.\d+)?|\§\d+)\s+/.test(line)) {
      if (inList) { html += '</ul>'; inList = false; }
      html += `<h3 class="doc-heading doc-sec-heading">${escapeHtml(line)}</h3>`;
      continue;
    }

    // Check if line is a Figure caption
    if (/^איור\s+\d+/.test(line)) {
      if (inList) { html += '</ul>'; inList = false; }
      html += `<div class="figure-caption"><strong>📷 ${escapeHtml(line)}</strong></div>`;
      continue;
    }

    // Check if line is a numbered / bullet list item
    if (/^(\d+\.|\-|\*|\•)\s+/.test(line)) {
      if (!inList) { html += '<ul class="doc-list">'; inList = true; }
      html += `<li>${escapeHtml(line.replace(/^(\d+\.|\-|\*|\•)\s+/, ''))}</li>`;
      continue;
    }

    if (inList) { html += '</ul>'; inList = false; }

    // Standard paragraph
    html += `<p class="doc-paragraph">${escapeHtml(line)}</p>`;
  }

  if (inList) html += '</ul>';
  return html;
}

function loadOcrPages() {
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

  console.log(`Loaded ${pagesMap.size} OCR pages from ${files.length} JSON batch files.`);
  return pagesMap;
}

function buildHtmlReader() {
  console.log('=== Building Standalone Post-Processed Dissertation HTML Reader ===');
  const pagesMap = loadOcrPages();

  let pagesHtml = '';
  const totalPages = 446;

  for (let p = 1; p <= totalPages; p++) {
    const rawText = pagesMap.get(p) || '';
    const cleanContent = postProcessPageText(rawText, p);
    const isEnglish = p >= 430;
    const textDir = isEnglish ? 'ltr' : 'rtl';
    const langClass = isEnglish ? 'lang-en' : 'lang-he';

    // Check if this page matches a TOC anchor
    const matchedToc = TOC_ENTRIES.filter(t => t.page === p);
    let tocAnchorBadges = '';
    matchedToc.forEach(t => {
      tocAnchorBadges += `<span class="toc-badge" id="${t.id}">${escapeHtml(t.title)}</span>`;
    });

    pagesHtml += `
    <article id="page-${p}" class="page-container ${langClass}" dir="${textDir}" data-page="${p}">
      <a id="p${p}" class="anchor-link" aria-hidden="true"></a>
      <header class="page-header">
        <div class="page-meta">
          <span class="page-badge">עמוד ${p}</span>
          ${tocAnchorBadges}
        </div>
        <div class="page-actions">
          <button class="btn-action btn-copy-link" onclick="copyPageLink(${p})" title="העתק קישור ישיר לעמוד זה">
            <span class="icon">🔗</span> <span class="btn-text">העתק קישור</span>
          </button>
          <a href="#page-${Math.max(1, p - 1)}" class="btn-nav" title="עמוד קודם">▲</a>
          <a href="#page-${Math.min(totalPages, p + 1)}" class="btn-nav" title="עמוד הבא">▼</a>
        </div>
      </header>
      <div class="page-content">
        ${cleanContent}
      </div>
      <footer class="page-footer">
        <span>— עמוד ${p} מתוך ${totalPages} —</span>
      </footer>
    </article>\n`;
  }

  // Sidebar TOC HTML
  let tocListHtml = '<ul class="toc-tree">';
  TOC_ENTRIES.forEach(t => {
    const indentClass = `toc-level-${t.level}`;
    tocListHtml += `
      <li class="${indentClass}">
        <a href="#page-${t.page}" onclick="navigateToPage(${t.page}); return false;" class="toc-link" data-target="${t.page}">
          <span class="toc-title">${escapeHtml(t.title)}</span>
          <span class="toc-page-num">${t.page}</span>
        </a>
      </li>`;
  });
  tocListHtml += '</ul>';

  const fullHtml = `<!DOCTYPE html>
<html lang="he" dir="rtl">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>מפעלי מים קדומים ביישובים בארץ ישראל | ד"ר צביקה צוק (עבודת דוקטורט)</title>
  <meta name="description" content="מהדורה דיגיטלית מלאה ומעובדת של עבודת הדוקטורט מאת ד''ר צביקה צוק, אוניברסיטת תל אביב, 2000.">
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Assistant:wght@300;400;600;700;800&family=Heebo:wght@300;400;500;700;800&family=Frank+Ruhl+Libre:wght@400;700&display=swap" rel="stylesheet">
  <style>
    :root {
      --bg-primary: #f8fafc;
      --bg-secondary: #ffffff;
      --bg-sidebar: #0f172a;
      --bg-card: #ffffff;
      --text-primary: #1e293b;
      --text-secondary: #64748b;
      --text-sidebar: #cbd5e1;
      --text-sidebar-hover: #38bdf8;
      --accent-color: #0284c7;
      --accent-hover: #0369a1;
      --border-color: #e2e8f0;
      --highlight-bg: #fef08a;
      --shadow-sm: 0 1px 2px 0 rgb(0 0 0 / 0.05);
      --shadow-md: 0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1);
      --font-body: 'Assistant', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      --font-heading: 'Heebo', sans-serif;
      --font-serif: 'Frank Ruhl Libre', serif;
      --sidebar-width: 340px;
      --header-height: 64px;
    }

    [data-theme="dark"] {
      --bg-primary: #090d16;
      --bg-secondary: #0f172a;
      --bg-sidebar: #050811;
      --bg-card: #1e293b;
      --text-primary: #f1f5f9;
      --text-secondary: #94a3b8;
      --text-sidebar: #94a3b8;
      --border-color: #334155;
      --highlight-bg: #854d0e;
    }

    * { box-sizing: border-box; margin: 0; padding: 0; }
    html { scroll-behavior: smooth; }
    body {
      font-family: var(--font-body);
      background-color: var(--bg-primary);
      color: var(--text-primary);
      line-height: 1.7;
      font-size: 16px;
      display: flex;
      min-height: 100vh;
      overflow-x: hidden;
    }

    /* Top Navigation Bar */
    .app-header {
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      height: var(--header-height);
      background-color: var(--bg-secondary);
      border-bottom: 1px solid var(--border-color);
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 0 20px;
      z-index: 1000;
      box-shadow: var(--shadow-sm);
    }

    .header-left, .header-right, .header-center {
      display: flex;
      align-items: center;
      gap: 12px;
    }

    .app-title {
      font-family: var(--font-heading);
      font-size: 16px;
      font-weight: 700;
      color: var(--accent-color);
      white-space: nowrap;
    }

    .btn-toggle-sidebar {
      background: none;
      border: 1px solid var(--border-color);
      padding: 8px 12px;
      border-radius: 6px;
      cursor: pointer;
      font-size: 16px;
      color: var(--text-primary);
    }

    /* Live Search Bar */
    .search-box {
      position: relative;
      display: flex;
      align-items: center;
    }

    .search-input {
      width: 280px;
      padding: 8px 36px 8px 12px;
      border-radius: 20px;
      border: 1px solid var(--border-color);
      background: var(--bg-primary);
      color: var(--text-primary);
      font-family: var(--font-body);
      font-size: 14px;
      transition: all 0.2s ease;
    }
    .search-input:focus {
      outline: none;
      border-color: var(--accent-color);
      width: 340px;
      box-shadow: 0 0 0 3px rgba(2, 132, 199, 0.15);
    }

    .search-icon {
      position: absolute;
      right: 12px;
      color: var(--text-secondary);
      pointer-events: none;
    }

    .search-count {
      font-size: 12px;
      color: var(--text-secondary);
      margin-right: 8px;
    }

    /* Page Jump Input */
    .page-jump-container {
      display: flex;
      align-items: center;
      gap: 6px;
      font-size: 13px;
      color: var(--text-secondary);
    }
    .page-jump-input {
      width: 60px;
      padding: 6px 8px;
      text-align: center;
      border: 1px solid var(--border-color);
      border-radius: 6px;
      background: var(--bg-primary);
      color: var(--text-primary);
      font-weight: 600;
    }

    /* Action Buttons */
    .btn-control {
      background: var(--bg-primary);
      border: 1px solid var(--border-color);
      color: var(--text-primary);
      padding: 6px 12px;
      border-radius: 6px;
      cursor: pointer;
      font-size: 13px;
      display: flex;
      align-items: center;
      gap: 6px;
      transition: background 0.15s;
    }
    .btn-control:hover {
      background: var(--border-color);
    }

    /* Sidebar Table of Contents */
    .app-sidebar {
      position: fixed;
      top: var(--header-height);
      right: 0;
      bottom: 0;
      width: var(--sidebar-width);
      background-color: var(--bg-sidebar);
      color: var(--text-sidebar);
      overflow-y: auto;
      z-index: 900;
      transition: transform 0.3s ease;
      border-left: 1px solid rgba(255,255,255,0.05);
    }
    .app-sidebar.collapsed {
      transform: translateX(100%);
    }

    .sidebar-header {
      padding: 16px 20px;
      border-bottom: 1px solid rgba(255, 255, 255, 0.1);
      font-family: var(--font-heading);
      font-size: 14px;
      font-weight: 700;
      color: #38bdf8;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }

    .toc-tree {
      list-style: none;
      padding: 12px 0 40px;
    }

    .toc-tree li a {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 7px 20px;
      color: var(--text-sidebar);
      text-decoration: none;
      font-size: 13px;
      transition: all 0.15s ease;
      border-right: 3px solid transparent;
    }
    .toc-tree li a:hover {
      color: #ffffff;
      background-color: rgba(255, 255, 255, 0.05);
      border-right-color: var(--accent-color);
    }

    .toc-level-1 a { font-weight: 700; color: #f8fafc; font-size: 13.5px; margin-top: 6px; }
    .toc-level-2 a { padding-right: 32px; font-weight: 500; color: #94a3b8; }
    .toc-level-3 a { padding-right: 46px; font-size: 12.5px; color: #64748b; }
    .toc-page-num {
      font-size: 11px;
      background: rgba(255, 255, 255, 0.1);
      padding: 2px 6px;
      border-radius: 4px;
      color: #94a3b8;
    }

    /* Main Reading Content Area */
    .main-container {
      margin-top: var(--header-height);
      margin-right: var(--sidebar-width);
      flex: 1;
      padding: 40px 24px 80px;
      display: flex;
      flex-direction: column;
      align-items: center;
      transition: margin-right 0.3s ease;
    }
    .main-container.sidebar-closed {
      margin-right: 0;
    }

    .reading-wrapper {
      width: 100%;
      max-width: 820px;
    }

    /* Page Container Card */
    .page-container {
      background: var(--bg-card);
      border-radius: 12px;
      border: 1px solid var(--border-color);
      box-shadow: var(--shadow-sm);
      margin-bottom: 32px;
      padding: 32px 36px;
      position: relative;
      transition: box-shadow 0.2s, border-color 0.2s;
    }
    .page-container:hover {
      box-shadow: var(--shadow-md);
    }
    .page-container.highlighted-page {
      border-color: var(--accent-color);
      box-shadow: 0 0 0 3px rgba(2, 132, 199, 0.3);
    }

    .page-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      border-bottom: 1px solid var(--border-color);
      padding-bottom: 14px;
      margin-bottom: 20px;
    }

    .page-meta {
      display: flex;
      align-items: center;
      gap: 10px;
      flex-wrap: wrap;
    }

    .page-badge {
      background: var(--accent-color);
      color: #ffffff;
      font-weight: 700;
      font-size: 12px;
      padding: 4px 10px;
      border-radius: 6px;
    }

    .toc-badge {
      background: rgba(2, 132, 199, 0.1);
      color: var(--accent-color);
      font-size: 12px;
      font-weight: 600;
      padding: 4px 10px;
      border-radius: 6px;
    }

    .page-actions {
      display: flex;
      align-items: center;
      gap: 6px;
    }

    .btn-action {
      background: var(--bg-primary);
      border: 1px solid var(--border-color);
      color: var(--text-primary);
      font-size: 12px;
      font-weight: 600;
      padding: 5px 10px;
      border-radius: 6px;
      cursor: pointer;
      display: flex;
      align-items: center;
      gap: 5px;
      transition: all 0.15s;
    }
    .btn-action:hover {
      background: var(--accent-color);
      color: #ffffff;
      border-color: var(--accent-color);
    }

    .btn-nav {
      background: var(--bg-primary);
      border: 1px solid var(--border-color);
      color: var(--text-secondary);
      text-decoration: none;
      font-size: 11px;
      padding: 5px 8px;
      border-radius: 6px;
    }
    .btn-nav:hover {
      background: var(--border-color);
      color: var(--text-primary);
    }

    /* Page Content Typography */
    .page-content {
      font-size: 16.5px;
      color: var(--text-primary);
      line-height: 1.8;
      text-align: justify;
    }

    .lang-en .page-content {
      text-align: left;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    }

    .doc-paragraph {
      margin-bottom: 16px;
      text-indent: 1.5em;
    }

    .doc-heading {
      font-family: var(--font-heading);
      margin: 24px 0 12px;
      color: var(--accent-color);
      font-weight: 800;
      text-indent: 0;
    }
    .doc-ch-heading { font-size: 20px; border-right: 4px solid var(--accent-color); padding-right: 12px; }
    .doc-sec-heading { font-size: 17px; color: #0369a1; }

    .figure-caption {
      background: rgba(2, 132, 199, 0.05);
      border-right: 3px solid var(--accent-color);
      padding: 10px 14px;
      margin: 16px 0;
      border-radius: 4px;
      font-size: 14.5px;
      color: var(--text-secondary);
    }

    .doc-list {
      margin: 12px 24px 16px;
    }
    .doc-list li { margin-bottom: 6px; }

    .page-footer {
      margin-top: 24px;
      padding-top: 12px;
      border-top: 1px dashed var(--border-color);
      text-align: center;
      font-size: 12px;
      color: var(--text-secondary);
    }

    .search-highlight {
      background-color: var(--highlight-bg);
      color: inherit;
      padding: 1px 2px;
      border-radius: 2px;
      font-weight: bold;
    }

    /* Toast Notification */
    .toast-notification {
      position: fixed;
      bottom: 24px;
      right: 24px;
      background: #0f172a;
      color: #ffffff;
      padding: 12px 20px;
      border-radius: 8px;
      box-shadow: var(--shadow-md);
      font-size: 13px;
      font-weight: 600;
      display: none;
      z-index: 2000;
      animation: fadeIn 0.2s ease;
    }

    @keyframes fadeIn {
      from { opacity: 0; transform: translateY(10px); }
      to { opacity: 1; transform: translateY(0); }
    }

    @media (max-width: 992px) {
      .app-sidebar { transform: translateX(100%); }
      .app-sidebar.open { transform: translateX(0); }
      .main-container { margin-right: 0; padding: 20px 12px; }
      .search-input { width: 180px; }
      .search-input:focus { width: 220px; }
    }
  </style>
</head>
<body>

  <!-- Top Header Navigation -->
  <header class="app-header">
    <div class="header-right">
      <button class="btn-toggle-sidebar" onclick="toggleSidebar()" title="פתח/סגור תוכן עניינים">☰</button>
      <div class="app-title">מפעלי מים קדומים | ד"ר צביקה צוק</div>
    </div>

    <div class="header-center">
      <div class="search-box">
        <span class="search-icon">🔍</span>
        <input type="text" id="searchInput" class="search-input" placeholder="חיפוש בכל 446 העמודים..." oninput="handleSearch()">
      </div>
      <span id="searchCount" class="search-count"></span>
      <div class="page-jump-container">
        <span>עבור לעמוד:</span>
        <input type="number" id="pageJumpInput" class="page-jump-input" min="1" max="446" placeholder="1" onkeydown="if(event.key==='Enter') jumpToPageInput()">
        <button class="btn-control" onclick="jumpToPageInput()">עבור</button>
      </div>
    </div>

    <div class="header-left">
      <button class="btn-control" onclick="changeFontSize(1)" title="הגדל גופן">א+</button>
      <button class="btn-control" onclick="changeFontSize(-1)" title="הקטן גופן">א-</button>
      <button class="btn-control" onclick="toggleDarkMode()" title="מצב לילה/יום">🌓</button>
    </div>
  </header>

  <!-- Sidebar Table of Contents -->
  <aside id="sidebar" class="app-sidebar">
    <div class="sidebar-header">
      תוכן העניינים וראשי פרקים
    </div>
    ${tocListHtml}
  </aside>

  <!-- Main Reading Container -->
  <main id="mainContainer" class="main-container">
    <div class="reading-wrapper">
      ${pagesHtml}
    </div>
  </main>

  <!-- Toast Notification -->
  <div id="toast" class="toast-notification">הקישור הועתק ללוח!</div>

  <script>
    let currentFontSize = 16.5;
    let isDark = false;

    function toggleSidebar() {
      const sb = document.getElementById('sidebar');
      const mc = document.getElementById('mainContainer');
      sb.classList.toggle('collapsed');
      mc.classList.toggle('sidebar-closed');
    }

    function toggleDarkMode() {
      isDark = !isDark;
      document.documentElement.setAttribute('data-theme', isDark ? 'dark' : 'light');
    }

    function changeFontSize(delta) {
      currentFontSize = Math.max(13, Math.min(24, currentFontSize + delta));
      document.querySelectorAll('.page-content').forEach(el => {
        el.style.fontSize = currentFontSize + 'px';
      });
    }

    function copyPageLink(pageNum) {
      const url = window.location.origin + window.location.pathname + '#page-' + pageNum;
      navigator.clipboard.writeText(url).then(() => {
        showToast('הקישור לעמוד ' + pageNum + ' הועתק ללוח: #page-' + pageNum);
      });
    }

    function showToast(msg) {
      const t = document.getElementById('toast');
      t.textContent = msg;
      t.style.display = 'block';
      setTimeout(() => { t.style.display = 'none'; }, 3000);
    }

    function navigateToPage(pageNum) {
      const el = document.getElementById('page-' + pageNum);
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'start' });
        highlightPage(el);
        window.history.replaceState(null, null, '#page-' + pageNum);
      }
    }

    function jumpToPageInput() {
      const val = parseInt(document.getElementById('pageJumpInput').value, 10);
      if (val >= 1 && val <= 446) {
        navigateToPage(val);
      }
    }

    function highlightPage(el) {
      document.querySelectorAll('.page-container').forEach(p => p.classList.remove('highlighted-page'));
      el.classList.add('highlighted-page');
      setTimeout(() => el.classList.remove('highlighted-page'), 3000);
    }

    // Live search highlight across all pages
    let searchDebounce = null;
    function handleSearch() {
      clearTimeout(searchDebounce);
      searchDebounce = setTimeout(() => {
        const query = document.getElementById('searchInput').value.trim();
        const countSpan = document.getElementById('searchCount');
        
        // Remove existing highlights
        document.querySelectorAll('.search-highlight').forEach(el => {
          const parent = el.parentNode;
          parent.replaceChild(document.createTextNode(el.textContent), el);
          parent.normalize();
        });

        if (!query || query.length < 2) {
          countSpan.textContent = '';
          return;
        }

        let matchesCount = 0;
        let firstMatch = null;
        const regex = new RegExp('(' + query.replace(/[-\\/\\\\^$*+?.()|[\\]{}]/g, '\\\\$&') + ')', 'gi');

        document.querySelectorAll('.page-content').forEach(pc => {
          const paragraphs = pc.querySelectorAll('p, h2, h3, li, div');
          paragraphs.forEach(p => {
            if (p.textContent.toLowerCase().includes(query.toLowerCase())) {
              p.innerHTML = p.innerHTML.replace(regex, '<mark class=\"search-highlight\">$1</mark>');
              matchesCount++;
              if (!firstMatch) firstMatch = p;
            }
          });
        });

        countSpan.textContent = matchesCount > 0 ? (matchesCount + ' תוצאות') : 'לא נמצאו תוצאות';
        if (firstMatch) {
          firstMatch.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
      }, 300);
    }

    // Auto-scroll on initial hash load (#page-45 or #p45)
    window.addEventListener('DOMContentLoaded', () => {
      const hash = window.location.hash;
      if (hash) {
        const pageMatch = hash.match(/page-(\\d+)/) || hash.match(/p(\\d+)/);
        if (pageMatch) {
          const pageNum = parseInt(pageMatch[1], 10);
          setTimeout(() => navigateToPage(pageNum), 200);
        }
      }
    });
  </script>
</body>
</html>`;

  const outHtmlPath = join(process.cwd(), 'data', 'dissertation_reader.html');
  writeFileSync(outHtmlPath, fullHtml, 'utf-8');
  console.log(`[+] Wrote Standalone HTML Reader: ${outHtmlPath} (${(fullHtml.length / 1024).toFixed(1)} KB)`);
}

buildHtmlReader();
