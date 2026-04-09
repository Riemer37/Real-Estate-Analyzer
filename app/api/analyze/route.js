export const maxDuration = 300; // Vercel Pro: max 300s — analyse doet veel API-calls

import Anthropic from '@anthropic-ai/sdk';
import axios from 'axios';
import * as cheerio from 'cheerio';
import { lookupKadaster, lookupVboOppervlakte } from '@/lib/kadaster';
import { berekenRenovatiekosten } from '@/lib/reno';
import { berekenRisico } from '@/lib/risico';
import { berekenWWS } from '@/lib/wws';
import { pn } from '@/lib/utils';

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

// ── Funda __NEXT_DATA__ extractor ─────────────────────────────────────────────
// Zoekt recursief naar bekende sleutels in de Next.js JSON payload
function deepFind(obj, keys, depth = 0) {
  if (depth > 12 || obj === null || typeof obj !== 'object') return null;
  for (const key of keys) {
    if (obj[key] !== undefined && obj[key] !== null && obj[key] !== '') return obj[key];
  }
  for (const val of Object.values(obj)) {
    if (typeof val === 'object') {
      const found = deepFind(val, keys, depth + 1);
      if (found !== null) return found;
    }
  }
  return null;
}

function extractFundaStructured(html) {
  try {
    const $ = cheerio.load(html);
    const raw = $('script#__NEXT_DATA__').html();
    if (!raw) return null;
    const json = JSON.parse(raw);

    const price = deepFind(json, ['sellingPrice', 'koopprijs', 'askingPrice', 'listPrice', 'price']);
    const sqm   = deepFind(json, ['livingArea', 'usableArea', 'floorArea', 'oppervlakte', 'woonoppervlakte']);
    const year  = deepFind(json, ['constructionYear', 'bouwjaar', 'yearOfConstruction', 'yearBuilt']);
    const energy = deepFind(json, ['energyLabel', 'energyClass', 'energieklasse', 'energieLabelKlasse']);
    const rooms  = deepFind(json, ['numberOfRooms', 'aantalKamers', 'rooms', 'roomCount']);
    const street = deepFind(json, ['streetName', 'straatnaam', 'street']);
    const hn     = deepFind(json, ['houseNumber', 'huisnummer', 'houseNr']);
    const hns    = deepFind(json, ['houseNumberSuffix', 'huisnummertoevoeging', 'suffix', 'addition']);
    const city   = deepFind(json, ['city', 'woonplaatsnaam', 'woonplaats', 'place']);
    const erfp   = deepFind(json, ['groundLease', 'erfpacht', 'leasehold', 'isGroundLease']);

    const addressStr = street && hn
      ? `${street} ${hn}${hns ? hns : ''}, ${city ?? ''}`.trim().replace(/,$/, '')
      : null;

    // Normaliseer energielabel naar single letter
    const energyNorm = typeof energy === 'string'
      ? energy.trim().toUpperCase().replace(/^([A-G]).*/, '$1')
      : null;

    // Normaliseer erfpacht
    let erfpachtNorm = 'Onbekend';
    if (erfp === true || erfp === 'Ja' || erfp === 'yes' || erfp === 'true') erfpachtNorm = 'Ja';
    if (erfp === false || erfp === 'Nee' || erfp === 'no' || erfp === 'false') erfpachtNorm = 'Nee';

    const result = {
      price:    typeof price === 'number' ? price : null,
      sqm:      typeof sqm   === 'number' ? sqm   : null,
      year:     typeof year  === 'number' ? year  : null,
      energy:   energyNorm,
      rooms:    typeof rooms === 'number' ? rooms : null,
      address:  addressStr,
      erfpacht: erfpachtNorm,
    };

    // Alleen teruggeven als we minimaal prijs OF adres hebben
    const hasData = result.price || result.address;
    return hasData ? result : null;
  } catch {
    return null;
  }
}

async function fetchPage(url) {
  try {
    const scraperUrl = `http://api.scraperapi.com?api_key=${process.env.SCRAPER_API_KEY}&url=${encodeURIComponent(url)}`;
    const { data } = await axios.get(scraperUrl, { timeout: 60000 });

    // Probeer eerst gestructureerde data uit __NEXT_DATA__
    const structured = extractFundaStructured(data);

    const $ = cheerio.load(data);
    $('script, style, nav, footer, header, iframe').remove();
    const text = $.text().split('\n').map(l => l.trim()).filter(l => l.length > 2).join('\n');
    return { text: text.slice(0, 6000), structured };
  } catch (e) {
    return { text: `Error: ${e.message}`, structured: null };
  }
}

export async function POST(request) {
  try {
    const { url } = await request.json();
    const { text: page, structured } = await fetchPage(url);

    // Hintregels voor Claude: al bekende feiten niet opnieuw laten raden
    const knownFacts = structured ? [
      structured.price   ? `KNOWN_PRICE: ${structured.price}`   : null,
      structured.sqm     ? `KNOWN_SQM: ${structured.sqm}`       : null,
      structured.year    ? `KNOWN_YEAR: ${structured.year}`      : null,
      structured.energy  ? `KNOWN_ENERGY: ${structured.energy}`  : null,
      structured.rooms   ? `KNOWN_ROOMS: ${structured.rooms}`    : null,
      structured.address ? `KNOWN_ADDRESS: ${structured.address}` : null,
    ].filter(Boolean).join('\n') : '';

    const msg = await client.messages.create({
      model: 'claude-opus-4-6',
      max_tokens: 2500,
      temperature: 0,
      messages: [{
        role: 'user',
        content: `You are a senior Dutch real estate investment analyst.
URL: ${url}
${knownFacts ? `STRUCTURED DATA (use these values directly — do not override):\n${knownFacts}\n` : ''}PAGE: ${page}

Return ONLY these keys, one per line, no extra text:
ADDRESS: [street housenumber, city — use KNOWN_ADDRESS if provided]
PRICE: [digits only — use KNOWN_PRICE if provided]
SQM: [digits only — use KNOWN_SQM if provided]
YEAR: [digits only — use KNOWN_YEAR if provided]
ENERGY: [A/B/C/D/E/F/G — use KNOWN_ENERGY if provided]
CONDITION: [Excellent/Good/Fair/Poor — based on listing description]
PROPERTY_TYPE: [Apartment/House/Townhouse/Commercial]
ROOMS: [digits only — use KNOWN_ROOMS if provided]
ERFPACHT: [Ja/Nee/Onbekend]
ERFPACHT_CANON: [jaarlijkse canon in digits only, 0 if unknown]
COMP1_ADDRESS: [nearby sold comparable] COMP1_PRICE: [digits] COMP1_SQM: [digits] COMP1_YEAR: [year]
COMP2_ADDRESS: [nearby sold comparable] COMP2_PRICE: [digits] COMP2_SQM: [digits] COMP2_YEAR: [year]
COMP3_ADDRESS: [nearby sold comparable] COMP3_PRICE: [digits] COMP3_SQM: [digits] COMP3_YEAR: [year]
COMP4_ADDRESS: [nearby sold comparable] COMP4_PRICE: [digits] COMP4_SQM: [digits] COMP4_YEAR: [year]
HEALTHY_MARGIN: [recommended profit margin % as digits only]
INVESTMENT_SCORE: [1-10]
SUMMARY: [2 sentences describing the property and its investment potential]
ADVICE: [3 sentences — buy/pass recommendation, suggested bid price, key opportunity]
FULL_ANALYSIS: [5 sentences covering acquisition strategy, renovation scope, exit options, key risks, overall verdict]`
      }]
    });

    const raw = msg.content[0].text;
    const d = {};
    for (const line of raw.trim().split('\n')) {
      if (line.includes(':')) {
        const [k, ...rest] = line.split(':');
        d[k.trim()] = rest.join(':').trim();
      }
    }

    // Feiten: gestructureerde data wint altijd van AI-parsing
    const price        = structured?.price   ?? pn(d.PRICE, 250000);
    const address      = structured?.address ?? d.ADDRESS ?? 'Unknown';
    const energy_raw   = (structured?.energy  ?? d.ENERGY ?? 'C').trim().toUpperCase().slice(0, 1);
    const rooms        = structured?.rooms    ?? pn(d.ROOMS, 4);
    const year_ai      = structured?.year     ?? pn(d.YEAR, 1970);
    const sqm_ai       = structured?.sqm      ?? pn(d.SQM, 85);
    const condition    = d.CONDITION     ?? 'Fair';
    const property_type = d.PROPERTY_TYPE ?? 'House';
    const erfpacht     = structured?.erfpacht !== 'Onbekend' ? (structured?.erfpacht ?? d.ERFPACHT ?? 'Onbekend') : (d.ERFPACHT ?? 'Onbekend');

    // Kadaster + potentieel parallel ophalen
    const [kad, potentieel] = await Promise.all([
      lookupKadaster(address),
      (async () => {
        try {
          const potMsg = await client.messages.create({
            model: 'claude-haiku-4-5-20251001',
            max_tokens: 1200,
            temperature: 0,
            messages: [{
              role: 'user',
              content: `Je bent een Nederlandse vastgoedadviseur gespecialiseerd in transformatiepotentieel en gemeentelijk vergunningenbeleid.

Pand: ${address}
Gemeente: ${d.ADDRESS?.split(',').pop()?.trim() ?? 'onbekend'}
Bouwjaar: ${year_ai}
Oppervlakte: ${sqm_ai} m²
Type: ${property_type}
Staat: ${condition}

Analyseer de transformatiemogelijkheden. Geef per categorie een score 0–10 en 2 zinnen toelichting.

Return ONLY this format, one key per line:
OPTOPPEN_SCORE: [0-10]
OPTOPPEN_TOELICHTING: [2 zinnen: technische haalbaarheid + planologische kans]
SPLITSEN_SCORE: [0-10]
SPLITSEN_TOELICHTING: [2 zinnen]
BALKON_SCORE: [0-10]
BALKON_TOELICHTING: [2 zinnen]
AANBOUW_SCORE: [0-10]
AANBOUW_TOELICHTING: [2 zinnen]
GEMEENTE_STRICTHEID: [Streng/Gemiddeld/Soepel]
GEMEENTE_BELEID: [3 zinnen: bekend beleid van deze gemeente op splitsing/optoppen/vergunningen]
BESTEMMINGSPLAN_TYPE: [Wonen/Gemengd/Centrum/Bedrijventerrein/Onbekend]
TRANSFORMATIE_ADVIES: [3 zinnen: beste kans, grootste belemmering, aanbevolen eerste stap]`
            }]
          });
          const pr = potMsg.content[0].text;
          const p = {};
          for (const line of pr.trim().split('\n')) {
            if (line.includes(':')) { const [k, ...v] = line.split(':'); p[k.trim()] = v.join(':').trim(); }
          }
          return {
            optoppen:   { score: pn(p.OPTOPPEN_SCORE, 5),  toelichting: p.OPTOPPEN_TOELICHTING  ?? '' },
            splitsen:   { score: pn(p.SPLITSEN_SCORE, 5),  toelichting: p.SPLITSEN_TOELICHTING  ?? '' },
            balkon:     { score: pn(p.BALKON_SCORE, 5),    toelichting: p.BALKON_TOELICHTING    ?? '' },
            aanbouw:    { score: pn(p.AANBOUW_SCORE, 5),   toelichting: p.AANBOUW_TOELICHTING   ?? '' },
            gemeente_strictheid:  p.GEMEENTE_STRICTHEID  ?? 'Gemiddeld',
            gemeente_beleid:      p.GEMEENTE_BELEID       ?? '',
            bestemmingsplan_type: p.BESTEMMINGSPLAN_TYPE  ?? 'Onbekend',
            advies:               p.TRANSFORMATIE_ADVIES  ?? '',
          };
        } catch { return null; }
      })(),
    ]);

    // BAG-oppervlakte en bouwjaar zijn autoritatief boven AI/scraper
    const sqm  = kad.official_sqm  ?? sqm_ai;
    const year = kad.official_year ?? year_ai;

    // ── Marktwaarde: Kadaster transacties + BAG VBO oppervlakte ──────────────
    const ai_fair_value = pn(d.FAIR_VALUE, price); // bewaard als referentie, niet primair
    let stat_fair_value   = null;
    let stat_prijs_per_m2 = null;
    let prijs_validatie   = null;

    // Stap 1a: echte transacties — koopsommen × BAG VBO oppervlakte
    let kadComps = [];
    if (kad.koopsommen?.length > 0) {
      const toResolve = kad.koopsommen.slice(0, 8).filter(k => k.prijs && k.coords);
      const resolved  = await Promise.all(
        toResolve.map(async k => {
          const vboOpp = await lookupVboOppervlakte(k.coords);
          return vboOpp ? { price: k.prijs, sqm: vboOpp, datum: k.datum, source: 'kadaster' } : null;
        })
      );
      kadComps = resolved.filter(Boolean).filter(c => c.sqm > 15 && c.price > 50000);
    }

    // Stap 1b: AI-comps als aanvulling
    const aiComps = [1,2,3,4].map(i => ({
      price:  pn(d[`COMP${i}_PRICE`], 0),
      sqm:    pn(d[`COMP${i}_SQM`], 1),
      source: 'ai',
    })).filter(c => c.price > 50000 && c.sqm > 20);

    const allComps = [...kadComps, ...aiComps];

    if (allComps.length >= 2 && sqm > 0) {
      const weighted    = allComps.map(c => ({ ppm: c.price / c.sqm, w: c.source === 'kadaster' ? 2 : 1 }));
      const totalW      = weighted.reduce((s, c) => s + c.w, 0);
      const gemPpm      = weighted.reduce((s, c) => s + c.ppm * c.w, 0) / totalW;
      stat_prijs_per_m2 = Math.round(gemPpm);
      stat_fair_value   = Math.round(gemPpm * sqm);
    }

    let fair_value, waarde_methode;
    if (stat_fair_value && kadComps.length >= 3) {
      fair_value     = stat_fair_value;
      waarde_methode = 'Kadaster transacties';
    } else if (stat_fair_value && kadComps.length >= 1) {
      fair_value     = Math.round(stat_fair_value * 0.7 + ai_fair_value * 0.3);
      waarde_methode = 'Kadaster + AI blend';
    } else if (stat_fair_value && aiComps.length >= 3) {
      fair_value     = stat_fair_value;
      waarde_methode = 'Statistisch (comps)';
    } else if (stat_fair_value) {
      fair_value     = Math.round(stat_fair_value * 0.6 + ai_fair_value * 0.4);
      waarde_methode = 'Blend (statistisch + AI)';
    } else {
      fair_value     = ai_fair_value;
      waarde_methode = 'AI-schatting';
    }

    if (stat_fair_value) {
      const afwijking = Math.abs(ai_fair_value - stat_fair_value) / stat_fair_value * 100;
      prijs_validatie = {
        ai_fair_value,
        stat_fair_value,
        stat_prijs_per_m2,
        waarde_methode,
        kad_comps_count: kadComps.length,
        ai_comps_count:  aiComps.length,
        afwijking_pct:   Math.round(afwijking),
        betrouwbaar:     afwijking < 20,
      };
    }

    // ── Renovatiekosten — feitentabel (niet AI) ──────────────────────────────
    const { kosten: reno_cost, items: reno_items } = berekenRenovatiekosten({
      sqm, condition, year, property_type, energy: energy_raw,
    });

    // ── Huurwaarde — WOZ-yield + WWS ceiling (niet AI) ──────────────────────
    const woz = kad.woz_huidig ?? 0;
    const wws = berekenWWS({ sqm, energy: energy_raw, woz_huidig: woz });
    let monthly_rent, huur_methode;

    const woz_huur = woz > 0 ? Math.round(woz * 0.05 / 12) : null;
    const fv_huur  = fair_value > 0 ? Math.round(fair_value * 0.05 / 12) : null;

    if (woz_huur) {
      // Cap op WWS max_huur als het een gereguleerde woning is
      monthly_rent  = wws.max_huur ? Math.min(woz_huur, wws.max_huur) : woz_huur;
      huur_methode  = wws.max_huur ? 'WOZ-yield 5% (WWS gecapped)' : 'WOZ-yield 5%';
    } else if (fv_huur) {
      monthly_rent  = wws.max_huur ? Math.min(fv_huur, wws.max_huur) : fv_huur;
      huur_methode  = wws.max_huur ? 'Marktwaarde-yield 5% (WWS gecapped)' : 'Marktwaarde-yield 5%';
    } else {
      monthly_rent  = pn(d.MONTHLY_RENT, 1200); // AI fallback
      huur_methode  = 'AI-schatting (fallback)';
    }

    // ── Risicoscore — objectief op feiten ───────────────────────────────────
    const risico = berekenRisico({
      price, fair_value, woz_huidig: woz,
      year, energy: energy_raw, condition, property_type, sqm,
      is_rijksmonument:     kad.is_rijksmonument     ?? false,
      is_beschermd_gezicht: kad.is_beschermd_gezicht ?? false,
      erfpacht,
    });

    // AI risk_notes bewaren als extra context naast feitelijke notities
    const risk_notes = risico.risk_notes_factual || d.RISK_NOTES || '';

    // ── CBS gemeente gemiddelde ──────────────────────────────────────────────
    let cbs_gem_prijs = null;
    if (kad.gemeentecode) {
      try {
        const cbsCode = kad.gemeentecode.replace(/^0+/, 'GM').padStart(6, '0')
          .replace(/^GM(\d+)$/, (_, n) => 'GM' + n.padStart(4, '0'));
        const cbsUrl  = `https://opendata.cbs.nl/ODataApi/odata/83913NED/TypedDataSet?$filter=RegioS+eq+'${cbsCode}'&$orderby=Perioden+desc&$top=1&$select=Perioden,GemiddeldeVerkoopprijs_7`;
        const cbsR    = await fetch(cbsUrl, { signal: AbortSignal.timeout(8000) });
        if (cbsR.ok) {
          const cbsD = await cbsR.json();
          const rec  = cbsD?.value?.[0];
          if (rec?.GemiddeldeVerkoopprijs_7) {
            cbs_gem_prijs = { prijs: rec.GemiddeldeVerkoopprijs_7, periode: rec.Perioden };
          }
        }
      } catch { /* CBS niet beschikbaar */ }
    }

    const result = {
      url, address, price,
      sqm,
      year,
      energy:        energy_raw,
      condition,
      property_type,
      rooms,
      reno_items,
      reno_cost,
      fair_value,
      prijs_validatie,
      cbs_gem_prijs,
      monthly_rent,
      huur_methode,
      wws_categorie:  wws.categorie,
      wws_punten:     wws.totaal,
      risk_score:     risico.risk_score,
      risk_location:  risico.risk_location,
      risk_condition: risico.risk_condition,
      risk_market:    risico.risk_market,
      risk_liquidity: risico.risk_liquidity,
      risk_notes,
      comps: [1,2,3,4].map(i => ({
        address: d[`COMP${i}_ADDRESS`] ?? '—',
        price:   pn(d[`COMP${i}_PRICE`], 0),
        sqm:     pn(d[`COMP${i}_SQM`], 1),
        year:    d[`COMP${i}_YEAR`] ?? '—',
      })),
      healthy_margin:   pn(d.HEALTHY_MARGIN, 15),
      erfpacht,
      erfpacht_canon:   pn(d.ERFPACHT_CANON, 0),
      investment_score: pn(d.INVESTMENT_SCORE, 5),
      summary:          d.SUMMARY ?? '',
      advice:           d.ADVICE ?? '',
      full_analysis:    d.FULL_ANALYSIS ?? '',
      kadaster:         kad,
      potentieel,
      structured_source: structured ? Object.fromEntries(
        Object.entries(structured).filter(([, v]) => v !== null)
      ) : null,
      saved_at: new Date().toLocaleDateString('nl-NL', { day: '2-digit', month: 'short', year: 'numeric' }),
    };

    return Response.json(result);
  } catch (e) {
    return Response.json({ error: e.message }, { status: 500 });
  }
}
