import Anthropic from '@anthropic-ai/sdk';
import { auth, clerkClient } from '@clerk/nextjs/server';

export const maxDuration = 30;

export async function POST(request) {
  try {
    if (!process.env.ANTHROPIC_API_KEY) {
      return Response.json({ error: 'ANTHROPIC_API_KEY niet geconfigureerd' }, { status: 503 });
    }

    // Server-side pro check (defence-in-depth — client also gates)
    const { userId } = await auth();
    if (!userId) {
      return Response.json({ error: 'Inloggen vereist voor AI analyse' }, { status: 401 });
    }
    const clerk = await clerkClient();
    const user = await clerk.users.getUser(userId);
    if (!user.publicMetadata?.isPro) {
      return Response.json({ error: 'Pro abonnement vereist voor AI analyse' }, { status: 403 });
    }

    const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
    const { input, kad } = await request.json();

    const renovatietotaal = input.renovatiekostenPerM2
      ? input.renovatiekostenPerM2 * input.woonoppervlakte
      : null;

    const context = `
Woningdata (ingevoerd door gebruiker):
- Adres: ${input.adres}
- Type: ${input.typeWoning}
- Vraagprijs: €${input.vraagprijs.toLocaleString('nl-NL')}
- WOZ waarde: €${input.wozWaarde.toLocaleString('nl-NL')}
- Woonoppervlakte: ${input.woonoppervlakte}m²
- Perceeloppervlakte: ${input.perceeloppervlakte ? input.perceeloppervlakte + 'm²' : 'N.v.t.'}
- Bouwjaar: ${input.bouwjaar}
- Energielabel: ${input.energielabel}
- Aantal kamers: ${input.aantalKamers}
- Staat van onderhoud: ${input.conditie}
- Erfpacht: ${input.erfpacht ? 'Ja' : 'Nee'}
- Verbouwingskosten: ${renovatietotaal ? '€' + input.renovatiekostenPerM2.toLocaleString('nl-NL') + '/m² = €' + renovatietotaal.toLocaleString('nl-NL') + ' totaal' : 'Niet opgegeven'}

Kadaster/BAG data:
- Officieel adres: ${kad.officielAdres ?? 'Niet gevonden'}
- Gemeente: ${kad.gemeente ?? '—'}
- Rijksmonument: ${kad.isRijksmonument ? 'Ja' : 'Nee'}
- Beschermd gezicht: ${kad.beschermdGezicht ?? 'Nee'}
- Splitsingstatus: ${kad.isSplit ? 'Gesplitst (' + kad.vboCount + ' eenheden)' : 'Niet gesplitst'}
- WOZ trend: ${kad.wozHistory.slice(0, 3).map(w => w.jaar + ': €' + w.waarde.toLocaleString('nl-NL')).join(', ')}
`;

    const msg = await client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 1200,
      temperature: 0.3,
      messages: [{
        role: 'user',
        content: `Je bent een Nederlandse vastgoed investment adviseur. Analyseer onderstaand object.
Geef je antwoord als geldig JSON met precies deze drie sleutels:
{"these":"...","risico":"...","transformatie":"..."}

- these: 3-4 zinnen investeringsthese (waarom wel/niet interessant als investering)
- risico: 3-4 zinnen risicotoelichting (bouwjaar, energielabel, erfpacht, monument)
- transformatie: 2-3 zinnen transformatieadvies (splitsing, verhuur, renovatie)

Gebruik ALLEEN de verstrekte data. Verzin GEEN getallen. Geen markdown, alleen JSON.

${context}`,
      }],
    });

    const text = msg.content[0].text;

    // Parse JSON — handle optional markdown code fences
    let parsed = {};
    try {
      const jsonStr = text.match(/\{[\s\S]*\}/)?.[0] ?? text;
      parsed = JSON.parse(jsonStr);
    } catch {
      // Fallback: return raw text in these field so it's never silently empty
      parsed = { these: text, risico: '', transformatie: '' };
    }

    return Response.json({
      these:          parsed.these         ?? '',
      risico:         parsed.risico        ?? '',
      transformatie:  parsed.transformatie ?? '',
    });
  } catch (e) {
    return Response.json({ error: e.message }, { status: 500 });
  }
}
