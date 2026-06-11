import Anthropic from '@anthropic-ai/sdk';
import { auth, clerkClient } from '@clerk/nextjs/server';

export const maxDuration = 60;

export async function POST(request) {
  if (!process.env.ANTHROPIC_API_KEY) {
    return Response.json({ error: 'ANTHROPIC_API_KEY niet geconfigureerd' }, { status: 503 });
  }
  const { userId } = await auth();
  if (!userId) return Response.json({ error: 'Inloggen vereist' }, { status: 401 });
  const clerk = await clerkClient();
  const user  = await clerk.users.getUser(userId);
  if (!user.publicMetadata?.isPro) return Response.json({ error: 'Pro vereist' }, { status: 403 });

  const { kamers, pandPunten, property } = await request.json();
  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

  const prompt = `Je bent een senior bouwkostendeskundige voor de Nederlandse markt (2024-normen).

PAND:
- Adres: ${property.adres}
- Type: ${property.typeWoning}
- Vraagprijs: €${property.vraagprijs?.toLocaleString('nl-NL')}
- Oppervlakte: ${property.woonoppervlakte}m²

VERBOUWCHECKLIST PER RUIMTE:
${kamers.map(k => `
${k.naam} (${k.oppervlakte ?? '?'}m², staat: ${k.staat}):
- Gewenste functie: ${k.gewenstGebruik || 'ongewijzigd'}
${Object.entries(k.acties).filter(([,v]) => v && v !== false && v !== '' && v !== 0).map(([k2,v]) => `  • ${k2}: ${v}`).join('\n')}
`).join('')}

PAND-NIVEAU:
${Object.entries(pandPunten).filter(([,v]) => v && v !== 'geen' && v !== 'handhaven' && v !== 'niet_aanwezig' && v !== 'aanwezig').map(([k,v]) => `- ${k}: ${v}`).join('\n')}

Geef ALLEEN geldige JSON terug (geen markdown):
{
  "raming": {
    "laag": 45000,
    "midden": 65000,
    "hoog": 90000,
    "perM2": 430,
    "doorlooptijd": "4-6 maanden",
    "onvoorzien": 7500,
    "vergunningen": 2500,
    "perRuimte": [
      { "naam": "Keuken", "laag": 8000, "midden": 12000, "hoog": 18000, "toelichting": "Inclusief vervanging leidingwerk" }
    ]
  },
  "scenarioA": {
    "naam": "Verkopen na verbouw",
    "verwachteOpbrengst": 550000,
    "investering": 65000,
    "nettoWinst": 40000,
    "roi": 14.5,
    "doorlooptijd": "6-9 maanden",
    "toelichting": "..."
  },
  "scenarioB": {
    "naam": "Verhuren na verbouw",
    "markthuurPerMaand": 1800,
    "bar": 5.2,
    "nar": 4.1,
    "hwm": 17.8,
    "cashflowPerMaand": 1400,
    "terugverdientijd": "12 jaar",
    "toelichting": "..."
  },
  "scenarioC": {
    "naam": "Mix verkoop + verhuur",
    "beschrijving": "...",
    "verwachteOpbrengst": 480000,
    "roi": 18.2,
    "toelichting": "..."
  },
  "scenarioD": {
    "naam": "Short-stay / Airbnb",
    "geschatteNachthuur": 120,
    "bezettingsgraad": 70,
    "brutoJaaropbrengst": 30660,
    "vergelijking": "...",
    "toelichting": "..."
  },
  "eindadvies": {
    "aanbevolenScenario": "B",
    "reden": "...",
    "risicos": ["risico 1", "risico 2", "risico 3"],
    "volgendeStappen": ["stap 1", "stap 2", "stap 3"]
  }
}`;

  const stream = client.messages.stream({
    model: 'claude-sonnet-4-6',
    max_tokens: 8096,
    temperature: 0.2,
    messages: [{ role: 'user', content: prompt }],
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
      } catch (e) { controller.error(e); }
      controller.close();
    },
  });

  return new Response(readable, { headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
}
