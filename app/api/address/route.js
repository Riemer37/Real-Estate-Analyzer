import axios from 'axios';
import * as cheerio from 'cheerio';

// Bekende Nederlandse vastgoedplatforms — URL-patronen die wijzen op een actieve listing
const LISTING_PATTERNS = [
  { re: /funda\.nl\/detail\/(koop|huur)\/[^"'\s]+/,        base: 'https://www.funda.nl' },
  { re: /pararius\.nl\/(huis|appartement|woning)-te-(koop|huur)\/[^"'\s]+/, base: 'https://www.pararius.nl' },
  { re: /jaap\.nl\/[a-z]+-[a-z]+-[\w-]+\/\d+/,             base: 'https://www.jaap.nl' },
  { re: /huislijn\.nl\/[^"'\s]+\/te-koop[^"'\s]*/,          base: 'https://www.huislijn.nl' },
  { re: /makelaarsland\.nl\/aanbod\/[^"'\s]+/,              base: 'https://www.makelaarsland.nl' },
  { re: /vendr\.nl\/[^"'\s]+-te-koop-[^"'\s]+/,            base: 'https://www.vendr.nl' },
];

function extractListingUrl(html) {
  // Zoek in de ruwe HTML naar bekende URL-patronen
  for (const { re, base } of LISTING_PATTERNS) {
    const m = html.match(re);
    if (m) {
      const raw = m[0].replace(/['">\s].*/,'');
      return raw.startsWith('http') ? raw : `${base}/${raw.replace(/^\//, '')}`;
    }
  }

  // Fallback: alle <a href> links langs gaan
  const $ = cheerio.load(html);
  let found = null;
  $('a[href]').each((_, el) => {
    if (found) return;
    const href = $(el).attr('href') ?? '';
    for (const { re, base } of LISTING_PATTERNS) {
      if (re.test(href)) {
        found = href.startsWith('http') ? href : `${base}${href}`;
        return;
      }
    }
  });
  return found;
}

// DuckDuckGo HTML zoeken — geen JavaScript nodig, pikt alle platforms op
async function searchListingOnline(address) {
  const key = process.env.SCRAPER_API_KEY;
  if (!key) return null;

  // Zoek op adres + "te koop" — DuckDuckGo HTML geeft resultaten van alle sites
  const query = `"${address}" te koop`;
  const searchUrl = `https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}&kl=nl-nl`;

  try {
    const { data: html } = await axios.get(
      `http://api.scraperapi.com?api_key=${key}&url=${encodeURIComponent(searchUrl)}&render=false&country_code=nl`,
      { timeout: 8000 }
    );

    // Zoek eerst in DuckDuckGo resultaat-URLs
    const $ = cheerio.load(html);
    let found = null;

    // DuckDuckGo stopt de echte URL in data-href of href van .result__url / .result__a
    $('a.result__a, a[data-href], .result__url').each((_, el) => {
      if (found) return;
      const href = $(el).attr('href') ?? $(el).attr('data-href') ?? $(el).text() ?? '';
      for (const { re, base } of LISTING_PATTERNS) {
        if (re.test(href)) {
          const m = href.match(re);
          if (m) {
            found = href.startsWith('http') ? href.match(/https?:\/\/[^\s"'>]+/)?.[0] : `${base}/${m[0]}`;
            return;
          }
        }
      }
    });
    if (found) return found;

    // Fallback: zoek in de volledige HTML-tekst
    return extractListingUrl(html);
  } catch { return null; }
}

// ── Hoofd-handler ──────────────────────────────────────────────────────────────
export async function POST(request) {
  try {
    const { address } = await request.json();
    if (!address) return Response.json({ error: 'Geen adres opgegeven' }, { status: 400 });

    // Zoek op alle vastgoedplatforms via DuckDuckGo
    const listingUrl = await searchListingOnline(address);

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
      error: `Geen actieve listing gevonden voor "${address}" op Funda, Pararius, Jaap of andere platforms. Voer een directe URL in als de woning wel te koop staat.`,
      address_not_listed: true,
    }, { status: 404 });

  } catch (e) {
    return Response.json({ error: e.message }, { status: 500 });
  }
}
