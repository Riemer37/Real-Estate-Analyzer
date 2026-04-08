export async function lookupKadaster(address) {
  const res = { found: false, error: null, bag_viewer_url: 'https://bagviewer.kadaster.nl' };

  try {
    // Stap 1: adres opzoeken via PDOK Locatieserver
    const variants = [cleanAddress(address), address, address.replace(/[^a-zA-Z0-9\s]/g, ' ').trim()];
    let doc = null;
    for (const variant of variants) {
      const enc = encodeURIComponent(variant);
      const url = `https://api.pdok.nl/bzk/locatieserver/search/v3_1/free?q=${enc}&rows=5&fl=id,weergavenaam,type,centroide_ll,adresseerbaarobject_id,nummeraanduiding_id,bouwjaar,oppervlakte_obj,gebruiksdoel,status,straatnaam,huisnummer,postcode,woonplaatsnaam,gemeentenaam,gemeentecode,buurtnaam,wijknaam,provincienaam,gekoppeld_perceel`;
      const r = await fetch(url, { signal: AbortSignal.timeout(12000) });
      const data = await r.json();
      const found = data?.response?.docs ?? [];
      doc = found.find(d => d.type === 'adres') ?? found[0] ?? null;
      if (doc) break;
    }

    if (!doc) {
      res.error = 'Adres niet gevonden in PDOK — probeer handmatig te zoeken';
      return res;
    }

    res.found            = true;
    res.official_address = doc.weergavenaam ?? address;
    res.official_year    = doc.bouwjaar ?? null;
    res.official_sqm     = doc.oppervlakte_obj ?? null;
    res.bag_id               = doc.adresseerbaarobject_id ?? doc.id;
    res.nummeraanduiding_id  = doc.nummeraanduiding_id ?? null;
    res.postcode             = doc.postcode ?? null;
    res.straatnaam           = doc.straatnaam ?? null;
    res.huisnummer           = doc.huisnummer ?? null;
    res.woonplaats       = doc.woonplaatsnaam ?? null;
    res.gemeentenaam     = doc.gemeentenaam ?? null;
    res.gemeentecode     = doc.gemeentecode ?? null;
    res.buurtnaam        = doc.buurtnaam ?? null;
    res.wijknaam         = doc.wijknaam ?? null;
    res.provincienaam    = doc.provincienaam ?? null;
    res.gekoppeld_perceel = Array.isArray(doc.gekoppeld_perceel)
      ? doc.gekoppeld_perceel[0] : (doc.gekoppeld_perceel ?? null);
    const usage          = doc.gebruiksdoel ?? '';
    res.usage            = Array.isArray(usage) ? usage.join(', ') : (usage || '—');
    res.status           = doc.status ?? '—';

    // BAG viewer deep link + coördinaten opslaan
    const centroid = doc.centroide_ll ?? '';
    if (centroid) {
      const parts = centroid.replace('POINT(', '').replace(')', '').split(' ');
      if (parts.length === 2) {
        res.lon = parseFloat(parts[0]);
        res.lat = parseFloat(parts[1]);
        res.bag_viewer_url = `https://bagviewer.kadaster.nl/?zoomlevel=5&center=${res.lon},${res.lat}`;
      }
    }

    // Stap 2: BAG WFS — haal VBO details op via BAG identificatie
    if (res.bag_id) {
      try {
        const bagId = res.bag_id.replace(/\D/g, '').padStart(16, '0');
        const wfsUrl = `https://service.pdok.nl/lv/bag/wfs/v2_0?service=WFS&version=2.0.0&request=GetFeature&typeName=bag:verblijfsobject&outputFormat=application/json&count=1&filter=` +
          encodeURIComponent(`<Filter><PropertyIsEqualTo><PropertyName>identificatie</PropertyName><Literal>${bagId}</Literal></PropertyIsEqualTo></Filter>`);
        const wfsR = await fetch(wfsUrl, { signal: AbortSignal.timeout(10000) });
        if (wfsR.ok) {
          const wfsData = await wfsR.json();
          const feat = wfsData?.features?.[0]?.properties;
          if (feat) {
            res.official_sqm = feat.oppervlakte ?? res.official_sqm;
            res.status       = feat.status ?? res.status;
            const gd         = feat.gebruiksdoel ?? feat.gebruiksdoelen ?? '';
            res.usage        = Array.isArray(gd) ? gd.join(', ') : (gd || res.usage);
            // pandidentificatie kan een array zijn — pak altijd de eerste
            const pandRef    = feat.pandidentificatie;
            res.pand_id      = Array.isArray(pandRef) ? pandRef[0] : (pandRef ?? null);
          }
        }
      } catch { /* gebruik Locatieserver data als fallback */ }
    }

    // Stap 3: pand-details + alle VBO's — ALLEEN als we een bevestigd pand-ID hebben
    if (res.pand_id) {
      try {
        const pandId = res.pand_id.replace(/\D/g, '').padStart(16, '0').slice(0, 16);

        // Bouwjaar uit pand WFS
        const pandWfsUrl = `https://service.pdok.nl/lv/bag/wfs/v2_0?service=WFS&version=2.0.0&request=GetFeature&typeName=bag:pand&outputFormat=application/json&count=1&filter=` +
          encodeURIComponent(`<Filter><PropertyIsEqualTo><PropertyName>identificatie</PropertyName><Literal>${pandId}</Literal></PropertyIsEqualTo></Filter>`);
        const pandR = await fetch(pandWfsUrl, { signal: AbortSignal.timeout(10000) });
        if (pandR.ok) {
          const pf = (await pandR.json())?.features?.[0]?.properties;
          if (pf) {
            res.official_year = pf.bouwjaar ?? res.official_year;
            res.pand_status   = pf.status ?? null;
          }
        }

        // Alle VBO's in dit pand — filter op actieve eenheden
        const vboWfsUrl = `https://service.pdok.nl/lv/bag/wfs/v2_0?service=WFS&version=2.0.0&request=GetFeature&typeName=bag:verblijfsobject&outputFormat=application/json&count=50&filter=` +
          encodeURIComponent(`<Filter><PropertyIsEqualTo><PropertyName>pandidentificatie</PropertyName><Literal>${pandId}</Literal></PropertyIsEqualTo></Filter>`);
        const vboR = await fetch(vboWfsUrl, { signal: AbortSignal.timeout(10000) });
        if (vboR.ok) {
          const features = (await vboR.json())?.features ?? [];
          // Filter op actieve eenheden — vermijd historische/gesloopte registraties
          const actief = features.filter(f => {
            const s = (f.properties?.status ?? '').toLowerCase();
            return !s.includes('ingetrokken') && !s.includes('niet') && !s.includes('gesloopt') && !s.includes('verbouwing');
          });
          const lijst = actief.length > 0 ? actief : features;
          res.vbo_count = lijst.length || null;
          res.is_split  = lijst.length > 1;
          if (lijst.length > 1) {
            res.vbo_eenheden = lijst
              .map(f => ({
                oppervlakte:  f.properties?.oppervlakte ?? null,
                gebruiksdoel: Array.isArray(f.properties?.gebruiksdoel)
                  ? f.properties.gebruiksdoel.join(', ')
                  : (f.properties?.gebruiksdoel ?? '—'),
                status: f.properties?.status ?? '—',
              }))
              .filter(e => e.oppervlakte)               // alleen eenheden mét oppervlakte
              .sort((a, b) => (b.oppervlakte ?? 0) - (a.oppervlakte ?? 0));
          }
        }
      } catch { await detectSplitViaPdok(res); }
    }

    if (res.vbo_count === undefined) await detectSplitViaPdok(res);

    // Stap 4: Monumentenstatus via PDOK RCE
    if (res.lat && res.lon) {
      try {
        const d2   = 0.0004;
        const bbox = `${res.lon - d2},${res.lat - d2},${res.lon + d2},${res.lat + d2}`;

        // Rijksmonumenten (punten)
        const monR = await fetch(
          `https://api.pdok.nl/rce/beschermde-gebieden-cultuurhistorie/ogc/v1/collections/rce_inspire_points/items?bbox=${bbox}&f=json&limit=10`,
          { signal: AbortSignal.timeout(8000) }
        );
        if (monR.ok) {
          const features = (await monR.json())?.features ?? [];
          const rijks = features.filter(f => f.properties?.designation?.includes('fc966a68'));
          res.is_rijksmonument  = rijks.length > 0;
          res.monument_url      = rijks[0]?.properties?.ci_citation ?? null;
          res.monument_nummer   = res.monument_url?.split('/').pop() ?? null;
        }

        // Beschermd stads-/dorpsgezicht (vlakken)
        const gezR = await fetch(
          `https://api.pdok.nl/rce/beschermde-gebieden-cultuurhistorie/ogc/v1/collections/rce_inspire_polygons/items?bbox=${bbox}&f=json&limit=5`,
          { signal: AbortSignal.timeout(8000) }
        );
        if (gezR.ok) {
          res.is_beschermd_gezicht = ((await gezR.json())?.features?.length ?? 0) > 0;
        }
      } catch { res.is_rijksmonument = null; }
    }

    // Stap 5: Ruimtelijkeplannen — bestemmingsplan via DSO API (optioneel: DSO_API_KEY)
    const dsoKey = process.env.DSO_API_KEY;
    if (dsoKey && res.lat && res.lon) {
      try {
        const rp = await fetch(
          `https://ruimte.omgevingswet.overheid.nl/ruimtelijke-plannen/api/opvragen/v4/plannen?lat=${res.lat}&lon=${res.lon}`,
          { headers: { 'X-Api-Key': dsoKey }, signal: AbortSignal.timeout(10000) }
        );
        if (rp.ok) {
          const rpData = await rp.json();
          const plan   = rpData?._embedded?.plannen?.[0];
          if (plan) {
            res.bestemmingsplan_naam   = plan.naam ?? null;
            res.bestemmingsplan_status = plan.planstatusInfo?.planstatus ?? null;
            res.bestemmingsplan_datum  = plan.planstatusInfo?.datum ?? null;
            res.bestemmingsplan_url    = plan._links?.self?.href ?? null;
          }
        }
      } catch { /* bestemmingsplan niet beschikbaar */ }
    }

    // Stap 6: Koopsommen — historische transactieprijzen via PDOK
    // Gebruik perceelnummer voor exactere match indien beschikbaar
    if (res.lat && res.lon) {
      try {
        const delta = 0.00025; // verkleind voor nauwkeurigere buurtmatch
        const bbox  = `${res.lon - delta},${res.lat - delta},${res.lon + delta},${res.lat + delta}`;
        const koopUrl = `https://api.pdok.nl/kadaster/koopsommen/ogc/v1/collections/koopsommen/items?bbox=${bbox}&limit=8&sortby=-transactiedatum`;
        const koopR = await fetch(koopUrl, { signal: AbortSignal.timeout(10000) });
        if (koopR.ok) {
          const koopData = await koopR.json();
          const items = koopData?.features ?? [];
          res.koopsommen = items.map(f => ({
            prijs:  f.properties?.koopsom ?? null,
            datum:  f.properties?.transactiedatum ?? null,
            opp:    f.properties?.perceeloppervlakte ?? null,
          })).filter(k => k.prijs);
          if (res.koopsommen.length > 0) {
            res.laatste_koopsom  = res.koopsommen[0].prijs;
            res.laatste_koopsom_datum = res.koopsommen[0].datum;
          }
        }
      } catch { /* koopsommen niet beschikbaar */ }
    }

    // Stap 6: WOZ-waarden via Kadaster LV WOZ (geen API key nodig)
    if (res.nummeraanduiding_id) {
      try {
        const wozUrl = `https://api.kadaster.nl/lvwoz/wozwaardeloket-api/v1/wozwaarde/nummeraanduiding/${res.nummeraanduiding_id}`;
        const wozR = await fetch(wozUrl, { signal: AbortSignal.timeout(10000) });
        if (wozR.ok) {
          const wozData = await wozR.json();
          const waarden = wozData?.wozWaarden ?? [];
          if (waarden.length > 0) {
            res.woz_waarden = waarden
              .sort((a, b) => b.peildatum.localeCompare(a.peildatum))
              .slice(0, 5)
              .map(w => ({ jaar: w.peildatum.slice(0, 4), waarde: w.vastgesteldeWaarde }));
            res.woz_huidig = res.woz_waarden[0]?.waarde ?? null;
            res.woz_jaar   = res.woz_waarden[0]?.jaar ?? null;
          }
        }
      } catch { /* WOZ niet beschikbaar */ }
    }

    // Stap 7: Energielabel via EP-online (vereist EP_ONLINE_API_KEY env var)
    const epKey = process.env.EP_ONLINE_API_KEY;
    if (epKey && res.postcode && res.huisnummer) {
      try {
        const epUrl = `https://public.ep-online.nl/api/v5/PandEnergielabel/Adres?postcode=${res.postcode.replace(' ', '')}&huisnummer=${res.huisnummer}`;
        const epR = await fetch(epUrl, {
          headers: { Authorization: `Bearer ${epKey}` },
          signal: AbortSignal.timeout(10000),
        });
        if (epR.ok) {
          const epData = await epR.json();
          const label = Array.isArray(epData) ? epData[0] : epData;
          if (label?.Energieklasse) {
            res.energy_label       = label.Energieklasse;
            res.energy_label_datum = label.Registratiedatum ?? null;
          }
        }
      } catch { /* EP-online niet beschikbaar */ }
    }

  } catch (e) {
    res.error = `PDOK fout: ${e.message}`;
  }
  return res;
}

async function detectSplitViaPdok(res) {
  try {
    const pcMatch = res.official_address?.match(/\b(\d{4}\s?[A-Z]{2})\b/);
    if (!pcMatch) { res.vbo_count = null; res.is_split = false; return; }
    const pc = pcMatch[1].replace(' ', '');
    const pr = await fetch(`https://api.pdok.nl/bzk/locatieserver/search/v3_1/free?q=${pc}&rows=50&fl=id,weergavenaam`, { signal: AbortSignal.timeout(10000) });
    const pd = await pr.json();
    const docs = pd?.response?.docs ?? [];
    const baseMatch = res.official_address.match(/^(.*?\d+)/);
    const base = baseMatch ? baseMatch[1].toLowerCase() : '';
    const same = docs.filter(d => d.weergavenaam?.toLowerCase().includes(base));
    res.vbo_count = same.length || null;
    res.is_split  = same.length > 1;
  } catch { res.vbo_count = null; res.is_split = false; }
}

function cleanAddress(address) {
  let clean = address.replace(/\s*[-/]\s*[A-Za-z0-9]+(?:\s*[-/]\s*[A-Za-z0-9]+)*\s*,/g, ',');
  clean = clean.replace(/(\d+)\s*[-–]\s*[A-Za-z]+/g, '$1');
  clean = clean.replace(/(\d+)\s*[A-Za-z]{1,2}(?=\s*,|\s*$)/g, '$1');
  return clean.trim().replace(/^,+|,+$/g, '').trim();
}
