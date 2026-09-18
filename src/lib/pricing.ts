export const ROW_ORDER = [
  "PA", "PB",
  "A", "B", "C", "D", "E", "F", "G", "H", "J", "K", "L", "M", "N",
  "O", "P", "Q", "R", "S", "T", "U", "V", "W", "X", "Y", "Z",
  "AA", "BB", "CC", "DD",
] as const;

const ORCHESTRA_VIP = new Set(["PA", "PB", "A", "B", "C", "D"]);
const ORCHESTRA_PLATINUM = new Set(["E", "F", "G", "H", "J", "K", "L", "M", "N", "O"]);
const BALCONY_PLATINUM = new Set(["A", "B", "C"]);
const BALCONY_SILVER = new Set(["D", "E", "F", "G", "H", "J", "K", "L", "M", "N", "O", "P", "Q", "R", "S", "T", "U", "V"]);
const BALCONY_BOX_BLOCKS = new Set(["boxLeft", "boxRight", "vipBoxLeft", "vipBoxRight"]);

export type SeatTier = "VIP" | "Platinum" | "Gold" | "Silver" | "Student" | "Box";

export const TIER_COLORS: Record<
  SeatTier,
  { border: string; fill: string; text: string; selectedFill: string; selectedText: string }
> = {
  VIP: { border: "#f8f1e3", fill: "#6a6152", text: "#f8f1e3", selectedFill: "#c4b498", selectedText: "#1a1610" },
  Platinum: { border: "#c4b5fd", fill: "#3d3460", text: "#ddd6fe", selectedFill: "#9b8ad4", selectedText: "#1a1528" },
  Gold: { border: "#d4a24a", fill: "#4a3618", text: "#f0d49a", selectedFill: "#c4943a", selectedText: "#1a100c" },
  Silver: { border: "#7dd3fc", fill: "#1a4a5c", text: "#bae6fd", selectedFill: "#4aa8c8", selectedText: "#0a1820" },
  Student: { border: "#6ee7b7", fill: "#1a4a3c", text: "#a7f3d0", selectedFill: "#4aaa7c", selectedText: "#0a1814" },
  Box: { border: "#f0abfc", fill: "#4a2860", text: "#f5d0fe", selectedFill: "#b070d0", selectedText: "#1a1020" },
};

export function tierFor(section: string, row: string, block = ""): SeatTier {
  if (section === "balcony" && BALCONY_BOX_BLOCKS.has(block)) return "Box";
  if (section === "orchestra") {
    if (ORCHESTRA_VIP.has(row)) return "VIP";
    if (ORCHESTRA_PLATINUM.has(row)) return "Platinum";
    return "Gold";
  }
  if (BALCONY_PLATINUM.has(row)) return "Platinum";
  if (BALCONY_SILVER.has(row)) return "Silver";
  return "Student";
}

export function priceFor(section: string, row: string, block = "", type = ""): number {
  const tier = tierFor(section, row, block);
  if ((type === "ada" || type === "companion") && (tier === "Platinum" || tier === "Gold")) return 40;
  if (tier === "Box") return 125;
  if (tier === "VIP") return 0;
  if (tier === "Platinum") return 125;
  if (tier === "Gold") return 75;
  if (tier === "Silver") return 50;
  return 40;
}

export function sameTier(
  a: { section: string; row: string; block: string },
  b: { section: string; row: string; block: string },
) {
  return tierFor(a.section, a.row, a.block) === tierFor(b.section, b.row, b.block);
}

export function sameSeatBand(
  a: { section: string; row: string; block: string },
  b: { section: string; row: string; block: string },
) {
  return a.section === b.section && sameTier(a, b);
}

export function isAnyHouseTier(tier: SeatTier) {
  return tier === "Box" || tier === "VIP";
}

export function canMoveInto(
  from: { section: string; row: string; block: string },
  into: { section: string; row: string; block: string },
) {
  if (sameTier(from, into)) return true;
  const fromTier = tierFor(from.section, from.row, from.block);
  const destTier = tierFor(into.section, into.row, into.block);
  return isAnyHouseTier(fromTier) || isAnyHouseTier(destTier);
}
