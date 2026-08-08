import React, { useState } from 'react';
import {
  useReactTable,
  getCoreRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  getFilteredRowModel,
  flexRender,
  ColumnDef,
  SortingState,
  OnChangeFn,
  PaginationState,
} from '@tanstack/react-table';
import { ChevronLeft, ChevronRight, ArrowDown, ArrowUp, LucideIcon } from 'lucide-react';
import { EmptyState } from '../ui';
export { type ColumnDef };

const rowColorMap: Record<string, string> = {
  emerald: 'hover:bg-emerald-500/5',
  orange: 'hover:bg-amber-500/5',
  red: 'hover:bg-red-500/5',
  default: 'hover:bg-surface-hover/60',
};

interface DataTableProps<TData, TValue> {
  columns: ColumnDef<TData, TValue>[];
  data: TData[];
  searchQuery?: string;
  emptyStateTitle?: string;
  emptyStateDescription?: string;
  emptyStateIcon?: LucideIcon;
  getRowColor?: (row: TData) => string; // e.g. "emerald", "orange", "red"
  onRowClick?: (row: TData) => void;
  manualPagination?: boolean;
  pageCount?: number;
  pagination?: { pageIndex: number; pageSize: number };
  onPaginationChange?: OnChangeFn<PaginationState>;
}

export function DataTable<TData, TValue>({
  columns,
  data,
  searchQuery = '',
  emptyStateTitle = 'لا توجد بيانات',
  emptyStateDescription = '',
  emptyStateIcon: Icon,
  getRowColor,
  onRowClick,
  manualPagination,
  pageCount,
  pagination,
  onPaginationChange,
}: DataTableProps<TData, TValue>) {
  const [sorting, setSorting] = useState<SortingState>([]);

  const table = useReactTable({
    data,
    columns,
    pageCount: manualPagination ? pageCount : undefined,
    manualPagination: manualPagination,
    getCoreRowModel: getCoreRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    onSortingChange: setSorting,
    onPaginationChange: manualPagination ? onPaginationChange : undefined,
    state: {
      sorting,
      globalFilter: searchQuery,
      ...(manualPagination && pagination ? { pagination } : {}),
    },
    onGlobalFilterChange: () => {},
  });

  if (data.length === 0) {
    if (Icon) {
      return <EmptyState icon={Icon} title={emptyStateTitle} description={emptyStateDescription} />;
    }
    return (
      <div className="flex flex-col items-center justify-center p-10 text-text-muted">
        <p className="font-bold">{emptyStateTitle}</p>
        <p className="text-sm">{emptyStateDescription}</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full space-y-3">
      {/* Table Container */}
      <div className="bg-surface border border-border/80 rounded-2xl overflow-hidden flex-1 flex flex-col min-h-0 select-none">
        <div className="flex-1 overflow-y-auto custom-scrollbar">
          <table className="w-full text-right text-sm border-collapse">
            <thead className="sticky top-0 z-10 bg-surface/95 border-b border-border/80 text-text-muted text-xs uppercase tracking-wider">
              {table.getHeaderGroups().map((headerGroup) => (
                <tr key={headerGroup.id}>
                  {headerGroup.headers.map((header) => {
                    const size = header.column.getSize();
                    return (
                      <th
                        key={header.id}
                        style={{ width: size !== 150 ? size : undefined }}
                        className="px-5 py-3.5 font-extrabold cursor-pointer hover:text-emerald-400 transition-colors select-none"
                        onClick={header.column.getToggleSortingHandler()}
                      >
                        <div className="flex items-center gap-1.5">
                          {flexRender(header.column.columnDef.header, header.getContext())}
                          {{
                            asc: <ArrowUp size={14} className="text-emerald-400" />,
                            desc: <ArrowDown size={14} className="text-emerald-400" />,
                          }[header.column.getIsSorted() as string] ?? null}
                        </div>
                      </th>
                    );
                  })}
                </tr>
              ))}
            </thead>
            <tbody className="divide-y divide-border/40 font-medium">
              {table.getRowModel().rows.length > 0 ? (
                table.getRowModel().rows.map((row) => {
                  const color = getRowColor ? getRowColor(row.original) : undefined;
                  return (
                    <tr
                      key={row.id}
                      onClick={() => onRowClick?.(row.original)}
                      className={`
                        min-h-[52px] transition-colors
                        ${rowColorMap[color || 'default']}
                        ${onRowClick ? 'cursor-pointer' : ''}
                      `}
                    >
                      {row.getVisibleCells().map((cell) => (
                        <td key={cell.id} className="px-5 py-3.5 align-middle font-extrabold">
                          {flexRender(cell.column.columnDef.cell, cell.getContext())}
                        </td>
                      ))}
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={columns.length} className="h-32 text-center text-text-muted text-sm font-bold">
                    لا توجد نتائج مطابقة لبحثك.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
      
      {/* Pagination Bar */}
      <div className="flex items-center justify-between px-5 py-3 bg-surface border border-border/80 rounded-xl select-none">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <button
              className="w-10 h-10 flex items-center justify-center rounded-xl bg-surface-hover hover:bg-emerald-500 hover:text-black border border-border/60 text-text-muted transition-all disabled:opacity-40 disabled:hover:bg-surface-hover disabled:hover:text-text-muted active:scale-95 touch-target cursor-pointer"
              onClick={() => table.previousPage()}
              disabled={!table.getCanPreviousPage()}
              title="الصفحة السابقة"
            >
              <ChevronRight size={20} />
            </button>
            <button
              className="w-10 h-10 flex items-center justify-center rounded-xl bg-surface-hover hover:bg-emerald-500 hover:text-black border border-border/60 text-text-muted transition-all disabled:opacity-40 disabled:hover:bg-surface-hover disabled:hover:text-text-muted active:scale-95 touch-target cursor-pointer"
              onClick={() => table.nextPage()}
              disabled={!table.getCanNextPage()}
              title="الصفحة التالية"
            >
              <ChevronLeft size={20} />
            </button>
          </div>
          <span className="text-xs md:text-sm text-text-muted font-extrabold tracking-wide">
            صفحة <span className="text-emerald-400 font-mono font-black">{table.getState().pagination.pageIndex + 1}</span> من{' '}
            <span className="text-text-main font-mono font-black">{table.getPageCount() || 1}</span>
          </span>
        </div>
        
        <select
          value={table.getState().pagination.pageSize}
          onChange={e => {
            table.setPageSize(Number(e.target.value))
          }}
          className="bg-bg border border-border/80 text-xs rounded-xl px-4 py-2.5 outline-none font-extrabold text-text-main hover:border-emerald-500/50 transition-colors touch-target cursor-pointer"
        >
          {[10, 20, 30, 40, 50].map(pageSize => (
            <option key={pageSize} value={pageSize}>
              عرض {pageSize} عناصر
            </option>
          ))}
        </select>
      </div>
    </div>
  );
}
