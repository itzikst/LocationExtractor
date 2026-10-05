import { readFileSync } from 'node:fs';

const allLocs = JSON.parse(readFileSync('data/locations_dissertation.json', 'utf8'));

const targets = [
  "בור מים מס' 1", "בור מים מס' 15", "בור מים מס' 17", "בור מים מס' 18", "בור מים מס' 19",
  "בריכה מטויחת בתוך הארמון", "תעלת הניקוז", "הבאר הקטנה", "הבור הקטן", "בור המים מס' 21",
  "הבריכה הגדולה (ג'ית)", "בריכה חצובה בסלע", "בריכת החצובה", "מגדל הבריכה", "מגדל המעיין",
  "תעלה IV", "תעלה V", "תעלה VI", "תעלה VII", "הבריכה העליונה", "הבריכה העשויה", "הבריכה התחתונה",
  "תעלת המים החשמונאית", "תעלת העודפים", "שלוש הבריכות", "תעלת המים", "בורות המים",
  "בור מס' 2", "בור מס' 20", "בור מס' 51", "בור מס' 52", "בור מס' 53", "בור מס' 40"
];

for (const t of targets) {
  const match = allLocs.find(l => l.location_name === t);
  if (match) {
    console.log(`- "${t}" -> Page ${match.page_number}, site_type: ${match.site_type}, context: ${match.context_summary || 'N/A'}`);
  }
}
