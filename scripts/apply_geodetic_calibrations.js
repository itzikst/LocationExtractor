import { readFileSync, writeFileSync } from 'node:fs';

const updates = {
  'yiftah_el': {
    lat: 32.75491,
    lon: 35.22763,
    source: 'Garfinkel 1987; IAA Excavation Reports (ITM 221632/740032, ICS 171632/240032); Dissertation §2.2, p. 46',
    tier: 'Tier 1: High Precision (Pinpoint Well/Installation < 50m)',
    notes: 'Horbat Yiftah\'el (Nahal Tzippori / HaMovil Junction) PPNB / EB village, plastered floors, and Ein Yiftah\'el spring catchment'
  },
  'gibeon_el_jib': {
    lat: 31.84890,
    lon: 35.18404,
    source: 'Pritchard 1961; IAA Grid 167600/139600; Dissertation §2.9.8, pp. 138-142',
    tier: 'Tier 1: High Precision (Pinpoint Well/Installation < 50m)',
    notes: 'Gibeon (el-Jib) Great Pool (11.3m dia, 10.8m deep) and stepped water tunnel to spring chamber'
  },
  'tel_ashdod': {
    lat: 31.75693,
    lon: 34.65900,
    source: 'Dothan 1971; IAA Grid 117900/129400; Dissertation §2.9.29, p. 166',
    tier: 'Tier 1: High Precision (Pinpoint Well/Installation < 50m)',
    notes: 'Tel Ashdod Area D Iron II drainage pools and water conduits'
  },
  'mitzad_hatira': {
    lat: 30.95531,
    lon: 34.94233,
    source: 'Cohen 1986; IAA Grid 144500/040500; Dissertation §2.9.36, p. 171',
    tier: 'Tier 1: High Precision (Pinpoint Well/Installation < 50m)',
    notes: 'Mitzad Hatira (Makhtesh Gadol ridge) Iron II fortress and open rock cisterns'
  },
  'mitzad_nahal_boker': {
    lat: 30.92194,
    lon: 34.80630,
    source: 'Cohen 1986; IAA Grid 131500/036800; Dissertation §2.9.36, p. 171',
    tier: 'Tier 1: High Precision (Pinpoint Well/Installation < 50m)',
    notes: 'Mitzad Nahal Boker Iron II rectangular fortress and slope runoff cisterns'
  },
  'mitzad_har_raviv': {
    lat: 30.90211,
    lon: 34.67761,
    source: 'Cohen 1986; IAA Grid 119200/034600; Dissertation §2.9.36, p. 171',
    tier: 'Tier 1: High Precision (Pinpoint Well/Installation < 50m)',
    notes: 'Mitzad Har Raviv Iron II casemate fortress and wadi water catchment'
  },
  'bor_hamat': {
    lat: 30.62167,
    lon: 34.72927,
    source: 'Cohen 1986; IAA Grid 124000/003500; Dissertation §2.9.36, p. 171',
    tier: 'Tier 1: High Precision (Pinpoint Well/Installation < 50m)',
    notes: 'Bor Hamat / Be\'erotayim open plastered reservoir and cistern complex'
  },
  'mishor_haruach': {
    lat: 30.60364,
    lon: 34.78050,
    source: 'Cohen 1986; IAA Grid 128900/001500; Dissertation §2.9.36, p. 171',
    tier: 'Tier 1: High Precision (Pinpoint Well/Installation < 50m)',
    notes: 'Mishor Haruach Iron II fortress and slope runoff cisterns'
  },
  'mitzad_sarapid': {
    lat: 30.68389,
    lon: 34.67255,
    source: 'Cohen 1986; IAA Grid 118600/010400; Dissertation §2.9.36, p. 171',
    tier: 'Tier 1: High Precision (Pinpoint Well/Installation < 50m)',
    notes: 'Mitzad Sarapid Iron II fortress and plastered wadi cisterns'
  },
  'migdal_nahal_sarapid': {
    lat: 30.68209,
    lon: 34.66943,
    source: 'Cohen 1986; IAA Grid 118300/010200; Dissertation §2.9.36, p. 171',
    tier: 'Tier 1: High Precision (Pinpoint Well/Installation < 50m)',
    notes: 'Tower at Nahal Sarapid Iron II tower and adjacent water collection basin'
  },
  'mitzad_nahal_ela': {
    lat: 30.72447,
    lon: 34.67651,
    source: 'Cohen 1986; IAA Grid 119000/014900; Dissertation §2.9.36, p. 171',
    tier: 'Tier 1: High Precision (Pinpoint Well/Installation < 50m)',
    notes: 'Mitzad Nahal Ela Iron II fortress and rock-cut cistern'
  },
  'khirbet_ratama': {
    lat: 30.87235,
    lon: 34.72801,
    source: 'Cohen 1986; IAA Grid 124000/031300; Dissertation §2.9.36, p. 171',
    tier: 'Tier 1: High Precision (Pinpoint Well/Installation < 50m)',
    notes: 'Khirbet Ratama Iron II casemate fortress and wadi water reservoirs'
  },
  'horbat_shilha': {
    lat: 31.86153,
    lon: 35.38394,
    source: 'Mazar 1984; IAA Grid 186500/141000; Dissertation §2.9.23, p. 163',
    tier: 'Tier 1: High Precision (Pinpoint Well/Installation < 50m)',
    notes: 'Horbat Shilha (Jordan Valley / Wadi Qelt area) Iron II fortress and rock cistern'
  },
  'khirbet_deir_es_sidd': {
    lat: 31.62889,
    lon: 35.13769,
    source: 'Hirschfeld 1985; IAA Grid 163200/115200; Dissertation §2.9.25, p. 164',
    tier: 'Tier 1: High Precision (Pinpoint Well/Installation < 50m)',
    notes: 'Khirbet Deir es-Sidd rock-cut stepped cisterns and hillside runoff collection channels'
  },
  'khirbet_el_khuwwakh_etam': {
    lat: 31.68840,
    lon: 35.18303,
    source: 'IAA Grid 167500/121800; Dissertation §2.9.24, p. 164',
    tier: 'Tier 1: High Precision (Pinpoint Well/Installation < 50m)',
    notes: 'Khirbet el-Khuwwakh (Ein Etam) subterranean water cave and reservoir'
  },
  'khirbet_el_mekari': {
    lat: 31.70102,
    lon: 35.38258,
    source: 'IAA Grid 186400/123200; Dissertation §2.9.22, p. 163',
    tier: 'Tier 1: High Precision (Pinpoint Well/Installation < 50m)',
    notes: 'Khirbet el-Mekari Iron II desert fortress and wadi-fed plastered cistern'
  }
};

let content = readFileSync('scripts/archaeological_gazetteer.js', 'utf-8');

for (const [key, val] of Object.entries(updates)) {
  const regex = new RegExp(`'${key}':\\s*\\{[\\s\\S]*?\\n  \\}`, 'g');
  const match = content.match(regex);
  if (match) {
    const orig = match[0];
    const nameMatch = orig.match(/name:\s*['"](.*?)['"]/);
    const hebMatch = orig.match(/hebName:\s*['"](.*?)['"]/);
    const name = nameMatch ? nameMatch[1] : '';
    const heb = hebMatch ? hebMatch[1] : '';

    const replacement = `'${key}': {\n    name: '${name}',\n    hebName: '${heb}',\n    lat: ${val.lat},\n    lon: ${val.lon},\n    source: '${val.source}',\n    tier: '${val.tier}',\n    notes: '${val.notes}'\n  }`;
    content = content.replace(orig, replacement);
    console.log(`Updated ${key}`);
  } else {
    console.warn(`Could not match key: ${key}`);
  }
}

writeFileSync('scripts/archaeological_gazetteer.js', content, 'utf-8');
console.log('Successfully calibrated scripts/archaeological_gazetteer.js');
