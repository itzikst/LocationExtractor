import { readFileSync } from 'node:fs';
import { icsToWgs84 } from './archaeological_gazetteer.js';

export function parseGridRefAccurate(gridStr) {
  if (!gridStr) return null;
  
  // Clean string and check for digits
  // Could be formatted as:
  // "14721537", "1472/1537", "1472-1537", "1472.1537", "20245/26922", "1495312430", "1885512767"
  // First, check if there is an explicit separator like / or - or . between two number parts
  const sepMatch = gridStr.match(/^([0-9]{3,6})\s*[\/\-–\.]\s*([0-9]{3,6})$/);
  let cleanE = '';
  let cleanN = '';
  
  if (sepMatch) {
    cleanE = sepMatch[1];
    cleanN = sepMatch[2];
  } else {
    const digits = gridStr.replace(/\D/g, '');
    if (digits.length === 6) {
      cleanE = digits.slice(0, 3);
      cleanN = digits.slice(3, 6);
    } else if (digits.length === 8) {
      cleanE = digits.slice(0, 4);
      cleanN = digits.slice(4, 8);
    } else if (digits.length === 10) {
      cleanE = digits.slice(0, 5);
      cleanN = digits.slice(5, 10);
    } else if (digits.length === 12) {
      cleanE = digits.slice(0, 6);
      cleanN = digits.slice(6, 12);
    } else {
      return null;
    }
  }

  let east = parseInt(cleanE, 10);
  let north = parseInt(cleanN, 10);

  // Normalize to 6-digit meter values
  if (cleanE.length === 3) east *= 1000;
  else if (cleanE.length === 4) east *= 100;
  else if (cleanE.length === 5) east *= 10;
  
  if (cleanN.length === 3) north *= 1000;
  else if (cleanN.length === 4) north *= 100;
  else if (cleanN.length === 5) north *= 10;

  return icsToWgs84(east, north);
}

const testCases = [
  '14721537',
  '16430818',
  '16430819',
  '1718.2538',
  '15541623',
  '15841624',
  '17621353',
  '1495312430',
  '1885512767',
  '1872012493',
  '1862512320',
  '16570683',
  '16590665',
  '20169/26938',
  '20245/26922',
  '20240/26805'
];

console.log('--- TESTING ACCURATE ICS TO WGS84 ---');
for (const tc of testCases) {
  const res = parseGridRefAccurate(tc);
  const mapUrl = res ? `https://www.google.com/maps?q=${res.lat},${res.lon}&ll=${res.lat},${res.lon}&z=17` : 'N/A';
  console.log(`${tc.padEnd(14)} -> ${res ? `${res.lat}, ${res.lon}` : 'FAILED'} -> ${mapUrl}`);
}
