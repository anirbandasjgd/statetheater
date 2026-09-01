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

const ADA_KEYS = new Set(ORCHESTRA_ADA.map((s) => `${s.row}:${s.number}`));

export function isAdaSeat(section: string, row: string, number: number) {
  return section === "orchestra" && ADA_KEYS.has(`${row}:${number}`);
}
