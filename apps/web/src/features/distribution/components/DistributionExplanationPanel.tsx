'use client';

import { AlertCircle, Info } from 'lucide-react';
import type { TipDistribution } from '../types/distribution.types';
import {
  ROLE_META,
  toNum,
  getRawScore,
  getHoursWorked,
  getSalesGenerated,
  poolSharePct,
  hasSalesBonus,
  perHourRate,
} from '../utils/distribution-calculations';
import {
  fmtMoney,
  fmtScore,
  fmtHours,
  fmtRole,
  fmtRoundingCents,
  buildExplainSentence,
} from '../utils/distribution-formatters';
import { cn } from '../../../lib/cn';

interface DistributionExplanationPanelProps {
  distribution: TipDistribution;
  totalScore: number;
  poolTotal: number;
}

export function DistributionExplanationPanel({
  distribution,
  totalScore,
  poolTotal,
}: DistributionExplanationPanelProps) {
  const exp = distribution.explanation;
  const { employee } = distribution;
  const meta = ROLE_META[employee.role] ?? { label: employee.role, color: '#8892B0', icon: '●' };

  const roleCoef = toNum(exp.roleCoefficient);
  const empCoef = toNum(exp.employeeCoefficient);
  const hours = getHoursWorked(distribution);
  const sales = getSalesGenerated(distribution);
  const baseScore = toNum(exp.baseScore);
  const rawScore = getRawScore(distribution);
  const salesBonusMultiplier = toNum(exp.salesBonus);
  const salesBonusActive = hasSalesBonus(exp.salesBonus);
  const rawAmount = toNum(exp.rawAmount);
  const finalAmount = toNum(exp.finalAmount ?? distribution.amount);
  const mySharePct = poolSharePct(finalAmount, poolTotal);
  const perHour = perHourRate(finalAmount, hours);
  const avgPerHour = perHourRate(poolTotal / (totalScore > 0 ? 1 : 1), 1); // fallback

  // Sentence
  const sentence = buildExplainSentence({
    firstName: employee.firstName,
    roleLabelFr: fmtRole(employee.role),
    hoursWorked: hours,
    salesGenerated: sales,
    score: rawScore,
    totalScore,
    finalAmount,
    poolTotal,
  });

  // Step numbering
  let stepNum = 1;

  return (
    <div className="bg-st-bg border-t border-st-border overflow-hidden">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5 p-4 sm:p-5 lg:p-6">
        {/* LEFT — Plain language + formula */}
        <div className="flex flex-col gap-4">
          <span className="text-[9.5px] font-mono uppercase tracking-[0.14em] text-st-dim">
            Comment ce montant est calculé
          </span>

          {/* Plain language summary */}
          <div
            className="rounded-md p-3.5 text-[13px] leading-[1.7] text-st-pri"
            style={{
              background: 'var(--st-d-1, #0F1422)',
              border: `1px solid color-mix(in srgb, ${meta.color} 30%, #252D45)`,
              borderLeft: `3px solid ${meta.color}`,
            }}
          >
            {sentence}
          </div>

          {/* Step-by-step formula */}
          <div className="bg-st-card border border-st-border rounded-md p-4 font-mono text-[13px] leading-[1.8] text-st-pri flex flex-col gap-2">
            {/* Step 1: coef × hours = base score */}
            <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1">
              <span className="text-[10.5px] text-st-dim w-4 shrink-0">{stepNum++}</span>
              <span className="text-st-hi">{fmtScore(roleCoef)}</span>
              {empCoef !== 1.0 && empCoef > 0 && (
                <>
                  <span className="text-st-dim">×</span>
                  <span className="text-st-hi">{fmtScore(empCoef)}</span>
                  <span className="text-[11.5px] text-st-sec font-sans">coef. employé</span>
                </>
              )}
              <span className="text-st-dim">×</span>
              <span className="text-st-hi">{fmtHours(hours)}</span>
              <span className="text-[11.5px] text-st-sec font-sans">heures</span>
              <span className="text-st-dim">=</span>
              <span style={{ color: meta.color }} className="font-medium">
                {fmtScore(baseScore)}
              </span>
              <span className="text-[11.5px] text-st-sec font-sans">score de base</span>
            </div>

            {/* Step 2 (optional): base × sales bonus = raw score */}
            {salesBonusActive && (
              <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1">
                <span className="text-[10.5px] text-st-dim w-4 shrink-0">{stepNum++}</span>
                <span style={{ color: meta.color }}>{fmtScore(baseScore)}</span>
                <span className="text-st-dim">×</span>
                <span className="text-st-gold-glow font-medium">
                  {salesBonusMultiplier.toFixed(4)}
                </span>
                <span className="text-[11.5px] text-st-sec font-sans">
                  bonus ventes (+{((salesBonusMultiplier - 1) * 100).toFixed(0)}%)
                </span>
                <span className="text-st-dim">=</span>
                <span className="text-st-indigo-glow font-medium">{fmtScore(rawScore)}</span>
                <span className="text-[11.5px] text-st-sec font-sans">score final</span>
              </div>
            )}

            {/* Step 3: score / total × pool */}
            <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1">
              <span className="text-[10.5px] text-st-dim w-4 shrink-0">{stepNum++}</span>
              <span className="text-st-indigo-glow">{fmtScore(rawScore)}</span>
              <span className="text-st-dim">÷</span>
              <span className="text-st-hi">{fmtScore(totalScore)}</span>
              <span className="text-[11.5px] text-st-sec font-sans">total équipe</span>
              <span className="text-st-dim">×</span>
              <span className="text-st-hi">${poolTotal.toFixed(0)}</span>
              <span className="text-[11.5px] text-st-sec font-sans">pool</span>
            </div>

            {/* Total line */}
            <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1 pt-3 mt-1 border-t border-st-border">
              <span className="text-[10.5px] text-st-dim w-4 shrink-0" />
              <span className="text-st-dim">=</span>
              <span className="text-st-gold-glow font-medium text-lg">{fmtMoney(rawAmount)}</span>
              {(exp.capApplied ||
                exp.minimumApplied ||
                (exp.roundingAdjustmentCents ?? 0) !== 0) && (
                <span className="text-[11px] text-st-dim font-sans">avant ajustements</span>
              )}
            </div>

            {/* Final amount with guardrails */}
            {(exp.capApplied || exp.minimumApplied || (exp.roundingAdjustmentCents ?? 0) !== 0) && (
              <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1">
                <span className="text-[10.5px] text-st-dim w-4 shrink-0">→</span>
                <span className="text-st-gold-glow font-medium text-lg">
                  {fmtMoney(finalAmount)}
                </span>
                <span className="text-[11.5px] font-sans text-st-sec">part finale</span>
              </div>
            )}
          </div>

          {/* Guardrail notes */}
          <div className="flex flex-col gap-2">
            {exp.minimumApplied && (
              <GuardrailNote
                tone="emerald"
                text="Le minimum garanti a augmenté le montant initial afin de respecter la règle du restaurant."
              />
            )}
            {exp.capApplied && (
              <GuardrailNote
                tone="gold"
                text="Le plafond maximal a limité le montant pour éviter qu'un seul employé reçoive une part trop élevée du pool."
              />
            )}
            {typeof exp.roundingAdjustmentCents === 'number' &&
              exp.roundingAdjustmentCents !== 0 && (
                <GuardrailNote
                  tone="neutral"
                  text={`Un ajustement d'arrondi de ${fmtRoundingCents(exp.roundingAdjustmentCents)} a été appliqué pour que la somme finale corresponde exactement au pool.`}
                />
              )}
          </div>
        </div>

        {/* RIGHT — Visual decomposition */}
        <div className="flex flex-col gap-5">
          <span className="text-[9.5px] font-mono uppercase tracking-[0.14em] text-st-dim">
            Décomposition visuelle
          </span>

          {/* Score composition bar */}
          <div>
            <div className="flex justify-between text-[11px] text-st-sec mb-1.5">
              <span>Composition du score</span>
              <span className="font-mono text-st-hi">{fmtScore(rawScore)}</span>
            </div>
            <ScoreBar
              baseScore={baseScore}
              rawScore={rawScore}
              roleColor={meta.color}
              salesActive={salesBonusActive}
            />
            <div className="flex flex-wrap gap-3 mt-2 text-[11px]">
              <span className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-[2px]" style={{ background: meta.color }} />
                <span className="text-st-sec">Base (coef × heures)</span>
              </span>
              {salesBonusActive && (
                <span className="flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-[2px] bg-st-gold" />
                  <span className="text-st-sec">Bonus ventes</span>
                </span>
              )}
            </div>
          </div>

          {/* Share-of-pool bar */}
          <div>
            <div className="flex justify-between text-[11px] text-st-sec mb-1.5">
              <span>Part de l&apos;équipe</span>
              <span className="font-mono text-st-hi">{mySharePct.toFixed(1)}%</span>
            </div>
            <div
              className="h-3.5 rounded-pill overflow-hidden relative"
              style={{ background: 'var(--st-d-2, #141A2B)', border: '1px solid #252D45' }}
            >
              <div
                className="absolute left-0 top-0 bottom-0 rounded-pill transition-all duration-300"
                style={{
                  width: `${Math.min(mySharePct, 100)}%`,
                  background: `linear-gradient(90deg, ${meta.color}, #D4A574)`,
                }}
              />
            </div>
            <div className="text-[10.5px] font-mono text-st-dim mt-1.5">
              {fmtScore(rawScore)} sur {fmtScore(totalScore)} points équipe
            </div>
          </div>

          {/* Per-hour comparison card */}
          <div
            className="rounded-md p-3.5 flex items-center gap-4"
            style={{ background: 'var(--st-d-1, #0F1422)', border: '1px solid #252D45' }}
          >
            <div className="flex-1 min-w-0">
              <div className="text-[9px] font-mono uppercase tracking-[0.12em] text-st-dim mb-1">
                Par heure travaillée
              </div>
              <span className="font-mono text-[15px] text-st-hi">{fmtMoney(perHour)}/h</span>
            </div>
            <div className="w-px h-7 bg-st-border shrink-0" />
            <div className="flex-1 min-w-0">
              <div className="text-[9px] font-mono uppercase tracking-[0.12em] text-st-dim mb-1">
                Part du shift
              </div>
              <span className="font-mono text-[15px] text-st-gold-glow">
                {mySharePct.toFixed(1)}%
              </span>
            </div>
          </div>

          {/* Detail table */}
          <div className="rounded-md overflow-hidden" style={{ border: '1px solid #252D45' }}>
            <table className="w-full text-[12px]">
              <tbody>
                <DetailRow label="Score brut" value={fmtScore(rawScore)} accent="indigo" />
                <DetailRow label="Part calculée" value={fmtMoney(rawAmount)} />
                {exp.minimumApplied && (
                  <DetailRow
                    label="Minimum garanti"
                    value={fmtMoney(toNum(exp.minAmount))}
                    accent="emerald"
                  />
                )}
                {exp.capApplied && (
                  <DetailRow
                    label="Plafond appliqué"
                    value={fmtMoney(toNum(exp.capAmount))}
                    accent="gold"
                  />
                )}
                <DetailRow label="Part finale" value={fmtMoney(finalAmount)} accent="gold" bold />
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Sub-components ────────────────────────────────────────────────────────────

interface ScoreBarProps {
  baseScore: number;
  rawScore: number;
  roleColor: string;
  salesActive: boolean;
}

function ScoreBar({ baseScore, rawScore, roleColor, salesActive }: ScoreBarProps) {
  const basePct = rawScore > 0 ? (baseScore / rawScore) * 100 : 100;
  const bonusPct = 100 - basePct;

  return (
    <div
      className="flex h-[22px] rounded-sm overflow-hidden"
      style={{ background: 'var(--st-d-2, #141A2B)', border: '1px solid #252D45' }}
    >
      <div
        className="flex items-center justify-center text-[10.5px] font-mono text-white transition-all"
        style={{
          width: `${basePct}%`,
          background: roleColor,
          whiteSpace: 'nowrap',
          overflow: 'hidden',
        }}
      >
        {basePct > 20 ? baseScore.toFixed(1) : ''}
      </div>
      {salesActive && bonusPct > 0 && (
        <div
          className="flex items-center justify-center text-[10.5px] font-mono text-st-bg transition-all"
          style={{
            width: `${bonusPct}%`,
            background: '#D4A574',
            whiteSpace: 'nowrap',
            overflow: 'hidden',
          }}
        >
          {bonusPct > 10 ? `+${(rawScore - baseScore).toFixed(1)}` : ''}
        </div>
      )}
    </div>
  );
}

interface GuardrailNoteProps {
  tone: 'emerald' | 'gold' | 'neutral';
  text: string;
}

function GuardrailNote({ tone, text }: GuardrailNoteProps) {
  const config = {
    emerald: {
      bg: 'rgba(16,185,129,.08)',
      border: 'rgba(16,185,129,.25)',
      iconColor: '#34D399',
    },
    gold: {
      bg: 'rgba(212,165,116,.08)',
      border: 'rgba(212,165,116,.25)',
      iconColor: '#D4A574',
    },
    neutral: {
      bg: 'rgba(90,100,133,.08)',
      border: 'rgba(90,100,133,.25)',
      iconColor: '#8892B0',
    },
  }[tone];

  return (
    <div
      className="flex gap-2.5 items-start p-2.5 rounded-sm text-[12px] text-st-pri leading-relaxed"
      style={{ background: config.bg, border: `1px solid ${config.border}` }}
    >
      <Info size={13} className="mt-0.5 shrink-0" style={{ color: config.iconColor }} />
      <p className="m-0">{text}</p>
    </div>
  );
}

interface DetailRowProps {
  label: string;
  value: string;
  accent?: 'indigo' | 'emerald' | 'gold';
  bold?: boolean;
}

function DetailRow({ label, value, accent, bold }: DetailRowProps) {
  const valueColor = accent
    ? { indigo: 'text-st-indigo-glow', emerald: 'text-st-emerald-glow', gold: 'text-st-gold-glow' }[
        accent
      ]
    : 'text-st-hi';

  return (
    <tr className="border-b border-st-border last:border-0">
      <td
        className={cn('py-2 px-3 text-st-sec', bold && 'font-medium text-st-pri')}
        style={{ background: 'var(--st-d-1, #0F1422)' }}
      >
        {label}
      </td>
      <td
        className={cn('py-2 px-3 font-mono text-right', valueColor, bold && 'font-medium')}
        style={{ background: 'var(--st-d-1, #0F1422)' }}
      >
        {value}
      </td>
    </tr>
  );
}
