"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";

type TableId = "seat" | "registration" | "registrationSeat";
type TableMeta = { id: TableId; name: string; count: number };
type SeatRow = {
  id: string;
  section: string;
  block: string;
  row: string;
  number: number;
  type: string;
  price: number;
  status: string;
};
type RegistrationRow = {
  id: string;
  name: string;
  email: string;
  phone: string;
  createdAt: string;
  seatIds: string[];
  seatLabels: string[];
};
type LinkRow = { registrationId: string; seatId: string };

const PAGE_SIZE = 50;

export default function DatabasePage() {
  const [tables, setTables] = useState<TableMeta[]>([]);
  const [table, setTable] = useState<TableId>("registration");
  const [q, setQ] = useState("");
  const [appliedQ, setAppliedQ] = useState("");
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [rows, setRows] = useState<SeatRow[] | RegistrationRow[] | LinkRow[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async (nextTable = table, nextPage = page, nextQ = appliedQ) => {
    setLoading(true);
    setError(null);
    const params = new URLSearchParams({
      table: nextTable,
      page: String(nextPage),
    });
    if (nextQ) params.set("q", nextQ);
    const res = await fetch(`/api/admin/database?${params}`, { cache: "no-store" });
    const data = await res.json();
    setLoading(false);
    if (!res.ok) {
      setError(data.error ?? "Could not load table.");
      return;
    }
    setTables(data.tables);
    setRows(data.rows);
    setTotal(data.total);
    setPage(data.page);
  }, [appliedQ, page, table]);

  useEffect(() => {
    void load();
  }, [load]);

  function switchTable(next: TableId) {
    setTable(next);
    setPage(1);
    setQ("");
    setAppliedQ("");
    void load(next, 1, "");
  }

  function search(e: FormEvent) {
    e.preventDefault();
    setAppliedQ(q);
    setPage(1);
    void load(table, 1, q);
  }

  async function patch(body: object) {
    setMessage(null);
    const res = await fetch("/api/admin/database", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = await res.json().catch(() => null);
    if (!res.ok) {
      setError(data?.error ?? "Update failed.");
      return;
    }
    setMessage("Saved.");
    await load();
  }

  async function remove(body: object) {
    if (!confirm("Delete this record? Sold seats will be released.")) return;
    setMessage(null);
    const res = await fetch("/api/admin/database", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = await res.json().catch(() => null);
    if (!res.ok) {
      setError(data?.error ?? "Delete failed.");
      return;
    }
    setMessage("Deleted.");
    await load();
  }

  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <div className="min-h-screen px-6 py-8">
      <div className="mx-auto max-w-6xl">
        <p className="text-xs tracking-[0.28em] text-[#d4a24a] uppercase">State Theatre New Jersey</p>
        <div className="mt-2 flex flex-wrap items-end justify-between gap-4">
          <h1 className="text-2xl text-[#f4ece0]">Database</h1>
          <div className="flex items-center gap-4">
            <a href="/admin" className="text-sm text-[#f0d49a]/80 hover:text-[#f0d49a]">
              Registrations
            </a>
            <a href="/" className="text-sm text-[#f0d49a]/80 hover:text-[#f0d49a]">
              Back to map
            </a>
            <button
              type="button"
              className="text-sm text-[#f0d49a]/70 hover:text-[#f0d49a]"
              onClick={async () => {
                await fetch("/api/admin/logout", { method: "POST" });
                window.location.href = "/admin/login";
              }}
            >
              Sign out
            </button>
          </div>
        </div>
        <p className="mt-2 text-sm text-[#f4ece0]/60">
          Browse and edit the live SQLite tables. Changing a seat to available also drops its registration link.
        </p>

        <div className="mt-6 flex flex-wrap gap-2">
          {tables.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => switchTable(item.id)}
              className={`rounded-full px-4 py-1.5 text-sm ${
                table === item.id ? "bg-[#d4a24a] text-[#1a100c]" : "border border-[#d4a24a]/40 text-[#f0d49a]"
              }`}
            >
              {item.name} ({item.count})
            </button>
          ))}
        </div>

        <form className="mt-4 flex flex-wrap gap-2" onSubmit={search}>
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder={table === "seat" ? "Search row, number, status…" : "Search name, email, id…"}
            className="min-w-[16rem] flex-1 rounded-md border border-[#3a2a22] bg-[#140c0c] px-3 py-2 text-sm text-[#f4ece0] outline-none focus:border-[#d4a24a]"
          />
          <button type="submit" className="rounded-full bg-[#d4a24a] px-4 py-2 text-sm text-[#1a100c]">
            Search
          </button>
        </form>

        {error ? <p className="mt-4 text-red-300">{error}</p> : null}
        {message ? <p className="mt-4 text-[#b7e0a8]">{message}</p> : null}
        {loading ? <p className="mt-6 text-[#f0d49a]/60">Loading…</p> : null}

        <div className="mt-6 overflow-x-auto rounded-xl border border-[#3a2a22]">
          {table === "seat" ? (
            <SeatTable rows={rows as SeatRow[]} onSave={(id, data) => patch({ table: "seat", id, data })} />
          ) : null}
          {table === "registration" ? (
            <RegistrationTable
              rows={rows as RegistrationRow[]}
              onSave={(id, data) => patch({ table: "registration", id, data })}
              onDelete={(id) => remove({ table: "registration", id })}
            />
          ) : null}
          {table === "registrationSeat" ? (
            <LinkTable
              rows={rows as LinkRow[]}
              onDelete={(row) => remove({ table: "registrationSeat", id: row.registrationId, seatId: row.seatId })}
            />
          ) : null}
        </div>

        <div className="mt-4 flex items-center justify-between text-sm text-[#f0d49a]/70">
          <span>
            {total} record{total === 1 ? "" : "s"}
          </span>
          <div className="flex gap-2">
            <button
              type="button"
              disabled={page <= 1}
              className="disabled:opacity-40"
              onClick={() => {
                const next = page - 1;
                setPage(next);
                void load(table, next, appliedQ);
              }}
            >
              Previous
            </button>
            <span>
              Page {page} / {pages}
            </span>
            <button
              type="button"
              disabled={page >= pages}
              className="disabled:opacity-40"
              onClick={() => {
                const next = page + 1;
                setPage(next);
                void load(table, next, appliedQ);
              }}
            >
              Next
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function SeatTable({
  rows,
  onSave,
}: {
  rows: SeatRow[];
  onSave: (id: string, data: Partial<SeatRow>) => void;
}) {
  return (
    <table className="w-full min-w-[900px] text-left text-sm">
      <thead className="bg-[#1d1412] text-[#d4a24a]">
        <tr>
          <th className="px-3 py-3 font-medium">Seat</th>
          <th className="px-3 py-3 font-medium">Block</th>
          <th className="px-3 py-3 font-medium">Type</th>
          <th className="px-3 py-3 font-medium">Price</th>
          <th className="px-3 py-3 font-medium">Status</th>
          <th className="px-3 py-3 font-medium" />
        </tr>
      </thead>
      <tbody>
        {rows.map((row) => (
          <SeatEditor key={row.id} row={row} onSave={onSave} />
        ))}
      </tbody>
    </table>
  );
}

function SeatEditor({ row, onSave }: { row: SeatRow; onSave: (id: string, data: Partial<SeatRow>) => void }) {
  const [status, setStatus] = useState(row.status);
  const [price, setPrice] = useState(String(row.price));
  const [type, setType] = useState(row.type);
  useEffect(() => {
    setStatus(row.status);
    setPrice(String(row.price));
    setType(row.type);
  }, [row]);
  return (
    <tr className="border-t border-[#3a2a22]">
      <td className="px-3 py-2">
        <div className="text-[#f4ece0]">
          {row.section} {row.row}-{row.number}
        </div>
        <div className="text-xs text-[#f0d49a]/50">{row.id}</div>
      </td>
      <td className="px-3 py-2 text-[#f4ece0]/80">{row.block}</td>
      <td className="px-3 py-2">
        <select
          value={type}
          onChange={(e) => setType(e.target.value)}
          className="rounded border border-[#3a2a22] bg-[#140c0c] px-2 py-1 text-[#f4ece0]"
        >
          {["standard", "companion", "transfer", "wheelchair", "ada"].map((opt) => (
            <option key={opt} value={opt}>
              {opt}
            </option>
          ))}
        </select>
      </td>
      <td className="px-3 py-2">
        <input
          value={price}
          onChange={(e) => setPrice(e.target.value)}
          className="w-20 rounded border border-[#3a2a22] bg-[#140c0c] px-2 py-1 text-[#f4ece0]"
        />
      </td>
      <td className="px-3 py-2">
        <select
          value={status}
          onChange={(e) => setStatus(e.target.value)}
          className="rounded border border-[#3a2a22] bg-[#140c0c] px-2 py-1 text-[#f4ece0]"
        >
          {["available", "sold", "blocked"].map((opt) => (
            <option key={opt} value={opt}>
              {opt}
            </option>
          ))}
        </select>
      </td>
      <td className="px-3 py-2">
        <button
          type="button"
          className="text-[#d4a24a]"
          onClick={() => onSave(row.id, { status, type, price: Number(price) })}
        >
          Save
        </button>
      </td>
    </tr>
  );
}

function RegistrationTable({
  rows,
  onSave,
  onDelete,
}: {
  rows: RegistrationRow[];
  onSave: (id: string, data: Partial<RegistrationRow>) => void;
  onDelete: (id: string) => void;
}) {
  return (
    <table className="w-full min-w-[900px] text-left text-sm">
      <thead className="bg-[#1d1412] text-[#d4a24a]">
        <tr>
          <th className="px-3 py-3 font-medium">Guest</th>
          <th className="px-3 py-3 font-medium">Contact</th>
          <th className="px-3 py-3 font-medium">Seats</th>
          <th className="px-3 py-3 font-medium" />
        </tr>
      </thead>
      <tbody>
        {rows.map((row) => (
          <RegistrationEditor key={row.id} row={row} onSave={onSave} onDelete={onDelete} />
        ))}
      </tbody>
    </table>
  );
}

function RegistrationEditor({
  row,
  onSave,
  onDelete,
}: {
  row: RegistrationRow;
  onSave: (id: string, data: Partial<RegistrationRow>) => void;
  onDelete: (id: string) => void;
}) {
  const [name, setName] = useState(row.name);
  const [email, setEmail] = useState(row.email);
  const [phone, setPhone] = useState(row.phone);
  useEffect(() => {
    setName(row.name);
    setEmail(row.email);
    setPhone(row.phone);
  }, [row]);
  return (
    <tr className="border-t border-[#3a2a22]">
      <td className="px-3 py-2 align-top">
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="w-full rounded border border-[#3a2a22] bg-[#140c0c] px-2 py-1 text-[#f4ece0]"
        />
        <div className="mt-1 text-xs text-[#f0d49a]/50">{new Date(row.createdAt).toLocaleString()}</div>
        <div className="text-xs text-[#f0d49a]/40">{row.id}</div>
      </td>
      <td className="px-3 py-2 align-top">
        <input
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="mb-1 w-full rounded border border-[#3a2a22] bg-[#140c0c] px-2 py-1 text-[#f4ece0]"
        />
        <input
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          className="w-full rounded border border-[#3a2a22] bg-[#140c0c] px-2 py-1 text-[#f4ece0]"
        />
      </td>
      <td className="px-3 py-2 align-top text-[#f4ece0]/80">{row.seatLabels.join(", ") || "—"}</td>
      <td className="px-3 py-2 align-top">
        <button type="button" className="block text-[#d4a24a]" onClick={() => onSave(row.id, { name, email, phone })}>
          Save
        </button>
        <button type="button" className="mt-2 block text-red-300" onClick={() => onDelete(row.id)}>
          Delete
        </button>
      </td>
    </tr>
  );
}

function LinkTable({ rows, onDelete }: { rows: LinkRow[]; onDelete: (row: LinkRow) => void }) {
  return (
    <table className="w-full min-w-[720px] text-left text-sm">
      <thead className="bg-[#1d1412] text-[#d4a24a]">
        <tr>
          <th className="px-3 py-3 font-medium">Registration</th>
          <th className="px-3 py-3 font-medium">Seat</th>
          <th className="px-3 py-3 font-medium" />
        </tr>
      </thead>
      <tbody>
        {rows.map((row) => (
          <tr key={`${row.registrationId}:${row.seatId}`} className="border-t border-[#3a2a22]">
            <td className="px-3 py-2 text-[#f4ece0]">{row.registrationId}</td>
            <td className="px-3 py-2 text-[#f4ece0]/80">{row.seatId}</td>
            <td className="px-3 py-2">
              <button type="button" className="text-red-300" onClick={() => onDelete(row)}>
                Release
              </button>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
