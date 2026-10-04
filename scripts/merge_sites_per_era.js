import fs from 'node:fs';

const geo = JSON.parse(fs.readFileSync('data/water_installations.geojson', 'utf-8'));
console.log('Total input features:', geo.features.length);

function normalizeSiteName(name, heb) {
  let cleanEng = (name || '').trim().replace(/\s+/g, ' ');
  let cleanHeb = (heb || '').trim().replace(/\s+/g, ' ');
  
  // Standardize common names
  const lower = cleanEng.toLowerCase();
  if (lower.includes('lachish') || cleanHeb.includes('לכיש')) return { eng: 'Tel Lachish', heb: 'תל לכיש', key: 'lachish' };
  if (lower.includes('hazor') || cleanHeb.includes('חצור')) return { eng: 'Tel Hazor', heb: 'תל חצור', key: 'hazor' };
  if (lower.includes('megiddo') || cleanHeb.includes('מגידו')) return { eng: 'Tel Megiddo', heb: 'תל מגידו', key: 'megiddo' };
  if (lower.includes('gezer') || cleanHeb.includes('גזר')) return { eng: 'Tel Gezer', heb: 'תל גזר', key: 'gezer' };
  if (lower.includes('beersheba') || lower.includes('beer sheva') || cleanHeb.includes('באר שבע')) return { eng: 'Tel Beersheba', heb: 'תל באר שבע', key: 'beersheba' };
  if (lower.includes('beit shemesh') || lower.includes('bet shemesh') || cleanHeb.includes('בית שמש')) return { eng: 'Tel Beit Shemesh', heb: 'תל בית שמש', key: 'beit_shemesh' };
  if (lower.includes('jerusalem') || cleanHeb.includes('ירושלים') || lower.includes('city of david') || cleanHeb.includes('עיר דוד')) return { eng: 'Jerusalem (City of David)', heb: 'ירושלים (עיר דוד)', key: 'jerusalem' };
  if (lower.includes('gibeon') || cleanHeb.includes('גבעון') || lower.includes('el-jib')) return { eng: 'Gibeon (el-Jib)', heb: 'גבעון (אל-ג\'יב)', key: 'gibeon' };
  if (lower.includes('arad') || cleanHeb.includes('ערד')) return { eng: 'Tel Arad', heb: 'תל ערד', key: 'arad' };
  if (lower.includes('qumran') || cleanHeb.includes('קומראן')) return { eng: 'Qumran', heb: 'קומראן', key: 'qumran' };
  if (lower.includes('jezreel') || cleanHeb.includes('יזרעאל')) return { eng: 'Tel Jezreel', heb: 'תל יזרעאל', key: 'jezreel' };
  if (lower.includes('dan') && (lower.includes('tel') || cleanHeb.includes('דן'))) return { eng: 'Tel Dan', heb: 'תל דן', key: 'dan' };
  if (lower.includes('dor') && (lower.includes('tel') || cleanHeb.includes('דור'))) return { eng: 'Tel Dor', heb: 'תל דור', key: 'dor' };
  if (lower.includes('gerisa') || cleanHeb.includes('גריסה')) return { eng: 'Tel Gerisa', heb: 'תל גריסה', key: 'gerisa' };
  if (lower.includes('taanach') || cleanHeb.includes('תענך')) return { eng: 'Tel Taanach', heb: 'תל תענך', key: 'taanach' };
  if (lower.includes('shiloh') || cleanHeb.includes('שילה')) return { eng: 'Tel Shiloh', heb: 'תל שילה', key: 'shiloh' };
  if (lower.includes('yokneam') || cleanHeb.includes('יקנעם')) return { eng: 'Tel Yokneam', heb: 'תל יקנעם', key: 'yokneam' };
  if (lower.includes('ibleam') || lower.includes('bel\'ameh') || cleanHeb.includes('יבלעם')) return { eng: 'Ibleam (Khirbet Bel\'ameh)', heb: 'יבלעם (ח\'רבת בלעמה)', key: 'ibleam' };
  if (lower.includes('uza') || cleanHeb.includes('עוזה')) return { eng: 'Horbat Uza', heb: 'חורבת עוזה', key: 'uza' };
  if (lower.includes('radum') || cleanHeb.includes('רדום')) return { eng: 'Horbat Radum', heb: 'חורבת רדום', key: 'radum' };
  if (lower.includes('halif') || cleanHeb.includes('חליף')) return { eng: 'Tel Halif', heb: 'תל חליף', key: 'halif' };
  if (lower.includes('beit mirsim') || cleanHeb.includes('בית מרסים')) return { eng: 'Tel Beit Mirsim', heb: 'תל בית מרסים', key: 'beit_mirsim' };
  if (lower.includes('nasbeh') || cleanHeb.includes('נצבה')) return { eng: 'Tel en-Nasbeh', heb: 'תל א-נצבה', key: 'nasbeh' };
  if (lower.includes('raddana') || cleanHeb.includes('רדאנה') || cleanHeb.includes('רדנה')) return { eng: 'Khirbet Raddana', heb: 'חורבת רדנה', key: 'raddana' };
  if (lower.includes('ai ') || lower === 'ai' || lower.includes('et-tell') || cleanHeb.includes('העי')) return { eng: 'Ai (et-Tell)', heb: 'העי (א-תל)', key: 'ai' };
  if (lower.includes('amman') || cleanHeb.includes('עמאן') || lower.includes('rabbath')) return { eng: 'Amman (Rabbath Ammon)', heb: 'עמאן (רבת עמון)', key: 'amman' };
  if (lower.includes('heshbon') || cleanHeb.includes('חשבון')) return { eng: 'Heshbon', heb: 'חשבון', key: 'heshbon' };
  if (lower.includes('aroer') || cleanHeb.includes('ערוער')) return { eng: 'Tel Aroer', heb: 'תל ערוער', key: 'aroer' };
  if (lower.includes('kadesh barnea') || cleanHeb.includes('קדש ברנע') || lower.includes('gudeirat')) return { eng: 'Kadesh Barnea (Ein el-Gudeirat)', heb: 'קדש ברנע (עין אל-קודייראת)', key: 'kadesh_barnea' };
  if (lower.includes('rosh zayit') || cleanHeb.includes('ראש זית')) return { eng: 'Horbat Rosh Zayit', heb: 'חורבת ראש זית', key: 'rosh_zayit' };
  if (lower.includes('bint barr') || cleanHeb.includes('בנת בר')) return { eng: 'Khirbet Bint-Barr', heb: 'חורבת בנת בר', key: 'bint_barr' };
  if (lower.includes('marjameh') || cleanHeb.includes('מרג\'מה') || cleanHeb.includes('מרגימה')) return { eng: 'Khirbet Marjameh', heb: 'חורבת מרג\'מה', key: 'marjameh' };
  if (lower.includes('shilha') || cleanHeb.includes('שילחה')) return { eng: 'Horbat Shilha', heb: 'חורבת שילחה', key: 'shilha' };
  if (lower.includes('deir es-sidd') || lower.includes('deir a-sid') || cleanHeb.includes('דיר א-סיד')) return { eng: 'Khirbet Deir es-Sidd', heb: 'חורבת דיר א-סיד', key: 'deir_es_sidd' };
  if (lower.includes('el-keik') || lower.includes('el-kheik') || cleanHeb.includes('אל-כיכ')) return { eng: 'Khirbet el-Keik', heb: 'חורבת אל-כיכ', key: 'el_keik' };
  if (lower.includes('abu et-twein') || lower.includes('abu a-twin') || cleanHeb.includes('אבו א-טווין')) return { eng: 'Khirbet Abu et-Twein', heb: 'חורבת אבו א-טווין', key: 'abu_et_twein' };
  if (lower.includes('ira') && (lower.includes('tel') || cleanHeb.includes('עירא'))) return { eng: 'Tel Ira', heb: 'תל עירא', key: 'ira' };
  if (lower.includes('umm el-biyara') || cleanHeb.includes('אום אל ביארה') || cleanHeb.includes('אום אל-ביארה')) return { eng: 'Umm el-Biyara', heb: 'אום אל-ביארה', key: 'umm_el_biyara' };
  if (lower.includes('khuwwakh') || cleanHeb.includes('ח\'וחי') || cleanHeb.includes('חוחי') || cleanHeb.includes('עיטם')) return { eng: 'Khirbet el-Khuwwakh (Etam)', heb: 'חורבת אל-ח\'וחי (עיטם)', key: 'khuwwakh' };
  if (lower.includes('atlit') || cleanHeb.includes('עתלית')) return { eng: 'Atlit-Yam', heb: 'עתלית ים', key: 'atlit_yam' };
  if (lower.includes('kfar samir') || cleanHeb.includes('כפר סמיר')) return { eng: 'Kfar Samir', heb: 'כפר סמיר', key: 'kfar_samir' };
  if (lower.includes('kfar galim') || cleanHeb.includes('כפר גלים')) return { eng: 'Kfar Galim North', heb: 'כפר גלים צפון', key: 'kfar_galim' };
  if (lower.includes('megadim') || cleanHeb.includes('מגדים')) return { eng: 'Megadim', heb: 'מגדים', key: 'megadim' };
  if (lower.includes('abu huf') || cleanHeb.includes('אבו חוף') || cleanHeb.includes('אבו-חוף')) return { eng: 'Abu Huf', heb: 'אבו חוף', key: 'abu_huf' };
  if (lower.includes('bater') || lower.includes('batar') || cleanHeb.includes('בתר')) return { eng: 'Horbat Beter', heb: 'חורבת בתר', key: 'beter' };
  if (lower.includes('tepe gawra') || cleanHeb.includes('טפה גאורה')) return { eng: 'Tepe Gawra', heb: 'טפה גאורה', key: 'tepe_gawra' };
  if (lower.includes('jarassur') || lower.includes('jarashur') || cleanHeb.includes('ג\'אראסור')) return { eng: 'Khirbet Jarassur', heb: 'ח\'רבת ג\'אראסור', key: 'jarassur' };
  if (lower.includes('ain ghazal') || lower.includes('ibn al-ghazi') || cleanHeb.includes('אבן אל-גאזי') || cleanHeb.includes('עין ע\'זאל')) return { eng: 'Ain Ghazal / Ibn el-Ghazzi', heb: 'עין ע\'זאל / אבן אל-ע\'אזי', key: 'ain_ghazal' };
  if (lower.includes('beidha') || cleanHeb.includes('ביידא') || cleanHeb.includes('בידה')) return { eng: 'Beidha', heb: 'ביידא', key: 'beidha' };
  if (lower.includes('beisamoun') || cleanHeb.includes('בייסמון')) return { eng: 'Beisamoun', heb: 'בייסמון', key: 'beisamoun' };
  if (lower.includes('gilgal') || cleanHeb.includes('גלגל')) return { eng: 'Gilgal I', heb: 'גלגל 1', key: 'gilgal' };
  if (lower.includes('netiv') || cleanHeb.includes('נתיב הגדוד')) return { eng: 'Netiv HaGdud', heb: 'נתיב הגדוד', key: 'netiv_hagdud' };
  if (lower.includes('yiftah') || cleanHeb.includes('יפתחאל')) return { eng: 'Yiftah\'el', heb: 'יפתחאל', key: 'yiftahel' };
  if (lower.includes('kabri') || cleanHeb.includes('כברי')) return { eng: 'Tel Kabri', heb: 'תל כברי', key: 'kabri' };
  if (lower.includes('beth shean') || lower.includes('bet shean') || cleanHeb.includes('בית שאן')) return { eng: 'Tel Beth Shean', heb: 'תל בית שאן', key: 'beth_shean' };
  if (lower.includes('gamma') || lower.includes('ג\'מה') || cleanHeb.includes('גמה')) return { eng: 'Tel Gamma', heb: 'תל ג\'מה', key: 'gamma' };
  if (lower.includes('ashdod') && !lower.includes('yam') && cleanHeb.includes('אשדוד')) return { eng: 'Tel Ashdod', heb: 'תל אשדוד', key: 'ashdod' };
  if (lower.includes('haror') || cleanHeb.includes('הרור')) return { eng: 'Tel Haror', heb: 'תל הרור', key: 'haror' };
  if (lower.includes('nami') || cleanHeb.includes('נאמי')) return { eng: 'Tel Nami', heb: 'תל נאמי', key: 'nami' };
  if (lower.includes('sha\'albim') || cleanHeb.includes('שעלבים')) return { eng: 'Sha\'albim', heb: 'שעלבים', key: 'shaalbim' };
  if (lower.includes('ebla') || cleanHeb.includes('אבלה')) return { eng: 'Ebla', heb: 'אבלה (סוריה)', key: 'ebla' };
  if (lower.includes('bozrah') || lower.includes('busra') || cleanHeb.includes('בוצרה')) return { eng: 'Bozrah (Busra)', heb: 'בוצרה (סוריה)', key: 'bozrah' };
  if (lower.includes('sa\'idiyeh') || cleanHeb.includes('סעידיה')) return { eng: 'Tell es-Sa\'idiyeh', heb: 'תל א-סעידיה', key: 'saidiyeh' };
  if (lower.includes('mezer') || cleanHeb.includes('מצר')) return { eng: 'Mezer', heb: 'מצר', key: 'mezer' };
  if (lower.includes('dalit') || cleanHeb.includes('דלית')) return { eng: 'Tel Dalit', heb: 'תל דלית', key: 'dalit' };
  if (lower.includes('yerah') || cleanHeb.includes('בית ירח')) return { eng: 'Tel Bet Yerah', heb: 'בית ירח', key: 'bet_yerah' };
  if (lower.includes('jawa') || cleanHeb.includes('ג\'ווה')) return { eng: 'Jawa', heb: 'ג\'ווה', key: 'jawa' };
  if (lower.includes('uvda') || cleanHeb.includes('עובדה')) return { eng: 'Ovda Valley', heb: 'בקעת עובדה', key: 'ovda' };
  if (lower.includes('zeiraqun') || lower.includes('zirkon') || cleanHeb.includes('זירקון')) return { eng: 'Khirbet Zeiraqoun', heb: 'חירבת זירקון', key: 'zeiraqun' };
  if (lower.includes('hacilar') || cleanHeb.includes('הצ\'ילר')) return { eng: 'Hacilar', heb: 'הצ\'ילר (תורכיה)', key: 'hacilar' };
  if (lower.includes('rajajil') || cleanHeb.includes('ראגאג\'יל')) return { eng: 'Rajajil', heb: 'ראג\'אג\'יל (ערב הסעודית)', key: 'rajajil' };
  if (lower.includes('nimrud') || cleanHeb.includes('נמרוד')) return { eng: 'Nimrud (Kalhu)', heb: 'נמרוד (כלח)', key: 'nimrud' };
  if (lower.includes('nineveh') || cleanHeb.includes('נינוה')) return { eng: 'Nineveh', heb: 'נינוה (אשור)', key: 'nineveh' };
  if (lower.includes('samos') || cleanHeb.includes('סמוס')) return { eng: 'Samos (Eupalinos Tunnel)', heb: 'מנהרת אופלינוס (סמוס)', key: 'samos' };
  if (lower.includes('tushpa') || cleanHeb.includes('תושפה') || lower.includes('van') || lower.includes('urartu')) return { eng: 'Tushpa / Menua Canal (Van)', heb: 'תושפה / אמת מנואה (אוררטו)', key: 'tushpa' };
  if (lower.includes('midas') || cleanHeb.includes('מידאס')) return { eng: 'Midas City', heb: 'מידאס סיטי (פריגיה)', key: 'midas' };
  if (lower.includes('arbailu') || lower.includes('erbil') || cleanHeb.includes('ארבילו') || cleanHeb.includes('אירביל')) return { eng: 'Arbailu (Erbil)', heb: 'ארבילו (אירביל)', key: 'erbil' };
  if (lower.includes('deir el-medina') || cleanHeb.includes('דיר אל מדינה')) return { eng: 'Deir el-Medina', heb: 'דיר אל-מדינה (מצרים)', key: 'deir_el_medina' };
  if (lower.includes('mycenae') || cleanHeb.includes('מיקנה')) return { eng: 'Mycenae', heb: 'מיקנה (יוון)', key: 'mycenae' };
  if (lower.includes('tiryns') || cleanHeb.includes('טירינס')) return { eng: 'Tiryns', heb: 'טירינס (יוון)', key: 'tiryns' };
  if (lower.includes('athens') || cleanHeb.includes('אתונה')) return { eng: 'Athens (Acropolis)', heb: 'אתונה (יוון)', key: 'athens' };

  // Generic fallback key
  const normKey = cleanEng.replace(/^(Tel|Tell|Khirbet|Horbat|Horvat|Ein|Bir)\s+/i, '').toLowerCase().trim();
  return { eng: cleanEng, heb: cleanHeb, key: normKey || cleanEng.toLowerCase() };
}

// Group by era + normalized site key
const eraSiteMap = new Map();

for (const f of geo.features) {
  const p = f.properties;
  const era = p.era || 'Unknown';
  const norm = normalizeSiteName(p['location name'], p.location_name_he);
  const groupKey = `${era}:::${norm.key}`;

  if (!eraSiteMap.has(groupKey)) {
    eraSiteMap.set(groupKey, {
      era,
      key: norm.key,
      location_name: norm.eng,
      location_name_he: norm.heb,
      latitude: f.geometry.coordinates[1],
      longitude: f.geometry.coordinates[0],
      start_year: p['start year'],
      end_year: p['end time'],
      region: p.region || '',
      titles: new Set([p.title]),
      sections: new Set(p.section_ref ? [p.section_ref] : []),
      pages: new Set(Array.isArray(p.source_pages) ? p.source_pages : (p.source_pages ? [p.source_pages] : [])),
      descriptions: [p.description]
    });
  } else {
    const existing = eraSiteMap.get(groupKey);
    // Update Hebrew / English name if better
    if (norm.heb && (!existing.location_name_he || existing.location_name_he.length < norm.heb.length)) {
      existing.location_name_he = norm.heb;
    }
    if (norm.eng && (!existing.location_name || existing.location_name.length < norm.eng.length)) {
      existing.location_name = norm.eng;
    }
    if (p.title) existing.titles.add(p.title);
    if (p.section_ref && p.section_ref !== '2.9' && p.section_ref !== 'Summary') {
      existing.sections.add(p.section_ref);
    }
    if (p.source_pages) {
      const pageArr = Array.isArray(p.source_pages) ? p.source_pages : [p.source_pages];
      pageArr.forEach(pg => existing.pages.add(pg));
    }
    // Only add description if not duplicate
    if (p.description && !existing.descriptions.some(d => d.includes(p.description.slice(0, 40)))) {
      existing.descriptions.push(p.description);
    }
  }
}

const consolidated = Array.from(eraSiteMap.values());
console.log(`Consolidated unique site entries across all eras: ${consolidated.length} (from ${geo.features.length})`);

// Check breakdown by era
const eraCounts = {};
consolidated.forEach(c => {
  eraCounts[c.era] = (eraCounts[c.era] || 0) + 1;
});
console.log('Consolidated era breakdown:', eraCounts);
