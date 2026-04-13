import axios from 'axios';
import * as cheerio from 'cheerio';

// ── Adres ontleden ─────────────────────────────────────────────────────────────
function parseAddress(address) {
  const m = address.trim().match(/^(.+?)\s+(\d+[a-zA-Z]?(?:-\d+)?)\s*,?\s+(.+)$/);
  if (!m) return null;
  return { street: m[1].trim(), number: m[2].trim(), city: m[3].trim() };
}

function toSlug(s) {
  return (s ?? '')
    .toLowerCase()
    .replace(/[àáâãä]/g, 'a').replace(/ç/g, 'c').replace(/[èéêë]/g, 'e')
    .replace(/[ìíîï]/g, 'i').replace(/[òóôõö]/g, 'o').replace(/[ùúûü]/g, 'u')
    .replace(/[^a-z0-9\s-]/g, '').trim().replace(/\s+/g, '-');
}

// ── Funda __NEXT_DATA__ checken op geldige listing ────────────────────────────
function deepFind(obj, keys, depth = 0) {
  if (depth > 12 || !obj || typeof obj !== 'object') return null;
  for (const k of keys) if (obj[k] != null && obj[k] !== '') return obj[k];
  for (const v of Object.values(obj)) {
    const f = deepFind(v, keys, depth + 1);
    if (f != null) return f;
  }
  return null;
}

function hasValidListing(html) {
  try {
    const raw = cheerio.load(html)('script#__NEXT_DATA__').html();
    if (!raw) return false;
    const json = JSON.parse(raw);
    const price = deepFind(json, ['sellingPrice', 'koopprijs', 'askingPrice', 'price']);
    return typeof price === 'number' && price > 0;
  } catch { return false; }
}

// ── Één URL ophalen via ScraperAPI (render=false, snel) ───────────────────────
async function tryUrl(url, key) {
  try {
    const { data } = await axios.get(
      `http://api.scraperapi.com?api_key=${key}&url=${encodeURIComponent(url)}&render=false&country_code=nl`,
      { timeout: 7000 }
    );
    return hasValidListing(data) ? url : null;
  } catch { return null; }
}

// ── Kandidaat-URLs bouwen voor Funda en Pararius ───────────────────────────────
function buildCandidateUrls(street, number, city) {
  const s = toSlug(street);
  const c = toSlug(city);
  const n = number.toLowerCase();

  const fundaTypes = ['huis', 'appartement', 'woonhuis', 'studio', 'kamer', 'villa'];
  const funda = fundaTypes.map(t => `https://www.funda.nl/detail/koop/${c}/${t}-${s}-${n}/`);

  const pararius = [
    `https://www.pararius.nl/huis-te-koop/${c}/${s}-${n}`,
    `https://www.pararius.nl/appartement-te-koop/${c}/${s}-${n}`,
  ];

  return [...funda, ...pararius];
}

// ── Funda zoekpagina als fallback (render=true) ────────────────────────────────
async function searchFundaPage(address, key) {
  const query = encodeURIComponent(address);
  const url = `https://www.funda.nl/zoeken/koop?selected_area=%5B%22nl%22%5D&query=${query}`;
  try {
    const { data: html } = await axios.get(
      `http://api.scraperapi.com?api_key=${key}&url=${encodeURIComponent(url)}&render=true&country_code=nl`,
      { timeout: 12000 }
    );
    // Zoek links naar detail-pagina's
    const $ = cheerio.load(html);
    let found = null;
    $('a[href*="/detail/koop/"]').each((_, el) => {
      if (!found) {
        const href = $(el).attr('href') ?? '';
        if (href.includes('/detail/koop/')) {
          found = href.startsWith('http') ? href : `https://www.funda.nl${href}`;
        }
      }
    });
    return found;
  } catch { return null; }
}

// ── Hoofd-handler ─────────────────────────────────────────────────────────────
export async function POST(request) {
  try {
    const { address } = await request.json();
    if (!address) return Response.json({ error: 'Geen adres opgegeven' }, { status: 400 });

    const key = process.env.SCRAPER_API_KEY;
    if (!key) return Response.json({ error: 'ScraperAPI niet geconfigureerd' }, { status: 500 });

    const parsed = parseAddress(address);
    let listingUrl = null;

    if (parsed) {
      // Stap 1: alle kandidaat-URLs parallel proberen (render=false, snel)
      const candidates = buildCandidateUrls(parsed.street, parsed.number, parsed.city);
      const results = await Promise.all(candidates.map(u => tryUrl(u, key)));
      listingUrl = results.find(r => r != null) ?? null;
    }

    // Stap 2: fallback — Funda zoekpagina met render=true
    if (!listingUrl) {
      listingUrl = await searchFundaPage(address, key);
    }

    if (listingUrl) {
      // Gevonden — volledige analyse uitvoeren
      const analyzeRes = await fetch(new URL('/api/analyze', request.url), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: listingUrl }),
      });
      const data = await analyzeRes.json();
      return Response.json({ ...data, found_listing: listingUrl });
    }

    return Response.json({
      error: `Geen actieve listing gevonden voor "${address}" op Funda of Pararius. Voer een directe URL in als de woning wel te koop staat.`,
      address_not_listed: true,
    }, { status: 404 });

  } catch (e) {
    return Response.json({ error: e.message }, { status: 500 });
  }
}
