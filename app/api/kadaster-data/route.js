// Stap 3/3 — Officiële data ophalen (<8s)
// Alle PDOK/Kadaster calls parallel met korte timeouts
const pFetch = (url, timeout = 4000) =>
  fetch(url, { signal: AbortSignal.timeout(timeout) }).then(r => r.ok ? r.json() : null).catch(() => null);

function cleanAddress(address) {
  let c = address.replace(/\s*[-/]\s*[A-Za-z0-9]+(?:\s*[-/]\s*[A-Za-z0-9]+)*\s*,/g, ',');
  c = c.replace(/(\d+)\s*[-–]\s*[A-Za-z]+/g, '$1');
  c = c.replace(/(\d+)\s*[A-Za-z]{1,2}(?=\s*,|\s*$)/g, '$1');
  return c.trim().replace(/^,+|,+$/g, '').trim();
}

export async function POST(request) {
  try {
    const { address } = await request.json();
    const res = { found: false };

    // Stap 1: Locatieserver (sequentieel — nodig voor rest)
    let doc = null;
    for (const variant of [cleanAddress(address), address]) {
      const enc  = encodeURIComponent(variant);
      const data = await pFetch(
        `https://api.pdok.nl/bzk/locatieserver/search/v3_1/free?q=${enc}&rows=5&fl=id,weergavenaam,type,centroide_ll,adresseerbaarobject_id,nummeraanduiding_id,bouwjaar,oppervlakte_obj,gebruiksdoel,status,straatnaam,huisnummer,postcode,woonplaatsnaam,gemeentenaam,gemeentecode,buurtnaam,wijknaam,provincienaam`,
        5000
      );
      const found = data?.response?.docs ?? [];
      doc = found.find(d => d.type === 'adres') ?? found[0] ?? null;
      if (doc) break;
    }
    if (!doc) return Response.json({ found: false, error: 'Adres niet gevonden' });

    res.found            = true;
    res.official_address = doc.weergavenaam;
    res.official_year    = doc.bouwjaar ?? null;
    res.official_sqm     = doc.oppervlakte_obj ?? null;
    res.bag_id           = doc.adresseerbaarobject_id ?? doc.id;
    res.nummeraanduiding_id = doc.nummeraanduiding_id ?? null;
    res.postcode         = doc.postcode ?? null;
    res.straatnaam       = doc.straatnaam ?? null;
    res.huisnummer       = doc.huisnummer ?? null;
    res.woonplaats       = doc.woonplaatsnaam ?? null;
    res.gemeentenaam     = doc.gemeentenaam ?? null;
    res.gemeentecode     = doc.gemeentecode ?? null;
    res.buurtnaam        = doc.buurtnaam ?? null;
    res.wijknaam         = doc.wijknaam ?? null;
    res.provincienaam    = doc.provincienaam ?? null;
    const usage          = doc.gebruiksdoel ?? '';
    res.usage            = Array.isArray(usage) ? usage.join(', ') : (usage || '—');
    res.status           = doc.status ?? '—';

    const centroid = doc.centroide_ll ?? '';
    if (centroid) {
      const parts = centroid.replace('POINT(', '').replace(')', '').split(' ');
      if (parts.length === 2) {
        res.lon = parseFloat(parts[0]);
        res.lat = parseFloat(parts[1]);
        res.bag_viewer_url = `https://bagviewer.kadaster.nl/?zoomlevel=5&center=${res.lon},${res.lat}`;
      }
    }

    // Stap 2: alle resterende calls PARALLEL (elk max 4s)
    const bagId  = res.bag_id ? res.bag_id.replace(/\D/g, '').padStart(16, '0') : null;
    const nId    = res.nummeraanduiding_id;
    const epKey  = process.env.EP_ONLINE_API_KEY;

    const [bagVbo, wozData, epData, koopData] = await Promise.all([
      // BAG VBO details
      bagId ? pFetch(
        `https://service.pdok.nl/lv/bag/wfs/v2_0?service=WFS&version=2.0.0&request=GetFeature&typeName=bag:verblijfsobject&outputFormat=application/json&count=1&filter=` +
        encodeURIComponent(`<Filter><PropertyIsEqualTo><PropertyName>identificatie</PropertyName><Literal>${bagId}</Literal></PropertyIsEqualTo></Filter>`),
        4000
      ) : Promise.resolve(null),

      // WOZ waarden
      nId ? pFetch(
        `https://api.kadaster.nl/lvwoz/wozwaardeloket-api/v1/wozwaarde/nummeraanduiding/${nId}`,
        4000
      ) : Promise.resolve(null),

      // EP-online energielabel
      epKey && res.postcode && res.huisnummer ? fetch(
        `https://public.ep-online.nl/api/v5/PandEnergielabel/Adres?postcode=${res.postcode.replace(' ', '')}&huisnummer=${res.huisnummer}`,
        { headers: { Authorization: `Bearer ${epKey}` }, signal: AbortSignal.timeout(4000) }
      ).then(r => r.ok ? r.json() : null).catch(() => null) : Promise.resolve(null),

      // Koopsommen (ruim bbox, geen VBO spatial lookups)
      res.lat && res.lon ? (() => {
        const delta = 0.003;
        const bbox  = `${res.lon - delta},${res.lat - delta},${res.lon + delta},${res.lat + delta}`;
        const since = new Date(Date.now() - 3 * 365.25 * 24 * 3600 * 1000).toISOString().slice(0, 10);
        return pFetch(
          `https://api.pdok.nl/kadaster/koopsommen/ogc/v1/collections/koopsommen/items?bbox=${bbox}&datetime=${since}/..&limit=20&sortby=-transactiedatum`,
          4000
        );
      })() : Promise.resolve(null),
    ]);

    // BAG VBO verwerken
    if (bagVbo?.features?.[0]?.properties) {
      const feat = bagVbo.features[0].properties;
      res.official_sqm = feat.oppervlakte ?? res.official_sqm;
      res.status       = feat.status ?? res.status;
      const gd         = feat.gebruiksdoel ?? '';
      res.usage        = Array.isArray(gd) ? gd.join(', ') : (gd || res.usage);
      const pandRef    = feat.pandidentificatie;
      res.pand_id      = Array.isArray(pandRef) ? pandRef[0] : (pandRef ?? null);
    }

    // VBO-telling (snel, al geladen)
    if (res.pand_id) {
      const pandId = res.pand_id.replace(/\D/g, '').padStart(16, '0').slice(0, 16);
      const vboData = await pFetch(
        `https://service.pdok.nl/lv/bag/wfs/v2_0?service=WFS&version=2.0.0&request=GetFeature&typeName=bag:verblijfsobject&outputFormat=application/json&count=20&filter=` +
        encodeURIComponent(`<Filter><PropertyIsEqualTo><PropertyName>pandidentificatie</PropertyName><Literal>${pandId}</Literal></PropertyIsEqualTo></Filter>`),
        4000
      );
      if (vboData?.features) {
        const actief = vboData.features.filter(f => {
          const s = (f.properties?.status ?? '').toLowerCase();
          return !s.includes('ingetrokken') && !s.includes('niet') && !s.includes('gesloopt') && !s.includes('verbouwing');
        });
        const lijst = actief.length > 0 ? actief : vboData.features;
        res.vbo_count = lijst.length || null;
        res.is_split  = lijst.length > 1;
        if (lijst.length > 1) {
          res.vbo_eenheden = lijst
            .map(f => ({
              oppervlakte:  f.properties?.oppervlakte ?? null,
              gebruiksdoel: Array.isArray(f.properties?.gebruiksdoel) ? f.properties.gebruiksdoel.join(', ') : (f.properties?.gebruiksdoel ?? '—'),
              status: f.properties?.status ?? '—',
            }))
            .filter(e => e.oppervlakte)
            .sort((a, b) => (b.oppervlakte ?? 0) - (a.oppervlakte ?? 0));
        }
      }
    }

    // WOZ verwerken
    if (wozData?.wozWaarden?.length > 0) {
      res.woz_waarden = wozData.wozWaarden
        .sort((a, b) => b.peildatum.localeCompare(a.peildatum))
        .slice(0, 5)
        .map(w => ({ jaar: w.peildatum.slice(0, 4), waarde: w.vastgesteldeWaarde }));
      res.woz_huidig = res.woz_waarden[0]?.waarde ?? null;
      res.woz_jaar   = res.woz_waarden[0]?.jaar ?? null;
    }

    // EP-online verwerken
    if (epData) {
      const label = Array.isArray(epData) ? epData[0] : epData;
      if (label?.Energieklasse) {
        res.energy_label       = label.Energieklasse;
        res.energy_label_datum = label.Registratiedatum ?? null;
      }
    }

    // Koopsommen verwerken (zonder BAG VBO spatial lookups)
    if (koopData?.features?.length > 0) {
      res.koopsommen = koopData.features.map(f => ({
        prijs:  f.properties?.koopsom ?? null,
        datum:  f.properties?.transactiedatum ?? null,
        opp:    f.properties?.perceeloppervlakte ?? null,
        coords: f.geometry?.coordinates ?? null,
      })).filter(k => k.prijs);
      if (res.koopsommen.length > 0) {
        res.laatste_koopsom       = res.koopsommen[0].prijs;
        res.laatste_koopsom_datum = res.koopsommen[0].datum;
      }
    }

    return Response.json(res);
  } catch (e) {
    return Response.json({ found: false, error: e.message });
  }
}
