/** Orchestra house kills — not selectable. */
export const ORCHESTRA_KILLS: { row: string; number: number }[] = [
  { row: "A", number: 101 },
  { row: "A", number: 1 },
  { row: "C", number: 101 },
  { row: "C", number: 102 },
  { row: "C", number: 1 },
  { row: "C", number: 3 },
  { row: "Q", number: 1 },
  { row: "Q", number: 3 },
  { row: "Q", number: 5 },
  { row: "Q", number: 7 },
  { row: "DD", number: 101 },
  { row: "DD", number: 102 },
  { row: "DD", number: 103 },
  { row: "DD", number: 104 },
  { row: "DD", number: 105 },
  { row: "DD", number: 106 },
  { row: "DD", number: 107 },
  { row: "DD", number: 108 },
];

/** Balcony house kills — matched by block so box numbers are not confused with main seating. */
export const BALCONY_KILLS: { block: string; row: string; number: number }[] = [
  { block: "vipBoxRight", row: "A", number: 2 },
  { block: "vipBoxRight", row: "A", number: 4 },
  { block: "vipBoxRight", row: "B", number: 2 },
  { block: "vipBoxRight", row: "B", number: 4 },
  { block: "boxRight", row: "B", number: 6 },
  { block: "boxRight", row: "B", number: 8 },
  { block: "vipBoxLeft", row: "A", number: 1 },
  { block: "vipBoxLeft", row: "A", number: 3 },
  { block: "vipBoxLeft", row: "B", number: 1 },
  { block: "vipBoxLeft", row: "B", number: 3 },
  { block: "boxLeft", row: "B", number: 5 },
  { block: "boxLeft", row: "B", number: 7 },
  { block: "rightCenter", row: "D", number: 101 },
  { block: "rightCenter", row: "D", number: 103 },
  { block: "rightCenter", row: "D", number: 105 },
  { block: "rightCenter", row: "D", number: 107 },
  { block: "right", row: "D", number: 1 },
  { block: "right", row: "D", number: 3 },
  { block: "left", row: "D", number: 2 },
  { block: "left", row: "D", number: 4 },
  { block: "left", row: "E", number: 2 },
  { block: "left", row: "E", number: 4 },
  { block: "left", row: "F", number: 2 },
  { block: "left", row: "F", number: 4 },
  { block: "right", row: "E", number: 1 },
  { block: "right", row: "E", number: 3 },
  { block: "right", row: "F", number: 1 },
  { block: "right", row: "F", number: 3 },
];

const ORCHESTRA_KEYS = new Set(ORCHESTRA_KILLS.map((s) => `${s.row}:${s.number}`));
const BALCONY_KEYS = new Set(BALCONY_KILLS.map((s) => `${s.block}:${s.row}:${s.number}`));

export function isKillSeat(section: string, row: string, number: number, block = "") {
  if (section === "orchestra") return ORCHESTRA_KEYS.has(`${row}:${number}`);
  if (section === "balcony") return BALCONY_KEYS.has(`${block}:${row}:${number}`);
  return false;
}
