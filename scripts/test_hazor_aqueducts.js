import { parseGridRef } from './archaeological_gazetteer.js';

const g1 = parseGridRef('20169/26938');
const g2 = parseGridRef('20245/26922');
const g3 = parseGridRef('20240/26805');

console.log('1. Northern Aqueduct West (20169/26938):', g1);
console.log('2. Northern Aqueduct East (20245/26922):', g2);
console.log('3. Southern Aqueduct Nahal Hazor (20240/26805):', g3);
console.log('4. Tel Hazor Iron Age Water Shaft (Area L):', { lat: 33.01685, lon: 35.56635 });
