import { readFileSync, writeFileSync } from 'node:fs';

const FIXES = {
  // 1. Horvat Uza (Fortress & Gate Channel)
  'uza': {
    names: ['חורבת עוזה', 'עוזה, חורבת', 'עוזה'],
    lat: '31.20919',
    lon: '35.16567',
    source: 'Beit-Arieh 2007; IAA Site 2612; Dissertation §2.9.34, pp. 164-165'
  },
  // 2. Horbat Tov (Fortress & Well)
  'tov': {
    names: ['חורבת טוב', 'טוב, חורבת', 'מצודת חורבת טוב', 'חרי טוב', 'חי טוב', 'ח\' טוב'],
    lat: '31.32771',
    lon: '35.14949',
    source: 'Dissertation §2.9.16, pp. 154-155 (נ.צ. 16430818 / 16430819)'
  },
  // 3. Site of Qal'a (Samaria)
  'qala': {
    names: ['קלע', 'אתר קלע', 'חורבת קלע'],
    lat: '32.05449',
    lon: '35.08647',
    source: 'Dissertation §2.9.21, p. 158 (נ.צ. 15841624)'
  }
};

// 1. Update data/locations_dissertation.json
const jsonPath = 'data/locations_dissertation.json';
const locs = JSON.parse(readFileSync(jsonPath, 'utf-8'));
let updatedJsonCount = 0;

locs.forEach(loc => {
  const name = (loc.location_name || '').trim();
  
  if (FIXES.uza.names.includes(name)) {
    loc.latitude = FIXES.uza.lat;
    loc.longitude = FIXES.uza.lon;
    updatedJsonCount++;
  } else if (FIXES.tov.names.includes(name) && !name.includes('טובס')) {
    loc.latitude = FIXES.tov.lat;
    loc.longitude = FIXES.tov.lon;
    updatedJsonCount++;
  } else if (FIXES.qala.names.includes(name) && !name.includes('מורטקה')) {
    loc.latitude = FIXES.qala.lat;
    loc.longitude = FIXES.qala.lon;
    updatedJsonCount++;
  }
});

writeFileSync(jsonPath, JSON.stringify(locs, null, 2), 'utf-8');
console.log(`Updated ${updatedJsonCount} entries in ${jsonPath}`);

// 2. Update data/locations_dissertation.csv
const csvPath = 'data/locations_dissertation.csv';
const csvLines = readFileSync(csvPath, 'utf-8').split('\n');
const newCsvLines = csvLines.map(line => {
  if (line.startsWith('"חורבת עוזה"')) {
    return line.replace(/"31\.20598","35\.16428"/, `"${FIXES.uza.lat}","${FIXES.uza.lon}"`);
  }
  if (line.startsWith('"חורבת טוב"') || line.startsWith('"מצודת חורבת טוב"') || line.startsWith('"ח\' טוב"')) {
    return line.replace(/"31\.00039","35\.08892"/, `"${FIXES.tov.lat}","${FIXES.tov.lon}"`);
  }
  if (line.startsWith('"קלע"') && !line.includes('מורטקה')) {
    return line.replace(/,"",""$/, `,"${FIXES.qala.lat}","${FIXES.qala.lon}"`);
  }
  return line;
});
writeFileSync(csvPath, newCsvLines.join('\n'), 'utf-8');
console.log(`Updated ${csvPath}`);

// 3. Update data/geocoded_locations.csv
const geocodedPath = 'data/geocoded_locations.csv';
const geoLines = readFileSync(geocodedPath, 'utf-8').split('\n');
const newGeoLines = [];

for (const line of geoLines) {
  if (!line.trim()) continue;
  
  if (line.startsWith('"חורבת עוזה"')) {
    const mapUrl = `https://www.google.com/maps?q=${FIXES.uza.lat},${FIXES.uza.lon}&ll=${FIXES.uza.lat},${FIXES.uza.lon}&z=17`;
    newGeoLines.push(`"חורבת עוזה","${FIXES.uza.lat}, ${FIXES.uza.lon}","PhD",1,true,"${mapUrl}"`);
  } else if (line.startsWith('"חורבת טוב"') || line.startsWith('"מצודת חורבת טוב"') || line.startsWith('"חרי טוב"')) {
    const m = line.match(/^"([^"]+)"/);
    const name = m ? m[1] : 'חורבת טוב';
    const mapUrl = `https://www.google.com/maps?q=${FIXES.tov.lat},${FIXES.tov.lon}&ll=${FIXES.tov.lat},${FIXES.tov.lon}&z=17`;
    newGeoLines.push(`"${name}","${FIXES.tov.lat}, ${FIXES.tov.lon}","PhD",1,true,"${mapUrl}"`);
  } else if (line.startsWith('"קלע"') && !line.includes('מורטקה')) {
    const isBest = line.includes('true');
    if (isBest) {
      const mapUrl = `https://www.google.com/maps?q=${FIXES.qala.lat},${FIXES.qala.lon}&ll=${FIXES.qala.lat},${FIXES.qala.lon}&z=17`;
      newGeoLines.push(`"קלע","${FIXES.qala.lat}, ${FIXES.qala.lon}","PhD",1,true,"${mapUrl}"`);
    } else {
      newGeoLines.push(line);
    }
  } else {
    newGeoLines.push(line);
  }
}

writeFileSync(geocodedPath, newGeoLines.join('\n'), 'utf-8');
console.log(`Updated ${geocodedPath}`);
