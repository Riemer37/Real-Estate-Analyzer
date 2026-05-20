// Diagnoses m² extraction for a Funda URL
// POST { url } → { sqmHits, labelValueHits, textMatches, bagSqm, htmlLength }
import axios from 'axios';
import * as cheerio from 'cheerio';

function deepFindAll(obj, keys, depth = 0, results = []) {
  if (depth > 15 || !obj || typeof obj !== 'object') return results;
  for (const key of Object.keys(obj)) {
    const v = obj[key];
    if (keys.includes(key) && v !== null && v !== undefined && v !== '') {
      results.push({ key, value: v, type: typeof v });
    }
    if (v && typeof v === 'object') deepFindAll(v, keys, depth + 1, results);
  }
  return results;
}

const SQM_LABEL_RE = /woonoppervlakte|woonopp|living\s*area|floor\s*area|usable\s*area/i;

function labelValueHits(obj, depth = 0, results = []) {
  if (depth > 15 || !obj) return results;
  if (Array.isArray(obj)) {
    for (const item of obj) {
      if (item && typeof item === 'object') {
        const label = String(item.label ?? item.name ?? item.title ?? item.key ?? '');
        const value = item.value ?? item.data ?? item.content ?? item.formattedValue ?? '';
        if (SQM_LABEL_RE.test(label)) results.push({ label, value });
        labelValueHits(item, depth + 1, results);
      }
    }
  } else if (typeof obj === 'object') {
    for (const val of Object.values(obj)) labelValueHits(val, depth + 1, results);
  }
  return results;
}

export async function POST(request) {
  const { url } = await request.json();
  const scraperKey = process.env.SCRAPER_API_KEY;
  if (!scraperKey) return Response.json({ error: 'Geen SCRAPER_API_KEY' }, { status: 500 });

  // Fetch via ScraperAPI
  let html = null;
  try {
    const { data } = await axios.get(
      `http://api.scraperapi.com?api_key=${scraperKey}&url=${encodeURIComponent(url)}&render=false&country_code=nl`,
      { timeout: 15000 }
    );
    html = data;
  } catch (e) {
    return Response.json({ error: `ScraperAPI fout: ${e.message}` }, { status: 500 });
  }

  const $ = cheerio.load(html);
  const rawScript = $('script#__NEXT_DATA__').html();

  if (!rawScript) {
    $('script, style').remove();
    return Response.json({
      error: 'Geen __NEXT_DATA__ gevonden — Funda blokkeert of render=true nodig',
      htmlLength: html.length,
      pageTextSample: $.text().slice(0, 1000),
    });
  }

  let json;
  try { json = JSON.parse(rawScript); } catch { return Response.json({ error: 'JSON parse fout' }); }

  const sqmKeys = [
    'livingArea','livingAreaSize','livingSpaceSize','netLivingArea','grossLivingArea',
    'usableArea','floorArea','woonoppervlakte','gebruiksoppervlakte','woonOppervlakte',
  ];
  const sqmHits = deepFindAll(json, sqmKeys);
  const lvHits  = labelValueHits(json);

  // Text regex matches
  $('script:not([type="application/ld+json"]), style').remove();
  const text = $.text();
  const textMatches = [
    text.match(/woonoppervlakte[^\d\n]{0,30}(\d{2,4})/i),
    text.match(/(\d{2,4})\s*m[²2]\s*(?:woon|living)/i),
  ].filter(Boolean).map(m => m[0].slice(0, 80));

  // JSON-LD
  const ldJson = [];
  $('script[type="application/ld+json"]').each((_, el) => {
    try { ldJson.push(JSON.parse($(el).html() ?? '')); } catch {}
  });

  // Try to parse address from URL for BAG lookup
  let bagSqm = null;
  try {
    const m = url.match(/funda\.nl\/detail\/(?:koop|huur)\/([^/]+)\/(?:huis|appartement|woonhuis|studio|kamer|villa|boerderij|bungalow|penthouse|grondgebonden|overig|object)-(.+?)(?:\/|\?|$)/i);
    if (m) {
      const addr = `${m[2].replace(/-/g, ' ').trim()}, ${m[1].replace(/-/g, ' ')}`;
      const loc = await fetch(
        `https://api.pdok.nl/bzk/locatieserver/search/v3_1/free?q=${encodeURIComponent(addr)}&rows=1&fl=oppervlakte_obj,weergavenaam`,
        { signal: AbortSignal.timeout(4000) }
      ).then(r => r.json()).catch(() => null);
      const doc = loc?.response?.docs?.[0];
      bagSqm = { official: doc?.oppervlakte_obj ?? null, address: doc?.weergavenaam ?? null };
    }
  } catch {}

  return Response.json({
    sqmHits,
    labelValueHits: lvHits,
    textMatches,
    ldJson: ldJson.slice(0, 3),
    bagSqm,
    htmlLength: html.length,
  });
}
