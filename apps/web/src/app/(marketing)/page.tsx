import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import Link from 'next/link';
import {
  ArrowRight,
  Zap,
  BarChart2,
  Sparkles,
  Check,
  Scale,
  Users,
  Store,
  Building2,
  AlertCircle,
  Clock,
  Eye,
  Receipt,
  ChevronDown,
} from 'lucide-react';

export const metadata: Metadata = {
  title: 'SmartTips — Distribution équitable des pourboires pour restaurants',
  description:
    'Distribuez les pourboires de votre restaurant équitablement grâce au ML. Gérez vos shifts, commandes et équipes. Solution SaaS multi-tenant pour restaurants et franchises.',
  openGraph: {
    title: 'SmartTips — Chaque pourboire, distribué équitablement.',
    description:
      'Logiciel de gestion des pourboires pour restaurants. ML-powered, transparent, équitable.',
    type: 'website',
    locale: 'fr_CA',
    url: 'https://smarttips-ashen.vercel.app',
    siteName: 'SmartTips',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'SmartTips — Distribution ML des pourboires',
    description: 'Gérez et distribuez les pourboires de votre restaurant équitablement.',
  },
  alternates: {
    canonical: 'https://smarttips-ashen.vercel.app',
  },
};

// ── JSON-LD Structured Data ───────────────────────────────────────────────────
// These are hardcoded constants — safe for script injection, no user input involved.
const JSON_LD_SOFTWARE =
  '{"@context":"https://schema.org","@type":"SoftwareApplication","name":"SmartTips","applicationCategory":"BusinessApplication","operatingSystem":"Web","offers":{"@type":"Offer","price":"0","priceCurrency":"CAD","description":"Essai gratuit disponible"},"description":"Logiciel SaaS de distribution équitable des pourboires pour restaurants, optimisé par machine learning.","featureList":["Distribution ML des pourboires","Gestion des shifts","Gestion des commandes","Multi-tenant","Tableaux de bord analytiques"],"url":"https://smarttips-ashen.vercel.app"}';

const JSON_LD_ORG =
  '{"@context":"https://schema.org","@type":"Organization","name":"SmartTips","url":"https://smarttips-ashen.vercel.app","description":"SaaS de gestion et distribution des pourboires pour l\'industrie restauration","sameAs":[]}';

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
  const links = [
    { label: 'Produit', href: '#produit' },
    { label: "Cas d'utilisation", href: '#cas-dutilisation' },
    { label: 'Fonctionnalités', href: '#fonctionnalites' },
    { label: 'FAQ', href: '#faq' },
  ];
  return (
    <header className="flex items-center justify-between px-14 py-[22px] border-b border-[var(--st-l-2)]">
      <div className="flex items-center gap-9">
        <LandingLogo />
        <nav className="hidden md:flex gap-[26px] text-[13.5px] text-[var(--st-l-6)]">
          {links.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              className="hover:text-[var(--st-l-9)] transition-colors"
            >
              {l.label}
            </Link>
          ))}
        </nav>
      </div>
      <div className="flex items-center gap-[14px]">
        <Link
          href="/login"
          className="text-[13.5px] text-[var(--st-l-6)] hover:text-[var(--st-l-9)] transition-colors"
        >
          Connexion
        </Link>
        <Link href="/signup" className="st-btn st-btn-primary st-btn-sm">
          Démarrer gratuitement <ArrowRight size={12} />
        </Link>
      </div>
    </header>
  );
}

// ── Distribution Card (floating) ──────────────────────────────────────────────
const DIST_ROWS: { color: string; label: string; value: string }[] = [
  { color: 'var(--st-indigo)', label: 'Serveurs', value: '$1 614' },
  { color: 'var(--st-gold)', label: 'Bar', value: '$934' },
  { color: 'var(--st-emerald)', label: 'Runners', value: '$764' },
  { color: 'var(--st-l-4)', label: 'Cuisine', value: '$594' },
  { color: 'var(--st-l-3)', label: 'Accueil', value: '$341' },
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
        <span className="st-eyebrow text-[var(--st-l-5)]">Distribution du soir</span>
        <span className="st-chip st-chip-emerald" style={{ fontSize: 10.5 }}>
          <Check size={10} /> Vérifié
        </span>
      </div>
      <div className="st-money text-[var(--st-l-9)] text-[34px] font-medium tracking-[-0.02em]">
        $4 247.<span className="text-[18px] opacity-50">50</span>
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
          Score d&apos;équité
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
      <div>
        <span className="st-chip st-chip-gold mb-[22px] inline-flex">
          <Sparkles size={12} /> ML en ligne · Entraîné par restaurant
        </span>
        <h1
          className="st-display text-[var(--st-l-9)] mb-[18px]"
          style={{ fontSize: 'clamp(48px, 5.4vw, 76px)', lineHeight: 1.02 }}
        >
          Chaque pourboire,
          <br />
          <em className="text-[var(--st-l-7)]">équitablement</em> distribué.
        </h1>
        <p className="text-[17px] text-[var(--st-l-6)] max-w-[460px] leading-[1.55] mb-[30px]">
          SmartTips distribue automatiquement les pourboires de votre restaurant de façon équitable
          et transparente, grâce au machine learning.
        </p>
        <div className="flex gap-3 mb-[38px]">
          <Link href="/signup" className="st-btn st-btn-primary">
            Démarrer gratuitement <ArrowRight size={14} />
          </Link>
          <button className="st-btn st-btn-ghost-light">Voir la démo (2 min)</button>
        </div>
        <div className="flex items-center gap-6 pt-6 border-t border-[var(--st-l-2)]">
          <span className="st-eyebrow text-[var(--st-l-5)]">Ils nous font confiance</span>
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

      <div className="relative hidden md:block aspect-[4/5]">
        <div
          className="st-photo-light h-full rounded-xl"
          style={{ boxShadow: '0 40px 80px -30px rgba(40,30,20,.25)' }}
        >
          <span
            className="st-chip absolute top-[22px] left-[22px] backdrop-blur-md"
            style={{
              background: 'rgba(255,255,255,.18)',
              color: 'white',
              border: '1px solid rgba(255,255,255,.25)',
            }}
          >
            <span className="w-2 h-2 rounded-full bg-[var(--st-emerald-glow)]" />
            Vendredi · 22h47
          </span>
          <div className="st-photo-brief">
            PHOTO 4K · Vendredi soir, cuisiniers en plein service. Lumière tungstène chaude +
            fenêtre, faible profondeur de champ, serveur en plein mouvement.
          </div>
        </div>
        <DistributionCard />
        <FairnessBadge />
      </div>
    </section>
  );
}

// ── À qui s'adresse SmartTips ─────────────────────────────────────────────────
type AudienceItem = { icon: ReactNode; title: string; desc: string };
const AUDIENCE: AudienceItem[] = [
  {
    icon: <Store size={18} />,
    title: 'Restaurateurs indépendants',
    desc: "Dites adieu aux conflits de pourboires. SmartTips calcule automatiquement la part de chaque employé à chaque shift, avec un journal d'audit complet.",
  },
  {
    icon: <Building2 size={18} />,
    title: 'Chaînes et franchises',
    desc: 'Gérez plusieurs établissements depuis un seul tableau de bord. Chaque restaurant conserve son propre modèle ML, calibré selon sa politique de pourboires.',
  },
  {
    icon: <Users size={18} />,
    title: 'Gérants de restaurant',
    desc: "Moins de paperasse, plus de temps en salle. SmartTips s'intègre à vos shifts et commandes pour calculer la répartition sans intervention manuelle.",
  },
];

function AudienceSection() {
  return (
    <section id="cas-dutilisation" className="px-14 py-14 border-t border-[var(--st-l-2)]">
      <div className="mb-9">
        <span className="st-eyebrow text-[var(--st-l-5)] mb-3 block">Pour qui</span>
        <h2 className="st-display text-[38px] text-[var(--st-l-9)] leading-[1.1] max-w-[520px]">
          À qui s&apos;adresse
          <br />
          <em className="text-[var(--st-l-6)]">SmartTips ?</em>
        </h2>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        {AUDIENCE.map((a) => (
          <div
            key={a.title}
            className="p-[24px] bg-[var(--st-l-1)] rounded-lg border border-[var(--st-l-2)]"
          >
            <span className="text-[var(--st-l-7)] mb-4 block">{a.icon}</span>
            <h3 className="st-display text-[21px] text-[var(--st-l-9)] mb-2 leading-[1.2]">
              {a.title}
            </h3>
            <p className="text-[13.5px] text-[var(--st-l-6)] leading-[1.55]">{a.desc}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

// ── Problèmes résolus ─────────────────────────────────────────────────────────
type PainItem = { icon: ReactNode; title: string; desc: string };
const PAINS: PainItem[] = [
  {
    icon: <AlertCircle size={15} />,
    title: "Conflits d'équipe liés aux pourboires inégaux",
    desc: 'SmartTips applique une règle de distribution objective et documentée, visible par tous les employés.',
  },
  {
    icon: <Clock size={15} />,
    title: 'Calculs manuels chronophages',
    desc: 'Finies les feuilles de calcul en fin de service. SmartTips calcule automatiquement la répartition dès la clôture du shift.',
  },
  {
    icon: <Eye size={15} />,
    title: 'Manque de transparence pour les employés',
    desc: "Chaque employé peut consulter le détail de sa part, les règles appliquées et l'historique de ses pourboires.",
  },
  {
    icon: <Receipt size={15} />,
    title: 'Non-conformité fiscale',
    desc: 'SmartTips génère les rapports de déclaration de pourboires conformes aux exigences fiscales canadiennes et américaines.',
  },
];

function ProblemsSection() {
  return (
    <section className="px-14 py-14 border-t border-[var(--st-l-2)] bg-[var(--st-l-1)]">
      <div className="mb-9">
        <span className="st-eyebrow text-[var(--st-l-5)] mb-3 block">Problèmes résolus</span>
        <h2 className="st-display text-[38px] text-[var(--st-l-9)] leading-[1.1] max-w-[560px]">
          Les défis de la gestion
          <br />
          <em className="text-[var(--st-l-6)]">des pourboires, résolus.</em>
        </h2>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {PAINS.map((p) => (
          <div
            key={p.title}
            className="p-[22px] bg-white rounded-lg border border-[var(--st-l-2)] flex gap-4"
          >
            <span className="text-[var(--st-l-5)] mt-[2px] shrink-0">{p.icon}</span>
            <div>
              <h3 className="text-[15px] font-semibold text-[var(--st-l-9)] mb-[6px] leading-[1.25]">
                {p.title}
              </h3>
              <p className="text-[13px] text-[var(--st-l-6)] leading-[1.5]">{p.desc}</p>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

// ── Feature card data ─────────────────────────────────────────────────────────
type FeatureItem = { icon: ReactNode; eyebrow: string; title: string; desc: string };
const FEATURES: FeatureItem[] = [
  {
    icon: <Users size={14} />,
    eyebrow: '01 · Shifts & équipe',
    title: 'Planification des services',
    desc: 'Créez vos shifts, assignez les rôles et coefficients. SmartTips calcule la répartition à la clôture.',
  },
  {
    icon: <Scale size={14} />,
    eyebrow: '02 · Répartition ML',
    title: 'Distribution équitable',
    desc: "Modèle calibré sur votre politique de tip-out, avec journal d'audit complet et explicable.",
  },
  {
    icon: <Zap size={14} />,
    eyebrow: '03 · Commandes',
    title: 'Intégration des additions',
    desc: 'Synchronisez vos commandes pour une répartition proportionnelle au volume généré par chaque employé.',
  },
  {
    icon: <Receipt size={14} />,
    eyebrow: '04 · Déclaration fiscale',
    title: 'Conformité réglementaire',
    desc: 'Rapports de déclaration des pourboires conformes aux normes fiscales canadiennes et américaines.',
  },
  {
    icon: <BarChart2 size={14} />,
    eyebrow: '05 · Tableaux de bord',
    title: 'Analytiques avancés',
    desc: "Visualisez les tendances, comparez les shifts et identifiez les opportunités d'optimisation.",
  },
  {
    icon: <Sparkles size={14} />,
    eyebrow: '06 · IA & recommandations',
    title: 'Insights actionnables',
    desc: 'Recommandations ML pour optimiser vos menus et vos équipes — jamais une boîte noire.',
  },
];

// ── Features Strip ────────────────────────────────────────────────────────────
function FeaturesSection() {
  return (
    <section id="fonctionnalites" className="px-14 pt-10 pb-14 border-t border-[var(--st-l-2)]">
      <div className="flex items-baseline justify-between mb-7">
        <h2 className="st-display text-[38px] text-[var(--st-l-9)] max-w-[540px] leading-[1.1]">
          Conçu pour le rush.
          <br />
          <em className="text-[var(--st-l-6)]">Transparent</em> par conception.
        </h2>
        <Link
          href="#produit"
          className="text-[13px] text-[var(--st-l-7)] inline-flex items-center gap-[6px] hover:text-[var(--st-l-9)] transition-colors"
        >
          Voir le produit complet <ArrowRight size={13} />
        </Link>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {FEATURES.map((f, i) => (
          <div key={i} className="p-[22px] bg-white rounded-lg border border-[var(--st-l-2)]">
            <div className="flex items-center gap-2 mb-4">
              <span className={i === 5 ? 'text-[var(--st-gold-dim)]' : 'text-[var(--st-l-7)]'}>
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

// ── Cas d'utilisation ─────────────────────────────────────────────────────────
type UseCaseItem = { label: string; title: string; desc: string };
const USE_CASES: UseCaseItem[] = [
  {
    label: 'Restaurant gastronomique',
    title: 'Service haut de gamme, pourboires élevés',
    desc: 'Dans un restaurant gastronomique, les pourboires représentent une part importante du revenu. SmartTips assure une répartition juste entre serveurs, sommeliers, runners et cuisiniers selon les règles de votre établissement.',
  },
  {
    label: 'Bar & lounge',
    title: 'Gestion des pooled tips en bar',
    desc: 'Baristas, bartenders et serveurs partagent les pourboires dans un environnement dynamique. SmartTips calcule les parts proportionnelles aux heures travaillées et aux ventes générées.',
  },
  {
    label: 'Franchise de restauration rapide',
    title: 'Multi-établissements, politique unifiée',
    desc: "Déployez une politique de distribution cohérente sur l'ensemble de vos franchises, tout en permettant des ajustements locaux. Un seul tableau de bord pour superviser toutes vos adresses.",
  },
];

function UseCasesSection() {
  return (
    <section className="px-14 py-14 border-t border-[var(--st-l-2)] bg-[var(--st-l-1)]">
      <div className="mb-9">
        <span className="st-eyebrow text-[var(--st-l-5)] mb-3 block">Cas d&apos;utilisation</span>
        <h2 className="st-display text-[38px] text-[var(--st-l-9)] leading-[1.1] max-w-[520px]">
          SmartTips s&apos;adapte à
          <br />
          <em className="text-[var(--st-l-6)]">votre établissement.</em>
        </h2>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        {USE_CASES.map((u) => (
          <div key={u.label} className="p-[24px] bg-white rounded-lg border border-[var(--st-l-2)]">
            <span className="st-chip st-chip-gold mb-4 inline-flex" style={{ fontSize: 10.5 }}>
              {u.label}
            </span>
            <h3 className="st-display text-[20px] text-[var(--st-l-9)] mb-2 leading-[1.2]">
              {u.title}
            </h3>
            <p className="text-[13px] text-[var(--st-l-6)] leading-[1.55]">{u.desc}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

// ── Pourquoi SmartTips ────────────────────────────────────────────────────────
type CompareRow = {
  criteria: string;
  manual: string;
  excel: string;
  pos: string;
  smarttips: string;
};
const COMPARE_ROWS: CompareRow[] = [
  {
    criteria: 'Calcul automatique',
    manual: 'Non',
    excel: 'Partiel',
    pos: 'Limité',
    smarttips: 'ML en temps réel',
  },
  {
    criteria: 'Transparence employés',
    manual: 'Non',
    excel: 'Non',
    pos: 'Limité',
    smarttips: "Journal d'audit",
  },
  {
    criteria: 'Multi-tenant / franchises',
    manual: 'Non',
    excel: 'Non',
    pos: 'Partiel',
    smarttips: 'Natif',
  },
  {
    criteria: 'Conformité fiscale',
    manual: 'Manuel',
    excel: 'Manuel',
    pos: 'Partiel',
    smarttips: 'Automatique',
  },
];

function WhySection() {
  return (
    <section className="px-14 py-14 border-t border-[var(--st-l-2)]">
      <div className="mb-9">
        <span className="st-eyebrow text-[var(--st-l-5)] mb-3 block">Pourquoi SmartTips</span>
        <h2 className="st-display text-[38px] text-[var(--st-l-9)] leading-[1.1] max-w-[560px]">
          La seule solution conçue
          <br />
          <em className="text-[var(--st-l-6)]">pour les pourboires.</em>
        </h2>
      </div>
      <div className="overflow-x-auto rounded-lg border border-[var(--st-l-2)]">
        <table className="w-full text-[13.5px]">
          <thead>
            <tr className="bg-[var(--st-l-1)] border-b border-[var(--st-l-2)]">
              <th className="text-left px-5 py-3 text-[var(--st-l-6)] font-medium st-eyebrow">
                Critère
              </th>
              <th className="px-5 py-3 text-[var(--st-l-5)] font-medium st-eyebrow">
                Calcul manuel
              </th>
              <th className="px-5 py-3 text-[var(--st-l-5)] font-medium st-eyebrow">
                Tableur Excel
              </th>
              <th className="px-5 py-3 text-[var(--st-l-5)] font-medium st-eyebrow">
                Solution POS
              </th>
              <th className="px-5 py-3 text-[var(--st-gold)] font-semibold st-eyebrow">
                SmartTips
              </th>
            </tr>
          </thead>
          <tbody>
            {COMPARE_ROWS.map((r, i) => (
              <tr key={r.criteria} className={i % 2 === 0 ? 'bg-white' : 'bg-[var(--st-l-1)]'}>
                <td className="px-5 py-3 text-[var(--st-l-8)] font-medium">{r.criteria}</td>
                <td className="px-5 py-3 text-center text-[var(--st-l-5)]">{r.manual}</td>
                <td className="px-5 py-3 text-center text-[var(--st-l-5)]">{r.excel}</td>
                <td className="px-5 py-3 text-center text-[var(--st-l-5)]">{r.pos}</td>
                <td className="px-5 py-3 text-center text-[var(--st-emerald)] font-medium">
                  {r.smarttips}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
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
        <div className="st-eyebrow text-[var(--st-l-4)] mb-2">Distribué ce mois-ci</div>
        <div className="st-display text-[44px] text-white">
          $2.3<span className="text-[24px]">M</span>
        </div>
        <div className="text-[12px] text-[var(--st-l-4)] mt-1">sur 240 établissements</div>
      </div>
      <div>
        <div className="st-eyebrow text-[var(--st-l-4)] mb-2">Gain d&apos;équité moyen</div>
        <div className="st-display text-[44px] text-white">
          +27<span className="text-[24px] text-[var(--st-emerald-glow)]">%</span>
        </div>
        <div className="text-[12px] text-[var(--st-l-4)] mt-1">vs. pool manuel</div>
      </div>
      <div>
        <div className="st-eyebrow text-[var(--st-l-4)] mb-2">Conflits résolus</div>
        <div className="st-display text-[44px] text-white">
          -84<span className="text-[24px] text-[var(--st-emerald-glow)]">%</span>
        </div>
        <div className="text-[12px] text-[var(--st-l-4)] mt-1">de tickets paie en moins</div>
      </div>
      <blockquote className="pl-6 border-l border-[var(--st-l-7)] m-0">
        <p className="font-display text-[19px] italic text-[var(--st-l-0)] mb-3 leading-[1.35]">
          &ldquo;Nos serveurs ont arrêté de remettre en question les calculs. SmartTips montre le
          travail.&rdquo;
        </p>
        <div className="flex items-center gap-[10px]">
          <div
            className="w-7 h-7 rounded-full flex items-center justify-center text-white text-[9px] font-semibold shrink-0"
            style={{ background: 'var(--st-emerald)' }}
          >
            CP
          </div>
          <span className="text-[12.5px] text-[var(--st-l-3)]">
            Camille Pereira · DG, Brasserie Nord (4 adresses)
          </span>
        </div>
      </blockquote>
    </section>
  );
}

// ── FAQ ───────────────────────────────────────────────────────────────────────
type FaqItem = { q: string; a: string };
const FAQ_ITEMS: FaqItem[] = [
  {
    q: 'Comment SmartTips distribue-t-il les pourboires ?',
    a: "SmartTips utilise un modèle de machine learning entraîné sur les données de votre restaurant — shifts, rôles, commandes et coefficients personnalisés. À la clôture de chaque shift, le modèle calcule automatiquement la part de chaque employé selon les règles de votre établissement et génère un journal d'audit complet.",
  },
  {
    q: 'Puis-je utiliser SmartTips avec plusieurs restaurants ?',
    a: 'Oui. SmartTips est une plateforme multi-tenant native. Chaque restaurant dispose de son propre espace, de son propre modèle ML et de ses propres règles de distribution. Vous pouvez tout superviser depuis un tableau de bord central.',
  },
  {
    q: 'SmartTips est-il compatible avec mon logiciel de caisse ?',
    a: "SmartTips s'intègre avec les principaux systèmes POS du marché via API. Contactez-nous pour vérifier la compatibilité avec votre solution actuelle. Une importation manuelle des commandes est également disponible.",
  },
  {
    q: 'Comment les employés sont-ils notifiés de leurs pourboires ?',
    a: 'Chaque employé reçoit une notification détaillant sa part de pourboires dès la clôture du shift : montant, règles appliquées et historique accessible en tout temps. La transparence est au coeur de SmartTips.',
  },
  {
    q: 'Est-ce que SmartTips respecte la réglementation sur les pourboires ?',
    a: "SmartTips est conçu pour respecter les législations canadiennes et américaines sur les pourboires, incluant les obligations de déclaration fiscale. Il génère automatiquement les rapports T4 (Canada) et les relevés requis par l'IRS (États-Unis).",
  },
  {
    q: 'Combien coûte SmartTips ?',
    a: 'SmartTips propose un essai gratuit sans carte de crédit. Les plans payants sont calculés par établissement actif, avec des tarifs dégressifs pour les franchises. Contactez-nous pour un devis personnalisé adapté à votre réseau.',
  },
];

function FaqSection() {
  return (
    <section id="faq" className="px-14 py-14 border-t border-[var(--st-l-2)] bg-[var(--st-l-1)]">
      <div className="mb-9">
        <span className="st-eyebrow text-[var(--st-l-5)] mb-3 block">Questions fréquentes</span>
        <h2 className="st-display text-[38px] text-[var(--st-l-9)] leading-[1.1] max-w-[520px]">
          Tout ce que vous devez
          <br />
          <em className="text-[var(--st-l-6)]">savoir sur SmartTips.</em>
        </h2>
      </div>
      <div className="max-w-[760px] flex flex-col gap-3">
        {FAQ_ITEMS.map((item) => (
          <details
            key={item.q}
            className="group bg-white rounded-lg border border-[var(--st-l-2)] p-[20px]"
          >
            <summary className="flex items-center justify-between cursor-pointer list-none">
              <span className="text-[15px] font-semibold text-[var(--st-l-9)] leading-[1.3]">
                {item.q}
              </span>
              <ChevronDown
                size={16}
                className="text-[var(--st-l-5)] shrink-0 ml-4 transition-transform group-open:rotate-180"
              />
            </summary>
            <p className="mt-3 text-[13.5px] text-[var(--st-l-6)] leading-[1.6]">{item.a}</p>
          </details>
        ))}
      </div>
    </section>
  );
}

// ── CTA final ─────────────────────────────────────────────────────────────────
function CtaSection() {
  return (
    <section className="px-14 py-16 border-t border-[var(--st-l-2)] text-center">
      <h2
        className="st-display text-[var(--st-l-9)] mb-4"
        style={{ fontSize: 'clamp(36px, 4vw, 58px)', lineHeight: 1.06 }}
      >
        Prêt à distribuer les pourboires
        <br />
        <em className="text-[var(--st-l-6)]">de façon équitable ?</em>
      </h2>
      <p className="text-[16px] text-[var(--st-l-6)] max-w-[440px] mx-auto mb-8 leading-[1.55]">
        Démarrez votre essai gratuit en moins de 5 minutes. Aucune carte de crédit requise.
      </p>
      <div className="flex gap-3 justify-center">
        <Link href="/signup" className="st-btn st-btn-primary">
          Démarrer gratuitement <ArrowRight size={14} />
        </Link>
        <Link href="/login" className="st-btn st-btn-ghost-light">
          Se connecter
        </Link>
      </div>
    </section>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────
export default function LandingPage() {
  return (
    <div className="min-h-screen flex flex-col font-sans bg-[var(--st-l-0)] text-[var(--st-l-8)]">
      {/* JSON-LD structured data — hardcoded constants, no user input */}
      <script type="application/ld+json">{JSON_LD_SOFTWARE}</script>
      <script type="application/ld+json">{JSON_LD_ORG}</script>
      <LandingNav />
      <HeroSection />
      <AudienceSection />
      <ProblemsSection />
      <FeaturesSection />
      <UseCasesSection />
      <WhySection />
      <SocialProofSection />
      <FaqSection />
      <CtaSection />
    </div>
  );
}
