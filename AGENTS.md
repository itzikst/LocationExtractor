# PLE (Precise Location Extraction) - Project Context & Guidelines

## Project Overview
This project is dedicated to extracting, verifying, geodetically converting, and mapping all ancient water installations from **Dr. Zvika Tzuk's PhD dissertation**:
*Ancient Water Systems in Settlements in Eretz-Israel from the Neolithic Period to the End of the Iron Age* (Tel Aviv University, Department of Archaeology and Ancient Near Eastern Civilizations, 2000, 446 pages).

---

## Cloud & GCP Infrastructure
- **GCP Project ID**: `geotrends-2026`
- **Vertex AI Region / Location**: `us-central1`
- **Primary LLM**: `gemini-2.5-flash`
- **Google Cloud Storage (GCS) Bucket**: `gs://tsvika/`
  - **Input Dissertation PDF**: `gs://tsvika/input/document.pdf`
  - **Full OCR Extracted Text**: `gs://tsvika/output/document_extracted.txt`
  - **Full OCR JSON Blocks**: `gs://tsvika/output/ocr_json/output-*.json`
  - **Cloud Output Exports**: `gs://tsvika/output/`
- **Local OCR Cache**: `.ocr_tmp/document_extracted.txt` and `.ocr_tmp/output-*.json`

---

## Dissertation Structure & Sourcing Truth
1. **Pages 1–15**: Hebrew Front Matter, Table of Contents, Lists of Tables & Figures.
2. **Pages 16–42**: Chapter 1 (Methodology, History of Research, Geography, Geology).
3. **Pages 43–195**: **Chapter 2: The Core Corpus of Water Systems in Settlements**.
   - Divided into 9 chronological era sections (§2.1 to §2.9).
   - Every site is treated in its own numbered section/monograph with excavator citations, installation measurements, and in many cases explicit **Old Israel Grid coordinates (נ.צ. 6, 8, or 10-digit)**.
4. **Pages 196–216**: Chapter 3 (Typology and Technology of Water Systems).
5. **Pages 217–318**: Chapters 4–6 (Hydrology, Regional Syntheses, Historical/Social Discussion).
6. **Pages 319–358**: Chapter 7 (Summary and Conclusions).
7. **Pages 359–409**: Bibliography (Primary excavation reports and IAA survey maps).
8. **Pages 410–425**: Figures 302–308 (Period distribution maps by Nili Graicer).
9. **Pages 430–446 (`1*`–`15*`)**: English Summary and English TOC (**No Hebrew site names or coordinates here**).

---

## The 10 Chronological Era Layers
1. **Paleolithic & Epi-Paleolithic** (-20000 to -10000 BCE) — §2.1 (pp. 43–44)
2. **Pre-Pottery Neolithic (PPN)** (-8300 to -5500 BCE) — §2.2 (pp. 45–48)
3. **Pottery Neolithic (PN)** (-5500 to -4500 BCE) — §2.3 (pp. 49–51)
4. **Chalcolithic Period** (-4500 to -3300 BCE) — §2.4 (pp. 51–54)
5. **Early Bronze Age (EB I-IV)** (-3300 to -2200 BCE) — §2.5 (pp. 55–71)
6. **Middle Bronze Age (MB I-II)** (-2200 to -1550 BCE) — §2.6 (pp. 72–94)
7. **Late Bronze Age (LB I-II)** (-1550 to -1200 BCE) — §2.7 (pp. 95–104)
8. **Iron Age I** (-1200 to -1000 BCE) — §2.8 (pp. 105–114)
9. **Iron Age II (Iron IIA-IIC)** (-1000 to -586 BCE) — §2.9 (pp. 115–192)
10. **Classical & Later Periods** (-586 to +638 CE) — §3.7 (pp. 207–214)

---

## Geolocation Conversion & Accuracy Standards
### 1. Coordinate Conversion (ICS to WGS84)
- Grid citations in the dissertation are **Old Israel Grid (ICS / Cassin-Soldner on Clarke 1880)**.
- High-precision conversion implemented in `scripts/archaeological_gazetteer.js`:
```javascript
function icsToWgs84(east, north) {
  const dN = north - 126867.9;
  const dE = east - 170251.6;
  const lat = 31.734097 + (dN / 110900.0);
  const lon = 35.212081 + (dE / (111320.0 * Math.cos(lat * Math.PI / 180)));
  return { lat: Number(lat.toFixed(5)), lon: Number(lon.toFixed(5)) };
}
```

### 2. Accuracy Tiers
- **Tier 1: High Precision (< 50m)**: Pinpoint excavated installation (shaft entrance, well opening, pool, tunnel portal).
- **Tier 2: Archaeological Site Precision (< 100m)**: Tell / fortress / site centroid.
- **Tier 3: Village / Settlement Area (< 500m)**: Settlement perimeter or rural site.
- **Tier 4: International Comparative Site**: Comparative sites outside Israel (e.g. Egypt, Greece, Urartu).
- **Tier 5: Regional Survey Area Centroid**: General regional cluster / survey region.

---

## Core Scripts & Files
- `scripts/archaeological_gazetteer.js`: Master geodetic converter and curated academic gazetteer.
- `scripts/extract_chapter2_eras.js`: Vertex AI Gemini extraction pipeline reading `.ocr_tmp/document_extracted.txt` by era.
- `scripts/build_mymaps_exports.js`: Generates master CSV (`water_installations_mymaps.csv`), 10 KML era layers, 10 CSV era layers, and GeoJSON.
- `data/water_installations_mymaps.csv`: Master Google My Maps dataset with era ordering and `Location_Precision`.
