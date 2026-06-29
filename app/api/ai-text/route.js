import Anthropic from '@anthropic-ai/sdk';
import { auth, clerkClient } from '@clerk/nextjs/server';

export const maxDuration = 60;

export async function POST(request) {
  if (!process.env.ANTHROPIC_API_KEY) {
    return Response.json({ error: 'ANTHROPIC_API_KEY niet geconfigureerd' }, { status: 503 });
  }

  const { userId } = await auth();
  if (!userId) return Response.json({ error: 'Inloggen vereist voor AI analyse' }, { status: 401 });
  const clerk = await clerkClient();
  const user = await clerk.users.getUser(userId);
  if (!user.publicMetadata?.isPro) return Response.json({ error: 'Pro abonnement vereist voor AI analyse' }, { status: 403 });

  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  const { input, kad, gewenstRendement = 8 } = await request.json();

  const renovatietotaal = input.renovatiekostenPerM2
    ? input.renovatiekostenPerM2 * input.woonoppervlakte : null;
  const arvTotaal = input.referentieprijsPerM2 && input.woonoppervlakte
    ? input.referentieprijsPerM2 * input.woonoppervlakte : null;

  // OVB berekening
  const ovbPct = input.eigenGebruik ? 0.02 : 0.104;
  const ovbBedrag = input.vraagprijs * ovbPct;
  const totaleAankoopkosten = ovbBedrag + input.notariskosten + input.taxatiekosten
    + input.bouwkundigeKeuring + input.overigeKosten + (renovatietotaal ?? 0);
  const totaalInvestering = input.vraagprijs + totaleAankoopkosten;

  // Rendement berekeningen om Claude te helpen
  const huurJaar = (input.verwachteHuurprijs ?? input.huidigeHuurprijs ?? 0) * 12;
  const barPct = huurJaar > 0 ? ((huurJaar / input.vraagprijs) * 100).toFixed(2) : null;
  const hwm = huurJaar > 0 ? (input.vraagprijs / huurJaar).toFixed(1) : null;

  // WOZ vs vraagprijs verhouding
  const wozVerhouding = input.wozWaarde > 0
    ? ((input.vraagprijs / input.wozWaarde - 1) * 100).toFixed(1) : null;

  // Gem. koopsom buurt vs vraagprijs
  const buurtVerhouding = kad.gemKoopsomBuurt
    ? ((input.vraagprijs / kad.gemKoopsomBuurt - 1) * 100).toFixed(1) : null;

  const databronnen = [
    kad.cbsGemWoningWaarde ? 'CBS buurtstatistieken' : null,
    kad.gemKoopsomBuurt    ? 'Kadaster koopsommen'   : null,
    kad.rpNaam             ? 'RuimtelijkePlannen'     : null,
    kad.wozHistory.length  ? 'WOZ-historie'           : null,
    kad.energielabelEP     ? 'EP-Online energielabel'  : null,
  ].filter(Boolean).join(', ');

  const context = `
OBJECTGEGEVENS (bron: gebruikersinvoer + officiële BAG/Kadaster registers):
- Adres: ${input.adres}
- Gemeente: ${kad.gemeente ?? '—'} | Buurt: ${kad.buurt ?? '—'}
- Type vastgoed: ${input.typeWoning}
- Vraagprijs: €${input.vraagprijs.toLocaleString('nl-NL')}
- WOZ-waarde: €${input.wozWaarde.toLocaleString('nl-NL')}${wozVerhouding ? ` (vraagprijs is ${wozVerhouding}% ${Number(wozVerhouding) > 0 ? 'hoger' : 'lager'} dan WOZ)` : ''}
- WOZ-trend: ${kad.wozHistory.slice(0, 4).sort((a,b) => b.jaar - a.jaar).map(w => w.jaar + ': €' + w.waarde.toLocaleString('nl-NL')).join(' | ')}
- Woonoppervlakte: ${input.woonoppervlakte}m²
- Perceeloppervlakte: ${input.perceeloppervlakte ? input.perceeloppervlakte + 'm²' : 'N.v.t.'}
- Energielabel: ${input.energielabel}${kad.energielabelEP ? ` (officieel EP-Online: ${kad.energielabelEP})` : ''}
- Aantal kamers: ${input.aantalKamers}
- Staat van onderhoud: ${input.conditie}
- Erfpacht: ${input.erfpacht ? 'Ja' : 'Nee'}
- Rijksmonument: ${kad.isRijksmonument ? 'JA — verbouwing beperkt!' : 'Nee'}
- Beschermd gezicht: ${kad.beschermdGezicht ?? 'Nee'}
- BAG gebruiksdoel: ${kad.gebruiksdoel ?? 'Onbekend'}
- Aantal eenheden (VBO): ${kad.vboCount ?? 1}

FINANCIËLE PARAMETERS:
- Totale aankoopinvestering: €${totaalInvestering.toLocaleString('nl-NL')}
  • OVB (${input.eigenGebruik ? '2%' : '10,4%'}): €${ovbBedrag.toLocaleString('nl-NL')}
  • Notaris: €${input.notariskosten.toLocaleString('nl-NL')} | Taxatie: €${input.taxatiekosten.toLocaleString('nl-NL')} | Keuring: €${input.bouwkundigeKeuring.toLocaleString('nl-NL')}
  • Verbouwingskosten: ${renovatietotaal ? '€' + renovatietotaal.toLocaleString('nl-NL') + ' (€' + input.renovatiekostenPerM2 + '/m²)' : 'Niet opgegeven'}
- ARV (After Repair Value): ${arvTotaal ? '€' + arvTotaal.toLocaleString('nl-NL') + ' (€' + input.referentieprijsPerM2 + '/m²)' : 'Niet opgegeven'}
- Verwachte huurprijs: ${input.verwachteHuurprijs ? '€' + input.verwachteHuurprijs.toLocaleString('nl-NL') + '/maand' : 'Niet opgegeven'}
- Huidige huurprijs: ${input.huidigeHuurprijs ? '€' + input.huidigeHuurprijs.toLocaleString('nl-NL') + '/maand (' + input.huurcontractType + ')' : 'Leeg'}
- Vaste lasten: ${input.vasteLastenPerMaand ? '€' + input.vasteLastenPerMaand.toLocaleString('nl-NL') + '/maand' : 'Niet opgegeven'}
${barPct ? `- Berekende BAR: ${barPct}% | HWM: ${hwm}x` : ''}
- Gewenst rendement: ${gewenstRendement}% per jaar

OFFICIËLE MARKTDATA (beschikbare bronnen: ${databronnen || 'beperkt'}):
- CBS gem. woningwaarde buurt: ${kad.cbsGemWoningWaarde ? '€' + kad.cbsGemWoningWaarde.toLocaleString('nl-NL') : 'Niet beschikbaar'}
- CBS % koopwoningen buurt: ${kad.cbsPctKoop != null ? kad.cbsPctKoop + '%' : 'Niet beschikbaar'}
- CBS % huurwoningen buurt: ${kad.cbsPctHuur != null ? kad.cbsPctHuur + '%' : 'Niet beschikbaar'}
- CBS gem. inkomen buurt: ${kad.cbsGemInkomen ? '€' + kad.cbsGemInkomen.toLocaleString('nl-NL') + '/jaar' : 'Niet beschikbaar'}
- Kadaster recente transacties buurt: ${kad.koopsomAantal ? kad.koopsomAantal + ' transacties, gem. €' + kad.gemKoopsomBuurt?.toLocaleString('nl-NL') : 'Geen data'}
${buurtVerhouding ? `- Vraagprijs vs buurtgemiddelde: ${buurtVerhouding}% ${Number(buurtVerhouding) > 0 ? 'boven' : 'onder'} gemiddelde` : ''}
- Bestemmingsplan: ${kad.rpNaam ?? 'Niet beschikbaar'}
- Bestemming: ${kad.rpBestemming ?? '—'} | Hoofdgroep: ${kad.rpHoofdgroep ?? '—'}
- Bestemmingsplan datum: ${kad.rpPlanDatum ?? '—'}
`;

  const systemPrompt = `Je bent een senior vastgoed investment analyst gespecialiseerd in de Nederlandse markt.
Je werkt met officiële data van Kadaster, CBS, BAG en RuimtelijkePlannen.

REKENREGELS (verplicht):
- Gebruik UITSLUITEND de verstrekte cijfers — verzin NOOIT getallen
- Max bod = ARV (indien opgegeven) - verbouwkosten - gewenste winst/buffer, anders vraagprijs als referentie
- ROI = (netto winst / totale investering) × 100
- BAR = (jaarhuur / aankoopprijs) × 100
- HWM = aankoopprijs / jaarhuur
- Noem een strategie "niet haalbaar" als de data ontbreekt, maar geef dan altijd een algemene marktindicatie
- Als bestemmingsplan "gemengd" is: benoem expliciet welke functies dit doorgaans toestaat
- Markeer altijd of de vraagprijs boven/onder WOZ en buurtgemiddelde ligt

BETROUWBAARHEIDSREGELS:
- Baseer rendementsverwachtingen op de aangeleverde CBS/Kadaster data
- Geef bij ontbrekende data expliciet aan dat de schatting onzeker is
- Gebruik Nederlandse marktnormen 2024: NHG-grens €435.000, overdrachtsbelasting belegger 10,4%, vrije sector huurgrens €879/maand`;

  const stream = client.messages.stream({
    model: 'claude-sonnet-4-6',
    max_tokens: 8096,
    temperature: 0.1,
    system: systemPrompt,
    messages: [{
      role: 'user',
      content: `Analyseer het volgende pand en evalueer alle 10 investeringsstrategieën.
Geef output als GELDIG JSON (geen markdown, geen tekst ervoor of erna).

OBJECT DATA:
${context}

EVALUEER deze 10 strategieën:
1. Flip (kopen → renoveren → verkopen)
2. Buy-to-let (kopen → renoveren → verhuren)
3. Splitsen → verkopen per unit
4. Splitsen → verhuren per unit
5. Splitsen → mix (deel verkopen, deel verhuren)
6. Bestemmingswijziging → ontwikkelen → verkopen
7. Bestemmingswijziging → ontwikkelen → verhuren
8. Sloop → nieuwbouw → verkopen/verhuren
9. Transformatie (bijv. kantoor/zorg naar wonen)
10. Optoppen (extra bouwlaag realiseren)

JSON schema (exact volgen):
{
  "samenvatting": "3-4 zinnen: objectomschrijving, marktpositie, kansen en betrouwbaarheid van beschikbare data",
  "databronnen": ["CBS buurtstatistieken", "Kadaster koopsommen"],
  "strategieen": [
    {
      "id": 1,
      "naam": "Flip",
      "haalbaarheid": "haalbaar/beperkt haalbaar/niet haalbaar — 1 zin reden",
      "verwacht_roi": "bijv. 12-18% (gebaseerd op ARV €X vs investering €Y)",
      "verwacht_cashflow": "bijv. eenmalig €45.000 bij verkoop",
      "risico": "laag",
      "doorlooptijd": "bijv. 6-12 maanden",
      "max_bod": "bijv. €280.000",
      "aanbevolen": true,
      "toelichting": "2-3 zinnen waarom wel/niet — gebruik concrete cijfers uit de data"
    }
  ],
  "top3": [
    {"rang": 1, "strategie": "Flip", "reden": "1-2 zinnen met concrete onderbouwing"},
    {"rang": 2, "strategie": "Buy-to-let", "reden": "1-2 zinnen"},
    {"rang": 3, "strategie": "Splitsen verhuren", "reden": "1-2 zinnen"}
  ],
  "aandachtspunten": [
    "Concreet risico of aandachtspunt met bronvermelding",
    "punt 2", "punt 3", "punt 4", "punt 5"
  ],
  "kopen": true,
  "eindadvies": "2-3 zinnen concreet koop/niet-koop advies met onderbouwing vanuit de data"
}

Verplichte regels:
- risico = "laag", "middel" of "hoog" (lowercase, exact)
- Geef voor ALLE 10 strategieën een beoordeling
- max_bod altijd als €-bedrag, niet als percentage
- Verzin GEEN cijfers — gebruik alleen verstrekte data
- Bij ontbrekende data: vermeld dit expliciet in de toelichting`,
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
      } catch (e) { controller.error(e); }
      controller.close();
    },
  });

  return new Response(readable, { headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
}
