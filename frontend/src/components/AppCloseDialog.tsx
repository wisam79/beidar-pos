import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { EventsOn, EventsOff } from '../../wailsjs/runtime/runtime';
import { X, AlertTriangle, MinusSquare, Power } from 'lucide-react';
import { Button } from './ds/Button';

interface WailsWindow {
    runtime?: unknown;
    go?: {
        main?: {
            App?: {
                ForceQuit?: () => void;
                MinimizeWindow?: () => void;
            };
        };
    };
}

export const AppCloseDialog = () => {
    const [isOpen, setIsOpen] = useState(false);

    useEffect(() => {
        const wailsWindow = window as unknown as WailsWindow;
        if (!wailsWindow.runtime) {
            return;
        }

        const handler = () => {
            setIsOpen(true);
        };

        EventsOn('app-close-requested', handler);

        return () => {
            EventsOff('app-close-requested');
        };
    }, []);

    if (!isOpen) return null;

    const handleForceClose = () => {
        const wailsWindow = window as unknown as WailsWindow;
        if (wailsWindow.go?.main?.App?.ForceQuit) {
            wailsWindow.go.main.App.ForceQuit();
        }
    };

    const handleMinimize = () => {
        setIsOpen(false);
        const wailsWindow = window as unknown as WailsWindow;
        if (wailsWindow.go?.main?.App?.MinimizeWindow) {
            wailsWindow.go.main.App.MinimizeWindow();
        }
    };

    return createPortal(
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="relative w-full max-w-md overflow-hidden rounded-2xl border border-border bg-surface shadow-2xl animate-in zoom-in-95 duration-200">
                <div className="flex items-center justify-between border-b border-border bg-bg p-4">
                    <div className="flex items-center gap-2 text-danger">
                        <AlertTriangle size={20} />
                        <h2 className="text-lg font-bold text-text-main">تأكيد إغلاق النظام</h2>
                    </div>
                    <button
                        onClick={() => setIsOpen(false)}
                        className="rounded-xl p-2 text-text-muted transition hover:bg-surface-hover hover:text-text-main"
                    >
                        <X size={20} />
                    </button>
                </div>
                
                <div className="p-6">
                    <p className="text-base text-text-main leading-relaxed">
                        تحذير: إغلاق التطبيق الرئيسي سيؤدي إلى انقطاع الشبكة عن جميع أجهزة الكاشير وتوقفها عن العمل فوراً.
                    </p>
                    <p className="mt-4 text-sm font-bold text-text-muted">
                        هل أنت متأكد من رغبتك في الإغلاق النهائي؟
                    </p>
                </div>

                <div className="flex items-center justify-end gap-3 border-t border-border bg-bg p-4">
                    <Button variant="secondary" onClick={handleMinimize} className="flex-1 justify-center gap-2">
                        <MinusSquare size={18} />
                        لا، صغّر النافذة
                    </Button>
                    <Button variant="danger" onClick={handleForceClose} className="flex-1 justify-center gap-2">
                        <Power size={18} />
                        نعم، إغلاق نهائي
                    </Button>
                </div>
            </div>
        </div>,
        document.body
    );
};
