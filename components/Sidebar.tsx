"use client";

import { useEffect, useState } from "react";
import { Loader2, Search, Trash2, Building2, History } from "lucide-react";
import type { PandType, PropertyAnalysis } from "@/lib/types";
import { clearAllLocalStorageEntries, loadHistory, deleteAnalysis } from "@/lib/storage";
import { fmtEUR } from "@/lib/calculations";

interface Props {
  onAnalyze: (q: string, t: PandType) => void;
  onSelectHistory: (a: PropertyAnalysis) => void;
  loading: boolean;
  loadingStages?: string[];
  current?: PropertyAnalysis | null;
}

export function Sidebar({ onAnalyze, onSelectHistory, loading, loadingStages, current }: Props) {
  const [q, setQ] = useState("");
  const [pandtype, setPandtype] = useState<PandType>("woning");
  const [pandtypeAuto, setPandtypeAuto] = useState(false);
  const [history, setHistory] = useState<PropertyAnalysis[]>([]);
  const isFundaInBusinessQuery = /fundainbusiness\.nl/i.test(q);
  const selectedPandtype: PandType = isFundaInBusinessQuery ? "commercieel" : pandtype;

  useEffect(() => {
    setHistory(loadHistory());
    if (current?.pandtype) setPandtype(current.pandtype);
    if (current?.input && current.input !== q) setQ(current.input);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [current?.id]);

  useEffect(() => {
    if (/fundainbusiness\.nl/i.test(q)) {
      if (pandtype !== "commercieel") {
        setPandtype("commercieel");
        setPandtypeAuto(true);
      }
    } else if (pandtypeAuto) {
      setPandtype("woning");
      setPandtypeAuto(false);
    }
  }, [q, pandtype, pandtypeAuto]);

  const handleQueryChange = (value: string) => {
    setQ(value);
    if (/fundainbusiness\.nl/i.test(value)) {
      setPandtype("commercieel");
      setPandtypeAuto(true);
    }
  };

  const submit = () => {
    if (!q.trim() || loading) return;
    onAnalyze(q.trim(), selectedPandtype);
  };

  const clearCache = () => {
    clearAllLocalStorageEntries();
    setHistory([]);
  };

  return (
    <aside className="w-[280px] shrink-0 bg-sidebar text-sidebar-foreground flex flex-col h-screen sticky top-0 shadow-sidebar z-20">
      {/* Brand */}
      <div className="px-5 py-5 border-b border-sidebar-border flex items-center gap-3">
        <div className="size-9 rounded-md bg-navy flex items-center justify-center">
          <Building2 className="size-5 text-primary-foreground" strokeWidth={2.4} />
        </div>
        <div>
          <div className="font-bold tracking-tight text-[15px] display text-navy">VastgoedAI</div>
          <div className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground mt-0.5">Investment Terminal</div>
        </div>
      </div>

      {/* Search / analyse */}
      <div className="p-4 space-y-3 border-b border-sidebar-border">
        <label className="label-eyebrow block">Funda-URL of adres</label>
        <div className="relative">
          <Search className="size-4 absolute left-3 top-3 text-muted-foreground pointer-events-none" />
          <textarea
            value={q}
            onChange={(e) => handleQueryChange(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                submit();
              }
            }}
            placeholder="https://www.funda.nl/...  ·  Damrak 1, Amsterdam"
            rows={3}
            className="w-full bg-muted text-foreground placeholder:text-muted-foreground/70 rounded-md pl-9 pr-3 py-2.5 text-sm border border-border resize-none transition"
          />
        </div>

        <div>
          <label className="label-eyebrow block mb-1.5">Pandtype</label>
          <select
            value={selectedPandtype}
            onChange={(e) => setPandtype(e.target.value as PandType)}
            className="w-full bg-muted rounded-md px-2.5 py-2 text-sm border border-border"
          >
            <option value="woning">Woning (bestaand)</option>
            <option value="nieuwbouw">Nieuwbouw</option>
            <option value="commercieel">Commercieel (winkel/kantoor)</option>
            <option value="gemengd">Gemengd gebruik (woon/werk)</option>
          </select>
        </div>

        <button
          onClick={submit}
          disabled={loading || !q.trim()}
          className="w-full flex items-center justify-center gap-2 bg-navy disabled:opacity-40 disabled:cursor-not-allowed text-primary-foreground rounded-md py-2.5 text-sm font-bold tracking-wide transition shadow-card hover:shadow-elevated hover:brightness-110 active:scale-[0.99]"
        >
          {loading ? <Loader2 className="size-4 animate-spin" /> : <Search className="size-4" />}
          {loading ? "Data ophalen…" : "Analyseer"}
        </button>

        <button
          onClick={clearCache}
          type="button"
          className="w-full flex items-center justify-center gap-2 border border-border bg-muted text-foreground rounded-md py-2.5 text-sm font-semibold transition hover:bg-destructive/10 hover:text-destructive hover:border-destructive/30 active:scale-[0.99]"
        >
          <Trash2 className="size-4" />
          Zoekopdrachten Wissen
        </button>

        {loading && loadingStages && loadingStages.length > 0 && (
          <ul className="text-[11px] space-y-1 text-muted-foreground pt-1">
            {loadingStages.map((s, i) => (
              <li key={i} className="flex items-center gap-1.5">
                <span className="size-1 rounded-full bg-primary animate-pulse" />
                {s}
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* History */}
      <div className="p-4 flex-1 overflow-y-auto">
        <div className="flex items-center gap-1.5 label-eyebrow mb-3">
          <History className="size-3" /> Geschiedenis
        </div>
        {history.length === 0 && (
          <div className="text-xs text-muted-foreground/80">Nog geen analyses.</div>
        )}
        <ul className="space-y-1">
          {history.map((h) => {
            const active = current?.id === h.id;
            const fresh = Date.now() - h.timestamp < 23 * 3600 * 1000;
            return (
              <li
                key={h.id}
                className={`group rounded-md p-2.5 text-xs cursor-pointer border transition ${
                  active
                    ? "bg-muted border-primary/40 shadow-[inset_2px_0_0_var(--primary)]"
                    : "border-transparent hover:bg-muted hover:border-border"
                }`}
                onClick={() => onSelectHistory(h)}
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className={`size-1.5 rounded-full shrink-0 ${fresh ? "bg-positive" : "bg-muted-foreground/50"}`} />
                    <span className="truncate font-medium text-foreground">{h.pdok?.adres ?? h.input}</span>
                  </div>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      deleteAnalysis(h.id);
                      setHistory(loadHistory());
                    }}
                    className="opacity-0 group-hover:opacity-100 hover:text-destructive transition"
                    aria-label="Verwijder"
                  >
                    <Trash2 className="size-3" />
                  </button>
                </div>
                <div className="text-muted-foreground mt-1 tabular flex items-center gap-1.5">
                  <span className="capitalize">{h.pandtype}</span>
                  <span className="opacity-40">·</span>
                  <span className="text-navy font-semibold">{fmtEUR(h.ai.marktwaarde_ai)}</span>
                  <span className="opacity-40">·</span>
                  <span>{h.ai.score}/10</span>
                </div>
              </li>
            );
          })}
        </ul>
      </div>

      <div className="px-4 py-3 text-[10px] uppercase tracking-[0.15em] text-muted-foreground border-t border-sidebar-border flex items-center justify-between">
        <span>Cache 24u</span>
        <span className="text-navy font-semibold">VastgoedAI</span>
      </div>
    </aside>
  );
}
