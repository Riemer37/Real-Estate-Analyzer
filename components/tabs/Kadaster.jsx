'use client';
import { useState, useEffect } from 'react';
import { fmt } from '@/lib/utils';

export default function Kadaster({ d }) {
  const kad = d.kadaster ?? {};
  const bagLink = kad.bag_viewer_url
    ? <a href={kad.bag_viewer_url} target="_blank" rel="noreferrer">Open BAG viewer ↗</a>
    : null;

  const subjectPpm = Math.floor(d.price / Math.max(d.sqm, 1));

  // Echte Kadaster comps — lazy geladen op basis van coördinaten
  const [comps,        setComps]        = useState(null);
  const [compsLoading, setCompsLoading] = useState(false);

  useEffect(() => {
    if (!kad.lat || !kad.lon || comps !== null) return;
    setCompsLoading(true);
    fetch('/api/comps', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ lat: kad.lat, lon: kad.lon }),
    })
      .then(r => r.json())
      .then(data => setComps(data.comps ?? []))
      .catch(() => setComps([]))
      .finally(() => setCompsLoading(false));
  }, [kad.lat, kad.lon]);

  return (
    <>
      {d.structured_source && (
        <div className="note note-g" style={{ marginBottom: 12, fontSize: 11 }}>
          {typeof d.structured_source === 'object'
            ? <>Gestructureerde Funda-data direct uitgelezen:&nbsp;
                {Object.entries(d.structured_source).filter(([k]) => k !== 'erfpacht').map(([k, v]) =>
                  <span key={k} style={{ marginRight: 10 }}><strong>{k}</strong>: {String(v)}</span>)}</>
            : `Databron: ${d.structured_source}`}
        </div>
      )}
      <div className="card">
        <div className="card-title">Officiële Kadaster BAG-gegevens &nbsp; {bagLink}</div>
        {kad.found ? (
          <>
            <div className="kad-grid">
              {[
                ['Officieel adres',       kad.official_address ?? '—',                                         '',     'Via PDOK Locatieserver'],
                ['Geregistreerde opp.',   kad.official_sqm ? `${kad.official_sqm} m²` : '—',                  '',     'Uit BAG verblijfsobject'],
                ['Officieel bouwjaar',    kad.official_year ? String(kad.official_year) : '—',                 '',     'Uit BAG pandregister'],
                ['Geregistreerd gebruik', kad.usage ?? '—',                                                    '',     'Gebruiksdoel'],
                ['BAG-status',            kad.status ?? '—',                                                   '',     'Huidige registratiestatus'],
                ['Splitsingstatus',       kad.is_split ? `${kad.vbo_count} eenheden — gesplitst` : kad.vbo_count != null ? 'Enkelvoudig — niet gesplitst' : 'Kon niet bepalen', kad.is_split ? 'warn' : '', 'VBO-telling in pand'],
                ['Rijksmonument',         kad.is_rijksmonument === true ? `Ja — nr. ${kad.monument_nummer}` : kad.is_rijksmonument === false ? 'Nee' : 'Niet bepaald', kad.is_rijksmonument ? 'warn' : '', 'RCE monumentenregister'],
                ['Beschermd gezicht',     kad.is_beschermd_gezicht === true ? 'Ja — beschermd stads-/dorpsgezicht' : kad.is_beschermd_gezicht === false ? 'Nee' : 'Niet bepaald', kad.is_beschermd_gezicht ? 'warn' : '', 'RCE erfgoedregister'],
              ].map(([lbl, val, cls, sub]) => (
                <div className={`kad-box ${cls}`} key={lbl}>
                  <div className="kad-lbl">{lbl}</div>
                  <div className={`kad-val ${cls ? 'warn' : ''}`}>{val}</div>
                  <div className="kad-sub">{sub}</div>
                </div>
              ))}
            </div>

            {/* WOZ-waarden */}
            {kad.woz_waarden?.length > 0 && (
              <div style={{ marginTop: 14 }}>
                <div style={{ fontSize: 9, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.1em', color: '#C0BDB8', marginBottom: 8 }}>
                  WOZ-waarden (Gemeente) &nbsp;
                  <a href="https://www.wozwaardeloket.nl" target="_blank" rel="noreferrer" style={{ color: '#60A5FA', fontWeight: 400 }}>WOZ-loket ↗</a>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5,1fr)', gap: 8 }}>
                  {kad.woz_waarden.map((w, i) => (
                    <div key={i} className={`kad-box ${i === 0 ? 'blue' : ''}`}>
                      <div className="kad-lbl">WOZ {w.jaar}</div>
                      <div className={`kad-val ${i === 0 ? 'blue' : ''}`}>{fmt(w.waarde)}</div>
                    </div>
                  ))}
                </div>
                {kad.woz_huidig && (
                  <div className="note note-b" style={{ marginTop: 8 }}>
                    Huidige WOZ-waarde ({kad.woz_jaar}): <strong>{fmt(kad.woz_huidig)}</strong>
                    {kad.official_sqm ? ` · ${fmt(Math.round(kad.woz_huidig / kad.official_sqm))}/m²` : ''}
                  </div>
                )}
              </div>
            )}

            {/* Energielabel */}
            {kad.energy_label && (
              <div style={{ marginTop: 14 }}>
                <div style={{ fontSize: 9, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.1em', color: '#C0BDB8', marginBottom: 8 }}>Energielabel (EP-online / RVO)</div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <span className={`eb eb-${kad.energy_label}`} style={{ fontSize: 18, padding: '4px 14px' }}>{kad.energy_label}</span>
                  <span style={{ fontSize: 12, color: '#A1A1AA' }}>
                    Geregistreerd energielabel{kad.energy_label_datum ? ` · ${kad.energy_label_datum}` : ''}
                  </span>
                </div>
              </div>
            )}

            {/* Koopsommen */}
            {kad.koopsommen?.length > 0 && (
              <div style={{ marginTop: 14 }}>
                <div style={{ fontSize: 9, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.1em', color: '#C0BDB8', marginBottom: 8 }}>Historische transactieprijzen (Kadaster)</div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 8 }}>
                  {kad.koopsommen.slice(0, 3).map((k, i) => (
                    <div key={i} className="kad-box">
                      <div className="kad-lbl">Koopsom {k.datum ? new Date(k.datum).getFullYear() : '—'}</div>
                      <div className="kad-val">{fmt(k.prijs)}</div>
                      <div className="kad-sub">{k.datum ?? '—'}{k.opp ? ` · ${k.opp} m² perceel` : ''}</div>
                    </div>
                  ))}
                </div>
                {kad.laatste_koopsom && (
                  <div className="note note-b" style={{ marginTop: 8 }}>
                    Laatste geregistreerde koopsom: <strong>{fmt(kad.laatste_koopsom)}</strong>
                    {kad.laatste_koopsom_datum ? ` (${kad.laatste_koopsom_datum})` : ''}
                  </div>
                )}
              </div>
            )}

            {/* Eenheden per VBO bij gesplitst pand */}
            {kad.is_split && kad.vbo_eenheden?.length > 0 && (
              <div style={{ marginTop: 14 }}>
                <div style={{ fontSize: 9, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.1em', color: '#C0BDB8', marginBottom: 8 }}>
                  Oppervlakte per eenheid ({kad.vbo_count} VBO's in dit pand)
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 8 }}>
                  {kad.vbo_eenheden.map((v, i) => (
                    <div key={i} className="kad-box">
                      <div className="kad-lbl">Eenheid {i + 1}</div>
                      <div className="kad-val">{v.oppervlakte ? `${v.oppervlakte} m²` : '—'}</div>
                      <div className="kad-sub">{v.gebruiksdoel} · {v.status}</div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {kad.is_split
              ? <div className="note note-y" style={{ marginTop: 10 }}>Dit pand heeft {kad.vbo_count} geregistreerde eenheden — het is al gesplitst. Controleer eigendom en vergunningen zorgvuldig voor het bieden.</div>
              : d.sqm >= 100
                ? <div className="note note-b" style={{ marginTop: 10 }}>Enkelvoudige registratie. Bij {d.sqm}m² kan splitsing in 2 appartementen haalbaar zijn — check bestemmingsplan bij de gemeente.</div>
                : <div className="note note-g" style={{ marginTop: 10 }}>Enkelvoudige registratie — geen splitsingscomplexiteit.</div>
            }
            {kad.is_rijksmonument && (
              <div className="note note-r" style={{ marginTop: 10 }}>
                Rijksmonument nr. {kad.monument_nummer} — verbouwingen vereisen vergunning van de gemeente én goedkeuring RCE. Kosten en doorlooptijd aanzienlijk hoger.
                {kad.monument_url && <> <a href={kad.monument_url} target="_blank" rel="noreferrer" style={{ color: '#991B1B' }}>Bekijk register ↗</a></>}
              </div>
            )}
            {!kad.is_rijksmonument && kad.is_beschermd_gezicht && (
              <div className="note note-y" style={{ marginTop: 10 }}>
                Pand ligt in beschermd stads-/dorpsgezicht — uitwendige wijzigingen vereisen een omgevingsvergunning en welstandsadvies.
              </div>
            )}
            {kad.bestemmingsplan_naam && (
              <div className="note note-n" style={{ marginTop: 8, fontSize: 11 }}>
                Bestemmingsplan: <strong>{kad.bestemmingsplan_naam}</strong> · {kad.bestemmingsplan_status ?? '—'} · {kad.bestemmingsplan_datum ?? '—'}
                {kad.bestemmingsplan_url && <> · <a href={kad.bestemmingsplan_url} target="_blank" rel="noreferrer" style={{ color: '#374151' }}>Bekijk plan ↗</a></>}
              </div>
            )}
            {kad.bag_id && <div className="note note-n" style={{ fontSize: 11, marginTop: 8 }}>BAG object-ID: <code>{kad.bag_id}</code></div>}
          </>
        ) : (
          <>
            <div className="note note-y">⚠️ {kad.error ?? 'Adres niet gevonden'}. <a href="https://bagviewer.kadaster.nl" target="_blank" rel="noreferrer" style={{ color: '#2563EB' }}>Handmatig zoeken ↗</a></div>
            <div style={{ marginTop: 16, fontSize: 13, color: '#52525B', lineHeight: 1.8 }}>
              <strong>Handmatig opzoeken:</strong><br />
              1. Ga naar <a href="https://bagviewer.kadaster.nl" target="_blank" rel="noreferrer" style={{ color: '#2563EB' }}>bagviewer.kadaster.nl</a><br />
              2. Typ het adres in het zoekvak<br />
              3. Klik op het pand voor splitsingstatus, oppervlakte en bouwdetails
            </div>
          </>
        )}
      </div>

      <div className="card">
        <div className="card-title">
          Vergelijkbare verkopen in de buurt
          <span style={{ fontSize: 10, fontWeight: 400, color: '#A1A1AA', marginLeft: 8 }}>Kadaster — werkelijke transacties</span>
        </div>

        {compsLoading && (
          <div style={{ padding: '18px 0', textAlign: 'center', fontSize: 12, color: '#A1A1AA' }}>
            Kadaster transacties ophalen…
          </div>
        )}

        {!compsLoading && comps === null && !kad.lat && (
          <div className="note note-n" style={{ fontSize: 11 }}>Coördinaten niet beschikbaar — geen Kadaster lookup mogelijk.</div>
        )}

        {!compsLoading && comps !== null && comps.length === 0 && (
          <div className="note note-n" style={{ fontSize: 11 }}>Geen recente transacties gevonden in de directe omgeving (straal ~700m, afgelopen 4 jaar).</div>
        )}

        {!compsLoading && comps !== null && comps.length > 0 && (() => {
          const validComps  = comps.filter(c => c.price > 0);
          if (!validComps.length) return null;

          const withSqm = validComps.filter(c => c.sqm > 0);
          const avg     = withSqm.length
            ? Math.floor(withSqm.reduce((s, c) => s + Math.floor(c.price / c.sqm), 0) / withSqm.length)
            : null;
          const da      = avg != null ? subjectPpm - avg : null;

          return (
            <>
              {/* Header */}
              <div style={{ display: 'grid', gridTemplateColumns: '2.5fr 1fr 1.2fr 0.8fr 0.8fr 0.7fr 0.9fr', gap: 6, padding: '6px 10px', borderBottom: '1px solid #F4F4F5', fontSize: 9, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.08em', color: '#C0BDB8' }}>
                <div>Adres</div>
                <div style={{ textAlign: 'right' }}>Datum</div>
                <div style={{ textAlign: 'right' }}>Verkoopprijs</div>
                <div style={{ textAlign: 'right' }}>m² wonen</div>
                <div style={{ textAlign: 'right' }}>€/m²</div>
                <div style={{ textAlign: 'right' }}>Bouwjaar</div>
                <div style={{ textAlign: 'right' }}>vs object</div>
              </div>

              {/* Subject row */}
              <div style={{ display: 'grid', gridTemplateColumns: '2.5fr 1fr 1.2fr 0.8fr 0.8fr 0.7fr 0.9fr', gap: 6, padding: '8px 10px', background: '#EFF6FF', borderRadius: 6, margin: '4px 0', fontSize: 12 }}>
                <div style={{ fontWeight: 600, color: '#1D4ED8' }}>{d.address}</div>
                <div style={{ textAlign: 'right', color: '#71717A' }}>Nu</div>
                <div style={{ textAlign: 'right', fontWeight: 600, color: '#1D4ED8' }}>{fmt(d.price)}</div>
                <div style={{ textAlign: 'right', color: '#1C1C1E' }}>{d.sqm} m²</div>
                <div style={{ textAlign: 'right', fontWeight: 600, color: '#1D4ED8' }}>{fmt(subjectPpm)}</div>
                <div style={{ textAlign: 'right', color: '#71717A' }}>{d.year}</div>
                <div style={{ textAlign: 'right', color: '#A1A1AA' }}>—</div>
              </div>

              {/* Comp rows */}
              {validComps.map((c, i) => {
                const cppm    = c.sqm > 0 ? Math.floor(c.price / c.sqm) : null;
                const diff    = cppm != null ? cppm - subjectPpm : null;
                const diffCol = diff == null ? '#A1A1AA' : diff > 0 ? '#15803D' : '#B91C1C';
                const yr      = c.datum ? c.datum.slice(0, 7) : '—';
                return (
                  <div key={i} style={{ display: 'grid', gridTemplateColumns: '2.5fr 1fr 1.2fr 0.8fr 0.8fr 0.7fr 0.9fr', gap: 6, padding: '8px 10px', borderBottom: '1px solid #F9F9F9', fontSize: 12 }}>
                    <div style={{ color: '#3F3F46', fontSize: 11 }}>{c.address}</div>
                    <div style={{ textAlign: 'right', color: '#71717A', fontSize: 11 }}>{yr}</div>
                    <div style={{ textAlign: 'right', color: '#1C1C1E', fontWeight: 500 }}>{fmt(c.price)}</div>
                    <div style={{ textAlign: 'right', color: '#71717A' }}>{c.sqm ? `${c.sqm} m²` : '—'}</div>
                    <div style={{ textAlign: 'right', color: '#52525B', fontWeight: 500 }}>{cppm ? fmt(cppm) : '—'}</div>
                    <div style={{ textAlign: 'right', color: '#71717A' }}>{c.year_built ?? '—'}</div>
                    <div style={{ textAlign: 'right', fontWeight: 600, color: diffCol }}>
                      {diff == null ? '—' : (diff > 0 ? '+' : '') + fmt(diff)}
                    </div>
                  </div>
                );
              })}

              {/* Samenvatting */}
              {avg != null && da != null && (
                <div className={`note ${da < 0 ? 'note-g' : 'note-y'}`} style={{ marginTop: 10 }}>
                  Buurtgemiddelde {fmt(avg)}/m² op basis van {withSqm.length} verkopen — object ligt{' '}
                  <strong>{fmt(Math.abs(da))}/m² {da < 0 ? 'onder' : 'boven'} dit gemiddelde</strong>
                  {da < 0 ? ' — potentieel voordeel.' : ' — vraagprijs aan de hoge kant.'}
                </div>
              )}
              <div style={{ fontSize: 10, color: '#C0BDB8', marginTop: 6 }}>
                Bron: Kadaster koopsommen (PDOK) · Woonoppervlakte via BAG · Straal ~1km · Afgelopen 5 jaar
              </div>
            </>
          );
        })()}
      </div>
    </>
  );
}
