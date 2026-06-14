/**
 * 📊 Export Utilities - Excel & Native Print Export
 * تصدير التقارير بصيغة Excel وطباعة PDF تقارير ناتيف
 */

// Lazy-load xlsx library (~500KB) only when needed
const getXLSX = () => import('xlsx');

// ═══════════════════════════════════════════════════════════════════════════════
// 📊 TYPES
// ═══════════════════════════════════════════════════════════════════════════════

export interface ExportColumn {
    key: string;
    header: string;
    width?: number;
}

export interface ExportOptions {
    filename: string;
    sheetName?: string;
    title?: string;
    subtitle?: string;
    rtl?: boolean;
    storeName?: string;
}

// ═══════════════════════════════════════════════════════════════════════════════
// 📗 EXCEL EXPORT
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Export data to Excel file with Enhanced Metadata
 */
export async function exportToExcel<T extends Record<string, unknown>>(
    data: T[],
    columns: ExportColumn[],
    options: ExportOptions
): Promise<void> {
    const XLSX = await getXLSX();

    // 1. Prepare Metadata Rows
    const date = new Date().toLocaleDateString('ar-IQ');
    const store = options.storeName || 'المتجر';
    const metadata = [
        [store], // Row 1: Store Name
        [`التقرير: ${options.title || 'تقرير'}`], // Row 2: Report Title
        [`التاريخ: ${date}`], // Row 3: Date
        [options.subtitle || ''], // Row 4: Subtitle/Range
        [''] // Row 5: Empty Spacer
    ];

    // 2. Prepare Headers & Data
    const headers = columns.map(col => col.header);
    const rows = data.map(item =>
        columns.map(col => {
            const value = item[col.key];
            if (value === null || value === undefined) return '';
            if (typeof value === 'boolean') return value ? 'نعم' : 'لا';
            return value;
        })
    );

    const wsData = [...metadata, headers, ...rows];

    // 3. Create Workbook & Sheet
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.aoa_to_sheet(wsData);

    // 4. Styling & Config
    ws['!cols'] = columns.map(col => ({ wch: col.width || 15 }));
    if (options.rtl !== false) {
        ws['!dir'] = 'rtl';
    }

    // Merge title cells for better look (A1:C1, etc)
    ws['!merges'] = [
        { s: { r: 0, c: 0 }, e: { r: 0, c: 2 } }, // Store Name
        { s: { r: 1, c: 0 }, e: { r: 1, c: 2 } }, // Report Title
        { s: { r: 2, c: 0 }, e: { r: 2, c: 2 } }, // Date
    ];

    XLSX.utils.book_append_sheet(wb, ws, options.sheetName || 'Sheet1');

    // 5. Download
    const filenameDate = new Date().toISOString().split('T')[0];
    const filename = `${options.filename}_${filenameDate}.xlsx`;
    XLSX.writeFile(wb, filename);
}

/**
 * Export multiple sheets to Excel
 */
export async function exportMultiSheetExcel(
    sheets: { name: string; data: Record<string, unknown>[]; columns: ExportColumn[] }[],
    options: ExportOptions
): Promise<void> {
    const XLSX = await getXLSX();
    const wb = XLSX.utils.book_new();

    sheets.forEach(sheet => {
        const headers = sheet.columns.map(col => col.header);
        const rows = sheet.data.map(item =>
            sheet.columns.map(col => {
                const value = item[col.key];
                if (value === null || value === undefined) return '';
                return value;
            })
        );

        const wsData = [headers, ...rows];
        const ws = XLSX.utils.aoa_to_sheet(wsData);
        ws['!cols'] = sheet.columns.map(col => ({ wch: col.width || 15 }));
        if (options.rtl !== false) ws['!dir'] = 'rtl';

        XLSX.utils.book_append_sheet(wb, ws, sheet.name);
    });

    const date = new Date().toISOString().split('T')[0];
    XLSX.writeFile(wb, `${options.filename}_${date}.xlsx`);
}

// ═══════════════════════════════════════════════════════════════════════════════
// 📕 PDF EXPORT (Native Browser Print Strategy)
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Export data to PDF using Native Browser Print Window
 * This guarantees perfect Arabic font support and table styling.
 */
export async function exportToPDF<T extends Record<string, unknown>>(
    data: T[],
    columns: ExportColumn[],
    options: ExportOptions
): Promise<void> {
    const date = new Date().toLocaleDateString('ar-IQ');
    const storeName = options.storeName || 'المتجر';

    // Generate Table HTML
    const tableHeader = columns.map(c => `<th class="px-4 py-2 border border-gray-300 bg-gray-100 font-bold text-gray-700">${c.header}</th>`).join('');

    const tableRows = data.map((item, idx) => {
        const rowCells = columns.map(col => {
            const val = item[col.key];
            const displayVal = (val === null || val === undefined) ? '' : String(val);
            return `<td class="px-4 py-2 border border-gray-300 text-gray-800 text-center">${displayVal}</td>`;
        }).join('');
        const bgClass = idx % 2 === 0 ? 'bg-white' : 'bg-gray-50';
        return `<tr class="${bgClass}">${rowCells}</tr>`;
    }).join('');

    // Create a temporary print container
    const printContainer = document.createElement('div');
    printContainer.id = 'print-container';
    printContainer.dir = 'rtl';
    printContainer.className = 'bg-white p-8 text-black';
    printContainer.innerHTML = `
        <style>
            @page { size: A4 landscape; margin: 10mm; }
            #print-container {
                font-family: 'IBM Plex Sans Arabic', 'Inter', system-ui, sans-serif !important;
                background: white !important;
                color: black !important;
            }
            #print-container table { page-break-inside: auto; }
            #print-container tr { page-break-inside: avoid; page-break-after: auto; }
        </style>
        
        <!-- Header -->
        <div class="flex justify-between items-start mb-8 border-b-2 border-gray-800 pb-4">
            <div class="text-right">
                <h1 class="text-2xl font-bold text-gray-900">${storeName}</h1>
                <p class="text-gray-500 text-sm mt-1">تاريخ الطباعة: ${date}</p>
            </div>
            <div class="text-center">
                <h2 class="text-xl font-bold text-gray-800">${options.title || 'تقرير'}</h2>
                <p class="text-gray-600 mt-1">${options.subtitle || ''}</p>
            </div>
            <div class="text-left w-32"></div>
        </div>

        <!-- Table -->
        <div class="w-full">
            <table class="w-full text-sm border-collapse">
                <thead>
                    <tr>${tableHeader}</tr>
                </thead>
                <tbody>
                    ${tableRows}
                </tbody>
            </table>
        </div>

        <!-- Footer -->
        <div class="mt-8 pt-4 border-t border-gray-200 text-center text-xs text-gray-400 flex justify-between">
            <span>تم استخراج التقرير بواسطة النظام</span>
            <span>عدد السجلات: ${data.length}</span>
        </div>
    `;

    document.body.appendChild(printContainer);

    // Give a tiny timeout for DOM layout, print, then clean up
    setTimeout(() => {
        window.print();
        if (document.body.contains(printContainer)) {
            document.body.removeChild(printContainer);
        }
    }, 100);
}

// ═══════════════════════════════════════════════════════════════════════════════
// 📊 REPORT EXPORTS API (Wrappers)
// ═══════════════════════════════════════════════════════════════════════════════

export async function exportSalesReport(
    sales: { id: string; date: string; customer?: string; total: number; status: string }[],
    format: 'excel' | 'pdf',
    currency: string = 'IQD',
    storeName?: string
): Promise<void> {
    const columns: ExportColumn[] = [
        { key: 'id', header: 'رقم الفاتورة', width: 15 },
        { key: 'date', header: 'التاريخ', width: 12 },
        { key: 'customer', header: 'العميل', width: 20 },
        { key: 'total', header: `الإجمالي (${currency})`, width: 15 },
        { key: 'status', header: 'الحالة', width: 12 },
    ];

    const statusLabels: Record<string, string> = {
        completed: 'مكتمل', pending: 'معلق', cancelled: 'ملغي', returned: 'مرتجع',
    };

    const formattedData = sales.map(s => ({
        ...s,
        customer: s.customer || 'زبون عام',
        status: statusLabels[s.status] || s.status,
        date: new Date(s.date).toLocaleDateString('ar-IQ'),
    }));

    const options: ExportOptions = {
        filename: 'تقرير_المبيعات',
        sheetName: 'المبيعات',
        title: 'تقرير المبيعات',
        subtitle: `إجمالي: ${sales.length} فاتورة`,
        storeName
    };

    if (format === 'excel') await exportToExcel(formattedData, columns, options);
    else await exportToPDF(formattedData, columns, options);
}

export async function exportProductsReport(
    products: { id: string; name: string; sku?: string; price: number; stock: number; category?: string }[],
    format: 'excel' | 'pdf',
    currency: string = 'IQD',
    storeName?: string
): Promise<void> {
    const columns: ExportColumn[] = [
        { key: 'sku', header: 'الكود', width: 15 },
        { key: 'name', header: 'اسم المنتج', width: 30 },
        { key: 'category', header: 'الفئة', width: 15 },
        { key: 'price', header: `السعر (${currency})`, width: 15 },
        { key: 'stock', header: 'المخزون', width: 10 },
    ];

    const formattedData = products.map(p => ({
        ...p,
        category: p.category || 'بدون فئة',
        sku: p.sku || '-',
    }));

    const options: ExportOptions = {
        filename: 'تقرير_المنتجات',
        sheetName: 'المنتجات',
        title: 'تقرير المنتجات',
        subtitle: `عدد المنتجات: ${products.length}`,
        storeName
    };

    if (format === 'excel') await exportToExcel(formattedData, columns, options);
    else await exportToPDF(formattedData, columns, options);
}

export async function exportInventoryReport(
    products: { id: string; name: string; stock: number; minStock?: number; cost?: number; price: number }[],
    format: 'excel' | 'pdf',
    currency: string = 'IQD',
    storeName?: string
): Promise<void> {
    const columns: ExportColumn[] = [
        { key: 'name', header: 'المنتج', width: 30 },
        { key: 'stock', header: 'الكمية', width: 10 },
        { key: 'minStock', header: 'الحد الأدنى', width: 10 },
        { key: 'cost', header: `التكلفة (${currency})`, width: 15 },
        { key: 'price', header: `السعر (${currency})`, width: 15 },
        { key: 'value', header: `القيمة (${currency})`, width: 15 },
    ];

    const formattedData = products.map(p => ({
        ...p,
        minStock: p.minStock || 0,
        cost: p.cost || 0,
        value: (p.stock * p.price).toLocaleString(),
    }));

    const totalValue = products.reduce((sum, p) => sum + (p.stock * p.price), 0);

    const options: ExportOptions = {
        filename: 'تقرير_المخزون',
        sheetName: 'المخزون',
        title: 'تقرير المخزون',
        subtitle: `إجمالي قيمة المخزون: ${totalValue.toLocaleString()} ${currency}`,
        storeName
    };

    if (format === 'excel') await exportToExcel(formattedData, columns, options);
    else await exportToPDF(formattedData, columns, options);
}

export async function exportCustomersReport(
    customers: { id: string; name: string; phone?: string; email?: string; debt?: number }[],
    format: 'excel' | 'pdf',
    currency: string = 'IQD',
    storeName?: string
): Promise<void> {
    const columns: ExportColumn[] = [
        { key: 'name', header: 'اسم العميل', width: 25 },
        { key: 'phone', header: 'الهاتف', width: 15 },
        { key: 'email', header: 'البريد', width: 25 },
        { key: 'debt', header: `الرصيد (${currency})`, width: 15 },
    ];

    const formattedData = customers.map(c => ({
        ...c,
        phone: c.phone || '-',
        email: c.email || '-',
        debt: c.debt || 0,
    }));

    const options: ExportOptions = {
        filename: 'تقرير_العملاء',
        sheetName: 'العملاء',
        title: 'تقرير العملاء',
        subtitle: `عدد العملاء: ${customers.length}`,
        storeName
    };

    if (format === 'excel') await exportToExcel(formattedData, columns, options);
    else await exportToPDF(formattedData, columns, options);
}

export async function exportFinancialSummary(
    data: { revenue: number; cogs: number; grossProfit: number; expenses: number; netProfit: number; profitMargin: number; },
    expensesData: { category: string; amount: number }[],
    format: 'excel' | 'pdf',
    options: { dateRange: string; currency: string; storeName?: string }
): Promise<void> {
    const summaryData = [
        { item: 'إجمالي الإيرادات', value: data.revenue },
        { item: 'تكلفة البضاعة المباعة', value: -data.cogs },
        { item: 'إجمالي الربح', value: data.grossProfit },
        { item: 'المصروفات التشغيلية', value: -data.expenses },
        { item: 'صافي الربح', value: data.netProfit },
        { item: 'هامش الربح %', value: data.profitMargin + '%' },
    ];

    const columns: ExportColumn[] = [
        { key: 'item', header: 'البند', width: 30 },
        { key: 'value', header: `القيمة (${options.currency})`, width: 20 },
    ];

    const expenseColumns: ExportColumn[] = [
        { key: 'category', header: 'فئة المصروف', width: 25 },
        { key: 'amount', header: `المبلغ (${options.currency})`, width: 20 },
    ];

    if (format === 'excel') {
        await exportMultiSheetExcel([
            { name: 'الملخص المالي', data: summaryData, columns },
            { name: 'تفاصيل المصروفات', data: expensesData, columns: expenseColumns },
        ], {
            filename: 'التقرير_المالي',
            title: 'التقرير المالي',
            subtitle: options.dateRange,
            storeName: options.storeName
        });
    } else {
        await exportToPDF(summaryData, columns, {
            filename: 'التقرير_المالي',
            title: 'التقرير المالي',
            subtitle: options.dateRange,
            storeName: options.storeName
        });
    }
}
