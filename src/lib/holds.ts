/** Orchestra STNJ house holds — not selectable. */
export const ORCHESTRA_HOLDS: { row: string; number: number }[] = [
  { row: "L", number: 101 },
  { row: "L", number: 102 },
  { row: "L", number: 103 },
  { row: "L", number: 104 },
  { row: "L", number: 105 },
  { row: "L", number: 106 },
];

const HOLD_KEYS = new Set(ORCHESTRA_HOLDS.map((s) => `${s.row}:${s.number}`));

export function isHoldSeat(section: string, row: string, number: number) {
  return section === "orchestra" && HOLD_KEYS.has(`${row}:${number}`);
}
