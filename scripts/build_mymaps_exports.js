import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { execSync } from 'node:child_process';
import { join } from 'node:path';
import { MASTER_ARCHAEOLOGICAL_GAZETTEER } from './archaeological_gazetteer.js';

const BUCKET = 'tsvika';
const OUTPUT_PREFIX = `gs://${BUCKET}/output/`;

const ERA_CONFIG = [
  {
    key: 'Paleolithic_Epipaleolithic',
    label: '01. Paleolithic & Epi-Paleolithic (-20000 to -10000 BCE)',
    hebrewTitle: 'התקופה הפליאוליתית והאפי-פליאוליתית',
    kmlColor: 'ff800000',
    hexColor: '#000080'
  },
  {
    key: 'Pre_Pottery_Neolithic',
    label: '02. Pre-Pottery Neolithic (PPN) (-8300 to -5500 BCE)',
    hebrewTitle: 'התקופה הניאוליתית הקדם-קרמית',
    kmlColor: 'ff993300',
    hexColor: '#003399'
  },
  {
    key: 'Pottery_Neolithic',
    label: '03. Pottery Neolithic (PN) (-5500 to -4500 BCE)',
    hebrewTitle: 'התקופה הניאוליתית הקירמית',
    kmlColor: 'ffcc6600',
    hexColor: '#0066cc'
  },
  {
    key: 'Chalcolithic',
    label: '04. Chalcolithic Period (-4500 to -3300 BCE)',
    hebrewTitle: 'התקופה הכלקוליתית',
    kmlColor: 'ff008800',
    hexColor: '#008800'
  },
  {
    key: 'Early_Bronze',
    label: '05. Early Bronze Age (EB) (-3300 to -2200 BCE)',
    hebrewTitle: 'תקופת הברונזה הקדומה (EB I-IV)',
    kmlColor: 'ff0088ff',
    hexColor: '#ff8800'
  },
  {
    key: 'Middle_Bronze',
    label: '06. Middle Bronze Age (MB) (-2200 to -1550 BCE)',
    hebrewTitle: 'תקופת הברונזה התיכונה (MB I-II)',
    kmlColor: 'ff0000cc',
    hexColor: '#cc0000'
  },
  {
    key: 'Late_Bronze',
    label: '07. Late Bronze Age (LB) (-1550 to -1200 BCE)',
    hebrewTitle: 'תקופת הברונזה המאוחרת (LB I-II)',
    kmlColor: 'ff880088',
    hexColor: '#880088'
  },
  {
    key: 'Iron_Age_I',
    label: '08. Iron Age I (-1200 to -1000 BCE)',
    hebrewTitle: 'תקופת הברזל 1 (Iron I)',
    kmlColor: 'ffbb0077',
    hexColor: '#7700bb'
  },
  {
    key: 'Iron_Age_II',
    label: '09. Iron Age II (-1000 to -586 BCE)',
    hebrewTitle: 'תקופת הברזל 2 (Iron IIA-IIC)',
    kmlColor: 'ff00bb88',
    hexColor: '#88bb00'
  },
  {
    key: 'Classical_Later',
    label: '10. Classical & Later Periods (-586 to +638 CE)',
    hebrewTitle: 'התקופות הקלאסיות (פרסית, הלניסטית, רומית, ביזנטית)',
    kmlColor: 'ff333333',
    hexColor: '#333333'
  }
];

function normalizeSiteName(name, heb) {
  let cleanEng = (name || '').trim().replace(/\s+/g, ' ');
  let cleanHeb = (heb || '').trim().replace(/\s+/g, ' ');
  const key = cleanEng.toLowerCase().replace(/[^a-z0-9]/g, '_').replace(/^_+|_+$/g, '').replace(/_+/g, '_');
  return { eng: cleanEng, heb: cleanHeb, key };
}

function escapeXml(unsafe) {
  if (unsafe === null || unsafe === undefined) return '';
  return String(unsafe)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function escapeCsvField(val) {
  if (val === null || val === undefined) return '""';
  const str = String(val).replace(/"/g, '""').replace(/[\r\n]+/g, ' ').trim();
  return `"${str}"`;
}

function main() {
  console.log('=== Cross-Referencing Gazetteer with Dissertation Data by Era ===');

  const geoJsonPath = join(process.cwd(), 'data', 'water_installations.geojson');
  if (!existsSync(geoJsonPath)) {
    throw new Error(`Cannot find ${geoJsonPath}`);
  }

  const geoData = JSON.parse(readFileSync(geoJsonPath, 'utf-8'));
  console.log(`Loaded ${geoData.features.length} extracted features.`);

  // 1. Group features by Era + SiteKey to ensure perfect isolation of era-specific descriptions
  const eraSiteMap = new Map();

  for (const f of geoData.features) {
    const p = f.properties;
    const eraKey = p.era || 'Iron_Age_II';
    const norm = normalizeSiteName(p['location name'], p.location_name_he);

    // Skip regional survey centroids (multi-site regional survey chapters)
    if (
      norm.key.includes('survey') ||
      (p.location_name_he && p.location_name_he.includes('סקר')) ||
      norm.key.includes('mount_manasseh') ||
      norm.key.includes('land_of_garu')
    ) {
      continue;
    }

    const groupKey = `${eraKey}:::${norm.key}`;
    const eraConfig = ERA_CONFIG.find(c => c.key === eraKey) || ERA_CONFIG[8];

    // Authoritative gazetteer cross-reference
    const gazEntry = MASTER_ARCHAEOLOGICAL_GAZETTEER[norm.key];
    if (!gazEntry) {
      console.warn(`Warning: Site ${norm.eng} (${norm.key}) not found in MASTER_ARCHAEOLOGICAL_GAZETTEER!`);
    }

    const siteLat = gazEntry ? gazEntry.lat : f.geometry.coordinates[1];
    const siteLon = gazEntry ? gazEntry.lon : f.geometry.coordinates[0];
    const precisionStr = gazEntry ? gazEntry.tier : (p.location_precision || 'Tier 1: High Precision (Pinpoint Well/Installation < 50m)');
    const officialHebName = gazEntry ? gazEntry.hebName : (p.location_name_he || '');
    const officialEngName = gazEntry ? gazEntry.name : norm.eng;

    // Clean summary for THIS specific era
    let descText = (p.description || '').split(' | ')[0].trim();
    const typeStr = (p.title || 'Water_Installation').replace(/_/g, ' ');
    const sectionStr = (p.section_ref && p.section_ref !== '2.9' && p.section_ref !== 'Summary') ? p.section_ref : '';
    const pageArr = Array.isArray(p.source_pages) ? p.source_pages : (p.source_pages ? [p.source_pages] : []);

    if (!eraSiteMap.has(groupKey)) {
      eraSiteMap.set(groupKey, {
        eraKey,
        eraConfig,
        key: norm.key,
        location_name: officialEngName,
        location_name_he: officialHebName,
        latitude: siteLat,
        longitude: siteLon,
        precisionStr,
        start_year: p['start year'],
        end_year: p['end time'],
        region: p.region || '',
        types: new Set([typeStr]),
        sections: new Set(sectionStr ? [sectionStr] : []),
        pages: new Set(pageArr),
        descriptions: [descText]
      });
    } else {
      const existing = eraSiteMap.get(groupKey);
      if (typeStr) existing.types.add(typeStr);
      if (sectionStr) existing.sections.add(sectionStr);
      pageArr.forEach(pg => existing.pages.add(pg));
      if (descText && !existing.descriptions.some(d => d.includes(descText.slice(0, 35)))) {
        existing.descriptions.push(descText);
      }
    }
  }

  const consolidatedSites = Array.from(eraSiteMap.values());
  console.log(`\nConsolidated to ${consolidatedSites.length} unique physical installation records across the 10 era layers.`);

  // Sort strictly by chronological era (01 -> 10) and then by site name
  consolidatedSites.sort((a, b) => {
    const eraIdxA = ERA_CONFIG.findIndex(c => c.key === a.eraKey);
    const eraIdxB = ERA_CONFIG.findIndex(c => c.key === b.eraKey);
    if (eraIdxA !== eraIdxB) return eraIdxA - eraIdxB;
    return a.location_name.localeCompare(b.location_name);
  });

  // Group sites by era for layer files
  const eraGroups = new Map();
  ERA_CONFIG.forEach(cfg => eraGroups.set(cfg.key, []));

  const csvRows = [];
  const geoJsonFeatures = [];

  for (const s of consolidatedSites) {
    const displayName = s.location_name_he ? `${s.location_name} (${s.location_name_he})` : s.location_name;
    const combinedType = Array.from(s.types).join(' / ');
    const combinedDesc = s.descriptions.join(' ');
    const combinedSections = Array.from(s.sections).join(', ');
    const combinedPages = Array.from(s.pages).sort((a, b) => Number(a) - Number(b)).join(', ');
    const datesStr = `${s.start_year} to ${s.end_year} ${s.end_year <= 0 ? 'BCE' : 'CE'}`;

    s.displayName = displayName;
    s.combinedType = combinedType;
    s.combinedDesc = combinedDesc;
    s.combinedSections = combinedSections;
    s.combinedPages = combinedPages;
    s.datesStr = datesStr;

    // 1. CSV Row for MyMaps
    csvRows.push([
      escapeCsvField(displayName),
      s.latitude,
      s.longitude,
      escapeCsvField(s.eraConfig.label),
      escapeCsvField(combinedType),
      escapeCsvField(s.location_name_he),
      escapeCsvField(s.region),
      escapeCsvField(s.precisionStr),
      escapeCsvField(datesStr),
      escapeCsvField(combinedSections),
      escapeCsvField(combinedPages),
      escapeCsvField(combinedDesc)
    ].join(','));

    // 2. GeoJSON Feature
    const geoTrendDesc = [
      combinedDesc,
      s.location_name_he ? `Hebrew: ${s.location_name_he}` : '',
      s.region ? `Region: ${s.region}` : '',
      `Precision: ${s.precisionStr}`,
      `Era: ${s.eraConfig.label}`,
      combinedSections ? `Section: ${combinedSections}` : '',
      combinedPages ? `Pages: ${combinedPages}` : ''
    ].filter(Boolean).join(' | ');

    geoJsonFeatures.push({
      type: 'Feature',
      geometry: {
        type: 'Point',
        coordinates: [s.longitude, s.latitude]
      },
      properties: {
        'location name': s.location_name,
        'location_name_he': s.location_name_he,
        latitude: s.latitude,
        longitude: s.longitude,
        'start year': s.start_year,
        'end time': s.end_year,
        title: Array.from(s.types)[0].replace(/\s+/g, '_'),
        description: geoTrendDesc,
        era: s.eraKey,
        region: s.region,
        location_precision: s.precisionStr,
        section_ref: combinedSections,
        source_pages: Array.from(s.pages)
      }
    });

    if (eraGroups.has(s.eraKey)) {
      eraGroups.get(s.eraKey).push(s);
    }
  }

  // -------------------------------------------------------------
  // 1. Write Google My Maps Master CSV (water_installations_mymaps.csv)
  // -------------------------------------------------------------
  const csvHeaders = [
    'Name',
    'Latitude',
    'Longitude',
    'Era',
    'Installation_Type',
    'Hebrew_Name',
    'Region',
    'Location_Precision',
    'Dates',
    'Chapter_Section',
    'Dissertation_Pages',
    'Description'
  ];
  const myMapsCsvContent = '\uFEFF' + [csvHeaders.join(','), ...csvRows].join('\r\n');
  const outCsvPath = join(process.cwd(), 'data', 'water_installations_mymaps.csv');
  writeFileSync(outCsvPath, myMapsCsvContent, 'utf-8');
  console.log(`[1] Wrote Google My Maps CSV: ${outCsvPath} (${csvRows.length} rows)`);

  // -------------------------------------------------------------
  // 2. Write GeoTrends CSV & GeoJSON
  // -------------------------------------------------------------
  const geoTrendsCsvHeader = 'location name,latitude,longitude,start year,end time,title,description';
  const geoTrendsCsvRows = consolidatedSites.map(s => {
    const geoTrendDesc = [
      s.descriptions.join(' '),
      s.location_name_he ? `Hebrew: ${s.location_name_he}` : '',
      s.region ? `Region: ${s.region}` : '',
      `Era: ${s.eraConfig.label}`,
      Array.from(s.sections).join(', ') ? `Section: ${Array.from(s.sections).join(', ')}` : '',
      Array.from(s.pages).join(', ') ? `Pages: ${Array.from(s.pages).join(', ')}` : ''
    ].filter(Boolean).join(' | ');

    return [
      escapeCsvField(s.location_name),
      s.latitude,
      s.longitude,
      s.start_year,
      s.end_year,
      escapeCsvField(Array.from(s.types)[0].replace(/\s+/g, '_')),
      escapeCsvField(geoTrendDesc)
    ].join(',');
  });

  const outGeoTrendsCsv = join(process.cwd(), 'data', 'water_installations.csv');
  const outGeoTrendsGeoJson = join(process.cwd(), 'data', 'water_installations.geojson');

  writeFileSync(outGeoTrendsCsv, [geoTrendsCsvHeader, ...geoTrendsCsvRows].join('\n'), 'utf-8');
  writeFileSync(outGeoTrendsGeoJson, JSON.stringify({ type: 'FeatureCollection', features: geoJsonFeatures }, null, 2), 'utf-8');
  console.log(`[2] Wrote GeoTrends CSV: ${outGeoTrendsCsv} & GeoJSON: ${outGeoTrendsGeoJson}`);

  // -------------------------------------------------------------
  // 3. Write Clean Master KML (water_installations.kml)
  // -------------------------------------------------------------
  let stylesXml = '';
  for (const cfg of ERA_CONFIG) {
    stylesXml += `    <Style id="style_${cfg.key}">
      <IconStyle>
        <color>${cfg.kmlColor}</color>
        <scale>1.1</scale>
        <Icon>
          <href>https://maps.google.com/mapfiles/kml/paddle/wht-blank.png</href>
        </Icon>
      </IconStyle>
    </Style>\n`;
  }

  let foldersXml = '';
  for (const cfg of ERA_CONFIG) {
    const items = eraGroups.get(cfg.key) || [];
    foldersXml += `    <Folder>
      <name>${escapeXml(cfg.label)}</name>
      <description>${escapeXml(cfg.hebrewTitle)} - ${items.length} sites</description>\n`;

    for (const item of items) {
      const eraShortName = item.eraConfig.label.split(' (')[0];
      const htmlPopup = `<h3>${escapeXml(item.displayName)}</h3>
<p><b>Period:</b> ${escapeXml(item.eraConfig.label)}</p>
<p><b>Installation Type:</b> ${escapeXml(item.combinedType)}</p>
<p><b>Location Precision:</b> ${escapeXml(item.precisionStr)}</p>
<p><b>Region:</b> ${escapeXml(item.region)}</p>
<p><b>Dissertation Reference:</b> §${escapeXml(item.combinedSections)} (Pages ${escapeXml(item.combinedPages)})</p>
<hr/>
<p><b>Archaeological Description (${escapeXml(eraShortName)}):</b></p>
<p>${escapeXml(item.combinedDesc)}</p>`;

      foldersXml += `      <Placemark>
        <name>${escapeXml(item.displayName)}</name>
        <description><![CDATA[${htmlPopup}]]></description>
        <styleUrl>#style_${cfg.key}</styleUrl>
        <ExtendedData>
          <Data name="Site_Name"><value>${escapeXml(item.location_name)}</value></Data>
          <Data name="Hebrew_Name"><value>${escapeXml(item.location_name_he)}</value></Data>
          <Data name="Era"><value>${escapeXml(item.eraConfig.label)}</value></Data>
          <Data name="Installation_Type"><value>${escapeXml(item.combinedType)}</value></Data>
          <Data name="Region"><value>${escapeXml(item.region)}</value></Data>
          <Data name="Location_Precision"><value>${escapeXml(item.precisionStr)}</value></Data>
          <Data name="Dates"><value>${escapeXml(item.datesStr)}</value></Data>
          <Data name="Chapter_Section"><value>${escapeXml(item.combinedSections)}</value></Data>
          <Data name="Dissertation_Pages"><value>${escapeXml(item.combinedPages)}</value></Data>
          <Data name="Description"><value>${escapeXml(item.combinedDesc)}</value></Data>
        </ExtendedData>
        <Point>
          <coordinates>${item.longitude},${item.latitude},0</coordinates>
        </Point>
      </Placemark>\n`;
    }

    foldersXml += `    </Folder>\n`;
  }

  const masterKml = `<?xml version="1.0" encoding="UTF-8"?>
<kml xmlns="http://www.opengis.net/kml/2.2">
  <Document>
    <name>Ancient Water Installations in Israel (by Era)</name>
    <description>Ancient Water Systems in Settlements in Israel from the Neolithic to the End of the Iron Age - by Dr. Zvika Tzuk (Tel Aviv University, 2000).</description>
${stylesXml}
${foldersXml}  </Document>
</kml>`;

  const outKmlPath = join(process.cwd(), 'data', 'water_installations.kml');
  writeFileSync(outKmlPath, masterKml, 'utf-8');
  console.log(`[3] Wrote Clean Master KML: ${outKmlPath}`);

  // -------------------------------------------------------------
  // 4. Write Individual Layer KML Files (data/kml_layers/) & CSV (data/csv_layers/)
  // -------------------------------------------------------------
  const kmlLayersDir = join(process.cwd(), 'data', 'kml_layers');
  mkdirSync(kmlLayersDir, { recursive: true });

  const csvLayersDir = join(process.cwd(), 'data', 'csv_layers');
  mkdirSync(csvLayersDir, { recursive: true });

  let idx = 1;
  for (const cfg of ERA_CONFIG) {
    const items = eraGroups.get(cfg.key) || [];
    const prefix = String(idx++).padStart(2, '0');
    const filenameKml = `${prefix}_${cfg.key}.kml`;
    const filenameCsv = `${prefix}_${cfg.key}.csv`;
    const layerPathKml = join(kmlLayersDir, filenameKml);
    const layerPathCsv = join(csvLayersDir, filenameCsv);

    // KML Placemarks
    let placemarks = '';
    const layerCsvRows = [];

    for (const item of items) {
      const eraShortName = item.eraConfig.label.split(' (')[0];
      const htmlPopup = `<h3>${escapeXml(item.displayName)}</h3>
<p><b>Period:</b> ${escapeXml(item.eraConfig.label)}</p>
<p><b>Installation Type:</b> ${escapeXml(item.combinedType)}</p>
<p><b>Location Precision:</b> ${escapeXml(item.precisionStr)}</p>
<p><b>Region:</b> ${escapeXml(item.region)}</p>
<p><b>Dissertation Reference:</b> §${escapeXml(item.combinedSections)} (Pages ${escapeXml(item.combinedPages)})</p>
<hr/>
<p><b>Archaeological Description (${escapeXml(eraShortName)}):</b></p>
<p>${escapeXml(item.combinedDesc)}</p>`;

      placemarks += `    <Placemark>
      <name>${escapeXml(item.displayName)}</name>
      <description><![CDATA[${htmlPopup}]]></description>
      <styleUrl>#style_${cfg.key}</styleUrl>
      <ExtendedData>
        <Data name="Site_Name"><value>${escapeXml(item.location_name)}</value></Data>
        <Data name="Hebrew_Name"><value>${escapeXml(item.location_name_he)}</value></Data>
        <Data name="Era"><value>${escapeXml(item.eraConfig.label)}</value></Data>
        <Data name="Installation_Type"><value>${escapeXml(item.combinedType)}</value></Data>
        <Data name="Region"><value>${escapeXml(item.region)}</value></Data>
        <Data name="Location_Precision"><value>${escapeXml(item.precisionStr)}</value></Data>
        <Data name="Dates"><value>${escapeXml(item.datesStr)}</value></Data>
        <Data name="Chapter_Section"><value>${escapeXml(item.combinedSections)}</value></Data>
        <Data name="Dissertation_Pages"><value>${escapeXml(item.combinedPages)}</value></Data>
        <Data name="Description"><value>${escapeXml(item.combinedDesc)}</value></Data>
      </ExtendedData>
      <Point>
        <coordinates>${item.longitude},${item.latitude},0</coordinates>
      </Point>
    </Placemark>\n`;

      layerCsvRows.push([
        escapeCsvField(item.displayName),
        item.latitude,
        item.longitude,
        escapeCsvField(item.eraConfig.label),
        escapeCsvField(item.combinedType),
        escapeCsvField(item.location_name_he),
        escapeCsvField(item.region),
        escapeCsvField(item.precisionStr),
        escapeCsvField(item.datesStr),
        escapeCsvField(item.combinedSections),
        escapeCsvField(item.combinedPages),
        escapeCsvField(item.combinedDesc)
      ].join(','));
    }

    const layerKml = `<?xml version="1.0" encoding="UTF-8"?>
<kml xmlns="http://www.opengis.net/kml/2.2">
  <Document>
    <name>${escapeXml(cfg.label)}</name>
    <description>${escapeXml(cfg.hebrewTitle)} - ${items.length} sites. From Dr. Zvika Tzuk's Dissertation.</description>
    <Style id="style_${cfg.key}">
      <IconStyle>
        <color>${cfg.kmlColor}</color>
        <scale>1.1</scale>
        <Icon>
          <href>https://maps.google.com/mapfiles/kml/paddle/wht-blank.png</href>
        </Icon>
      </IconStyle>
    </Style>
${placemarks}  </Document>
</kml>`;

    writeFileSync(layerPathKml, layerKml, 'utf-8');

    const layerCsv = '\uFEFF' + [csvHeaders.join(','), ...layerCsvRows].join('\r\n');
    writeFileSync(layerPathCsv, layerCsv, 'utf-8');
  }
  console.log(`[4] Wrote 10 Individual Layer KML files in ${kmlLayersDir}`);
  console.log(`[5] Wrote 10 Individual Layer CSV files in ${csvLayersDir}`);

  // -------------------------------------------------------------
  // 5. Cloud Upload to GCS
  // -------------------------------------------------------------
  try {
    console.log(`\nSyncing all outputs to GCS bucket ${OUTPUT_PREFIX}...`);
    execSync(`gcloud storage cp ${outCsvPath} ${OUTPUT_PREFIX}water_installations_mymaps.csv`, { stdio: 'inherit' });
    execSync(`gcloud storage cp ${outGeoTrendsCsv} ${OUTPUT_PREFIX}water_installations.csv`, { stdio: 'inherit' });
    execSync(`gcloud storage cp ${outGeoTrendsGeoJson} ${OUTPUT_PREFIX}water_installations.geojson`, { stdio: 'inherit' });
    execSync(`gcloud storage cp ${outKmlPath} ${OUTPUT_PREFIX}water_installations.kml`, { stdio: 'inherit' });
    execSync(`gcloud storage cp ${kmlLayersDir}/*.kml ${OUTPUT_PREFIX}kml_layers/`, { stdio: 'inherit' });
    execSync(`gcloud storage cp ${csvLayersDir}/*.csv ${OUTPUT_PREFIX}csv_layers/`, { stdio: 'inherit' });
    console.log('All files successfully uploaded to GCS!');
  } catch (err) {
    console.warn(`GCS upload warning: ${err.message}`);
  }

  console.log('\n=== Export Generation Completed Successfully! ===');
}

main();
