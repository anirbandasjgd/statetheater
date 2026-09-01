"use client";

import { useEffect, useMemo, useState } from "react";
import type { PublicSeat, Section } from "@/lib/seats";
import { formatPrice, seatLabel, typeLabel } from "@/lib/seats";
import { TIER_COLORS, tierFor, type SeatTier } from "@/lib/pricing";
import { SeatMap } from "@/components/SeatMap";
import { Checkout } from "@/components/Checkout";

export default function HomePage() {
  const [section, setSection] = useState<Section>("orchestra");
  const [seats, setSeats] = useState<PublicSeat[]>([]);
  const [selected, setSelected] = useState<string[]>([]);
  const [hover, setHover] = useState<PublicSeat | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function load(nextSection: Section, silent = false) {
    if (!silent) setLoading(true);
    setError(null);
    const res = await fetch(`/api/seats?section=${nextSection}`, { cache: "no-store" });
    if (!res.ok) {
      setError("Could not load seats.");
      setLoading(false);
      return;
    }
    const data = (await res.json()) as PublicSeat[];
    setSeats(data);
    setLoading(false);
  }

  useEffect(() => {
    void load(section);
  }, [section]);

  const selectedSeats = useMemo(
    () => selected.map((id) => seats.find((s) => s.id === id)).filter(Boolean) as PublicSeat[],
    [selected, seats],
  );

  function toggle(seat: PublicSeat) {
    if (seat.status !== "available") return;
    setSelected((cur) => (cur.includes(seat.id) ? cur.filter((id) => id !== seat.id) : [...cur, seat.id]));
  }

  function switchSection(next: Section) {
    setSection(next);
    setSelected([]);
    setHover(null);
  }

  return (
    <div className="min-h-dvh max-lg:flex max-lg:h-[100svh] max-lg:flex-col max-lg:overflow-hidden">
      <header className="shrink-0 border-b border-[#3a2a22] px-3 py-2 lg:px-6 lg:py-4">
        <div className="mx-auto flex max-w-[1400px] flex-wrap items-end justify-between gap-2">
          <div>
            <p className="hidden text-xs tracking-[0.28em] text-[#d4a24a] uppercase lg:block">State Theatre New Jersey</p>
            <h1 className="text-lg text-[#f4ece0] lg:mt-1 lg:text-2xl">Reserve your seats</h1>
          </div>
          <nav className="flex gap-2">
            {(["orchestra", "balcony"] as Section[]).map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => switchSection(s)}
                className={`rounded-full px-4 py-1.5 text-sm capitalize ${
                  section === s ? "bg-[#d4a24a] text-[#1a100c]" : "border border-[#d4a24a]/40 text-[#f0d49a]"
                }`}
              >
                {s}
              </button>
            ))}
            <a href="/admin" className="rounded-full px-4 py-1.5 text-sm text-[#f0d49a]/70 hover:text-[#f0d49a]">
              Registrations
            </a>
          </nav>
        </div>
      </header>

      <main className="mx-auto flex min-h-0 w-full max-w-[1400px] flex-1 flex-col gap-2 px-2 py-2 lg:grid lg:grid-cols-[1fr_340px] lg:gap-6 lg:overflow-visible lg:px-4 lg:py-6">
        <section className="flex min-h-0 min-w-0 flex-1 flex-col">
          <div className="mb-2 hidden shrink-0 text-sm text-[#f0d49a]/80 lg:block">
            <p>
              Click a seat to select it. Click again to release it. You can hold several seats, then register.
            </p>
            <p className="mt-1 min-h-[1.75rem] overflow-hidden text-ellipsis whitespace-nowrap text-[#f0d49a]">
              {hover ? `${seatLabel(hover)} · ${tierFor(hover.section, hover.row, hover.block)} · ${formatPrice(hover.price)} · ${typeLabel(hover.type)}` : "\u00a0"}
            </p>
          </div>
          <PriceLegend section={section} />
          {error ? <p className="text-red-300">{error}</p> : null}
          <div className="min-h-0 flex-1">
            {loading ? (
              <p className="py-24 text-center text-[#f0d49a]/60">Loading {section} map…</p>
            ) : (
              <SeatMap
                section={section}
                seats={seats}
                selectedIds={selected}
                onHover={setHover}
                onToggle={toggle}
              />
            )}
          </div>
          <Legend />
        </section>
        <Checkout
          seats={selectedSeats}
          onRemove={(id) => setSelected((cur) => cur.filter((x) => x !== id))}
          onClear={() => setSelected([])}
          onSuccess={async () => {
            setSelected([]);
            await load(section, true);
          }}
        />
      </main>
    </div>
  );
}

function PriceLegend({ section }: { section: Section }) {
  const items: { tier: SeatTier; label: string; price: string }[] =
    section === "orchestra"
      ? [
          { tier: "VIP", label: "VIP PA–D", price: "$0" },
          { tier: "Platinum", label: "Platinum E–P", price: "$125" },
          { tier: "Gold", label: "Gold Q–DD", price: "$75" },
        ]
      : [
          { tier: "Gold", label: "Gold A–C", price: "$75" },
          { tier: "Silver", label: "Silver D–V", price: "$50" },
          { tier: "Student", label: "Student W–CC", price: "$40" },
          { tier: "Box", label: "Box Left/Right", price: "$1000" },
        ];
  return (
    <ul className="mb-2 flex shrink-0 flex-wrap gap-x-4 gap-y-1 text-[11px] text-[#f0d49a]/80 lg:text-xs">
      {items.map((item) => {
        const colors = TIER_COLORS[item.tier];
        return (
          <li key={item.label} className="flex items-center gap-1.5">
            <span
              className="inline-block h-2.5 w-2.5 rounded-[2px] border"
              style={{ borderColor: colors.border, backgroundColor: colors.fill }}
            />
            {item.label} {item.price}
          </li>
        );
      })}
    </ul>
  );
}

function Legend() {
  const items = [
    { label: "Selected", className: "border-[#d4a24a] bg-[#d4a24a]" },
    { label: "Taken", className: "border-[#d4a24a] bg-[#d4a24a] opacity-80" },
    { label: "Kill", className: "border-black bg-[#141414]" },
    { label: "STNJ Hold", className: "border-[#3b82f6] bg-[#1e3a8a]" },
    { label: "ADA", className: "border-[#dc2626] bg-[#4a3428]" },
    { label: "Companion (c)", className: "border-[#e6c84a] bg-[#e6c84a]/80" },
    { label: "Transfer (t)", className: "border-[#e08a3c] bg-[#e08a3c]/80" },
  ];
  return (
    <ul className="mt-2 hidden shrink-0 flex-wrap gap-4 text-xs text-[#f0d49a]/70 lg:mt-4 lg:flex">
      {items.map((item) => (
        <li key={item.label} className="flex items-center gap-2">
          <span className={`inline-block h-3 w-3 rounded-full border ${item.className}`} />
          {item.label}
        </li>
      ))}
    </ul>
  );
}
