import Anthropic from '@anthropic-ai/sdk';
import axios from 'axios';
import * as cheerio from 'cheerio';
import { lookupKadaster } from '@/lib/kadaster';
import { pn } from '@/lib/utils';

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

async function fetchPage(url) {
  try {
    const scraperUrl = `http://api.scraperapi.com?api_key=${process.env.SCRAPER_API_KEY}&url=${encodeURIComponent(url)}`;
    const { data } = await axios.get(scraperUrl, { timeout: 60000 });
    const $ = cheerio.load(data);
    $('script, style, nav, footer, header, iframe').remove();
    const text = $.text().split('\n').map(l => l.trim()).filter(l => l.length > 2).join('\n');
    return text.slice(0, 8000);
  } catch (e) {
    return `Error: ${e.message}`;
  }
}

export async function POST(request) {
  try {
    const { url } = await request.json();
    const page = await fetchPage(url);

    const msg = await client.messages.create({
      model: 'claude-opus-4-6',
      max_tokens: 2500,
      messages: [{
        role: 'user',
        content: `You are a senior Dutch real estate investment analyst.
URL: ${url}
PAGE: ${page}

Return ONLY these keys, one per line, no extra text:
ADDRESS: [street housenumber, city — no apartment suffix, no commas in street part]
PRICE: [digits only]
SQM: [digits only]
YEAR: [digits only]
ENERGY: [A/B/C/D/E/F/G]
CONDITION: [Excellent/Good/Fair/Poor]
PROPERTY_TYPE: [Apartment/House/Townhouse/Commercial]
ROOMS: [digits only]
RENOVATION_ITEMS: [comma-separated specific items]
RENOVATION_COST: [digits only]
FAIR_VALUE: [digits only]
MONTHLY_RENT: [digits only]
RISK_SCORE: [1-10]
RISK_LOCATION: [Low/Medium/High]
RISK_CONDITION: [Low/Medium/High]
RISK_MARKET: [Low/Medium/High]
RISK_LIQUIDITY: [Low/Medium/High]
RISK_NOTES: [2 sentences on key risks]
COMP1_ADDRESS: [nearby sold] COMP1_PRICE: [digits] COMP1_SQM: [digits] COMP1_YEAR: [year]
COMP2_ADDRESS: [nearby sold] COMP2_PRICE: [digits] COMP2_SQM: [digits] COMP2_YEAR: [year]
COMP3_ADDRESS: [nearby sold] COMP3_PRICE: [digits] COMP3_SQM: [digits] COMP3_YEAR: [year]
COMP4_ADDRESS: [nearby sold] COMP4_PRICE: [digits] COMP4_SQM: [digits] COMP4_YEAR: [year]
HEALTHY_MARGIN: [digits only]
INVESTMENT_SCORE: [1-10]
SUMMARY: [2 sentences]
ADVICE: [3 sentences — buy/pass, bid price, opportunity]
FULL_ANALYSIS: [5 sentences covering acquisition, renovation, exit, risks, verdict]`
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

    const price   = pn(d.PRICE, 250000);
    const address = d.ADDRESS ?? 'Unknown';
    const kad     = await lookupKadaster(address);

    // Tweede Claude-call: transformatiepotentieel & gemeentelijk beleid
    let potentieel = null;
    try {
      const potMsg = await client.messages.create({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 1200,
        messages: [{
          role: 'user',
          content: `Je bent een Nederlandse vastgoedadviseur gespecialiseerd in transformatiepotentieel en gemeentelijk vergunningenbeleid.

Pand: ${address}
Gemeente: ${kad.gemeentenaam ?? d.ADDRESS?.split(',').pop()?.trim() ?? 'onbekend'}
Buurt: ${kad.buurtnaam ?? '—'}
Provincie: ${kad.provincienaam ?? '—'}
Bouwjaar: ${kad.official_year ?? d.YEAR ?? '—'}
Oppervlakte: ${kad.official_sqm ?? d.SQM ?? '—'} m²
Type: ${d.PROPERTY_TYPE ?? '—'}
Staat: ${d.CONDITION ?? '—'}
VBO's in pand: ${kad.vbo_count ?? 1}
Pand status: ${kad.pand_status ?? '—'}
Verdiepingen (schatting): ${Math.round((pn(d.SQM,85)) / 60)} bouwlagen

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
      potentieel = {
        optoppen:   { score: pn(p.OPTOPPEN_SCORE, 5),  toelichting: p.OPTOPPEN_TOELICHTING  ?? '' },
        splitsen:   { score: pn(p.SPLITSEN_SCORE, 5),  toelichting: p.SPLITSEN_TOELICHTING  ?? '' },
        balkon:     { score: pn(p.BALKON_SCORE, 5),    toelichting: p.BALKON_TOELICHTING    ?? '' },
        aanbouw:    { score: pn(p.AANBOUW_SCORE, 5),   toelichting: p.AANBOUW_TOELICHTING   ?? '' },
        gemeente_strictheid:  p.GEMEENTE_STRICTHEID  ?? 'Gemiddeld',
        gemeente_beleid:      p.GEMEENTE_BELEID       ?? '',
        bestemmingsplan_type: p.BESTEMMINGSPLAN_TYPE  ?? 'Onbekend',
        advies:               p.TRANSFORMATIE_ADVIES  ?? '',
      };
    } catch { /* transformatieanalyse niet beschikbaar */ }

    const result = {
      url, address, price,
      sqm:           pn(d.SQM, 85),
      year:          pn(d.YEAR, 1970),
      energy:        (d.ENERGY ?? 'C').trim().toUpperCase().slice(0, 1),
      condition:     d.CONDITION ?? 'Fair',
      property_type: d.PROPERTY_TYPE ?? 'House',
      rooms:         pn(d.ROOMS, 4),
      reno_items:    d.RENOVATION_ITEMS ?? 'General renovation',
      reno_cost:     pn(d.RENOVATION_COST, 20000),
      fair_value:    pn(d.FAIR_VALUE, price),
      monthly_rent:  pn(d.MONTHLY_RENT, 1200),
      risk_score:    pn(d.RISK_SCORE, 5),
      risk_location: d.RISK_LOCATION ?? 'Medium',
      risk_condition:d.RISK_CONDITION ?? 'Medium',
      risk_market:   d.RISK_MARKET ?? 'Medium',
      risk_liquidity:d.RISK_LIQUIDITY ?? 'Medium',
      risk_notes:    d.RISK_NOTES ?? '',
      comps: [1,2,3,4].map(i => ({
        address: d[`COMP${i}_ADDRESS`] ?? '—',
        price:   pn(d[`COMP${i}_PRICE`], 0),
        sqm:     pn(d[`COMP${i}_SQM`], 1),
        year:    d[`COMP${i}_YEAR`] ?? '—',
      })),
      healthy_margin:   pn(d.HEALTHY_MARGIN, 15),
      investment_score: pn(d.INVESTMENT_SCORE, 5),
      summary:          d.SUMMARY ?? '',
      advice:           d.ADVICE ?? '',
      full_analysis:    d.FULL_ANALYSIS ?? '',
      kadaster:         kad,
      potentieel,
      saved_at:         new Date().toLocaleDateString('nl-NL', { day: '2-digit', month: 'short', year: 'numeric' }),
    };

    return Response.json(result);
  } catch (e) {
    return Response.json({ error: e.message }, { status: 500 });
  }
}
