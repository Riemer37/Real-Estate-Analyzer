export const maxDuration = 60; // Vercel Pro: verhoog naar 300

import Anthropic from '@anthropic-ai/sdk';
import axios from 'axios';
import * as cheerio from 'cheerio';
import { berekenRenovatiekosten } from '@/lib/reno';
import { berekenRisico }          from '@/lib/risico';
import { berekenWWS }             from '@/lib/wws';
import { pn }                     from '@/lib/utils';

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

// ── Helpers ───────────────────────────────────────────────────────────────────

const pFetch = (url, t = 4000) =>
  fetch(url, { signal: AbortSignal.timeout(t) }).then(r => r.ok ? r.json() : null).catch(() => null);

function cleanAddr(a) {
  let c = a.replace(/\s*[-/]\s*[A-Za-z0-9]+(?:\s*[-/]\s*[A-Za-z0-9]+)*\s*,/g, ',');
  c = c.replace(/(\d+)\s*[-–]\s*[A-Za-z]+/g, '$1');
  c = c.replace(/(\d+)\s*[A-Za-z]{1,2}(?=\s*,|\s*$)/g, '$1');
  return c.trim().replace(/^,+|,+$/g, '').trim();
}

// Adres uit Funda-URL: funda.nl/detail/koop/{city}/{type}-{straat}-{nr}/
function urlToAddress(url) {
  try {
    const m = url.match(/funda\.nl\/detail\/(?:koop|huur)\/([^/]+)\/(?:huis|appartement|woonhuis|studio|kamer|villa|boerderij|bungalow|penthouse|grondgebonden|overig|object)-(.+?)(?:\/|\?|$)/i);
    if (!m) return null;
    return `${m[2].replace(/-/g, ' ').trim()}, ${m[1].replace(/-/g, ' ')}`;
  } catch { return null; }
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

function extractStructured(html) {
  try {
    const $ = cheerio.load(html);
    const raw = $('script#__NEXT_DATA__').html();
    if (!raw) return null;
    const json = JSON.parse(raw);
    const price  = deepFind(json, ['sellingPrice','koopprijs','askingPrice','listPrice','price']);
    const sqm    = deepFind(json, ['livingArea','usableArea','floorArea','oppervlakte','woonoppervlakte']);
    const year   = deepFind(json, ['constructionYear','bouwjaar','yearOfConstruction','yearBuilt']);
    const energy = deepFind(json, ['energyLabel','energyClass','energieklasse','energieLabelKlasse']);
    const rooms  = deepFind(json, ['numberOfRooms','aantalKamers','rooms','roomCount']);
    const street = deepFind(json, ['streetName','straatnaam','street']);
    const hn     = deepFind(json, ['houseNumber','huisnummer','houseNr']);
    const hns    = deepFind(json, ['houseNumberSuffix','huisnummertoevoeging','suffix','addition']);
    const city   = deepFind(json, ['city','woonplaatsnaam','woonplaats','place']);
    const erfp   = deepFind(json, ['groundLease','erfpacht','leasehold','isGroundLease']);
    const address = street && hn ? `${street} ${hn}${hns ?? ''}, ${city ?? ''}`.trim().replace(/,$/, '') : null;
    const energyNorm = typeof energy === 'string' ? energy.trim().toUpperCase().replace(/^([A-G]).*/, '$1') : null;
    let erfpachtNorm = 'Onbekend';
    if (erfp === true  || erfp === 'Ja'  || erfp === 'yes') erfpachtNorm = 'Ja';
    if (erfp === false || erfp === 'Nee' || erfp === 'no')  erfpachtNorm = 'Nee';
    const result = {
      price:    typeof price === 'number' ? price : null,
      sqm:      typeof sqm   === 'number' ? sqm   : null,
      year:     typeof year  === 'number' ? year  : null,
      energy:   energyNorm,
      rooms:    typeof rooms === 'number' ? rooms : null,
      address,
      erfpacht: erfpachtNorm,
    };
    return (result.price || result.address) ? result : null;
  } catch { return null; }
}

function extractText(html) {
  const $ = cheerio.load(html);
  $('script, style, nav, footer, header, iframe').remove();
  return $.text().split('\n').map(l => l.trim()).filter(l => l.length > 2).join('\n').slice(0, 5000);
}

// ── Pagina ophalen: direct eerst, ScraperAPI als fallback ─────────────────────
async function fetchPage(url) {
  let html = null;

  // Poging 1: direct (3s) — snel, maar Funda blokkeert dit vaak
  try {
    const { data } = await axios.get(url, {
      timeout: 3000,
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)',
        'Accept': 'text/html,application/xhtml+xml',
        'Accept-Language': 'nl-NL,nl;q=0.9',
      },
    });
    html = data;
  } catch { /* valt terug op ScraperAPI */ }

  // Check of we bruikbare __NEXT_DATA__ hebben
  const earlyStructured = html ? extractStructured(html) : null;

  // Poging 2: ScraperAPI render=false (6s) — als direct geen structured data gaf
  if (!earlyStructured) {
    const key = process.env.SCRAPER_API_KEY;
    if (key) {
      try {
        const { data } = await axios.get(
          `http://api.scraperapi.com?api_key=${key}&url=${encodeURIComponent(url)}&render=false&country_code=nl`,
          { timeout: 6000 }
        );
        html = data;
      } catch { /* ScraperAPI ook mislukt */ }
    }
  }

  const structured = html ? extractStructured(html) : null;
  const text       = html ? extractText(html) : '';
  return { structured, text };
}

// ── Kadaster: Locatieserver + parallel PDOK calls ─────────────────────────────
async function lookupKadasterFast(address) {
  const res = { found: false };

  // Stap 1: Locatieserver (sequentieel — nodig voor de rest)
  let doc = null;
  for (const variant of [cleanAddr(address), address]) {
    const data = await pFetch(
      `https://api.pdok.nl/bzk/locatieserver/search/v3_1/free?q=${encodeURIComponent(variant)}&rows=5&fl=id,weergavenaam,type,centroide_ll,adresseerbaarobject_id,nummeraanduiding_id,bouwjaar,oppervlakte_obj,gebruiksdoel,status,straatnaam,huisnummer,postcode,woonplaatsnaam,gemeentenaam,gemeentecode,buurtnaam,wijknaam,provincienaam`,
      5000
    );
    const docs = data?.response?.docs ?? [];
    doc = docs.find(d => d.type === 'adres') ?? docs[0] ?? null;
    if (doc) break;
  }
  if (!doc) return res;

  res.found            = true;
  res.official_address = doc.weergavenaam;
  res.official_year    = doc.bouwjaar    ?? null;
  res.official_sqm     = doc.oppervlakte_obj ?? null;
  res.bag_id           = doc.adresseerbaarobject_id ?? doc.id;
  res.nummeraanduiding_id = doc.nummeraanduiding_id ?? null;
  res.postcode         = doc.postcode    ?? null;
  res.straatnaam       = doc.straatnaam  ?? null;
  res.huisnummer       = doc.huisnummer  ?? null;
  res.woonplaats       = doc.woonplaatsnaam ?? null;
  res.gemeentenaam     = doc.gemeentenaam ?? null;
  res.gemeentecode     = doc.gemeentecode ?? null;
  res.buurtnaam        = doc.buurtnaam   ?? null;
  res.wijknaam         = doc.wijknaam    ?? null;
  res.provincienaam    = doc.provincienaam ?? null;
  const usage          = doc.gebruiksdoel ?? '';
  res.usage            = Array.isArray(usage) ? usage.join(', ') : (usage || '—');
  res.status           = doc.status ?? '—';

  const centroid = doc.centroide_ll ?? '';
  if (centroid) {
    const parts = centroid.replace('POINT(', '').replace(')', '').split(' ');
    if (parts.length === 2) {
      res.lon = parseFloat(parts[0]);
      res.lat = parseFloat(parts[1]);
      res.bag_viewer_url = `https://bagviewer.kadaster.nl/?zoomlevel=5&center=${res.lon},${res.lat}`;
    }
  }

  // Stap 2: alle resterende calls PARALLEL (elk max 4s)
  const bagId = res.bag_id ? res.bag_id.replace(/\D/g, '').padStart(16, '0') : null;
  const epKey = process.env.EP_ONLINE_API_KEY;

  const [bagVbo, wozData, epData, koopData] = await Promise.all([
    bagId ? pFetch(
      `https://service.pdok.nl/lv/bag/wfs/v2_0?service=WFS&version=2.0.0&request=GetFeature&typeName=bag:verblijfsobject&outputFormat=application/json&count=1&filter=` +
      encodeURIComponent(`<Filter><PropertyIsEqualTo><PropertyName>identificatie</PropertyName><Literal>${bagId}</Literal></PropertyIsEqualTo></Filter>`)
    ) : Promise.resolve(null),

    res.nummeraanduiding_id ? pFetch(
      `https://api.kadaster.nl/lvwoz/wozwaardeloket-api/v1/wozwaarde/nummeraanduiding/${res.nummeraanduiding_id}`
    ) : Promise.resolve(null),

    epKey && res.postcode && res.huisnummer ? fetch(
      `https://public.ep-online.nl/api/v5/PandEnergielabel/Adres?postcode=${res.postcode.replace(' ', '')}&huisnummer=${res.huisnummer}`,
      { headers: { Authorization: `Bearer ${epKey}` }, signal: AbortSignal.timeout(4000) }
    ).then(r => r.ok ? r.json() : null).catch(() => null) : Promise.resolve(null),

    res.lat && res.lon ? (() => {
      const d = 0.003;
      const bbox  = `${res.lon - d},${res.lat - d},${res.lon + d},${res.lat + d}`;
      const since = new Date(Date.now() - 3 * 365.25 * 24 * 3600 * 1000).toISOString().slice(0, 10);
      return pFetch(`https://api.pdok.nl/kadaster/koopsommen/ogc/v1/collections/koopsommen/items?bbox=${bbox}&datetime=${since}/..&limit=20&sortby=-transactiedatum`);
    })() : Promise.resolve(null),
  ]);

  // BAG VBO
  if (bagVbo?.features?.[0]?.properties) {
    const f = bagVbo.features[0].properties;
    res.official_sqm = f.oppervlakte ?? res.official_sqm;
    res.status       = f.status ?? res.status;
    const gd         = f.gebruiksdoel ?? '';
    res.usage        = Array.isArray(gd) ? gd.join(', ') : (gd || res.usage);
    const pandRef    = f.pandidentificatie;
    res.pand_id      = Array.isArray(pandRef) ? pandRef[0] : (pandRef ?? null);
  }

  // VBO-telling
  if (res.pand_id) {
    const pandId = res.pand_id.replace(/\D/g, '').padStart(16, '0').slice(0, 16);
    const vboData = await pFetch(
      `https://service.pdok.nl/lv/bag/wfs/v2_0?service=WFS&version=2.0.0&request=GetFeature&typeName=bag:verblijfsobject&outputFormat=application/json&count=20&filter=` +
      encodeURIComponent(`<Filter><PropertyIsEqualTo><PropertyName>pandidentificatie</PropertyName><Literal>${pandId}</Literal></PropertyIsEqualTo></Filter>`)
    );
    if (vboData?.features) {
      const actief = vboData.features.filter(f => {
        const s = (f.properties?.status ?? '').toLowerCase();
        return !s.includes('ingetrokken') && !s.includes('niet') && !s.includes('gesloopt');
      });
      const lijst = actief.length > 0 ? actief : vboData.features;
      res.vbo_count = lijst.length || null;
      res.is_split  = lijst.length > 1;
      if (lijst.length > 1) {
        res.vbo_eenheden = lijst
          .map(f => ({ oppervlakte: f.properties?.oppervlakte ?? null, gebruiksdoel: Array.isArray(f.properties?.gebruiksdoel) ? f.properties.gebruiksdoel.join(', ') : (f.properties?.gebruiksdoel ?? '—'), status: f.properties?.status ?? '—' }))
          .filter(e => e.oppervlakte)
          .sort((a, b) => (b.oppervlakte ?? 0) - (a.oppervlakte ?? 0));
      }
    }
  }

  // WOZ
  if (wozData?.wozWaarden?.length > 0) {
    res.woz_waarden = wozData.wozWaarden
      .sort((a, b) => b.peildatum.localeCompare(a.peildatum))
      .slice(0, 5)
      .map(w => ({ jaar: w.peildatum.slice(0, 4), waarde: w.vastgesteldeWaarde }));
    res.woz_huidig = res.woz_waarden[0]?.waarde ?? null;
    res.woz_jaar   = res.woz_waarden[0]?.jaar ?? null;
  }

  // EP-online
  if (epData) {
    const label = Array.isArray(epData) ? epData[0] : epData;
    if (label?.Energieklasse) {
      res.energy_label       = label.Energieklasse;
      res.energy_label_datum = label.Registratiedatum ?? null;
    }
  }

  // Koopsommen
  if (koopData?.features?.length > 0) {
    res.koopsommen = koopData.features.map(f => ({
      prijs: f.properties?.koopsom ?? null,
      datum: f.properties?.transactiedatum ?? null,
      opp:   f.properties?.perceeloppervlakte ?? null,
    })).filter(k => k.prijs);
    if (res.koopsommen.length > 0) {
      res.laatste_koopsom       = res.koopsommen[0].prijs;
      res.laatste_koopsom_datum = res.koopsommen[0].datum;
    }
  }

  return res;
}

// ── Hoofd-handler ─────────────────────────────────────────────────────────────
export async function POST(request) {
  try {
    const { url, manualPrice } = await request.json();

    // Adres uit URL halen voor vroege Kadaster-start (Funda-URLs bevatten het adres)
    const quickAddress = urlToAddress(url);

    // ── PARALLEL FASE 1: pagina ophalen + Kadaster (als adres bekend uit URL) ──
    const [pageResult, earlyKad] = await Promise.all([
      fetchPage(url),
      quickAddress ? lookupKadasterFast(quickAddress) : Promise.resolve(null),
    ]);

    const { structured, text } = pageResult;

    // Beste adres: structured data wint van URL-parse
    const bestAddress = structured?.address || quickAddress;

    // ── PARALLEL FASE 2: AI analyse + Kadaster verfijnen (indien nodig) ────────
    const knownFacts = (structured || manualPrice) ? [
      (manualPrice || structured?.price) ? `KNOWN_PRICE: ${manualPrice || structured.price}` : null,
      structured.sqm     ? `KNOWN_SQM: ${structured.sqm}`       : null,
      structured.year    ? `KNOWN_YEAR: ${structured.year}`      : null,
      structured.energy  ? `KNOWN_ENERGY: ${structured.energy}`  : null,
      structured.rooms   ? `KNOWN_ROOMS: ${structured.rooms}`    : null,
      structured.address ? `KNOWN_ADDRESS: ${structured.address}` : null,
    ].filter(Boolean).join('\n') : '';

    const [aiMsg, kad] = await Promise.all([
      // AI: Haiku — snel (2-4s), temperature:0 voor consistentie
      client.messages.create({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 900,
        temperature: 0,
        messages: [{
          role: 'user',
          content: `Dutch real estate investment analyst.
${knownFacts ? `KNOWN DATA (use directly):\n${knownFacts}\n` : ''}PAGE: ${text || '(geen pagina beschikbaar)'}

Return ONLY these keys, one per line:
ADDRESS: [use KNOWN_ADDRESS or extract from page]
PRICE: [digits only — use KNOWN_PRICE]
SQM: [digits only — use KNOWN_SQM]
YEAR: [digits only — use KNOWN_YEAR]
ENERGY: [A-G — use KNOWN_ENERGY]
CONDITION: [Excellent/Good/Fair/Poor]
PROPERTY_TYPE: [Apartment/House/Townhouse/Commercial]
ROOMS: [digits — use KNOWN_ROOMS]
ERFPACHT: [Ja/Nee/Onbekend]
ERFPACHT_CANON: [digits, 0 if unknown]
COMP1_ADDRESS: [nearby sold] COMP1_PRICE: [digits] COMP1_SQM: [digits] COMP1_YEAR: [year]
COMP2_ADDRESS: [nearby sold] COMP2_PRICE: [digits] COMP2_SQM: [digits] COMP2_YEAR: [year]
COMP3_ADDRESS: [nearby sold] COMP3_PRICE: [digits] COMP3_SQM: [digits] COMP3_YEAR: [year]
HEALTHY_MARGIN: [digits]
INVESTMENT_SCORE: [1-10]
SUMMARY: [2 sentences]
ADVICE: [3 sentences — buy/pass, bid, opportunity]
FULL_ANALYSIS: [5 sentences — acquisition, renovation, exit, risks, verdict]`,
        }],
      }),

      // Kadaster: hergebruik earlyKad als die al het juiste adres had,
      // anders opnieuw met het beste adres
      earlyKad?.found
        ? Promise.resolve(earlyKad)
        : (bestAddress ? lookupKadasterFast(bestAddress) : Promise.resolve({ found: false })),
    ]);

    // AI output parsen
    const d = {};
    for (const line of aiMsg.content[0].text.trim().split('\n')) {
      if (line.includes(':')) {
        const [k, ...rest] = line.split(':');
        d[k.trim()] = rest.join(':').trim();
      }
    }

    // ── Data samenvoegen ──────────────────────────────────────────────────────
    const price         = manualPrice || structured?.price || pn(d.PRICE, 0);
    const sqm_ai        = structured?.sqm     ?? pn(d.SQM, 85);
    const year_ai       = structured?.year    ?? pn(d.YEAR, 1970);
    const energy_raw    = ((kad.energy_label ?? structured?.energy ?? d.ENERGY ?? 'C')).trim().toUpperCase().slice(0, 2);
    const rooms         = structured?.rooms   ?? pn(d.ROOMS, 4);
    const address       = kad.official_address ?? structured?.address ?? d.ADDRESS ?? bestAddress ?? 'Onbekend';
    const condition     = d.CONDITION     ?? 'Fair';
    const property_type = d.PROPERTY_TYPE ?? 'House';
    const erfpacht      = structured?.erfpacht !== 'Onbekend' ? (structured?.erfpacht ?? d.ERFPACHT ?? 'Onbekend') : (d.ERFPACHT ?? 'Onbekend');

    // BAG wint altijd voor sqm en year
    const sqm  = kad.official_sqm  ?? sqm_ai;
    const year = kad.official_year ?? year_ai;

    // Marktwaarde: koopsommen mediaan → WOZ → AI
    let fair_value = 0, waarde_methode = 'AI-schatting';
    if (kad.koopsommen?.length >= 2 && sqm > 0) {
      const ppms = kad.koopsommen.filter(k => k.opp && k.opp > 20).map(k => k.prijs / k.opp);
      if (ppms.length >= 2) {
        ppms.sort((a, b) => a - b);
        const med = ppms[Math.floor(ppms.length / 2)];
        fair_value   = Math.round(med * sqm);
        waarde_methode = 'Kadaster koopsommen';
      }
    }
    if (!fair_value && kad.woz_huidig) { fair_value = kad.woz_huidig; waarde_methode = 'WOZ-waarde'; }
    if (!fair_value) { fair_value = price; waarde_methode = 'Vraagprijs (fallback)'; }

    // Renovatiekosten (feitentabel)
    const { kosten: reno_cost, items: reno_items } = berekenRenovatiekosten({ sqm, condition, year, property_type, energy: energy_raw });

    // Huurwaarde (WOZ×5%/12, gecapt door WWS)
    const wws = berekenWWS({ sqm, energy: energy_raw, woz_huidig: kad.woz_huidig ?? 0 });
    const woz_huur = kad.woz_huidig ? Math.round(kad.woz_huidig * 0.05 / 12) : Math.round(fair_value * 0.05 / 12);
    const monthly_rent = wws.max_huur ? Math.min(woz_huur, wws.max_huur) : woz_huur;
    const huur_methode = wws.max_huur ? 'WOZ-yield 5% (WWS gecapped)' : 'WOZ-yield 5%';

    // Risicoscore (objectief)
    const risico = berekenRisico({ price, fair_value, woz_huidig: kad.woz_huidig ?? 0, year, energy: energy_raw, condition, property_type, sqm, erfpacht });

    return Response.json({
      url, address, price, sqm, year,
      energy:          energy_raw,
      condition,
      property_type,
      rooms,
      reno_cost,
      reno_items,
      fair_value,
      waarde_methode,
      monthly_rent,
      huur_methode,
      wws_categorie:   wws.categorie,
      wws_punten:      wws.totaal,
      risk_score:      risico.risk_score,
      risk_location:   risico.risk_location,
      risk_condition:  risico.risk_condition,
      risk_market:     risico.risk_market,
      risk_liquidity:  risico.risk_liquidity,
      risk_notes:      risico.risk_notes_factual ?? '',
      comps: [1,2,3].map(i => ({
        address: d[`COMP${i}_ADDRESS`] ?? '—',
        price:   pn(d[`COMP${i}_PRICE`], 0),
        sqm:     pn(d[`COMP${i}_SQM`], 1),
        year:    d[`COMP${i}_YEAR`] ?? '—',
      })),
      healthy_margin:   pn(d.HEALTHY_MARGIN, 15),
      erfpacht,
      erfpacht_canon:   pn(d.ERFPACHT_CANON, 0),
      investment_score: pn(d.INVESTMENT_SCORE, 5),
      summary:          d.SUMMARY       ?? '',
      advice:           d.ADVICE        ?? '',
      full_analysis:    d.FULL_ANALYSIS ?? '',
      kadaster:         kad,
      potentieel:       null,
      structured_source: structured ? 'funda_next_data' : (quickAddress ? 'url_parse' : 'ai_only'),
      saved_at: new Date().toLocaleDateString('nl-NL', { day: '2-digit', month: 'short', year: 'numeric' }),
    });
  } catch (e) {
    return Response.json({ error: e.message }, { status: 500 });
  }
}
