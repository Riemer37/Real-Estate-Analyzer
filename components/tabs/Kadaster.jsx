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
        <div className="card-title">Official Kadaster BAG Data &nbsp; {bagLink}</div>
        {kad.found ? (
          <>
            <div className="kad-grid">
              {[
                ['Official address',    kad.official_address ?? '—',                             '',     'From PDOK Locatieserver'],
                ['Registered area',     kad.official_sqm ? `${kad.official_sqm} m²` : '—',      '',     'From BAG verblijfsobject'],
                ['Official build year', String(kad.official_year ?? '—'),                        '',     'From BAG pand register'],
                ['Registered use',      kad.usage ?? '—',                                        '',     'Gebruiksdoel'],
                ['BAG status',          kad.status ?? '—',                                       '',     'Current registration status'],
                ['Split status',        kad.is_split ? `${kad.vbo_count} units — already split` : kad.vbo_count != null ? 'Single unit — not split' : 'Could not determine', kad.is_split ? 'warn' : '', 'VBO count in building'],
              ].map(([lbl, val, cls, sub]) => (
                <div className={`kad-box ${cls}`} key={lbl}>
                  <div className="kad-lbl">{lbl}</div>
                  <div className={`kad-val ${cls ? 'warn' : ''}`}>{val}</div>
                  <div className="kad-sub">{sub}</div>
                </div>
              ))}
            </div>
            {kad.is_split
              ? <div className="note note-y">⚠️ This building has {kad.vbo_count} registered units — it is already split. Verify ownership and permits carefully before bidding.</div>
              : d.sqm >= 100
                ? <div className="note note-b">💡 Single registered unit. At {d.sqm}m² a split into 2 apartments may be viable — check zoning with the gemeente.</div>
                : <div className="note note-g">✓ Single registered unit — no split complications.</div>
            }
            {kad.bag_id && <div className="note note-n" style={{ fontSize: 11, marginTop: 8 }}>BAG object ID: <code>{kad.bag_id}</code></div>}
          </>
        ) : (
          <>
            <div className="note note-y">⚠️ {kad.error ?? 'Address not found'}. <a href="https://bagviewer.kadaster.nl" target="_blank" rel="noreferrer" style={{ color: '#2563EB' }}>Search manually ↗</a></div>
            <div style={{ marginTop: 16, fontSize: 13, color: '#52525B', lineHeight: 1.8 }}>
              <strong>To look up manually:</strong><br />
              1. Go to <a href="https://bagviewer.kadaster.nl" target="_blank" rel="noreferrer" style={{ color: '#2563EB' }}>bagviewer.kadaster.nl</a><br />
              2. Type the property address in the search box<br />
              3. Click the building to see split status, registered area and building details
            </div>
          </>
        )}
      </div>

      <div className="card">
        <div className="card-title">Comparable Sales in Neighbourhood</div>
        <div className="comp-hd">
          <div>Address</div><div style={{textAlign:'right'}}>Year</div><div style={{textAlign:'right'}}>Sold price</div><div style={{textAlign:'right'}}>€/m²</div><div style={{textAlign:'right'}}>vs subject</div>
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
            📊 {da < 0 ? `Subject is ${fmt(Math.abs(da))}/m² below neighbourhood avg of ${fmt(avg)}/m² — potential upside.` : `Subject is ${fmt(da)}/m² above neighbourhood avg of ${fmt(avg)}/m² — priced at premium.`}
          </div>;
        })()}
      </div>
    </>
  );
}
