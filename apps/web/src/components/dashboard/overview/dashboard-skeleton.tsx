'use client';

/** Skeleton widgets — shown while dashboard stats are loading. */

function SkeletonBlock({
  height,
  width = '100%',
  rounded = 'rounded-lg',
}: {
  height: string;
  width?: string;
  rounded?: string;
}) {
  return (
    <div
      className={`animate-pulse bg-st-raised ${rounded}`}
      style={{ height, width }}
      aria-hidden="true"
    />
  );
}

export function HeroSkeleton() {
  return (
    <div className="rounded-[14px] border border-st-border bg-st-card p-6 mb-3.5">
      <div className="grid gap-7" style={{ gridTemplateColumns: '1.4fr 1fr 1fr' }}>
        <div className="flex flex-col gap-3">
          <SkeletonBlock height="22px" width="160px" rounded="rounded-pill" />
          <SkeletonBlock height="64px" width="200px" />
          <SkeletonBlock height="14px" width="280px" />
          <SkeletonBlock height="4px" width="100%" rounded="rounded-[2px]" />
          <div className="flex gap-2 pt-1">
            <SkeletonBlock height="38px" width="160px" rounded="rounded-[10px]" />
            <SkeletonBlock height="38px" width="130px" rounded="rounded-[10px]" />
          </div>
        </div>
        <div className="flex flex-col gap-3 pl-7 border-l border-st-border">
          <SkeletonBlock height="10px" width="100px" />
          <SkeletonBlock height="32px" width="60px" />
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="flex items-center gap-2.5">
              <SkeletonBlock height="22px" width="22px" rounded="rounded-full" />
              <SkeletonBlock height="12px" width="120px" />
            </div>
          ))}
        </div>
        <div className="flex flex-col gap-3 pl-7 border-l border-st-border">
          <SkeletonBlock height="10px" width="80px" />
          <SkeletonBlock height="36px" width="100%" rounded="rounded-[2px]" />
          <SkeletonBlock height="12px" width="100%" />
          <SkeletonBlock height="56px" width="100%" rounded="rounded-[10px]" />
        </div>
      </div>
    </div>
  );
}

export function KpiSkeleton() {
  return (
    <div className="rounded-[14px] border border-st-border bg-st-card p-[18px] flex flex-col gap-3">
      <SkeletonBlock height="10px" width="110px" />
      <SkeletonBlock height="44px" width="160px" />
      <SkeletonBlock height="12px" width="180px" />
    </div>
  );
}

export function ChartSkeleton() {
  return (
    <div className="rounded-[14px] border border-st-border bg-st-card p-5">
      <div className="flex justify-between mb-4">
        <div className="flex flex-col gap-2">
          <SkeletonBlock height="10px" width="130px" />
          <SkeletonBlock height="20px" width="220px" />
        </div>
        <SkeletonBlock height="24px" width="110px" rounded="rounded-pill" />
      </div>
      <SkeletonBlock height="160px" width="100%" rounded="rounded-[6px]" />
    </div>
  );
}

export function CardSkeleton({ rows = 3 }: { rows?: number }) {
  return (
    <div className="rounded-[14px] border border-st-border bg-st-card p-5 flex flex-col gap-4">
      <SkeletonBlock height="10px" width="130px" />
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="flex flex-col gap-2">
          <SkeletonBlock height="54px" width="100%" rounded="rounded-[10px]" />
        </div>
      ))}
    </div>
  );
}

export function TomorrowSkeleton() {
  return (
    <div>
      <div className="flex items-center gap-3 py-3 mb-3">
        <SkeletonBlock height="10px" width="160px" />
        <div className="flex-1 h-px bg-st-border" />
      </div>
      <div className="grid gap-3" style={{ gridTemplateColumns: 'repeat(3, 1fr)' }}>
        {[1, 2, 3].map((i) => (
          <div
            key={i}
            className="rounded-[10px] border border-st-border bg-st-card p-3.5 flex flex-col gap-2.5"
          >
            <SkeletonBlock height="22px" width="80px" rounded="rounded-pill" />
            <SkeletonBlock height="22px" width="120px" />
            <SkeletonBlock height="12px" width="100px" />
          </div>
        ))}
      </div>
    </div>
  );
}
