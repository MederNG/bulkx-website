import { cn } from "@/lib/utils";
import { KpiTerminalCounter, type NumberFormat } from "@/components/cards/KpiTerminalCounter";

export interface SecondaryMetric {
  label: string;
  value: string;
  valueClassName?: string;
}

interface MetricCardProps {
  label: string;
  value: number;
  format?: NumberFormat;
  sublabel?: string;
  highlight?: boolean;
  className?: string;
  secondaryMetrics?: SecondaryMetric[];
}

export function MetricCard({
  label,
  value,
  format = "plain",
  sublabel,
  highlight,
  className,
  secondaryMetrics,
}: MetricCardProps) {
  const hasSecondary = Boolean(secondaryMetrics?.length);

  return (
    <div
      className={cn(
        "card metric-card flex h-full flex-col text-center",
        hasSecondary
          ? "min-h-[172px] p-4 md:min-h-[188px] md:p-5"
          : "items-center justify-center px-4 py-3.5 md:px-5 md:py-4",
        highlight && "card-highlight",
        className
      )}
    >
      <p className="section-title mb-2">{label}</p>
      <KpiTerminalCounter
        value={value}
        format={format}
        className="block font-mono text-xl font-semibold tabular-nums text-text-primary md:text-2xl"
      />
      {sublabel && <p className="mt-1 text-xs text-text-secondary">{sublabel}</p>}
      {hasSecondary && (
        <>
          <div className="flex-1" aria-hidden="true" />
          <div className="mt-3 grid grid-cols-2 gap-x-3 gap-y-2.5 border-t border-[rgba(198,182,186,0.12)] pt-3 text-left">
            {secondaryMetrics!.map((metric) => (
              <div key={metric.label}>
                <p className="text-[10px] uppercase tracking-wider text-text-secondary">{metric.label}</p>
                <p
                  className={cn(
                    "mt-0.5 font-mono text-xs font-medium tabular-nums text-text-secondary md:text-[13px]",
                    metric.valueClassName
                  )}
                >
                  {metric.value}
                </p>
              </div>
            ))}
          </div>
        </>
      )}
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
