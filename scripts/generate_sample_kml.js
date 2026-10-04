import { readFileSync, writeFileSync } from 'node:fs';
import { execSync } from 'node:child_process';
import { join } from 'node:path';

function escapeXml(unsafe) {
  if (unsafe === null || unsafe === undefined) return '';
  return String(unsafe)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

const csv = readFileSync('data/water_installations_mymaps.csv', 'utf-8');
const lines = csv.trim().split('\n').slice(1);

function parseCsvLine(line) {
  const result = [];
  let cur = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (c === '"') {
      if (inQuotes && line[i + 1] === '"') {
        cur += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (c === ',' && !inQuotes) {
      result.push(cur);
      cur = '';
    } else {
      cur += c;
    }
  }
  result.push(cur);
  return result;
}

const parsed = lines.map(parseCsvLine);
// Filter for precise locations
const precise = parsed.filter(row => row[7] === 'Exact Archaeological Site / IAA Grid');

// Select 20 random sites with seed 777
function shuffle(array, seed = 42) {
  let m = array.length, t, i;
  let s = seed;
  function rnd() {
    s = (s * 9301 + 49297) % 233280;
    return s / 233280;
  }
  while (m) {
    i = Math.floor(rnd() * m--);
    t = array[m];
    array[m] = array[i];
    array[i] = t;
  }
  return array;
}

const sampled = shuffle([...precise], 777).slice(0, 20);

let placemarks = '';

sampled.forEach((s, idx) => {
  const name = s[0];
  const lat = s[1];
  const lon = s[2];
  const era = s[3];
  const type = s[4];
  const heb = s[5];
  const region = s[6];
  const precision = s[7];
  const dates = s[8];
  const section = s[9];
  const pages = s[10];
  const desc = s[11];

  placemarks += `    <Placemark>
      <name>${escapeXml(name)}</name>
      <description>${escapeXml(desc)}&#10;&#10;Installation: ${escapeXml(type)}&#10;Era: ${escapeXml(era)}&#10;Region: ${escapeXml(region)}&#10;Precision: ${escapeXml(precision)}&#10;Section: ${escapeXml(section)}&#10;Pages: ${escapeXml(pages)}</description>
      <Style>
        <IconStyle>
          <color>ff0000ff</color>
          <scale>1.2</scale>
          <Icon>
            <href>https://maps.google.com/mapfiles/kml/paddle/red-circle.png</href>
          </Icon>
        </IconStyle>
      </Style>
      <ExtendedData>
        <Data name="Sample_Number"><value>${idx + 1}</value></Data>
        <Data name="Era"><value>${escapeXml(era)}</value></Data>
        <Data name="Installation_Type"><value>${escapeXml(type)}</value></Data>
        <Data name="Hebrew_Name"><value>${escapeXml(heb)}</value></Data>
        <Data name="Region"><value>${escapeXml(region)}</value></Data>
        <Data name="Location_Precision"><value>${escapeXml(precision)}</value></Data>
        <Data name="Dates"><value>${escapeXml(dates)}</value></Data>
        <Data name="Chapter_Section"><value>${escapeXml(section)}</value></Data>
        <Data name="Dissertation_Pages"><value>${escapeXml(pages)}</value></Data>
        <Data name="Summary"><value>${escapeXml(desc)}</value></Data>
      </ExtendedData>
      <Point>
        <coordinates>${lon},${lat},0</coordinates>
      </Point>
    </Placemark>\n`;
});

const kmlContent = `<?xml version="1.0" encoding="UTF-8"?>
<kml xmlns="http://www.opengis.net/kml/2.2">
  <Document>
    <name>Sample 20 Precise Water Installations (for Review)</name>
    <description>20 randomly sampled archaeological water installation sites with verified precise coordinates from Dr. Zvika Tzuk's dissertation.</description>
${placemarks}  </Document>
</kml>`;

const outKml = join(process.cwd(), 'data', 'sample_20_precise_sites.kml');
writeFileSync(outKml, kmlContent, 'utf-8');
console.log(`[OK] Wrote KML sample to: ${outKml}`);

try {
  execSync(`gcloud storage cp "${outKml}" "gs://tsvika/output/sample_20_precise_sites.kml"`, { stdio: 'inherit' });
  console.log('[OK] Uploaded to gs://tsvika/output/sample_20_precise_sites.kml');
} catch (e) {
  console.error('Error uploading to GCS:', e.message);
}
