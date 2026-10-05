import { readFileSync } from 'node:fs';

const locsPath = 'data/locations_dissertation.json';
const allLocs = JSON.parse(readFileSync(locsPath, 'utf8'));

const EXCLUDED_TYPES = new Set([
  'region', 'valley', 'mountain', 'river', 'lake', 'bay', 'fortifications', 'sea'
]);
const GENERIC_TYPOLOGY_TERMS = new Set([
  'אמת מים', 'באר', 'בארות שרשרת', 'בור', 'בריכה וסכר', 'מאגר תת קרקעי', 'מעיין', 'מעיין חתום', 'מפעל מים החצוב אל מי תהום', 'נחל/נהר', 'תמילה'
]);

const pointLocs = allLocs.filter(l => {
  const type = (l.site_type || '').toLowerCase().trim();
  if (EXCLUDED_TYPES.has(type)) return false;
  if (GENERIC_TYPOLOGY_TERMS.has(l.location_name)) return false;
  return true;
});

console.log(`Total point locations to review: ${pointLocs.length}`);

// Let's print all location names that contain complex installation phrases
const complex = pointLocs.filter(l => {
  const n = l.location_name;
  return n.includes('בור') || n.includes('מפעל') || n.includes('מנהר') || n.includes('בריכ') || n.includes('מעיין') || n.includes('באר') || n.includes('תעל') || n.includes('פיר') || n.includes('נקב') || n.includes('נימפיאון') || n.includes('ממגור') || n.includes('מיכל');
});

console.log(`Complex installation names: ${complex.length}`);
for (const c of complex) {
  console.log(`- ${c.location_name} (context: ${c.context_summary || ''})`);
}
