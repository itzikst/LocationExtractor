import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { execSync } from 'node:child_process';
import { join } from 'node:path';

const BUCKET = 'tsvika';
const OUTPUT_PREFIX = `gs://${BUCKET}/output/`;

// Period to Chronological Range Mapping (Years BCE as negative numbers, CE as positive)
const PERIOD_RANGES = [
  { match: /neolithic|ppna|ppnb/i, name: 'Neolithic', start: -10000, end: -5800 },
  { match: /chalcolithic/i, name: 'Chalcolithic', start: -5800, end: -3600 },
  { match: /early bronze|eb\b|eb\s*i|eb\s*ii|eb\s*iii|eb\s*iv/i, name: 'Early Bronze', start: -3600, end: -2000 },
  { match: /middle bronze|mb\b|mb\s*i|mb\s*ii/i, name: 'Middle Bronze', start: -2000, end: -1500 },
  { match: /late bronze|lb\b|lb\s*i|lb\s*ii/i, name: 'Late Bronze', start: -1500, end: -1200 },
  { match: /iron\s*(age)?\s*i\b|early iron/i, name: 'Iron Age I', start: -1200, end: -1000 },
  { match: /iron\s*(age)?\s*ii|late iron|iron\s*age\b|israelite/i, name: 'Iron Age II', start: -1000, end: -586 },
  { match: /persian/i, name: 'Persian', start: -586, end: -332 },
  { match: /hellenistic/i, name: 'Hellenistic', start: -332, end: -37 },
  { match: /roman|herodian/i, name: 'Roman', start: -37, end: 324 },
  { match: /byzantine/i, name: 'Byzantine', start: 324, end: 638 },
  { match: /islamic|umayyad|abbasid|mamluk|crusader/i, name: 'Medieval', start: 638, end: 1517 },
  { match: /ottoman/i, name: 'Ottoman', start: 1517, end: 1917 }
];

function resolvePeriods(periodStrings) {
  if (!periodStrings || !Array.isArray(periodStrings) || periodStrings.length === 0) {
    // Default broad span of the dissertation: Bronze to Iron Age (-3300 to -586)
    return [{ name: 'Bronze_to_Iron_Age', start: -3300, end: -586 }];
  }

  const matched = [];
  const text = periodStrings.join(' ').toLowerCase();

  for (const pr of PERIOD_RANGES) {
    if (pr.match.test(text)) {
      matched.push({ name: pr.name.replace(/\s+/g, '_'), start: pr.start, end: pr.end });
    }
  }

  if (matched.length === 0) {
    return [{ name: 'Ancient_Period', start: -3300, end: -586 }];
  }

  return matched;
}

function resolveTitle(waterType, siteType) {
  const combined = `${Array.isArray(waterType) ? waterType.join(' ') : (waterType || '')} ${Array.isArray(siteType) ? siteType.join(' ') : (siteType || '')}`.toLowerCase();
  if (combined.includes('tunnel') || combined.includes('shaft') || combined.includes('gallery')) return 'Water_Tunnel_Shaft';
  if (combined.includes('well') || combined.includes('באר')) return 'Deep_Well';
  if (combined.includes('cistern') || combined.includes('בור')) return 'Plastered_Cistern';
  if (combined.includes('reservoir') || combined.includes('מאגר') || combined.includes('pool') || combined.includes('בריכה')) return 'Water_Reservoir';
  if (combined.includes('spring') || combined.includes('מעיין') || combined.includes('cave')) return 'Spring_Cave_Capture';
  if (combined.includes('aqueduct') || combined.includes('אמה') || combined.includes('channel') || combined.includes('qanat')) return 'Aqueduct_Channel';
  if (combined.includes('tel') || combined.includes('settlement') || combined.includes('city')) return 'Ancient_City_Water_System';
  return 'Water_Installation';
}

function cleanDescription(site) {
  const parts = [];
  if (site.water_system_summary) {
    const summary = Array.isArray(site.water_system_summary) ? site.water_system_summary.join(' ') : String(site.water_system_summary);
    parts.push(summary.replace(/[\r\n]+/g, ' ').trim());
  } else if (site.water_system_type) {
    const wType = Array.isArray(site.water_system_type) ? site.water_system_type.join(' ') : String(site.water_system_type);
    parts.push(wType.replace(/[\r\n]+/g, ' ').trim());
  }
  if (site.site_name_he) {
    parts.push(`Hebrew: ${site.site_name_he}`);
  }
  if (site.region) {
    parts.push(`Region: ${site.region}`);
  }
  if (site.source_pages && Array.isArray(site.source_pages) && site.source_pages.length > 0) {
    parts.push(`Pages: ${site.source_pages.join(', ')}`);
  }
  return parts.join(' | ');
}

function escapeCsvField(val) {
  if (val === null || val === undefined) return '""';
  const str = String(val).replace(/"/g, '""').replace(/\r?\n/g, ' ');
  return `"${str}"`;
}

function main() {
  console.log('Building GeoTrends "Water Installations" dataset...');

  const rawJsonPath = join(process.cwd(), 'data', 'archaeological_sites.json');
  if (!existsSync(rawJsonPath)) {
    throw new Error(`Cannot find ${rawJsonPath}`);
  }

  const rawSites = JSON.parse(readFileSync(rawJsonPath, 'utf-8'));
  console.log(`Loaded ${rawSites.length} raw sites.`);

  // Filter sites with valid coordinates
  const validSites = rawSites.filter(s =>
    typeof s.latitude === 'number' &&
    typeof s.longitude === 'number' &&
    !isNaN(s.latitude) &&
    !isNaN(s.longitude) &&
    (s.site_name_en || s.site_name_he)
  );

  console.log(`Found ${validSites.length} sites with valid coordinates.`);

  const csvRows = [];
  const geoJsonFeatures = [];

  // Track unique site name occurrences to avoid collisions
  const nameCounts = new Map();

  for (const site of validSites) {
    let englishName = (site.site_name_en || '').trim();
    if (!englishName) {
      englishName = (site.site_name_he || 'Site').trim();
    }

    // Clean name
    englishName = englishName.replace(/\s+/g, ' ');

    const periods = resolvePeriods(site.archaeological_periods);
    const title = resolveTitle(site.water_system_type, site.site_type);
    const description = cleanDescription(site);

    // Add row for each period
    for (const p of periods) {
      csvRows.push([
        escapeCsvField(englishName),
        site.latitude,
        site.longitude,
        p.start,
        p.end,
        escapeCsvField(title),
        escapeCsvField(description)
      ].join(','));
    }

    // GeoJSON Feature
    geoJsonFeatures.push({
      type: 'Feature',
      geometry: {
        type: 'Point',
        coordinates: [site.longitude, site.latitude]
      },
      properties: {
        'location name': englishName,
        'location_name_he': site.site_name_he,
        latitude: site.latitude,
        longitude: site.longitude,
        title: title,
        description: description,
        periods: periods.map(p => [p.start, p.end, title, description]),
        region: site.region,
        site_type: site.site_type,
        source_pages: site.source_pages || []
      }
    });
  }

  // GeoTrends CSV header
  const csvHeader = 'location name,latitude,longitude,start year,end time,title,description';
  const fullCsvContent = [csvHeader, ...csvRows].join('\n');

  const outCsvPath = join(process.cwd(), 'data', 'water_installations.csv');
  const outGeoJsonPath = join(process.cwd(), 'data', 'water_installations.geojson');
  const outConfigJsonPath = join(process.cwd(), 'data', 'water_installations.json');

  writeFileSync(outCsvPath, fullCsvContent, 'utf-8');
  console.log(`Wrote GeoTrends CSV: ${outCsvPath} (${csvRows.length} period rows)`);

  const geoJsonData = {
    type: 'FeatureCollection',
    features: geoJsonFeatures
  };
  writeFileSync(outGeoJsonPath, JSON.stringify(geoJsonData, null, 2), 'utf-8');
  console.log(`Wrote GeoTrends GeoJSON: ${outGeoJsonPath} (${geoJsonFeatures.length} features)`);

  // Create project config JSON
  const projectConfig = {
    repo: 'water_installations',
    dataFile: 'data/water_installations.csv',
    header: 'Water Installations',
    geologyType: 'hybrid',
    lowResGeology: 'data/israel_geology.geojson',
    highResGeology: 'https://egozi.gsi.gov.il/arcgis/rest/services/Hosted/All_A_ZDissolove_g1_2/VectorTileServer',
    zoomThreshold: 11
  };
  writeFileSync(outConfigJsonPath, JSON.stringify(projectConfig, null, 2), 'utf-8');
  console.log(`Wrote Project Config: ${outConfigJsonPath}`);

  // Update data/projects.json
  const projectsPath = join(process.cwd(), 'data', 'projects.json');
  if (existsSync(projectsPath)) {
    const projects = JSON.parse(readFileSync(projectsPath, 'utf-8'));
    const existingIdx = projects.findIndex(p => p.repo === 'water_installations');
    const entry = {
      repo: 'water_installations',
      header: 'Water Installations',
      dataFile: 'data/water_installations.csv',
      configFile: 'data/water_installations.json'
    };
    if (existingIdx >= 0) {
      projects[existingIdx] = entry;
    } else {
      projects.push(entry);
    }
    writeFileSync(projectsPath, JSON.stringify(projects, null, 2), 'utf-8');
    console.log(`Updated data/projects.json with "Water Installations" project.`);
  }

  // Update data/files.json
  const filesPath = join(process.cwd(), 'data', 'files.json');
  if (existsSync(filesPath)) {
    const filesList = JSON.parse(readFileSync(filesPath, 'utf-8'));
    if (!filesList.includes('data/water_installations.csv')) {
      filesList.push('data/water_installations.csv');
      writeFileSync(filesPath, JSON.stringify(filesList, null, 2), 'utf-8');
      console.log(`Updated data/files.json with data/water_installations.csv.`);
    }
  }

  // Upload to GCS
  console.log(`Uploading dataset to ${OUTPUT_PREFIX}...`);
  execSync(`gcloud storage cp "${outCsvPath}" "${OUTPUT_PREFIX}water_installations.csv"`, { stdio: 'inherit' });
  execSync(`gcloud storage cp "${outGeoJsonPath}" "${OUTPUT_PREFIX}water_installations.geojson"`, { stdio: 'inherit' });
  execSync(`gcloud storage cp "${outConfigJsonPath}" "${OUTPUT_PREFIX}water_installations.json"`, { stdio: 'inherit' });

  console.log('Finished successfully!');
}

main();
