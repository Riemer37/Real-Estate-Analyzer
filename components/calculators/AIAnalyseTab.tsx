'use client';

import { useState } from 'react';
import { useUser } from '@clerk/nextjs';
import ProGate from '@/components/ProGate';
import type { PropertyInput, KadasterInfo } from '@/lib/calc-types';

interface AIResult {
  these: string;
  risico: string;
  transformatie: string;
}

interface AIAnalyseTabProps {
  input: PropertyInput;
  kad: KadasterInfo;
}

function Panel({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="panel p-5">
      <div className="text-[10px] uppercase tracking-wide text-muted-foreground font-semibold mb-3">{title}</div>
      <div className="text-sm leading-relaxed text-foreground/90">{children}</div>
    </div>
  );
}

function Spinner() {
  return (
    <svg
      className="animate-spin h-5 w-5 text-primary"
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
      viewBox="0 0 24 24"
    >
      <circle
        className="opacity-25"
        cx="12"
        cy="12"
        r="10"
        stroke="currentColor"
        strokeWidth="4"
      />
      <path
        className="opacity-75"
        fill="currentColor"
        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
      />
    </svg>
  );
}

export default function AIAnalyseTab({ input, kad }: AIAnalyseTabProps) {
  const { user, isLoaded } = useUser();
  const isPro = user?.publicMetadata?.isPro === true;

  const [result, setResult] = useState<AIResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Loading state while Clerk resolves auth
  if (!isLoaded) {
    return <div className="panel p-8 animate-pulse h-32 rounded-xl" />;
  }

  // Pro gate — show upgrade prompt for free users
  if (!isPro) {
    return (
      <ProGate
        feature="AI Investeringsanalyse"
        description="Claude AI analyseert het object en geeft een investeringsthese, risicotoelichting en transformatieadvies — alleen op basis van jouw ingevoerde data."
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

      const data: AIResult & { error?: string } = await res.json();

      if (data.error) {
        throw new Error(data.error);
      }

      setResult(data);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Onbekende fout');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* Header + trigger */}
      <div className="panel p-5">
        <div className="text-[10px] uppercase tracking-wide text-muted-foreground font-semibold mb-3">
          AI Investeringsanalyse
        </div>
        <p className="text-sm text-muted-foreground mb-4">
          Claude AI genereert een tekstuele analyse op basis van de door jou ingevoerde data.
          Geen getallen worden door AI geschat.
        </p>
        <button
          type="button"
          onClick={handleGenerate}
          disabled={loading}
          className="inline-flex items-center gap-2 px-5 py-2.5 bg-navy text-white text-sm font-semibold rounded-md hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {loading && <Spinner />}
          {loading ? 'AI analyseert...' : 'Genereer AI analyse'}
        </button>
        {!loading && (
          <p className="text-[11px] text-muted-foreground mt-3">
            Claude AI genereert alleen tekst op basis van door jou ingevoerde data. Geen getallen worden door AI geschat.
          </p>
        )}
      </div>

      {/* Error */}
      {error && (
        <div className="panel p-4 border-destructive/30 bg-destructive/5">
          <div className="text-[10px] uppercase tracking-wide text-destructive font-semibold mb-1">Fout</div>
          <p className="text-sm text-destructive">{error}</p>
        </div>
      )}

      {/* Results */}
      {result && (
        <div className="space-y-4">
          <Panel title="Investeringsthese">
            {result.these || <span className="text-muted-foreground italic">Geen these gegenereerd.</span>}
          </Panel>
          <Panel title="Risicotoelichting">
            {result.risico || <span className="text-muted-foreground italic">Geen risicotoelichting gegenereerd.</span>}
          </Panel>
          <Panel title="Transformatieadvies">
            {result.transformatie || <span className="text-muted-foreground italic">Geen transformatieadvies gegenereerd.</span>}
          </Panel>
        </div>
      )}
    </div>
  );
}
