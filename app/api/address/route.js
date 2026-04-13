import axios from 'axios';
import * as cheerio from 'cheerio';

// ── Funda zoeken op adres ─────────────────────────────────────────────────────
function addressToFundaSearch(address) {
  // "Keizersgracht 123, Amsterdam" → zoek-URL
  const clean = address.trim();
  return `https://www.funda.nl/zoeken/koop?selected_area=%5B%22nl%22%5D&query=${encodeURIComponent(clean)}`;
}

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

// Zoek een Funda listing URL op basis van adres
async function findFundaListing(address) {
  const key = process.env.SCRAPER_API_KEY;
  if (!key) return null;

  const searchUrl = addressToFundaSearch(address);

  try {
    const { data: html } = await axios.get(
      `http://api.scraperapi.com?api_key=${key}&url=${encodeURIComponent(searchUrl)}&render=false&country_code=nl`,
      { timeout: 8000 }
    );

    const $ = cheerio.load(html);

    // Strategie 1: __NEXT_DATA__ — zoek eerste listing URL
    const raw = $('script#__NEXT_DATA__').html();
    if (raw) {
      try {
        const json = JSON.parse(raw);
        // Zoek naar listing URLs in de data
        const url = deepFind(json, ['url', 'listingUrl', 'detailUrl', 'href', 'permalink']);
        if (url && typeof url === 'string' && url.includes('funda.nl') && url.includes('/detail/')) {
          return url.startsWith('http') ? url : `https://www.funda.nl${url}`;
        }

        // Zoek arrays met listings
        function findListingUrl(obj, depth = 0) {
          if (depth > 15 || !obj || typeof obj !== 'object') return null;
          if (Array.isArray(obj)) {
            for (const item of obj.slice(0, 5)) {
              const u = deepFind(item, ['url', 'listingUrl', 'detailUrl', 'permalink', 'globalId']);
              if (u && typeof u === 'string') {
                if (u.includes('/detail/')) return u.startsWith('http') ? u : `https://www.funda.nl${u}`;
              }
              const r = findListingUrl(item, depth + 1);
              if (r) return r;
            }
          } else {
            for (const val of Object.values(obj)) {
              const r = findListingUrl(val, depth + 1);
              if (r) return r;
            }
          }
          return null;
        }
        const listingUrl = findListingUrl(json);
        if (listingUrl) return listingUrl;
      } catch {}
    }

    // Strategie 2: zoek href-links naar /detail/ in de HTML
    let found = null;
    $('a[href*="/detail/koop/"]').each((_, el) => {
      if (!found) {
        const href = $(el).attr('href') ?? '';
        if (href.includes('/detail/')) {
          found = href.startsWith('http') ? href : `https://www.funda.nl${href}`;
        }
      }
    });
    return found;

  } catch { return null; }
}

// ── Hoofd-handler ──────────────────────────────────────────────────────────────
export async function POST(request) {
  try {
    const { address } = await request.json();
    if (!address) return Response.json({ error: 'Geen adres opgegeven' }, { status: 400 });

    // Zoek eerst of er een actieve Funda-listing is
    const listingUrl = await findFundaListing(address);

    if (listingUrl) {
      // Gevonden — stuur door naar de analyze route intern
      const analyzeRes = await fetch(new URL('/api/analyze', request.url), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: listingUrl }),
      });
      const data = await analyzeRes.json();
      return Response.json({ ...data, found_listing: listingUrl });
    }

    // Niet gevonden — geef terug dat er geen actieve listing is
    return Response.json({
      error: `Geen actieve listing gevonden op Funda voor "${address}". Voer een directe URL in als de woning wel te koop staat, of controleer het adres.`,
      address_not_listed: true,
    }, { status: 404 });

  } catch (e) {
    return Response.json({ error: e.message }, { status: 500 });
  }
}
