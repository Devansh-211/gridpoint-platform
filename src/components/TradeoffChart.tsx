import React from 'react';
import { Currency, TradeoffPoint } from '../types';
import { formatMoney, currencySymbol } from '../lib/currency';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from 'recharts';
import { TrendingDown } from 'lucide-react';

interface TradeoffChartProps {
  currency: Currency;
  points: TradeoffPoint[];
}

export const TradeoffChart: React.FC<TradeoffChartProps> = ({ currency, points }) => {
  const sym = currencySymbol(currency);

  const formattedData = points.map((pt) => ({
    p: `p = ${pt.p}`,
    deliveryCost: pt.delivery_cost,
    infrastructureCost: pt.infrastructure_cost,
    combinedCost: pt.combined_cost,
    rawP: pt.p,
  }));

  return (
    <div className="rounded-xl border border-gp-border bg-white p-4 sm:p-5 shadow-sm">
      <div className="flex items-center gap-2 border-b border-gp-border pb-3">
        <TrendingDown className="h-4 w-4 text-gp-primary-500" />
        <div>
          <h3 className="text-sm font-bold text-gp-text-primary">
            Facility Count vs Delivery Cost Trade-Off Curve (p = 1..5)
          </h3>
          <p className="text-xs text-gp-text-secondary">
            Diminishing marginal transit savings vs linear warehouse lease expansion
          </p>
        </div>
      </div>

      <div className="mt-4 h-72 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={formattedData} margin={{ top: 10, right: 20, left: 20, bottom: 10 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#E4E8EC" />
            <XAxis dataKey="p" stroke="#8A94A0" fontSize={11} tickLine={false} />
            <YAxis
              stroke="#8A94A0"
              fontSize={11}
              tickLine={false}
              tickFormatter={(val) => formatMoney(val, currency, { compact: true })}
            />
            <Tooltip
              formatter={(val: number, name: string) => [
                formatMoney(val, currency),
                name === 'combinedCost'
                  ? 'Combined System Cost'
                  : name === 'deliveryCost'
                  ? 'Delivery Transit Cost'
                  : 'Facility Lease Cost',
              ]}
              labelFormatter={(label) => `Warehouse Configuration: ${label}`}
              contentStyle={{
                backgroundColor: '#FFFFFF',
                borderRadius: '8px',
                border: '1px solid #E4E8EC',
                fontSize: '12px',
                boxShadow: '0 4px 12px rgba(0,0,0,0.08)',
              }}
            />
            <Legend
              wrapperStyle={{ fontSize: '11px', paddingTop: '8px' }}
              formatter={(value) =>
                value === 'combinedCost'
                  ? `Combined System Cost (${sym}/day)`
                  : value === 'deliveryCost'
                  ? `Delivery Transit Cost (${sym}/day)`
                  : `Facility Lease Cost (${sym}/day)`
              }
            />
            <Line
              type="monotone"
              dataKey="combinedCost"
              stroke="#3B76ED"
              strokeWidth={3}
              dot={{ r: 4, fill: '#3B76ED' }}
              activeDot={{ r: 6 }}
            />
            <Line
              type="monotone"
              dataKey="deliveryCost"
              stroke="#10B981"
              strokeWidth={2}
              strokeDasharray="4 4"
              dot={{ r: 3, fill: '#10B981' }}
            />
            <Line
              type="monotone"
              dataKey="infrastructureCost"
              stroke="#F59E0B"
              strokeWidth={2}
              strokeDasharray="2 2"
              dot={{ r: 3, fill: '#F59E0B' }}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>

      <div className="mt-2 text-[11px] text-gp-text-tertiary">
        * Notice: As warehouse count increases, delivery transit cost drops with diminishing returns while fixed lease costs rise linearly.
      </div>
    </div>
  );
};
