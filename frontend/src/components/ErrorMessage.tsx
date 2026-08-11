import React from 'react';
import { AlertCircle, Info, AlertTriangle, Lightbulb } from 'lucide-react';

interface ErrorMessageProps {
    message: string;
    hint?: string;
    type?: 'error' | 'warning' | 'info';
    field?: string;
}

export const ErrorMessage: React.FC<ErrorMessageProps> = ({
    message,
    hint,
    type = 'error',
    field
}) => {
    const getIcon = () => {
        switch (type) {
            case 'error':
                return <AlertCircle size={16} className="text-danger" />;
            case 'warning':
                return <AlertTriangle size={16} className="text-warning" />;
            case 'info':
                return <Info size={16} className="text-primary" />;
        }
    };

    const getColors = () => {
        switch (type) {
            case 'error':
                return 'bg-danger/10 border-danger/30 text-danger';
            case 'warning':
                return 'bg-warning/10 border-warning/30 text-warning';
            case 'info':
                return 'bg-primary/10 border-primary/30 text-primary';
        }
    };

    return (
        <div className={`rounded-xl border p-3 mt-2 ${getColors()}`}>
            <div className="flex items-start gap-2">
                <div className="mt-0.5">{getIcon()}</div>
                <div className="flex-1">
                    <p className="text-sm font-bold">{message}</p>
                    {hint && (
                        <div className="flex items-start gap-2 mt-2 pt-2 border-t border-current/20">
                            <Lightbulb size={14} className="mt-0.5 opacity-70" />
                            <p className="text-xs opacity-90">{hint}</p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

interface FieldErrorProps {
    error?: string;
    hint?: string;
}

export const FieldError: React.FC<FieldErrorProps> = ({ error, hint }) => {
    if (!error) return null;

    return (
        <div className="mt-1">
            <p className="text-danger text-xs font-bold flex items-center gap-1">
                <AlertCircle size={12} />
                {error}
            </p>
            {hint && (
                <p className="text-text-muted text-[10px] mt-1 flex items-start gap-1">
                    <Lightbulb size={10} className="mt-0.5" />
                    <span>{hint}</span>
                </p>
            )}
        </div>
    );
};
