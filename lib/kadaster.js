export async function lookupKadaster(address) {
  const res = { found: false, error: null, bag_viewer_url: 'https://bagviewer.kadaster.nl' };

  try {
    const variants = [
      cleanAddress(address),
      address,
      address.replace(/[^a-zA-Z0-9\s]/g, ' ').trim(),
    ];

    let doc = null;
    for (const variant of variants) {
      const enc = encodeURIComponent(variant);
      const url = `https://api.pdok.nl/bzk/locatieserver/search/v3_1/free?q=${enc}&rows=5&fl=id,weergavenaam,type,centroide_ll,adresseerbaarobject_id,nummeraanduiding_id,bouwjaar,oppervlakte_obj,gebruiksdoel,status,straatnaam,huisnummer,postcode,woonplaatsnaam`;
      const r = await fetch(url, { signal: AbortSignal.timeout(12000) });
      const data = await r.json();
      const found = data?.response?.docs ?? [];
      const adresDocs = found.filter(d => d.type === 'adres');
      doc = adresDocs[0] ?? found[0] ?? null;
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
    res.bag_id           = doc.adresseerbaarobject_id ?? doc.id;
    res.nummeraanduiding_id = doc.nummeraanduiding_id ?? null;
    const usage          = doc.gebruiksdoel ?? '';
    res.usage            = Array.isArray(usage) ? usage.join(', ') : (usage || '—');
    res.status           = doc.status ?? '—';
    res.postcode         = doc.postcode ?? null;
    res.huisnummer       = doc.huisnummer ?? null;
    res.straatnaam       = doc.straatnaam ?? null;
    res.woonplaats       = doc.woonplaatsnaam ?? null;

    // BAG viewer deep link
    const centroid = doc.centroide_ll ?? '';
    if (centroid) {
      const parts = centroid.replace('POINT(', '').replace(')', '').split(' ');
      if (parts.length === 2) {
        res.bag_viewer_url = `https://bagviewer.kadaster.nl/?zoomlevel=5&center=${parts[0]},${parts[1]}`;
        res.lat = parseFloat(parts[1]);
        res.lon = parseFloat(parts[0]);
      }
    }

    // Extra BAG details via verblijfsobject endpoint
    if (res.bag_id) {
      try {
        const bagUrl = `https://api.bag.kadaster.nl/lvbag/individuelebevragingen/v2/verblijfsobjecten/${res.bag_id}`;
        const bagR = await fetch(bagUrl, {
          headers: { 'X-Api-Key': 'l7xx08f5fc30ea074d1ba4d9e0b33c6bda37' },
          signal: AbortSignal.timeout(8000)
        });
        if (bagR.ok) {
          const bagData = await bagR.json();
          const vbo = bagData?.verblijfsobject ?? bagData;
          res.official_sqm  = vbo?.oppervlakte ?? res.official_sqm;
          res.usage         = vbo?.gebruiksdoelen?.join(', ') ?? res.usage;
          res.status        = vbo?.status ?? res.status;
          const pandRef     = vbo?.maaktDeelUitVan?.[0]?.identificatie;
          if (pandRef) {
            res.pand_id = pandRef;
            // Get pand (building) details for bouwjaar
            const pandR = await fetch(`https://api.bag.kadaster.nl/lvbag/individuelebevragingen/v2/panden/${pandRef}`, {
              headers: { 'X-Api-Key': 'l7xx08f5fc30ea074d1ba4d9e0b33c6bda37' },
              signal: AbortSignal.timeout(8000)
            });
            if (pandR.ok) {
              const pandData = await pandR.json();
              res.official_year = pandData?.pand?.oorspronkelijkBouwjaar ?? res.official_year;
              res.pand_status   = pandData?.pand?.status ?? null;
            }
            // Count VBOs in same pand for split detection
            const vboListR = await fetch(`https://api.bag.kadaster.nl/lvbag/individuelebevragingen/v2/verblijfsobjecten?pandIdentificatie=${pandRef}&pageSize=20`, {
              headers: { 'X-Api-Key': 'l7xx08f5fc30ea074d1ba4d9e0b33c6bda37' },
              signal: AbortSignal.timeout(8000)
            });
            if (vboListR.ok) {
              const vboList = await vboListR.json();
              const count = vboList?._embedded?.verblijfsobjecten?.length ?? vboList?.totaalAantal ?? null;
              res.vbo_count = count;
              res.is_split  = count > 1;
            }
          }
        }
      } catch {
        // BAG API individuele bevragingen failed, fall back to PDOK split detection
        await detectSplitViaPdok(res);
      }
    }

    // Fallback split detection if not yet set
    if (res.vbo_count === undefined) {
      await detectSplitViaPdok(res);
    }

  } catch (e) {
    res.error = `PDOK fout: ${e.message}`;
  }
  return res;
}

async function detectSplitViaPdok(res) {
  try {
    const pcMatch = res.official_address?.match(/\b(\d{4}\s?[A-Z]{2})\b/);
    if (pcMatch) {
      const pc = pcMatch[1].replace(' ', '');
      const pandUrl = `https://api.pdok.nl/bzk/locatieserver/search/v3_1/free?q=${pc}&rows=50&fl=id,weergavenaam,adresseerbaarobject_id`;
      const pr = await fetch(pandUrl, { signal: AbortSignal.timeout(10000) });
      const pandData = await pr.json();
      const pandDocs = pandData?.response?.docs ?? [];
      const baseMatch = res.official_address.match(/^(.*?\d+)/);
      const base = baseMatch ? baseMatch[1].toLowerCase() : '';
      const sameBuilding = pandDocs.filter(d => d.weergavenaam?.toLowerCase().includes(base));
      res.vbo_count = sameBuilding.length || null;
      res.is_split  = sameBuilding.length > 1;
    } else {
      res.vbo_count = null;
      res.is_split  = false;
    }
  } catch {
    res.vbo_count = null;
    res.is_split  = false;
  }
}

function cleanAddress(address) {
  let clean = address.replace(/\s*[-/]\s*[A-Za-z0-9]+(?:\s*[-/]\s*[A-Za-z0-9]+)*\s*,/g, ',');
  clean = clean.replace(/(\d+)\s*[-–]\s*[A-Za-z]+/g, '$1');
  clean = clean.replace(/(\d+)\s*[A-Za-z]{1,2}(?=\s*,|\s*$)/g, '$1');
  return clean.trim().replace(/^,+|,+$/g, '').trim();
}
