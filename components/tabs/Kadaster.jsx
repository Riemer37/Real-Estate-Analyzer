'use client';
import { fmt } from '@/lib/utils';

export default function Kadaster({ d }) {
  const kad = d.kadaster ?? {};
  const bagLink = kad.bag_viewer_url
    ? <a href={kad.bag_viewer_url} target="_blank" rel="noreferrer">Open BAG viewer ↗</a>
    : null;

  const subjectPpm = Math.floor(d.price / Math.max(d.sqm, 1));
  const valid = (d.comps ?? []).filter(c => c.price > 0 && c.sqm > 0);

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
        <div className="card-title">Vergelijkbare verkopen in de buurt</div>
        <div className="comp-hd">
          <div>Adres</div><div style={{textAlign:'right'}}>Jaar</div><div style={{textAlign:'right'}}>Verkoopprijs</div><div style={{textAlign:'right'}}>€/m²</div><div style={{textAlign:'right'}}>vs object</div>
        </div>
        {valid.map((c, i) => {
          const cppm = Math.floor(c.price / Math.max(c.sqm, 1));
          const diff = cppm - subjectPpm;
          const diffCol = diff > 0 ? '#15803D' : '#B91C1C';
          const diffStr = (diff > 0 ? '+' : '') + fmt(diff) + '/m²';
          return (
            <div className="comp-row" key={i}>
              <div className="ca">{c.address}</div>
              <div className="cv">{c.year}</div>
              <div className="cp">{fmt(c.price)}</div>
              <div className="cv">{fmt(cppm)}/m²</div>
              <div className="cv"><span style={{ color: diffCol, fontWeight: 600 }}>{diffStr}</span></div>
            </div>
          );
        })}
        {valid.length > 0 && (() => {
          const avg = Math.floor(valid.reduce((s, c) => s + Math.floor(c.price / Math.max(c.sqm, 1)), 0) / valid.length);
          const da  = subjectPpm - avg;
          return <div className={`note ${da < 0 ? 'note-g' : 'note-y'}`} style={{ marginTop: 10 }}>
            {da < 0 ? `Object ligt ${fmt(Math.abs(da))}/m² onder het buurtgemiddelde van ${fmt(avg)}/m² — potentieel voordeel.` : `Object ligt ${fmt(da)}/m² boven het buurtgemiddelde van ${fmt(avg)}/m² — vraagprijs aan de hoge kant.`}
          </div>;
        })()}
      </div>
    </>
  );
}
