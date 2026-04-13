// Echte vergelijkbare verkopen via PDOK Kadaster koopsommen + reverse geocoding
const pFetch = (url, t = 4000) =>
  fetch(url, { signal: AbortSignal.timeout(t) }).then(r => r.ok ? r.json() : null).catch(() => null);

export async function POST(request) {
  try {
    const { lat, lon } = await request.json();
    if (!lat || !lon) return Response.json({ comps: [] });

    // Koopsommen in straal ~700m, afgelopen 4 jaar, max 20 resultaten
    const d     = 0.007;
    const bbox  = `${lon - d},${lat - d},${lon + d},${lat + d}`;
    const since = new Date(Date.now() - 4 * 365.25 * 24 * 3600 * 1000).toISOString().slice(0, 10);

    const koopData = await pFetch(
      `https://api.pdok.nl/kadaster/koopsommen/ogc/v1/collections/koopsommen/items` +
      `?bbox=${bbox}&datetime=${since}/..&limit=20&sortby=-transactiedatum`,
      7000
    );

    const features = (koopData?.features ?? [])
      .filter(f => f.properties?.koopsom > 0 && f.geometry?.coordinates)
      .slice(0, 10); // neem 10, na enrichment houden we er ~5 met woonoppervlak over

    if (!features.length) return Response.json({ comps: [] });

    // Reverse geocode elk punt parallel — PDOK Locatieserver geeft adres + woonoppervlakte + bouwjaar
    const enriched = await Promise.all(features.map(async f => {
      const [flon, flat] = f.geometry.coordinates;
      const geo = await pFetch(
        `https://api.pdok.nl/bzk/locatieserver/search/v3_1/reverse` +
        `?lat=${flat}&lon=${flon}&rows=1&distance=75&type=adres` +
        `&fl=weergavenaam,oppervlakte_obj,bouwjaar,straatnaam,huisnummer,postcode,woonplaatsnaam`,
        3000
      );
      const doc = geo?.response?.docs?.[0];
      return {
        address:    doc?.weergavenaam ?? null,
        straat:     doc?.straatnaam   ?? null,
        huisnummer: doc?.huisnummer   ?? null,
        postcode:   doc?.postcode     ?? null,
        woonplaats: doc?.woonplaatsnaam ?? null,
        price:      f.properties.koopsom,
        sqm:        doc?.oppervlakte_obj ?? null,
        year_built: doc?.bouwjaar ?? null,
        datum:      f.properties.transactiedatum ?? null,
        opp_perceel: f.properties.perceeloppervlakte ?? null,
      };
    }));

    // Alleen comps met adres én woonoppervlakte (anders onbruikbaar voor €/m² vergelijking)
    const valid = enriched
      .filter(c => c.address && c.sqm > 0)
      .slice(0, 5);

    return Response.json({ comps: valid });
  } catch (e) {
    return Response.json({ comps: [], error: e.message });
  }
}
