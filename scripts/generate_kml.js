import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { execSync } from 'node:child_process';
import { join } from 'node:path';

const BUCKET = 'tsvika';
const OUTPUT_PREFIX = `gs://${BUCKET}/output/`;

// Define 10 Eras with human-readable labels, Hebrew titles, date ranges, and distinct color hex codes
const ERA_CONFIG = [
  {
    key: 'Paleolithic_Epipaleolithic',
    name: '1. Paleolithic & Epi-Paleolithic (-20000 to -10000 BCE)',
    hebrewTitle: 'התקופה הפליאוליתית והאפי-פליאוליתית',
    color: 'ff7f0000', // KML format is aabbggrr (Alpha, Blue, Green, Red)
    hexColor: '#00007f',
    icon: 'http://maps.google.com/mapfiles/kml/paddle/blu-circle.png'
  },
  {
    key: 'Pre_Pottery_Neolithic',
    name: '2. Pre-Pottery Neolithic (PPN) (-8300 to -5500 BCE)',
    hebrewTitle: 'התקופה הניאוליתית הקדם-קרמית',
    color: 'ff993300',
    hexColor: '#003399',
    icon: 'http://maps.google.com/mapfiles/kml/paddle/blu-blank.png'
  },
  {
    key: 'Pottery_Neolithic',
    name: '3. Pottery Neolithic (PN) (-5500 to -4500 BCE)',
    hebrewTitle: 'התקופה הניאוליתית הקירמית',
    color: 'ffcc6600',
    hexColor: '#0066cc',
    icon: 'http://maps.google.com/mapfiles/kml/paddle/ltblu-blank.png'
  },
  {
    key: 'Chalcolithic',
    name: '4. Chalcolithic Period (-4500 to -3300 BCE)',
    hebrewTitle: 'התקופה הכלקוליתית',
    color: 'ff009933',
    hexColor: '#339900',
    icon: 'http://maps.google.com/mapfiles/kml/paddle/grn-blank.png'
  },
  {
    key: 'Early_Bronze',
    name: '5. Early Bronze Age (EB) (-3300 to -2200 BCE)',
    hebrewTitle: 'תקופת הברונזה הקדומה (EB I-IV)',
    color: 'ff0099ff',
    hexColor: '#ff9900',
    icon: 'http://maps.google.com/mapfiles/kml/paddle/orange-blank.png'
  },
  {
    key: 'Middle_Bronze',
    name: '6. Middle Bronze Age (MB) (-2200 to -1550 BCE)',
    hebrewTitle: 'תקופת הברונזה התיכונה (MB I-II)',
    color: 'ff0000cc',
    hexColor: '#cc0000',
    icon: 'http://maps.google.com/mapfiles/kml/paddle/red-blank.png'
  },
  {
    key: 'Late_Bronze',
    name: '7. Late Bronze Age (LB) (-1550 to -1200 BCE)',
    hebrewTitle: 'תקופת הברונזה המאוחרת (LB I-II)',
    color: 'ff990099',
    hexColor: '#990099',
    icon: 'http://maps.google.com/mapfiles/kml/paddle/purple-blank.png'
  },
  {
    key: 'Iron_Age_I',
    name: '8. Iron Age I (-1200 to -1000 BCE)',
    hebrewTitle: 'תקופת הברזל 1 (Iron I)',
    color: 'ffcc0066',
    hexColor: '#6600cc',
    icon: 'http://maps.google.com/mapfiles/kml/paddle/pink-blank.png'
  },
  {
    key: 'Iron_Age_II',
    name: '9. Iron Age II (-1000 to -586 BCE)',
    hebrewTitle: 'תקופת הברזל 2 (Iron IIA-IIC)',
    color: 'ff00cc99',
    hexColor: '#99cc00',
    icon: 'http://maps.google.com/mapfiles/kml/paddle/ylw-blank.png'
  },
  {
    key: 'Classical_Later',
    name: '10. Classical & Later Periods (-586 to +638 CE)',
    hebrewTitle: 'התקופות הקלאסיות (פרסית, הלניסטית, רומית, ביזנטית)',
    color: 'ff333333',
    hexColor: '#333333',
    icon: 'http://maps.google.com/mapfiles/kml/paddle/wht-blank.png'
  }
];

function escapeXml(unsafe) {
  if (unsafe === null || unsafe === undefined) return '';
  return String(unsafe)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function formatPlacemark(f, eraConfig) {
  const props = f.properties;
  const coords = f.geometry.coordinates; // [lng, lat]
  const lng = coords[0];
  const lat = coords[1];

  const englishName = props['location name'] || 'Unnamed Site';
  const hebrewName = props['location_name_he'] || '';
  const title = props.title || 'Water_Installation';
  const description = props.description || '';
  const region = props.region || '';
  const sectionRef = props.section_ref || '';
  const sourcePages = Array.isArray(props.source_pages) ? props.source_pages.join(', ') : (props.source_pages || '');
  const startYear = props['start year'];
  const endYear = props['end time'];

  // Clean description text without redundant prefix
  let cleanDesc = description;
  const descParts = description.split(' | ');
  if (descParts.length > 0) {
    cleanDesc = descParts[0];
  }

  const displayName = hebrewName ? `${englishName} (${hebrewName})` : englishName;

  return `      <Placemark>
        <name>${escapeXml(displayName)}</name>
        <description><![CDATA[
          <div style="font-family: Arial, sans-serif; font-size: 13px; line-height: 1.5;">
            <h3 style="margin-top: 0; color: #1a73e8;">${escapeXml(englishName)} ${hebrewName ? `<span style="font-size: 14px; color: #555;">(${escapeXml(hebrewName)})</span>` : ''}</h3>
            <p><strong>Installation Type:</strong> ${escapeXml(title.replace(/_/g, ' '))}</p>
            <p><strong>Era / Period:</strong> ${escapeXml(eraConfig.name)}</p>
            <p><strong>Dates:</strong> ${startYear} to ${endYear} ${endYear <= 0 ? 'BCE' : 'CE'}</p>
            <p><strong>Region:</strong> ${escapeXml(region)}</p>
            ${sectionRef ? `<p><strong>Chapter Section:</strong> ${escapeXml(sectionRef)}</p>` : ''}
            ${sourcePages ? `<p><strong>Dissertation Pages:</strong> ${escapeXml(sourcePages)}</p>` : ''}
            <hr style="border: 0; border-top: 1px solid #ddd; margin: 8px 0;"/>
            <p><strong>Description:</strong><br/>${escapeXml(cleanDesc)}</p>
          </div>
        ]]></description>
        <styleUrl>#style_${eraConfig.key}</styleUrl>
        <ExtendedData>
          <Data name="English_Name"><value>${escapeXml(englishName)}</value></Data>
          <Data name="Hebrew_Name"><value>${escapeXml(hebrewName)}</value></Data>
          <Data name="Installation_Type"><value>${escapeXml(title.replace(/_/g, ' '))}</value></Data>
          <Data name="Era"><value>${escapeXml(eraConfig.name)}</value></Data>
          <Data name="Start_Year"><value>${startYear}</value></Data>
          <Data name="End_Year"><value>${endYear}</value></Data>
          <Data name="Region"><value>${escapeXml(region)}</value></Data>
          <Data name="Chapter_Section"><value>${escapeXml(sectionRef)}</value></Data>
          <Data name="Dissertation_Pages"><value>${escapeXml(sourcePages)}</value></Data>
          <Data name="Summary"><value>${escapeXml(cleanDesc)}</value></Data>
        </ExtendedData>
        <Point>
          <coordinates>${lng},${lat},0</coordinates>
        </Point>
      </Placemark>`;
}

function main() {
  console.log('Generating Google MyMaps compatible KML with 10 Era Layers...');

  const geoJsonPath = join(process.cwd(), 'data', 'water_installations.geojson');
  if (!existsSync(geoJsonPath)) {
    throw new Error(`Cannot find ${geoJsonPath}`);
  }

  const geoData = JSON.parse(readFileSync(geoJsonPath, 'utf-8'));
  console.log(`Loaded ${geoData.features.length} GeoJSON features.`);

  // Group features by era
  const eraGroups = new Map();
  ERA_CONFIG.forEach(cfg => eraGroups.set(cfg.key, []));

  geoData.features.forEach(f => {
    const eraKey = f.properties.era;
    if (eraGroups.has(eraKey)) {
      eraGroups.get(eraKey).push(f);
    } else {
      console.warn(`Unmatched era: ${eraKey}`);
      // fallback to Iron Age II or last
      if (!eraGroups.has('Iron_Age_II')) eraGroups.set('Iron_Age_II', []);
      eraGroups.get('Iron_Age_II').push(f);
    }
  });

  // Generate Style definitions
  let stylesXml = '';
  for (const cfg of ERA_CONFIG) {
    stylesXml += `    <Style id="style_${cfg.key}">
      <IconStyle>
        <color>${cfg.color}</color>
        <scale>1.1</scale>
        <Icon>
          <href>${cfg.icon}</href>
        </Icon>
      </IconStyle>
      <LabelStyle>
        <scale>0.8</scale>
      </LabelStyle>
    </Style>\n`;
  }

  // Generate Folders (Layers for MyMaps)
  let foldersXml = '';
  for (const cfg of ERA_CONFIG) {
    const features = eraGroups.get(cfg.key) || [];
    console.log(`Layer: "${cfg.name}" -> ${features.length} sites`);

    foldersXml += `    <Folder>
      <name>${escapeXml(cfg.name)}</name>
      <description>${escapeXml(cfg.hebrewTitle)} - ${features.length} water installations (${cfg.name})</description>\n`;

    for (const f of features) {
      foldersXml += formatPlacemark(f, cfg) + '\n';
    }

    foldersXml += `    </Folder>\n`;
  }

  const fullKml = `<?xml version="1.0" encoding="UTF-8"?>
<kml xmlns="http://www.opengis.net/kml/2.2">
  <Document>
    <name>Ancient Water Installations in Israel (by Era)</name>
    <description>Ancient Water Systems in Settlements in Israel from the Neolithic to the Iron Age - by Dr. Zvika Tzuk. Separated into 10 historical era layers for Google My Maps.</description>
${stylesXml}
${foldersXml}  </Document>
</kml>`;

  const outKmlPath = join(process.cwd(), 'data', 'water_installations.kml');
  writeFileSync(outKmlPath, fullKml, 'utf-8');
  console.log(`\nWrote complete KML file: ${outKmlPath}`);

  // Also generate individual KML files per era in data/kml_by_era/
  const kmlDir = join(process.cwd(), 'data', 'kml_by_era');
  mkdirSync(kmlDir, { recursive: true });

  let index = 1;
  for (const cfg of ERA_CONFIG) {
    const features = eraGroups.get(cfg.key) || [];
    const prefix = String(index++).padStart(2, '0');
    const safeName = cfg.key;
    const singleKmlPath = join(kmlDir, `${prefix}_${safeName}.kml`);

    let singlePlacemarks = '';
    for (const f of features) {
      singlePlacemarks += formatPlacemark(f, cfg) + '\n';
    }

    const singleKml = `<?xml version="1.0" encoding="UTF-8"?>
<kml xmlns="http://www.opengis.net/kml/2.2">
  <Document>
    <name>${escapeXml(cfg.name)}</name>
    <description>${escapeXml(cfg.hebrewTitle)} (${features.length} sites)</description>
    <Style id="style_${cfg.key}">
      <IconStyle>
        <color>${cfg.color}</color>
        <scale>1.1</scale>
        <Icon>
          <href>${cfg.icon}</href>
        </Icon>
      </IconStyle>
    </Style>
    <Folder>
      <name>${escapeXml(cfg.name)}</name>
${singlePlacemarks}    </Folder>
  </Document>
</kml>`;

    writeFileSync(singleKmlPath, singleKml, 'utf-8');
  }

  console.log(`Generated 10 individual era KML files in ${kmlDir}`);

  // Upload to Google Cloud Storage
  console.log(`\nUploading KML file to ${OUTPUT_PREFIX}...`);
  execSync(`gcloud storage cp "${outKmlPath}" "${OUTPUT_PREFIX}water_installations.kml"`, { stdio: 'inherit' });
  execSync(`gcloud storage cp -r "${kmlDir}" "${OUTPUT_PREFIX}"`, { stdio: 'inherit' });

  console.log('Finished KML creation and upload successfully!');
}

main();
