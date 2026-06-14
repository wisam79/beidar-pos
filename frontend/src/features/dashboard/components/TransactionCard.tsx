import React from 'react';
import { formatCurrency } from '../../../core/utils';
import { Sale } from '../../../core/api';

// ═══════════════════════════════════════════════════════════════════════════════
// 💳 TRANSACTION CARD - Compact sale preview card
// ═══════════════════════════════════════════════════════════════════════════════

interface TransactionCardProps {
    sale: Sale;
    onClick: () => void;
    currency?: string;
}

export const TransactionCard = React.memo(({
    sale,
    onClick,
    currency = 'IQD',
}: TransactionCardProps) => (
    <div
        onClick={onClick}
        className="flex items-center gap-3.5 p-3 rounded-2xl border border-border/70 hover:border-primary/30 hover:bg-surface-hover/80 transition-all duration-300 ease-[var(--ease-spring)] hover:-translate-y-0.5 hover:shadow-sm cursor-pointer group"
    >
        <div
            className={`
        w-10 h-10 rounded-full flex items-center justify-center text-base shrink-0 shadow-inner
        ${sale.status === 'completed' ? 'bg-emerald-500/10' : 'bg-orange-500/10'}
      `}
        >
            {sale.paymentMethod === 'cash' ? '💵' : '💳'}
        </div>
        <div className="flex-1 min-w-0 text-right">
            <div className="flex justify-between items-center gap-2">
                <p className="font-black text-text-main text-xs truncate group-hover:text-primary transition-colors">
                    {sale.customer}
                </p>
                <span
                    className={`
            text-[9px] font-black px-2 py-0.5 rounded-full select-none
            ${sale.status === 'completed' ? 'text-emerald-500 bg-emerald-500/10' : 'text-orange-500 bg-orange-500/10'}
          `}
                >
                    {sale.status === 'completed' ? 'مكتمل' : 'معلق'}
                </span>
            </div>
            <div className="flex justify-between items-center mt-1.5">
                <p className="text-[9px] text-text-muted font-mono font-medium" dir="ltr">
                    #{sale.id.slice(-4)} • {new Date(sale.timestamp).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
                </p>
                <p className="font-black text-text-main text-xs font-mono">
                    {formatCurrency(sale.total, currency).replace(currency, '')}
                </p>
            </div>
        </div>
    </div>
));
