import axios from 'axios';
import * as cheerio from 'cheerio';

// Bekende vastgoedplatforms — patroon om te herkennen in zoekresultaten
const PLATFORMS = [
  { name: 'Funda',        re: /https?:\/\/www\.funda\.nl\/detail\/(koop|huur)\/[^\s"'<>]+/i },
  { name: 'Pararius',     re: /https?:\/\/www\.pararius\.nl\/(huis|appartement|woning)-te-(koop|huur)\/[^\s"'<>]+/i },
  { name: 'Jaap',         re: /https?:\/\/www\.jaap\.nl\/[^\s"'<>]+\/[^\s"'<>]+-\d+[^\s"'<>]*/i },
  { name: 'Huislijn',     re: /https?:\/\/www\.huislijn\.nl\/[^\s"'<>]+-te-koop[^\s"'<>]*/i },
  { name: 'Makelaarsland',re: /https?:\/\/www\.makelaarsland\.nl\/aanbod\/[^\s"'<>]+/i },
  { name: 'Vendr',        re: /https?:\/\/www\.vendr\.nl\/[^\s"'<>]+-te-koop[^\s"'<>]*/i },
];

function extractListingFromHtml(html) {
  const $ = cheerio.load(html);
  // Alle hrefs ophalen
  const hrefs = [];
  $('a[href]').each((_, el) => hrefs.push($(el).attr('href') ?? ''));
  // Ook ruwe URL-matches in de HTML-tekst
  for (const { re } of PLATFORMS) {
    const m = html.match(re);
    if (m) return m[0];
  }
  for (const href of hrefs) {
    for (const { re } of PLATFORMS) {
      if (re.test(href)) return href;
    }
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

// ── Hoofd-handler ─────────────────────────────────────────────────────────────
export async function POST(request) {
  try {
    const { address } = await request.json();
    if (!address) return Response.json({ error: 'Geen adres opgegeven' }, { status: 400 });

    const key = process.env.SCRAPER_API_KEY;
    if (!key) return Response.json({ error: 'ScraperAPI niet geconfigureerd' }, { status: 500 });

    let listingUrl = null;

    // ── Stap 1: Google zoeken (render=false — Google heeft geen JS nodig voor resultaten)
    const googleQuery = `"${address}" te koop`;
    const googleUrl   = `https://www.google.nl/search?q=${encodeURIComponent(googleQuery)}&hl=nl&num=10`;
    const googleHtml  = await scrape(googleUrl, key, false, 9000);

    if (googleHtml) {
      listingUrl = extractListingFromHtml(googleHtml);
    }

    // ── Stap 2: Bing als Google niks geeft
    if (!listingUrl) {
      const bingUrl  = `https://www.bing.com/search?q=${encodeURIComponent(googleQuery)}&setlang=nl`;
      const bingHtml = await scrape(bingUrl, key, false, 9000);
      if (bingHtml) listingUrl = extractListingFromHtml(bingHtml);
    }

    // ── Stap 3: Funda zoekpagina direct (render=true als laatste redmiddel)
    if (!listingUrl) {
      const fundaUrl  = `https://www.funda.nl/zoeken/koop?selected_area=%5B%22nl%22%5D&query=${encodeURIComponent(address)}`;
      const fundaHtml = await scrape(fundaUrl, key, true, 14000);
      if (fundaHtml) {
        const $ = cheerio.load(fundaHtml);
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
      const analyzeRes = await fetch(new URL('/api/analyze', request.url), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: listingUrl }),
      });
      const data = await analyzeRes.json();
      return Response.json({ ...data, found_listing: listingUrl });
    }

    return Response.json({
      error: `Geen actieve listing gevonden voor "${address}". Voer een directe URL in als de woning te koop staat.`,
      address_not_listed: true,
    }, { status: 404 });

  } catch (e) {
    return Response.json({ error: e.message }, { status: 500 });
  }
}
