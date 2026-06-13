import React, { useEffect, useState } from 'react';
import { api } from '../core/api';

interface QRCodeProps {
    data: string;
    size?: number;
    className?: string;
}

/**
 * QRCode component that generates QR codes using the Go backend.
 * Falls back to external API if backend fails.
 */
export const QRCode: React.FC<QRCodeProps> = ({ data, size = 120, className = '' }) => {
    const [src, setSrc] = useState<string>('');
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(false);

    useEffect(() => {
        const generateQR = async () => {
            try {
                setLoading(true);
                setError(false);

                // Try backend QR generation first
                const base64 = await api.print.generateQR(data, size);
                setSrc(`data:image/png;base64,${base64}`);
            } catch (e) {
                console.warn('Backend QR failed, using fallback:', e);
                // Fallback to external API
                setSrc(`https://api.qrserver.com/v1/create-qr-code/?size=${size}x${size}&data=${encodeURIComponent(data)}`);
                setError(true);
            } finally {
                setLoading(false);
            }
        };

        if (data) {
            generateQR();
        }
    }, [data, size]);

    const containerStyle = { width: size, height: size };

    if (loading) {
        return (
            <div className={`bg-gray-100 animate-pulse flex items-center justify-center ${className}`} style={containerStyle}>
                <div className="w-8 h-8 border-2 border-gray-300 border-t-primary rounded-full animate-spin"></div>
            </div>
        );
    }

    return (
        <img
            src={src}
            alt="QR Code"
            className={`object-contain ${className}`}
            width={size}
            height={size}
        />
    );
};
