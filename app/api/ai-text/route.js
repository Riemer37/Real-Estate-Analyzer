import Anthropic from '@anthropic-ai/sdk';
import { auth, clerkClient } from '@clerk/nextjs/server';

export const maxDuration = 30;

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

export async function POST(request) {
  try {
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
        content: `Je bent een Nederlandse vastgoed investment adviseur. Analyseer onderstaand object en geef:

THESE: [3-4 zinnen investeringsthese — waarom wel/niet interessant als investering, op basis van vraagprijs, verbouwingskosten en staat]
RISICO: [3-4 zinnen risicotoelichting — specifieke risico's voor dit object: bouwjaar, energielabel, erfpacht, monument, marktpositie]
TRANSFORMATIE: [2-3 zinnen transformatieadvies — splitsing, optoppen, verhuur, renovatie mogelijkheden]

Gebruik ALLEEN de verstrekte data. Verzin GEEN getallen. Wees concreet en professioneel.

${context}`,
      }],
    });

    const text = msg.content[0].text;
    const these = text.match(/THESE:\s*(.+?)(?=RISICO:|$)/s)?.[1]?.trim() ?? '';
    const risico = text.match(/RISICO:\s*(.+?)(?=TRANSFORMATIE:|$)/s)?.[1]?.trim() ?? '';
    const transformatie = text.match(/TRANSFORMATIE:\s*(.+?)$/s)?.[1]?.trim() ?? '';

    return Response.json({ these, risico, transformatie });
  } catch (e) {
    return Response.json({ error: e.message }, { status: 500 });
  }
}
