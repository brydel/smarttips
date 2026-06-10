'use client';

import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip } from 'recharts';
import { TrendingUp } from 'lucide-react';
import type { EmployeeTrendPoint } from '../types/employee.types';
import { fmtTrendDate, fmtMoneyShort } from '../utils/employee-formatters';

interface ChartTooltipProps {
  active?: boolean;
  payload?: Array<{ value: number }>;
  label?: string;
}

function ChartTooltip({ active, payload, label }: ChartTooltipProps) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-md border border-st-border bg-st-card px-3 py-2 text-[12px] font-sans shadow-lg">
      <div className="text-st-dim mb-1">{label}</div>
      <div className="text-st-gold-glow font-mono font-medium">
        {fmtMoneyShort(payload[0]?.value ?? 0)}
      </div>
    </div>
  );
}

interface EmployeeTipTrendChartProps {
  trend?: EmployeeTrendPoint[];
}

export function EmployeeTipTrendChart({ trend }: EmployeeTipTrendChartProps) {
  const hasData = Boolean(trend?.length) && (trend ?? []).some((pt) => pt.amount > 0);

  // État vide honnête : aucune barre fictive.
  if (!trend?.length || !hasData) {
    return (
      <div className="bg-st-card border border-st-border rounded-xl p-5">
        <div className="mb-4">
          <div className="text-[10.5px] font-mono uppercase tracking-[0.12em] text-st-dim mb-0.5">
            Tendance des pourboires
          </div>
          <div className="text-[13px] text-st-hi font-medium font-sans">30 derniers jours</div>
        </div>
        <div className="flex flex-col items-center justify-center h-[100px] gap-2">
          <TrendingUp size={18} className="text-st-dim" />
          <p className="text-[12px] text-st-dim font-sans text-center">
            Aucun pourboire distribué sur les 30 derniers jours.
          </p>
        </div>
      </div>
    );
  }

  const chartData = trend.map((pt) => ({
    date: fmtTrendDate(pt.date),
    amount: pt.amount,
  }));

  const maxAmount = Math.max(...trend.map((pt) => pt.amount), 1);

  return (
    <div className="bg-st-card border border-st-border rounded-xl p-5">
      <div className="mb-4">
        <div className="text-[10.5px] font-mono uppercase tracking-[0.12em] text-st-dim mb-0.5">
          Tendance des pourboires
        </div>
        <div className="text-[13px] text-st-hi font-medium font-sans">30 derniers jours</div>
      </div>

      <ResponsiveContainer width="100%" height={120}>
        <AreaChart data={chartData} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
          <defs>
            <linearGradient id="tipGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#D4A574" stopOpacity={0.25} />
              <stop offset="95%" stopColor="#D4A574" stopOpacity={0} />
            </linearGradient>
          </defs>
          <XAxis
            dataKey="date"
            tick={{ fill: 'var(--st-dim)', fontSize: 9, fontFamily: 'var(--st-font-mono)' }}
            tickLine={false}
            axisLine={false}
            interval={6}
          />
          <YAxis
            domain={[0, maxAmount * 1.2]}
            tick={{ fill: 'var(--st-dim)', fontSize: 9, fontFamily: 'var(--st-font-mono)' }}
            tickLine={false}
            axisLine={false}
            tickFormatter={(v: number) => `$${v}`}
          />
          <Tooltip content={<ChartTooltip />} />
          <Area
            type="monotone"
            dataKey="amount"
            stroke="#D4A574"
            strokeWidth={1.8}
            fill="url(#tipGradient)"
            dot={false}
            activeDot={{ r: 3, fill: '#E8C49A', strokeWidth: 0 }}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
