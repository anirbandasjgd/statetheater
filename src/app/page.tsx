"use client";

import { useEffect, useMemo, useState } from "react";
import type { PublicSeat, Section } from "@/lib/seats";
import { formatPrice, seatLabel, typeLabel } from "@/lib/seats";
import { TIER_COLORS, sameSeatBand, tierFor, type SeatTier } from "@/lib/pricing";
import { SeatMap } from "@/components/SeatMap";
import { Checkout } from "@/components/Checkout";

type SeatsResponse = { admin?: boolean; seats?: PublicSeat[] } | PublicSeat[];

export default function HomePage() {
  const [section, setSection] = useState<Section>("orchestra");
  const [seats, setSeats] = useState<PublicSeat[]>([]);
  const [isAdmin, setIsAdmin] = useState(false);
  const [moveMode, setMoveMode] = useState(false);
  const [sourceIds, setSourceIds] = useState<string[]>([]);
  const [replacementIds, setReplacementIds] = useState<string[]>([]);
  const [moveNote, setMoveNote] = useState<string | null>(null);
  const [moveBusy, setMoveBusy] = useState(false);
  const [selected, setSelected] = useState<string[]>([]);
  const [hover, setHover] = useState<PublicSeat | null>(null);
  const [checkoutOpen, setCheckoutOpen] = useState(false);
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
    const data = (await res.json()) as SeatsResponse;
    const list = Array.isArray(data) ? data : (data.seats ?? []);
    setIsAdmin(Array.isArray(data) ? false : Boolean(data.admin));
    setSeats(list);
    setLoading(false);
  }

  useEffect(() => {
    void load(section);
  }, [section]);

  const selectedSeats = useMemo(
    () => selected.map((id) => seats.find((s) => s.id === id)).filter(Boolean) as PublicSeat[],
    [selected, seats],
  );

  const sourceSeats = useMemo(
    () => sourceIds.map((id) => seats.find((s) => s.id === id)).filter(Boolean) as PublicSeat[],
    [sourceIds, seats],
  );

  const sourceAnchor = sourceSeats[0] ?? null;
  const sourceTier = sourceAnchor ? tierFor(sourceAnchor.section, sourceAnchor.row, sourceAnchor.block) : null;
  const sourceName = sourceAnchor?.holderName ?? "Guest";

  function clearMove() {
    setSourceIds([]);
    setReplacementIds([]);
    setMoveNote(null);
  }

  function toggleMoveMode() {
    const next = !moveMode;
    setMoveMode(next);
    setSelected([]);
    setCheckoutOpen(false);
    clearMove();
  }

  function toggle(seat: PublicSeat) {
    if (!moveMode) {
      if (seat.status !== "available") return;
      setSelected((cur) => (cur.includes(seat.id) ? cur.filter((id) => id !== seat.id) : [...cur, seat.id]));
      return;
    }

    if (seat.status === "sold") {
      if (seat.ticketDelivered) {
        setSourceIds([]);
        setReplacementIds([]);
        setMoveNote(`${seat.holderName ?? "This guest"}: ticket already issued`);
        return;
      }
      const party = seats
        .filter(
          (item) =>
            item.status === "sold" &&
            item.registrationId &&
            item.registrationId === seat.registrationId &&
            sameSeatBand(item, seat),
        )
        .map((item) => item.id);
      setSourceIds(party);
      setReplacementIds([]);
      setMoveNote(null);
      return;
    }

    if (seat.status !== "available" || seat.type === "hold") return;
    if (sourceIds.length === 0) {
      setMoveNote("Click a sold seat first.");
      return;
    }
    if (!sourceAnchor || !sameSeatBand(seat, sourceAnchor)) {
      setMoveNote(`Pick ${sourceTier} seats in this section.`);
      return;
    }
    setReplacementIds((cur) => {
      if (cur.includes(seat.id)) return cur.filter((id) => id !== seat.id);
      if (cur.length >= sourceIds.length) return cur;
      return [...cur, seat.id];
    });
    setMoveNote(null);
  }

  async function confirmMove() {
    if (!sourceAnchor || replacementIds.length !== sourceIds.length || moveBusy) return;
    setMoveBusy(true);
    setError(null);
    const res = await fetch("/api/registrations/reassign", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ fromSeatId: sourceAnchor.id, newSeatIds: replacementIds }),
    });
    const data = await res.json().catch(() => null);
    setMoveBusy(false);
    if (!res.ok) {
      setError(data?.error ?? "Could not move those seats.");
      return;
    }
    clearMove();
    await load(section, true);
  }

  function switchSection(next: Section) {
    setSection(next);
    setSelected([]);
    setHover(null);
    clearMove();
  }

  return (
    <div className="flex h-[100svh] flex-col overflow-hidden">
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
            {isAdmin ? (
              <button
                type="button"
                onClick={toggleMoveMode}
                className={`rounded-full px-4 py-1.5 text-sm ${
                  moveMode ? "bg-[#67e8f9] text-[#083344]" : "border border-[#67e8f9]/50 text-[#a5f3fc]"
                }`}
              >
                Move seats
              </button>
            ) : null}
            <a href="/admin" className="rounded-full px-4 py-1.5 text-sm text-[#f0d49a]/70 hover:text-[#f0d49a]">
              Registrations
            </a>
          </nav>
        </div>
      </header>

      <main
        className={`mx-auto flex min-h-0 w-full max-w-[1400px] flex-1 flex-col gap-2 px-2 py-2 lg:gap-6 lg:px-4 lg:py-6 ${
          checkoutOpen && !moveMode ? "lg:grid lg:grid-cols-[1fr_340px] lg:grid-rows-[minmax(0,1fr)]" : ""
        }`}
      >
        <section className="flex min-h-0 min-w-0 flex-1 flex-col">
          <div className="mb-2 hidden shrink-0 text-sm text-[#f0d49a]/80 lg:block">
            <p>
              {moveMode
                ? "Click a sold seat, then the same number of open seats in that tier. Tickets already issued cannot be moved."
                : "Click a seat to select it. Click again to release it. You can hold several seats, then register."}
            </p>
            <p className="mt-1 min-h-[1.75rem] overflow-hidden text-ellipsis whitespace-nowrap text-[#f0d49a]">
              {hover
                ? `${seatLabel(hover)} · ${tierFor(hover.section, hover.row, hover.block)} · ${formatPrice(hover.price)} · ${typeLabel(hover.type)}${hover.holderName ? ` · ${hover.holderName}` : ""}${hover.ticketDelivered ? " · issued" : ""}`
                : "\u00a0"}
            </p>
          </div>
          <PriceLegend section={section} />
          {moveMode && sourceIds.length > 0 ? (
            <div className="mb-2 flex flex-wrap items-center justify-between gap-2 rounded-lg border border-[#67e8f9]/40 bg-[#083344]/60 px-3 py-2 text-sm text-[#ecfeff]">
              <p>
                Moving {sourceName} · {sourceIds.length} {sourceAnchor?.section === "orchestra" ? "Orchestra" : "Balcony"}{" "}
                {sourceTier} · pick {sourceIds.length} ({replacementIds.length} selected)
              </p>
              <div className="flex gap-2">
                <button type="button" className="text-[#a5f3fc] hover:text-white" onClick={clearMove}>
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={replacementIds.length !== sourceIds.length || moveBusy}
                  className="rounded-full bg-[#67e8f9] px-3 py-1 text-[#083344] disabled:opacity-40"
                  onClick={() => void confirmMove()}
                >
                  {moveBusy ? "Moving…" : "Move"}
                </button>
              </div>
            </div>
          ) : null}
          {moveNote ? (
            <p
              className={
                moveNote.toLowerCase().includes("already issued")
                  ? "mb-2 rounded-lg border border-[#fbbf24] bg-[#fde68a] px-3 py-2 text-sm font-medium leading-snug text-[#1a100c]"
                  : "mb-2 rounded-lg border border-[#67e8f9]/50 bg-[#083344] px-3 py-2 text-sm leading-snug text-[#ecfeff]"
              }
            >
              {moveNote}
            </p>
          ) : null}
          {error ? (
            <p className="mb-2 rounded-lg border border-[#fca5a5] bg-[#7f1d1d] px-3 py-2 text-sm font-medium leading-snug text-[#fee2e2]">
              {error}
            </p>
          ) : null}
          <div className="min-h-0 flex-1">
            {loading ? (
              <p className="py-24 text-center text-[#f0d49a]/60">Loading {section} map…</p>
            ) : (
              <SeatMap
                section={section}
                seats={seats}
                selectedIds={moveMode ? [] : selected}
                sourceIds={sourceIds}
                replacementIds={replacementIds}
                moveMode={moveMode}
                onHover={setHover}
                onToggle={toggle}
              />
            )}
          </div>
          <Legend moveMode={moveMode} />
        </section>
        {moveMode ? null : (
          <Checkout
            seats={selectedSeats}
            open={checkoutOpen}
            onOpenChange={setCheckoutOpen}
            onRemove={(id) => setSelected((cur) => cur.filter((x) => x !== id))}
            onClear={() => setSelected([])}
            onSuccess={async () => {
              setSelected([]);
              await load(section, true);
            }}
          />
        )}
      </main>
    </div>
  );
}

function PriceLegend({ section }: { section: Section }) {
  const items: { tier: SeatTier; label: string; price: string }[] =
    section === "orchestra"
      ? [
          { tier: "VIP", label: "VIP PA–D", price: "$0" },
          { tier: "Platinum", label: "Platinum E–O", price: "$125" },
          { tier: "Gold", label: "Gold P–DD", price: "$75" },
        ]
      : [
          { tier: "Platinum", label: "Platinum A–C", price: "$125" },
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
      <li className="flex items-center text-[#f0d49a]/55">ADA / companion in Platinum &amp; Gold $40</li>
    </ul>
  );
}

function Legend({ moveMode }: { moveMode?: boolean }) {
  const items = [
    { label: "Selected", className: "border-[#d4a24a] bg-[#d4a24a]" },
    { label: "Taken", className: "border-[#d4a24a] bg-[#d4a24a] opacity-80" },
    ...(moveMode
      ? [
          { label: "Moving", className: "border-[#67e8f9] bg-[#155e75]" },
          { label: "Replacement", className: "border-[#f8f1e3] bg-[#d4a24a]" },
        ]
      : []),
    { label: "Kill", className: "border-black bg-[#141414]" },
    { label: "STNJ Hold", className: "border-[#3b82f6] bg-[#1e3a8a]" },
    { label: "ADA", className: "border-[#dc2626] bg-[#4a3428]" },
    { label: "Companion (c)", className: "border-[#22c55e] bg-transparent" },
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
