'use client';
import { fmt } from '@/lib/utils';

export default function Overview({ d }) {
  const rs = d.risk_score;
  const rc = rs <= 3 ? '#0EB876' : rs <= 6 ? '#F5A020' : '#FF5252';
  const rl = rs <= 3 ? 'Laag risico' : rs <= 6 ? 'Gemiddeld risico' : 'Hoog risico';
  const pv = d.prijs_validatie;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {pv && (
        <div style={{ background: '#0C1A2E', border: '1px solid #1A3352', borderRadius: 10, padding: '14px 18px', display: 'grid', gridTemplateColumns: 'repeat(5,1fr)', gap: 10 }}>
          {[
            ['Methode',      pv.waarde_methode],
            ['Marktwaarde',  fmt(pv.stat_fair_value)],
            ['AI-schatting', fmt(pv.ai_fair_value)],
            ['Databronnen',  (pv.kad_comps_count ?? 0) > 0 ? `${pv.kad_comps_count}× Kadaster` : (pv.ai_comps_count ?? 0) > 0 ? `${pv.ai_comps_count}× AI` : '—'],
            ['AI afwijking', `${pv.afwijking_pct}% ${pv.betrouwbaar ? '✓' : '!'}`],
          ].map(([k, v]) => (
            <div key={k}>
              <div style={{ fontSize: 9, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.1em', color: '#3D5A78', marginBottom: 4 }}>{k}</div>
              <div style={{ fontSize: 12, fontWeight: 600, color: '#DCE8F5' }}>{v}</div>
            </div>
          ))}
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: '3fr 2fr', gap: 12 }}>
        <div className="card">
          <div className="card-title">Investeringsthese</div>
          <div style={{ fontSize: 13, color: '#6A8AAA', lineHeight: 1.85, marginBottom: 14 }}>{d.full_analysis}</div>
          <div className="note note-b">{d.advice}</div>
          {[
            ['Staat',           d.condition],
            ['Renovatiescope',  d.reno_items],
            ['Huurwaarde bron', d.huur_methode ?? '—'],
            ['WWS categorie',   d.wws_categorie ? `${d.wws_categorie} (${d.wws_punten} pt)` : '—'],
            ['Geanalyseerd',    d.saved_at ?? '—'],
          ].map(([k, v]) => (
            <div className="row" key={k}><span className="rk">{k}</span><span className="rv">{v}</span></div>
          ))}
        </div>

        <div className="card">
          <div className="card-title">Risicobeoordeling</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 18, paddingBottom: 14, borderBottom: '1px solid #152840' }}>
            <div style={{ width: 58, height: 58, borderRadius: '50%', border: `2px solid ${rc}`, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', flexShrink: 0, background: rc + '15' }}>
              <div style={{ fontSize: 20, fontWeight: 700, color: rc }}>{rs}</div>
              <div style={{ fontSize: 8, color: '#3D5A78' }}>/10</div>
            </div>
            <div>
              <div style={{ fontSize: 14, fontWeight: 700, color: '#DCE8F5' }}>{rl}</div>
              <div style={{ fontSize: 11, color: '#3D5A78', marginTop: 2 }}>Totaal risicoprofiel</div>
            </div>
          </div>
          {[['Locatie', d.risk_location], ['Staat', d.risk_condition], ['Markt', d.risk_market], ['Liquiditeit', d.risk_liquidity]].map(([lbl, val]) => {
            const pct = { Low: 22, Medium: 58, High: 88 }[val] ?? 50;
            const tc  = { Low: 'low', Medium: 'med', High: 'high' }[val] ?? 'med';
            const fc  = { Low: '#0EB876', Medium: '#F5A020', High: '#FF5252' }[val] ?? '#F5A020';
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
          <div style={{ fontSize: 10, color: '#2A3F55', marginTop: 8 }}>Berekend op basis van WOZ-ratio, bouwjaar, energielabel, staat en vraagprijs vs. marktwaarde</div>
        </div>
      </div>
    </div>
  );
}
