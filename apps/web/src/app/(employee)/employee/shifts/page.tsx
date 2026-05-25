'use client';

import { useState } from 'react';
import { CalendarDays } from 'lucide-react';
import { useEmployeeShifts } from '../../../../features/employee/hooks/use-employee-shifts';
import { EmployeeShiftHistoryList } from '../../../../features/employee/components/EmployeeShiftHistoryList';
import type { TipPeriod } from '../../../../features/employee/types/employee.types';

export default function EmployeeShiftsPage() {
  const [period, setPeriod] = useState<TipPeriod>('30d');
  const { data, notImplemented, isLoading, isError } = useEmployeeShifts(period);

  return (
    <div className="flex flex-col gap-5 p-4 sm:p-6 lg:p-8 max-w-3xl mx-auto w-full">
      {/* Header */}
      <div className="flex items-start gap-3">
        <div
          className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
          style={{ background: 'rgba(212,165,116,.1)', border: '1px solid rgba(212,165,116,.2)' }}
        >
          <CalendarDays size={18} className="text-st-gold" />
        </div>
        <div>
          <h1 className="st-display text-[26px] sm:text-[30px] text-st-hi leading-none mb-1">
            Mes shifts
          </h1>
          <p className="text-[13px] text-st-sec font-sans leading-relaxed">
            Consultez l&apos;historique de vos pourboires par shift.
          </p>
        </div>
      </div>

      {/* History list with filters */}
      <EmployeeShiftHistoryList
        records={data ?? undefined}
        notImplemented={notImplemented}
        isLoading={isLoading}
        isError={isError}
        period={period}
        onPeriodChange={setPeriod}
      />
    </div>
  );
}
