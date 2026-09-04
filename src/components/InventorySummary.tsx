import { formatPrice } from "@/lib/seats";
import type { InventorySection, InventoryTierRow } from "@/lib/inventory";

function pct(selected: number, total: number) {
  if (total <= 0) return 0;
  return Math.round((selected / total) * 100);
}

function Meter({ selected, total }: { selected: number; total: number }) {
  const width = total <= 0 ? 0 : Math.min(100, (selected / total) * 100);
  return (
    <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-[#2a1c18]" aria-hidden>
      <div className="h-full rounded-full bg-[#d4a24a]" style={{ width: `${width}%` }} />
    </div>
  );
}

function TypeSplit({
  label,
  selected,
  total,
  color,
}: {
  label: string;
  selected: number;
  total: number;
  color: string;
}) {
  return (
    <span className="flex items-baseline gap-1">
      <span style={{ color }}>{label}</span>
      <span className="tabular-nums text-[#f0d49a]/70">
        {selected}
        <span className="text-[#f0d49a]/45"> / {total}</span>
      </span>
    </span>
  );
}

function TierRow({ row }: { row: InventoryTierRow }) {
  return (
    <li>
      <div className="flex items-baseline justify-between gap-3">
        <div>
          <span className="text-[#f4ece0]">{row.tier}</span>
          <span className="ml-2 text-xs text-[#f0d49a]/55">
            {row.note} · {formatPrice(row.price)}
          </span>
        </div>
        <div className="shrink-0 font-sans text-sm tabular-nums text-[#d4a24a]">
          {row.selected}
          <span className="text-[#f0d49a]/50"> / {row.total}</span>
        </div>
      </div>
      <Meter selected={row.selected} total={row.total} />
      {row.adaTotal > 0 || row.companionTotal > 0 ? (
        <p className="mt-1.5 flex flex-wrap gap-x-4 gap-y-0.5 font-sans text-[11px]">
          {row.adaTotal > 0 ? (
            <TypeSplit label="ADA" selected={row.adaSelected} total={row.adaTotal} color="#dc2626" />
          ) : null}
          {row.companionTotal > 0 ? (
            <TypeSplit
              label="Companion"
              selected={row.companionSelected}
              total={row.companionTotal}
              color="#22c55e"
            />
          ) : null}
          {row.tier === "Platinum" || row.tier === "Gold" ? (
            <span className="text-[#f0d49a]/45">ADA / companion $40</span>
          ) : null}
        </p>
      ) : null}
    </li>
  );
}

function SectionCard({ section }: { section: InventorySection }) {
  return (
    <article className="rounded-xl border border-[#3a2a22] bg-[#1d1412] p-4">
      <div className="flex items-baseline justify-between gap-3">
        <h2 className="text-lg text-[#f4ece0]">{section.label}</h2>
        <p className="font-sans text-sm tabular-nums text-[#d4a24a]">
          {section.selected}
          <span className="text-[#f0d49a]/50"> / {section.total}</span>
          <span className="ml-2 text-xs text-[#f0d49a]/45">{pct(section.selected, section.total)}%</span>
        </p>
      </div>
      <ul className="mt-4 space-y-3">
        {section.tiers.map((row) => (
          <TierRow key={`${section.section}-${row.tier}`} row={row} />
        ))}
      </ul>
      <div className="mt-4 flex items-baseline justify-between border-t border-[#3a2a22] pt-3">
        <span className="text-sm text-[#f0d49a]/70">{section.label} Revenue</span>
        <span className="font-sans text-sm tabular-nums text-[#d4a24a]">{formatPrice(section.revenue)}</span>
      </div>
    </article>
  );
}

export function InventorySummary({ inventory }: { inventory: InventorySection[] }) {
  const selected = inventory.reduce((sum, section) => sum + section.selected, 0);
  const total = inventory.reduce((sum, section) => sum + section.total, 0);
  const revenue = inventory.reduce((sum, section) => sum + section.revenue, 0);

  return (
    <section className="mt-8">
      <div className="flex items-end justify-between gap-4">
        <h2 className="text-sm tracking-[0.18em] text-[#d4a24a] uppercase">Seat inventory</h2>
        <div className="text-right">
          <p className="font-sans text-sm tabular-nums text-[#f0d49a]/80">
            {selected} of {total} sellable seats registered
          </p>
          <p className="mt-1 font-sans text-sm tabular-nums text-[#d4a24a]">
            Total Revenue {formatPrice(revenue)}
          </p>
        </div>
      </div>
      <div className="mt-3 grid gap-4 md:grid-cols-2">
        {inventory.map((section) => (
          <SectionCard key={section.section} section={section} />
        ))}
      </div>
      <p className="mt-2 text-xs text-[#f0d49a]/45">Kill seats are excluded from these totals.</p>
    </section>
  );
}
