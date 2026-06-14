import { cn } from "@/lib/utils";
import { KpiTerminalCounter, type NumberFormat } from "@/components/cards/KpiTerminalCounter";

interface MetricCardProps {
  label: string;
  value: number;
  format?: NumberFormat;
  sublabel?: string;
  highlight?: boolean;
  className?: string;
}

export function MetricCard({
  label,
  value,
  format = "plain",
  sublabel,
  highlight,
  className,
}: MetricCardProps) {
  return (
    <div className={cn("card metric-card p-4 text-center md:p-5", highlight && "card-highlight", className)}>
      <p className="section-title mb-2">{label}</p>
      <KpiTerminalCounter
        value={value}
        format={format}
        className="block font-mono text-xl font-semibold tabular-nums text-text-primary md:text-2xl"
      />
      {sublabel && <p className="mt-1 text-xs text-text-secondary">{sublabel}</p>}
    </div>
  );
}

interface SectionProps {
  id?: string;
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  className?: string;
}

export function Section({ id, title, subtitle, children, className }: SectionProps) {
  return (
    <section id={id} className={cn("py-8 md:py-10", className)}>
      <div className="mb-5">
        <h2 className="section-title">{title}</h2>
        {subtitle && <p className="mt-1 text-sm text-text-secondary">{subtitle}</p>}
      </div>
      {children}
    </section>
  );
}
