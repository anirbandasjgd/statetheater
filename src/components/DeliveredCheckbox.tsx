export function DeliveredCheckbox({
  name,
  checked,
  locked = false,
  onChange,
}: {
  name: string;
  checked: boolean;
  locked?: boolean;
  onChange?: (next: boolean) => void;
}) {
  return (
    <span className="relative inline-flex h-[18px] w-[18px] items-center justify-center">
      <input
        type="checkbox"
        checked={checked}
        disabled={locked}
        aria-label={`Ticket delivered for ${name}`}
        title={locked ? "Undo this on the Database page" : undefined}
        onChange={(e) => {
          if (locked) return;
          onChange?.(e.target.checked);
        }}
        className={`absolute inset-0 z-10 appearance-none rounded-[3px] border-2 border-[#f8f1e3] disabled:opacity-100 ${
          locked ? "cursor-default" : "cursor-pointer"
        }`}
        style={{ backgroundColor: checked ? "#f8f1e3" : "#140c0c" }}
      />
      {checked ? (
        <svg viewBox="0 0 16 16" className="pointer-events-none relative z-20 h-3.5 w-3.5" aria-hidden>
          <path
            d="M3.2 8.2 6.3 11.3 12.8 4.2"
            fill="none"
            stroke="#1a100c"
            strokeWidth="2.8"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      ) : null}
    </span>
  );
}
