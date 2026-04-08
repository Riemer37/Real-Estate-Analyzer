'use client';
import { useState } from 'react';
import { fmt } from '@/lib/utils';

export default function Acquisition({ d, onUpdate }) {
  const [bidPct, setBidPct] = useState(-5);
  const [taxPct, setTaxPct] = useState(10.4);
  const [notary, setNotary] = useState(3000);
  const [misc,   setMisc]   = useState(2000);

  const bid      = d.price * (1 + bidPct / 100);
  const tax      = bid * (taxPct / 100);
  const totalAcq = bid + tax + notary + misc;
  const diffFmv  = d.price - d.fair_value;

  onUpdate?.(totalAcq);

  const erfpacht = d.erfpacht ?? 'Onbekend';
  const canon    = d.erfpacht_canon ?? 0;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
    {erfpacht === 'Ja' && (
      <div className="note note-r">
        Erfpacht gedetecteerd — de grond is niet in eigendom.{canon > 0 ? ` Jaarlijkse canon: €${canon.toLocaleString('nl-NL')}.` : ''} Controleer de erfpachtvoorwaarden en de canonherziening vóór het bieden. Dit drukt de marktwaarde en financierbaarheid significant.
      </div>
    )}
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
      <div className="card">
        <div className="card-title">Bod & Kosten</div>
        <label style={{ fontSize: 12, color: '#71717A' }}>Bod t.o.v. vraagprijs ({bidPct > 0 ? '+' : ''}{bidPct}%)</label>
        <input type="range" min={-12} max={5} step={0.5} value={bidPct} onChange={e => setBidPct(+e.target.value)} style={{ width: '100%', margin: '6px 0 12px' }} />
        <label style={{ fontSize: 12, color: '#71717A' }}>Overdrachtsbelasting ({taxPct.toFixed(1)}%)</label>
        <input type="range" min={2} max={10.4} step={0.1} value={taxPct} onChange={e => setTaxPct(+e.target.value)} style={{ width: '100%', margin: '6px 0 12px' }} />
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 12 }}>
          <div>
            <label style={{ fontSize: 12, color: '#71717A' }}>Notaris & juridisch (€)</label>
            <input type="number" value={notary} step={100} onChange={e => setNotary(+e.target.value)} style={{ width: '100%', padding: '6px 8px', border: '1px solid #E4E4E7', borderRadius: 6, fontSize: 13 }} />
          </div>
          <div>
            <label style={{ fontSize: 12, color: '#71717A' }}>Keuring & overig (€)</label>
            <input type="number" value={misc} step={100} onChange={e => setMisc(+e.target.value)} style={{ width: '100%', padding: '6px 8px', border: '1px solid #E4E4E7', borderRadius: 6, fontSize: 13 }} />
          </div>
        </div>
        {[['Vraagprijs', fmt(d.price)], ['Bod', fmt(bid)], [`Overdrachtsbelasting (${taxPct.toFixed(1)}%)`, fmt(tax)], ['Notaris & juridisch', fmt(notary)], ['Keuring', fmt(misc)]].map(([k, v]) => (
          <div className="row" key={k}><span className="rk">{k}</span><span className="rv">{v}</span></div>
        ))}
        <div className="row"><span style={{ fontWeight: 600, color: '#1C1C1E' }}>Totale aankoop</span><span style={{ fontWeight: 700, color: '#1D4ED8' }}>{fmt(totalAcq)}</span></div>
        {diffFmv < 0
          ? <div className="note note-g" style={{ marginTop: 10 }}>{fmt(Math.abs(diffFmv))} onder marktwaarde — goed instapmoment.</div>
          : <div className="note note-y" style={{ marginTop: 10 }}>↑ {fmt(diffFmv)} boven marktwaarde — onderhandel naar beneden.</div>
        }
      </div>

      <div>
        <div className="card">
          <div className="card-title">Marktcontext</div>
          {[['Marktwaarde', fmt(d.fair_value)], ['Vraagprijs', fmt(d.price)], ['Prijs per m²', fmt(Math.floor(d.price / Math.max(d.sqm, 1))) + '/m²'], ['Energielabel', d.energy], ['Staat', d.condition], ['Bouwjaar', String(d.year)]].map(([k, v]) => (
            <div className="row" key={k}><span className="rk">{k}</span><span className="rv">{v}</span></div>
          ))}
        </div>
        <div className="card" style={{ marginTop: 0 }}>
          <div className="card-title">Kostenoverzicht</div>
          <div style={{ fontSize: 28, fontWeight: 600, color: '#1D4ED8', letterSpacing: -1 }}>{fmt(totalAcq)}</div>
          <div style={{ fontSize: 12, color: '#A1A1AA', marginTop: 4 }}>Totale aankoopkosten voor deze woning</div>
        </div>
      </div>
    </div>
    </div>
  );
}
