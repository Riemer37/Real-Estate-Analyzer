'use client';

const SCORE_COLOR = s => s >= 7 ? '#15803D' : s >= 4 ? '#B45309' : '#B91C1C';
const SCORE_BG    = s => s >= 7 ? '#F0FDF4' : s >= 4 ? '#FFFBEB' : '#FEF2F2';
const SCORE_LABEL = s => s >= 7 ? 'Kansrijk' : s >= 4 ? 'Mogelijk' : 'Lastig';

const STRICTHEID_COLOR = { Streng: '#B91C1C', Gemiddeld: '#B45309', Soepel: '#15803D' };
const STRICTHEID_BG    = { Streng: '#FEF2F2', Gemiddeld: '#FFFBEB', Soepel: '#F0FDF4' };

function ScoreBar({ score }) {
  const pct = Math.round((score / 10) * 100);
  const col = SCORE_COLOR(score);
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 6 }}>
      <div style={{ flex: 1, height: 5, background: '#F4F4F5', borderRadius: 99, overflow: 'hidden' }}>
        <div style={{ width: `${pct}%`, height: '100%', background: col, borderRadius: 99, transition: 'width .4s ease' }} />
      </div>
      <span style={{ fontSize: 11, fontWeight: 600, color: col, minWidth: 24 }}>{score}/10</span>
    </div>
  );
}

function KansCard({ titel, score, toelichting }) {
  return (
    <div style={{ background: '#fff', border: '1px solid #E4E4E7', borderRadius: 12, padding: '18px 20px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: '#1C1C1E' }}>{titel}</div>
        <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 9px', borderRadius: 99, background: SCORE_BG(score), color: SCORE_COLOR(score) }}>
          {SCORE_LABEL(score)}
        </span>
      </div>
      <ScoreBar score={score} />
      {toelichting && (
        <div style={{ marginTop: 10, fontSize: 12.5, color: '#52525B', lineHeight: 1.7 }}>{toelichting}</div>
      )}
    </div>
  );
}

export default function Potentieel({ d }) {
  const p = d.potentieel;

  if (!p) {
    return (
      <div className="card">
        <div className="card-title">Transformatiepotentieel</div>
        <div className="note note-n">Transformatieanalyse is alleen beschikbaar bij invoer via URL. Voer een Funda- of Pararius-link in voor een volledige analyse.</div>
      </div>
    );
  }

  const kad = d.kadaster ?? {};

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>

      {/* Gemeente beleid */}
      <div className="card">
        <div className="card-title">
          Gemeentelijk beleid — {kad.gemeentenaam ?? d.address?.split(',').pop()?.trim() ?? '—'}
          <span style={{
            fontSize: 10, fontWeight: 700, padding: '2px 10px', borderRadius: 99,
            background: STRICTHEID_BG[p.gemeente_strictheid] ?? '#F9FAFB',
            color: STRICTHEID_COLOR[p.gemeente_strictheid] ?? '#374151',
          }}>
            {p.gemeente_strictheid}
          </span>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 14 }}>
          {[
            ['Gemeente',         kad.gemeentenaam ?? '—'],
            ['Buurt',            kad.buurtnaam ?? '—'],
            ['Wijk',             kad.wijknaam ?? '—'],
            ['Bestemmingsplan',  p.bestemmingsplan_type],
          ].map(([k, v]) => (
            <div key={k} style={{ background: '#FAFAF8', border: '1px solid #E4E4E7', borderRadius: 8, padding: '10px 14px' }}>
              <div style={{ fontSize: 9, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.1em', color: '#C0BDB8', marginBottom: 4 }}>{k}</div>
              <div style={{ fontSize: 13, fontWeight: 500, color: '#1C1C1E' }}>{v}</div>
            </div>
          ))}
        </div>

        {p.gemeente_beleid && (
          <div className="note note-n" style={{ marginTop: 0 }}>{p.gemeente_beleid}</div>
        )}
      </div>

      {/* Transformatiemogelijkheden */}
      <div className="card">
        <div className="card-title">Transformatiemogelijkheden</div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          <KansCard titel="Optoppen"          score={p.optoppen.score}  toelichting={p.optoppen.toelichting} />
          <KansCard titel="Splitsen"          score={p.splitsen.score}  toelichting={p.splitsen.toelichting} />
          <KansCard titel="Balkon toevoegen"  score={p.balkon.score}    toelichting={p.balkon.toelichting} />
          <KansCard titel="Aanbouw / uitbouw" score={p.aanbouw.score}   toelichting={p.aanbouw.toelichting} />
        </div>
      </div>

      {/* Advies */}
      {p.advies && (
        <div className="card">
          <div className="card-title">Transformatieadvies</div>
          <div style={{ fontSize: 13.5, color: '#3F3F46', lineHeight: 1.85 }}>{p.advies}</div>
        </div>
      )}
    </div>
  );
}
