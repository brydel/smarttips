'use client';

import { useState, useMemo, useCallback, useRef, useEffect } from 'react';
import { LayoutGrid, List, Search, UserPlus, ChevronLeft, ChevronRight } from 'lucide-react';
import { EmployeeAvatar } from '../../../../components/dashboard/employee-avatar';
import { EmployeeCard } from '../../../../components/dashboard/employees/employee-card';
import { TeamDrawer } from '../../../../components/dashboard/employees/team-drawer';
import { InviteModal } from '../../../../components/dashboard/employees/invite-modal';
import { BulkBar } from '../../../../components/dashboard/employees/bulk-bar';
import { UndoToast } from '../../../../components/dashboard/employees/undo-toast';
import {
  useEmployees,
  useUpdateEmployee,
  useDeleteEmployee,
} from '../../../../hooks/use-employees';
import { useInvitations, useRevokeInvitation } from '../../../../hooks/use-invitations';
import { useAuth } from '../../../../hooks/use-auth';
import type { InvitationListItem } from '../../../../services/invitations.service';
// QUAL-C1: role meta from shared config — eliminates per-page duplicate (ARCH-C1)
import { ROLE_CONFIG, ROLE_ORDER } from '../../../../config/employee-roles';
import { normalizeCoefficient } from '../../../../lib/sparkline';
import type { Employee, EmployeeRole, UpdateEmployeePayload } from '../../../../types/employee';
import type { ExistingEmployeeForInvite } from '../../../../components/dashboard/employees/invite-modal';

type RoleFilter = EmployeeRole | 'all';
type StatusFilter = 'ACTIVE' | 'INACTIVE' | 'all';
type SortBy = 'name_asc' | 'fair_desc';

const PAGE_SIZE = 9;

// SEC-M4: min ms between two archive actions (prevents rapid-fire accidental archives)
const ARCHIVE_COOLDOWN_MS = 800;

// ── Page ──────────────────────────────────────────────────────────────────────
export default function EmployeesPage() {
  // ── Filters ──
  const [roleFilter, setRoleFilter] = useState<RoleFilter>('all');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('ACTIVE');
  const [sortBy, setSortBy] = useState<SortBy>('name_asc');
  const [search, setSearch] = useState('');
  const [view, setView] = useState<'grid' | 'list'>('grid');
  const [page, setPage] = useState(0);

  // ── Selection ──
  const [selected, setSelected] = useState<Set<string>>(new Set());

  // ── Drawer ──
  const [drawerId, setDrawerId] = useState<string | null>(null);

  // ── Invite modal ──
  const [inviteOpen, setInviteOpen] = useState(false);
  /** Employé existant à inviter (via TeamDrawer). null = créer + inviter. */
  const [inviteEmployee, setInviteEmployee] = useState<ExistingEmployeeForInvite | null>(null);

  // ── Archive undo ──
  const [pendingArchive, setPendingArchive] = useState<Employee | null>(null);
  const archiveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // ROB-M2: track bulk-delete timers for cleanup on unmount
  const bulkTimersRef = useRef<ReturnType<typeof setTimeout>[]>([]);
  // SEC-M4: last archive timestamp for cooldown
  const lastArchiveRef = useRef<number>(0);

  // ── Data ──
  const { data: allEmployees = [], isLoading, isError } = useEmployees();
  const updateMutation = useUpdateEmployee();
  const deleteMutation = useDeleteEmployee();
  const { data: invitations = [] } = useInvitations();
  const revokeInvitationMutation = useRevokeInvitation();
  const { user } = useAuth();

  // Reset page when filters change
  useEffect(() => {
    setPage(0);
  }, [roleFilter, statusFilter, search, sortBy]);

  // Clean up all timers on unmount (ROB-M2)
  useEffect(() => {
    return () => {
      if (archiveTimerRef.current) clearTimeout(archiveTimerRef.current);
      bulkTimersRef.current.forEach(clearTimeout);
      bulkTimersRef.current = [];
    };
  }, []);

  // ── Derived stats ──
  const totalCount = allEmployees.length;
  const activeCount = allEmployees.filter((e) => e.active).length;

  // ── Role tab counts (across ALL employees, ignoring role filter but respecting status) ──
  const roleTabCounts = useMemo(() => {
    const base = allEmployees.filter((e) => {
      if (statusFilter === 'ACTIVE') return e.active;
      if (statusFilter === 'INACTIVE') return !e.active;
      return true;
    });
    return {
      all: base.length,
      SERVER: base.filter((e) => e.role === 'SERVER').length,
      BARTENDER: base.filter((e) => e.role === 'BARTENDER').length,
      HOST: base.filter((e) => e.role === 'HOST').length,
      COOK: base.filter((e) => e.role === 'COOK').length,
      BUSSER: base.filter((e) => e.role === 'BUSSER').length,
    };
  }, [allEmployees, statusFilter]);

  // ── Status tab counts ──
  const statusTabCounts = useMemo(
    () => ({
      ACTIVE: allEmployees.filter(
        (e) => e.active && (roleFilter === 'all' || e.role === roleFilter),
      ).length,
      INACTIVE: allEmployees.filter(
        (e) => !e.active && (roleFilter === 'all' || e.role === roleFilter),
      ).length,
      all: allEmployees.filter((e) => roleFilter === 'all' || e.role === roleFilter).length,
    }),
    [allEmployees, roleFilter],
  );

  // ── Filtered + sorted list (excludes pending archive) ──
  const filteredEmployees = useMemo(() => {
    let list = allEmployees.filter((e) => {
      // Exclude pending archive (not yet deleted but hidden)
      if (pendingArchive && e.id === pendingArchive.id) return false;
      // Role filter
      if (roleFilter !== 'all' && e.role !== roleFilter) return false;
      // Status filter
      if (statusFilter === 'ACTIVE' && !e.active) return false;
      if (statusFilter === 'INACTIVE' && e.active) return false;
      // Search
      if (search.trim()) {
        const q = search.toLowerCase();
        const name = `${e.firstName} ${e.lastName}`.toLowerCase();
        const email = (e.email ?? '').toLowerCase();
        if (!name.includes(q) && !email.includes(q)) return false;
      }
      return true;
    });

    // Sort
    list = [...list].sort((a, b) => {
      if (sortBy === 'name_asc') {
        return `${a.firstName} ${a.lastName}`.localeCompare(`${b.firstName} ${b.lastName}`, 'fr');
      }
      if (sortBy === 'fair_desc') {
        return normalizeCoefficient(b.coefficient) - normalizeCoefficient(a.coefficient);
      }
      return 0;
    });

    return list;
  }, [allEmployees, pendingArchive, roleFilter, statusFilter, search, sortBy]);

  const totalPages = Math.max(1, Math.ceil(filteredEmployees.length / PAGE_SIZE));
  const safePageIndex = Math.min(page, totalPages - 1);
  const pageEmployees = filteredEmployees.slice(
    safePageIndex * PAGE_SIZE,
    (safePageIndex + 1) * PAGE_SIZE,
  );

  // ── Drawer employee ──
  const drawerEmployee = drawerId ? (allEmployees.find((e) => e.id === drawerId) ?? null) : null;

  // ── Handlers ──
  const handleSelect = useCallback((id: string, checked: boolean) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (checked) next.add(id);
      else next.delete(id);
      return next;
    });
  }, []);

  const handleArchive = useCallback(
    (emp: Employee) => {
      // SEC-M4: cooldown check
      const now = Date.now();
      if (now - lastArchiveRef.current < ARCHIVE_COOLDOWN_MS) return;
      lastArchiveRef.current = now;

      setDrawerId(null);
      setPendingArchive(emp);
      if (archiveTimerRef.current) clearTimeout(archiveTimerRef.current);
      archiveTimerRef.current = setTimeout(() => {
        deleteMutation.mutate(emp.id, {
          onSettled: () => setPendingArchive(null),
        });
        archiveTimerRef.current = null;
      }, 6000);
    },
    [deleteMutation],
  );

  const handleUndoArchive = useCallback(() => {
    if (archiveTimerRef.current) {
      clearTimeout(archiveTimerRef.current);
      archiveTimerRef.current = null;
    }
    setPendingArchive(null);
  }, []);

  const handleBulkArchive = useCallback(() => {
    const ids = [...selected];
    setSelected(new Set());

    // ROB-C2: flush any pending single-archive undo before starting bulk,
    // to avoid conflicting with an in-progress undo timer.
    if (archiveTimerRef.current) {
      clearTimeout(archiveTimerRef.current);
      archiveTimerRef.current = null;
      if (pendingArchive) {
        deleteMutation.mutate(pendingArchive.id);
        setPendingArchive(null);
      }
    }

    // Show undo toast for the first employee only
    const first = allEmployees.find((e) => ids[0] === e.id);
    if (first) handleArchive(first);

    // Silently delete the rest after a small delay — tracked for unmount cleanup (ROB-M2)
    ids.slice(1).forEach((id, i) => {
      const t = setTimeout(() => deleteMutation.mutate(id), 200 + i * 50);
      bulkTimersRef.current.push(t);
    });
  }, [selected, allEmployees, pendingArchive, handleArchive, deleteMutation]);

  const handleSave = useCallback(
    (id: string, payload: UpdateEmployeePayload) => {
      updateMutation.mutate({ id, payload }, { onSuccess: () => setDrawerId(null) });
    },
    [updateMutation],
  );

  /** Inviter un employé existant (depuis le drawer) */
  const handleInviteExisting = useCallback((emp: Employee) => {
    setInviteEmployee({
      id: emp.id,
      firstName: emp.firstName,
      lastName: emp.lastName,
      email: emp.email,
    });
    setDrawerId(null);
    setInviteOpen(true);
  }, []);

  const handleInviteClose = useCallback(() => {
    setInviteOpen(false);
    // Reset après fermeture pour éviter de garder l'état employé en mémoire
    setTimeout(() => setInviteEmployee(null), 300);
  }, []);

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        flex: 1,
        overflow: 'hidden',
        background: '#0A0E1A',
      }}
    >
      {/* ── Page Header ───────────────────────────────────────────────── */}
      <header
        className="page-container-employees"
        style={{
          padding: '28px 32px 20px',
          borderBottom: '1px solid #1B2236',
          display: 'flex',
          alignItems: 'flex-end',
          justifyContent: 'space-between',
          gap: 16,
          flexShrink: 0,
        }}
      >
        <div>
          {/* Title */}
          <h1
            className="page-title-employees"
            style={{
              fontFamily: 'var(--st-font-display, Georgia, serif)',
              fontSize: 48,
              fontWeight: 400,
              lineHeight: 1,
              color: '#F4F6FB',
              margin: '0 0 10px',
            }}
          >
            Équipe
            <span style={{ color: '#3A4366', fontStyle: 'italic' }}> &amp; performance.</span>
          </h1>
          {/* Inline stats */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 20, flexWrap: 'wrap' }}>
            <Stat value={totalCount} label="membres" />
            <span style={{ color: '#1B2236', fontSize: 16 }}>·</span>
            <Stat value={activeCount} label="actifs" color="#34D399" />
            <span style={{ color: '#1B2236', fontSize: 16 }}>·</span>
            <Stat value="—" label="en service" color="#818CF8" />
          </div>
        </div>

        {/* Invite button */}
        <button
          onClick={() => setInviteOpen(true)}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 7,
            padding: '8px 16px',
            borderRadius: 9,
            background: '#6366F1',
            border: '1px solid transparent',
            color: '#fff',
            fontSize: 13,
            fontWeight: 600,
            cursor: 'pointer',
            fontFamily: 'inherit',
            transition: 'background .15s ease',
            flexShrink: 0,
          }}
          onMouseEnter={(e) => {
            (e.currentTarget as HTMLButtonElement).style.background = '#4F46E5';
          }}
          onMouseLeave={(e) => {
            (e.currentTarget as HTMLButtonElement).style.background = '#6366F1';
          }}
        >
          <UserPlus size={14} />+ Inviter
        </button>
      </header>

      {/* ── Filter area ───────────────────────────────────────────────── */}
      <div style={{ padding: '16px 32px 0', flexShrink: 0 }}>
        {/* Role tabs */}
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 10 }}>
          <button
            className={`team-tab${roleFilter === 'all' ? ' active' : ''}`}
            onClick={() => setRoleFilter('all')}
          >
            Tous
            <span className="count">{roleTabCounts.all}</span>
          </button>
          {ROLE_ORDER.map((r) => (
            <button
              key={r}
              className={`team-tab${roleFilter === r ? ' active' : ''}`}
              onClick={() => setRoleFilter(r)}
              style={
                roleFilter === r
                  ? { borderColor: ROLE_CONFIG[r].color, color: ROLE_CONFIG[r].color }
                  : {}
              }
            >
              {ROLE_CONFIG[r].plural}
              <span className="count">{roleTabCounts[r]}</span>
            </button>
          ))}
        </div>

        {/* Status tabs */}
        <div style={{ display: 'flex', gap: 6, marginBottom: 16 }}>
          {(
            [
              { key: 'ACTIVE', label: 'Actifs', count: statusTabCounts.ACTIVE },
              { key: 'INACTIVE', label: 'Inactifs', count: statusTabCounts.INACTIVE },
              { key: 'all', label: 'Tous', count: statusTabCounts.all },
            ] as const
          ).map((s) => (
            <button
              key={s.key}
              className={`team-tab${statusFilter === s.key ? ' active' : ''}`}
              onClick={() => setStatusFilter(s.key)}
            >
              {s.label}
              <span className="count">{s.count}</span>
            </button>
          ))}
        </div>

        {/* Sort + View + Search row */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 10,
            marginBottom: 16,
            flexWrap: 'wrap',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            {/* Sort select */}
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as SortBy)}
              style={{
                padding: '6px 10px',
                borderRadius: 8,
                background: '#141A2B',
                border: '1px solid #252D45',
                color: '#C5CCE0',
                fontSize: 12.5,
                cursor: 'pointer',
                outline: 'none',
                fontFamily: 'inherit',
              }}
              aria-label="Trier par"
            >
              <option value="name_asc">Nom A→Z</option>
              <option value="fair_desc">Coefficient ↓</option>
            </select>

            {/* View toggle */}
            <div
              style={{
                display: 'flex',
                border: '1px solid #252D45',
                borderRadius: 8,
                overflow: 'hidden',
              }}
            >
              {(
                [
                  { v: 'grid' as const, icon: <LayoutGrid size={14} />, label: 'Vue grille' },
                  { v: 'list' as const, icon: <List size={14} />, label: 'Vue liste' },
                ] as const
              ).map(({ v, icon, label }) => (
                <button
                  key={v}
                  onClick={() => setView(v)}
                  aria-label={label}
                  aria-pressed={view === v}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    padding: '6px 10px',
                    background: view === v ? '#252D45' : 'transparent',
                    border: 'none',
                    color: view === v ? '#F4F6FB' : '#5A6485',
                    cursor: 'pointer',
                    transition: 'all .15s ease',
                  }}
                >
                  {icon}
                </button>
              ))}
            </div>
          </div>

          {/* Search */}
          <div style={{ position: 'relative', flex: '0 1 260px' }}>
            <Search
              size={13}
              style={{
                position: 'absolute',
                left: 10,
                top: '50%',
                transform: 'translateY(-50%)',
                color: '#5A6485',
                pointerEvents: 'none',
              }}
              aria-hidden="true"
            />
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Rechercher…"
              aria-label="Rechercher un employé"
              style={{
                width: '100%',
                padding: '7px 10px 7px 30px',
                borderRadius: 8,
                background: '#141A2B',
                border: '1px solid #252D45',
                color: '#F4F6FB',
                fontSize: 13,
                outline: 'none',
                fontFamily: 'inherit',
                transition: 'border-color .15s ease',
              }}
              onFocus={(e) => (e.currentTarget.style.borderColor = '#6366F1')}
              onBlur={(e) => (e.currentTarget.style.borderColor = '#252D45')}
            />
          </div>

          {/* Results count */}
          <span
            style={{
              fontSize: 12,
              color: '#5A6485',
              flexShrink: 0,
              fontFamily: 'var(--st-font-mono, monospace)',
            }}
          >
            {filteredEmployees.length} résultat{filteredEmployees.length !== 1 ? 's' : ''}
          </span>
        </div>
      </div>

      {/* ── Content area ──────────────────────────────────────────────── */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '0 32px 32px' }}>
        {isLoading ? (
          <LoadingSkeleton view={view} />
        ) : isError ? (
          <ErrorState />
        ) : filteredEmployees.length === 0 ? (
          <EmptyState search={search} onInvite={() => setInviteOpen(true)} />
        ) : view === 'grid' ? (
          /* ── Grid view ── */
          <div
            className="employees-grid"
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(3, 1fr)',
              gap: 12,
            }}
          >
            {pageEmployees.map((emp) => (
              <EmployeeCard
                key={emp.id}
                employee={emp}
                selected={selected.has(emp.id)}
                anySelected={selected.size > 0}
                onSelect={handleSelect}
                onClick={setDrawerId}
              />
            ))}
          </div>
        ) : (
          /* ── List view ── */
          <div
            className="employees-list"
            style={{
              background: '#0F1422',
              borderRadius: 12,
              border: '1px solid #1B2236',
              overflow: 'hidden',
            }}
          >
            {/* Table header */}
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: '2fr 1fr 100px 120px 100px 80px',
                gap: 0,
                padding: '10px 16px',
                borderBottom: '1px solid #1B2236',
              }}
            >
              {/* QUAL-H3: use index as key to avoid duplicate empty-string keys */}
              {['Employé', 'Rôle', 'Statut', 'Taux horaire', 'Coefficient', ''].map((h, i) => (
                <span
                  key={i}
                  style={{
                    fontSize: 10.5,
                    color: '#5A6485',
                    fontFamily: 'var(--st-font-mono, monospace)',
                    fontWeight: 600,
                    textTransform: 'uppercase',
                    letterSpacing: '0.06em',
                  }}
                >
                  {h}
                </span>
              ))}
            </div>

            {/* Table rows */}
            {pageEmployees.map((emp, idx) => {
              const roleMeta = ROLE_CONFIG[emp.role];
              const safeCoeff = normalizeCoefficient(emp.coefficient);
              return (
                <div
                  key={emp.id}
                  role="row"
                  tabIndex={0}
                  onClick={() => setDrawerId(emp.id)}
                  // QUAL-M6: keyboard support for list rows
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      setDrawerId(emp.id);
                    }
                  }}
                  aria-label={`${emp.firstName} ${emp.lastName}, ${roleMeta.label}`}
                  style={{
                    display: 'grid',
                    gridTemplateColumns: '2fr 1fr 100px 120px 100px 80px',
                    gap: 0,
                    padding: '12px 16px',
                    borderBottom: idx < pageEmployees.length - 1 ? '1px solid #141A2B' : 'none',
                    cursor: 'pointer',
                    transition: 'background .15s ease',
                    alignItems: 'center',
                    outline: 'none',
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = '#141A2B')}
                  onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                  onFocus={(e) => (e.currentTarget.style.background = '#141A2B')}
                  onBlur={(e) => (e.currentTarget.style.background = 'transparent')}
                >
                  {/* Employee */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
                    <input
                      type="checkbox"
                      checked={selected.has(emp.id)}
                      onChange={(e) => {
                        e.stopPropagation();
                        handleSelect(emp.id, e.target.checked);
                      }}
                      onClick={(e) => e.stopPropagation()}
                      style={{ accentColor: '#6366F1', flexShrink: 0 }}
                      aria-label={`Sélectionner ${emp.firstName} ${emp.lastName}`}
                    />
                    <EmployeeAvatar
                      firstName={emp.firstName}
                      lastName={emp.lastName}
                      role={emp.role}
                      size="sm"
                    />
                    <div style={{ minWidth: 0 }}>
                      <div
                        style={{
                          fontSize: 13.5,
                          fontWeight: 600,
                          color: '#F4F6FB',
                          whiteSpace: 'nowrap',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                        }}
                      >
                        {emp.firstName} {emp.lastName}
                      </div>
                      {emp.email && (
                        <div
                          style={{
                            fontSize: 11,
                            color: '#5A6485',
                            whiteSpace: 'nowrap',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                          }}
                        >
                          {emp.email}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Role */}
                  <span
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      padding: '2px 8px',
                      borderRadius: 9999,
                      background: `color-mix(in oklch, ${roleMeta.color} 12%, transparent)`,
                      border: `1px solid color-mix(in oklch, ${roleMeta.color} 22%, transparent)`,
                      fontSize: 11,
                      color: roleMeta.color,
                      fontWeight: 500,
                      width: 'fit-content',
                    }}
                  >
                    {roleMeta.label}
                  </span>

                  {/* Status */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                    <span
                      style={{
                        width: 6,
                        height: 6,
                        borderRadius: '50%',
                        background: emp.active ? '#34D399' : '#3A4366',
                        flexShrink: 0,
                      }}
                    />
                    <span style={{ fontSize: 12, color: emp.active ? '#34D399' : '#5A6485' }}>
                      {emp.active ? 'Actif' : 'Inactif'}
                    </span>
                  </div>

                  {/* Hourly wage */}
                  <span
                    className="employees-col-wage"
                    style={{
                      fontSize: 13,
                      color: '#F4F6FB',
                      fontFamily: 'var(--st-font-mono, monospace)',
                      fontWeight: 600,
                    }}
                  >
                    {Number(emp.hourlyWage).toFixed(2)}$
                  </span>

                  {/* Coefficient */}
                  <span
                    className="employees-col-coeff"
                    style={{
                      fontSize: 13,
                      color: roleMeta.color,
                      fontFamily: 'var(--st-font-mono, monospace)',
                      fontWeight: 600,
                    }}
                  >
                    ×{safeCoeff.toFixed(2)}
                  </span>

                  {/* Actions */}
                  <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleArchive(emp);
                      }}
                      style={{
                        background: 'transparent',
                        border: 'none',
                        cursor: 'pointer',
                        color: '#3A4366',
                        padding: 4,
                        borderRadius: 5,
                        transition: 'color .15s ease',
                        fontSize: 11,
                      }}
                      aria-label={`Archiver ${emp.firstName} ${emp.lastName}`}
                      onMouseEnter={(e) => (e.currentTarget.style.color = '#EF4444')}
                      onMouseLeave={(e) => (e.currentTarget.style.color = '#3A4366')}
                    >
                      ✕
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* ── Pagination ── */}
        {!isLoading && !isError && filteredEmployees.length > 0 && totalPages > 1 && (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 10,
              marginTop: 20,
            }}
          >
            <button
              className="pagination-btn"
              onClick={() => setPage((p) => Math.max(0, p - 1))}
              disabled={safePageIndex === 0}
              aria-label="Page précédente"
              style={{
                display: 'flex',
                alignItems: 'center',
                padding: '5px 8px',
                borderRadius: 7,
                background: 'transparent',
                border: '1px solid #252D45',
                color: safePageIndex === 0 ? '#252D45' : '#8892B0',
                cursor: safePageIndex === 0 ? 'not-allowed' : 'pointer',
                transition: 'all .15s ease',
              }}
            >
              <ChevronLeft size={14} />
            </button>

            <span
              style={{
                fontSize: 12.5,
                color: '#8892B0',
                fontFamily: 'var(--st-font-mono, monospace)',
              }}
            >
              {safePageIndex + 1} / {totalPages}
            </span>

            <button
              className="pagination-btn"
              onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
              disabled={safePageIndex === totalPages - 1}
              aria-label="Page suivante"
              style={{
                display: 'flex',
                alignItems: 'center',
                padding: '5px 8px',
                borderRadius: 7,
                background: 'transparent',
                border: '1px solid #252D45',
                color: safePageIndex === totalPages - 1 ? '#252D45' : '#8892B0',
                cursor: safePageIndex === totalPages - 1 ? 'not-allowed' : 'pointer',
                transition: 'all .15s ease',
              }}
            >
              <ChevronRight size={14} />
            </button>
          </div>
        )}

        {/* ── Section Invitations ───────────────────────────────────── */}
        {invitations.length > 0 && (
          <InvitationsSection
            invitations={invitations}
            isOwner={user?.role === 'OWNER'}
            revoking={revokeInvitationMutation.isPending}
            onRevoke={(id) => revokeInvitationMutation.mutate(id)}
          />
        )}
      </div>

      {/* ── Overlays ───────────────────────────────────────────────── */}

      {/* Team drawer */}
      <TeamDrawer
        employee={drawerEmployee}
        onClose={() => setDrawerId(null)}
        onArchive={handleArchive}
        onSave={handleSave}
        saving={updateMutation.isPending}
        onInvite={handleInviteExisting}
      />

      {/* Invite modal */}
      <InviteModal
        open={inviteOpen}
        onClose={handleInviteClose}
        existingEmployee={inviteEmployee}
      />

      {/* Bulk bar */}
      <BulkBar
        count={selected.size}
        onDismiss={() => setSelected(new Set())}
        onArchive={handleBulkArchive}
      />

      {/* Undo toast */}
      <UndoToast employee={pendingArchive} onUndo={handleUndoArchive} />
    </div>
  );
}

// ── Sub-components ─────────────────────────────────────────────────────────────

function Stat({
  value,
  label,
  color = '#C5CCE0',
}: {
  value: number | string;
  label: string;
  color?: string;
}) {
  return (
    <div style={{ display: 'flex', alignItems: 'baseline', gap: 5 }}>
      <span
        style={{
          fontSize: 22,
          fontWeight: 700,
          color,
          fontFamily: 'var(--st-font-mono, monospace)',
          lineHeight: 1,
        }}
      >
        {value}
      </span>
      <span style={{ fontSize: 12.5, color: '#5A6485' }}>{label}</span>
    </div>
  );
}

function LoadingSkeleton({ view }: { view: 'grid' | 'list' }) {
  if (view === 'list') {
    return (
      <div
        style={{
          background: '#0F1422',
          borderRadius: 12,
          border: '1px solid #1B2236',
          overflow: 'hidden',
        }}
      >
        {Array.from({ length: 6 }).map((_, i) => (
          <div
            key={i}
            style={{
              height: 56,
              borderBottom: i < 5 ? '1px solid #141A2B' : 'none',
              background: 'linear-gradient(90deg, #141A2B 25%, #1B2236 50%, #141A2B 75%)',
              backgroundSize: '200% 100%',
              animation: 'shifts-fade-up .3s ease both',
              animationDelay: `${i * 0.05}s`,
            }}
          />
        ))}
      </div>
    );
  }
  return (
    <div
      className="employees-grid"
      style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}
    >
      {Array.from({ length: 6 }).map((_, i) => (
        <div
          key={i}
          style={{
            height: 160,
            borderRadius: 12,
            background: '#0F1422',
            border: '1px solid #1B2236',
            animation: 'shifts-fade-up .3s ease both',
            animationDelay: `${i * 0.04}s`,
          }}
        />
      ))}
    </div>
  );
}

function ErrorState() {
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '60px 24px',
        color: '#5A6485',
        textAlign: 'center',
        gap: 8,
      }}
    >
      <div style={{ fontSize: 32 }}>⚠</div>
      <div style={{ fontSize: 15, color: '#8892B0' }}>Erreur de chargement</div>
      <div style={{ fontSize: 12.5 }}>Impossible de récupérer les employés. Réessayez.</div>
    </div>
  );
}

function EmptyState({ search, onInvite }: { search: string; onInvite: () => void }) {
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '60px 24px',
        textAlign: 'center',
        gap: 12,
      }}
    >
      <div style={{ fontSize: 40, opacity: 0.3 }}>👥</div>
      <div style={{ fontSize: 15, color: '#8892B0', fontWeight: 500 }}>
        {search ? 'Aucun résultat pour cette recherche' : 'Aucun employé trouvé'}
      </div>
      {!search && (
        <button
          onClick={onInvite}
          style={{
            marginTop: 4,
            padding: '7px 16px',
            borderRadius: 8,
            background: '#141A2B',
            border: '1px solid #252D45',
            color: '#818CF8',
            fontSize: 13,
            cursor: 'pointer',
            fontFamily: 'inherit',
            transition: 'all .15s ease',
          }}
          onMouseEnter={(e) => (e.currentTarget.style.borderColor = '#6366F1')}
          onMouseLeave={(e) => (e.currentTarget.style.borderColor = '#252D45')}
        >
          + Inviter le premier employé
        </button>
      )}
    </div>
  );
}

// ── InvitationsSection ──────────────────────────────────────────────────────

const STATUS_LABELS: Record<InvitationListItem['status'], string> = {
  PENDING: 'En attente',
  ACCEPTED: 'Acceptée',
  REVOKED: 'Révoquée',
  EXPIRED: 'Expirée',
};

const STATUS_COLORS: Record<InvitationListItem['status'], string> = {
  PENDING: '#EAB308',
  ACCEPTED: '#34D399',
  REVOKED: '#EF4444',
  EXPIRED: '#5A6485',
};

function InvitationsSection({
  invitations,
  isOwner,
  revoking,
  onRevoke,
}: {
  invitations: InvitationListItem[];
  isOwner: boolean;
  revoking: boolean;
  onRevoke: (id: string) => void;
}) {
  const [confirmId, setConfirmId] = useState<string | null>(null);

  return (
    <div style={{ marginTop: 32 }}>
      <h2
        style={{
          fontSize: 13,
          fontWeight: 600,
          color: '#5A6485',
          textTransform: 'uppercase',
          letterSpacing: '0.06em',
          marginBottom: 12,
          fontFamily: 'var(--st-font-mono, monospace)',
        }}
      >
        Invitations
      </h2>
      <div
        style={{
          background: '#0F1422',
          borderRadius: 12,
          border: '1px solid #1B2236',
          overflow: 'hidden',
        }}
      >
        {invitations.map((inv, idx) => {
          const color = STATUS_COLORS[inv.status];
          const isLast = idx === invitations.length - 1;
          return (
            <div
              key={inv.id}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '10px 16px',
                borderBottom: isLast ? 'none' : '1px solid #141A2B',
                gap: 12,
                flexWrap: 'wrap',
              }}
            >
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 12,
                  flex: 1,
                  minWidth: 0,
                  flexWrap: 'wrap',
                }}
              >
                {/* Employé */}
                <div style={{ minWidth: 140 }}>
                  <p style={{ fontSize: 13, fontWeight: 600, color: '#F4F6FB', margin: 0 }}>
                    {inv.employee.firstName} {inv.employee.lastName}
                  </p>
                  <p style={{ fontSize: 11, color: '#5A6485', margin: 0 }}>{inv.email}</p>
                </div>
                {/* Status */}
                <span
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    padding: '2px 8px',
                    borderRadius: 9999,
                    background: `color-mix(in oklch, ${color} 12%, transparent)`,
                    border: `1px solid color-mix(in oklch, ${color} 22%, transparent)`,
                    fontSize: 11,
                    color,
                    fontWeight: 500,
                    whiteSpace: 'nowrap',
                  }}
                >
                  {STATUS_LABELS[inv.status]}
                </span>
                {/* Dates */}
                <p style={{ fontSize: 11, color: '#5A6485', margin: 0, whiteSpace: 'nowrap' }}>
                  Expire {new Date(inv.expiresAt).toLocaleDateString('fr-CA')}
                  {inv.acceptedAt &&
                    ` · Acceptée ${new Date(inv.acceptedAt).toLocaleDateString('fr-CA')}`}
                </p>
                {/* Inviteur */}
                <p style={{ fontSize: 11, color: '#5A6485', margin: 0, whiteSpace: 'nowrap' }}>
                  par {inv.inviter.name}
                </p>
              </div>

              {/* Action revoke (OWNER seulement, PENDING seulement) */}
              {isOwner &&
                inv.status === 'PENDING' &&
                (confirmId === inv.id ? (
                  <div style={{ display: 'flex', gap: 6 }}>
                    <button
                      onClick={() => {
                        onRevoke(inv.id);
                        setConfirmId(null);
                      }}
                      disabled={revoking}
                      style={{
                        padding: '4px 10px',
                        borderRadius: 6,
                        background: 'rgba(239,68,68,.12)',
                        border: '1px solid rgba(239,68,68,.25)',
                        color: '#EF4444',
                        fontSize: 11,
                        fontWeight: 600,
                        cursor: 'pointer',
                        fontFamily: 'inherit',
                      }}
                    >
                      Confirmer
                    </button>
                    <button
                      onClick={() => setConfirmId(null)}
                      style={{
                        padding: '4px 10px',
                        borderRadius: 6,
                        background: 'transparent',
                        border: '1px solid #252D45',
                        color: '#5A6485',
                        fontSize: 11,
                        cursor: 'pointer',
                        fontFamily: 'inherit',
                      }}
                    >
                      Annuler
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={() => setConfirmId(inv.id)}
                    style={{
                      padding: '4px 10px',
                      borderRadius: 6,
                      background: 'transparent',
                      border: '1px solid #252D45',
                      color: '#5A6485',
                      fontSize: 11,
                      cursor: 'pointer',
                      fontFamily: 'inherit',
                      transition: 'all .15s ease',
                    }}
                    onMouseEnter={(e) => {
                      (e.currentTarget as HTMLButtonElement).style.color = '#EF4444';
                      (e.currentTarget as HTMLButtonElement).style.borderColor =
                        'rgba(239,68,68,.3)';
                    }}
                    onMouseLeave={(e) => {
                      (e.currentTarget as HTMLButtonElement).style.color = '#5A6485';
                      (e.currentTarget as HTMLButtonElement).style.borderColor = '#252D45';
                    }}
                  >
                    Révoquer
                  </button>
                ))}
            </div>
          );
        })}
      </div>
    </div>
  );
}
