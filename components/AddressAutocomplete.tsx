'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { MapPin, Loader2 } from 'lucide-react';

export interface AddressSuggestion {
  id: string;
  weergavenaam: string;
  straatnaam?: string;
  huisnummer?: string;
  huisletter?: string;
  postcode?: string;
  woonplaatsnaam?: string;
  gemeentenaam?: string;
}

interface Props {
  value: string;
  onChange: (value: string) => void;
  onSelect: (suggestion: AddressSuggestion) => void;
  placeholder?: string;
  className?: string;
}

export default function AddressAutocomplete({
  value,
  onChange,
  onSelect,
  placeholder = 'Bijv. Keizersgracht 123, Amsterdam',
  className = '',
}: Props) {
  const [suggestions, setSuggestions] = useState<AddressSuggestion[]>([]);
  const [loading, setLoading]         = useState(false);
  const [open, setOpen]               = useState(false);
  const [activeIdx, setActiveIdx]     = useState(-1);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const fetchSuggestions = useCallback(async (q: string) => {
    if (q.length < 3) { setSuggestions([]); setOpen(false); return; }
    setLoading(true);
    try {
      const url =
        `https://api.pdok.nl/bzk/locatieserver/search/v3_1/suggest` +
        `?q=${encodeURIComponent(q)}&fq=type:adres&rows=8` +
        `&fl=id,weergavenaam,straatnaam,huisnummer,huisletter,postcode,woonplaatsnaam,gemeentenaam`;
      const res  = await fetch(url);
      const data = await res.json();
      const docs: AddressSuggestion[] = data?.response?.docs ?? [];
      setSuggestions(docs);
      setOpen(docs.length > 0);
      setActiveIdx(-1);
    } catch {
      setSuggestions([]);
      setOpen(false);
    } finally {
      setLoading(false);
    }
  }, []);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    onChange(val);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => fetchSuggestions(val), 280);
  };

  const handleSelect = (s: AddressSuggestion) => {
    onChange(s.weergavenaam);
    setSuggestions([]);
    setOpen(false);
    onSelect(s);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!open) return;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActiveIdx(i => Math.min(i + 1, suggestions.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveIdx(i => Math.max(i - 1, 0));
    } else if (e.key === 'Enter' && activeIdx >= 0) {
      e.preventDefault();
      handleSelect(suggestions[activeIdx]);
    } else if (e.key === 'Escape') {
      setOpen(false);
    }
  };

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  return (
    <div ref={containerRef} className="relative">
      <div className="relative">
        <input
          type="text"
          value={value}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          onFocus={() => suggestions.length > 0 && setOpen(true)}
          placeholder={placeholder}
          autoComplete="off"
          className={`${className} pr-8`}
        />
        {loading && (
          <Loader2 className="absolute right-2.5 top-1/2 -translate-y-1/2 size-4 animate-spin text-muted-foreground pointer-events-none" />
        )}
      </div>

      {open && suggestions.length > 0 && (
        <ul className="absolute z-50 w-full mt-1 bg-card border border-border rounded-md shadow-lg overflow-hidden max-h-72 overflow-y-auto">
          {suggestions.map((s, i) => (
            <li
              key={s.id}
              onMouseDown={() => handleSelect(s)}
              className={`flex items-start gap-2.5 px-3 py-2.5 cursor-pointer text-sm transition-colors ${
                i === activeIdx ? 'bg-muted' : 'hover:bg-muted/60'
              }`}
            >
              <MapPin className="size-3.5 shrink-0 mt-0.5 text-muted-foreground" />
              <div className="min-w-0">
                <span className="font-medium text-foreground">
                  {[s.straatnaam, s.huisnummer, s.huisletter].filter(Boolean).join(' ')}
                </span>
                <span className="text-muted-foreground ml-1.5 text-[12px]">
                  {[s.postcode, s.woonplaatsnaam].filter(Boolean).join(' · ')}
                </span>
                {s.gemeentenaam && s.gemeentenaam !== s.woonplaatsnaam && (
                  <span className="text-muted-foreground/60 ml-1 text-[11px]">
                    ({s.gemeentenaam})
                  </span>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
