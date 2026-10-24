import React from 'react';
import * as Collapsible from '@radix-ui/react-collapsible';
import { Zap, Upload, ChevronDown, CheckCircle2, ShieldCheck, Clock } from 'lucide-react';

interface HeroProps {
  solveMs: number | null;
  isRunningDemo: boolean;
  onRunDemo: () => void;
  onUploadClick: () => void;
  whyOpen: boolean;
  onWhyOpenChange: (open: boolean) => void;
}

export const Hero: React.FC<HeroProps> = ({
  solveMs,
  isRunningDemo,
  onRunDemo,
  onUploadClick,
  whyOpen,
  onWhyOpenChange,
}) => {
  const comparisonItems = [
    {
      capability: 'Speed to Insight',
      legacy: 'Long setup, slow runs',
      basic: 'Instant, but mathematically naive',
      gridpoint: 'Exact MILP solve in seconds on the demo dataset',
    },
    {
      capability: 'Algorithmic Transparency',
      legacy: 'Opaque proprietary weights',
      basic: 'Radius rings, no cost logic',
      gridpoint: 'Honest baseline: single-warehouse centroid benchmark',
    },
    {
      capability: 'Financial Realism',
      legacy: 'Custom CapEx/OpEx coding required',
      basic: 'Ignores lease vs. transit trade-off',
      gridpoint: 'Automated cost minimiser balancing leases vs. transit (p vs. p_max)',
    },
    {
      capability: 'Supply Chain Resilience',
      legacy: 'Static outputs that break under surge',
      basic: 'No stress testing',
      gridpoint: 'Live what-if testing: demand surges, fuel cost, site outages',
    },
  ];

  return (
    <section className="relative overflow-hidden border-b border-gp-border bg-gradient-to-b from-white via-blue-50/20 to-white px-4 py-10 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-5xl text-center">
        {/* Badge & Live Latency Chip */}
        <div className="inline-flex flex-wrap items-center justify-center gap-2 rounded-full border border-blue-200 bg-blue-50/90 px-3.5 py-1 text-xs font-medium text-gp-primary-700 shadow-sm">
          <span>B2B Logistics Decision-Support Platform • Exact MILP Engine</span>
          {solveMs !== null && (
            <span className="flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5 text-[11px] font-semibold text-emerald-800">
              <Clock className="h-3 w-3 text-emerald-600" />
              <span>Last solve: {Math.round(solveMs)} ms</span>
            </span>
          )}
        </div>

        {/* H1 */}
        <h1 className="mt-5 text-3xl font-extrabold tracking-tight text-gp-text-primary sm:text-4xl lg:text-5xl">
          Mathematically Optimal Warehouse Networks. Simulated in Seconds, Not Weeks.
        </h1>

        {/* Subheadline with honest routing note */}
        <p className="mx-auto mt-4 max-w-3xl text-sm leading-relaxed text-gp-text-secondary sm:text-base">
          Solve Capacitated Facility Location exactly with Mixed-Integer Linear Programming, then plan delivery routes
          against an honest single-warehouse baseline. Stress-test the network against demand surges, fuel shocks and site
          outages in real time, with no black-box guesswork.
        </p>

        {/* Action CTAs */}
        <div className="mt-7 flex flex-wrap items-center justify-center gap-3">
          <button
            type="button"
            id="btnRunDemo"
            disabled={isRunningDemo}
            onClick={onRunDemo}
            className={`inline-flex items-center gap-2 rounded-lg bg-gp-primary-500 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-gp-primary-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gp-primary-500 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60`}
          >
            <Zap className={`h-4 w-4 ${isRunningDemo ? 'animate-spin' : ''}`} />
            <span>{isRunningDemo ? 'Solving Bengaluru Network...' : '⚡ Run Bengaluru Demo (36 Zones)'}</span>
          </button>

          <button
            type="button"
            id="btnUploadCustom"
            onClick={onUploadClick}
            className="inline-flex items-center gap-2 rounded-lg border border-gp-border-strong bg-white px-5 py-2.5 text-sm font-semibold text-gp-text-primary shadow-sm transition hover:bg-gp-sunken focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gp-primary-500 focus-visible:ring-offset-2"
          >
            <Upload className="h-4 w-4 text-gp-text-secondary" />
            <span>📂 Upload Custom Zones CSV</span>
          </button>
        </div>

        {/* Value Prop Badges */}
        <div className="mt-8 flex flex-wrap items-center justify-center gap-6 text-xs text-gp-text-secondary">
          <span className="flex items-center gap-1.5 font-medium">
            <CheckCircle2 className="h-4 w-4 text-emerald-600" /> Exact PuLP/CBC Branch & Cut
          </span>
          <span className="flex items-center gap-1.5 font-medium">
            <ShieldCheck className="h-4 w-4 text-gp-primary-600" /> Transparent 1-Median Baseline
          </span>
          <span className="flex items-center gap-1.5 font-medium" title="CVRP tour construction utilizes OR-Tools Guided Local Search heuristic">
            <CheckCircle2 className="h-4 w-4 text-blue-600" /> Heuristic CVRP Tour Routing
          </span>
        </div>

        {/* TASK 4: "Why GridPoint?" Comparison Section */}
        <div id="whyGridPointSection" className="mt-8 text-left">
          <Collapsible.Root open={whyOpen} onOpenChange={onWhyOpenChange} className="rounded-xl border border-gp-border bg-white shadow-sm">
            <div className="flex items-center justify-between p-4 sm:px-6">
              <div>
                <h2 className="text-base font-bold text-gp-text-primary">Why GridPoint? vs Traditional Methods</h2>
                <p className="text-xs text-gp-text-secondary">
                  Compare exact mathematical network optimization with legacy software and basic mapping tools.
                </p>
              </div>
              <Collapsible.Trigger asChild>
                <button
                  type="button"
                  className="flex items-center gap-1.5 rounded-lg border border-gp-border bg-gp-sunken px-3 py-1.5 text-xs font-semibold text-gp-text-primary transition hover:bg-gp-border focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
                  aria-label="Toggle Why GridPoint comparison"
                >
                  <span>{whyOpen ? 'Hide Comparison' : 'View Comparison'}</span>
                  <ChevronDown className={`h-4 w-4 transition-transform duration-200 ${whyOpen ? 'rotate-180' : ''}`} />
                </button>
              </Collapsible.Trigger>
            </div>

            <Collapsible.Content className="border-t border-gp-border p-4 sm:p-6 data-[state=closed]:animate-collapse-up data-[state=open]:animate-collapse-down">
              {/* Desktop / Tablet Semantic Table */}
              <div className="hidden overflow-x-auto md:block">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="border-b border-gp-border bg-gp-sunken/60 text-gp-text-secondary">
                      <th scope="col" className="w-1/4 py-3 pl-4 pr-3 font-semibold">
                        Capability
                      </th>
                      <th scope="col" className="w-1/4 px-3 py-3 font-semibold">
                        Legacy Enterprise Tools
                      </th>
                      <th scope="col" className="w-1/4 px-3 py-3 font-semibold">
                        Basic Mapping Tools
                      </th>
                      <th
                        scope="col"
                        className="w-1/4 bg-blue-50/70 py-3 pl-3 pr-4 font-bold text-gp-primary-700 border-l border-r border-blue-200"
                      >
                        GridPoint Engine
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gp-border text-gp-text-primary">
                    {comparisonItems.map((item, idx) => (
                      <tr key={idx} className="transition hover:bg-slate-50/60">
                        <th scope="row" className="py-3 pl-4 pr-3 font-semibold text-gp-text-primary">
                          {item.capability}
                        </th>
                        <td className="px-3 py-3 text-gp-text-secondary">{item.legacy}</td>
                        <td className="px-3 py-3 text-gp-text-secondary">{item.basic}</td>
                        <td className="bg-blue-50/40 py-3 pl-3 pr-4 font-semibold text-gp-primary-700 border-l border-r border-blue-200">
                          {item.gridpoint}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Mobile Stacked Cards (< 768px) */}
              <div className="space-y-4 md:hidden">
                {comparisonItems.map((item, idx) => (
                  <div key={idx} className="rounded-lg border border-gp-border bg-slate-50/50 p-3.5 text-xs">
                    <div className="font-bold text-gp-text-primary border-b border-gp-border pb-1.5 mb-2">
                      {item.capability}
                    </div>
                    <div className="space-y-1.5">
                      <div>
                        <span className="font-semibold text-gp-text-tertiary">Legacy: </span>
                        <span className="text-gp-text-secondary">{item.legacy}</span>
                      </div>
                      <div>
                        <span className="font-semibold text-gp-text-tertiary">Basic Tools: </span>
                        <span className="text-gp-text-secondary">{item.basic}</span>
                      </div>
                      <div className="rounded bg-blue-50 p-2 font-semibold text-gp-primary-700 border border-blue-200">
                        <span className="font-bold">GridPoint: </span>
                        <span>{item.gridpoint}</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              <div className="mt-4 text-[11px] text-gp-text-tertiary italic">
                * Comparison reflects typical categories, not specific vendors.
              </div>
            </Collapsible.Content>
          </Collapsible.Root>
        </div>
      </div>
    </section>
  );
};
