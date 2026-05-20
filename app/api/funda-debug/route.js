// Dumps the raw __NEXT_DATA__ from a Funda URL via ScraperAPI
// POST { url } → { keys, sqmCandidate, rawJson }
import axios from 'axios';
import * as cheerio from 'cheerio';

function deepFindAll(obj, keys, depth = 0, results = []) {
  if (depth > 15 || !obj || typeof obj !== 'object') return results;
  for (const key of Object.keys(obj)) {
    const v = obj[key];
    if (keys.includes(key) && v !== null && v !== undefined && v !== '') {
      results.push({ key, value: v, type: typeof v });
    }
    if (v && typeof v === 'object') {
      deepFindAll(v, keys, depth + 1, results);
    }
  }
  return results;
}

function flattenKeys(obj, prefix = '', depth = 0, out = {}) {
  if (depth > 8 || !obj || typeof obj !== 'object') return out;
  for (const [k, v] of Object.entries(obj)) {
    const path = prefix ? `${prefix}.${k}` : k;
    if (v && typeof v === 'object' && !Array.isArray(v)) {
      flattenKeys(v, path, depth + 1, out);
    } else if (Array.isArray(v) && v.length > 0 && typeof v[0] === 'object') {
      flattenKeys(v[0], `${path}[0]`, depth + 1, out);
    } else {
      out[path] = v;
    }
  }
  return out;
}

export async function POST(request) {
  const { url } = await request.json();
  const key = process.env.SCRAPER_API_KEY;
  if (!key) return Response.json({ error: 'Geen SCRAPER_API_KEY' }, { status: 500 });

  let html = null;
  try {
    const { data } = await axios.get(
      `http://api.scraperapi.com?api_key=${key}&url=${encodeURIComponent(url)}&render=false&country_code=nl`,
      { timeout: 15000 }
    );
    html = data;
  } catch (e) {
    return Response.json({ error: `ScraperAPI fout: ${e.message}` }, { status: 500 });
  }

  const $ = cheerio.load(html);
  const rawScript = $('script#__NEXT_DATA__').html();

  if (!rawScript) {
    // Return page text so we can see what we got
    $('script, style').remove();
    const pageText = $.text().slice(0, 2000);
    return Response.json({ error: 'Geen __NEXT_DATA__ gevonden', pageText });
  }

  let json;
  try { json = JSON.parse(rawScript); } catch { return Response.json({ error: 'JSON parse fout' }); }

  // Find all plausible sqm-related values
  const sqmKeys = [
    'livingArea','livingAreaSize','livingSpaceSize','netLivingArea','grossLivingArea',
    'usableArea','floorArea','floorSize','objectSize','size','area',
    'woonoppervlakte','oppervlakte','gebruiksoppervlakte','woonOppervlakte',
    'woonOpp','livingspace','surfaceArea','areaSize',
  ];
  const sqmHits = deepFindAll(json, sqmKeys);

  // Flatten the first 2 levels of pageProps to see the shape
  const pageProps = json?.props?.pageProps ?? json?.pageProps ?? {};
  const flat = flattenKeys(pageProps, 'pageProps');

  // Filter flat to only show numeric-looking values or short strings
  const relevant = Object.fromEntries(
    Object.entries(flat).filter(([k, v]) =>
      typeof v === 'number' ||
      (typeof v === 'string' && v.length < 50 && !v.startsWith('http'))
    ).slice(0, 200)
  );

  return Response.json({ sqmHits, relevant, topLevelKeys: Object.keys(json) });
}
