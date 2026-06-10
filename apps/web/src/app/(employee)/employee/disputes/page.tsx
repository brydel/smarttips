'use client';

import { MessageCircleQuestion } from 'lucide-react';

import { useMyDisputes } from '../../../../features/disputes/hooks/use-my-disputes';
import { EmployeeDisputeList } from '../../../../features/disputes/components/EmployeeDisputeList';

export default function EmployeeDisputesPage() {
  const { disputes, isLoading, isError, withdraw, isWithdrawing } = useMyDisputes();

  return (
    <div className="flex flex-col gap-5 p-4 sm:p-6 lg:p-8 max-w-3xl mx-auto w-full">
      {/* Header */}
      <div className="flex items-start gap-3">
        <div
          className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
          style={{ background: 'rgba(99,102,241,.1)', border: '1px solid rgba(99,102,241,.2)' }}
        >
          <MessageCircleQuestion size={18} className="text-st-indigo-glow" />
        </div>
        <div>
          <h1 className="st-display text-[26px] sm:text-[30px] text-st-hi leading-none mb-1">
            Demandes
          </h1>
          <p className="text-[13px] text-st-sec font-sans leading-relaxed">
            Vos questions sur vos pourboires et les réponses de votre gestionnaire.
          </p>
        </div>
      </div>

      <EmployeeDisputeList
        disputes={disputes}
        isLoading={isLoading}
        isError={isError}
        onWithdraw={withdraw}
        withdrawing={isWithdrawing}
      />
    </div>
  );
}
