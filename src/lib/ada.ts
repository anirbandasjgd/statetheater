/** Orchestra ADA / accessible seats — selectable at the row’s tier price. */
export const ORCHESTRA_ADA: { row: string; number: number }[] = [
  { row: "B", number: 101 },
  { row: "B", number: 1 },
  { row: "M", number: 5 },
  { row: "M", number: 7 },
  { row: "AA", number: 5 },
  { row: "AA", number: 7 },
  { row: "BB", number: 4 },
];

/** Balcony ADA / accessible seats — matched by block so numbers are not confused across aisles. */
export const BALCONY_ADA: { block: string; row: string; number: number }[] = [
  { block: "left", row: "C", number: 14 },
  { block: "left", row: "C", number: 16 },
  { block: "right", row: "C", number: 13 },
  { block: "right", row: "C", number: 15 },
];

const ORCHESTRA_KEYS = new Set(ORCHESTRA_ADA.map((s) => `${s.row}:${s.number}`));
const BALCONY_KEYS = new Set(BALCONY_ADA.map((s) => `${s.block}:${s.row}:${s.number}`));

export function isAdaSeat(section: string, row: string, number: number, block = "") {
  if (section === "orchestra") return ORCHESTRA_KEYS.has(`${row}:${number}`);
  if (section === "balcony") return BALCONY_KEYS.has(`${block}:${row}:${number}`);
  return false;
}
