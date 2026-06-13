import React from 'react';
import { formatCurrency } from '../../core/utils';
import { Sale } from '../../core/api';

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
        className="flex items-center gap-3 p-3 rounded-xl bg-bg border border-border hover:border-primary/30 hover:bg-surface-hover transition-all cursor-pointer group"
    >
        <div
            className={`
        w-10 h-10 rounded-xl flex items-center justify-center text-lg shrink-0
        ${sale.status === 'completed' ? 'bg-emerald-500/10' : 'bg-orange-500/10'}
      `}
        >
            {sale.paymentMethod === 'cash' ? '💵' : '💳'}
        </div>
        <div className="flex-1 min-w-0">
            <div className="flex justify-between items-center">
                <p className="font-bold text-text-main text-sm truncate group-hover:text-primary transition-colors">
                    {sale.customer}
                </p>
                <span
                    className={`
            text-[10px] font-bold px-2 py-0.5 rounded-full
            ${sale.status === 'completed' ? 'text-emerald-600 bg-emerald-500/10' : 'text-orange-600 bg-orange-500/10'}
          `}
                >
                    {sale.status === 'completed' ? 'مكتمل' : 'معلق'}
                </span>
            </div>
            <div className="flex justify-between items-center mt-1">
                <p className="text-[10px] text-text-muted font-mono">
                    #{sale.id.slice(-4)} • {new Date(sale.timestamp).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
                </p>
                <p className="font-black text-text-main text-sm font-mono">
                    {formatCurrency(sale.total, currency).replace(currency, '')}
                </p>
            </div>
        </div>
    </div>
));
