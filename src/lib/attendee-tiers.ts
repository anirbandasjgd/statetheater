export type AssignPool = "platinum" | "gold" | "silver" | "student";

export const POOL_LABEL: Record<AssignPool, string> = {
  platinum: "Orchestra Platinum",
  gold: "Orchestra Gold, then Balcony Gold",
  silver: "Balcony Silver",
  student: "Balcony Student",
};

export function mapExcelTier(raw: string): AssignPool | null {
  const text = raw.trim().toLowerCase().replace(/\s+/g, " ");
  if (!text) return null;
  if (text.includes("student")) return "student";
  if (text.includes("platinum") || /\bpl\s*1\b/.test(text) || text === "pl1") return "platinum";
  if (text.includes("silver") || /\bpl\s*3\b/.test(text) || text === "pl3") return "silver";
  if (text.includes("gold") || /\bpl\s*2\b/.test(text) || text === "pl2") return "gold";
  return null;
}

export function attendeeSortValue(attendeeNumber: string) {
  const digits = attendeeNumber.replace(/\D/g, "");
  if (!digits) return Number.MAX_SAFE_INTEGER;
  const n = Number(digits);
  return Number.isFinite(n) ? n : Number.MAX_SAFE_INTEGER;
}
