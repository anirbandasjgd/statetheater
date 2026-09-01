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
const BALCONY_BOX_BLOCKS = new Set(["boxLeft", "boxRight", "vipBoxLeft", "vipBoxRight"]);

export type SeatTier = "VIP" | "Platinum" | "Gold" | "Silver" | "Student" | "Box";

export const TIER_COLORS: Record<SeatTier, { border: string; fill: string; text: string }> = {
  VIP: { border: "#f8f1e3", fill: "#6a6152", text: "#f8f1e3" },
  Platinum: { border: "#c4b5fd", fill: "#3d3460", text: "#ddd6fe" },
  Gold: { border: "#d4a24a", fill: "#4a3618", text: "#f0d49a" },
  Silver: { border: "#7dd3fc", fill: "#1a4a5c", text: "#bae6fd" },
  Student: { border: "#6ee7b7", fill: "#1a4a3c", text: "#a7f3d0" },
  Box: { border: "#f0abfc", fill: "#4a2860", text: "#f5d0fe" },
};

export function tierFor(section: string, row: string, block = ""): SeatTier {
  if (section === "balcony" && BALCONY_BOX_BLOCKS.has(block)) return "Box";
  if (section === "orchestra") {
    if (ORCHESTRA_VIP.has(row)) return "VIP";
    if (ORCHESTRA_PLATINUM.has(row)) return "Platinum";
    return "Gold";
  }
  if (BALCONY_GOLD.has(row)) return "Gold";
  if (BALCONY_SILVER.has(row)) return "Silver";
  return "Student";
}

export function priceFor(section: string, row: string, block = ""): number {
  const tier = tierFor(section, row, block);
  if (tier === "Box") return 1000;
  if (section === "orchestra") {
    if (tier === "VIP") return 0;
    if (tier === "Platinum") return 125;
    return 75;
  }
  if (tier === "Gold") return 75;
  if (tier === "Silver") return 50;
  return 40;
}
