import React from 'react';
import * as Collapsible from '@radix-ui/react-collapsible';
import { ChevronDown, Binary } from 'lucide-react';
// KaTeX CSS bundled locally
import 'katex/dist/katex.min.css';
import { BlockMath, InlineMath } from 'react-katex';

interface MathematicalProofProps {
  proofOpen: boolean;
  onProofOpenChange: (open: boolean) => void;
  isAutoSize?: boolean;
}

export const MathematicalProof: React.FC<MathematicalProofProps> = ({
  proofOpen,
  onProofOpenChange,
  isAutoSize = false,
}) => {
  return (
    <div className="rounded-xl border border-gp-border bg-white shadow-sm">
      <Collapsible.Root open={proofOpen} onOpenChange={onProofOpenChange}>
        <div className="flex items-center justify-between p-4 sm:px-6">
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-50 text-gp-primary-600">
              <Binary className="h-4 w-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-gp-text-primary">
                Mathematical Proof / Formulation (Capacitated Facility Location Problem)
              </h3>
              <p className="text-xs text-gp-text-secondary">
                Exact Mixed-Integer Linear Program (MILP) solved via Coin-OR CBC branch-and-cut
              </p>
            </div>
          </div>

          <Collapsible.Trigger asChild>
            <button
              type="button"
              className="flex items-center gap-1.5 rounded-lg border border-gp-border bg-gp-sunken px-3 py-1.5 text-xs font-semibold text-gp-text-primary transition hover:bg-gp-border focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
              aria-label="Toggle mathematical proof formulation"
            >
              <span>{proofOpen ? 'Hide Formula' : 'Inspect Formula'}</span>
              <ChevronDown className={`h-4 w-4 transition-transform duration-200 ${proofOpen ? 'rotate-180' : ''}`} />
            </button>
          </Collapsible.Trigger>
        </div>

        <Collapsible.Content className="border-t border-gp-border bg-slate-50/40 p-4 sm:p-6 text-xs text-gp-text-primary space-y-5">
          {/* Objective Function */}
          <div>
            <div className="font-bold text-gp-text-primary mb-1.5">
              1. Objective Function ({isAutoSize ? 'Auto-Size Combined Cost Minimization' : 'Demand-Weighted Distance Minimization'})
            </div>
            <div className="rounded-lg border border-gp-border bg-white p-4 overflow-x-auto">
              {isAutoSize ? (
                <BlockMath math="\min \sum_{i \in I} \sum_{j \in J} d_{ij} \cdot \left(\frac{c_{km}}{50}\right) \cdot D_i \cdot x_{ij} + \sum_{j \in J} F_j \cdot y_j" />
              ) : (
                <BlockMath math="\min \sum_{i \in I} \sum_{j \in J} d_{ij} \cdot D_i \cdot x_{ij}" />
              )}
            </div>
          </div>

          {/* Mathematical Constraints */}
          <div>
            <div className="font-bold text-gp-text-primary mb-1.5">2. Solver Constraints</div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div className="rounded-lg border border-gp-border bg-white p-3">
                <div className="font-semibold text-gp-primary-700 mb-1">Single Assignment Constraint</div>
                <BlockMath math="\sum_{j \in J} x_{ij} = 1 \quad \forall i \in I" />
                <div className="text-[11px] text-gp-text-secondary mt-1">
                  Each delivery zone <InlineMath math="i" /> is served by exactly one warehouse depot.
                </div>
              </div>

              <div className="rounded-lg border border-gp-border bg-white p-3">
                <div className="font-semibold text-gp-primary-700 mb-1">Facility Linkage Constraint</div>
                <BlockMath math="x_{ij} \le y_j \quad \forall i \in I, \; j \in J" />
                <div className="text-[11px] text-gp-text-secondary mt-1">
                  Zones can only be allocated to open warehouse sites (<InlineMath math="y_j = 1" />).
                </div>
              </div>

              <div className="rounded-lg border border-gp-border bg-white p-3">
                <div className="font-semibold text-gp-primary-700 mb-1">Warehouse Throughput Capacity</div>
                <BlockMath math="\sum_{i \in I} D_i \cdot x_{ij} \le K_j \cdot y_j \quad \forall j \in J" />
                <div className="text-[11px] text-gp-text-secondary mt-1">
                  Total allocated orders cannot exceed site capacity limit <InlineMath math="K_j" />.
                </div>
              </div>

              <div className="rounded-lg border border-gp-border bg-white p-3">
                <div className="font-semibold text-gp-primary-700 mb-1">
                  {isAutoSize ? 'Warehouse Count Ceiling' : 'Exact Warehouse Count'}
                </div>
                {isAutoSize ? (
                  <BlockMath math="1 \le \sum_{j \in J} y_j \le p_{\max}" />
                ) : (
                  <BlockMath math="\sum_{j \in J} y_j = p" />
                )}
                <div className="text-[11px] text-gp-text-secondary mt-1">
                  {isAutoSize
                    ? 'Solver selects optimal warehouse count balancing transit vs lease.'
                    : 'Exactly p strategic distribution warehouses are opened.'}
                </div>
              </div>
            </div>
          </div>

          {/* Mathematical Legend */}
          <div>
            <div className="font-bold text-gp-text-primary mb-1.5">3. Mathematical Legend & Variables</div>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-[11.5px] rounded-lg border border-gp-border bg-white p-3">
              <div>
                <span className="font-semibold text-gp-primary-700">D_i</span>: Daily order demand of zone <InlineMath math="i" />
              </div>
              <div>
                <span className="font-semibold text-gp-primary-700">d_{`{ij}`}</span>: Road-adjusted distance zone <InlineMath math="i \to j" />
              </div>
              <div>
                <span className="font-semibold text-gp-primary-700">c_{`{km}`}</span>: Delivery transit cost per km
              </div>
              <div>
                <span className="font-semibold text-gp-primary-700">F_j</span>: Fixed daily facility lease of site <InlineMath math="j" />
              </div>
              <div>
                <span className="font-semibold text-gp-primary-700">K_j</span>: Throughput order capacity of site <InlineMath math="j" />
              </div>
              <div>
                <span className="font-semibold text-gp-primary-700">x_{`{ij}`}</span>: Binary decision (<InlineMath math="1" /> if zone <InlineMath math="i \to j" />)
              </div>
              <div>
                <span className="font-semibold text-gp-primary-700">y_j</span>: Binary decision (<InlineMath math="1" /> if warehouse <InlineMath math="j" /> is open)
              </div>
              <div>
                <span className="font-semibold text-gp-primary-700">p</span>: Number of distribution centers opened
              </div>
              <div>
                <span className="font-semibold text-gp-primary-700">R_{`{\\max}`}</span>: Maximum permissible service radius
              </div>
            </div>
          </div>
        </Collapsible.Content>
      </Collapsible.Root>
    </div>
  );
};
