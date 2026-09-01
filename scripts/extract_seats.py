"""Extract clickable seats from the official STNJ Orchestra and Balcony PDFs."""

from __future__ import annotations

import json
import math
import re
from collections import defaultdict
from pathlib import Path

import fitz

ROOT = Path(__file__).resolve().parents[1]
DOWNLOADS = Path("/Users/anirbandas/Downloads")

ROW_ORDER = [
    "PA", "PB",
    "A", "B", "C", "D", "E", "F", "G", "H", "J", "K", "L", "M", "N",
    "O", "P", "Q", "R", "S", "T", "U", "V", "W", "X", "Y", "Z",
    "AA", "BB", "CC", "DD",
]
ROW_INDEX = {r: i for i, r in enumerate(ROW_ORDER)}

# Distance callouts printed on the maps — never treat as seat numbers.
DISTANCE_NUMBERS = {45, 60, 74, 75, 89, 102, 107, 126, 131, 141}


def classify_fill(fill) -> str | None:
    if fill is None:
        return None
    r, g, b = fill
    if g > 0.85 and r > 0.9 and b < 0.2:
        return "companion"
    if r > 0.8 and 0.4 < g < 0.7 and b < 0.3:
        return "transfer"
    if r < 0.1 and g < 0.1 and b < 0.1:
        return "wheelchair"
    if r > 0.95 and g > 0.95 and b > 0.95:
        return "standard"
    return None


def load_pdf(path: Path):
    doc = fitz.open(path)
    page = doc[0]
    seats = []
    for d in page.get_drawings():
        rect = d.get("rect")
        if not rect:
            continue
        w, h = rect.width, rect.height
        if not (5.5 <= w <= 12 and 5.5 <= h <= 12 and abs(w - h) < 3):
            continue
        kind = classify_fill(d.get("fill"))
        if not kind:
            continue
        seats.append(
            {
                "x": (rect.x0 + rect.x1) / 2,
                "y": (rect.y0 + rect.y1) / 2,
                "type": kind,
            }
        )
    words = page.get_text("words")
    labels = []
    for w in words:
        x0, y0, x1, y1, text = w[:5]
        t = text.strip()
        cx, cy = (x0 + x1) / 2, (y0 + y1) / 2
        if t in ("PA", "PB") or re.fullmatch(r"[A-Z]{1,2}", t):
            if t in ROW_INDEX:
                labels.append({"t": t, "x": cx, "y": cy})
    return seats, labels, page


def cluster_by_y(items: list[dict], y_tol: float = 6.0) -> list[list[dict]]:
    items = sorted(items, key=lambda s: s["y"])
    rows: list[list[dict]] = []
    for s in items:
        if not rows or abs(s["y"] - (sum(x["y"] for x in rows[-1]) / len(rows[-1]))) > y_tol:
            rows.append([s])
        else:
            rows[-1].append(s)
    return rows


def nearest_row_letter(y: float, labels: list[dict], x_lo: float | None = None, x_hi: float | None = None) -> str | None:
    from collections import Counter

    scored = []
    for lab in labels:
        if x_lo is not None and not (x_lo <= lab["x"] <= x_hi):
            continue
        scored.append((abs(lab["y"] - y), lab["t"]))
    if not scored:
        return None
    scored.sort()
    close = [t for dy, t in scored if dy <= scored[0][0] + 8]
    votes = Counter(close[:6] if close else [scored[0][1]])
    return votes.most_common(1)[0][0]


def assign_rows(seats: list[dict], labels: list[dict]) -> None:
    """Assign a row letter from the aisle labels nearest in y."""
    for s in seats:
        letter = nearest_row_letter(s["y"], labels)
        s["row"] = letter or "?"


def number_left_even(seats_ltr: list[dict]) -> None:
    n = len(seats_ltr)
    for i, s in enumerate(seats_ltr):
        s["number"] = 2 * (n - i)


def number_right_odd(seats_ltr: list[dict]) -> None:
    for i, s in enumerate(seats_ltr):
        s["number"] = 1 + 2 * i


def number_center_descending(seats_ltr: list[dict]) -> None:
    """101 at house-right (max x), increasing toward house-left."""
    n = len(seats_ltr)
    for i, s in enumerate(seats_ltr):
        s["number"] = 101 + (n - 1 - i)


def number_left_center_evens(seats_ltr: list[dict]) -> None:
    """102 at the center aisle (max x), even numbers increasing toward house-left."""
    n = len(seats_ltr)
    for i, s in enumerate(seats_ltr):
        s["number"] = 102 + 2 * (n - 1 - i)


def number_right_center_odds(seats_ltr: list[dict]) -> None:
    """101 at the center aisle (min x), odd numbers increasing toward house-right."""
    for i, s in enumerate(seats_ltr):
        s["number"] = 101 + 2 * i


def process_block(seats: list[dict], labels: list[dict], number_fn, y_tol: float = 6.5) -> None:
    if not seats:
        return
    fragments = cluster_by_y(seats, y_tol=y_tol)
    by_row: dict[str, list[dict]] = defaultdict(list)
    for frag in fragments:
        y_mean = sum(s["y"] for s in frag) / len(frag)
        letter = nearest_row_letter(y_mean, labels) or "?"
        for s in frag:
            s["row"] = letter
        by_row[letter].extend(frag)
    for letter, group in by_row.items():
        ordered = sorted(group, key=lambda s: s["x"])
        number_fn(ordered)
        for s in ordered:
            s["row"] = letter


def number_groups(seats: list[dict], number_fn) -> None:
    by_row: dict[str, list[dict]] = defaultdict(list)
    for s in seats:
        by_row[s.get("row") or "?"].append(s)
    for letter, group in by_row.items():
        ordered = sorted(group, key=lambda s: s["x"])
        number_fn(ordered)


def orchestra(seats: list[dict], labels: list[dict]) -> list[dict]:
    left, center, right = [], [], []
    for s in seats:
        if s["y"] > 650:
            continue  # stray marks under the stage
        if s["x"] < 186:
            s["block"] = "left"
            left.append(s)
        elif s["x"] > 440:
            s["block"] = "right"
            right.append(s)
        else:
            s["block"] = "center"
            center.append(s)
    process_block(left, labels, number_left_even, y_tol=7)
    process_block(center, labels, number_center_descending, y_tol=6)
    process_block(right, labels, number_right_odd, y_tol=7)
    return left + center + right


def balcony(seats: list[dict], labels: list[dict]) -> list[dict]:
    left, left_c, right_c, right = [], [], [], []
    box_left, box_right = [], []
    front = []  # rows A–C span the house before the aisles split

    for s in seats:
        # VIP / side boxes sit beside the stage (high y).
        if s["y"] >= 545 and s["x"] < 170:
            s["block"] = "boxLeft"
            box_left.append(s)
            continue
        if s["y"] >= 545 and s["x"] > 450:
            s["block"] = "boxRight"
            box_right.append(s)
            continue
        if s["y"] >= 488 and 170 <= s["x"] <= 450:
            s["block"] = "front"
            front.append(s)
            continue
        if s["x"] < 158:
            s["block"] = "left"
            left.append(s)
        elif s["x"] < 305:
            s["block"] = "leftCenter"
            left_c.append(s)
        elif s["x"] < 458:
            s["block"] = "rightCenter"
            right_c.append(s)
        else:
            s["block"] = "right"
            right.append(s)

    process_block(left, labels, number_left_even, y_tol=7)
    process_block(left_c, labels, number_left_center_evens, y_tol=6)
    process_block(right_c, labels, number_right_center_odds, y_tol=6)
    process_block(right, labels, number_right_odd, y_tol=7)
    process_block(front, labels, number_center_descending, y_tol=6)

    # Boxes: number from printed convention — left even from the wall, right odd.
    process_block(box_left, labels, number_left_even, y_tol=8)
    process_block(box_right, labels, number_right_odd, y_tol=8)
    # If a box fragment had no letter, walk from the stage: A then B, then Box 1..n
    for group in (box_left, box_right):
        unknown = [s for s in group if s.get("row") in (None, "?")]
        if not unknown:
            continue
        frags = cluster_by_y(unknown, y_tol=8)
        # Closest to stage (max y) is VIP A, then B, then remaining boxes.
        frags = sorted(frags, key=lambda f: -sum(s["y"] for s in f) / len(f))
        names = ["A", "B"] + [f"BX{i}" for i in range(1, 20)]
        for frag, name in zip(frags, names):
            ordered = sorted(frag, key=lambda s: s["x"])
            if group is box_left:
                number_left_even(ordered)
            else:
                number_right_odd(ordered)
            for s in ordered:
                s["row"] = name

    return left + left_c + right_c + right + front + box_left + box_right


def price_for(section: str, row: str) -> int:
    if section == "orchestra":
        if row in {"PA", "PB", "A", "B", "C", "D"}:
            return 0
        if row in {"E", "F", "G", "H", "J", "K", "L", "M", "N", "O", "P"}:
            return 125
        return 75
    if row in {"A", "B", "C"}:
        return 75
    if row in {"D", "E", "F", "G", "H", "J", "K", "L", "M", "N", "O", "P", "Q", "R", "S", "T", "U", "V"}:
        return 50
    return 40


def uniquify(seats: list[dict], section: str) -> list[dict]:
    """Drop exact coordinate duplicates. Identity is section+block+row+number."""
    seen_xy = set()
    cleaned = []
    for s in seats:
        key = (round(s["x"], 1), round(s["y"], 1))
        if key in seen_xy:
            continue
        seen_xy.add(key)
        cleaned.append(s)
    return cleaned


def summarize(section: str, seats: list[dict]) -> None:
    print(f"\n=== {section}: {len(seats)} seats ===")
    from collections import Counter

    print("types", Counter(s["type"] for s in seats))
    print("blocks", Counter(s["block"] for s in seats))
    print("unknown rows", sum(1 for s in seats if s.get("row") in (None, "?")))
    dups = defaultdict(int)
    for s in seats:
        dups[(s.get("row"), s.get("number"))] += 1
    collisions = {k: v for k, v in dups.items() if v > 1}
    print("id collisions", len(collisions))
    if collisions:
        print("  sample", list(collisions.items())[:12])
    rows = sorted({s["row"] for s in seats}, key=lambda r: ROW_INDEX.get(r, 99))
    for row in rows:
        rs = [s for s in seats if s["row"] == row]
        nums = sorted(s["number"] for s in rs)
        print(f"  {row:4s} {len(rs):3d} seats  {nums[0]}–{nums[-1]}  blocks={Counter(s['block'] for s in rs)}")


def export(section: str, seats: list[dict], page) -> list[dict]:
    out = []
    for s in seats:
        row = s.get("row") or "?"
        out.append(
            {
                "section": section,
                "block": s["block"],
                "row": row,
                "number": int(s["number"]),
                "type": s["type"],
                "price": price_for(section, row),
                "x": round(s["x"], 2),
                "y": round(s["y"], 2),
            }
        )
    out.sort(key=lambda s: (ROW_INDEX.get(s["row"], 99), s["x"]))
    dest = ROOT / "data" / f"{section}.json"
    dest.parent.mkdir(exist_ok=True)
    dest.write_text(json.dumps(out, indent=2))
    print("wrote", dest, len(out))
    return out


def render_map(page, dest: Path, zoom: float = 2.0) -> None:
    pix = page.get_pixmap(matrix=fitz.Matrix(zoom, zoom), alpha=False)
    dest.parent.mkdir(parents=True, exist_ok=True)
    pix.save(str(dest))
    print("wrote", dest, pix.width, pix.height)


def main() -> None:
    orch_path = DOWNLOADS / "Orchestra-2023-Config-070c2d625e.pdf"
    balc_path = DOWNLOADS / "Balcony-2023-Config-fec43629d9.pdf"

    o_seats, o_labels, o_page = load_pdf(orch_path)
    o_seats = orchestra(o_seats, o_labels)
    o_seats = uniquify(o_seats, "orchestra")
    summarize("orchestra", o_seats)
    export("orchestra", o_seats, o_page)
    render_map(o_page, ROOT / "public" / "maps" / "orchestra.png")

    b_seats, b_labels, b_page = load_pdf(balc_path)
    b_seats = balcony(b_seats, b_labels)
    b_seats = uniquify(b_seats, "balcony")
    summarize("balcony", b_seats)
    export("balcony", b_seats, b_page)
    render_map(b_page, ROOT / "public" / "maps" / "balcony.png")

    meta = {
        "pageWidth": 612,
        "pageHeight": 792,
        "orchestra": len(o_seats),
        "balcony": len(b_seats),
    }
    (ROOT / "data" / "meta.json").write_text(json.dumps(meta, indent=2))


if __name__ == "__main__":
    main()
