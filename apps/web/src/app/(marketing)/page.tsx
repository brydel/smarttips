import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import Link from 'next/link';
import { ArrowRight, Zap, BarChart2, Sparkles, Check, Scale } from 'lucide-react';

export const metadata: Metadata = {
  title: 'SmartTips — Fair tip distribution for restaurants',
  description:
    'ML-powered equitable tip distribution for restaurant franchises. Auditable, explainable, and trusted by 240+ locations.',
  openGraph: {
    title: 'SmartTips — Every tip, fairly earned.',
    description: 'Distribute gratuities with machine-learned fairness. Join 240+ franchises.',
    type: 'website',
  },
};

// ── Logo ─────────────────────────────────────────────────────────────────────
function LandingLogo() {
  return (
    <div className="flex items-center gap-2">
      <div className="w-[22px] h-[22px] relative">
        <svg viewBox="0 0 24 24" width="22" height="22">
          <path
            d="M4 12 L12 4 L20 12 L12 20 Z"
            fill="none"
            stroke="var(--st-l-9)"
            strokeWidth="1.6"
          />
          <path d="M8 12 L12 8 L16 12 L12 16 Z" fill="var(--st-gold)" />
        </svg>
      </div>
      <span className="st-display text-[19px] text-[var(--st-l-9)] tracking-[-0.02em]">
        SmartTips
      </span>
    </div>
  );
}

// ── Nav ───────────────────────────────────────────────────────────────────────
function LandingNav() {
  const links = ['Product', 'For franchises', 'For teams', 'Pricing', 'Customers'];
  return (
    <header className="flex items-center justify-between px-14 py-[22px] border-b border-[var(--st-l-2)]">
      <div className="flex items-center gap-9">
        <LandingLogo />
        <nav className="hidden md:flex gap-[26px] text-[13.5px] text-[var(--st-l-6)]">
          {links.map((l) => (
            <Link
              key={l}
              href={`#${l.toLowerCase().replace(/ /g, '-')}`}
              className="hover:text-[var(--st-l-9)] transition-colors"
            >
              {l}
            </Link>
          ))}
        </nav>
      </div>
      <div className="flex items-center gap-[14px]">
        <Link
          href="/login"
          className="text-[13.5px] text-[var(--st-l-6)] hover:text-[var(--st-l-9)] transition-colors"
        >
          Sign in
        </Link>
        <Link href="/signup" className="st-btn st-btn-primary st-btn-sm">
          Book a demo <ArrowRight size={12} />
        </Link>
      </div>
    </header>
  );
}

// ── Distribution Card (floating) ──────────────────────────────────────────────
const DIST_ROWS: { color: string; label: string; value: string }[] = [
  { color: 'var(--st-indigo)', label: 'Servers', value: '$1,614' },
  { color: 'var(--st-gold)', label: 'Bar', value: '$934' },
  { color: 'var(--st-emerald)', label: 'Runners', value: '$764' },
  { color: 'var(--st-l-4)', label: 'Kitchen', value: '$594' },
  { color: 'var(--st-l-3)', label: 'Host', value: '$341' },
];

function DistributionCard() {
  return (
    <div
      className="absolute w-[280px] bg-white border border-[var(--st-l-2)] rounded-lg p-[18px]"
      style={{
        bottom: -24,
        left: -28,
        boxShadow: '0 24px 60px -20px rgba(40,30,20,.25)',
      }}
    >
      <div className="flex justify-between items-center mb-[14px]">
        <span className="st-eyebrow text-[var(--st-l-5)]">Tonight&apos;s distribution</span>
        <span className="st-chip st-chip-emerald" style={{ fontSize: 10.5 }}>
          <Check size={10} /> Verified
        </span>
      </div>
      <div className="st-money text-[var(--st-l-9)] text-[34px] font-medium tracking-[-0.02em]">
        $4,247.<span className="text-[18px] opacity-50">50</span>
      </div>
      <div className="flex h-[6px] rounded-[3px] overflow-hidden my-[14px] mb-[12px]">
        {[38, 22, 18, 14, 8].map((flex, i) => (
          <div key={i} style={{ flex, background: DIST_ROWS[i]?.color }} />
        ))}
      </div>
      <div className="flex flex-col gap-[5px] text-[11.5px]">
        {DIST_ROWS.map((r) => (
          <div key={r.label} className="flex items-center gap-2">
            <span className="w-[7px] h-[7px] rounded-[2px]" style={{ background: r.color }} />
            <span className="text-[var(--st-l-6)] flex-1">{r.label}</span>
            <span className="st-mono text-[var(--st-l-8)]">{r.value}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Fairness Badge ────────────────────────────────────────────────────────────
function FairnessBadge() {
  return (
    <div
      className="absolute flex items-center gap-3 rounded-lg px-[18px] py-[16px]"
      style={{
        top: 36,
        right: -28,
        background: 'var(--st-l-9)',
        color: 'var(--st-l-0)',
        boxShadow: '0 24px 60px -20px rgba(40,30,20,.4)',
      }}
    >
      <div
        className="w-[38px] h-[38px] rounded-md flex items-center justify-center"
        style={{ background: 'linear-gradient(135deg, var(--st-gold), var(--st-emerald))' }}
      >
        <Scale size={18} className="text-[var(--st-l-0)]" />
      </div>
      <div>
        <div className="st-eyebrow text-[var(--st-l-4)]" style={{ fontSize: 9.5, marginBottom: 2 }}>
          Fairness score
        </div>
        <div className="st-display text-[22px] text-[var(--st-l-0)]">
          94 <span className="text-[12px] text-[var(--st-emerald-glow)]">+2.4</span>
        </div>
      </div>
    </div>
  );
}

// ── Hero ──────────────────────────────────────────────────────────────────────
const BRANDS = ['MAISON LAURENT', 'BRASSERIE NORD', 'OLIVE & FIG', 'KESTREL & CO', 'NORA CAFFÈ'];

function HeroSection() {
  return (
    <section className="grid md:grid-cols-[1.05fr_0.95fr] gap-14 px-14 pt-16 pb-[72px] items-center">
      {/* Left */}
      <div>
        <span className="st-chip st-chip-gold mb-[22px] inline-flex">
          <Sparkles size={12} /> Online ML · Trained per restaurant
        </span>
        <h1
          className="st-display text-[var(--st-l-9)] mb-[18px]"
          style={{ fontSize: 'clamp(48px, 5.4vw, 76px)', lineHeight: 1.02 }}
        >
          Every tip,
          <br />
          <em className="text-[var(--st-l-7)]">fairly</em> earned.
        </h1>
        <p className="text-[17px] text-[var(--st-l-6)] max-w-[460px] leading-[1.55] mb-[30px]">
          SmartTips distributes gratuities across your restaurant team with machine-learned fairness
          — auditable, explainable, and trusted by 240+ franchises.
        </p>
        <div className="flex gap-3 mb-[38px]">
          <Link href="/signup" className="st-btn st-btn-primary">
            Start free pilot <ArrowRight size={14} />
          </Link>
          <button className="st-btn st-btn-ghost-light">Watch 2-min tour</button>
        </div>
        <div className="flex items-center gap-6 pt-6 border-t border-[var(--st-l-2)]">
          <span className="st-eyebrow text-[var(--st-l-5)]">Trusted by</span>
          <div className="flex flex-wrap gap-7 items-center">
            {BRANDS.map((b) => (
              <span
                key={b}
                className="st-eyebrow text-[var(--st-l-6)]"
                style={{ fontSize: 11, letterSpacing: '.14em' }}
              >
                {b}
              </span>
            ))}
          </div>
        </div>
      </div>

      {/* Right — photo + floating elements */}
      <div className="relative hidden md:block aspect-[4/5]">
        <div
          className="st-photo-light h-full rounded-xl"
          style={{ boxShadow: '0 40px 80px -30px rgba(40,30,20,.25)' }}
        >
          {/* Status chip */}
          <span
            className="st-chip absolute top-[22px] left-[22px] backdrop-blur-md"
            style={{
              background: 'rgba(255,255,255,.18)',
              color: 'white',
              border: '1px solid rgba(255,255,255,.25)',
            }}
          >
            <span className="w-2 h-2 rounded-full bg-[var(--st-emerald-glow)]" />
            Friday · 10:47 PM
          </span>
          <div className="st-photo-brief">
            PHOTO 4K · Friday rush, line cooks plating during golden hour service. Warm tungsten +
            window light, shallow DOF, server&apos;s hand mid-pour.
          </div>
        </div>
        <DistributionCard />
        <FairnessBadge />
      </div>
    </section>
  );
}

// ── Feature card data ─────────────────────────────────────────────────────────
type FeatureItem = { icon: ReactNode; eyebrow: string; title: string; desc: string };
const FEATURES: FeatureItem[] = [
  {
    icon: <Scale size={14} />,
    eyebrow: '01 · Fair Distribution',
    title: 'Equitable share, every shift',
    desc: 'Calibrated to your tip-out policy, with full audit log.',
  },
  {
    icon: <Zap size={14} />,
    eyebrow: '02 · Online ML',
    title: 'Learns your restaurant',
    desc: 'River-powered model adapts to each location in real time.',
  },
  {
    icon: <BarChart2 size={14} />,
    eyebrow: '03 · Menu Engineering',
    title: 'See which items tip best',
    desc: 'Heatmap of plate × gratuity to coach servers.',
  },
  {
    icon: <Sparkles size={14} />,
    eyebrow: '04 · AI Insights',
    title: 'Recommendations that move revenue',
    desc: 'Actionable nudges — never a black box.',
  },
];

// ── Features Strip ────────────────────────────────────────────────────────────
function FeaturesSection() {
  return (
    <section className="px-14 pt-10 pb-14 border-t border-[var(--st-l-2)] bg-[var(--st-l-1)]">
      <div className="flex items-baseline justify-between mb-7">
        <h2 className="st-display text-[38px] text-[var(--st-l-9)] max-w-[540px] leading-[1.1]">
          Built for the rush.
          <br />
          <em className="text-[var(--st-l-6)]">Transparent</em> by design.
        </h2>
        <Link
          href="#product"
          className="text-[13px] text-[var(--st-l-7)] inline-flex items-center gap-[6px] hover:text-[var(--st-l-9)] transition-colors"
        >
          See the full product <ArrowRight size={13} />
        </Link>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {FEATURES.map((f, i) => (
          <div key={i} className="p-[22px] bg-white rounded-lg border border-[var(--st-l-2)]">
            <div className="flex items-center gap-2 mb-4">
              <span className={i === 3 ? 'text-[var(--st-gold-dim)]' : 'text-[var(--st-l-7)]'}>
                {f.icon}
              </span>
              <span className="st-eyebrow text-[var(--st-l-6)]" style={{ fontSize: 9.5 }}>
                {f.eyebrow}
              </span>
            </div>
            <h3 className="st-display text-[22px] text-[var(--st-l-9)] mb-2 leading-[1.15]">
              {f.title}
            </h3>
            <p className="text-[13px] text-[var(--st-l-6)] leading-[1.5]">{f.desc}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

// ── Social Proof Band ─────────────────────────────────────────────────────────
function SocialProofSection() {
  return (
    <section
      className="px-14 py-12 grid grid-cols-1 sm:grid-cols-3 lg:grid-cols-[1fr_1fr_1fr_1.4fr] gap-8 items-center"
      style={{ background: 'var(--st-l-9)', color: 'var(--st-l-0)' }}
    >
      <div>
        <div className="st-eyebrow text-[var(--st-l-4)] mb-2">Distributed this month</div>
        <div className="st-display text-[44px] text-white">
          $2.3<span className="text-[24px]">M</span>
        </div>
        <div className="text-[12px] text-[var(--st-l-4)] mt-1">across 240 locations</div>
      </div>
      <div>
        <div className="st-eyebrow text-[var(--st-l-4)] mb-2">Avg fairness lift</div>
        <div className="st-display text-[44px] text-white">
          +27<span className="text-[24px] text-[var(--st-emerald-glow)]">%</span>
        </div>
        <div className="text-[12px] text-[var(--st-l-4)] mt-1">vs. manual pooling</div>
      </div>
      <div>
        <div className="st-eyebrow text-[var(--st-l-4)] mb-2">Disputes resolved</div>
        <div className="st-display text-[44px] text-white">
          −84<span className="text-[24px] text-[var(--st-emerald-glow)]">%</span>
        </div>
        <div className="text-[12px] text-[var(--st-l-4)] mt-1">fewer payroll tickets</div>
      </div>
      <blockquote className="pl-6 border-l border-[var(--st-l-7)] m-0">
        <p className="font-display text-[19px] italic text-[var(--st-l-0)] mb-3 leading-[1.35]">
          &ldquo;Our servers stopped questioning the math. SmartTips just shows the work.&rdquo;
        </p>
        <div className="flex items-center gap-[10px]">
          <div
            className="w-7 h-7 rounded-full flex items-center justify-center text-white text-[9px] font-semibold shrink-0"
            style={{ background: 'var(--st-emerald)' }}
          >
            CP
          </div>
          <span className="text-[12.5px] text-[var(--st-l-3)]">
            Camille Pereira · GM, Brasserie Nord (4 loc.)
          </span>
        </div>
      </blockquote>
    </section>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────
export default function LandingPage() {
  return (
    <div className="min-h-screen flex flex-col font-sans bg-[var(--st-l-0)] text-[var(--st-l-8)]">
      <LandingNav />
      <HeroSection />
      <FeaturesSection />
      <SocialProofSection />
    </div>
  );
}
