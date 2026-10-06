import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { MASTER_ARCHAEOLOGICAL_GAZETTEER } from './archaeological_gazetteer.js';

// 1. Excluded Non-Point Entity Types
const EXCLUDED_TYPES = new Set([
  'region',
  'valley',
  'mountain',
  'river',
  'lake',
  'bay',
  'fortifications',
  'sea'
]);

// Generic typology TOC vocabulary terms that are not physical sites
const GENERIC_TYPOLOGY_TERMS = new Set([
  'אמת מים',
  'באר',
  'בארות שרשרת',
  'בור',
  'בריכה וסכר',
  'מאגר תת קרקעי',
  'מעיין',
  'מעיין חתום',
  'מפעל מים החצוב אל מי תהום',
  'נחל/נהר',
  'תמילה'
]);

// 2. Normalization Helpers
function normalizeHebrew(str) {
  if (!str) return '';
  return str
    .replace(/[\u0591-\u05C7]/g, '')
    .replace(/['"״׳`\-־]/g, '')
    .replace(/\(.*?\)/g, '')
    .replace(/^(תל|חורבת|חירבת|ח'רבת|חרבת|עין|באר|מערת|בריכת|קאסר|מצד|מצודת|אתר)\s+/g, '')
    .replace(/^ה/g, '')
    .replace(/^אל/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function escapeCsv(val) {
  if (val === undefined || val === null) return '""';
  const str = String(val).replace(/"/g, '""');
  return `"${str}"`;
}

// 3. Comprehensive Curated Ancient & Historical Gazetteer
const COMPREHENSIVE_ARCHAEOLOGICAL_DIRECTORY = {
  // Prehistoric & Epi-Paleolithic (Chapter 2.1 - 2.2)
  'עין גב': { coords: '32.78440, 35.64200', source: 'PhD', notes: 'Ein Gev IX (Eastern shore of Sea of Galilee)' },
  'עין גב 9': { coords: '32.78440, 35.64200', source: 'PhD', notes: 'Ein Gev IX (Eastern shore of Sea of Galilee)' },
  'אבן חוף': { coords: '31.39985, 34.85371', source: 'PhD', notes: 'Abu Huf / Even Hof Chalcolithic well' },
  'הבאר באבו חוף': { coords: '31.39985, 34.85371', source: 'PhD', notes: 'Abu Huf / Even Hof Chalcolithic well' },
  'הער': { coords: '31.46800, 35.81700', source: 'https://en.wikipedia.org/wiki/Aroer', notes: 'Aroer on Arnon (Khirbet el-Arayer), Jordan' },
  'אבן אל-גאזי': { coords: '31.98800, 35.97600', source: 'https://en.wikipedia.org/wiki/Ayn_Ghazal_(archaeological_site)', notes: '\'Ain Ghazal PPN archaeological site, Amman, Jordan' },
  'אבן אל-ע\'אזי': { coords: '31.98800, 35.97600', source: 'https://en.wikipedia.org/wiki/Ayn_Ghazal_(archaeological_site)', notes: '\'Ain Ghazal PPN archaeological site, Amman, Jordan' },
  'באר 1 W באבן אל-גאזי': { coords: '31.98800, 35.97600', source: 'https://en.wikipedia.org/wiki/Ayn_Ghazal_(archaeological_site)', notes: 'Well 1W at \'Ain Ghazal, Amman, Jordan' },
  'עין ע\'זל': { coords: '31.98800, 35.97600', source: 'https://en.wikipedia.org/wiki/Ayn_Ghazal_(archaeological_site)', notes: '\'Ain Ghazal PPN archaeological site, Amman, Jordan' },
  'ביידא': { coords: '30.37889, 35.44750', source: 'https://en.wikipedia.org/wiki/Beidha_(Jordan)', notes: 'Beidha PPN village near Petra, Jordan' },
  "ביד'ה": { coords: '30.37889, 35.44750', source: 'https://en.wikipedia.org/wiki/Beidha_(Jordan)', notes: 'Beidha near Petra, Jordan' },
  "הצ'ילר": { coords: '37.59972, 30.08139', source: 'https://en.wikipedia.org/wiki/Hacilar', notes: 'Hacilar Neolithic site, Turkey' },
  "חג'ילר": { coords: '37.59972, 30.08139', source: 'https://en.wikipedia.org/wiki/Hacilar', notes: 'Hacilar Neolithic site, Turkey' },
  "הבאר בחציילר VI": { coords: '37.59972, 30.08139', source: 'https://en.wikipedia.org/wiki/Hacilar', notes: 'Well at Hacilar VI, Turkey' },
  "הבאר והכפר בחציילר": { coords: '37.59972, 30.08139', source: 'https://en.wikipedia.org/wiki/Hacilar', notes: 'Well and village at Hacilar, Turkey' },
  "באר עגולה (הצ'ילר VI)": { coords: '37.59972, 30.08139', source: 'https://en.wikipedia.org/wiki/Hacilar', notes: 'Circular well at Hacilar VI, Turkey' },
  "באר רבועה (הצ'ילר II)": { coords: '37.59972, 30.08139', source: 'https://en.wikipedia.org/wiki/Hacilar', notes: 'Square well at Hacilar II, Turkey' },
  "כפר סמיר": { coords: '32.79361, 34.95750', source: 'PhD', notes: 'Submerged Neolithic well at Kfar Samir' },
  "בור מלבני (כפר סמיר)": { coords: '32.79361, 34.95750', source: 'PhD', notes: 'Submerged Neolithic well at Kfar Samir' },
  "כפר גלים צפון": { coords: '32.77500, 34.95300', source: 'PhD', notes: 'Submerged Neolithic wells at Kfar Galim North' },
  "בורות עגולים (כפר גלים צפון)": { coords: '32.77500, 34.95300', source: 'PhD', notes: 'Submerged Neolithic wells at Kfar Galim North' },
  "בורות (חוף הכרמל)": { coords: '32.78000, 34.95500', source: 'PhD', notes: 'Submerged Neolithic wells off Carmel Coast' },
  "ח'רבת ג'אראסור": { coords: '36.85000, 42.90000', source: 'https://en.wikipedia.org/wiki/Halaf_culture', notes: 'Khirbet Jarassur, Iraq' },
  'חרבת גראסור': { coords: '36.85000, 42.90000', source: 'https://en.wikipedia.org/wiki/Halaf_culture', notes: 'Khirbet Jarassur, Iraq' },
  'גירסור': { coords: '36.85000, 42.90000', source: 'https://en.wikipedia.org/wiki/Halaf_culture', notes: 'Khirbet Jarassur, Iraq' },
  'באר ח\'רבת ג\'אראסור': { coords: '36.85000, 42.90000', source: 'https://en.wikipedia.org/wiki/Halaf_culture', notes: 'Well at Khirbet Jarassur, Iraq' },
  'טפה גאורה': { coords: '36.50000, 43.25000', source: 'https://en.wikipedia.org/wiki/Tepe_Gawra', notes: 'Tepe Gawra, Iraq' },
  'הבאר בטפה גאורה': { coords: '36.50000, 43.25000', source: 'https://en.wikipedia.org/wiki/Tepe_Gawra', notes: 'Well at Tepe Gawra, Iraq' },
  'יטפה': { coords: '36.50000, 43.25000', source: 'https://en.wikipedia.org/wiki/Tepe_Gawra', notes: 'Tepe Gawra, Iraq' },
  "ראג'אג'יל": { coords: '29.80583, 40.21056', source: 'https://en.wikipedia.org/wiki/Rajajil', notes: 'Rajajil, Saudi Arabia' },
  'רגיגייל': { coords: '29.80583, 40.21056', source: 'https://en.wikipedia.org/wiki/Rajajil', notes: 'Rajajil, Saudi Arabia' },
  "ג'ווה": { coords: '32.33500, 37.00333', source: 'https://en.wikipedia.org/wiki/Jawa,_Jordan', notes: 'Jawa reservoir & dam fortress, Jordan' },
  'גיווה': { coords: '32.33500, 37.00333', source: 'https://en.wikipedia.org/wiki/Jawa,_Jordan', notes: 'Jawa reservoir & dam fortress, Jordan' },
  'הבריכות הטבעיות בג\'ווה': { coords: '32.33500, 37.00333', source: 'https://en.wikipedia.org/wiki/Jawa,_Jordan', notes: 'Natural pools at Jawa, Jordan' },
  'תל זירקון': { coords: '32.53333, 35.91667', source: 'https://en.wikipedia.org/wiki/Irbid_Governorate', notes: 'Khirbet ez-Zeraqon, Jordan' },
  "ח'רבת א-זרקון": { coords: '32.53333, 35.91667', source: 'https://en.wikipedia.org/wiki/Irbid_Governorate', notes: 'Khirbet ez-Zeraqon, Jordan' },
  'מערכת המים בחירבת זירקון': { coords: '32.53333, 35.91667', source: 'https://en.wikipedia.org/wiki/Irbid_Governorate', notes: 'Water system at Khirbet ez-Zeraqon, Jordan' },
  'מנהרות המים בחירבת זירקון': { coords: '32.53333, 35.91667', source: 'https://en.wikipedia.org/wiki/Irbid_Governorate', notes: 'Water tunnels at Khirbet ez-Zeraqon, Jordan' },
  'מנהרות המים של חירבת זירקון': { coords: '32.53333, 35.91667', source: 'https://en.wikipedia.org/wiki/Irbid_Governorate', notes: 'Water tunnels at Khirbet ez-Zeraqon, Jordan' },
  'מנהרות חירבת זירקון': { coords: '32.53333, 35.91667', source: 'https://en.wikipedia.org/wiki/Irbid_Governorate', notes: 'Water tunnels at Khirbet ez-Zeraqon, Jordan' },
  'חורבת בתר': { coords: '31.23844, 34.77868', source: 'PhD', notes: 'Horbat Batar Chalcolithic well' },
  'חורבת בטר': { coords: '31.23844, 34.77868', source: 'PhD', notes: 'Horbat Batar Chalcolithic well' },
  'באר (מס\' 38) בחורבת בתר': { coords: '31.23844, 34.77868', source: 'PhD', notes: 'Well 38 at Horbat Batar' },
  'נאמי ח\' בתר': { coords: '31.23844, 34.77868', source: 'PhD', notes: 'Horbat Batar Chalcolithic well' },
  'דיר אל-מדינה': { coords: '25.72806, 32.60139', source: 'https://en.wikipedia.org/wiki/Deir_el-Medina', notes: 'Deir el-Medina Great Pit well, Luxor, Egypt' },
  'דיר אל מדינה': { coords: '25.72806, 32.60139', source: 'https://en.wikipedia.org/wiki/Deir_el-Medina', notes: 'Deir el-Medina Great Pit well, Luxor, Egypt' },
  'מרסה מטרוח': { coords: '31.35278, 27.23611', source: 'https://en.wikipedia.org/wiki/Mersa_Matruh', notes: 'Mersa Matruh, Egypt' },
  'מרסה מטרוח שבמצרים': { coords: '31.35278, 27.23611', source: 'https://en.wikipedia.org/wiki/Mersa_Matruh', notes: 'Mersa Matruh, Egypt' },
  'מצרים העתיקה': { coords: '26.82055, 30.80250', source: 'https://en.wikipedia.org/wiki/Egypt', notes: 'Ancient Egypt' },
  'סוסיתא': { coords: '32.77889, 35.65944', source: 'https://he.wikipedia.org/wiki/%D7%A1%D7%95%D7%A1%D7%99%D7%AA%D7%90_(%D7%90%D7%AA%D7%A8_%D7%90%D7%A8%D7%9B%D7%90%D7%95%D7%9C%D7%95%D7%92%D7%99)', notes: 'Hippos / Sussita above Sea of Galilee' },
  'ציפורי': { coords: '32.75306, 35.27917', source: 'https://he.wikipedia.org/wiki/%D7%A6%D7%99%D7%A4%D7%95%D7%A8%D7%99_(%D7%99%D7%99%D7%A9%D7%95%D7%91_%D7%A2%D7%AA%D7%99%D7%A7)', notes: 'Sepphoris ancient reservoir and aqueducts' },
  'שושן': { coords: '32.18922, 48.25779', source: 'https://he.wikipedia.org/wiki/%D7%A9%D7%95%D7%A9%D7%9F_(%D7%A2%D7%99%D7%A8)', notes: 'Susa, Iran' },
  'פרספוליס': { coords: '29.93500, 52.89000', source: 'https://he.wikipedia.org/wiki/%D7%A4%D7%A8%D7%A1%D7%A4%D7%95%D7%9C%D7%99%D7%A1', notes: 'Persepolis, Iran' },
  'פרגמון': { coords: '39.13250, 27.18420', source: 'https://en.wikipedia.org/wiki/Pergamon', notes: 'Pergamon siphon aqueduct, Turkey' },
  'אקבאטאנה': { coords: '34.80167, 48.51389', source: 'https://en.wikipedia.org/wiki/Ecbatana', notes: 'Ecbatana (Hamadan), Iran' },
  'תושפה': { coords: '38.50110, 43.34000', source: 'https://en.wikipedia.org/wiki/Tushpa', notes: 'Tushpa / Van Fortress capital of Urartu, Turkey' },
  'נתןשפה': { coords: '38.50110, 43.34000', source: 'https://en.wikipedia.org/wiki/Tushpa', notes: 'Tushpa / Van Fortress, Turkey' },
  'תעלת מנואה': { coords: '38.40000, 43.41667', source: 'https://en.wikipedia.org/wiki/Tushpa', notes: 'Menua Canal (Semiramis Canal) to Tushpa, Turkey' },
  'אגמים רוסה וסיהקה': { coords: '38.63333, 42.81667', source: 'https://en.wikipedia.org/wiki/Lake_Van', notes: 'Lakes Rusa and Siyakha reservoirs, Van region, Turkey' },
  'סרדורחינילי': { coords: '38.35194, 43.46028', source: 'https://en.wikipedia.org/wiki/Van_Province', notes: 'Sardurihinili (Çavuştepe) Urartian citadel & cisterns, Turkey' },
  'באוויאן': { coords: '36.66972, 43.39361', source: 'https://en.wikipedia.org/wiki/Jerwan', notes: 'Bavian & Jerwan aqueduct canal built by Sennacherib, Iraq' },
  'בוויאן': { coords: '36.66972, 43.39361', source: 'https://en.wikipedia.org/wiki/Jerwan', notes: 'Bavian aqueduct canal, Iraq' },
  'חינס': { coords: '36.66972, 43.39361', source: 'https://en.wikipedia.org/wiki/Jerwan', notes: 'Khinis canal system built by Sennacherib, Iraq' },
  'תעלת חינס': { coords: '36.66972, 43.39361', source: 'https://en.wikipedia.org/wiki/Jerwan', notes: 'Khinis canal system built by Sennacherib, Iraq' },
  'בנדוואי': { coords: '36.66972, 43.39361', source: 'https://en.wikipedia.org/wiki/Jerwan', notes: 'Bandwai channel in Sennacherib water system, Iraq' },
  'תעלות אשוריות': { coords: '36.66972, 43.39361', source: 'https://en.wikipedia.org/wiki/Jerwan', notes: 'Assyrian aqueduct channels built by Sennacherib, Iraq' },
  'תעלת סנחריב': { coords: '36.66972, 43.39361', source: 'https://en.wikipedia.org/wiki/Jerwan', notes: 'Sennacherib canal at Jerwan/Bavian, Iraq' },
  'מפעל המים של אירביל': { coords: '36.19111, 44.00917', source: 'https://en.wikipedia.org/wiki/Erbil', notes: 'Assyrian water system of Arbela (Erbil), Iraq' },
  'ארמון נמרוד': { coords: '36.09889, 43.33083', source: 'https://en.wikipedia.org/wiki/Nimrud', notes: 'Nimrud / Kalhu palace water system, Iraq' },
  'הארמון הצפון מערבי (נמרוד)': { coords: '36.09889, 43.33083', source: 'https://en.wikipedia.org/wiki/Nimrud', notes: 'North-West Palace at Nimrud / Kalhu, Iraq' },
  'תעלת נמרוד': { coords: '36.09889, 43.33083', source: 'https://en.wikipedia.org/wiki/Nimrud', notes: 'Patti-hegalli canal at Nimrud / Kalhu, Iraq' },
  'מנהרת אופלינוס בסמוס': { coords: '37.69361, 26.92972', source: 'https://en.wikipedia.org/wiki/Tunnel_of_Eupalinos', notes: 'Tunnel of Eupalinos, Samos, Greece' },
  'מנהרת אופלינוס בסאמוס': { coords: '37.69361, 26.92972', source: 'https://en.wikipedia.org/wiki/Tunnel_of_Eupalinos', notes: 'Tunnel of Eupalinos, Samos, Greece' },
  'סמוס': { coords: '37.69083, 26.94333', source: 'https://en.wikipedia.org/wiki/Pythagoreion', notes: 'Samos / Pythagoreion, Greece' },
  'סאמוס': { coords: '37.69083, 26.94333', source: 'https://en.wikipedia.org/wiki/Pythagoreion', notes: 'Samos / Pythagoreion, Greece' },
  'המעיין המיקני (אתונה)': { coords: '37.97153, 23.72583', source: 'https://en.wikipedia.org/wiki/Acropolis_of_Athens', notes: 'Mycenaean spring fountain on Acropolis, Athens, Greece' },
  'מנהרת המעיין המיקנית (אתונה)': { coords: '37.97153, 23.72583', source: 'https://en.wikipedia.org/wiki/Acropolis_of_Athens', notes: 'Mycenaean spring tunnel on Acropolis, Athens, Greece' },
  'בור המים התת-קרקעי (מיקנה)': { coords: '37.73083, 22.75611', source: 'https://en.wikipedia.org/wiki/Mycenae', notes: 'Underground cistern at Mycenae, Greece' },
  'בית אגרטל הלוחם': { coords: '37.73083, 22.75611', source: 'https://en.wikipedia.org/wiki/Mycenae', notes: 'House of the Warrior Vase at Mycenae' },
  'מפעלי המים (טירינס)': { coords: '37.59944, 22.79972', source: 'https://en.wikipedia.org/wiki/Tiryns', notes: 'Water syrinx tunnels at Tiryns, Greece' },
  'קנאוואט': { coords: '32.75472, 36.61583', source: 'https://en.wikipedia.org/wiki/Qanawat', notes: 'Kanatha / Qanawat Roman aqueducts and baths, Syria' },
  'בצורה צ\'אי': { coords: '32.51861, 36.48194', source: 'https://en.wikipedia.org/wiki/Bosra', notes: 'Bostra water channel, Hauran, Syria' },
  'באר בבוצרה': { coords: '32.51861, 36.48194', source: 'https://en.wikipedia.org/wiki/Bosra', notes: 'Well at Bosra / Bostra, Syria' },
  'התל הצפון-מערבי (בוצרה)': { coords: '32.51861, 36.48194', source: 'https://en.wikipedia.org/wiki/Bosra', notes: 'North-West Tell at Bosra, Syria' },
  'מצבת מישע': { coords: '31.50000, 35.78333', source: 'https://en.wikipedia.org/wiki/Dhiban,_Jordan', notes: 'Dhiban (Dibon) site of Mesha Stele, Jordan' },
  'כתובת מישע': { coords: '31.50000, 35.78333', source: 'https://en.wikipedia.org/wiki/Dhiban,_Jordan', notes: 'Dhiban (Dibon) site of Mesha Stele, Jordan' },
  'אגם סליביה': { coords: '31.96800, 35.44700', source: 'PhD', notes: 'Salibiya prehistoric basin near Netiv HaGdud, Jordan Valley' },
  'סליביה IX': { coords: '31.96800, 35.44700', source: 'PhD', notes: 'Salibiya IX prehistoric site, Jordan Valley' },
  'סליבייה': { coords: '31.96800, 35.44700', source: 'PhD', notes: 'Salibiya prehistoric site, Jordan Valley' },
  'ימת הלשון': { coords: '31.50000, 35.45000', source: 'PhD', notes: 'Ancient Lake Lisan basin' },
  'חירבת רדאנה': { coords: '31.91500, 35.21500', source: 'PhD', notes: 'Khirbet Raddana Iron Age I settlement near Ramallah' },
  'בורות המים ברדאנה': { coords: '31.91500, 35.21500', source: 'PhD', notes: 'Cisterns at Khirbet Raddana' },
  'חירבת מרג\'מה': { coords: '32.02560, 35.34060', source: 'PhD', notes: 'Khirbet Marjameh Iron Age town & spring tunnel' },
  'חירבת מרגימה': { coords: '32.02560, 35.34060', source: 'PhD', notes: 'Khirbet Marjameh Iron Age town & spring tunnel' },
  'חירבת אל-חוחי': { coords: '31.69170, 35.16670', source: 'PhD', notes: 'Khirbet el-Khuwei / Etam spring installations near Solomon Pools' },
  "חירבת אל ח'וחי": { coords: '31.69170, 35.16670', source: 'PhD', notes: 'Khirbet el-Khuwei / Etam spring installations near Solomon Pools' },
  "ח'רבת אל חיוח": { coords: '31.69170, 35.16670', source: 'PhD', notes: 'Khirbet el-Khuwei / Etam spring installations near Solomon Pools' },
  'עיטם': { coords: '31.69170, 35.16670', source: 'PhD', notes: 'Etam spring and aqueduct installations' },
  'עיטס': { coords: '31.69170, 35.16670', source: 'PhD', notes: 'Etam spring and aqueduct installations' },
  'חירבת אל-כיכ': { coords: '32.18500, 35.21000', source: 'PhD', notes: 'Khirbet el-Kik / Keik in Samaria' },
  'חירבת אל-כיף': { coords: '32.18500, 35.21000', source: 'PhD', notes: 'Khirbet el-Kik / Keik in Samaria' },
  'חי אל-כיכ': { coords: '32.18500, 35.21000', source: 'PhD', notes: 'Khirbet el-Kik / Keik in Samaria' },
  'חירבת בנת-בר': { coords: '32.08333, 34.98333', source: 'https://survey.iaa.org.il/', notes: 'Khirbet Banat Bar in Rosh HaAyin / Aphek region' },
  'תל כשף': { coords: '32.48333, 35.56667', source: 'https://survey.iaa.org.il/', notes: 'Tel Kashaf in Beth Shean Valley' },
  'תל אל-מוחפר': { coords: '32.33800, 34.89600', source: 'https://survey.iaa.org.il/', notes: 'Tel Hefer / Tell el-Muhaffar in Sharon plain' },
  'כפר עג\'ול': { coords: '32.02861, 35.21333', source: 'https://en.wikipedia.org/wiki/Ajjul', notes: 'Ajjul / Kfar Ajjul in Ephraim hills' },
  'א-ריינה': { coords: '32.71667, 35.31667', source: 'https://en.wikipedia.org/wiki/Reineh', notes: 'Reineh in lower Galilee' },
  'חורבת זיכרין': { coords: '32.07194, 34.96694', source: 'PhD', notes: 'Horbat Zikhrin Byzantine & Roman water system near Rosh HaAyin' },
  'חורבת לבד': { coords: '32.05000, 35.01667', source: 'https://survey.iaa.org.il/', notes: 'Horbat Labed in western Samaria' },
  'מערת ידימן': { coords: '31.61667, 35.33333', source: 'PhD', notes: 'Idiman Cave in Judean Desert' },
  'מערת ערק אל-אחמד': { coords: '31.59000, 35.34000', source: 'PhD', notes: 'Erq el-Ahmar Cave in Judean Desert' },
  'ראס גידר': { coords: '31.75000, 35.25000', source: 'PhD', notes: 'Ras Gidir near Jerusalem' },
  'תל אביב': { coords: '32.07632, 34.78947', source: 'https://he.wikipedia.org/wiki/%D7%AA%D7%9C_%D7%90%D7%91%D7%99%D7%91-%D7%99%D7%A4%D7%95', notes: 'Tel Aviv-Jaffa' },
  'קרית גת': { coords: '31.60910, 34.76490', source: 'https://he.wikipedia.org/wiki/%D7%A7%D7%A8%D7%99%D7%99%D7%AA_%D7%92%D7%AA', notes: 'Kiryat Gat' },
  'כפר מנחם': { coords: '31.72980, 34.83302', source: 'https://he.wikipedia.org/wiki/%D7%9B%D7%A4%D7%A8_%D7%9E%D7%A0%D7%97%D7%9D', notes: 'Kfar Menahem' },
  'נקבת חזקיהו': { coords: '31.77236, 35.23567', source: 'PhD', notes: 'Hezekiah\'s Tunnel, City of David, Jerusalem' },
  'פיר וורן': { coords: '31.77310, 35.23610', source: 'PhD', notes: 'Warren\'s Shaft, City of David, Jerusalem' },
  'עין סית מרים': { coords: '31.77333, 35.23556', source: 'PhD', notes: 'Gihon Spring (Ain Sitti Maryam), City of David, Jerusalem' },
  'מעיין פרסיאה': { coords: '37.73083, 22.75611', source: 'https://en.wikipedia.org/wiki/Mycenae', notes: 'Perseia Spring fountain house at Mycenae, Greece' },
  'מנהרת המעיין בגבעון': { coords: '31.84830, 35.18670', source: 'PhD', notes: 'Gibeon Spring Tunnel, el-Jib' },
  'מצודת נחל סרפד מערב': { coords: '30.56000, 34.68000', source: 'PhD', notes: 'Nahal Sarfad West Iron Age fortress in Negev' },
  'מחנה האשורים': { coords: '31.78000, 35.22000', source: 'PhD', notes: 'Camp of the Assyrians in Jerusalem' },
  'סלע': { coords: '30.32083, 35.43750', source: 'PhD', notes: 'Sela / Umm el-Biyara / Petra' },
  'ביר אל-עבהרה': { coords: '31.24472, 34.84139', source: 'PhD', notes: 'Tel Beersheba deep well' },
  'לחי ראי': { coords: '30.85000, 34.40000', source: 'https://he.wikipedia.org/wiki/%D7%91%D7%90%D7%A8_%D7%9C%D7%97%D7%99_%D7%A8%D7%90%D7%99', notes: 'Beer Lahai Roi in Negev' },
  'שטנה': { coords: '31.38000, 34.60000', source: 'PhD', notes: 'Sitnah well in Gerar valley' },
  'חורבת טוב': { coords: '31.32771, 35.14949', source: 'PhD', notes: 'Horbat Tov Iron Age fortress and well (נ.צ. 16430818 / 16430819)' },
  'מצודת חורבת טוב': { coords: '31.32771, 35.14949', source: 'PhD', notes: 'Horbat Tov Iron Age fortress and well (נ.צ. 16430818)' },
  'חרי טוב': { coords: '31.32771, 35.14949', source: 'PhD', notes: 'Horbat Tov in Negev' },
  'אתר קלע': { coords: '32.05449, 35.08647', source: 'PhD', notes: 'Site of Qal\'a in Samaria (נ.צ. 15841624)' },
  'קלע': { coords: '32.05449, 35.08647', source: 'PhD', notes: 'Site of Qal\'a in Samaria (נ.צ. 15841624)' },
  'אום אל-ביארה': { coords: '30.32083, 35.43750', source: 'PhD', notes: 'Umm el-Biyara fortress, Petra, Jordan' },
  'מעיין דיבדיבה': { coords: '31.84830, 35.18670', source: 'PhD', notes: 'Dibdiba Spring at Gibeon (el-Jib)' },
  'רבי': { coords: '32.75000, 35.50000', source: 'https://survey.iaa.org.il/', notes: 'Horbat Rabbi in Lower Galilee' },
  'עגיה': { coords: '31.90000, 35.20000', source: 'PhD', notes: 'Ajjul region settlement' },
  'בית אגרטל הלוחם': { coords: '37.73083, 22.75611', source: 'https://en.wikipedia.org/wiki/Warrior_Vase', notes: 'House of the Warrior Vase at Mycenae' },
  'פגדי העליון': { coords: '31.88000, 35.46000', source: 'PhD', notes: 'Fagadi Upper spring channel near Jericho' },
  'פגדי התחתון': { coords: '31.88000, 35.46000', source: 'PhD', notes: 'Fagadi Lower spring channel near Jericho' },
  'בעל שלשה': { coords: '32.15000, 35.05000', source: 'PhD', notes: 'Baal Shalisha in Sharon/Samaria foothills' },
  'קלעה מורטקה': { coords: '30.32861, 35.44194', source: 'https://en.wikipedia.org/wiki/Petra', notes: 'Petra fortress citadel water catchment' },
  'קוואיר': { coords: '38.40000, 43.41667', source: 'https://en.wikipedia.org/wiki/Menua_Canal', notes: 'Qewaye aqueduct bridge on Menua Canal, Urartu' },
  'קימסע': { coords: '31.60000, 35.00000', source: 'PhD', notes: 'Qimsa in Judean Shephelah' },
  'עין סנג\'את': { coords: '31.97000, 35.22000', source: 'PhD', notes: 'Ein Sanjal spring in Samaria' },
  'מערת קטט': { coords: '31.58000, 35.32000', source: 'PhD', notes: 'Qatata Cave in Judean Desert' },
  'מערת בידאם': { coords: '31.57000, 35.33000', source: 'PhD', notes: 'Baidam Cave in Judean Desert' },
  'שטח E': { coords: '31.77406, 35.23584', source: 'PhD', notes: 'Area E excavations in City of David, Jerusalem' },
  'עין אל-ג\'יבליה': { coords: '31.84830, 35.18670', source: 'PhD', notes: 'Ein el-Jibliya spring at Gibeon' },
  'בור 216': { coords: '31.28173, 35.12535', source: 'PhD', notes: 'Cistern 216 at Tel Arad' },
  'ממגורה 281': { coords: '31.28173, 35.12535', source: 'PhD', notes: 'Silo 281 at Tel Arad' },
  'חידר בסאטליה': { coords: '38.40000, 43.41667', source: 'https://en.wikipedia.org/wiki/Menua_Canal', notes: 'Haidar Basatlia canal inscription site, Urartu' },
  'עיאדס': { coords: '32.33611, 37.03472', source: 'https://en.wikipedia.org/wiki/Jawa,_Jordan', notes: 'Ayades water channel at Jawa, Jordan' },
  'סיקיעה': { coords: '38.40000, 43.41667', source: 'https://en.wikipedia.org/wiki/Menua_Canal', notes: 'Sikiya reservoir on Menua canal, Urartu' },
  'סנצבה': { coords: '31.98000, 35.22000', source: 'PhD', notes: 'Sanaba / Seneba near Tell en-Nasbeh' },
  'אולכו': { coords: '38.50000, 44.00000', source: 'https://en.wikipedia.org/wiki/Urartu', notes: 'Ulhu irrigated royal garden city, Urartu' },
  'הבריכה הגדולה (ג\'ית)': { coords: '32.20389, 35.15833', source: 'PhD', notes: 'Great Pool at Jitt, Samaria' },
  'בור פתוח רדוד מס\' 121 (נחל בוקר)': { coords: '30.87500, 34.78300', source: 'PhD', notes: 'Open cistern 121 at Nahal Boker' },
  'באר רסיסים': { coords: '30.90000, 34.65000', source: 'PhD', notes: 'Be\'er Resisim, Central Negev' },
  'מפעל המים בתל א-סעידיה': { coords: '32.26667, 35.57861', source: 'PhD', notes: 'Tell es-Sa\'idiyeh water system, Jordan Valley' },
  'מתקני המים בארמון המערבי בתל א-סעידיה': { coords: '32.26667, 35.57861', source: 'PhD', notes: 'West Palace water system at Tell es-Sa\'idiyeh' },
  'בור מים בשילה': { coords: '32.05556, 35.28944', source: 'PhD', notes: 'Cistern at Tel Shiloh' },
  'בור מים בתענך': { coords: '32.52083, 35.22167', source: 'PhD', notes: 'Cistern at Tel Taanach' },
  'מפעל המים בתענך': { coords: '32.52083, 35.22167', source: 'PhD', notes: 'Water system at Tel Taanach' },
  'מפעל המים של תל יקנעם': { coords: '32.66444, 35.10944', source: 'PhD', notes: 'Water system at Tel Yokneam' },
  'מפעל המים של יבלעם': { coords: '32.44306, 35.29722', source: 'PhD', notes: 'Water system at Tel Ibleam / Belameh' },
  'מפעל המים של יבלעם - המנהרה': { coords: '32.44306, 35.29722', source: 'PhD', notes: 'Tunnel water system at Tel Ibleam / Belameh' },
  'בולען תל דן': { coords: '33.24889, 35.65222', source: 'PhD', notes: 'Sinkhole at Tel Dan' },
  'הבולען בתל דן': { coords: '33.24889, 35.65222', source: 'PhD', notes: 'Sinkhole at Tel Dan' },
  'מוצא הבולען בתל דן': { coords: '33.24889, 35.65222', source: 'PhD', notes: 'Sinkhole outlet at Tel Dan' },
  'בית מרחץ בתל דן': { coords: '33.24889, 35.65222', source: 'PhD', notes: 'Bathhouse at Tel Dan' },
  'נימפיאון בתל דן': { coords: '33.24889, 35.65222', source: 'PhD', notes: 'Nymphaeum at Tel Dan' },
  'מקורות המים בתל דן': { coords: '33.24889, 35.65222', source: 'PhD', notes: 'Water sources at Tel Dan' },
  'מעיינות הדן': { coords: '33.24889, 35.65222', source: 'PhD', notes: 'Dan Springs at Tel Dan' }
};

// Parent Site Inheritance Maps for specific installations
function resolveParentSiteCoords(name) {
  // 1. Explicitly named sites in parentheses or text
  if (name.includes('גאזי') || name.includes('גאז') || name.includes('ע\'אזי') || name.includes('עזאל')) {
    return { coords: '31.98800, 35.97600', source: 'https://en.wikipedia.org/wiki/Ayn_Ghazal_(archaeological_site)', notes: 'Installation at \'Ain Ghazal, Jordan' };
  }
  if (name.includes('ביידא')) return { coords: '30.37889, 35.44750', source: 'https://en.wikipedia.org/wiki/Beidha_(Jordan)', notes: 'Installation at Beidha, Jordan' };
  if (name.includes('הצ\'ילר')) return { coords: '37.59972, 30.08139', source: 'https://en.wikipedia.org/wiki/Hacilar', notes: 'Installation at Hacilar, Turkey' };
  if (name.includes('כפר סמיר')) return { coords: '32.79361, 34.95750', source: 'PhD', notes: 'Installation at Kfar Samir' };
  if (name.includes('כפר גלים')) return { coords: '32.77500, 34.95300', source: 'PhD', notes: 'Installation at Kfar Galim' };
  if (name.includes('חוף הכרמל')) return { coords: '32.78000, 34.95500', source: 'PhD', notes: 'Installation off Carmel Coast' };
  if (name.includes('תל א-סעידיה') || name.includes('א-סעידיה')) return { coords: '32.26667, 35.57861', source: 'PhD', notes: 'Installation at Tell es-Sa\'idiyeh, Jordan' };
  if (name.includes('נמרוד')) return { coords: '36.09889, 43.33083', source: 'https://en.wikipedia.org/wiki/Nimrud', notes: 'Installation at Nimrud / Kalhu, Iraq' };
  if (name.includes('בוצרה') || name.includes('בוסרה')) return { coords: '32.51861, 36.48194', source: 'https://en.wikipedia.org/wiki/Bosra', notes: 'Installation at Bosra / Bostra, Syria' };
  if (name.includes('עיטם') || name.includes('אל-חוח')) return { coords: '31.69170, 35.16670', source: 'PhD', notes: 'Installation at Etam / Khirbet el-Khuwei' };
  if (name.includes('תל גריסה')) return { coords: '32.09100, 34.80500', source: 'PhD', notes: 'Installation at Tel Gerisa' };
  if (name.includes('תל נאמי')) return { coords: '32.65833, 34.91944', source: 'PhD', notes: 'Installation at Tel Nami' };
  if (name.includes('חורבת בתר')) return { coords: '31.23844, 34.77868', source: 'PhD', notes: 'Installation at Horbat Batar' };
  if (name.includes('ג\'ית')) return { coords: '32.20389, 35.15833', source: 'PhD', notes: 'Installation at Jitt, Samaria' };
  if (name.includes('נחל בוקר')) return { coords: '30.87500, 34.78300', source: 'PhD', notes: 'Installation at Nahal Boker' };
  if (name.includes('אתונה')) return { coords: '37.97153, 23.72583', source: 'https://en.wikipedia.org/wiki/Acropolis_of_Athens', notes: 'Installation on Acropolis, Athens' };
  if (name.includes('מיקנה')) return { coords: '37.73083, 22.75611', source: 'https://en.wikipedia.org/wiki/Mycenae', notes: 'Water system at Mycenae' };
  if (name.includes('טירינס')) return { coords: '37.59944, 22.79972', source: 'https://en.wikipedia.org/wiki/Tiryns', notes: 'Water system at Tiryns' };
  if (name.includes('זירקון')) return { coords: '32.53333, 35.91667', source: 'https://en.wikipedia.org/wiki/Khirbet_ez-Zeraqon', notes: 'Water system at Khirbet ez-Zeraqon' };
  if (name.includes('ג\'ווה') || name.includes('גווה') || name.includes('גיווה')) return { coords: '32.33611, 37.03472', source: 'https://en.wikipedia.org/wiki/Jawa,_Jordan', notes: 'Water pool at Jawa' };
  if (name.includes('חצור')) return { coords: '33.01764, 35.56806', source: 'PhD', notes: 'Iron Age water system at Tel Hazor' };
  if (name.includes('תל דן') || name.includes('בדן') || (name.includes('הדן') && !name.includes('ירדן'))) {
    return { coords: '33.24889, 35.65222', source: 'PhD', notes: 'Water installation at Tel Dan' };
  }
  if (name.includes('מגידו')) return { coords: '32.58556, 35.18472', source: 'PhD', notes: 'Water installation at Tel Megiddo' };
  if (name.includes('גזר')) return { coords: '31.86000, 34.92500', source: 'PhD', notes: 'Water system at Tel Gezer' };
  if (name.includes('בית שמש')) return { coords: '31.75000, 34.98500', source: 'PhD', notes: 'Water system at Tel Beit Shemesh' };
  if (name.includes('עוזה')) return { coords: '31.20919, 35.16567', source: 'PhD', notes: 'Water system and fortress at Horbat Uza' };
  if (name.includes('טוב') && !name.includes('טובס')) return { coords: '31.32771, 35.14949', source: 'PhD', notes: 'Fortress and well at Horbat Tov' };
  if (name.includes('קלע') && !name.includes('מורטקה') && !name.includes('אלון')) return { coords: '32.05449, 35.08647', source: 'PhD', notes: 'Site of Qal\'a in Samaria' };
  if (name.includes('רדום')) return { coords: '31.13890, 35.18890', source: 'PhD', notes: 'Water system at Horbat Radum' };
  if (name.includes('קדש ברנע')) return { coords: '30.64806, 34.42194', source: 'PhD', notes: 'Fortress water conduit at Kadesh Barnea' };
  if (name.includes('אשדוד')) return { coords: '31.75139, 34.65472', source: 'PhD', notes: 'Installation at Tel Ashdod' };
  if (name.includes('גבעון')) return { coords: '31.84830, 35.18670', source: 'PhD', notes: 'Water installation at Gibeon' };
  if (name.includes('ערד')) return { coords: '31.28173, 35.12535', source: 'PhD', notes: 'Water system at Tel Arad' };
  if (name.includes('באר שבע') || name.includes('באר-שבע')) return { coords: '31.24472, 34.84139', source: 'PhD', notes: 'Water installation at Tel Beersheba' };
  if (name.includes('ירושלים') || name.includes('עיר דוד') || name.includes('שילוח') || name.includes('גיחון') || name.includes('תעלה') || name.includes('הבריכה העליונה') || name.includes('הבריכה התחתונה') || name.includes('הבריכה העשויה') || name.includes('הבריכה של בליס') || name.includes('שלוש הבריכות') || name.includes('מגדל המעיין') || name.includes('מגדל הבריכה')) {
    return { coords: '31.77406, 35.23584', source: 'PhD', notes: 'Water system in City of David / Jerusalem' };
  }
  // Exact match for Metzer (do NOT match "מצרים")
  if (/\bמצר\b/.test(name) || name.includes('במצר') || name === 'מצר') {
    return { coords: '32.47469, 35.03584', source: 'PhD', notes: 'Installation at Metzer' };
  }
  // Ai (do NOT match "העיר")
  if (name.includes('בהעי') || name.includes('של העי') || name.includes('העי ') || name.endsWith('העי')) {
    return { coords: '31.91690, 35.26080', source: 'PhD', notes: 'Reservoir at Ai (et-Tell)' };
  }

  // Check parent inside parentheses: "בור (אתר)"
  const parenMatch = name.match(/\(([^)]+)\)/);
  if (parenMatch) {
    const parent = parenMatch[1].trim();
    const parentRes = resolveParentSiteCoords(parent);
    if (parentRes) return parentRes;
  }

  // 2. Generic numbered installations defaulting to their excavated sites
  // Arad numbered cisterns & silos
  if (/^(בור|ממגורה)\s+\d+/.test(name) || name === 'הבאר בערד' || name === 'בריכת המים בערד') {
    return { coords: '31.28173, 35.12535', source: 'PhD', notes: 'Cistern / silo installation at Tel Arad' };
  }
  // Beit Shemesh numbered cisterns
  if (name.includes("בור מים מס'") && !name.includes('נחל') && !name.includes('בוקר')) {
    return { coords: '31.75000, 34.98500', source: 'PhD', notes: 'Numbered cistern at Tel Beit Shemesh' };
  }
  if (name.includes('בור מס\' 2') || name.includes('בור מס\' 20') || name.includes('בור מס\' 51') || name.includes('בור מס\' 52') || name.includes('בור מס\' 53') || name.includes('בור 40') || name.includes('בור מס\' 40')) {
    return { coords: '31.28173, 35.12535', source: 'PhD', notes: 'Numbered cistern at Tel Arad' };
  }
  return null;
}

async function main() {
  console.log('=== Precise Location Extraction & Complete Geocoding Pipeline ===');

  const locsPath = join(process.cwd(), 'data', 'locations_dissertation.json');
  const allLocs = JSON.parse(readFileSync(locsPath, 'utf8'));

  const pointLocs = allLocs.filter(l => {
    const type = (l.site_type || '').toLowerCase().trim();
    if (EXCLUDED_TYPES.has(type)) return false;
    if (GENERIC_TYPOLOGY_TERMS.has(l.location_name)) return false;
    return true;
  });

  console.log(`Loaded ${allLocs.length} total extracted locations.`);
  console.log(`Retained ${pointLocs.length} point archaeological entities for geocoding.\n`);

  // Load IAA Cached Sites
  const iaaCachePath = join(process.cwd(), '.iaa_cache', 'iaa_sites_with_coords.json');
  let iaaSites = [];
  if (existsSync(iaaCachePath)) {
    iaaSites = JSON.parse(readFileSync(iaaCachePath, 'utf8'));
    console.log(`Loaded ${iaaSites.length} IAA survey sites with coordinates from cache.`);
  }

  // Load Wikipedia Geocoding Cache
  const wikiCachePath = join(process.cwd(), '.geocode_cache', 'wiki_coords.json');
  let wikiCache = {};
  if (existsSync(wikiCachePath)) {
    try {
      wikiCache = JSON.parse(readFileSync(wikiCachePath, 'utf8'));
      console.log(`Loaded ${Object.keys(wikiCache).length} cached Wikipedia coordinate entries.`);
    } catch (e) {}
  }

  // Build IAA search indices
  const iaaByExactHeb = new Map();
  const iaaByStemHeb = new Map();

  for (const site of iaaSites) {
    if (!site.latitude || !site.longitude) continue;
    const rawH = (site.name_heb || '').trim();
    if (rawH) {
      if (!iaaByExactHeb.has(rawH)) iaaByExactHeb.set(rawH, []);
      iaaByExactHeb.get(rawH).push(site);

      const stemH = normalizeHebrew(rawH);
      if (stemH) {
        if (!iaaByStemHeb.has(stemH)) iaaByStemHeb.set(stemH, []);
        iaaByStemHeb.get(stemH).push(site);
      }
    }
  }

  // Build PhD Master Gazetteer Index
  const gazMap = new Map();
  for (const [key, val] of Object.entries(MASTER_ARCHAEOLOGICAL_GAZETTEER)) {
    if (val.lat && val.lon) {
      const stemH = normalizeHebrew(val.hebName);
      if (stemH) gazMap.set(stemH, val);
      const exactH = (val.hebName || '').trim();
      if (exactH) gazMap.set(exactH, val);
    }
  }

  // Build Comprehensive Directory Index
  const compMap = new Map();
  for (const [k, val] of Object.entries(COMPREHENSIVE_ARCHAEOLOGICAL_DIRECTORY)) {
    compMap.set(k.trim(), val);
    const stem = normalizeHebrew(k);
    if (stem) compMap.set(stem, val);
  }

  const outputRows = [];
  let totalCandidatesCount = 0;
  let singleCount = 0;
  let multipleCount = 0;
  const sourceCounts = { PhD: 0, IAA: 0, Web: 0 };

  for (const entity of pointLocs) {
    const rawName = entity.location_name.trim();
    const stemName = normalizeHebrew(rawName);
    const engName = (entity.english_name || '').trim();
    const aliases = (entity.hebrew_aliases || '').split(';').map(s => s.trim()).filter(Boolean);

    const candidates = [];

    // --- Tier 1: Comprehensive Directory & Master Gazetteer (PhD & Curated High Precision) ---
    let compMatch = compMap.get(rawName) || compMap.get(stemName);
    if (!compMatch) {
      for (const al of aliases) {
        compMatch = compMap.get(al) || compMap.get(normalizeHebrew(al));
        if (compMatch) break;
      }
    }

    if (compMatch) {
      candidates.push({
        source: compMatch.source,
        coords: compMatch.coords,
        score: 100,
        notes: compMatch.notes
      });
    }

    let phdMatch = gazMap.get(rawName) || gazMap.get(stemName);
    if (!phdMatch) {
      for (const al of aliases) {
        phdMatch = gazMap.get(al) || gazMap.get(normalizeHebrew(al));
        if (phdMatch) break;
      }
    }

    if (phdMatch && phdMatch.lat && phdMatch.lon) {
      candidates.push({
        source: 'PhD',
        coords: `${Number(phdMatch.lat).toFixed(5)}, ${Number(phdMatch.lon).toFixed(5)}`,
        score: 100,
        notes: phdMatch.notes || phdMatch.source || 'Dissertation Chapter 2 Corpus'
      });
    }

    // Check Parent Site Inheritance for installations
    const parentSite = resolveParentSiteCoords(rawName);
    if (parentSite && candidates.length === 0) {
      candidates.push({
        source: parentSite.source,
        coords: parentSite.coords,
        score: 95,
        notes: parentSite.notes
      });
    }

    // --- Tier 2: IAA Survey Database ---
    const matchedIaaSites = [];
    const seenIaaIds = new Set();
    const pool = [
      ...(iaaByExactHeb.get(rawName) || []),
      ...(iaaByStemHeb.get(stemName) || [])
    ];

    for (const al of aliases) {
      const alStem = normalizeHebrew(al);
      if (iaaByExactHeb.has(al)) pool.push(...iaaByExactHeb.get(al));
      if (iaaByStemHeb.has(alStem)) pool.push(...iaaByStemHeb.get(alStem));
    }

    for (const site of pool) {
      if (seenIaaIds.has(site.iaa_id)) continue;
      seenIaaIds.add(site.iaa_id);
      matchedIaaSites.push(site);
    }

    for (const s of matchedIaaSites) {
      let score = 50;
      if (s.name_heb === rawName) score += 30;
      if (s.name_heb.includes('תל') && rawName.includes('תל')) score += 10;
      if (s.name_heb.includes('חורבת') && rawName.includes('חורבת')) score += 10;
      if (s.description_heb && (s.description_heb.includes('ברזל') || s.description_heb.includes('ברונזה') || s.description_heb.includes('בור') || s.description_heb.includes('באר') || s.description_heb.includes('מים'))) {
        score += 15;
      }

      candidates.push({
        source: 'IAA',
        coords: `${Number(s.latitude).toFixed(5)}, ${Number(s.longitude).toFixed(5)}`,
        score: score,
        notes: `IAA Map ${s.map_number} (${s.map_name_heb}), Site ${s.site_num} [ID: ${s.iaa_id}]`,
        iaa_url: s.portal_url
      });
    }

    // --- Tier 3: Wikipedia & Wikidata Coordinates Cache ---
    const wikiDirect = wikiCache[rawName] || wikiCache[`תל ${rawName}`] || wikiCache[`חורבת ${rawName}`] || wikiCache[engName];
    if (wikiDirect && wikiDirect.lat && wikiDirect.lon) {
      candidates.push({
        source: wikiDirect.url || `https://he.wikipedia.org/wiki/${encodeURIComponent(rawName)}`,
        coords: `${Number(wikiDirect.lat).toFixed(5)}, ${Number(wikiDirect.lon).toFixed(5)}`,
        score: 75,
        notes: `Wikipedia: ${wikiDirect.title || rawName}`
      });
    }

    // If still empty, check entity latitude/longitude or search
    if (candidates.length === 0) {
      if (entity.latitude && entity.longitude) {
        candidates.push({
          source: entity.iaa_portal_url ? 'IAA' : 'https://survey.iaa.org.il/',
          coords: `${Number(entity.latitude).toFixed(5)}, ${Number(entity.longitude).toFixed(5)}`,
          score: 60,
          notes: 'Extracted site location'
        });
      }
    }

    // De-duplicate candidate coordinates
    const uniqueCandidates = [];
    for (const cand of candidates) {
      const [cLat, cLon] = cand.coords.split(',').map(n => parseFloat(n.trim()));
      const duplicate = uniqueCandidates.find(u => {
        const [uLat, uLon] = u.coords.split(',').map(n => parseFloat(n.trim()));
        return Math.abs(uLat - cLat) < 0.0005 && Math.abs(uLon - cLon) < 0.0005 && u.source === cand.source;
      });
      if (!duplicate) {
        uniqueCandidates.push(cand);
      }
    }

    if (uniqueCandidates.length === 0) {
      console.warn(`[Unresolved Location] ${rawName}`);
      continue;
    }

    const numGeocodes = uniqueCandidates.length;
    totalCandidatesCount += numGeocodes;
    if (numGeocodes === 1) singleCount++;
    else multipleCount++;

    uniqueCandidates.sort((a, b) => {
      if (a.source === 'PhD' && b.source !== 'PhD') return -1;
      if (b.source === 'PhD' && a.source !== 'PhD') return 1;
      return (b.score || 0) - (a.score || 0);
    });

    uniqueCandidates.forEach((cand, idx) => {
      const isBest = (idx === 0);
      if (isBest) {
        if (cand.source === 'PhD') sourceCounts.PhD++;
        else if (cand.source === 'IAA') sourceCounts.IAA++;
        else sourceCounts.Web++;
      }

      const [cLat, cLon] = cand.coords.split(',').map(s => s.trim());
      const gmapsUrl = `https://www.google.com/maps?q=${cLat},${cLon}&ll=${cLat},${cLon}&z=17`;

      outputRows.push({
        name: rawName,
        coordinates: cand.coords,
        source: cand.source,
        number_of_possible_geocodes: numGeocodes,
        best_candidate: isBest,
        google_maps_url: gmapsUrl
      });
    });
  }

  // Build CSV Output
  const csvHeaders = ['name', 'coordinates', 'source', 'number of possible geocodes', 'best-candidate', 'google_maps_url'];
  const csvLines = [csvHeaders.join(',')];

  for (const row of outputRows) {
    const line = [
      escapeCsv(row.name),
      escapeCsv(row.coordinates),
      escapeCsv(row.source),
      row.number_of_possible_geocodes,
      row.best_candidate ? 'true' : 'false',
      escapeCsv(row.google_maps_url)
    ].join(',');
    csvLines.push(line);
  }

  const outCsvPath = join(process.cwd(), 'data', 'geocoded_locations.csv');
  writeFileSync(outCsvPath, csvLines.join('\n'), 'utf8');

  console.log('=== Geocoding Execution Summary ===');
  console.log(`- Total point locations processed: ${pointLocs.length}`);
  console.log(`- Total candidate geocode rows generated: ${outputRows.length}`);
  console.log(`- Unique locations with 1 candidate: ${singleCount}`);
  console.log(`- Locations with multiple candidates: ${multipleCount}`);
  console.log(`- Best Candidates by Source:`);
  console.log(`   * PhD Dissertation: ${sourceCounts.PhD}`);
  console.log(`   * IAA Archaeological Survey: ${sourceCounts.IAA}`);
  console.log(`   * Web Archaeological Sources (Wikipedia / Wikidata / URLs): ${sourceCounts.Web}`);
  console.log(`\nSaved output CSV table to: ${outCsvPath} (${(csvLines.join('\n').length / 1024).toFixed(1)} KB)`);
}

main().catch(err => {
  console.error('Fatal error in geocoding pipeline:', err);
  process.exit(1);
});
