/**
 * Una cifra del resumen de una pantalla. En móvil varias caben en una fila,
 * así que el valor manda y la etiqueta va debajo, pequeña.
 */
export function StatTile({
  value,
  label,
  accent = false,
}: {
  value: string | number;
  label: string;
  accent?: boolean;
}) {
  return (
    <div className="flex flex-col items-center gap-1 rounded-xl border border-border bg-surface p-3 text-center sm:items-start sm:p-4 sm:text-left">
      <span
        className={`text-2xl font-bold tabular-nums sm:text-3xl ${
          accent ? 'text-accent' : 'text-foreground'
        }`}
      >
        {value}
      </span>
      <span className="text-xs text-muted sm:text-sm">{label}</span>
    </div>
  );
}
