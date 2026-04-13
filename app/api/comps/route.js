import axios from 'axios';
import * as cheerio from 'cheerio';

// Stad omzetten naar Funda URL-formaat: "'s-Hertogenbosch" → "s-hertogenbosch"
function cityToSlug(city) {
  return (city ?? '')
    .toLowerCase()
    .replace(/^'+/, '')          // strip leading apostrofes
    .replace(/[^a-z0-9\s-]/g, '') // strip speciale tekens
    .trim()
    .replace(/\s+/g, '-');
}

// Haal Funda verkocht-pagina op (ScraperAPI met nl land)
async function scrapeFundaVerkocht(city) {
  const slug = cityToSlug(city);
  if (!slug) return null;

  const url  = `https://www.funda.nl/koop/${slug}/verkocht/`;
  const key  = process.env.SCRAPER_API_KEY;
  if (!key) return null;

  try {
    const { data } = await axios.get(
      `http://api.scraperapi.com?api_key=${key}&url=${encodeURIComponent(url)}&render=false&country_code=nl`,
      { timeout: 8000 }
    );
    return data;
  } catch { return null; }
}

// Zoek diep in een object naar een waarde voor een van de opgegeven keys
function deepFind(obj, keys, depth = 0) {
  if (depth > 12 || !obj || typeof obj !== 'object') return null;
  for (const key of keys) {
    if (obj[key] !== undefined && obj[key] !== null && obj[key] !== '') return obj[key];
  }
  for (const val of Object.values(obj)) {
    if (typeof val === 'object') {
      const f = deepFind(val, keys, depth + 1);
      if (f !== null) return f;
    }
  }
  return null;
}

// Pareer Funda __NEXT_DATA__ voor een zoekresultaten-pagina
function parseSearchResults(html) {
  try {
    const $ = cheerio.load(html);
    const raw = $('script#__NEXT_DATA__').html();
    if (!raw) return [];
    const json = JSON.parse(raw);

    // Funda stopt zoekresultaten in verschillende keys afhankelijk van versie
    const listings =
      deepFind(json, ['searchResult', 'listings', 'results', 'objects', 'hits']) ?? [];

    if (!Array.isArray(listings) || listings.length === 0) return [];

    return listings.slice(0, 8).map(item => {
      const street  = deepFind(item, ['streetName',  'straatnaam',   'street']);
      const hn      = deepFind(item, ['houseNumber',  'huisnummer',   'houseNr']);
      const hns     = deepFind(item, ['houseNumberSuffix', 'huisnummertoevoeging', 'addition']);
      const city    = deepFind(item, ['city', 'woonplaatsnaam', 'woonplaats', 'place']);
      const price   = deepFind(item, ['sellingPrice', 'koopprijs', 'askingPrice', 'price', 'transactionPrice']);
      const sqm     = deepFind(item, ['livingArea', 'usableArea', 'woonoppervlakte', 'floorArea']);
      const energy  = deepFind(item, ['energyLabel', 'energyClass', 'energieklasse', 'energieLabelKlasse']);
      const year    = deepFind(item, ['constructionYear', 'bouwjaar']);
      const rooms   = deepFind(item, ['numberOfRooms', 'aantalKamers', 'rooms']);
      const txDate  = deepFind(item, ['transactionDate', 'transactiedatum', 'soldDate', 'datumVerkoop', 'dateOfSale']);

      const address = street && hn
        ? `${street} ${hn}${hns ?? ''}, ${city ?? ''}`.trim().replace(/,$/, '')
        : null;

      const energyNorm = typeof energy === 'string'
        ? energy.trim().toUpperCase().replace(/^([A-G]).*/, '$1')
        : null;

      return {
        address,
        price:      typeof price === 'number' ? price : null,
        sqm:        typeof sqm   === 'number' ? sqm   : null,
        energy:     energyNorm,
        year_built: typeof year  === 'number' ? year  : null,
        rooms:      typeof rooms === 'number' ? rooms : null,
        datum:      txDate ?? null,
      };
    }).filter(c => c.address && c.price > 0);

  } catch { return []; }
}

export async function POST(request) {
  try {
    const { woonplaats } = await request.json();
    if (!woonplaats) return Response.json({ comps: [], source: 'no_city' });

    const html = await scrapeFundaVerkocht(woonplaats);
    if (!html) return Response.json({ comps: [], source: 'scrape_failed' });

    const comps = parseSearchResults(html);

    return Response.json({
      comps: comps.slice(0, 5),
      source: comps.length > 0 ? 'funda_verkocht' : 'parse_failed',
      city: woonplaats,
    });
  } catch (e) {
    return Response.json({ comps: [], error: e.message });
  }
}
