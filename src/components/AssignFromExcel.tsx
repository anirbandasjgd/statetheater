"use client";

import { useState } from "react";
import type { AssignPreview } from "@/lib/assign-from-excel";

export function AssignFromExcel({ onAssigned }: { onAssigned: () => Promise<void> }) {
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<AssignPreview | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  async function run(apply: boolean) {
    if (!file) return;
    setBusy(true);
    setError(null);
    setMessage(null);
    const body = new FormData();
    body.set("file", file);
    body.set("apply", apply ? "true" : "false");
    const res = await fetch("/api/registrations/assign", { method: "POST", body });
    const data = await res.json();
    setBusy(false);
    if (!res.ok) {
      setError(data.error ?? "Could not process that file.");
      return;
    }
    setPreview(data);
    if (apply) {
      setMessage(`Assigned seats for ${data.imported} guest${data.imported === 1 ? "" : "s"}.`);
      await onAssigned();
    }
  }

  return (
    <section className="mt-8 rounded-xl border border-[#3a2a22] bg-[#1d1412] p-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-lg text-[#f0d49a]">Import attendees</h2>
          <p className="mt-1 max-w-2xl text-sm text-[#f4ece0]/65">
            Upload an Excel file with <code className="text-[#f0d49a]">Created Date</code>,{" "}
            <code className="text-[#f0d49a]">Attendee Number</code>,{" "}
            <code className="text-[#f0d49a]">Account Name</code>, and{" "}
            <code className="text-[#f0d49a]">Tier Name</code>. Blank dates continue the party above.
            People who share a timestamp are seated together.
          </p>
        </div>
        <a href="/api/registrations/assign" className="text-sm text-[#f0d49a]/80 hover:text-[#f0d49a]">
          Download template
        </a>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-3">
        <label className="inline-flex cursor-pointer rounded-full border border-[#d4a24a]/50 px-4 py-1.5 text-sm text-[#f0d49a] hover:border-[#d4a24a]">
          Choose Excel file
          <input
            type="file"
            accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
            className="hidden"
            onChange={(e) => {
              const next = e.target.files?.[0] ?? null;
              setFile(next);
              setPreview(null);
              setMessage(null);
              setError(null);
            }}
          />
        </label>
        {file ? <span className="text-xs text-[#f4ece0]/60">{file.name}</span> : null}
      </div>

      <div className="mt-3 flex flex-wrap gap-2">
        <button
          type="button"
          disabled={busy || !file}
          className="rounded-full border border-[#d4a24a]/50 px-4 py-1.5 text-sm text-[#f0d49a] disabled:opacity-40"
          onClick={() => void run(false)}
        >
          {busy ? "Working…" : "Preview"}
        </button>
        <button
          type="button"
          disabled={busy || !preview || preview.ready === 0}
          className="rounded-full bg-[#d4a24a] px-4 py-1.5 text-sm font-medium text-[#1a100c] disabled:opacity-40"
          onClick={() => void run(true)}
        >
          Assign {preview && preview.ready > 0 ? `${preview.ready} seats` : "seats"}
        </button>
      </div>

      {error ? <p className="mt-3 text-sm text-red-300">{error}</p> : null}
      {message ? <p className="mt-3 text-sm text-[#b7e0a8]">{message}</p> : null}
      {preview?.warning ? <p className="mt-3 text-sm text-[#f0d49a]">{preview.warning}</p> : null}

      {preview ? (
        <>
          <ul className="mt-4 flex flex-wrap gap-3 text-xs text-[#f4ece0]/75">
            {preview.pools.map((pool) => (
              <li key={pool.pool} className="rounded-md border border-[#3a2a22] px-3 py-2">
                <span className="block text-[#d4a24a]">{pool.label}</span>
                {pool.assigned} of {pool.tickets} tickets · {pool.remainingSeats} seats left
              </li>
            ))}
          </ul>
          <div className="mt-4 max-h-80 overflow-auto rounded-lg border border-[#3a2a22]">
            <table className="w-full min-w-[840px] text-left text-sm">
              <thead className="sticky top-0 bg-[#140c0c] text-[#d4a24a]">
                <tr>
                  <th className="px-3 py-2 font-medium">Registered</th>
                  <th className="px-3 py-2 font-medium">Guest</th>
                  <th className="px-3 py-2 font-medium">Ticket</th>
                  <th className="px-3 py-2 font-medium">Excel tier</th>
                  <th className="px-3 py-2 font-medium">Assigned tier</th>
                  <th className="px-3 py-2 font-medium">Seat</th>
                  <th className="px-3 py-2 font-medium">Status</th>
                </tr>
              </thead>
              <tbody>
                {preview.rows.map((row, index) => (
                  <tr key={`${row.name}-${row.attendeeNumber}-${index}`} className="border-t border-[#3a2a22]">
                    <td className="px-3 py-2 align-top text-[#f4ece0]/70">{row.createdAt || "—"}</td>
                    <td className="px-3 py-2 align-top">{row.name}</td>
                    <td className="px-3 py-2 align-top text-[#f4ece0]/70">{row.attendeeNumber || "—"}</td>
                    <td className="px-3 py-2 align-top text-[#f4ece0]/70">{row.excelTier || "—"}</td>
                    <td className="px-3 py-2 align-top text-[#f4ece0]/70">{row.assignedTier || "—"}</td>
                    <td className="px-3 py-2 align-top">{row.seatLabel ?? "—"}</td>
                    <td className={`px-3 py-2 align-top ${row.error ? "text-red-300" : "text-[#b7e0a8]"}`}>
                      {row.error ?? "Ready"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      ) : null}
    </section>
  );
}
