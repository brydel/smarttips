'use client';

import {
  useState,
  useMemo,
  useDeferredValue,
  useCallback,
  type ReactNode,
  type KeyboardEvent,
} from 'react';
import {
  ChevronUp,
  ChevronDown,
  ChevronsUpDown,
  Search,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import { cn } from '../../lib/cn';
import { Input } from './input';
import { Button } from './button';

export type SortDirection = 'asc' | 'desc' | null;

export interface Column<T> {
  key: keyof T | string;
  header: string;
  render?: (row: T) => ReactNode;
  sortable?: boolean;
  className?: string;
  headerClassName?: string;
  getValue?: (row: T) => string | number;
}

interface DataTableProps<T extends { id: string }> {
  data: T[];
  columns: Column<T>[];
  loading?: boolean;
  searchPlaceholder?: string;
  searchKeys?: (keyof T)[];
  emptyState?: ReactNode;
  toolbar?: ReactNode;
  pageSize?: number;
  isError?: boolean;
}

interface SortState {
  key: string;
  direction: SortDirection;
}

const PAGE_SIZE_DEFAULT = 50;

function SortIcon({ direction }: { direction: SortDirection }) {
  if (direction === 'asc') return <ChevronUp size={13} className="text-st-indigo-glow shrink-0" />;
  if (direction === 'desc')
    return <ChevronDown size={13} className="text-st-indigo-glow shrink-0" />;
  return <ChevronsUpDown size={13} className="text-st-dim opacity-50 shrink-0" />;
}

function SkeletonRow({ cols }: { cols: number }) {
  return (
    <tr aria-hidden="true">
      {Array.from({ length: cols }).map((_, i) => (
        <td key={i} className="px-4 py-3">
          <div
            className="h-4 rounded bg-st-raised animate-pulse"
            style={{ width: `${50 + (i % 3) * 20}%` }}
          />
        </td>
      ))}
    </tr>
  );
}

export function DataTable<T extends { id: string }>({
  data,
  columns,
  loading = false,
  searchPlaceholder = 'Rechercher…',
  searchKeys = [],
  emptyState,
  toolbar,
  pageSize = PAGE_SIZE_DEFAULT,
  isError = false,
}: DataTableProps<T>) {
  const [search, setSearch] = useState('');
  const [sort, setSort] = useState<SortState>({ key: '', direction: null });
  const [page, setPage] = useState(1);

  // Defer search filtering to avoid blocking input on every keystroke
  const deferredSearch = useDeferredValue(search);

  const filtered = useMemo(() => {
    if (!deferredSearch.trim()) return data;
    const q = deferredSearch.toLowerCase();
    return data.filter((row) =>
      (searchKeys as string[]).some((k) => {
        const val = (row as Record<string, unknown>)[k];
        return typeof val === 'string' && val.toLowerCase().includes(q);
      }),
    );
  }, [data, deferredSearch, searchKeys]);

  const sorted = useMemo(() => {
    if (!sort.key || !sort.direction) return filtered;
    const col = columns.find((c) => c.key === sort.key);
    return [...filtered].sort((a, b) => {
      const av = col?.getValue ? col.getValue(a) : (a as Record<string, unknown>)[sort.key];
      const bv = col?.getValue ? col.getValue(b) : (b as Record<string, unknown>)[sort.key];
      const cmp =
        typeof av === 'number' && typeof bv === 'number'
          ? av - bv
          : String(av ?? '').localeCompare(String(bv ?? ''));
      return sort.direction === 'asc' ? cmp : -cmp;
    });
  }, [filtered, sort, columns]);

  const totalPages = Math.max(1, Math.ceil(sorted.length / pageSize));
  const paginated = useMemo(
    () => sorted.slice((page - 1) * pageSize, page * pageSize),
    [sorted, page, pageSize],
  );

  const toggleSort = useCallback((key: string) => {
    setPage(1);
    setSort((prev) => {
      if (prev.key !== key) return { key, direction: 'asc' };
      if (prev.direction === 'asc') return { key, direction: 'desc' };
      return { key: '', direction: null };
    });
  }, []);

  function handleSortKeyDown(e: KeyboardEvent<HTMLTableCellElement>, key: string) {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      toggleSort(key);
    }
  }

  function handleSearchChange(e: React.ChangeEvent<HTMLInputElement>) {
    setSearch(e.target.value);
    setPage(1);
  }

  return (
    <div className="flex flex-col gap-3">
      {/* Toolbar row */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
        <div className="w-full sm:w-72">
          <Input
            placeholder={searchPlaceholder}
            value={search}
            onChange={handleSearchChange}
            leftIcon={<Search size={14} />}
            aria-label={searchPlaceholder}
          />
        </div>
        {toolbar && <div className="flex items-center gap-2 sm:ml-auto">{toolbar}</div>}
      </div>

      {/* Error state */}
      {isError && (
        <div
          role="alert"
          className="rounded-md border border-st-danger/30 bg-st-danger/10 px-4 py-3 text-sm text-st-danger font-sans"
        >
          Impossible de charger les données. Vérifiez votre connexion.
        </div>
      )}

      {/* Table */}
      <div className="overflow-x-auto rounded-lg border border-st-border">
        <table className="w-full border-collapse text-sm" role="grid">
          <thead>
            <tr className="border-b border-st-border bg-st-card">
              {columns.map((col) => (
                <th
                  key={String(col.key)}
                  className={cn(
                    'px-4 py-3 text-left font-mono text-[10.5px] uppercase tracking-widest text-st-sec',
                    col.sortable &&
                      'cursor-pointer select-none hover:text-st-pri focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-st-indigo focus-visible:ring-inset',
                    col.headerClassName,
                  )}
                  onClick={col.sortable ? () => toggleSort(String(col.key)) : undefined}
                  onKeyDown={
                    col.sortable ? (e) => handleSortKeyDown(e, String(col.key)) : undefined
                  }
                  tabIndex={col.sortable ? 0 : undefined}
                  role={col.sortable ? 'columnheader' : undefined}
                  aria-sort={
                    col.sortable && sort.key === String(col.key)
                      ? sort.direction === 'asc'
                        ? 'ascending'
                        : 'descending'
                      : col.sortable
                        ? 'none'
                        : undefined
                  }
                >
                  <span className="inline-flex items-center gap-1">
                    {col.header}
                    {col.sortable && (
                      <SortIcon direction={sort.key === String(col.key) ? sort.direction : null} />
                    )}
                  </span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              Array.from({ length: 5 }).map((_, i) => <SkeletonRow key={i} cols={columns.length} />)
            ) : paginated.length === 0 ? (
              <tr>
                <td
                  colSpan={columns.length}
                  className="px-4 py-12 text-center text-st-sec text-sm font-sans"
                >
                  {isError ? null : (emptyState ?? 'Aucun résultat')}
                </td>
              </tr>
            ) : (
              paginated.map((row) => (
                <tr
                  key={row.id}
                  className="border-b border-st-border last:border-0 hover:bg-st-raised/50 transition-colors"
                >
                  {columns.map((col) => (
                    <td
                      key={String(col.key)}
                      className={cn('px-4 py-3 text-st-sec font-sans', col.className)}
                    >
                      {col.render
                        ? col.render(row)
                        : String((row as Record<string, unknown>)[col.key as string] ?? '—')}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Footer: count + pagination */}
      {!loading && !isError && sorted.length > 0 && (
        <div className="flex items-center justify-between">
          <p className="text-[11.5px] text-st-sec font-mono">
            {sorted.length} résultat{sorted.length !== 1 ? 's' : ''}
            {search ? ` sur ${data.length}` : ''}
          </p>
          {totalPages > 1 && (
            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
                aria-label="Page précédente"
              >
                <ChevronLeft size={14} />
              </Button>
              <span className="text-[11.5px] font-mono text-st-sec">
                {page} / {totalPages}
              </span>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
                aria-label="Page suivante"
              >
                <ChevronRight size={14} />
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
