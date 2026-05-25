'use client';

import { TrendingUp } from 'lucide-react';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
} from 'recharts';
import type { DailyTip } from '../../../types/dashboard';

const DAY_LABELS = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'];

interface DistributionChartProps {
  dailyTips: DailyTip[];
}

export function DistributionChart({ dailyTips }: DistributionChartProps) {
  // Map the last 7 days to short day labels (use day label if available)
  const chartData = dailyTips.map((d, i) => ({
    day: DAY_LABELS[i % 7] ?? d.date,
    tips: d.total,
  }));

  const maxValue = Math.max(...chartData.map((d) => d.tips), 1);
  const total = chartData.reduce((s, d) => s + d.tips, 0);
  const prevTotal = total * 0.918; // synthetic delta — will be real from API
  const delta = ((total - prevTotal) / prevTotal) * 100;
  const highlightDay = chartData.reduce(
    (best, d, i) => (d.tips > (chartData[best]?.tips ?? 0) ? i : best),
    0,
  );

  return (
    <div className="rounded-[14px] border border-st-border bg-st-card p-5">
      {/* Header */}
      <div className="flex items-start justify-between mb-3.5">
        <div>
          <span
            className="uppercase tracking-[0.16em] font-mono text-[10.5px] font-medium block mb-1"
            style={{ color: 'var(--st-d-7)' }}
          >
            Distribution des pourboires
          </span>
          <h3
            className="text-[20px] leading-none"
            style={{ fontFamily: 'var(--font-instrument-serif)', color: 'var(--st-d-9)' }}
          >
            7 derniers jours{' '}
            <em style={{ color: 'var(--st-d-7)', fontStyle: 'italic' }}>· rythme stable</em>
          </h3>
        </div>
        <span
          className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-pill text-[11px] font-medium border"
          style={{
            color: 'var(--st-indigo-glow)',
            background: 'rgba(99,102,241,.1)',
            borderColor: 'rgba(99,102,241,.3)',
          }}
        >
          <TrendingUp size={10} />+{delta.toFixed(1)}% / semaine
        </span>
      </div>

      {/* Chart */}
      <div className="h-40">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={chartData} margin={{ top: 4, right: 2, left: 0, bottom: 0 }}>
            <defs>
              <linearGradient id="dashGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#818CF8" stopOpacity={0.28} />
                <stop offset="95%" stopColor="#818CF8" stopOpacity={0} />
              </linearGradient>
            </defs>
            <XAxis
              dataKey="day"
              tick={{ fill: '#5A6485', fontSize: 10.5, fontFamily: 'var(--font-jetbrains-mono)' }}
              axisLine={false}
              tickLine={false}
            />
            <YAxis hide domain={[0, maxValue * 1.15]} />
            <Tooltip
              contentStyle={{
                background: '#0F1422',
                border: '1px solid #1B2236',
                borderRadius: 10,
                fontSize: 12,
                fontFamily: 'inherit',
              }}
              labelStyle={{ color: '#8892B0' }}
              itemStyle={{ color: '#818CF8' }}
              formatter={(v: number) => [
                `$${v.toLocaleString('fr-FR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`,
                'Pourboires',
              ]}
            />
            {highlightDay >= 0 && chartData[highlightDay] && (
              <ReferenceLine
                x={chartData[highlightDay]!.day}
                stroke="#3A4366"
                strokeDasharray="2 3"
              />
            )}
            <Area
              type="monotone"
              dataKey="tips"
              stroke="#818CF8"
              strokeWidth={1.8}
              fill="url(#dashGrad)"
              dot={false}
              activeDot={{ r: 4, fill: '#818CF8', strokeWidth: 2, stroke: '#0A0E1A' }}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
