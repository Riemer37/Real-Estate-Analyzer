'use client';

const SCORE_COLOR = s => s >= 7 ? '#0EB876' : s >= 4 ? '#F5A020' : '#FF5252';
const SCORE_BG    = s => s >= 7 ? '#0A2A1A' : s >= 4 ? '#2D1E05' : '#2D0C0C';
const SCORE_LABEL = s => s >= 7 ? 'Kansrijk' : s >= 4 ? 'Mogelijk' : 'Lastig';

function ScoreBar({ score }) {
  const pct = Math.round((score / 10) * 100);
  const col = SCORE_COLOR(score);
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 6 }}>
      <div style={{ flex: 1, height: 4, background: '#1A3352', borderRadius: 99, overflow: 'hidden' }}>
        <div style={{ width: `${pct}%`, height: '100%', background: col, borderRadius: 99, transition: 'width .4s ease' }} />
      </div>
      <span style={{ fontSize: 11, fontWeight: 700, color: col, minWidth: 28 }}>{score}/10</span>
    </div>
  );
}

function KansCard({ titel, score, toelichting }) {
  return (
    <div style={{ background: '#0F2035', border: '1px solid #1A3352', borderRadius: 10, padding: '16px 18px', borderLeft: `3px solid ${SCORE_COLOR(score)}` }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
        <div style={{ fontSize: 12.5, fontWeight: 600, color: '#DCE8F5' }}>{titel}</div>
        <span style={{ fontSize: 9, fontWeight: 700, padding: '2px 9px', borderRadius: 99, background: SCORE_BG(score), color: SCORE_COLOR(score), letterSpacing: '.04em', textTransform: 'uppercase' }}>
          {SCORE_LABEL(score)}
        </span>
      </div>
      <ScoreBar score={score} />
      {toelichting && (
        <div style={{ marginTop: 10, fontSize: 12, color: '#6A8AAA', lineHeight: 1.7 }}>{toelichting}</div>
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
        <div className="note note-n">Transformatiedata kon niet worden berekend. Analyseer opnieuw voor een volledig resultaat.</div>
      </div>
    );
  }

  const kad = d.kadaster ?? {};
  const strictCol = { Streng: '#FF5252', Gemiddeld: '#F5A020', Soepel: '#0EB876' };
  const strictBg  = { Streng: '#2D0C0C', Gemiddeld: '#2D1E05', Soepel: '#0A2A1A' };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>

      <div className="card">
        <div className="card-title">
          Gemeentelijk beleid — {kad.gemeentenaam ?? d.address?.split(',').pop()?.trim() ?? '—'}
          <span style={{ fontSize: 9, fontWeight: 700, padding: '2px 10px', borderRadius: 99, background: strictBg[p.gemeente_strictheid] ?? '#0F2035', color: strictCol[p.gemeente_strictheid] ?? '#6A8AAA', textTransform: 'uppercase', letterSpacing: '.04em' }}>
            {p.gemeente_strictheid}
          </span>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 14 }}>
          {[
            ['Gemeente',        kad.gemeentenaam ?? '—'],
            ['Buurt',           kad.buurtnaam ?? '—'],
            ['Wijk',            kad.wijknaam ?? '—'],
            ['Bestemmingsplan', p.bestemmingsplan_type],
          ].map(([k, v]) => (
            <div key={k} style={{ background: '#0F2035', border: '1px solid #152840', borderRadius: 8, padding: '10px 13px' }}>
              <div style={{ fontSize: 9, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.1em', color: '#3D5A78', marginBottom: 4 }}>{k}</div>
              <div style={{ fontSize: 12.5, fontWeight: 600, color: '#DCE8F5' }}>{v}</div>
            </div>
          ))}
        </div>

        {p.gemeente_beleid && <div className="note note-n">{p.gemeente_beleid}</div>}
      </div>

      <div className="card">
        <div className="card-title">Transformatiemogelijkheden</div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          <KansCard titel="Optoppen"          score={p.optoppen.score}  toelichting={p.optoppen.toelichting} />
          <KansCard titel="Splitsen"          score={p.splitsen.score}  toelichting={p.splitsen.toelichting} />
          <KansCard titel="Balkon toevoegen"  score={p.balkon.score}    toelichting={p.balkon.toelichting} />
          <KansCard titel="Aanbouw / uitbouw" score={p.aanbouw.score}   toelichting={p.aanbouw.toelichting} />
        </div>
      </div>

      {p.advies && (
        <div className="card">
          <div className="card-title">Transformatieadvies</div>
          <div style={{ fontSize: 13, color: '#6A8AAA', lineHeight: 1.85 }}>{p.advies}</div>
        </div>
      )}
    </div>
  );
}
