export async function lookupKadaster(address) {
  const res = { found: false, error: null, bag_viewer_url: 'https://bagviewer.kadaster.nl' };

  try {
    const variants = [
      cleanAddress(address),
      address,
      address.replace(/[^a-zA-Z0-9\s]/g, ' ').trim(),
    ];

    let docs = [];
    for (const variant of variants) {
      const enc = encodeURIComponent(variant);
      const url = `https://api.pdok.nl/bzk/locatieserver/search/v3_1/free?q=${enc}&rows=3&fl=id,weergavenaam,type,centroide_ll,adresseerbaarobject_id,nummeraanduiding_id,bouwjaar,oppervlakte_obj,gebruiksdoel,status`;
      const r = await fetch(url, { signal: AbortSignal.timeout(12000) });
      const data = await r.json();
      const found = data?.response?.docs ?? [];
      docs = found.filter(d => d.type === 'adres').length ? found.filter(d => d.type === 'adres') : found;
      if (docs.length) break;
    }

    if (!docs.length) {
      res.error = 'Address not found in PDOK — try searching manually';
      return res;
    }

    const doc = docs[0];
    res.found            = true;
    res.official_address = doc.weergavenaam ?? address;
    res.official_year    = doc.bouwjaar;
    res.official_sqm     = doc.oppervlakte_obj;
    res.bag_id           = doc.adresseerbaarobject_id ?? doc.id;
    const usage          = doc.gebruiksdoel ?? '';
    res.usage            = Array.isArray(usage) ? usage.join(', ') : (usage || '—');
    res.status           = doc.status ?? '—';

    const centroid = doc.centroide_ll ?? '';
    if (centroid) {
      const parts = centroid.replace('POINT(', '').replace(')', '').split(' ');
      if (parts.length === 2) {
        res.bag_viewer_url = `https://bagviewer.kadaster.nl/?zoomlevel=5&center=${parts[0]},${parts[1]}`;
      }
    }

    if (res.bag_id) {
      const pcMatch = res.official_address.match(/\b(\d{4}\s?[A-Z]{2})\b/);
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
    }
  } catch (e) {
    res.error = `PDOK error: ${e.message}`;
  }
  return res;
}

function cleanAddress(address) {
  let clean = address.replace(/\s*[-/]\s*[A-Za-z0-9]+(?:\s*[-/]\s*[A-Za-z0-9]+)*\s*,/g, ',');
  clean = clean.replace(/(\d+)\s*[-–]\s*[A-Za-z]+/g, '$1');
  clean = clean.replace(/(\d+)\s*[A-Za-z]{1,2}(?=\s*,|\s*$)/g, '$1');
  return clean.trim().replace(/^,+|,+$/g, '').trim();
}
