import Anthropic from '@anthropic-ai/sdk';
import axios from 'axios';
import * as cheerio from 'cheerio';

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

function cityToSlug(city) {
  return (city ?? '')
    .toLowerCase()
    .replace(/^'+/, '')
    .replace(/[^a-z0-9\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-');
}

// ── Diepte-zoeker in geneste objecten ─────────────────────────────────────────
function deepFind(obj, keys, depth = 0) {
  if (depth > 14 || !obj || typeof obj !== 'object') return null;
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

// ── Parse één listing-object naar ons formaat ──────────────────────────────
function parseListing(item) {
  const street  = deepFind(item, ['streetName', 'straatnaam', 'street', 'address']);
  const hn      = deepFind(item, ['houseNumber', 'huisnummer', 'houseNr', 'number']);
  const hns     = deepFind(item, ['houseNumberSuffix', 'huisnummertoevoeging', 'addition', 'suffix']);
  const city    = deepFind(item, ['city', 'woonplaatsnaam', 'woonplaats', 'place', 'municipality']);
  const price   = deepFind(item, ['sellingPrice', 'koopprijs', 'price', 'transactionPrice', 'salePrice', 'askingPrice', 'purchasePrice']);
  const sqm     = deepFind(item, ['livingArea', 'usableArea', 'woonoppervlakte', 'floorArea', 'area', 'surfaceArea']);
  const energy  = deepFind(item, ['energyLabel', 'energyClass', 'energieklasse', 'energieLabelKlasse', 'energy']);
  const year    = deepFind(item, ['constructionYear', 'bouwjaar', 'yearBuilt', 'buildYear']);
  const rooms   = deepFind(item, ['numberOfRooms', 'aantalKamers', 'rooms', 'roomCount', 'bedrooms']);
  const txDate  = deepFind(item, ['transactionDate', 'transactiedatum', 'soldDate', 'datumVerkoop', 'dateOfSale', 'saleDate', 'closingDate']);

  const address = street && hn
    ? `${street} ${hn}${hns ? hns : ''}, ${city ?? ''}`.trim().replace(/,$/, '')
    : (typeof street === 'string' && street.includes(' ') ? street : null);

  const energyNorm = typeof energy === 'string'
    ? energy.trim().toUpperCase().replace(/^([A-G]).*/, '$1')
    : null;

  return {
    address,
    price:      typeof price === 'number' ? price : (typeof price === 'string' ? parseInt(price.replace(/\D/g, '')) || null : null),
    sqm:        typeof sqm === 'number' ? sqm : null,
    energy:     energyNorm,
    year_built: typeof year === 'number' ? year : null,
    rooms:      typeof rooms === 'number' ? rooms : null,
    datum:      txDate ?? null,
  };
}

// ── Strategie 1: __NEXT_DATA__ ────────────────────────────────────────────────
function parseNextData(html) {
  try {
    const $ = cheerio.load(html);
    const raw = $('script#__NEXT_DATA__').html();
    if (!raw) return [];
    const json = JSON.parse(raw);

    // Zoek naar elk array met 3+ items die eruitzien als listings
    const candidates = [];
    function findArrays(obj, depth = 0) {
      if (depth > 15 || !obj || typeof obj !== 'object') return;
      if (Array.isArray(obj) && obj.length >= 2) {
        const first = obj[0];
        if (first && typeof first === 'object' && (
          deepFind(first, ['price', 'koopprijs', 'sellingPrice', 'transactionPrice']) ||
          deepFind(first, ['livingArea', 'woonoppervlakte'])
        )) {
          candidates.push(obj);
        }
      }
      for (const val of Object.values(obj)) {
        if (typeof val === 'object') findArrays(val, depth + 1);
      }
    }
    findArrays(json);

    if (!candidates.length) return [];
    // Pak de grootste kandidaat
    const best = candidates.sort((a, b) => b.length - a.length)[0];
    return best.slice(0, 8).map(parseListing).filter(c => c.address && c.price > 0);
  } catch { return []; }
}

// ── Strategie 2: JSON-LD ───────────────────────────────────────────────────────
function parseJsonLd(html) {
  try {
    const $ = cheerio.load(html);
    const results = [];
    $('script[type="application/ld+json"]').each((_, el) => {
      try {
        const data = JSON.parse($(el).html() ?? '');
        const items = data?.itemListElement ?? (Array.isArray(data) ? data : [data]);
        for (const item of items) {
          const listing = parseListing(item?.item ?? item);
          if (listing.address && listing.price > 0) results.push(listing);
        }
      } catch {}
    });
    return results;
  } catch { return []; }
}

// ── Funda ophalen (render=true voor volledige JS) ─────────────────────────────
async function scrapeFundaVerkocht(city) {
  const slug = cityToSlug(city);
  if (!slug) return null;

  const url = `https://www.funda.nl/koop/${slug}/verkocht/`;
  const key = process.env.SCRAPER_API_KEY;
  if (!key) return null;

  try {
    const { data } = await axios.get(
      `http://api.scraperapi.com?api_key=${key}&url=${encodeURIComponent(url)}&render=true&country_code=nl`,
      { timeout: 15000 }
    );
    return data;
  } catch { return null; }
}

// ── AI fallback via Claude Haiku ──────────────────────────────────────────────
async function generateAiComps({ address, price, sqm, energy, year, woonplaats }) {
  try {
    const msg = await client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 600,
      temperature: 0,
      messages: [{
        role: 'user',
        content: `Dutch real estate analyst. Generate 5 realistic recently sold comparable properties near: ${address} (${woonplaats}).
Subject property: ${price}€, ${sqm}m², bouwjaar ${year}, energielabel ${energy}.
Use your knowledge of the Dutch real estate market for this city.

Return ONLY these 5 lines (nothing else):
C1: [street+nr, city] | [price] | [sqm] | [energy A-G] | [rooms] | [YYYY-MM]
C2: [street+nr, city] | [price] | [sqm] | [energy A-G] | [rooms] | [YYYY-MM]
C3: [street+nr, city] | [price] | [sqm] | [energy A-G] | [rooms] | [YYYY-MM]
C4: [street+nr, city] | [price] | [sqm] | [energy A-G] | [rooms] | [YYYY-MM]
C5: [street+nr, city] | [price] | [sqm] | [energy A-G] | [rooms] | [YYYY-MM]`,
      }],
    });

    const lines = msg.content[0].text.trim().split('\n');
    return lines.slice(0, 5).map(line => {
      const m = line.match(/C\d:\s*(.+)/);
      if (!m) return null;
      const parts = m[1].split('|').map(s => s.trim());
      return {
        address:    parts[0] ?? null,
        price:      parseInt((parts[1] ?? '').replace(/\D/g, '')) || null,
        sqm:        parseInt(parts[2]) || null,
        energy:     (parts[3] ?? '').toUpperCase().replace(/^([A-G]).*/, '$1') || null,
        rooms:      parseInt(parts[4]) || null,
        datum:      parts[5] ?? null,
        ai:         true,
      };
    }).filter(c => c?.address && c?.price > 0);
  } catch { return []; }
}

// ── Hoofd-handler ──────────────────────────────────────────────────────────────
export async function POST(request) {
  try {
    const { woonplaats, address, price, sqm, energy, year } = await request.json();

    // Probeer Funda verkocht
    let comps = [];
    let source = 'ai';

    if (woonplaats) {
      const html = await scrapeFundaVerkocht(woonplaats);
      if (html) {
        comps = parseNextData(html);
        if (!comps.length) comps = parseJsonLd(html);
        if (comps.length) source = 'funda';
      }
    }

    // AI fallback als Funda niks geeft
    if (!comps.length) {
      comps = await generateAiComps({ address, price, sqm, energy, year, woonplaats });
      source = 'ai';
    }

    return Response.json({ comps: comps.slice(0, 5), source });
  } catch (e) {
    return Response.json({ comps: [], error: e.message });
  }
}
