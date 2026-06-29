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

  // Pre-bereken financiële parameters zodat Claude niet hoeft te rekenen
  const vraagprijs = property.vraagprijs ?? 0;
  const oppervlakte = property.woonoppervlakte ?? 0;
  const ovbPct = property.eigenGebruik ? 2 : 10.4;
  const ovbBedrag = Math.round(vraagprijs * (ovbPct / 100));
  const notaris = property.notariskosten ?? 2500;
  const taxatie = property.taxatiekosten ?? 750;
  const keuring = property.bouwkundigeKeuring ?? 600;
  const bijkomend = ovbBedrag + notaris + taxatie + keuring;
  const arvPerM2 = property.referentieprijsPerM2 ?? null;
  const arvTotaal = arvPerM2 ? Math.round(arvPerM2 * oppervlakte) : null;

  // Actieve werkzaamheden tellen
  const actieveKamers = kamers.filter(k =>
    Object.entries(k.acties ?? {}).some(([, v]) => v && v !== false && v !== '' && v !== 0)
  );

  const systemPrompt = `Je bent een senior bouwkostendeskundige voor de Nederlandse markt (2024-normen).

REKENREGELS:
- Gebruik UITSLUITEND de verstrekte gegevens — verzin NOOIT bedragen
- Geef bandbreedtes (laag/midden/hoog) op basis van complexiteit en materiaalkosten NL 2024
- Typische NL tarieven: keuken €8.000–€25.000, badkamer €6.000–€18.000, vloer €30–€80/m², schilderwerk €8–€20/m²
- Onvoorzien: standaard 10-15% van totale verbouwkosten
- Vergunningskosten: alleen rekenen als verbouwing vergunningplichtig is (bijv. dragende wand, dakopbouw)
- ROI = (ARV − totale investering) / totale investering × 100
- BAR = (jaarhuur / aankoopprijs) × 100
- HWM = aankoopprijs / jaarhuur

BETROUWBAARHEIDSREGELS:
- Als een ARV ontbreekt: vermeld dit expliciet en geef GEEN concrete ROI
- Geef altijd een toelichting bij onzekere schattingen
- Antwoord ALLEEN in geldig JSON (geen markdown, geen tekst buiten de JSON)`;

  const werkzaamheden = kamers.map(k => {
    const actief = Object.entries(k.acties ?? {}).filter(([, v]) => v && v !== false && v !== '' && v !== 0);
    if (actief.length === 0) return null;
    return `${k.naam} (${k.oppervlakte ?? '?'}m², staat: ${k.staat}):
  Gewenst gebruik: ${k.gewenstGebruik || 'ongewijzigd'}
  ${actief.map(([a, v]) => `  • ${a}: ${v}`).join('\n')}`;
  }).filter(Boolean).join('\n\n');

  const pandwerk = Object.entries(pandPunten ?? {})
    .filter(([, v]) => v && v !== 'geen' && v !== 'handhaven' && v !== 'niet_aanwezig' && v !== 'aanwezig')
    .map(([k, v]) => `- ${k}: ${v}`)
    .join('\n');

  const prompt = `Maak een gedetailleerde verbouwraming voor dit pand.

PAND:
- Adres: ${property.adres}
- Type: ${property.typeWoning}
- Vraagprijs: €${vraagprijs.toLocaleString('nl-NL')}
- Oppervlakte: ${oppervlakte}m²
- OVB (${ovbPct}%): €${ovbBedrag.toLocaleString('nl-NL')}
- Bijkomende kosten totaal: €${bijkomend.toLocaleString('nl-NL')}
- ARV (After Repair Value): ${arvTotaal ? '€' + arvTotaal.toLocaleString('nl-NL') + ' (€' + arvPerM2 + '/m²)' : 'NIET OPGEGEVEN — geef geen concrete ROI'}

VERBOUWWERKZAAMHEDEN PER RUIMTE:
${werkzaamheden || '(Geen specifieke ruimtes geselecteerd)'}

PAND-NIVEAU WERKZAAMHEDEN:
${pandwerk || '(Geen pand-niveau werkzaamheden)'}

Geef ALLEEN geldige JSON terug:
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
    "verwachteOpbrengst": ${arvTotaal ?? 0},
    "investering": 65000,
    "nettoWinst": 40000,
    "roi": ${arvTotaal ? 'BEREKEN_OP_BASIS_VAN_DATA' : null},
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
}

Verplicht: alle getallen als number (niet als string). roi als number of null als ARV ontbreekt.`;

  const stream = client.messages.stream({
    model: 'claude-sonnet-4-6',
    max_tokens: 8096,
    temperature: 0.1,
    system: systemPrompt,
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
