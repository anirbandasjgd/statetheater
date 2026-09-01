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

const KILL_KEYS = new Set(ORCHESTRA_KILLS.map((s) => `${s.row}:${s.number}`));

export function isKillSeat(section: string, row: string, number: number) {
  return section === "orchestra" && KILL_KEYS.has(`${row}:${number}`);
}
