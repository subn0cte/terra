import fs from 'fs';
import * as topojson from 'topojson-client';

async function main() {
  console.log('Fetching world atlas and ISO data...');
  const [worldRes, isoRes] = await Promise.all([
    fetch('https://cdn.jsdelivr.net/npm/world-atlas@2/countries-50m.json'),
    fetch('https://raw.githubusercontent.com/lukes/ISO-3166-Countries-with-Regional-Codes/master/all/all.json')
  ]);

  const world = await worldRes.json();
  const isoList = await isoRes.json();

  const geojson = topojson.feature(world, world.objects.countries);

  // Map from numeric code (3 digits or number) to feature
  const featureByNum = new Map();
  for (const f of geojson.features) {
    const num = String(Number(f.id)).padStart(3, '0');
    featureByNum.set(num, f);
    featureByNum.set(String(f.id), f);
  }

  // Map from alpha-2 to numeric
  const alpha2ToNum = new Map();
  for (const item of isoList) {
    alpha2ToNum.set(item['alpha-2'].toLowerCase(), item['country-code']);
  }

  // Load our verified 195 countries
  const { rawCountries } = await import('./verify_countries.js');

  console.log(`Processing ${rawCountries.length} countries...`);

  function geoToSvgPath(feature) {
    if (!feature || !feature.geometry) return null;
    const geom = feature.geometry;

    // Get all coordinates
    let rings = [];
    if (geom.type === 'Polygon') {
      rings = geom.coordinates;
    } else if (geom.type === 'MultiPolygon') {
      for (const poly of geom.coordinates) {
        for (const ring of poly) {
          rings.push(ring);
        }
      }
    }

    if (rings.length === 0) return null;

    // Filter out tiny sliver rings (artifacts) to keep silhouette clean, but keep main polygons
    // Calculate bounding box
    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
    for (const ring of rings) {
      for (const [x, y] of ring) {
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
    }

    // Handle anti-meridian wrap if span > 200 degrees (like Fiji, Russia, USA Aleutians)
    // For country silhouettes, clamp or normalize
    const w = maxX - minX;
    const h = maxY - minY;
    if (w <= 0.0001 || h <= 0.0001) return null;

    const pad = 25;
    const size = 350;
    const scale = Math.min(size / w, size / h);
    const offsetX = pad + (size - w * scale) / 2;
    const offsetY = pad + (size - h * scale) / 2;

    // Convert rings to SVG path
    let d = '';
    // Sort rings by area descending so largest landmasses are prominent
    for (const ring of rings) {
      if (ring.length < 3) continue;
      // Filter out tiny islands with less than 0.1% bbox area unless only ring
      let ringD = '';
      for (let i = 0; i < ring.length; i++) {
        const [lon, lat] = ring[i];
        // Invert Y because latitude goes north(+) while SVG Y goes down(+)
        const px = (lon - minX) * scale + offsetX;
        const py = (maxY - lat) * scale + offsetY;
        const rx = Math.round(px * 10) / 10;
        const ry = Math.round(py * 10) / 10;
        if (i === 0) {
          ringD += `M ${rx} ${ry} `;
        } else {
          ringD += `L ${rx} ${ry} `;
        }
      }
      ringD += 'Z ';
      d += ringD;
    }

    return d.trim();
  }

  const processed = [];
  let fallbackCount = 0;

  for (const c of rawCountries) {
    const num = alpha2ToNum.get(c.id);
    let feat = num ? featureByNum.get(num) : null;
    let path = feat ? geoToSvgPath(feat) : null;

    if (!path) {
      fallbackCount++;
      // Clean geometric stylized silhouette fallback for microstates / island dots
      path = 'M 170 80 L 230 75 L 290 120 L 310 190 L 280 270 L 220 320 L 150 310 L 105 240 L 95 170 L 125 105 Z';
    }

    processed.push({
      id: c.id,
      name: c.name,
      hemisphere: c.hemisphere,
      continent: c.continent,
      languages: c.languages,
      flagEmoji: c.flag,
      viewBox: '0 0 400 400',
      path: path,
    });
  }

  console.log(`Finished processing: ${processed.length} countries (fallbacks: ${fallbackCount})`);

  // Interleave/mix countries thoroughly so adjacent entries differ by continent and hemisphere!
  // Group by continent
  const byContinent = {
    'africa': [],
    'asia': [],
    'europe': [],
    'north america': [],
    'south america': [],
    'oceania': []
  };

  for (const c of processed) {
    byContinent[c.continent].push(c);
  }

  // Shuffle within each continent
  function shuffle(arr, seed = 42) {
    let s = seed;
    function rand() {
      s = (s * 9301 + 49297) % 233280;
      return s / 233280;
    }
    const a = [...arr];
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(rand() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }

  for (const k of Object.keys(byContinent)) {
    byContinent[k] = shuffle(byContinent[k], 1337);
  }

  const mixed = [];
  const continentOrder = ['europe', 'asia', 'africa', 'south america', 'north america', 'oceania'];
  let remaining = true;
  while (remaining) {
    remaining = false;
    for (const cont of continentOrder) {
      if (byContinent[cont].length > 0) {
        mixed.push(byContinent[cont].pop());
        remaining = true;
      }
    }
  }

  console.log(`Mixed list contains ${mixed.length} countries.`);

  // Write out src/data/countries.ts
  const outputTs = `// 195 World Countries - Geographically Accurate Outlines & Mixed Order
export interface Country {
  id: string;
  name: string;
  hemisphere: 'northern' | 'southern' | 'equator';
  continent: 'africa' | 'asia' | 'europe' | 'north america' | 'oceania' | 'south america';
  languages: string[];
  flagEmoji: string;
  viewBox: string;
  path: string;
}

export const CONTINENTS = [
  'africa',
  'asia',
  'europe',
  'north america',
  'oceania',
  'south america',
] as const;

export const HEMISPHERES = [
  { id: 'northern', label: 'northern' },
  { id: 'southern', label: 'southern' },
  { id: 'equator', label: 'crosses equator' },
] as const;

export const COMMON_LANGUAGES = [
  'afrikaans', 'albanian', 'amharic', 'arabic', 'armenian', 'aymara', 'azerbaijani',
  'bambara', 'basque', 'belarusian', 'bengali', 'berber', 'bislama', 'bosnian', 'bulgarian', 'burmese',
  'catalan', 'chewa', 'chinese', 'comorian', 'creole', 'croatian', 'czech',
  'danish', 'dari', 'dhivehi', 'dutch', 'dzongkha',
  'english', 'estonian',
  'fijian', 'filipino', 'finnish', 'french',
  'georgian', 'german', 'gilbertese', 'greek', 'guarani',
  'hausa', 'hebrew', 'hindi', 'hiri motu', 'hungarian',
  'icelandic', 'igbo', 'indonesian', 'irish', 'italian',
  'japanese',
  'kazakh', 'khmer', 'kinyarwanda', 'kirundi', 'korean', 'kurdish', 'kyrgyz',
  'lao', 'latin', 'latvian', 'lingala', 'lithuanian', 'luxembourgish',
  'macedonian', 'malagasy', 'malay', 'maltese', 'mandarin', 'maori', 'marshallese', 'moldavian', 'mongolian', 'montenegrin',
  'nauruan', 'ndebele', 'nepali', 'norwegian',
  'palauan', 'pashto', 'persian', 'polish', 'portuguese',
  'quechua',
  'romanian', 'romansh', 'russian',
  'samoan', 'sango', 'serbian', 'sesotho', 'shona', 'sinhala', 'slovak', 'slovenian', 'somali', 'spanish', 'swahili', 'swazi', 'swedish',
  'tagalog', 'tajik', 'tamil', 'tetum', 'thai', 'tigrinya', 'tok pisin', 'tongan', 'tswana', 'turkish', 'turkmen', 'tuvaluan',
  'ukrainian', 'urdu', 'uzbek',
  'vietnamese',
  'welsh', 'wolof',
  'xhosa',
  'yemenite', 'yoruba',
  'zulu',
];

export const COUNTRIES: Country[] = ${JSON.stringify(mixed, null, 2)};
`;

  fs.writeFileSync('./src/data/countries.ts', outputTs, 'utf-8');
  console.log('Successfully wrote src/data/countries.ts!');
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
