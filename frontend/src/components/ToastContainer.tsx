import React, { useEffect, useState, useRef } from 'react';
import { createPortal } from 'react-dom';
import { Toast } from './Toast';
import { Notification } from '../core/types';

interface ToastContainerProps {
    notifications: Notification[];
    onRemove: (id: number) => void;
}

export const ToastContainer = ({ notifications, onRemove }: ToastContainerProps) => {
    const [mounted, setMounted] = useState(false);
    const containerRef = useRef<HTMLDivElement | null>(null);

    useEffect(() => {
        // Create stable portal container
        const container = document.createElement('div');
        container.id = 'toast-portal-root';
        // Changed to Top-Center
        container.className = 'fixed top-6 left-1/2 -translate-x-1/2 z-[10000] flex flex-col gap-2 items-center pointer-events-none';
        document.body.appendChild(container);
        containerRef.current = container;
        setMounted(true);

        return () => {
            if (containerRef.current && document.body.contains(containerRef.current)) {
                document.body.removeChild(containerRef.current);
            }
        };
    }, []);

    if (!mounted || !containerRef.current) return null;

    return createPortal(
        <>
            {notifications.map((n: Notification) => (
                <Toast key={n.id} notification={n} onRemove={onRemove} />
            ))}
        </>,
        containerRef.current
    );
};