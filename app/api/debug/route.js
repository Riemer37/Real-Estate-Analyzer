export async function POST(request) {
  const { address } = await request.json();
  const log = [];

  // Stap 1: PDOK Locatieserver
  const enc = encodeURIComponent(address);
  const locUrl = `https://api.pdok.nl/bzk/locatieserver/search/v3_1/free?q=${enc}&rows=3&fl=id,weergavenaam,type,adresseerbaarobject_id,bouwjaar,oppervlakte_obj,gebruiksdoel,status,postcode`;
  const locR = await fetch(locUrl);
  const locData = await locR.json();
  const doc = locData?.response?.docs?.[0];
  log.push({ stap: '1_locatieserver', doc });

  if (!doc?.adresseerbaarobject_id) return Response.json({ log });

  // Stap 2: VBO WFS
  const bagId = doc.adresseerbaarobject_id.replace(/\D/g, '').padStart(16, '0');
  const vboUrl = `https://service.pdok.nl/lv/bag/wfs/v2_0?service=WFS&version=2.0.0&request=GetFeature&typeName=bag:verblijfsobject&outputFormat=application/json&count=1&filter=` +
    encodeURIComponent(`<Filter><PropertyIsEqualTo><PropertyName>identificatie</PropertyName><Literal>${bagId}</Literal></PropertyIsEqualTo></Filter>`);
  const vboR = await fetch(vboUrl);
  const vboData = await vboR.json();
  const vboFeat = vboData?.features?.[0]?.properties;
  log.push({ stap: '2_vbo_wfs', bagId, properties: vboFeat });

  if (!vboFeat?.pandidentificatie) return Response.json({ log });

  // Stap 3: Alle VBO's in pand
  const pandId = Array.isArray(vboFeat.pandidentificatie)
    ? vboFeat.pandidentificatie[0]
    : vboFeat.pandidentificatie;
  const alleVboUrl = `https://service.pdok.nl/lv/bag/wfs/v2_0?service=WFS&version=2.0.0&request=GetFeature&typeName=bag:verblijfsobject&outputFormat=application/json&count=50&filter=` +
    encodeURIComponent(`<Filter><PropertyIsEqualTo><PropertyName>pandidentificatie</PropertyName><Literal>${pandId}</Literal></PropertyIsEqualTo></Filter>`);
  const alleR = await fetch(alleVboUrl);
  const alleData = await alleR.json();
  const eenheden = alleData?.features?.map(f => ({
    oppervlakte:  f.properties?.oppervlakte,
    gebruiksdoel: f.properties?.gebruiksdoel,
    status:       f.properties?.status,
  }));
  log.push({ stap: '3_alle_vbos_in_pand', pandId, aantal: eenheden?.length, eenheden });

  return Response.json({ log });
}
