import { readFileSync } from 'node:fs';

const geo = JSON.parse(readFileSync('data/water_installations.geojson', 'utf-8'));

function inspectSite(siteName) {
  const matching = geo.features.filter(f => f.properties['location name'] === siteName);
  console.log(`\n=================== ${siteName} (${matching.length} eras) ===================`);
  matching.forEach(m => {
    const p = m.properties;
    console.log(`[Era: ${p.era}] | Section: ${p.section_ref} | Pages: ${p.source_pages ? p.source_pages.join(', ') : ''}`);
    console.log(`Installation: ${p.title}`);
    console.log(`Description: ${p.description.split('|')[0].trim()}`);
    console.log('---');
  });
}

inspectSite('Tel Megiddo');
inspectSite('Tel Hazor');
inspectSite('Tel Gezer');
inspectSite('Jerusalem (City of David)');
inspectSite('Tel Beersheba');
inspectSite('Tel Lachish');
inspectSite('Tel Shiloh');
