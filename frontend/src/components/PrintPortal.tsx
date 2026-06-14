import React, { useEffect, useRef, useState } from 'react';

interface PrintPortalProps {
    children: React.ReactNode;
    onAfterPrint?: () => void;
}

/**
 * PrintPortal - Uses direct DOM clone for thermal receipts and lazy image capture for A4
 * Uses direct window.print() on the main window for Wails compatibility
 */
export const PrintPortal: React.FC<PrintPortalProps> = ({ children, onAfterPrint }) => {
    const contentRef = useRef<HTMLDivElement>(null);
    const [phase, setPhase] = useState<'render' | 'capture' | 'done'>('render');

    useEffect(() => {
        if (phase !== 'render') return;

        // Give a moment for fonts to fully settle
        const prepare = async () => {
            await document.fonts.ready;
            await new Promise(resolve => setTimeout(resolve, 200));
            setPhase('capture');
        };

        prepare();
    }, [phase]);

    useEffect(() => {
        if (phase !== 'capture' || !contentRef.current) return;

        const processPrint = async () => {
            try {
                const container = contentRef.current;
                if (!container) return;

                // Find all A4 pages (for multi-page support)
                const pages = container.querySelectorAll('.a4-page');
                const isThermal = container.offsetWidth < 300 || pages.length === 0;
                const isMultiPage = pages.length > 1;

                const printContainer = document.createElement('div');
                printContainer.id = 'print-container';

                if (isThermal) {
                    // THERMAL: Direct DOM Clone for maximum sharpness
                    // We clone the container's children directly
                    const contentClone = container.cloneNode(true) as HTMLElement;

                    // Remove any inline styles that might conflict (optional, but safer)
                    // contentClone.style.width = 'auto'; 
                    // contentClone.style.height = 'auto';

                    printContainer.appendChild(contentClone);

                    // Add styles specific to direct printing
                    const style = document.createElement('style');
                    style.textContent = `
                        @media print {
                            html, body { margin: 0 !important; padding: 0 !important; }
                            body * { visibility: hidden !important; }
                            #print-container, #print-container * { 
                                visibility: visible !important; 
                            }
                            #print-container { 
                                display: block !important; 
                                position: absolute !important;
                                left: 0 !important;
                                top: 0 !important;
                                width: 100% !important;
                            }
                        }
                        @page { 
                            size: auto; 
                            margin: 0; 
                        }
                        #print-container {
                            position: fixed;
                            left: -9999px;
                            top: 0;
                            width: ${container.offsetWidth}px; /* Match original width */
                        }
                    `;
                    printContainer.appendChild(style);

                } else {
                    // A4: Image Capture (Legacy method for A4 per user request/stability)
                    let imagesHtml = '';
                    if (pages.length > 0) {
                        const { toPng } = await import('html-to-image');
                        for (let i = 0; i < pages.length; i++) {
                            const page = pages[i] as HTMLElement;
                            const dataUrl = await toPng(page, {
                                quality: 1.0,
                                pixelRatio: 2,
                                backgroundColor: 'white',
                                cacheBust: true,
                            });
                            imagesHtml += `<img src="${dataUrl}" class="page-img" />`;
                        }
                    } else {
                        // Fallback
                        const { toPng } = await import('html-to-image');
                        const dataUrl = await toPng(container, {
                            quality: 1.0,
                            pixelRatio: 2,
                            backgroundColor: 'white',
                            cacheBust: true,
                        });
                        imagesHtml = `<img src="${dataUrl}" class="page-img" />`;
                    }

                    printContainer.innerHTML = `
                        <style>
                            @media print {
                                html, body { margin: 0 !important; padding: 0 !important; }
                                body * { visibility: hidden !important; }
                                #print-container, #print-container * { 
                                    visibility: visible !important; 
                                }
                                #print-container { 
                                    display: block !important; 
                                    position: absolute !important;
                                    left: 0 !important;
                                    top: 0 !important;
                                }
                            }
                            @page { 
                                size: A4 portrait; 
                                margin: 0; 
                            }
                            #print-container {
                                position: fixed;
                                left: -9999px;
                                top: 0;
                            }
                            #print-container * {
                                margin: 0;
                                padding: 0;
                                box-sizing: border-box;
                            }
                            #print-container .page-img {
                                width: 210mm;
                                height: 297mm;
                                display: block;
                                page-break-after: ${isMultiPage ? 'always' : 'avoid'};
                            }
                            #print-container .page-img:last-child {
                                page-break-after: avoid;
                            }
                        </style>
                        ${imagesHtml}
                    `;
                }

                document.body.appendChild(printContainer);

                // Trigger print on current window
                setTimeout(() => {
                    window.print();

                    // Cleanup after print
                    setTimeout(() => {
                        if (document.body.contains(printContainer)) {
                            document.body.removeChild(printContainer);
                        }
                        setPhase('done');
                        onAfterPrint?.();
                    }, 1000);
                }, 100);

            } catch (err) {
                console.error('Print capture failed:', err);
                setPhase('done');
                onAfterPrint?.();
            }
        };

        processPrint();
    }, [phase, onAfterPrint]);

    if (phase === 'done') return null;

    return (
        <div className="print-portal-wrapper">
            <div
                ref={contentRef}
                className="print-capture-container"
            >
                <style>{`
                    .print-portal-wrapper {
                        position: fixed;
                        top: 0;
                        left: 0;
                        opacity: 0;
                        pointer-events: none;
                        z-index: -1;
                    }
                    .print-capture-container {
                        background: white;
                        display: inline-block;
                        overflow: visible;
                        width: auto;
                        height: auto;
                    }
                    .print-capture-container ::-webkit-scrollbar { display: none; }
                    .print-capture-container * { overflow: visible !important; }
                `}</style>
                {children}
            </div>
        </div>
    );
};
