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
    <div className="flex flex-col h-full space-y-4">
      {/* Table Container */}
      <div className="bg-surface border border-border rounded-2xl overflow-hidden shadow-[var(--shadow-card)] flex-1 flex flex-col min-h-0">
        <div className="flex-1 overflow-y-auto custom-scrollbar">
          <table className="w-full text-right text-sm border-collapse">
            <thead className="sticky top-0 z-10 bg-surface-hover border-b border-border text-text-muted text-xs">
              {table.getHeaderGroups().map((headerGroup) => (
                <tr key={headerGroup.id}>
                  {headerGroup.headers.map((header) => {
                    const size = header.column.getSize();
                    return (
                      <th
                        key={header.id}
                        style={{ width: size !== 150 ? size : undefined }}
                        className="px-4 py-3 font-bold cursor-pointer hover:text-text-main transition-colors select-none"
                        onClick={header.column.getToggleSortingHandler()}
                      >
                        <div className="flex items-center gap-1">
                          {flexRender(header.column.columnDef.header, header.getContext())}
                          {{
                            asc: <ArrowUp size={12} />,
                            desc: <ArrowDown size={12} />,
                          }[header.column.getIsSorted() as string] ?? null}
                        </div>
                      </th>
                    );
                  })}
                </tr>
              ))}
            </thead>
            <tbody>
              {table.getRowModel().rows?.length ? (
                table.getRowModel().rows.map((row) => {
                  const color = getRowColor ? getRowColor(row.original) : null;
                  
                  return (
                    <tr
                      key={row.id}
                      onClick={() => onRowClick?.(row.original)}
                      className={`border-b border-border/30 hover:bg-surface-hover transition-colors group ${
                        onRowClick ? 'cursor-pointer' : ''
                      }`}
                    >
                      {row.getVisibleCells().map((cell, idx) => {
                        const size = cell.column.getSize();
                        return (
                          <td
                            key={cell.id}
                            style={{ width: size !== 150 ? size : undefined }}
                            className="px-4 py-4 align-middle relative"
                          >
                            {/* Color indicator on the first cell */}
                            {idx === 0 && color && (
                              <div className={`absolute right-0 top-2 bottom-2 w-1 rounded-l-full bg-${color}-500 shadow-[0_0_8px_currentColor] text-${color}-500`} />
                            )}
                            {flexRender(cell.column.columnDef.cell, cell.getContext())}
                          </td>
                        );
                      })}
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={columns.length} className="h-24 text-center text-text-muted text-sm">
                    لا توجد نتائج مطابقة.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
      
      {/* Pagination */}
      <div className="flex items-center justify-between px-4 py-3 bg-surface border border-border rounded-xl">
        <div className="flex items-center gap-2">
          <button
            className="p-1 rounded-lg hover:bg-primary/10 text-text-muted hover:text-primary transition-colors disabled:opacity-50"
            onClick={() => table.previousPage()}
            disabled={!table.getCanPreviousPage()}
          >
            <ChevronRight size={18} />
          </button>
          <button
            className="p-1 rounded-lg hover:bg-primary/10 text-text-muted hover:text-primary transition-colors disabled:opacity-50"
            onClick={() => table.nextPage()}
            disabled={!table.getCanNextPage()}
          >
            <ChevronLeft size={18} />
          </button>
          <span className="text-xs text-text-muted font-bold">
            صفحة {table.getState().pagination.pageIndex + 1} من{' '}
            {table.getPageCount()}
          </span>
        </div>
        
        <select
          value={table.getState().pagination.pageSize}
          onChange={e => {
            table.setPageSize(Number(e.target.value))
          }}
          className="bg-bg border border-border text-xs rounded-lg px-2 py-1 outline-none text-text-main"
        >
          {[10, 20, 30, 40, 50].map(pageSize => (
            <option key={pageSize} value={pageSize}>
              عرض {pageSize}
            </option>
          ))}
        </select>
      </div>
    </div>
  );
}
