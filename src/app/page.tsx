"use client";

import { useEffect, useMemo, useState } from "react";
import type { PublicSeat, Section } from "@/lib/seats";
import { formatPrice, seatLabel } from "@/lib/seats";
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
    <div className="min-h-screen">
      <header className="border-b border-[#3a2a22] px-6 py-4">
        <div className="mx-auto flex max-w-[1400px] flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-xs tracking-[0.28em] text-[#d4a24a] uppercase">State Theatre New Jersey</p>
            <h1 className="mt-1 text-2xl text-[#f4ece0]">Reserve your seats</h1>
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

      <main className="mx-auto grid max-w-[1400px] gap-6 px-4 py-6 lg:grid-cols-[1fr_340px]">
        <section className="min-w-0">
          <div className="mb-3 text-sm text-[#f0d49a]/80">
            <p>
              Click a seat to select it. Click again to release it. You can hold several seats, then register.
            </p>
            <p className="mt-1 min-h-[1.75rem] overflow-hidden text-ellipsis whitespace-nowrap text-[#f0d49a]">
              {hover ? `${seatLabel(hover)} · ${formatPrice(hover.price)} · ${hover.type}` : "\u00a0"}
            </p>
          </div>
          {error ? <p className="text-red-300">{error}</p> : null}
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

function Legend() {
  const items = [
    { label: "Available", className: "border-[#d4a24a]/70 bg-transparent" },
    { label: "Selected", className: "border-[#d4a24a] bg-[#d4a24a]" },
    { label: "Taken", className: "border-[#d4a24a] bg-[#d4a24a] opacity-80" },
    { label: "Companion (c)", className: "border-[#e6c84a] bg-[#e6c84a]/80" },
    { label: "Transfer (t)", className: "border-[#e08a3c] bg-[#e08a3c]/80" },
  ];
  return (
    <ul className="mt-4 flex flex-wrap gap-4 text-xs text-[#f0d49a]/70">
      {items.map((item) => (
        <li key={item.label} className="flex items-center gap-2">
          <span className={`inline-block h-3 w-3 rounded-full border ${item.className}`} />
          {item.label}
        </li>
      ))}
    </ul>
  );
}
