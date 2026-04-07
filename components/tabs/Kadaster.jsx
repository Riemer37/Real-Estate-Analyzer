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
      <div className="card">
        <div className="card-title">Officiële Kadaster BAG-gegevens &nbsp; {bagLink}</div>
        {kad.found ? (
          <>
            <div className="kad-grid">
              {[
                ['Officieel adres',      kad.official_address ?? '—',                             '',     'Via PDOK Locatieserver'],
                ['Geregistreerd opp.',   kad.official_sqm ? `${kad.official_sqm} m²` : '—',      '',     'Uit BAG verblijfsobject'],
                ['Officieel bouwjaar',   String(kad.official_year ?? '—'),                        '',     'Uit BAG pandregister'],
                ['Geregistreerd gebruik',kad.usage ?? '—',                                        '',     'Gebruiksdoel'],
                ['BAG-status',           kad.status ?? '—',                                       '',     'Huidige registratiestatus'],
                ['Splitsingstatus',      kad.is_split ? `${kad.vbo_count} eenheden — al gesplitst` : kad.vbo_count != null ? 'Enkelvoudig — niet gesplitst' : 'Kon niet bepalen', kad.is_split ? 'warn' : '', 'VBO-telling in pand'],
              ].map(([lbl, val, cls, sub]) => (
                <div className={`kad-box ${cls}`} key={lbl}>
                  <div className="kad-lbl">{lbl}</div>
                  <div className={`kad-val ${cls ? 'warn' : ''}`}>{val}</div>
                  <div className="kad-sub">{sub}</div>
                </div>
              ))}
            </div>
            {kad.is_split
              ? <div className="note note-y">⚠️ Dit pand heeft {kad.vbo_count} geregistreerde eenheden — het is al gesplitst. Controleer eigendom en vergunningen zorgvuldig voor het bieden.</div>
              : d.sqm >= 100
                ? <div className="note note-b">💡 Enkelvoudige registratie. Bij {d.sqm}m² kan splitsing in 2 appartementen haalbaar zijn — check bestemmingsplan bij de gemeente.</div>
                : <div className="note note-g">✓ Enkelvoudige registratie — geen splitsingscomplexiteit.</div>
            }
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
            📊 {da < 0 ? `Object ligt ${fmt(Math.abs(da))}/m² onder het buurtgemiddelde van ${fmt(avg)}/m² — potentieel voordeel.` : `Object ligt ${fmt(da)}/m² boven het buurtgemiddelde van ${fmt(avg)}/m² — vraagprijs aan de hoge kant.`}
          </div>;
        })()}
      </div>
    </>
  );
}
