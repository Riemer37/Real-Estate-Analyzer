// Stap 2/3 — AI analyse (<8s)
// Gebruikt Haiku (snel, 2-4s) in plaats van Opus
import Anthropic from '@anthropic-ai/sdk';

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

export async function POST(request) {
  try {
    const { text, structured } = await request.json();

    const knownFacts = structured ? [
      structured.price   ? `KNOWN_PRICE: ${structured.price}`    : null,
      structured.sqm     ? `KNOWN_SQM: ${structured.sqm}`        : null,
      structured.year    ? `KNOWN_YEAR: ${structured.year}`       : null,
      structured.energy  ? `KNOWN_ENERGY: ${structured.energy}`   : null,
      structured.rooms   ? `KNOWN_ROOMS: ${structured.rooms}`     : null,
      structured.address ? `KNOWN_ADDRESS: ${structured.address}` : null,
    ].filter(Boolean).join('\n') : '';

    const msg = await client.messages.create({
      model: 'claude-haiku-4-5-20251001', // Snel model — past binnen 10s
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
FULL_ANALYSIS: [5 sentences — acquisition, renovation, exit, risks, verdict]`
      }],
    });

    const raw = msg.content[0].text;
    const d = {};
    for (const line of raw.trim().split('\n')) {
      if (line.includes(':')) {
        const [k, ...rest] = line.split(':');
        d[k.trim()] = rest.join(':').trim();
      }
    }

    return Response.json({ d, ok: true });
  } catch (e) {
    return Response.json({ d: {}, ok: false, error: e.message });
  }
}
