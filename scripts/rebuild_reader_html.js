import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { execSync } from 'node:child_process';
import { parseGridRef } from './archaeological_gazetteer.js';

const OUTPUT_PREFIX = 'gs://tsvika/output/';

// Load verified geocoded dataset (778 unique locations with coordinates and sources)
function loadGeocodedMap() {
  const csvPath = join(process.cwd(), 'data', 'geocoded_locations.csv');
  const geocodedMap = new Map();
  if (!existsSync(csvPath)) return geocodedMap;

  const csvLines = readFileSync(csvPath, 'utf-8').split('\n').filter(l => l.trim());
  for (let i = 1; i < csvLines.length; i++) {
    const line = csvLines[i];
    const m = line.match(/^"([^"]+)","([^"]+)","([^"]+)",(\d+),(true|false),"([^"]+)"/);
    if (m) {
      const [, name, coords, source, num, isBest, mapUrl] = m;
      if (isBest === 'true') {
        const [lat, lon] = coords.split(',').map(s => s.trim());
        geocodedMap.set(name.trim(), {
          lat: Number(lat),
          lon: Number(lon),
          source: source.trim(),
          numCandidates: parseInt(num, 10),
          mapUrl: mapUrl.trim()
        });
      }
    }
  }
  return geocodedMap;
}

// Convert all in-text occurrences of Israeli Grid coordinates to clickable Google Maps links (zoom 17)
// Preserves original text exactly, wrapping it in an href with light yellow background highlight
export function linkifyIsraeliGridCoords(html) {
  if (!html) return '';

  // 1. Repair split between נ.צ. and coordinates across </p><p...> tags
  let processed = html.replace(
    /((?:ב|ל)?נ[\.״\"\'\s]*[י]?[\.״\"\'\s]*[צץ][\.״\"\'\s]*(?:(?:\.U\.T\.M|\.UTM|UTM)[\.\s]*)?[:\-]?)\s*<\/p>\s*<p[^>]*>\s*([0-9]{3,6}(?:[\.\/\-–\s]+[0-9]{3,6})|[0-9]{6,10})/gi,
    '$1 $2'
  );

  // 2. Comprehensive regex matching Israeli Grid coordinates
  const gridRegex = /((?:ב|ל)?נ[\.״\"\'\s]*[י]?[\.״\"\'\s]*[צץ][\.״\"\'\s]*(?:(?:\.U\.T\.M|\.UTM|UTM)[\.\s]*)?[:\-]?\s*)([0-9]{3,6}(?:[\.\/\-–\s]+[0-9]{3,6})|[0-9]{6,10})/gi;

  processed = processed.replace(gridRegex, (match, prefix, numStr) => {
    const geo = parseGridRef(numStr);
    if (!geo) return match;

    const mapUrl = `https://www.google.com/maps?q=${geo.lat},${geo.lon}&ll=${geo.lat},${geo.lon}&z=17`;

    return `<a href="${mapUrl}" target="_blank" rel="noopener" class="grid-coord-link" title="רשת ישראל: ${match.trim()} (WGS84: ${geo.lat}, ${geo.lon}) — פתח ב-Google Maps (זום 17)">${match}</a>`;
  });

  return processed;
}

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
  const locationsData = JSON.parse(readFileSync(join(process.cwd(), 'data', 'locations_dissertation.json'), 'utf-8'));
  const geocodedMap = loadGeocodedMap();
  console.log(`Loaded ${geocodedMap.size} verified geocoded entries for Left Sidebar.`);
  const totalPages = 446;

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

  // Build page-to-locations lookup map
  const locationsByPage = {};
  for (let p = 1; p <= totalPages; p++) {
    locationsByPage[p] = [];
  }

  for (const loc of locationsData) {
    const typeLower = (loc.site_type || '').toLowerCase().trim();
    if (EXCLUDED_TYPES.has(typeLower)) continue;

    // Enrich with verified geocoded coordinates & source
    const nameTrim = (loc.location_name || '').trim();
    const geo = geocodedMap.get(nameTrim);
    let lat = geo ? geo.lat : (loc.latitude || '');
    let lon = geo ? geo.lon : (loc.longitude || '');
    let source = geo ? geo.source : (lat && lon ? 'IAA' : '');
    let mapUrl = geo ? geo.mapUrl : (lat && lon ? `https://www.google.com/maps?q=${lat},${lon}&ll=${lat},${lon}&z=17` : '');
    let numCandidates = geo ? geo.numCandidates : 1;

    if (Array.isArray(loc.all_pages)) {
      for (const p of loc.all_pages) {
        if (locationsByPage[p]) {
          locationsByPage[p].push({
            name: loc.location_name,
            eng: loc.english_name || '',
            heb_aliases: loc.hebrew_aliases || '',
            eng_aliases: loc.english_aliases || '',
            type: loc.site_type || 'Archaeological Site',
            first_page: loc.first_page,
            pages: loc.all_pages,
            iaa_map: loc.iaa_survey_map || '',
            iaa_id: loc.iaa_site_id || '',
            iaa_url: loc.iaa_portal_url || '',
            iaa_eng_url: loc.iaa_eng_portal_url || '',
            lat,
            lon,
            coord_source: source,
            map_url: mapUrl,
            num_candidates: numCandidates
          });
        }
      }
    }
  }

  // Sort locations on each page alphabetically by Hebrew name
  for (let p = 1; p <= totalPages; p++) {
    locationsByPage[p].sort((a, b) => a.name.localeCompare(b.name, 'he'));
  }

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

    const pageLocCount = locationsByPage[p.page_number]?.length || 0;
    const rawContent = p.clean_html || p.clean_markdown || '';
    const contentWithGridLinks = linkifyIsraeliGridCoords(rawContent);

    pagesHtml += `
    <article id="page-${p.page_number}" class="page-container ${langClass}" dir="${textDir}" data-page="${p.page_number}">
      <a id="p${p.page_number}" class="anchor-link" aria-hidden="true"></a>
      <header class="page-header">
        <div class="page-meta">
          <span class="page-badge">עמוד ${p.page_number}</span>
          ${tocAnchorBadges}
          ${p.section_title ? `<span class="section-tag">${p.section_title}</span>` : ''}
          ${pageLocCount > 0 ? `<button class="page-loc-badge" onclick="showLocationsForPage(${p.page_number})" title="הצג ${pageLocCount} אתרים בעמוד זה">📍 ${pageLocCount} אתרים</button>` : ''}
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
        ${contentWithGridLinks}
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

  const clientJs = readFileSync(join(process.cwd(), 'scripts', 'reader_client.js'), 'utf-8');

  const fullHtml = `<!DOCTYPE html>
<html lang="he" dir="rtl">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>מפעלי מים קדומים ביישובים בארץ ישראל | ד"ר צביקה צוק (מהדורה דיגיטלית מעובדת)</title>
  <meta name="description" content="מהדורה דיגיטלית מלאה ומעובדת של עבודת הדוקטורט מאת ד''ר צביקה צוק, אוניברסיטת תל אביב, 2000.">
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Assistant:wght@300;400;500;600;700;800&family=Heebo:wght@300;400;500;700;800&family=Frank+Ruhl+Libre:wght@400;700&display=swap" rel="stylesheet">
  <style>
    :root {
      --bg-primary: #f8fafc;
      --bg-secondary: #ffffff;
      --bg-sidebar-right: #0f172a;
      --bg-sidebar-left: #ffffff;
      --bg-card: #ffffff;
      --text-primary: #1e293b;
      --text-secondary: #64748b;
      --text-sidebar: #cbd5e1;
      --accent-color: #0284c7;
      --accent-hover: #0369a1;
      --accent-soft: rgba(2, 132, 199, 0.08);
      --border-color: #e2e8f0;
      --highlight-bg: #fef08a;
      --shadow-sm: 0 1px 2px 0 rgb(0 0 0 / 0.05);
      --shadow-md: 0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1);
      --font-body: 'Assistant', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      --font-heading: 'Heebo', sans-serif;
      --font-serif: 'Frank Ruhl Libre', serif;
      --sidebar-width: 330px;
      --header-height: 64px;
    }

    [data-theme="dark"] {
      --bg-primary: #090d16;
      --bg-secondary: #0f172a;
      --bg-sidebar-right: #050811;
      --bg-sidebar-left: #0f172a;
      --bg-card: #1e293b;
      --text-primary: #f1f5f9;
      --text-secondary: #94a3b8;
      --text-sidebar: #94a3b8;
      --border-color: #334155;
      --accent-soft: rgba(56, 189, 248, 0.12);
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
      padding: 0 16px;
      z-index: 1000;
      box-shadow: var(--shadow-sm);
    }

    .header-left, .header-right, .header-center {
      display: flex;
      align-items: center;
      gap: 10px;
    }

    .app-title {
      font-family: var(--font-heading);
      font-size: 15.5px;
      font-weight: 700;
      color: var(--accent-color);
      white-space: nowrap;
    }

    .btn-toggle-sidebar {
      background: none;
      border: 1px solid var(--border-color);
      padding: 7px 11px;
      border-radius: 6px;
      cursor: pointer;
      font-size: 14px;
      font-weight: 600;
      color: var(--text-primary);
      display: flex;
      align-items: center;
      gap: 6px;
      transition: all 0.15s;
    }
    .btn-toggle-sidebar:hover {
      background: var(--accent-soft);
      border-color: var(--accent-color);
      color: var(--accent-color);
    }
    .btn-toggle-sidebar.active-btn {
      background: var(--accent-color);
      color: #fff;
      border-color: var(--accent-color);
    }

    /* Search Box */
    .search-box {
      position: relative;
      display: flex;
      align-items: center;
    }

    .search-input {
      width: 240px;
      padding: 7px 34px 7px 12px;
      border-radius: 20px;
      border: 1px solid var(--border-color);
      background: var(--bg-primary);
      color: var(--text-primary);
      font-family: var(--font-body);
      font-size: 13.5px;
      transition: all 0.2s ease;
    }
    .search-input:focus {
      outline: none;
      border-color: var(--accent-color);
      width: 300px;
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
      margin-right: 6px;
      white-space: nowrap;
    }

    /* Page Jump Input */
    .page-jump-container {
      display: flex;
      align-items: center;
      gap: 5px;
      font-size: 13px;
      color: var(--text-secondary);
    }
    .page-jump-input {
      width: 54px;
      padding: 5px 6px;
      text-align: center;
      border: 1px solid var(--border-color);
      border-radius: 6px;
      background: var(--bg-primary);
      color: var(--text-primary);
      font-weight: 600;
    }

    .btn-control {
      background: var(--bg-primary);
      border: 1px solid var(--border-color);
      color: var(--text-primary);
      padding: 5px 10px;
      border-radius: 6px;
      cursor: pointer;
      font-size: 12.5px;
      display: flex;
      align-items: center;
      gap: 4px;
      transition: background 0.15s;
    }
    .btn-control:hover {
      background: var(--border-color);
    }

    /* Right Sidebar (Table of Contents) */
    .app-sidebar-right {
      position: fixed;
      top: var(--header-height);
      right: 0;
      bottom: 0;
      width: var(--sidebar-width);
      background-color: var(--bg-sidebar-right);
      color: var(--text-sidebar);
      overflow-y: auto;
      z-index: 900;
      transition: transform 0.3s ease;
      border-left: 1px solid rgba(255,255,255,0.05);
    }
    .app-sidebar-right.collapsed {
      transform: translateX(100%);
    }

    .sidebar-header {
      padding: 14px 18px;
      border-bottom: 1px solid rgba(255, 255, 255, 0.1);
      font-family: var(--font-heading);
      font-size: 13.5px;
      font-weight: 700;
      color: #38bdf8;
      display: flex;
      justify-content: space-between;
      align-items: center;
    }

    .toc-tree {
      list-style: none;
      padding: 10px 0 40px;
    }
    .toc-tree li a {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 6px 18px;
      color: var(--text-sidebar);
      text-decoration: none;
      font-size: 12.5px;
      transition: all 0.15s ease;
      border-right: 3px solid transparent;
    }
    .toc-tree li a:hover {
      color: #ffffff;
      background-color: rgba(255, 255, 255, 0.05);
      border-right-color: var(--accent-color);
    }
    .toc-level-1 a { font-weight: 700; color: #f8fafc; font-size: 13px; margin-top: 5px; }
    .toc-level-2 a { padding-right: 28px; font-weight: 500; color: #94a3b8; }
    .toc-level-3 a { padding-right: 40px; font-size: 12px; color: #64748b; }
    .toc-page-num {
      font-size: 11px;
      background: rgba(255, 255, 255, 0.1);
      padding: 1px 5px;
      border-radius: 4px;
      color: #94a3b8;
    }

    /* Left Sidebar (Locations on Active Page) */
    .app-sidebar-left {
      position: fixed;
      top: var(--header-height);
      left: 0;
      bottom: 0;
      width: var(--sidebar-width);
      background-color: var(--bg-sidebar-left);
      border-right: 1px solid var(--border-color);
      overflow-y: auto;
      z-index: 900;
      transition: transform 0.3s ease;
      display: flex;
      flex-direction: column;
    }
    .app-sidebar-left.collapsed {
      transform: translateX(-100%);
    }

    .loc-sidebar-header {
      padding: 14px 18px;
      border-bottom: 1px solid var(--border-color);
      background: var(--bg-secondary);
      position: sticky;
      top: 0;
      z-index: 10;
    }
    .loc-header-title {
      font-family: var(--font-heading);
      font-size: 14px;
      font-weight: 700;
      color: var(--accent-color);
      display: flex;
      align-items: center;
      justify-content: space-between;
    }
    .loc-page-pill {
      background: var(--accent-color);
      color: #fff;
      padding: 2px 8px;
      border-radius: 12px;
      font-size: 11.5px;
      font-weight: 700;
    }

    .loc-filter-box {
      margin-top: 10px;
    }
    .loc-filter-input {
      width: 100%;
      padding: 6px 10px;
      border-radius: 6px;
      border: 1px solid var(--border-color);
      background: var(--bg-primary);
      color: var(--text-primary);
      font-family: var(--font-body);
      font-size: 12.5px;
    }
    .loc-filter-input:focus {
      outline: none;
      border-color: var(--accent-color);
    }

    .loc-list-container {
      flex: 1;
      padding: 10px 14px 40px;
    }

    .loc-empty-state {
      padding: 30px 16px;
      text-align: center;
      color: var(--text-secondary);
      font-size: 13.5px;
    }

    .loc-card {
      background: var(--bg-card);
      border: 1px solid var(--border-color);
      border-radius: 8px;
      margin-bottom: 8px;
      overflow: hidden;
      transition: all 0.2s ease;
    }
    .loc-card:hover {
      border-color: var(--accent-color);
      box-shadow: var(--shadow-sm);
    }
    .loc-card.expanded {
      border-color: var(--accent-color);
      box-shadow: var(--shadow-md);
    }

    .loc-card-header {
      padding: 10px 12px;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: space-between;
      user-select: none;
      background: var(--bg-secondary);
      transition: background 0.15s;
    }
    .loc-card-header:hover {
      background: var(--accent-soft);
    }
    .loc-card-title-group {
      display: flex;
      flex-direction: column;
      gap: 2px;
    }
    .loc-card-name {
      font-weight: 700;
      font-size: 14px;
      color: var(--text-primary);
      display: flex;
      align-items: center;
      gap: 6px;
    }
    .loc-card-eng {
      font-size: 11.5px;
      color: var(--text-secondary);
    }
    .loc-type-badge {
      font-size: 10.5px;
      padding: 2px 6px;
      border-radius: 4px;
      background: var(--accent-soft);
      color: var(--accent-color);
      font-weight: 600;
      white-space: nowrap;
    }
    .loc-chevron {
      font-size: 10px;
      color: var(--text-secondary);
      transition: transform 0.2s;
    }
    .loc-card.expanded .loc-chevron {
      transform: rotate(180deg);
      color: var(--accent-color);
    }

    /* Expandable Location Details Sub-List */
    .loc-details-body {
      display: none;
      padding: 12px 14px;
      border-top: 1px dashed var(--border-color);
      background: var(--bg-primary);
      font-size: 12.5px;
      line-height: 1.6;
    }
    .loc-card.expanded .loc-details-body {
      display: block;
      animation: fadeIn 0.15s ease;
    }

    .loc-detail-row {
      margin-bottom: 7px;
      display: flex;
      flex-direction: column;
      gap: 1px;
    }
    .loc-detail-label {
      font-weight: 700;
      color: var(--text-secondary);
      font-size: 11px;
      text-transform: uppercase;
      letter-spacing: 0.3px;
    }
    .loc-detail-value {
      color: var(--text-primary);
    }

    .loc-page-badges-container {
      display: flex;
      flex-wrap: wrap;
      gap: 4px;
      margin-top: 3px;
    }
    .loc-page-chip {
      background: var(--bg-secondary);
      border: 1px solid var(--border-color);
      color: var(--accent-color);
      font-weight: 700;
      padding: 1px 6px;
      border-radius: 4px;
      font-size: 11px;
      text-decoration: none;
      transition: all 0.12s;
    }
    .loc-page-chip:hover {
      background: var(--accent-color);
      color: #fff;
      border-color: var(--accent-color);
    }
    .loc-page-chip.active-page-chip {
      background: var(--accent-color);
      color: #fff;
    }

    .loc-links-group {
      display: flex;
      flex-wrap: wrap;
      gap: 6px;
      margin-top: 6px;
    }
    .loc-btn-link {
      display: inline-flex;
      align-items: center;
      gap: 4px;
      padding: 4px 8px;
      border-radius: 4px;
      font-size: 11.5px;
      font-weight: 600;
      text-decoration: none;
      background: var(--bg-secondary);
      border: 1px solid var(--border-color);
      color: var(--text-primary);
      transition: all 0.15s;
    }
    .loc-btn-link:hover {
      background: var(--accent-color);
      color: #ffffff;
      border-color: var(--accent-color);
    }
    .loc-btn-link.iaa-link {
      color: #0369a1;
      border-color: #bae6fd;
      background: #f0f9ff;
    }
    .loc-btn-link.iaa-link:hover {
      background: #0284c7;
      color: #fff;
    }
    .loc-btn-link.map-btn-link {
      color: #047857;
      border-color: #a7f3d0;
      background: #ecfdf5;
    }
    .loc-btn-link.map-btn-link:hover {
      background: #059669;
      color: #fff;
    }

    /* Coordinate and Source Badges in Left Sidebar */
    .loc-coords-row {
      display: flex;
      align-items: center;
      gap: 6px;
      flex-wrap: wrap;
      margin-top: 5px;
    }
    .loc-coords-chip {
      display: inline-flex;
      align-items: center;
      gap: 3px;
      background: var(--accent-soft);
      color: var(--accent-color);
      border: 1px solid rgba(2, 132, 199, 0.28);
      font-size: 11px;
      font-weight: 700;
      padding: 1px 7px;
      border-radius: 4px;
      text-decoration: none;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, monospace;
      direction: ltr;
      transition: all 0.15s ease;
    }
    .loc-coords-chip:hover {
      background: var(--accent-color);
      color: #ffffff;
      border-color: var(--accent-color);
      box-shadow: 0 1px 3px rgba(2, 132, 199, 0.3);
    }
    .loc-source-pill {
      font-size: 10.5px;
      font-weight: 600;
      padding: 1px 6px;
      border-radius: 4px;
      text-decoration: none;
      display: inline-flex;
      align-items: center;
      gap: 2px;
    }
    .loc-source-pill.source-phd {
      background: #ecfdf5;
      color: #047857;
      border: 1px solid #a7f3d0;
    }
    [data-theme="dark"] .loc-source-pill.source-phd {
      background: rgba(16, 185, 129, 0.15);
      color: #34d399;
      border-color: rgba(16, 185, 129, 0.3);
    }
    .loc-source-pill.source-iaa {
      background: #fffbeb;
      color: #b45309;
      border: 1px solid #fde68a;
    }
    [data-theme="dark"] .loc-source-pill.source-iaa {
      background: rgba(245, 158, 11, 0.15);
      color: #fbbf24;
      border-color: rgba(245, 158, 11, 0.3);
    }
    .loc-source-pill.source-wiki {
      background: #f5f3ff;
      color: #6d28d9;
      border: 1px solid #ddd6fe;
      cursor: pointer;
      transition: all 0.15s;
    }
    .loc-source-pill.source-wiki:hover {
      background: #6d28d9;
      color: #ffffff;
    }
    [data-theme="dark"] .loc-source-pill.source-wiki {
      background: rgba(139, 92, 246, 0.15);
      color: #a78bfa;
      border-color: rgba(139, 92, 246, 0.3);
    }
    .loc-coords-btn {
      display: inline-flex;
      align-items: center;
      gap: 5px;
      padding: 4px 10px;
      border-radius: 5px;
      font-size: 12px;
      font-weight: 700;
      text-decoration: none;
      background: var(--accent-soft);
      color: var(--accent-color);
      border: 1px solid rgba(2, 132, 199, 0.25);
      transition: all 0.15s;
    }
    .loc-coords-btn:hover {
      background: var(--accent-color);
      color: #ffffff;
    }
    .loc-source-link {
      color: #6d28d9;
      text-decoration: underline;
      font-weight: 600;
    }
    [data-theme="dark"] .loc-source-link {
      color: #a78bfa;
    }

    /* In-Text Israeli Grid Coordinate Links (Light Yellow Background Highlight) */
    .grid-coord-link {
      background-color: #fef08a;
      color: #713f12;
      border-bottom: 2px solid #eab308;
      padding: 0 4px;
      border-radius: 3px;
      font-weight: 700;
      text-decoration: none;
      transition: all 0.15s ease;
      cursor: pointer;
      display: inline;
    }
    .grid-coord-link:hover {
      background-color: #fde047;
      color: #451a03;
      border-bottom-color: #ca8a04;
      box-shadow: 0 1px 4px rgba(234, 179, 8, 0.4);
      text-decoration: underline;
    }
    [data-theme="dark"] .grid-coord-link {
      background-color: #78350f;
      color: #fef08a;
      border-bottom: 2px solid #ca8a04;
    }
    [data-theme="dark"] .grid-coord-link:hover {
      background-color: #92400e;
      color: #fef9c3;
      border-bottom-color: #eab308;
      box-shadow: 0 1px 4px rgba(202, 138, 4, 0.5);
    }

    /* Main Reading Content Area */
    .main-container {
      margin-top: var(--header-height);
      margin-right: var(--sidebar-width);
      margin-left: var(--sidebar-width);
      flex: 1;
      padding: 36px 20px 80px;
      display: flex;
      flex-direction: column;
      align-items: center;
      transition: all 0.3s ease;
      min-width: 0;
    }
    .main-container.sidebar-right-closed {
      margin-right: 0;
    }
    .main-container.sidebar-left-closed {
      margin-left: 0;
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
      padding: 34px 38px;
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
      padding-bottom: 12px;
      margin-bottom: 22px;
    }

    .page-meta {
      display: flex;
      align-items: center;
      gap: 8px;
      flex-wrap: wrap;
    }

    .page-badge {
      background: var(--accent-color);
      color: #ffffff;
      font-weight: 700;
      font-size: 12px;
      padding: 3px 9px;
      border-radius: 6px;
    }

    .page-loc-badge {
      background: rgba(2, 132, 199, 0.12);
      color: var(--accent-color);
      font-weight: 700;
      font-size: 11.5px;
      padding: 3px 8px;
      border-radius: 6px;
      border: 1px solid rgba(2, 132, 199, 0.2);
      cursor: pointer;
      display: inline-flex;
      align-items: center;
      gap: 3px;
      transition: all 0.15s;
    }
    .page-loc-badge:hover {
      background: var(--accent-color);
      color: #fff;
    }

    .toc-badge {
      background: rgba(2, 132, 199, 0.1);
      color: var(--accent-color);
      font-size: 11.5px;
      font-weight: 600;
      padding: 3px 8px;
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
      gap: 5px;
    }

    .btn-action {
      background: var(--bg-primary);
      border: 1px solid var(--border-color);
      color: var(--text-primary);
      font-size: 12px;
      font-weight: 600;
      padding: 4px 10px;
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
      padding: 4px 8px;
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

    .loc-mention-highlight {
      background-color: #fde047;
      color: #0f172a;
      padding: 1px 4px;
      border-radius: 4px;
      font-weight: 700;
      box-shadow: 0 0 0 2px rgba(234, 179, 8, 0.4);
      display: inline;
    }

    [data-theme="dark"] .loc-mention-highlight {
      background-color: #854d0e;
      color: #fef08a;
      box-shadow: 0 0 0 2px rgba(250, 204, 21, 0.5);
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

    @media (max-width: 1200px) {
      .app-sidebar-left { transform: translateX(-100%); }
      .app-sidebar-left.open { transform: translateX(0); }
      .main-container { margin-left: 0; }
    }

    @media (max-width: 992px) {
      .app-sidebar-right { transform: translateX(100%); }
      .app-sidebar-right.open { transform: translateX(0); }
      .main-container { margin-right: 0; padding: 20px 12px; }
      .search-input { width: 160px; }
      .search-input:focus { width: 200px; }
    }
  </style>
</head>
<body>

  <!-- Top Header Navigation -->
  <header class="app-header">
    <div class="header-right">
      <button class="btn-toggle-sidebar" id="btnToggleToc" onclick="toggleRightSidebar()" title="פתח/סגור תוכן עניינים">
        <span>☰</span> <span>ראשי פרקים</span>
      </button>
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
      <button class="btn-toggle-sidebar active-btn" id="btnToggleLocs" onclick="toggleLeftSidebar()" title="פתח/סגור רשימת אתרים">
        <span>📍</span> <span>אתרים בעמוד</span>
      </button>
      <button class="btn-control" onclick="changeFontSize(1)" title="הגדל גופן">א+</button>
      <button class="btn-control" onclick="changeFontSize(-1)" title="הקטן גופן">א-</button>
      <button class="btn-control" onclick="toggleDarkMode()" title="מצב לילה/יום">🌓</button>
    </div>
  </header>

  <!-- Left Sidebar (Locations on Active Page) -->
  <aside id="sidebarLeft" class="app-sidebar-left">
    <div class="loc-sidebar-header">
      <div class="loc-header-title">
        <span>📍 אתרים בעמוד <span id="locCurrentPage">1</span></span>
        <span id="locCountBadge" class="loc-page-pill">0 אתרים</span>
      </div>
      <div class="loc-filter-box">
        <input type="text" id="locFilterInput" class="loc-filter-input" placeholder="סינון אתרים ברשימה..." oninput="filterLocationsList()">
      </div>
    </div>
    <div id="locListContainer" class="loc-list-container">
      <!-- Dynamic list of locations rendered via JS -->
    </div>
  </aside>

  <!-- Right Sidebar (Table of Contents) -->
  <aside id="sidebarRight" class="app-sidebar-right">
    <div class="sidebar-header">
      <span>תוכן העניינים וראשי פרקים</span>
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
    // Embedded Data: Locations per Page
    const LOCATIONS_BY_PAGE = ${JSON.stringify(locationsByPage)};

    ${clientJs}
  </script>
</body>
</html>`;

  const outHtmlPath = join(process.cwd(), 'data', 'dissertation_reader.html');
  writeFileSync(outHtmlPath, fullHtml, 'utf-8');
  console.log(`Saved updated Standalone HTML Reader with Left Locations Sidebar: ${outHtmlPath} (${(fullHtml.length / 1024).toFixed(1)} KB)`);

  try {
    console.log(`Syncing updated dissertation_reader.html to GCS (${OUTPUT_PREFIX})...`);
    execSync(`gcloud storage cp "${outHtmlPath}" "${OUTPUT_PREFIX}dissertation_reader.html"`, { stdio: 'inherit' });
    console.log('Successfully updated HTML reader in GCS!');
  } catch (err) {
    console.warn('GCS sync warning:', err.message);
  }
}

generateReaderHtml();

