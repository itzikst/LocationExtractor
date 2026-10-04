import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { execSync } from 'node:child_process';

const OUTPUT_PREFIX = 'gs://tsvika/output/';

export const VERIFIED_TOC = [
  { level: 1, title: 'שער ומידע ביבליוגרפי', page: 1, id: 'front-matter' },
  { level: 1, title: 'תוכן העניינים', page: 7, id: 'toc' },
  { level: 1, title: 'הקדמה', page: 15, id: 'preface' },
  { level: 1, title: 'פרק 1: מבואות כלליים', page: 16, id: 'ch1' },
  { level: 2, title: '1.1 האקלים בארץ ישראל כיום', page: 19, id: 'ch1-1' },
  { level: 2, title: '1.2 מקורות המים ומתקני המים לסוגיהם', page: 21, id: 'ch1-2' },
  { level: 2, title: '1.3 שינויי אקלים בארץ ישראל בעבר', page: 27, id: 'ch1-3' },
  { level: 2, title: '1.4 צריכה אישית וכמויות מים', page: 31, id: 'ch1-4' },
  { level: 2, title: '1.5 תולדות המחקר של מפעלי המים', page: 36, id: 'ch1-5' },
  { level: 1, title: 'פרק 2: מפעלי המים לתקופותיהם (הקורפוס המרכזי)', page: 39, id: 'ch2' },
  { level: 2, title: '§2.1 התקופה הפליאוליתית והאפי-פליאוליתית', page: 39, id: 'ch2-1' },
  { level: 2, title: '§2.2 התקופה הניאוליתית הקדם קירמית (PPN)', page: 43, id: 'ch2-2' },
  { level: 3, title: '2.2.1 עתלית ים', page: 43, id: 'ch2-2-1' },
  { level: 3, title: '2.2.2 ח\'רבת ג\'אראסור (עיראק)', page: 44, id: 'ch2-2-2' },
  { level: 3, title: '2.2.3 אבן אל-ג\'אזי (ירדן)', page: 45, id: 'ch2-2-3' },
  { level: 3, title: '2.2.4 גלגל I', page: 46, id: 'ch2-2-4' },
  { level: 3, title: '2.2.5 נתיב הגדוד', page: 47, id: 'ch2-2-5' },
  { level: 3, title: '2.2.6 ביידא (ירדן)', page: 47, id: 'ch2-2-6' },
  { level: 2, title: '§2.3 התקופה הניאוליתית הקירמית (PN)', page: 49, id: 'ch2-3' },
  { level: 3, title: '2.3.1 בארות בחוף הכרמל (כפר סמיר, גלים, מגדים)', page: 49, id: 'ch2-3-1' },
  { level: 3, title: '2.3.2 הצ\'ילר (תורכיה)', page: 50, id: 'ch2-3-2' },
  { level: 3, title: '2.3.3 טפה גאורה (עיראק)', page: 50, id: 'ch2-3-3' },
  { level: 2, title: '§2.4 התקופה הכלקוליתית', page: 52, id: 'ch2-4' },
  { level: 3, title: '2.4.1 אבו חוף', page: 52, id: 'ch2-4-1' },
  { level: 3, title: '2.4.2 חורבת בתר', page: 52, id: 'ch2-4-2' },
  { level: 3, title: '2.4.3 טפה גאורה (עיראק)', page: 53, id: 'ch2-4-3' },
  { level: 3, title: '2.4.4 ראג\'אג\'יל (ערב הסעודית)', page: 53, id: 'ch2-4-4' },
  { level: 2, title: '§2.5 תקופת הברונזה הקדומה (EB I-IV)', page: 55, id: 'ch2-5' },
  { level: 3, title: '2.5.1 בארות בבקעת עובדה', page: 55, id: 'ch2-5-1' },
  { level: 3, title: '2.5.2 באר בתל ערד', page: 55, id: 'ch2-5-2' },
  { level: 3, title: '2.5.3 חירבת זירקון (ירדן)', page: 56, id: 'ch2-5-3' },
  { level: 3, title: '2.5.10 העי (א-תל)', page: 59, id: 'ch2-5-10' },
  { level: 3, title: '2.5.11 תל ערד (מאגר המים)', page: 60, id: 'ch2-5-11' },
  { level: 3, title: '2.5.12 ג\'ווה (ירדן)', page: 65, id: 'ch2-5-12' },
  { level: 3, title: '2.5.15 מצר', page: 68, id: 'ch2-5-15' },
  { level: 3, title: '2.5.16 תל דלית', page: 68, id: 'ch2-5-16' },
  { level: 3, title: '2.5.17 בית ירח', page: 70, id: 'ch2-5-17' },
  { level: 2, title: '§2.6 תקופת הברונזה התיכונה (MB I-II)', page: 73, id: 'ch2-6' },
  { level: 3, title: '2.6.1 תל כברי', page: 73, id: 'ch2-6-1' },
  { level: 3, title: '2.6.2 תל דן', page: 73, id: 'ch2-6-2' },
  { level: 3, title: '2.6.3 יריחו (עין א-סולטאן)', page: 75, id: 'ch2-6-3' },
  { level: 3, title: '2.6.4 ירושלים (עיר דוד ומעיין הגיחון)', page: 76, id: 'ch2-6-4' },
  { level: 3, title: '2.6.6 תל גריסה', page: 82, id: 'ch2-6-6' },
  { level: 3, title: '2.6.7 תל גזר', page: 83, id: 'ch2-6-7' },
  { level: 3, title: '2.6.8 חצור ומגידו', page: 87, id: 'ch2-6-8' },
  { level: 3, title: '2.6.9 תל נאמי', page: 87, id: 'ch2-6-9' },
  { level: 3, title: '2.6.10 תל לכיש', page: 88, id: 'ch2-6-10' },
  { level: 3, title: '2.6.11 תל הרור', page: 88, id: 'ch2-6-11' },
  { level: 3, title: '2.6.12 אבלה (סוריה)', page: 88, id: 'ch2-6-12' },
  { level: 3, title: '2.6.13 בוצרה (סוריה)', page: 89, id: 'ch2-6-13' },
  { level: 2, title: '§2.7 תקופת הברונזה המאוחרת (LB I-II)', page: 98, id: 'ch2-7' },
  { level: 3, title: '2.7.1 בית שאן', page: 98, id: 'ch2-7-1' },
  { level: 3, title: '2.7.2 תל ג\'מה', page: 98, id: 'ch2-7-2' },
  { level: 3, title: '2.7.3 יוון (אתונה, מיקנה, טירינס)', page: 99, id: 'ch2-7-3' },
  { level: 3, title: '2.7.4 דיר אל-מדינה (מצרים)', page: 100, id: 'ch2-7-4' },
  { level: 3, title: '2.7.5 חצור (מאגר 357)', page: 101, id: 'ch2-7-5' },
  { level: 3, title: '2.7.6 תענך', page: 102, id: 'ch2-7-6' },
  { level: 3, title: '2.7.7 בית שמש', page: 103, id: 'ch2-7-7' },
  { level: 3, title: '2.7.8 אשדוד', page: 103, id: 'ch2-7-8' },
  { level: 2, title: '§2.8 תקופת הברזל 1 (Iron Age I)', page: 107, id: 'ch2-8' },
  { level: 3, title: '2.8.1 תל דור', page: 108, id: 'ch2-8-1' },
  { level: 3, title: '2.8.4 באר שבע (הבאר החיצונית)', page: 109, id: 'ch2-8-4' },
  { level: 3, title: '2.8.5 תל א-סעידיה (ירדן)', page: 111, id: 'ch2-8-5' },
  { level: 3, title: '2.8.7 שילה', page: 113, id: 'ch2-8-7' },
  { level: 3, title: '2.8.8 העי וחורבת רדאנה', page: 113, id: 'ch2-8-8' },
  { level: 2, title: '§2.9 תקופת הברזל 2 (Iron Age II)', page: 119, id: 'ch2-9' },
  { level: 3, title: '2.9.1 חצור (הפיר והמנהרה)', page: 119, id: 'ch2-9-1' },
  { level: 3, title: '2.9.2 יקנעם', page: 121, id: 'ch2-9-2' },
  { level: 3, title: '2.9.3 מגידו (מפעל המים המשוכלל)', page: 121, id: 'ch2-9-3' },
  { level: 3, title: '2.9.4 יבלעם (בלעמה)', page: 127, id: 'ch2-9-4' },
  { level: 3, title: '2.9.5 גבעון (הבריכה והמנהרה)', page: 128, id: 'ch2-9-5' },
  { level: 3, title: '2.9.6 ירושלים (נקבת חזקיהו, פיר וורן, בריכת השילוח)', page: 132, id: 'ch2-9-6' },
  { level: 3, title: '2.9.7 מגידו (המאגר הפנימי)', page: 147, id: 'ch2-9-7' },
  { level: 3, title: '2.9.8 תל גזר (המאגר הגדול)', page: 147, id: 'ch2-9-8' },
  { level: 3, title: '2.9.9 תל בית שמש (המאגר הצלבי)', page: 148, id: 'ch2-9-9' },
  { level: 3, title: '2.9.10 תל לכיש', page: 150, id: 'ch2-9-10' },
  { level: 3, title: '2.9.11 חירבת אל-ח\'וחי (עיטם)', page: 151, id: 'ch2-9-11' },
  { level: 3, title: '2.9.12 עמאן (ירדן)', page: 152, id: 'ch2-9-12' },
  { level: 3, title: '2.9.13 חשבון (ירדן)', page: 152, id: 'ch2-9-13' },
  { level: 3, title: '2.9.14 תל באר שבע (המאגר הכפול)', page: 153, id: 'ch2-9-14' },
  { level: 3, title: '2.9.15 תל ערד (באר המצודה והתעלה)', page: 155, id: 'ch2-9-15' },
  { level: 3, title: '2.9.16 חורבת טוב', page: 158, id: 'ch2-9-16' },
  { level: 3, title: '2.9.17 ערוער', page: 159, id: 'ch2-9-17' },
  { level: 3, title: '2.9.18 קדש ברנע', page: 159, id: 'ch2-9-18' },
  { level: 3, title: '2.9.19 חורבת ראש זית', page: 160, id: 'ch2-9-19' },
  { level: 3, title: '2.9.20 יזרעאל', page: 160, id: 'ch2-9-20' },
  { level: 3, title: '2.9.23 תל א-נצבה', page: 162, id: 'ch2-9-23' },
  { level: 3, title: '2.9.28 תל בית מרסים', page: 165, id: 'ch2-9-28' },
  { level: 3, title: '2.9.34 חורבת עוזה', page: 168, id: 'ch2-9-34' },
  { level: 3, title: '2.9.35 חורבת רדום', page: 169, id: 'ch2-9-35' },
  { level: 3, title: '2.9.36 בורות המים בהר הנגב', page: 170, id: 'ch2-9-36' },
  { level: 3, title: '2.9.37 אום אל-ביארה (ירדן)', page: 172, id: 'ch2-9-37' },
  { level: 3, title: '2.9.40 אמת המים לתושפה (אוררטו)', page: 175, id: 'ch2-9-40' },
  { level: 1, title: 'פרק 3: דיון כללי וטיפולוגיה', page: 189, id: 'ch3' },
  { level: 2, title: '3.1 התפתחות מפעלי המים במשך התקופות', page: 189, id: 'ch3-1' },
  { level: 2, title: '3.2 ההתארגנות המקצועית והחברתית', page: 197, id: 'ch3-2' },
  { level: 2, title: '3.3 מיון מפעלי המים המרכזיים של תקופת הברזל 2', page: 200, id: 'ch3-3' },
  { level: 2, title: '3.4 בורות המים בתקופת הברזל 2', page: 204, id: 'ch3-4' },
  { level: 2, title: '3.5 הטיח', page: 205, id: 'ch3-5' },
  { level: 2, title: '3.6 מפעלי המים בארץ ישראל בהשוואה לארצות השכנות', page: 209, id: 'ch3-6' },
  { level: 2, title: '3.7 התפתחות מפעלי המים לקראת התקופות הקלאסיות', page: 211, id: 'ch3-7' },
  { level: 1, title: 'סיכום ותקציר', page: 213, id: 'summary' },
  { level: 1, title: 'ספרות וביבליוגרפיה', page: 219, id: 'bib' },
  { level: 1, title: 'רשימת האיורים ומקורם (איורים 1–308)', page: 238, id: 'figures' },
  { level: 1, title: 'רשימת הטבלאות (טבלאות 1–8)', page: 249, id: 'tables' },
  { level: 1, title: 'English Summary & Contents (Pages 1*-15*)', page: 430, id: 'english' }
];

function generateReaderHtml() {
  const sortedPages = JSON.parse(readFileSync(join(process.cwd(), 'data', 'post_processed_pages.json'), 'utf-8'));
  const totalPages = 446;

  let pagesHtml = '';
  for (const p of sortedPages) {
    const isEnglish = p.page_number >= 430;
    const textDir = isEnglish ? 'ltr' : 'rtl';
    const langClass = isEnglish ? 'lang-en' : 'lang-he';

    const matchedToc = VERIFIED_TOC.filter(t => t.page === p.page_number);
    let tocAnchorBadges = '';
    matchedToc.forEach(t => {
      tocAnchorBadges += `<span class="toc-badge" id="${t.id}">${t.title}</span>`;
    });

    pagesHtml += `
    <article id="page-${p.page_number}" class="page-container ${langClass}" dir="${textDir}" data-page="${p.page_number}">
      <a id="p${p.page_number}" class="anchor-link" aria-hidden="true"></a>
      <header class="page-header">
        <div class="page-meta">
          <span class="page-badge">עמוד ${p.page_number}</span>
          ${tocAnchorBadges}
          ${p.section_title ? `<span class="section-tag">${p.section_title}</span>` : ''}
        </div>
        <div class="page-actions">
          <button class="btn-action btn-copy-link" onclick="copyPageLink(${p.page_number})" title="העתק קישור ישיר לעמוד זה">
            <span class="icon">🔗</span> <span class="btn-text">העתק קישור לעמוד</span>
          </button>
          <a href="#page-${Math.max(1, p.page_number - 1)}" class="btn-nav" title="עמוד קודם">▲</a>
          <a href="#page-${Math.min(totalPages, p.page_number + 1)}" class="btn-nav" title="עמוד הבא">▼</a>
        </div>
      </header>
      <div class="page-content">
        ${p.clean_html || p.clean_markdown}
      </div>
      <footer class="page-footer">
        <span>— עמוד ${p.page_number} מתוך ${totalPages} —</span>
      </footer>
    </article>\n`;
  }

  // Sidebar TOC HTML
  let tocListHtml = '<ul class="toc-tree">';
  VERIFIED_TOC.forEach(t => {
    const indentClass = `toc-level-${t.level}`;
    tocListHtml += `
      <li class="${indentClass}">
        <a href="#page-${t.page}" onclick="navigateToPage(${t.page}); return false;" class="toc-link" data-target="${t.page}">
          <span class="toc-title">${t.title}</span>
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
  <title>מפעלי מים קדומים ביישובים בארץ ישראל | ד"ר צביקה צוק (מהדורה דיגיטלית מעובדת)</title>
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
      line-height: 1.8;
      font-size: 16.5px;
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
      padding: 36px 40px;
      position: relative;
      transition: box-shadow 0.2s, border-color 0.2s;
    }
    .page-container:hover {
      box-shadow: var(--shadow-md);
    }
    .page-container.highlighted-page {
      border-color: var(--accent-color);
      box-shadow: 0 0 0 4px rgba(2, 132, 199, 0.35);
    }

    .page-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      border-bottom: 1px solid var(--border-color);
      padding-bottom: 14px;
      margin-bottom: 24px;
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

    .section-tag {
      font-size: 12px;
      color: var(--text-secondary);
      font-weight: 500;
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
      padding: 5px 12px;
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
      line-height: 1.85;
      text-align: justify;
    }

    .lang-en .page-content {
      text-align: left;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    }

    .doc-p, p {
      margin-bottom: 16px;
      text-indent: 1.5em;
    }

    .doc-ch-heading, h2 {
      font-family: var(--font-heading);
      margin: 28px 0 14px;
      color: var(--accent-color);
      font-size: 21px;
      font-weight: 800;
      border-right: 4px solid var(--accent-color);
      padding-right: 12px;
      text-indent: 0;
    }

    .doc-sec-heading, h3 {
      font-family: var(--font-heading);
      margin: 22px 0 12px;
      color: #0369a1;
      font-size: 17.5px;
      font-weight: 700;
      text-indent: 0;
    }

    .figure-box, .figure-caption {
      background: rgba(2, 132, 199, 0.05);
      border-right: 3px solid var(--accent-color);
      padding: 12px 16px;
      margin: 20px 0;
      border-radius: 4px;
      font-size: 14.5px;
      color: var(--text-secondary);
      text-indent: 0;
    }

    .doc-list, ul, ol {
      margin: 12px 24px 18px;
    }
    .doc-list li, li { margin-bottom: 6px; }

    .doc-table, table {
      width: 100%;
      border-collapse: collapse;
      margin: 20px 0;
      font-size: 14.5px;
    }
    .doc-table th, .doc-table td, table th, table td {
      border: 1px solid var(--border-color);
      padding: 8px 12px;
      text-align: right;
    }
    .doc-table th, table th {
      background-color: rgba(2, 132, 199, 0.1);
      font-weight: 700;
    }

    .page-footer {
      margin-top: 28px;
      padding-top: 14px;
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
  console.log(`Saved updated Standalone HTML Reader with verified TOC: ${outHtmlPath} (${(fullHtml.length / 1024).toFixed(1)} KB)`);

  try {
    console.log(`Syncing updated dissertation_reader.html to GCS (${OUTPUT_PREFIX})...`);
    execSync(`gcloud storage cp "${outHtmlPath}" "${OUTPUT_PREFIX}dissertation_reader.html"`, { stdio: 'inherit' });
    console.log('Successfully updated HTML reader in GCS!');
  } catch (err) {
    console.warn('GCS sync warning:', err.message);
  }
}

generateReaderHtml();
