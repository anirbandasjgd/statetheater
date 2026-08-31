export const ROW_ORDER = [
  "PA", "PB",
  "A", "B", "C", "D", "E", "F", "G", "H", "J", "K", "L", "M", "N",
  "O", "P", "Q", "R", "S", "T", "U", "V", "W", "X", "Y", "Z",
  "AA", "BB", "CC", "DD",
] as const;

const ROW_INDEX = Object.fromEntries(ROW_ORDER.map((r, i) => [r, i]));

const VIP_ROWS = new Set(["PA", "PB", "A", "B", "C", "D"]);
const PLATINUM_ROWS = new Set(["E", "F", "G", "H", "J", "K", "L", "M", "N", "O", "P"]);
const GOLD_ROWS = new Set(["Q", "R", "S", "T", "U", "V", "W", "X", "Y", "Z", "AA", "BB", "CC", "DD"]);

export type SeatTier = "VIP" | "Platinum" | "Gold" | "Balcony";

export function tierFor(section: string, row: string): SeatTier {
  if (section === "orchestra") {
    if (VIP_ROWS.has(row)) return "VIP";
    if (PLATINUM_ROWS.has(row)) return "Platinum";
    if (GOLD_ROWS.has(row)) return "Gold";
    return "Gold";
  }
  return "Balcony";
}

/** Orchestra: VIP $0 (PA–D), Platinum $125 (E–P), Gold $75 (Q–DD). Balcony unchanged. */
export function priceFor(section: string, row: string): number {
  if (section === "orchestra") {
    const tier = tierFor(section, row);
    if (tier === "VIP") return 0;
    if (tier === "Platinum") return 125;
    return 75;
  }
  const idx = ROW_INDEX[row];
  if (idx !== undefined && idx >= ROW_INDEX.A && idx <= ROW_INDEX.C) return 100;
  if (row === "A" || row === "B") return 100;
  return 50;
}
