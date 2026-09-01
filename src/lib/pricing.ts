export const ROW_ORDER = [
  "PA", "PB",
  "A", "B", "C", "D", "E", "F", "G", "H", "J", "K", "L", "M", "N",
  "O", "P", "Q", "R", "S", "T", "U", "V", "W", "X", "Y", "Z",
  "AA", "BB", "CC", "DD",
] as const;

const ORCHESTRA_VIP = new Set(["PA", "PB", "A", "B", "C", "D"]);
const ORCHESTRA_PLATINUM = new Set(["E", "F", "G", "H", "J", "K", "L", "M", "N", "O", "P"]);
const BALCONY_GOLD = new Set(["A", "B", "C"]);
const BALCONY_SILVER = new Set(["D", "E", "F", "G", "H", "J", "K", "L", "M", "N", "O", "P", "Q", "R", "S", "T", "U", "V"]);
const BALCONY_STUDENT = new Set(["W", "X", "Y", "Z", "AA", "BB", "CC"]);

export type SeatTier = "VIP" | "Platinum" | "Gold" | "Silver" | "Student";

export function tierFor(section: string, row: string): SeatTier {
  if (section === "orchestra") {
    if (ORCHESTRA_VIP.has(row)) return "VIP";
    if (ORCHESTRA_PLATINUM.has(row)) return "Platinum";
    return "Gold";
  }
  if (BALCONY_GOLD.has(row)) return "Gold";
  if (BALCONY_SILVER.has(row)) return "Silver";
  return "Student";
}

export function priceFor(section: string, row: string): number {
  const tier = tierFor(section, row);
  if (section === "orchestra") {
    if (tier === "VIP") return 0;
    if (tier === "Platinum") return 125;
    return 75;
  }
  if (tier === "Gold") return 75;
  if (tier === "Silver") return 50;
  return 40;
}
