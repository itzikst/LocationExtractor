import { writeFileSync } from 'node:fs';
import { MASTER_ARCHAEOLOGICAL_GAZETTEER } from './archaeological_gazetteer.js';

function exportCsv() {
  const headers = ['Tier', 'Site_Name', 'Hebrew_Name', 'Latitude', 'Longitude', 'Key', 'Source', 'Notes'];
  const rows = [];

  for (const [key, val] of Object.entries(MASTER_ARCHAEOLOGICAL_GAZETTEER)) {
    const row = [
      val.tier || '',
      val.name || '',
      val.hebName || '',
      val.lat,
      val.lon,
      key,
      val.source || '',
      val.notes || ''
    ];
    rows.push(row.map(f => {
      if (typeof f === 'number') return f;
      return '"' + String(f).replace(/"/g, '""') + '"';
    }).join(','));
  }

  // Sort by Tier, then by Name
  rows.sort((a, b) => a.localeCompare(b));

  const csvContent = '\uFEFF' + [headers.join(','), ...rows].join('\r\n');
  writeFileSync('data/master_gazetteer_by_tier.csv', csvContent, 'utf-8');
  console.log(`Successfully exported data/master_gazetteer_by_tier.csv (${rows.length} sites)`);
}

exportCsv();
