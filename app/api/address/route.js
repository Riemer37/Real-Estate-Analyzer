import axios from 'axios';
import * as cheerio from 'cheerio';

const pFetch = (url, t = 5000) =>
  fetch(url, { signal: AbortSignal.timeout(t) }).then(r => r.ok ? r.json() : null).catch(() => null);

// ── Stap 1: Postcode + adresgegevens via PDOK (gratis, altijd werkt) ──────────
async function pdokLookup(address) {
  const data = await pFetch(
    `https://api.pdok.nl/bzk/locatieserver/search/v3_1/free?q=${encodeURIComponent(address)}&rows=3&fl=postcode,huisnummer,huisnummertoevoeging,woonplaatsnaam,straatnaam,weergavenaam,adresseerbaarobject_id`,
    5000
  );
  const doc = (data?.response?.docs ?? []).find(d => d.postcode) ?? null;
  if (!doc) return null;
  return {
    postcode:     doc.postcode,
    huisnummer:   doc.huisnummer,
    huisnrtoev:   doc.huisnummertoevoeging ?? '',
    woonplaats:   doc.woonplaatsnaam,
    straatnaam:   doc.straatnaam,
    weergavenaam: doc.weergavenaam,
    bag_id:       doc.adresseerbaarobject_id,
  };
}

function deepFind(obj, keys, depth = 0) {
  if (depth > 14 || !obj || typeof obj !== 'object') return null;
  for (const k of keys) if (obj[k] != null && obj[k] !== '') return obj[k];
  for (const v of Object.values(obj)) {
    const f = deepFind(v, keys, depth + 1);
    if (f != null) return f;
  }
  return null;
}

async function scrape(url, key, render = false, timeout = 9000) {
  try {
    const { data } = await axios.get(
      `http://api.scraperapi.com?api_key=${key}&url=${encodeURIComponent(url)}&render=${render}&country_code=nl`,
      { timeout }
    );
    return data;
  } catch { return null; }
}

// ── Stap 2a: Funda postcode-pagina → match op huisnummer ─────────────────────
async function findOnFunda(postcode, huisnummer, key) {
  const pc  = postcode.toLowerCase().replace(' ', '');
  const url = `https://www.funda.nl/koop/heel-nederland/${pc}/`;
  const html = await scrape(url, key, false, 8000);
  if (!html) return null;

  // Probeer __NEXT_DATA__
  try {
    const raw = cheerio.load(html)('script#__NEXT_DATA__').html();
    if (raw) {
      const json = JSON.parse(raw);
      // Zoek array met listings
      function findListings(obj, depth = 0) {
        if (depth > 15 || !obj || typeof obj !== 'object') return null;
        if (Array.isArray(obj) && obj.length > 0) {
          const first = obj[0];
          if (first && typeof first === 'object') {
            const hn = deepFind(first, ['houseNumber', 'huisnummer', 'houseNr', 'number']);
            if (hn != null) return obj;
          }
        }
        for (const v of Object.values(obj)) {
          const r = findListings(v, depth + 1);
          if (r) return r;
        }
        return null;
      }
      const listings = findListings(json);
      if (listings) {
        const match = listings.find(item => {
          const hn = deepFind(item, ['houseNumber', 'huisnummer', 'houseNr', 'number']);
          return String(hn) === String(huisnummer);
        });
        if (match) {
          const slug = deepFind(match, ['url', 'detailUrl', 'permalink', 'listingUrl']);
          if (slug) return slug.startsWith('http') ? slug : `https://www.funda.nl${slug}`;
        }
      }
    }
  } catch {}

  // Fallback: links in HTML
  const $ = cheerio.load(html);
  let found = null;
  $(`a[href*="-${huisnummer}/"], a[href*="-${huisnummer}-"]`).each((_, el) => {
    if (!found) {
      const href = $(el).attr('href') ?? '';
      if (href.includes('/detail/koop/')) {
        found = href.startsWith('http') ? href : `https://www.funda.nl${href}`;
      }
    }
  });
  return found;
}

// ── Stap 2b: Pararius postcode-pagina → match op huisnummer ──────────────────
async function findOnPararius(postcode, huisnummer, woonplaats, key) {
  const pc   = postcode.toLowerCase().replace(' ', '');
  const city = (woonplaats ?? '').toLowerCase().replace(/\s+/g, '-');
  const url  = `https://www.pararius.nl/koopwoningen/${city}/${pc}`;
  const html = await scrape(url, key, false, 8000);
  if (!html) return null;

  const $ = cheerio.load(html);
  let found = null;
  $(`a[href*="${huisnummer}"]`).each((_, el) => {
    if (!found) {
      const href = $(el).attr('href') ?? '';
      if (href.includes('-te-koop') || href.includes('/huis/') || href.includes('/appartement/')) {
        found = href.startsWith('http') ? href : `https://www.pararius.nl${href}`;
      }
    }
  });
  return found;
}

// ── Hoofd-handler ─────────────────────────────────────────────────────────────
export async function POST(request) {
  try {
    const { address } = await request.json();
    if (!address) return Response.json({ error: 'Geen adres opgegeven' }, { status: 400 });

    const key = process.env.SCRAPER_API_KEY;
    if (!key) return Response.json({ error: 'ScraperAPI niet geconfigureerd' }, { status: 500 });

    // Stap 1: PDOK postcode lookup
    const pdok = await pdokLookup(address);

    let listingUrl = null;

    if (pdok?.postcode) {
      // Stap 2: Funda + Pararius parallel zoeken op postcode
      const [funda, pararius] = await Promise.all([
        findOnFunda(pdok.postcode, pdok.huisnummer, key),
        findOnPararius(pdok.postcode, pdok.huisnummer, pdok.woonplaats, key),
      ]);
      listingUrl = funda ?? pararius ?? null;
    }

    // Stap 3: Funda zoekpagina render=true als laatste redmiddel
    if (!listingUrl) {
      const fundaSearch = `https://www.funda.nl/zoeken/koop?selected_area=%5B%22nl%22%5D&query=${encodeURIComponent(address)}`;
      const html = await scrape(fundaSearch, key, true, 13000);
      if (html) {
        const $ = cheerio.load(html);
        $('a[href*="/detail/koop/"]').each((_, el) => {
          if (!listingUrl) {
            const href = $(el).attr('href') ?? '';
            if (href.includes('/detail/koop/')) {
              listingUrl = href.startsWith('http') ? href : `https://www.funda.nl${href}`;
            }
          }
        });
      }
    }

    if (listingUrl) {
      // Listing gevonden — volledige analyse
      const res  = await fetch(new URL('/api/analyze', request.url), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: listingUrl }),
      });
      const data = await res.json();
      return Response.json({ ...data, found_listing: listingUrl });
    }

    // Niet op Funda of Pararius gevonden
    return Response.json({
      error: `"${pdok?.weergavenaam ?? address}" staat niet te koop op Funda of Pararius. Voer een directe URL in als de woning elders staat.`,
      address_not_listed: true,
    }, { status: 404 });

  } catch (e) {
    return Response.json({ error: e.message }, { status: 500 });
  }
}
