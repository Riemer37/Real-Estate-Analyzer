// Stap 1/3 — Funda pagina ophalen (<9s)
// Direct fetch eerst; als __NEXT_DATA__ ontbreekt, alsnog ScraperAPI met render=true
import axios from 'axios';
import * as cheerio from 'cheerio';

function extractStructured(html) {
  try {
    const $ = cheerio.load(html);
    const raw = $('script#__NEXT_DATA__').html();
    if (!raw) return null;
    const json = JSON.parse(raw);

    function deepFind(obj, keys, depth = 0) {
      if (depth > 10 || !obj || typeof obj !== 'object') return null;
      for (const key of keys) {
        if (obj[key] !== undefined && obj[key] !== null && obj[key] !== '') return obj[key];
      }
      for (const val of Object.values(obj)) {
        if (val && typeof val === 'object') {
          const f = deepFind(val, keys, depth + 1);
          if (f !== null) return f;
        }
      }
      return null;
    }

    const price  = deepFind(json, ['sellingPrice','koopprijs','askingPrice','listPrice']);
    const sqm    = deepFind(json, ['livingArea','usableArea','oppervlakte','woonoppervlakte']);
    const year   = deepFind(json, ['constructionYear','bouwjaar','yearOfConstruction']);
    const energy = deepFind(json, ['energyLabel','energyClass','energieklasse']);
    const rooms  = deepFind(json, ['numberOfRooms','aantalKamers','rooms']);
    const street = deepFind(json, ['streetName','straatnaam','street']);
    const hn     = deepFind(json, ['houseNumber','huisnummer']);
    const hns    = deepFind(json, ['houseNumberSuffix','huisnummertoevoeging','suffix']);
    const city   = deepFind(json, ['city','woonplaatsnaam','woonplaats','place']);
    const erfp   = deepFind(json, ['groundLease','erfpacht','leasehold','isGroundLease']);

    const addressStr = street && hn
      ? `${street} ${hn}${hns ?? ''}, ${city ?? ''}`.trim().replace(/,$/, '')
      : null;
    const energyNorm = typeof energy === 'string'
      ? energy.trim().toUpperCase().replace(/^([A-G]).*/, '$1') : null;
    let erfpachtNorm = 'Onbekend';
    if (erfp === true  || erfp === 'Ja'  || erfp === 'yes')  erfpachtNorm = 'Ja';
    if (erfp === false || erfp === 'Nee' || erfp === 'no')   erfpachtNorm = 'Nee';

    const result = {
      price:    typeof price === 'number' ? price : null,
      sqm:      typeof sqm   === 'number' ? sqm   : null,
      year:     typeof year  === 'number' ? year  : null,
      energy:   energyNorm,
      rooms:    typeof rooms === 'number' ? rooms : null,
      address:  addressStr,
      erfpacht: erfpachtNorm,
    };
    return (result.price || result.address) ? result : null;
  } catch { return null; }
}

function extractText(html) {
  const $ = cheerio.load(html);
  $('script, style, nav, footer, header, iframe').remove();
  return $.text().split('\n').map(l => l.trim()).filter(l => l.length > 2).join('\n').slice(0, 4000);
}

async function fetchDirect(url) {
  const { data } = await axios.get(url, {
    timeout: 5000,
    headers: {
      'User-Agent': 'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)',
      'Accept': 'text/html,application/xhtml+xml',
      'Accept-Language': 'nl-NL,nl;q=0.9',
    },
  });
  return data;
}

async function fetchScraperApi(url, render = false) {
  const key = process.env.SCRAPER_API_KEY;
  if (!key) throw new Error('Geen ScraperAPI key');
  const scraperUrl = `http://api.scraperapi.com?api_key=${key}&url=${encodeURIComponent(url)}&render=${render}&country_code=nl`;
  const { data } = await axios.get(scraperUrl, { timeout: 9000 });
  return data;
}

export async function POST(request) {
  try {
    const { url } = await request.json();
    let html = null;
    let structured = null;

    // Poging 1: directe fetch
    try {
      html = await fetchDirect(url);
      structured = extractStructured(html);
    } catch { /* valt terug */ }

    // Poging 2: ScraperAPI render=false (als directe fetch geen __NEXT_DATA__ gaf)
    if (!structured) {
      try {
        html = await fetchScraperApi(url, false);
        structured = extractStructured(html);
      } catch { /* valt terug */ }
    }

    // Poging 3: ScraperAPI render=true (JS-rendering, als render=false ook faalt)
    if (!structured) {
      try {
        html = await fetchScraperApi(url, true);
        structured = extractStructured(html);
      } catch { /* alle pogingen mislukt */ }
    }

    const text = html ? extractText(html) : '';

    return Response.json({ structured, text, ok: true });
  } catch (e) {
    return Response.json({ structured: null, text: '', ok: false, error: e.message });
  }
}
