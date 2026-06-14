export function Footer() {
  return (
    <footer className="border-t border-[rgba(198,182,186,0.1)] py-8">
      <div className="mx-auto max-w-[1400px] px-4 md:px-6">
        <div className="flex flex-col gap-2 text-xs text-text-secondary sm:flex-row sm:items-center sm:justify-between">
          <p>AURA Intelligence Terminal — Public analytics for the BULK AURA campaign.</p>
          <p className="font-mono tabular-nums">Data refreshes every 5 minutes</p>
        </div>
      </div>
    </footer>
  );
}
