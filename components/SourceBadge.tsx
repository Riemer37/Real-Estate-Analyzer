import type { DataSource } from "@/lib/types";

const SOURCE_LABELS: Record<DataSource, string> = {
  funda: "Funda",
  ep_online: "EP-online",
  altum_ai: "Altum AI",
  bag: "BAG",
  handmatig: "Handmatig",
  schatting: "Schatting",
};

const SOURCE_STYLES: Record<DataSource, string> = {
  funda: "source-funda",
  ep_online: "source-ep",
  altum_ai: "source-altum",
  bag: "source-bag",
  handmatig: "source-manual",
  schatting: "source-estimate",
};

export function SourceBadge({ source }: { source?: DataSource }) {
  const s = source ?? "schatting";
  return (
    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${SOURCE_STYLES[s]}`}>
      {SOURCE_LABELS[s]}
    </span>
  );
}
