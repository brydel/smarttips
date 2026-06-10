'use client';

import { MessagesSquare } from 'lucide-react';

import { DisputeQueue } from '../../../../features/disputes/components/DisputeQueue';

export default function DashboardDisputesPage() {
  return (
    <div className="flex flex-col gap-5 p-4 sm:p-6 lg:p-8 max-w-5xl mx-auto w-full">
      {/* Header */}
      <div className="flex items-start gap-3">
        <div
          className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
          style={{ background: 'rgba(99,102,241,.1)', border: '1px solid rgba(99,102,241,.2)' }}
        >
          <MessagesSquare size={18} className="text-st-indigo-glow" />
        </div>
        <div>
          <h1 className="st-display text-[26px] sm:text-[30px] text-st-hi leading-none mb-1">
            Litiges
          </h1>
          <p className="text-[13px] text-st-sec font-sans leading-relaxed">
            Questions des employés sur leurs pourboires. La résolution documente une réponse — elle
            ne modifie jamais un montant.
          </p>
        </div>
      </div>

      <DisputeQueue />
    </div>
  );
}
