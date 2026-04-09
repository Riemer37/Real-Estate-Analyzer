'use client';
import { fmt } from '@/lib/utils';

export default function Overview({ d }) {
  const rs = d.risk_score;
  const rc = rs <= 3 ? '#15803D' : rs <= 6 ? '#B45309' : '#B91C1C';
  const rl = rs <= 3 ? 'Laag risico' : rs <= 6 ? 'Gemiddeld risico' : 'Hoog risico';

  const pv = d.prijs_validatie;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
    {pv && (
      <div style={{ background: '#fff', border: '1px solid #E4E4E7', borderRadius: 12, padding: '14px 18px', display: 'grid', gridTemplateColumns: 'repeat(5,1fr)', gap: 10 }}>
        <div>
          <div style={{ fontSize: 9, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.1em', color: '#C0BDB8', marginBottom: 4 }}>Methode</div>
          <div style={{ fontSize: 12, fontWeight: 600, color: '#1C1C1E' }}>{pv.waarde_methode}</div>
        </div>
        <div>
          <div style={{ fontSize: 9, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.1em', color: '#C0BDB8', marginBottom: 4 }}>Marktwaarde</div>
          <div style={{ fontSize: 12, fontWeight: 600, color: '#1C1C1E' }}>{fmt(pv.stat_fair_value)}</div>
        </div>
        <div>
          <div style={{ fontSize: 9, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.1em', color: '#C0BDB8', marginBottom: 4 }}>AI-schatting</div>
          <div style={{ fontSize: 12, fontWeight: 600, color: '#71717A' }}>{fmt(pv.ai_fair_value)}</div>
        </div>
        <div>
          <div style={{ fontSize: 9, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.1em', color: '#C0BDB8', marginBottom: 4 }}>Databronnen</div>
          <div style={{ fontSize: 12, fontWeight: 600, color: '#1C1C1E' }}>
            {(pv.kad_comps_count ?? 0) > 0 && <span style={{ color: '#15803D' }}>{pv.kad_comps_count}× Kadaster</span>}
            {(pv.kad_comps_count ?? 0) > 0 && (pv.ai_comps_count ?? 0) > 0 && <span style={{ color: '#A1A1AA' }}> + </span>}
            {(pv.ai_comps_count ?? 0) > 0 && <span style={{ color: '#71717A' }}>{pv.ai_comps_count}× AI</span>}
            {!(pv.kad_comps_count) && !(pv.ai_comps_count) && '—'}
          </div>
        </div>
        <div>
          <div style={{ fontSize: 9, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.1em', color: '#C0BDB8', marginBottom: 4 }}>AI afwijking</div>
          <div style={{ fontSize: 12, fontWeight: 600, color: pv.betrouwbaar ? '#15803D' : '#B45309' }}>{pv.afwijking_pct}% {pv.betrouwbaar ? '— klopt' : '— let op'}</div>
        </div>
      </div>
    )}
    {d.cbs_gem_prijs && (
      <div className="note note-n" style={{ fontSize: 11 }}>
        CBS gemeente gemiddelde: <strong>{fmt(d.cbs_gem_prijs.prijs)}</strong> ({d.cbs_gem_prijs.periode})
      </div>
    )}
    <div style={{ display: 'grid', gridTemplateColumns: '3fr 2fr', gap: 12 }}>
      <div className="card">
        <div className="card-title">Investeringsthese</div>
        <div style={{ fontSize: 13.5, color: '#3F3F46', lineHeight: 1.85, marginBottom: 14 }}>{d.full_analysis}</div>
        <div className="note note-b">{d.advice}</div>
        {[
          ['Staat', d.condition],
          ['Renovatiescope', d.reno_items],
          ['Huurwaarde bron', d.huur_methode ?? '—'],
          ['WWS categorie', d.wws_categorie ? `${d.wws_categorie} (${d.wws_punten} pt)` : '—'],
          ['Geanalyseerd', d.saved_at ?? '—'],
        ].map(([k, v]) => (
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
        <div style={{ fontSize: 10, color: '#A1A1AA', marginTop: 8 }}>Berekend op basis van WOZ-ratio, bouwjaar, energielabel, staat en vraagprijs vs. marktwaarde</div>
      </div>
    </div>
    </div>
  );
}
