"use client";

import { useMemo, type CSSProperties } from "react";
import type { PublicSeat, Section } from "@/lib/seats";
import { formatPrice, seatLabel } from "@/lib/seats";
import { TIER_COLORS, tierFor } from "@/lib/pricing";

type Props = {
  section: Section;
  seats: PublicSeat[];
  selectedIds: string[];
  onHover: (seat: PublicSeat | null) => void;
  onToggle: (seat: PublicSeat) => void;
};

function compactAxis(values: number[]) {
  const unique = [...new Set(values)].sort((a, b) => a - b);
  const map = new Map<number, number>();
  let cursor = 1;
  let prev: number | null = null;
  for (const value of unique) {
    if (prev !== null && value - prev > 1) cursor += 1;
    map.set(value, cursor);
    cursor += 1;
    prev = value;
  }
  return { map, size: cursor - 1 };
}

export function SeatMap({ section, seats, selectedIds, onHover, onToggle }: Props) {
  const selected = new Set(selectedIds);
  const layout = useMemo(() => {
    if (seats.length === 0) {
      return {
        cols: 1,
        rows: 1,
        colOf: new Map<number, number>(),
        rowOf: new Map<number, number>(),
        rowLetters: new Map<number, string>(),
      };
    }
    const xAxis = compactAxis(seats.map((s) => s.x));
    const yAxis = compactAxis(seats.map((s) => s.y));
    const rowLetters = new Map<number, string>();
    for (const seat of seats) {
      const gridRow = yAxis.map.get(seat.y);
      if (gridRow && !rowLetters.has(gridRow)) rowLetters.set(gridRow, seat.row);
    }
    return {
      cols: xAxis.size,
      rows: yAxis.size,
      colOf: xAxis.map,
      rowOf: yAxis.map,
      rowLetters,
    };
  }, [seats]);

  const colCount = layout.cols + 2;

  return (
    <div className="seat-map-scroll h-full max-h-[calc(100dvh-13.5rem)] overflow-auto rounded-xl border border-[#3a2a22] bg-[#1a1010] px-2 py-2 max-lg:max-h-none [overflow-anchor:none] [overscroll-behavior:contain] lg:px-6 lg:py-4">
      {section === "balcony" ? (
        <p className="mb-3 text-center text-xs tracking-[0.25em] text-[#d4a24a] uppercase">Balcony</p>
      ) : null}
      <div
        className="seat-grid mx-auto w-max"
        style={{
          display: "grid",
          gridTemplateColumns: `var(--seat-label) repeat(${layout.cols}, var(--seat-w)) var(--seat-label)`,
          gridTemplateRows: `repeat(${layout.rows}, var(--seat-h))`,
          gap: "2px",
        }}
      >
        {[...layout.rowLetters.entries()].map(([gridRow, letter]) => (
          <div key={`labels-${gridRow}`} className="contents">
            <span
              className="flex items-center justify-center text-[10px] text-[#d4a24a]"
              style={{ gridColumn: 1, gridRow }}
            >
              {letter}
            </span>
            <span
              className="flex items-center justify-center text-[10px] text-[#d4a24a]"
              style={{ gridColumn: colCount, gridRow }}
            >
              {letter}
            </span>
          </div>
        ))}
        {seats.map((seat) => {
          const isSelected = selected.has(seat.id);
          const taken = seat.status !== "available";
          const suffix = seat.type === "companion" ? "c" : seat.type === "transfer" ? "t" : "";
          return (
            <button
              key={seat.id}
              type="button"
              disabled={taken}
              aria-pressed={isSelected}
              aria-label={`${seatLabel(seat)}${seat.type === "ada" ? ", ADA" : ""}, ${formatPrice(seat.price)}${taken ? ", unavailable" : ""}`}
              title={`${seatLabel(seat)} · ${tierFor(seat.section, seat.row, seat.block)} · ${formatPrice(seat.price)}`}
              className={seatClass(seat, isSelected)}
              style={{
                gridColumn: (layout.colOf.get(seat.x) ?? 1) + 1,
                gridRow: layout.rowOf.get(seat.y) ?? 1,
                ...seatTint(seat, isSelected),
              }}
              onMouseEnter={() => onHover(seat)}
              onMouseLeave={() => onHover(null)}
              onFocus={() => onHover(seat)}
              onBlur={() => onHover(null)}
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => onToggle(seat)}
            >
              {seat.number}
              {suffix}
            </button>
          );
        })}
      </div>
      {section === "orchestra" ? (
        <div className="mx-auto mt-4 max-w-xl rounded-sm bg-[#7a1f1f] py-2 text-center text-xs tracking-[0.4em] text-[#f4ece0]">
          STAGE
        </div>
      ) : (
        <p className="mt-4 text-center text-[10px] tracking-[0.2em] text-[#f0d49a]/50 uppercase">Toward stage</p>
      )}
    </div>
  );
}

function seatClass(seat: PublicSeat, isSelected: boolean) {
  const base =
    "flex items-center justify-center rounded-[3px] text-[10px] leading-none tabular-nums border outline-none [scroll-margin:0]";
  if (seat.status === "sold") {
    return `${base} cursor-not-allowed border-[#f0d49a] bg-[#d4a24a] text-[#1a100c] opacity-80`;
  }
  if (seat.status === "blocked") {
    return `${base} cursor-not-allowed border-2 border-black bg-[#141414] text-[#6a6a6a]`;
  }
  if (isSelected) {
    if (seat.type === "ada") {
      return `${base} cursor-pointer border-2 border-[#dc2626] bg-[#d4a24a] text-[#1a100c]`;
    }
    return `${base} cursor-pointer border-[#f0d49a] bg-[#d4a24a] text-[#1a100c]`;
  }
  const dashed = seat.type === "transfer" ? "border-dashed" : "";
  const thick = seat.type === "ada" ? "border-2" : "";
  return `${base} ${thick} ${dashed} cursor-pointer hover:brightness-125`;
}

function seatTint(seat: PublicSeat, isSelected: boolean): CSSProperties | undefined {
  if (seat.status === "sold" || seat.status === "blocked" || isSelected) return undefined;
  const colors = TIER_COLORS[tierFor(seat.section, seat.row, seat.block)];
  return {
    borderColor: seat.type === "ada" ? "#dc2626" : colors.border,
    backgroundColor: colors.fill,
    color: colors.text,
  };
}
