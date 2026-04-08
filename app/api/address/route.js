import { lookupKadaster } from '@/lib/kadaster';

export async function POST(request) {
  try {
    const { address } = await request.json();
    if (!address) return Response.json({ error: 'Geen adres opgegeven' }, { status: 400 });

    const kad = await lookupKadaster(address);

    if (!kad.found) {
      return Response.json({ error: kad.error ?? 'Adres niet gevonden' }, { status: 404 });
    }

    const result = {
      address:       kad.official_address,
      price:         0,
      sqm:           kad.official_sqm ?? 0,
      year:          kad.official_year ?? 0,
      energy:        'C',
      condition:     '—',
      property_type: kad.usage?.toLowerCase().includes('wonen') ? 'Appartement/Woning' : (kad.usage || '—'),
      rooms:         0,
      reno_items:    '—',
      reno_cost:     0,
      fair_value:    0,
      monthly_rent:  0,
      risk_score:    5,
      risk_location: 'Medium',
      risk_condition:'Medium',
      risk_market:   'Medium',
      risk_liquidity:'Medium',
      risk_notes:    '',
      comps:         [],
      healthy_margin:15,
      investment_score: 0,
      summary:       'Adresopzoeking via Kadaster BAG — geen listing URL opgegeven.',
      advice:        'Voer een listing URL in voor een volledige investeringsanalyse.',
      full_analysis: `Officieel geregistreerd adres: ${kad.official_address}. Bouwjaar: ${kad.official_year ?? 'onbekend'}. Geregistreerde oppervlakte: ${kad.official_sqm ? kad.official_sqm + ' m²' : 'onbekend'}. Gebruik: ${kad.usage}. Splitsingstatus: ${kad.is_split ? `gesplitst (${kad.vbo_count} eenheden)` : 'niet gesplitst'}.`,
      kadaster:      kad,
      saved_at:      new Date().toLocaleDateString('nl-NL', { day: '2-digit', month: 'short', year: 'numeric' }),
      address_only:  true,
    };

    return Response.json(result);
  } catch (e) {
    return Response.json({ error: e.message }, { status: 500 });
  }
}
