'use client';

import { useState } from 'react';
import { useUser } from '@clerk/nextjs';
import { Loader2, AlertTriangle, TrendingUp, Clock, ShieldAlert, CheckCircle2, XCircle, Trophy } from 'lucide-react';
import ProGate from '@/components/ProGate';
import type { PropertyInput, KadasterInfo } from '@/lib/calc-types';

// ── Types ──────────────────────────────────────────────────────────────────────
interface Strategy {
  id: number;
  naam: string;
  haalbaarheid: string;
  verwacht_roi: string;
  verwacht_cashflow: string;
  risico: 'laag' | 'middel' | 'hoog';
  doorlooptijd: string;
  max_bod: string;
  aanbevolen: boolean;
  toelichting: string;
}

interface Top3Item {
  rang: number;
  strategie: string;
  reden: string;
}

interface AIResult {
  samenvatting: string;
  strategieen: Strategy[];
  top3: Top3Item[];
  aandachtspunten: string[];
  kopen: boolean | null;
  eindadvies: string;
}

interface AIAnalyseTabProps {
  input: PropertyInput;
  kad: KadasterInfo;
}

// ── Helpers ────────────────────────────────────────────────────────────────────
const RISICO_STYLE: Record<string, string> = {
  laag:   'bg-positive/10 text-positive border-positive/25',
  middel: 'bg-warning/10 text-warning border-warning/25',
  hoog:   'bg-destructive/10 text-destructive border-destructive/25',
};

function RisicoBadge({ risico }: { risico: string }) {
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded border text-[10px] font-bold uppercase tracking-wide ${RISICO_STYLE[risico] ?? 'bg-muted text-muted-foreground border-border'}`}>
      {risico}
    </span>
  );
}

const RANG_STYLE = ['', 'bg-yellow-400/20 border-yellow-400/40 text-yellow-700 dark:text-yellow-300', 'bg-slate-200/50 border-slate-400/40 text-slate-600 dark:text-slate-300', 'bg-orange-200/40 border-orange-400/30 text-orange-700 dark:text-orange-300'];
const RANG_LABEL = ['', '🥇 #1', '🥈 #2', '🥉 #3'];

// ── Main component ─────────────────────────────────────────────────────────────
export default function AIAnalyseTab({ input, kad }: AIAnalyseTabProps) {
  const { user, isLoaded } = useUser();
  const isPro = user?.publicMetadata?.isPro === true;

  const [result, setResult] = useState<AIResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isLoaded) return <div className="panel p-8 animate-pulse h-32 rounded-xl" />;
  if (!isPro) {
    return (
      <ProGate
        feature="AI Investeringsanalyse"
        description="Claude AI evalueert alle 10 investeringsstrategieën en geeft een concreet advies inclusief maximale biedprijs, ROI en risicoprofiel per strategie."
      />
    );
  }

  const handleGenerate = async () => {
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const res = await fetch('/api/ai-text', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ input, kad }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? `HTTP ${res.status}`);
      }
      if (!res.body) throw new Error('Geen response body');

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let text = '';
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        text += decoder.decode(value, { stream: true });
      }

      const jsonStr = text.match(/\{[\s\S]*\}/)?.[0] ?? text;
      const data = JSON.parse(jsonStr);
      if (data.error) throw new Error(data.error);
      setResult(data as AIResult);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Onbekende fout');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-5">

      {/* Header + trigger */}
      <div className="panel p-5 flex items-start justify-between gap-4 flex-wrap">
        <div>
          <div className="text-[10px] uppercase tracking-wide text-muted-foreground font-semibold mb-1">AI Investeringsanalyse — Pro</div>
          <p className="text-sm text-muted-foreground max-w-lg">
            Claude Sonnet evalueert alle 10 investeringsstrategieën op basis van jouw ingevoerde data en geeft een concreet advies.
          </p>
        </div>
        <button
          type="button"
          onClick={handleGenerate}
          disabled={loading}
          className="shrink-0 inline-flex items-center gap-2 px-5 py-2.5 bg-navy text-white text-sm font-semibold rounded-md hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {loading ? <Loader2 className="size-4 animate-spin" /> : <TrendingUp className="size-4" />}
          {loading ? 'AI analyseert (30–60s)...' : result ? 'Opnieuw analyseren' : 'Genereer analyse'}
        </button>
      </div>

      {/* Error */}
      {error && (
        <div className="flex items-start gap-2 rounded-md border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">
          <AlertTriangle className="size-4 shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      )}

      {/* Results */}
      {result && (
        <div className="space-y-5">

          {/* Eindverdikt */}
          {result.kopen !== null && (
            <div className={`rounded-xl border-2 p-5 flex items-start gap-4 ${
              result.kopen
                ? 'border-positive/40 bg-positive/5'
                : 'border-destructive/40 bg-destructive/5'
            }`}>
              {result.kopen
                ? <CheckCircle2 className="size-8 text-positive shrink-0 mt-0.5" />
                : <XCircle className="size-8 text-destructive shrink-0 mt-0.5" />
              }
              <div>
                <div className={`text-xl font-extrabold mb-1 ${result.kopen ? 'text-positive' : 'text-destructive'}`}>
                  {result.kopen ? 'ADVIES: KOPEN' : 'ADVIES: NIET KOPEN'}
                </div>
                <p className="text-sm text-foreground/90 leading-relaxed">{result.eindadvies}</p>
              </div>
            </div>
          )}

          {/* Samenvatting */}
          {result.samenvatting && (
            <div className="panel p-5">
              <div className="text-[10px] uppercase tracking-wide text-muted-foreground font-semibold mb-2">Samenvatting</div>
              <p className="text-sm leading-relaxed text-foreground/90">{result.samenvatting}</p>
            </div>
          )}

          {/* Top 3 */}
          {result.top3?.length > 0 && (
            <div>
              <div className="text-[10px] uppercase tracking-wide text-muted-foreground font-semibold mb-3 flex items-center gap-1.5">
                <Trophy className="size-3" />
                Top 3 beste strategieën
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                {result.top3.map(t => (
                  <div key={t.rang} className={`panel p-4 border-2 space-y-2 ${RANG_STYLE[t.rang] ?? ''}`}>
                    <div className="text-sm font-bold">{RANG_LABEL[t.rang]} {t.strategie}</div>
                    <p className="text-xs text-foreground/80 leading-relaxed">{t.reden}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Alle strategieën */}
          {result.strategieen?.length > 0 && (
            <div>
              <div className="text-[10px] uppercase tracking-wide text-muted-foreground font-semibold mb-3">
                Alle 10 strategieën
              </div>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
                {result.strategieen.map(s => (
                  <div
                    key={s.id}
                    className={`panel p-4 space-y-3 ${s.aanbevolen ? 'ring-1 ring-primary/30' : ''}`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="font-semibold text-sm text-navy leading-tight">{s.naam}</div>
                      <div className="flex items-center gap-1.5 shrink-0">
                        {s.aanbevolen && (
                          <span className="text-[10px] font-bold text-primary bg-primary/10 border border-primary/20 px-1.5 py-0.5 rounded">
                            Aanbevolen
                          </span>
                        )}
                        <RisicoBadge risico={s.risico} />
                      </div>
                    </div>

                    <div className="grid grid-cols-3 gap-2 text-xs">
                      <div>
                        <div className="text-muted-foreground mb-0.5 flex items-center gap-1">
                          <TrendingUp className="size-3" /> ROI
                        </div>
                        <div className="font-semibold tabular">{s.verwacht_roi || '—'}</div>
                      </div>
                      <div>
                        <div className="text-muted-foreground mb-0.5 flex items-center gap-1">
                          <Clock className="size-3" /> Doorlooptijd
                        </div>
                        <div className="font-semibold">{s.doorlooptijd || '—'}</div>
                      </div>
                      <div>
                        <div className="text-muted-foreground mb-0.5 flex items-center gap-1">
                          <ShieldAlert className="size-3" /> Max bod
                        </div>
                        <div className="font-semibold tabular">{s.max_bod || '—'}</div>
                      </div>
                    </div>

                    <p className="text-xs text-muted-foreground leading-relaxed border-t border-border pt-2">
                      {s.toelichting}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Aandachtspunten */}
          {result.aandachtspunten?.length > 0 && (
            <div className="panel p-5">
              <div className="text-[10px] uppercase tracking-wide text-muted-foreground font-semibold mb-3 flex items-center gap-1.5">
                <AlertTriangle className="size-3" />
                Aandachtspunten &amp; risico's
              </div>
              <ul className="space-y-2">
                {result.aandachtspunten.map((p, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm">
                    <span className="text-warning font-bold mt-0.5 shrink-0">⚠</span>
                    <span className="text-foreground/90">{p}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

        </div>
      )}
    </div>
  );
}
