// Echte vergelijkbare verkopen via PDOK Kadaster koopsommen + reverse geocoding
const pFetch = (url, t = 4000) =>
  fetch(url, { signal: AbortSignal.timeout(t) }).then(r => r.ok ? r.json() : null).catch(() => null);

// Woonoppervlakte via BAG WFS op basis van coördinaten (betrouwbaarder dan Locatieserver)
async function fetchSqmFromBag(lon, lat) {
  const d = 0.0002;
  const bbox = `${lon - d},${lat - d},${lon + d},${lat + d}`;
  const data = await pFetch(
    `https://service.pdok.nl/lv/bag/wfs/v2_0?service=WFS&version=2.0.0&request=GetFeature` +
    `&typeName=bag:verblijfsobject&outputFormat=application/json&count=1` +
    `&bbox=${bbox}`,
    3000
  );
  return data?.features?.[0]?.properties?.oppervlakte ?? null;
}

export async function POST(request) {
  try {
    const { lat, lon } = await request.json();
    if (!lat || !lon) return Response.json({ comps: [] });

    // Koopsommen in straal ~1km, afgelopen 5 jaar, max 25 resultaten
    const d     = 0.010;
    const bbox  = `${lon - d},${lat - d},${lon + d},${lat + d}`;
    const since = new Date(Date.now() - 5 * 365.25 * 24 * 3600 * 1000).toISOString().slice(0, 10);

    const koopData = await pFetch(
      `https://api.pdok.nl/kadaster/koopsommen/ogc/v1/collections/koopsommen/items` +
      `?bbox=${bbox}&datetime=${since}/..&limit=25&sortby=-transactiedatum`,
      8000
    );

    const features = (koopData?.features ?? [])
      .filter(f => f.properties?.koopsom > 0 && f.geometry?.coordinates)
      .slice(0, 10);

    if (!features.length) return Response.json({ comps: [] });

    // Reverse geocode + BAG sqm parallel per feature
    const enriched = await Promise.all(features.map(async f => {
      const [flon, flat] = f.geometry.coordinates;

      // Locatieserver reverse: adres + bouwjaar
      const geo = await pFetch(
        `https://api.pdok.nl/bzk/locatieserver/search/v3_1/reverse` +
        `?lat=${flat}&lon=${flon}&rows=1&distance=100&type=adres` +
        `&fl=weergavenaam,oppervlakte_obj,bouwjaar,postcode,woonplaatsnaam`,
        3000
      );
      const doc = geo?.response?.docs?.[0];

      // oppervlakte_obj uit Locatieserver, anders probeer BAG WFS
      let sqm = doc?.oppervlakte_obj ?? null;
      if (!sqm) sqm = await fetchSqmFromBag(flon, flat);

      return {
        address:    doc?.weergavenaam ?? null,
        postcode:   doc?.postcode     ?? null,
        woonplaats: doc?.woonplaatsnaam ?? null,
        price:      f.properties.koopsom,
        sqm,
        year_built: doc?.bouwjaar ?? null,
        datum:      f.properties.transactiedatum ?? null,
        opp_perceel: f.properties.perceeloppervlakte ?? null,
      };
    }));

    // Minimumeis: alleen een adres nodig — sqm mag ontbreken
    const valid = enriched
      .filter(c => c.address && c.price > 0)
      .slice(0, 5);

    return Response.json({ comps: valid });
  } catch (e) {
    return Response.json({ comps: [], error: e.message });
  }
}
