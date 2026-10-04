import fs from 'node:fs';

const geo = JSON.parse(fs.readFileSync('data/water_installations.geojson', 'utf-8'));
console.log('Total features:', geo.features.length);

const eraSiteCounts = {};

geo.features.forEach((f, idx) => {
  const era = f.properties.era || 'Unknown';
  // Normalize name to catch variants like "Tel Lachish", "Lachish", "תל לכיש"
  const rawEng = (f.properties['location name'] || '').trim();
  const rawHeb = (f.properties.location_name_he || '').trim();
  const normEng = rawEng.replace(/^(Tel|Tell|Khirbet|Horbat|Horvat|Ein|Bir)\s+/i, '').toLowerCase().trim();
  const normHeb = rawHeb.replace(/^(תל|חירבת|חורבת|ח'רבת|עין|באר)\s+/i, '').trim();
  
  const key = `${era}:::${normEng || normHeb}`;
  
  if (!eraSiteCounts[key]) {
    eraSiteCounts[key] = [];
  }
  eraSiteCounts[key].push({
    idx,
    eng: rawEng,
    heb: rawHeb,
    title: f.properties.title,
    section: f.properties.section_ref,
    pages: f.properties.source_pages,
    desc: f.properties.description
  });
});

let totalDups = 0;
for (const key in eraSiteCounts) {
  if (eraSiteCounts[key].length > 1) {
    totalDups++;
    const [era, name] = key.split(':::');
    console.log(`\nDuplicate in Era [${era}]: "${name}" (${eraSiteCounts[key].length} occurrences):`);
    eraSiteCounts[key].forEach((item, i) => {
      console.log(`  [${i + 1}] "${item.eng}" (${item.heb}) | Title: ${item.title} | Section: ${item.section} | Pages: ${item.pages} | Desc: ${item.desc ? item.desc.slice(0, 110) : ''}...`);
    });
  }
}
console.log(`\nTotal duplicate site groups found within eras: ${totalDups}`);
