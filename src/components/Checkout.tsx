"use client";

import { FormEvent, useState } from "react";
import type { PublicSeat } from "@/lib/seats";
import { formatPrice, seatLabel } from "@/lib/seats";

type Props = {
  seats: PublicSeat[];
  onRemove: (id: string) => void;
  onClear: () => void;
  onSuccess: () => Promise<void>;
};

export function Checkout({ seats, onRemove, onClear, onSuccess }: Props) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const total = seats.reduce((sum, s) => sum + s.price, 0);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    setMessage(null);
    const res = await fetch("/api/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name,
        email,
        phone,
        seatIds: seats.map((s) => s.id),
      }),
    });
    const data = await res.json();
    setBusy(false);
    if (!res.ok) {
      setError(data.error ?? "Registration failed.");
      return;
    }
    setMessage(`Reserved ${data.seats.length} seat${data.seats.length === 1 ? "" : "s"} for ${data.name}. Total ${formatPrice(data.total)}.`);
    setName("");
    setEmail("");
    setPhone("");
    await onSuccess();
  }

  return (
    <aside
      id="checkout"
      className="h-fit rounded-xl border border-[#3a2a22] bg-[#1d1412] p-5 max-lg:max-h-[42svh] max-lg:shrink-0 max-lg:overflow-y-auto max-lg:overscroll-contain max-lg:rounded-t-2xl max-lg:pb-[max(1.25rem,env(safe-area-inset-bottom))] lg:sticky lg:top-6"
    >
      <h2 className="text-lg text-[#f0d49a]">Your seats</h2>
      {seats.length === 0 ? (
        <p className="mt-3 text-sm text-[#f4ece0]/60">Select one or more seats on the map.</p>
      ) : (
        <ul className="mt-3 max-h-20 space-y-2 overflow-auto text-sm lg:max-h-56">
          {seats.map((seat) => (
            <li key={seat.id} className="flex items-start justify-between gap-2">
              <span>
                {seatLabel(seat)}
                <span className="block text-xs text-[#f0d49a]/70">{formatPrice(seat.price)}</span>
              </span>
              <button type="button" className="text-xs text-[#f0d49a]/70 hover:text-[#f0d49a]" onClick={() => onRemove(seat.id)}>
                Remove
              </button>
            </li>
          ))}
        </ul>
      )}

      <div className="mt-4 flex items-center justify-between border-t border-[#3a2a22] pt-3">
        <span className="text-sm text-[#f4ece0]/70">Total</span>
        <strong className="text-[#d4a24a]">{formatPrice(total)}</strong>
      </div>
      {seats.length > 0 ? (
        <button type="button" className="mt-2 text-xs text-[#f0d49a]/60 hover:text-[#f0d49a]" onClick={onClear}>
          Clear selection
        </button>
      ) : null}

      <form id="register" className="mt-6 space-y-3" onSubmit={submit}>
        <h3 className="text-sm tracking-wide text-[#d4a24a] uppercase">Register</h3>
        <Field label="Name" value={name} onChange={setName} autoComplete="name" required />
        <Field label="Email" value={email} onChange={setEmail} type="email" autoComplete="email" required />
        <Field label="Phone" value={phone} onChange={setPhone} type="tel" autoComplete="tel" required />
        {error ? <p className="text-sm text-red-300">{error}</p> : null}
        {message ? <p className="text-sm text-[#b7e0a8]">{message}</p> : null}
        <button
          type="submit"
          disabled={busy || seats.length === 0}
          className="w-full rounded-full bg-[#d4a24a] py-2.5 text-sm font-medium text-[#1a100c] disabled:opacity-40"
        >
          {busy ? "Reserving…" : "Reserve selected seats"}
        </button>
      </form>
    </aside>
  );
}

function Field({
  label,
  value,
  onChange,
  type = "text",
  autoComplete,
  required,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
  autoComplete?: string;
  required?: boolean;
}) {
  return (
    <label className="block text-xs text-[#f0d49a]/80">
      {label}
      <input
        className="mt-1 w-full rounded-md border border-[#3a2a22] bg-[#140c0c] px-3 py-2 text-base text-[#f4ece0] outline-none focus:border-[#d4a24a]"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        type={type}
        autoComplete={autoComplete}
        required={required}
        onFocus={(e) => e.currentTarget.scrollIntoView({ block: "center", behavior: "smooth" })}
      />
    </label>
  );
}
