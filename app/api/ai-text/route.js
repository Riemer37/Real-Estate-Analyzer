import Anthropic from '@anthropic-ai/sdk';
import { auth, clerkClient } from '@clerk/nextjs/server';

export const maxDuration = 60;

export async function POST(request) {
  if (!process.env.ANTHROPIC_API_KEY) {
    return Response.json({ error: 'ANTHROPIC_API_KEY niet geconfigureerd' }, { status: 503 });
  }

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

  const stream = client.messages.stream({
    model: 'claude-sonnet-4-6',
    max_tokens: 8096,
    temperature: 0.3,
    messages: [{
      role: 'user',
      content: `Je bent een senior vastgoed investment analyst voor de Nederlandse markt.
Analyseer het volgende pand en evalueer alle 10 investeringsstrategieën.
Geef je output als GELDIG JSON (geen markdown, geen code fences, direct JSON).

OBJECT DATA:
${context}

EVALUEER deze 10 strategieën op basis van de beschikbare data:
1. Flip (kopen → renoveren → verkopen)
2. Buy-to-let (kopen → renoveren → verhuren)
3. Splitsen → verkopen per unit
4. Splitsen → verhuren per unit
5. Splitsen → mix (deel verkopen, deel verhuren)
6. Bestemmingswijziging → ontwikkelen → verkopen
7. Bestemmingswijziging → ontwikkelen → verhuren
8. Sloop → nieuwbouw → verkopen/verhuren
9. Transformatie (bijv. kantoor naar wonen)
10. Optoppen (extra bouwlaag realiseren)

Gebruik dit EXACTE JSON schema:
{
  "samenvatting": "3-4 zinnen objectbeschrijving, kansen en marktpositie",
  "strategieen": [
    {
      "id": 1,
      "naam": "Flip",
      "haalbaarheid": "Kort: juridisch/technisch/financieel",
      "verwacht_roi": "bijv. 15-20%",
      "verwacht_cashflow": "bijv. eenmalig €45.000 bij verkoop",
      "risico": "laag",
      "doorlooptijd": "bijv. 6-12 maanden",
      "max_bod": "bijv. €280.000",
      "aanbevolen": true,
      "toelichting": "2-3 zinnen waarom wel/niet"
    }
  ],
  "top3": [
    {"rang": 1, "strategie": "Flip", "reden": "1-2 zinnen"},
    {"rang": 2, "strategie": "Buy-to-let", "reden": "1-2 zinnen"},
    {"rang": 3, "strategie": "Splitsen verhuren", "reden": "1-2 zinnen"}
  ],
  "aandachtspunten": ["punt 1", "punt 2", "punt 3", "punt 4"],
  "kopen": true,
  "eindadvies": "2-3 zinnen concreet advies: kopen of niet en waarom"
}

Regels:
- Gebruik ALLEEN de verstrekte data, verzin GEEN getallen
- risico moet zijn: "laag", "middel" of "hoog"
- Geef voor ALLE 10 strategieën een beoordeling, ook als ze niet haalbaar zijn
- max_bod baseert op de opgegeven vraagprijs en verbouwingskosten`,
    }],
  });

  const readable = new ReadableStream({
    async start(controller) {
      const encoder = new TextEncoder();
      try {
        for await (const event of stream) {
          if (event.type === 'content_block_delta' && event.delta?.type === 'text_delta') {
            controller.enqueue(encoder.encode(event.delta.text));
          }
        }
      } catch (e) {
        controller.error(e);
      }
      controller.close();
    },
  });

  return new Response(readable, {
    headers: { 'Content-Type': 'text/plain; charset=utf-8' },
  });
}
