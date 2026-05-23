'use client';

import { useState, useMemo, useCallback } from 'react';
import { UserPlus, Pencil, Trash2, Mail } from 'lucide-react';
import { format, isValid } from 'date-fns';
import { fr } from 'date-fns/locale';
import { DataTable, type Column } from '../../../../components/ui/data-table';
import { Button } from '../../../../components/ui/button';
import { Badge, type BadgeTone } from '../../../../components/ui/badge';
import { Select } from '../../../../components/ui/select';
import { ConfirmDialog } from '../../../../components/ui/confirm-dialog';
import { EmployeeAvatar } from '../../../../components/dashboard/employee-avatar';
import { EmployeeForm } from '../../../../components/dashboard/employees/employee-form';
import {
  useEmployees,
  useCreateEmployee,
  useUpdateEmployee,
  useDeleteEmployee,
  useInviteEmployee,
} from '../../../../hooks/use-employees';
import type { Employee, EmployeeRole, CreateEmployeePayload } from '../../../../types/employee';
import { EMPLOYEE_ROLES } from '../../../../types/employee';
import type { EmployeeFormProps } from '../../../../components/dashboard/employees/employee-form';

type FormSubmitData = Parameters<EmployeeFormProps['onSubmit']>[0];

// ── Role display helpers ────────────────────────────────────────────────────
const ROLE_LABEL: Record<EmployeeRole, string> = {
  SERVER: 'Serveur',
  BUSSER: 'Runner',
  BARTENDER: 'Barman',
  COOK: 'Cuisinier',
  HOST: 'Hôte',
};

const ROLE_TONE: Record<EmployeeRole, BadgeTone> = {
  BARTENDER: 'indigo',
  SERVER: 'emerald',
  HOST: 'gold',
  COOK: 'neutral',
  BUSSER: 'neutral',
};

const ROLE_FILTER_OPTIONS = [
  { value: 'all', label: 'Tous les rôles' },
  ...EMPLOYEE_ROLES.map((r) => ({ value: r, label: ROLE_LABEL[r] })),
];

const STATUS_FILTER_OPTIONS = [
  { value: 'all', label: 'Tous les statuts' },
  { value: 'active', label: 'Actifs' },
  { value: 'inactive', label: 'Inactifs' },
];

function formatHireDate(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const d = new Date(raw);
  return isValid(d) ? format(d, 'd MMM yyyy', { locale: fr }) : null;
}

// ── Page component ──────────────────────────────────────────────────────────
export default function EmployeesPage() {
  const [roleFilter, setRoleFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [formOpen, setFormOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<Employee | undefined>();
  const [deleteTarget, setDeleteTarget] = useState<Employee | undefined>();

  // Memoised so the query key reference is stable when values haven't changed
  const filters = useMemo(
    () => ({
      role: roleFilter !== 'all' ? (roleFilter as EmployeeRole) : undefined,
      active: statusFilter === 'all' ? undefined : statusFilter === 'active',
    }),
    [roleFilter, statusFilter],
  );

  const { data: employees = [], isLoading, isError } = useEmployees(filters);
  const createMutation = useCreateEmployee();
  const updateMutation = useUpdateEmployee();
  const deleteMutation = useDeleteEmployee();
  const inviteMutation = useInviteEmployee();

  const openCreate = useCallback(() => {
    setEditTarget(undefined);
    setFormOpen(true);
  }, []);

  const openEdit = useCallback((emp: Employee) => {
    setEditTarget(emp);
    setFormOpen(true);
  }, []);

  function handleFormSubmit(data: FormSubmitData) {
    if (editTarget) {
      // hireDate is omitted from UpdateEmployeeDto — strip before sending
      const { hireDate: _omit, ...updatePayload } = data;
      updateMutation.mutate(
        { id: editTarget.id, payload: updatePayload },
        { onSuccess: () => setFormOpen(false) },
      );
    } else {
      // For create, hireDate is validated as required by the form schema
      createMutation.mutate(data as CreateEmployeePayload, { onSuccess: () => setFormOpen(false) });
    }
  }

  function handleDelete() {
    if (!deleteTarget) return;
    deleteMutation.mutate(deleteTarget.id, {
      onSuccess: () => setDeleteTarget(undefined),
    });
  }

  // ── Table columns ──────────────────────────────────────────────────────
  const columns = useMemo<Column<Employee>[]>(
    () => [
      {
        key: 'firstName',
        header: 'Employé',
        sortable: true,
        getValue: (row) => `${row.firstName} ${row.lastName}`,
        render: (row) => (
          <div className="flex items-center gap-2.5">
            <EmployeeAvatar
              firstName={row.firstName}
              lastName={row.lastName}
              role={row.role}
              size="sm"
            />
            <div>
              <p className="text-sm font-medium text-st-hi font-sans">
                {row.firstName} {row.lastName}
              </p>
              {row.email && (
                <p className="text-[11px] text-st-sec font-sans truncate max-w-[180px]">
                  {row.email}
                </p>
              )}
            </div>
          </div>
        ),
      },
      {
        key: 'role',
        header: 'Rôle',
        sortable: true,
        render: (row) => <Badge tone={ROLE_TONE[row.role]}>{ROLE_LABEL[row.role]}</Badge>,
      },
      {
        key: 'hourlyWage',
        header: 'Salaire/h',
        sortable: true,
        className: 'font-mono text-right',
        headerClassName: 'text-right',
        render: (row) => (
          <span className="font-mono text-sm text-st-hi tabular-nums">
            {Number(row.hourlyWage).toFixed(2)} $
          </span>
        ),
      },
      {
        key: 'coefficient',
        header: 'Coeff.',
        sortable: true,
        className: 'text-right',
        headerClassName: 'text-right',
        render: (row) => (
          <span className="font-mono text-sm text-st-hi tabular-nums">
            ×{Number(row.coefficient).toFixed(2)}
          </span>
        ),
      },
      {
        key: 'hireDate',
        header: 'Embauche',
        sortable: true,
        render: (row) => {
          const formatted = formatHireDate(row.hireDate);
          return formatted ? <span>{formatted}</span> : <span className="text-st-dim">—</span>;
        },
      },
      {
        key: 'active',
        header: 'Statut',
        render: (row) => (
          <Badge tone={row.active ? 'emerald' : 'neutral'}>
            {row.active ? 'Actif' : 'Inactif'}
          </Badge>
        ),
      },
      {
        key: 'actions',
        header: '',
        className: 'text-right',
        render: (row) => (
          <div className="flex items-center justify-end gap-1">
            {!row.email && (
              <Button
                variant="ghost"
                size="sm"
                aria-label="Envoyer une invitation"
                onClick={() => inviteMutation.mutate(row.id)}
                loading={inviteMutation.variables === row.id && inviteMutation.isPending}
              >
                <Mail size={13} />
              </Button>
            )}
            <Button
              variant="ghost"
              size="sm"
              aria-label="Modifier"
              disabled={updateMutation.isPending && updateMutation.variables?.id === row.id}
              onClick={() => openEdit(row)}
            >
              <Pencil size={13} />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              aria-label="Supprimer"
              className="hover:text-st-danger hover:border-st-danger/30"
              onClick={() => setDeleteTarget(row)}
            >
              <Trash2 size={13} />
            </Button>
          </div>
        ),
      },
    ],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [
      openEdit,
      inviteMutation.mutate,
      inviteMutation.isPending,
      inviteMutation.variables,
      updateMutation.isPending,
      updateMutation.variables,
      deleteMutation.isPending,
    ],
  );

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      {/* Page header */}
      <header className="flex items-center justify-between border-b border-st-border bg-st-bg px-6 py-4">
        <div>
          <h1 className="font-display text-2xl text-st-hi leading-tight">Équipe</h1>
          <p className="text-sm text-st-sec font-sans mt-0.5">
            {employees.length} employé{employees.length !== 1 ? 's' : ''} · gérez vos rôles et
            coefficients
          </p>
        </div>
        <Button onClick={openCreate}>
          <UserPlus size={14} />
          <span className="hidden sm:inline">Ajouter un employé</span>
          <span className="sm:hidden">Ajouter</span>
        </Button>
      </header>

      {/* Filters + table */}
      <div className="flex-1 overflow-auto p-4 md:p-6">
        <div className="mb-4 flex flex-col sm:flex-row gap-3">
          <div className="w-full sm:w-48">
            <Select
              placeholder="Tous les rôles"
              value={roleFilter}
              onValueChange={setRoleFilter}
              options={ROLE_FILTER_OPTIONS}
            />
          </div>
          <div className="w-full sm:w-48">
            <Select
              placeholder="Tous les statuts"
              value={statusFilter}
              onValueChange={setStatusFilter}
              options={STATUS_FILTER_OPTIONS}
            />
          </div>
        </div>

        <DataTable
          data={employees}
          columns={columns}
          loading={isLoading}
          isError={isError}
          searchPlaceholder="Rechercher un employé…"
          searchKeys={['firstName', 'lastName', 'email']}
          emptyState={
            <div className="flex flex-col items-center gap-2 py-4">
              <p className="text-st-sec font-sans">Aucun employé trouvé</p>
              <Button variant="outline" size="sm" onClick={openCreate}>
                Ajouter le premier employé
              </Button>
            </div>
          }
        />
      </div>

      {/* Employee form dialog */}
      <EmployeeForm
        open={formOpen}
        onOpenChange={setFormOpen}
        defaultValues={editTarget}
        onSubmit={handleFormSubmit}
        loading={createMutation.isPending || updateMutation.isPending}
      />

      {/* Delete confirmation */}
      <ConfirmDialog
        open={Boolean(deleteTarget)}
        onOpenChange={(o) => !o && setDeleteTarget(undefined)}
        title="Supprimer l'employé"
        description={
          deleteTarget
            ? `Êtes-vous sûr de vouloir supprimer ${deleteTarget.firstName} ${deleteTarget.lastName} ? Cette action peut être annulée depuis les paramètres.`
            : ''
        }
        onConfirm={handleDelete}
        loading={deleteMutation.isPending}
      />
    </div>
  );
}
