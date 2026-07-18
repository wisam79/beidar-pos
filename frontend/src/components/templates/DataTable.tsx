import React from 'react';
import { cn } from '../../theme/cn';

interface Column<T> {
  header: string;
  accessor: keyof T | ((row: T) => React.ReactNode);
  className?: string;
}

interface DataTableProps<T> {
  data: T[];
  columns: Column<T>[];
  keyExtractor: (row: T, index: number) => string | number;
  rowClassName?: (row: T, index: number) => string;
  emptyText?: string;
}

export function DataTable<T>({ data, columns, keyExtractor, rowClassName, emptyText = 'لا توجد بيانات' }: DataTableProps<T>) {
  if (!data.length) return <div className="py-10 text-center text-sm font-black text-text-muted">{emptyText}</div>;
  return (
    <div className="border border-border rounded-xl overflow-hidden bg-surface">
      <div className="overflow-x-auto">
        <table className="w-full text-right text-sm">
          <thead>
            <tr className="border-b border-border bg-surface-hover text-text-muted text-xs">
              {columns.map((col) => (
                <th key={String(col.header)} className={cn('', col.className)}>
                  {col.header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {data.map((row, idx) => (
              <tr key={keyExtractor(row, idx)} className={cn('border-b border-border/30 hover:bg-surface-hover transition-colors', rowClassName?.(row, idx))}>
                {columns.map((col, colIdx) => (
                  <td key={colIdx} className={cn('text-text-main font-medium', col.className)}>
                    {typeof col.accessor === 'function' ? col.accessor(row) : String(row[col.accessor] ?? '')}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
