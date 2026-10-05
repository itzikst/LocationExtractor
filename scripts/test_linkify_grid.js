import { readFileSync, writeFileSync } from 'node:fs';
import { icsToWgs84 } from './archaeological_gazetteer.js';

export function parseGridRefAccurate(gridStr) {
  if (!gridStr) return null;
  
  const sepMatch = gridStr.match(/^([0-9]{3,6})\s*[\/\-–\.]\s*([0-9]{3,6})$/);
  let cleanE = '';
  let cleanN = '';
  
  if (sepMatch) {
    cleanE = sepMatch[1];
    cleanN = sepMatch[2];
  } else {
    const digits = gridStr.replace(/\D/g, '');
    if (digits.length === 6) {
      cleanE = digits.slice(0, 3);
      cleanN = digits.slice(3, 6);
    } else if (digits.length === 8) {
      cleanE = digits.slice(0, 4);
      cleanN = digits.slice(4, 8);
    } else if (digits.length === 10) {
      cleanE = digits.slice(0, 5);
      cleanN = digits.slice(5, 10);
    } else if (digits.length === 12) {
      cleanE = digits.slice(0, 6);
      cleanN = digits.slice(6, 12);
    } else {
      return null;
    }
  }

  let east = parseInt(cleanE, 10);
  let north = parseInt(cleanN, 10);

  if (cleanE.length === 3) east *= 1000;
  else if (cleanE.length === 4) east *= 100;
  else if (cleanE.length === 5) east *= 10;
  
  if (cleanN.length === 3) north *= 1000;
  else if (cleanN.length === 4) north *= 100;
  else if (cleanN.length === 5) north *= 10;

  return icsToWgs84(east, north);
}

// Transform text/HTML by finding Israeli Grid occurrences and turning them into clickable Google Maps links
export function linkifyIsraeliGridCoords(html) {
  if (!html) return '';

  // 1. First fix any split between נ.צ. and coordinates across </p><p...> tags
  let processed = html.replace(
    /((?:ב|ל)?נ[\.״\"\'\s]*[י]?[\.״\"\'\s]*[צץ][\.״\"\'\s]*(?:(?:\.U\.T\.M|\.UTM|UTM)[\.\s]*)?[:\-]?)\s*<\/p>\s*<p[^>]*>\s*([0-9]{3,6}(?:[\.\/\-–\s]+[0-9]{3,6})|[0-9]{6,10})/gi,
    '$1 $2'
  );

  // 2. Comprehensive regex matching Israeli Grid coordinates
  // Matches:
  // (נ.צ. 14721537)
  // בנ"צ 20245/26922
  // בניצ 20169/26938
  // נ.צ. 1718.2538
  // נ.צ. 1495312430
  // נ.צ. U.T.M. 72115278
  const gridRegex = /((?:ב|ל)?נ[\.״\"\'\s]*[י]?[\.״\"\'\s]*[צץ][\.״\"\'\s]*(?:(?:\.U\.T\.M|\.UTM|UTM)[\.\s]*)?[:\-]?\s*)([0-9]{3,6}(?:[\.\/\-–\s]+[0-9]{3,6})|[0-9]{6,10})/gi;

  processed = processed.replace(gridRegex, (match, prefix, numStr) => {
    // Avoid double linking if already inside an <a> tag
    const geo = parseGridRefAccurate(numStr);
    if (!geo) return match;

    const mapUrl = `https://www.google.com/maps?q=${geo.lat},${geo.lon}&ll=${geo.lat},${geo.lon}&z=17`;
    const cleanPrefix = prefix.trim();
    const cleanNum = numStr.trim();
    const isBeth = cleanPrefix.startsWith('ב');
    const isLamed = cleanPrefix.startsWith('ל');
    const prefixLetter = isBeth ? 'ב' : (isLamed ? 'ל' : '');
    const mainPrefix = prefixLetter ? cleanPrefix.slice(1).trim() : cleanPrefix;

    return `${prefixLetter}<a href="${mapUrl}" target="_blank" rel="noopener" class="grid-coord-link" title="רשת ישראל נ.צ. ${cleanNum} (WGS84: ${geo.lat}, ${geo.lon}) - פתח ב-Google Maps (זום 17)">📍 ${mainPrefix} ${cleanNum} ↗</a>`;
  });

  return processed;
}

const pages = JSON.parse(readFileSync('data/post_processed_pages.json', 'utf-8'));
console.log('Testing linkifyIsraeliGridCoords on all pages...');

let totalLinksCreated = 0;
for (const p of pages) {
  const original = p.clean_html || p.clean_markdown || '';
  const transformed = linkifyIsraeliGridCoords(original);
  const count = (transformed.match(/class="grid-coord-link"/g) || []).length;
  if (count > 0) {
    totalLinksCreated += count;
    console.log(`Page ${p.page_number}: ${count} grid links created`);
    // print matches
    const linkMatches = transformed.match(/<a href="https:\/\/www\.google\.com\/maps\?[^"]+"[^>]*>[^<]+<\/a>/g);
    if (linkMatches) {
      linkMatches.forEach(l => console.log('   ->', l));
    }
  }
}

console.log(`Total grid links created across all pages: ${totalLinksCreated}`);
