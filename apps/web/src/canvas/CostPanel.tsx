import { formatCostBand, type CapacityEstimate, type ComponentCapacity } from '@trestle/shared';
import { TrendingUp } from 'lucide-react';

interface CostPanelProps {
  capacity: ComponentCapacity | null;
  estimate: CapacityEstimate | null;
}

/**
 * Traffic and cost for one component.
 *
 * Every figure is computed from the requirements in `@trestle/shared`, not
 * produced by the model, so the assumptions behind them can be stated plainly
 * and are shown right here rather than buried.
 */
export function CostPanel({ capacity, estimate }: CostPanelProps) {
  if (!capacity || !estimate) {
    return (
      <p className="p-5 text-sm text-tertiary">
        Estimates appear once this design has requirements attached.
      </p>
    );
  }

  const isBottleneck = estimate.bottleneck?.componentId === capacity.componentId;
  const readPercent = Math.round(estimate.readShare * 100);

  return (
    <div className="p-5">
      <dl className="grid grid-cols-2 gap-2.5">
        <Figure label="Typical" value={`${formatRps(capacity.averageRps)} req/s`} />
        <Figure label="At peak" value={`${formatRps(capacity.peakRps)} req/s`} />
      </dl>

      <section className="mt-5">
        <h3 className="mb-2 font-mono text-[10px] tracking-wide text-tertiary uppercase">
          Running cost
        </h3>
        {capacity.monthlyCost ? (
          <p className="text-[19px] font-semibold">
            {formatCostBand(capacity.monthlyCost)}
            <span className="ml-1 text-[12px] font-normal text-tertiary">/ month</span>
          </p>
        ) : (
          <p className="text-[12.5px] leading-relaxed text-muted-foreground">{capacity.note}</p>
        )}
      </section>

      {isBottleneck && estimate.bottleneck && (
        <section className="mt-5 rounded-lg border border-warning/30 bg-warning/10 p-3">
          <h3 className="flex items-center gap-1.5 text-[12px] font-semibold text-warning">
            <TrendingUp className="size-3.5" aria-hidden="true" />
            First to feel growth
          </h3>
          <p className="mt-1.5 text-[12px] leading-relaxed text-[#d9dae3]">
            At ten times today&rsquo;s users this takes about{' '}
            {formatRps(estimate.bottleneck.peakRpsAtTenTimes)} req/s at peak, against roughly{' '}
            {estimate.bottleneck.softCeilingRps.toLocaleString('en-US')} req/s for one of these
            before the design has to change. That is the highest share of any component here &mdash;
            not the most traffic, but the least room left.
          </p>
        </section>
      )}

      <section className="mt-5 border-t border-subtle pt-3">
        <h3 className="mb-1.5 font-mono text-[10px] tracking-wide text-tertiary uppercase">
          Assumptions
        </h3>
        <ul className="flex flex-col gap-1 text-[11px] leading-relaxed text-tertiary">
          <li>
            {estimate.traffic.actionsPerUserPerDay} actions per user per day, with a{' '}
            {estimate.traffic.peakMultiplier}× busy hour.
          </li>
          <li>
            {readPercent}% reads / {100 - readPercent}% writes, from the traffic shape you chose.
          </li>
          <li>
            Whole system: {formatRps(estimate.traffic.averageRps)} req/s typical,{' '}
            {formatRps(estimate.traffic.peakRps)} req/s at peak.
          </li>
          <li>
            Costs are order-of-magnitude bands for a managed service of this kind and size, not a
            quote from any provider.
          </li>
        </ul>
      </section>
    </div>
  );
}

function Figure({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border bg-elevated p-2.5">
      <dt className="font-mono text-[10px] tracking-wide text-tertiary uppercase">{label}</dt>
      <dd className="mt-0.5 text-[15px] font-semibold">{value}</dd>
    </div>
  );
}

/** Rates below 1/s read better as "under 1" than as "0.04". */
function formatRps(value: number): string {
  if (value === 0) return '0';
  if (value < 1) return '<1';
  return value.toLocaleString('en-US');
}
