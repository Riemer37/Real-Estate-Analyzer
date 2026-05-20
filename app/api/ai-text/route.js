import Anthropic from '@anthropic-ai/sdk';

export const maxDuration = 30;

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

export async function POST(request) {
  try {
    const { input, kad } = await request.json();

    const context = `
Woningdata (ingevoerd door gebruiker):
- Adres: ${input.adres}
- Type: ${input.typeWoning}
- Vraagprijs: €${input.vraagprijs.toLocaleString('nl-NL')}
- Marktwaarde (handmatig): €${input.marktwaarde.toLocaleString('nl-NL')}
- WOZ waarde: €${input.wozWaarde.toLocaleString('nl-NL')}
- Woonoppervlakte: ${input.woonoppervlakte}m²
- Perceeloppervlakte: ${input.perceeloppervlakte ? input.perceeloppervlakte + 'm²' : 'N.v.t.'}
- Bouwjaar: ${input.bouwjaar}
- Energielabel: ${input.energielabel}
- Aantal kamers: ${input.aantalKamers}
- Staat van onderhoud: ${input.conditie}
- Erfpacht: ${input.erfpacht ? 'Ja' : 'Nee'}
- Renovatiekosten (eigen inschatting): ${input.renovatiekostenEigen ? '€' + input.renovatiekostenEigen.toLocaleString('nl-NL') : 'Niet opgegeven'}

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

THESE: [3-4 zinnen investeringsthese — waarom wel/niet interessant als investering, op basis van verhouding vraagprijs/marktwaarde en staat]
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
