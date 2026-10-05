import { readFileSync } from 'node:fs';

const lines = readFileSync('data/geocoded_locations.csv', 'utf8').trim().split('\n').slice(1);
const rows = [];

for (const line of lines) {
  const match = line.match(/^"([^"]+)","([^"]+)","([^"]+)",(\d+),(true|false),"([^"]+)"$/);
  if (!match) continue;
  const [_, name, coords, source, numGeocodes, isBestStr, gmapsUrl] = match;
  if (isBestStr === 'true') {
    const [lat, lon] = coords.split(',').map(n => parseFloat(n.trim()));
    rows.push({ name, coords, lat, lon, source, gmapsUrl });
  }
}

console.log(`Total best candidate locations to audit: ${rows.length}`);

// Audit rules
const issues = [];

for (const r of rows) {
  const n = r.name;
  
  // Rule 1: Egyptian sites
  if ((n.includes('מצרים') || n.includes('מרסה מטרוח') || n.includes('דיר אל-מדינה')) && r.lon > 34.0) {
    issues.push({ name: n, coords: r.coords, source: r.source, reason: 'Egyptian site located in Israel/Levant' });
  }

  // Rule 2: Gibeon sites not in Gibeon
  if (n.includes('גבעון') && (r.lat > 31.86 || r.lat < 31.83 || r.lon > 35.20 || r.lon < 35.17)) {
    issues.push({ name: n, coords: r.coords, source: r.source, reason: 'Gibeon installation not near Gibeon (31.848, 35.186)' });
  }

  // Rule 3: Tel Dan sites not in Tel Dan
  if (n.includes('תל דן') || n.includes('הדן') || n.includes('בולען בתל דן')) {
    if (r.lat < 33.20 || r.lon < 35.60) {
      issues.push({ name: n, coords: r.coords, source: r.source, reason: 'Tel Dan site not near Tel Dan (33.248, 35.652)' });
    }
  }

  // Rule 4: Hazor sites not in Hazor
  if (n.includes('חצור') && (r.lat < 32.95 || r.lat > 33.05)) {
    issues.push({ name: n, coords: r.coords, source: r.source, reason: 'Hazor site not near Hazor (33.017, 35.568)' });
  }

  // Rule 5: Megiddo sites not in Megiddo
  if (n.includes('מגידו') && (r.lat < 32.55 || r.lat > 32.60)) {
    issues.push({ name: n, coords: r.coords, source: r.source, reason: 'Megiddo site not near Megiddo (32.585, 35.184)' });
  }

  // Rule 6: Arad cisterns / silos (e.g., בור 147, ממגורה 275)
  if ((n.startsWith('בור ') || n.startsWith('ממגורה ')) && /^\d+$/.test(n.replace(/^(בור|ממגורה)\s+/, '').trim())) {
    // Check if near Arad
    if (r.lat > 31.5 || r.lat < 31.1 || r.lon < 35.0 || r.lon > 35.3) {
      issues.push({ name: n, coords: r.coords, source: r.source, reason: 'Arad cistern/silo not near Arad (31.281, 35.125)' });
    }
  }

  // Rule 7: Samos / Eupalinos Tunnel (Greece)
  if (n.includes('סמוס') || n.includes('סאמוס') || n.includes('אופלינוס')) {
    if (r.lat < 37.0 || r.lon > 28.0) {
      issues.push({ name: n, coords: r.coords, source: r.source, reason: 'Samos/Eupalinos Tunnel not in Greece/Samos' });
    }
  }

  // Rule 8: Athens
  if (n.includes('אתונה') && (r.lat < 37.5 || r.lat > 38.5 || r.lon < 23.0 || r.lon > 24.0)) {
    issues.push({ name: n, coords: r.coords, source: r.source, reason: 'Athens installation not in Athens' });
  }

  // Rule 9: Assyria / Mesopotamia (Erbil, Nimrud, Bavian, Khinis, Sennacherib)
  if ((n.includes('אירביל') || n.includes('נמרוד') || n.includes('סנחריב') || n.includes('חינס')) && (r.lat < 35.0 || r.lon < 40.0)) {
    issues.push({ name: n, coords: r.coords, source: r.source, reason: 'Mesopotamian site not in Iraq' });
  }

  // Rule 10: Cisterns numbered 1, 15, 17, 18, 19 (Tell Beit Mirsim / Lachish / Jerusalem)
  if (n.includes("בור מים מס'") && r.coords === '31.77889, 35.22556') {
    issues.push({ name: n, coords: r.coords, source: r.source, reason: 'Numbered cisterns assigned generic Jerusalem centroid' });
  }
}

console.log(`\nTotal detected audit issues: ${issues.length}`);
for (const iss of issues) {
  console.log(`- [${iss.reason}] "${iss.name}" -> ${iss.coords} (${iss.source})`);
}
