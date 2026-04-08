'use client';

export default function Overview({ d }) {
  const rs = d.risk_score;
  const rc = rs <= 3 ? '#15803D' : rs <= 6 ? '#B45309' : '#B91C1C';
  const rl = rs <= 3 ? 'Laag risico' : rs <= 6 ? 'Gemiddeld risico' : 'Hoog risico';

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '3fr 2fr', gap: 12 }}>
      <div className="card">
        <div className="card-title">Investeringsthese</div>
        <div style={{ fontSize: 13.5, color: '#3F3F46', lineHeight: 1.85, marginBottom: 14 }}>{d.full_analysis}</div>
        <div className="note note-b">{d.advice}</div>
        {[['Staat', d.condition], ['Renovatiescope', d.reno_items], ['Geanalyseerd', d.saved_at ?? '—']].map(([k, v]) => (
          <div className="row" key={k}><span className="rk">{k}</span><span className="rv">{v}</span></div>
        ))}
      </div>

      <div className="card">
        <div className="card-title">Risicobeoordeling</div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 18, paddingBottom: 14, borderBottom: '1px solid #F4F4F5' }}>
          <div style={{ width: 60, height: 60, borderRadius: '50%', border: `2.5px solid ${rc}`, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <div style={{ fontSize: 20, fontWeight: 600, color: rc }}>{rs}</div>
            <div style={{ fontSize: 8, color: '#A1A1AA' }}>/10</div>
          </div>
          <div>
            <div style={{ fontSize: 14, fontWeight: 600, color: '#1C1C1E' }}>{rl}</div>
            <div style={{ fontSize: 11, color: '#A1A1AA', marginTop: 2 }}>Totaal risicoprofiel</div>
          </div>
        </div>
        {[['Locatie', d.risk_location], ['Staat', d.risk_condition], ['Markt', d.risk_market], ['Liquiditeit', d.risk_liquidity]].map(([lbl, val]) => {
          const pct = { Low: 22, Medium: 58, High: 88 }[val] ?? 50;
          const tc  = { Low: 'low', Medium: 'med', High: 'high' }[val] ?? 'med';
          const fc  = { Low: '#22C55E', Medium: '#F59E0B', High: '#EF4444' }[val] ?? '#F59E0B';
          return (
            <div className="rb" key={lbl}>
              <div className="rb-top">
                <span className="rb-name">{lbl}risico</span>
                <span className={`rb-tag ${tc}`}>{{ Low: 'Laag', Medium: 'Gemiddeld', High: 'Hoog' }[val] ?? val}</span>
              </div>
              <div className="rb-track">
                <div className="rb-fill" style={{ width: `${pct}%`, background: fc }} />
              </div>
            </div>
          );
        })}
        {d.risk_notes && <div className="note note-y" style={{ fontSize: 12, marginTop: 4 }}>{d.risk_notes}</div>}
      </div>
    </div>
  );
}
