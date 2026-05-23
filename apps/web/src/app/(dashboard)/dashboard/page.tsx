'use client';

import {
  Search,
  Bell,
  TrendingUp,
  TrendingDown,
  AlertTriangle,
  Sparkles,
  Users,
  Scale,
  ArrowRight,
} from 'lucide-react';
import { AreaChart, Area, ResponsiveContainer, Tooltip, XAxis } from 'recharts';
import { cn } from '../../../lib/cn';

// ── Mock data ─────────────────────────────────────────────────────────────────
const CHART_DATA = [
  { day: 'Lun', tips: 3100 },
  { day: 'Mar', tips: 2850 },
  { day: 'Mer', tips: 3600 },
  { day: 'Jeu', tips: 3200 },
  { day: 'Ven', tips: 4800 },
  { day: 'Sam', tips: 5100 },
  { day: 'Dim', tips: 4247 },
];

const DIST_ROWS = [
  { label: 'Serveurs', pct: 38, color: '#6366F1', value: '$1 614' },
  { label: 'Bar', pct: 22, color: '#D4A574', value: '$934' },
  { label: 'Runners', pct: 18, color: '#10B981', value: '$764' },
  { label: 'Cuisine', pct: 14, color: '#3A4366', value: '$594' },
  { label: 'Accueil', pct: 8, color: '#252D45', value: '$341' },
];

const INSIGHTS = [
  {
    tone: 'gold' as const,
    icon: <Sparkles size={13} />,
    label: 'Opportunité',
    title: 'Vendredi soir : hausse de 18 %',
    desc: 'Les serveurs de la section Terrasse surperforment. Renforcer cette zone rapporterait ~$320 de plus.',
  },
  {
    tone: 'emerald' as const,
    icon: <Scale size={13} />,
    label: 'Équité',
    title: 'Cuisine sous-récompensée',
    desc: 'Le ratio cuisine/salle est à 0.31 — en dessous de votre politique (0.40). Ajustement recommandé.',
  },
  {
    tone: 'indigo' as const,
    icon: <TrendingUp size={13} />,
    label: 'Performance',
    title: 'Score de fidélisation en hausse',
    desc: 'Taux de rotation -6 % ce trimestre. La distribution équitable est corrélée avec la rétention.',
  },
];

const TOP_STAFF = [
  { name: 'Léa Khalfi', role: 'Bar', tips: '$423', shift: '8h', score: 97 },
  { name: 'Marco Aslan', role: 'Serveur', tips: '$381', shift: '7h', score: 94 },
  { name: 'Aïcha Boudreau', role: 'Accueil', tips: '$298', shift: '6h', score: 91 },
  { name: 'Nora Caillet', role: 'Cuisine', tips: '$264', shift: '8h', score: 88 },
  { name: 'Julien Saad', role: 'Runner', tips: '$241', shift: '5h', score: 86 },
];

// ── Topbar ────────────────────────────────────────────────────────────────────
function TopBar() {
  return (
    <header className="flex items-center justify-between px-6 py-3.5 border-b border-st-border bg-st-bg shrink-0">
      <div className="flex items-center gap-2 text-sm">
        <span className="text-st-dim font-sans">SmartTips</span>
        <span className="text-st-muted">/</span>
        <span className="text-st-hi font-medium font-sans">Vue d&apos;ensemble</span>
      </div>
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-2 px-3 py-1.5 bg-st-card border border-st-border rounded-md text-[12.5px] text-st-dim font-sans">
          <Search size={13} />
          <span>Rechercher</span>
          <span className="ml-2 font-mono text-[10px] px-1.5 py-0.5 rounded bg-st-raised text-st-sec">
            ⌘K
          </span>
        </div>
        <button className="relative p-2 rounded-md hover:bg-st-raised transition-colors text-st-sec hover:text-st-hi">
          <Bell size={15} />
          <span className="absolute top-1 right-1 w-1.5 h-1.5 rounded-full bg-st-gold" />
        </button>
      </div>
    </header>
  );
}

// ── KPI Cards ─────────────────────────────────────────────────────────────────
interface KpiCardProps {
  label: string;
  value: string;
  sub: string;
  delta?: string;
  deltaUp?: boolean;
  accent?: string;
  chip?: string;
}

function KpiCard({ label, value, sub, delta, deltaUp, accent, chip }: KpiCardProps) {
  return (
    <div className={cn('st-card p-5 flex flex-col gap-3', accent && `border-l-2 ${accent}`)}>
      <div className="flex items-center justify-between">
        <span className="st-eyebrow text-st-dim">{label}</span>
        {chip && <span className="st-chip st-chip-emerald text-[10px]">{chip}</span>}
      </div>
      <div className="st-money text-[32px] font-medium text-st-hi tracking-[-0.02em]">{value}</div>
      <div className="flex items-center gap-2 text-[12px]">
        <span className="text-st-sec font-sans">{sub}</span>
        {delta && (
          <span
            className={cn(
              'flex items-center gap-0.5 font-medium',
              deltaUp ? 'text-st-emerald-glow' : 'text-st-danger',
            )}
          >
            {deltaUp ? <TrendingUp size={11} /> : <TrendingDown size={11} />}
            {delta}
          </span>
        )}
      </div>
    </div>
  );
}

function KpiGrid() {
  return (
    <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
      <KpiCard
        label="Pourboires ce soir"
        value="$4 247"
        sub="vs sem. dernière"
        delta="+12.4 %"
        deltaUp
        accent="border-l-st-indigo"
        chip="● Live"
      />
      <KpiCard label="Score d'équité" value="94" sub="Excellent · +2.4 pts" delta="+2.4" deltaUp />
      <KpiCard label="Moyenne / employé" value="$141" sub="30 employés actifs" />
      <div className="st-card p-5 flex flex-col gap-3">
        <span className="st-eyebrow text-st-dim">Anomalies détectées</span>
        <div className="flex items-end gap-2">
          <span className="st-money text-[32px] font-medium text-st-warn tracking-[-0.02em]">
            2
          </span>
          <AlertTriangle size={16} className="text-st-warn mb-1.5" />
        </div>
        <span className="text-[12px] text-st-sec font-sans">Attention requise</span>
      </div>
    </div>
  );
}

// ── Tip trend chart ───────────────────────────────────────────────────────────
function TipChart() {
  return (
    <div className="st-card p-5">
      <div className="flex items-center justify-between mb-5">
        <div>
          <span className="st-eyebrow text-st-dim block mb-1">Distribution des pourboires</span>
          <span className="text-sm text-st-hi font-medium font-sans">7 derniers jours</span>
        </div>
        <span className="st-chip st-chip-indigo text-[10.5px]">
          <TrendingUp size={10} /> +8.2 % / semaine
        </span>
      </div>
      <ResponsiveContainer width="100%" height={160}>
        <AreaChart data={CHART_DATA} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
          <defs>
            <linearGradient id="tipGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#6366F1" stopOpacity={0.25} />
              <stop offset="95%" stopColor="#6366F1" stopOpacity={0} />
            </linearGradient>
          </defs>
          <XAxis
            dataKey="day"
            tick={{ fill: '#5A6485', fontSize: 10.5, fontFamily: 'var(--font-jetbrains-mono)' }}
            axisLine={false}
            tickLine={false}
          />
          <Tooltip
            contentStyle={{
              background: '#0F1422',
              border: '1px solid #1B2236',
              borderRadius: 10,
              fontSize: 12,
            }}
            labelStyle={{ color: '#8892B0' }}
            itemStyle={{ color: '#818CF8' }}
            formatter={(v: number) => [`$${v.toLocaleString('fr-FR')}`, 'Pourboires']}
          />
          <Area
            type="monotone"
            dataKey="tips"
            stroke="#6366F1"
            strokeWidth={2}
            fill="url(#tipGrad)"
            dot={false}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

// ── Distribution breakdown ────────────────────────────────────────────────────
function DistBreakdown() {
  return (
    <div className="st-card p-5">
      <div className="flex items-center justify-between mb-5">
        <span className="st-eyebrow text-st-dim">Répartition par rôle</span>
        <span className="text-[12px] text-st-dim font-mono">Ce soir · $4 247</span>
      </div>
      {/* Mini bar */}
      <div className="flex h-2 rounded-pill overflow-hidden mb-5">
        {DIST_ROWS.map((r) => (
          <div key={r.label} style={{ flex: r.pct, background: r.color }} />
        ))}
      </div>
      <div className="flex flex-col gap-2.5">
        {DIST_ROWS.map((r) => (
          <div key={r.label} className="flex items-center gap-2.5">
            <span className="w-2 h-2 rounded-[2px] shrink-0" style={{ background: r.color }} />
            <span className="text-[12.5px] text-st-sec font-sans flex-1">{r.label}</span>
            <span className="st-money text-[12.5px] text-st-pri">{r.value}</span>
            <span className="text-[11px] text-st-dim font-mono w-9 text-right">{r.pct}%</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── AI Insights ───────────────────────────────────────────────────────────────
const TONE_CLASSES = {
  gold: { chip: 'st-chip-gold', icon: 'text-st-gold', border: 'border-l-st-gold' },
  emerald: { chip: 'st-chip-emerald', icon: 'text-st-emerald-glow', border: 'border-l-st-emerald' },
  indigo: { chip: 'st-chip-indigo', icon: 'text-st-indigo-glow', border: 'border-l-st-indigo' },
};

function AiInsights() {
  return (
    <div className="st-card p-5">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Sparkles size={13} className="text-st-gold" />
          <span className="st-eyebrow text-st-dim">Recommandations IA</span>
        </div>
        <a className="text-[12px] text-st-dim hover:text-st-hi transition-colors cursor-pointer flex items-center gap-1">
          Tout voir <ArrowRight size={11} />
        </a>
      </div>
      <div className="flex flex-col gap-3">
        {INSIGHTS.map((ins, i) => {
          const t = TONE_CLASSES[ins.tone];
          return (
            <div key={i} className={cn('p-3 bg-st-raised rounded-md border-l-2', t.border)}>
              <div className="flex items-center gap-2 mb-1.5">
                <span className={t.icon}>{ins.icon}</span>
                <span className={cn('st-chip text-[9.5px] py-0.5 px-2', t.chip)}>{ins.label}</span>
              </div>
              <p className="text-[12.5px] font-medium text-st-hi font-sans mb-1">{ins.title}</p>
              <p className="text-[11.5px] text-st-sec leading-[1.45] font-sans">{ins.desc}</p>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Top performers ────────────────────────────────────────────────────────────
function TopPerformers() {
  return (
    <div className="st-card p-5">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Users size={13} className="text-st-dim" />
          <span className="st-eyebrow text-st-dim">Meilleures performances</span>
        </div>
        <a className="text-[12px] text-st-dim hover:text-st-hi transition-colors cursor-pointer flex items-center gap-1">
          Voir l&apos;équipe <ArrowRight size={11} />
        </a>
      </div>
      <div className="flex flex-col gap-1">
        {TOP_STAFF.map((s, i) => (
          <div
            key={i}
            className="flex items-center gap-3 px-2 py-2 rounded-md hover:bg-st-raised transition-colors group"
          >
            <span className="text-[11px] text-st-muted font-mono w-4 shrink-0">{i + 1}</span>
            <div
              className="w-7 h-7 rounded-md flex items-center justify-center text-[10px] font-bold text-white font-mono shrink-0"
              style={{ background: DIST_ROWS[i % DIST_ROWS.length]?.color ?? '#6366F1' }}
            >
              {s.name
                .split(' ')
                .map((n) => n[0])
                .join('')
                .slice(0, 2)
                .toUpperCase()}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[12.5px] font-medium text-st-hi font-sans truncate">{s.name}</p>
              <p className="text-[10.5px] text-st-dim font-sans">
                {s.role} · {s.shift}
              </p>
            </div>
            <div className="text-right shrink-0">
              <p className="st-money text-[13px] text-st-hi">{s.tips}</p>
              <p className="text-[10px] text-st-emerald-glow font-mono">{s.score}/100</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────
export default function DashboardPage() {
  return (
    <div className="flex flex-col h-full overflow-hidden">
      <TopBar />
      <div className="flex-1 overflow-auto p-6 space-y-5">
        <KpiGrid />
        <div className="grid grid-cols-1 xl:grid-cols-[1.5fr_1fr] gap-5">
          <TipChart />
          <DistBreakdown />
        </div>
        <div className="grid grid-cols-1 xl:grid-cols-[1.1fr_1.4fr] gap-5 pb-6">
          <AiInsights />
          <TopPerformers />
        </div>
      </div>
    </div>
  );
}
