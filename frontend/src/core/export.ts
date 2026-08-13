/**
 * 📊 Export Utilities - Spreadsheet-safe CSV & Native Print Export
 * تصدير التقارير بصيغة CSV المتوافقة مع Excel وطباعة PDF تقارير ناتيف
 */

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
// 📗 CSV EXPORT (Excel-compatible)
// ═══════════════════════════════════════════════════════════════════════════════

const sanitizeCSVCell = (value: unknown): string => {
    const stringValue = value === null || value === undefined ? '' : String(value);
    return /^[=+\-@]/.test(stringValue) ? `'${stringValue}` : stringValue;
};

const quoteCSVCell = (value: unknown): string => {
    const sanitized = sanitizeCSVCell(value);
    return `"${sanitized.replace(/"/g, '""')}"`;
};

const downloadCSV = (content: string, filename: string): void => {
    // UTF-8 BOM ensures Arabic text displays correctly in Microsoft Excel.
    const blob = new Blob(["\uFEFF", content], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = filename;
    anchor.click();
    URL.revokeObjectURL(url);
};

/**
 * Export data to an Excel-compatible CSV. We intentionally avoid XLSX parsing
 * and generation because the former dependency has unresolved security issues.
 */
export async function exportToExcel<T extends Record<string, unknown>>(
    data: T[],
    columns: ExportColumn[],
    options: ExportOptions
): Promise<void> {
    const date = new Date().toLocaleDateString('ar-IQ');
    const store = options.storeName || 'المتجر';
    const metadata = [
        [store], // Row 1: Store Name
        [`التقرير: ${options.title || 'تقرير'}`], // Row 2: Report Title
        [`التاريخ: ${date}`], // Row 3: Date
        [options.subtitle || ''], // Row 4: Subtitle/Range
        [''] // Row 5: Empty Spacer
    ];

    const headers = columns.map(col => col.header);
    const rows = data.map(item =>
        columns.map(col => {
            const value = item[col.key];
            if (value === null || value === undefined) return '';
            if (typeof value === 'boolean') return value ? 'نعم' : 'لا';
            return value;
        })
    );

    const csv = [...metadata, headers, ...rows]
        .map(row => row.map(quoteCSVCell).join(','))
        .join('\r\n');
    const filenameDate = new Date().toISOString().split('T')[0];
    downloadCSV(csv, `${options.filename}_${filenameDate}.csv`);
}

/**
 * Export multiple sheets to Excel
 */
export async function exportMultiSheetExcel(
    sheets: { name: string; data: Record<string, unknown>[]; columns: ExportColumn[] }[],
    options: ExportOptions
): Promise<void> {
    const date = new Date().toISOString().split('T')[0];
    sheets.forEach(sheet => {
        const headers = sheet.columns.map(col => col.header);
        const rows = sheet.data.map(item =>
            sheet.columns.map(col => {
                const value = item[col.key];
                if (value === null || value === undefined) return '';
                return value;
            })
        );

        const csv = [headers, ...rows]
            .map(row => row.map(quoteCSVCell).join(','))
            .join('\r\n');
        downloadCSV(csv, `${options.filename}_${sheet.name}_${date}.csv`);
    });
}

// ═══════════════════════════════════════════════════════════════════════════════
// 📕 PDF EXPORT (Native Browser Print Strategy)
// ═══════════════════════════════════════════════════════════════════════════════

function escapeHTML(str: string): string {
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

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
    const storeName = escapeHTML(options.storeName || 'المتجر');
    const title = escapeHTML(options.title || 'تقرير');
    const subtitle = escapeHTML(options.subtitle || '');

    // Generate Table HTML
    const tableHeader = columns.map(c => `<th class="px-4 py-2 border border-gray-300 bg-gray-100 font-bold text-gray-700">${escapeHTML(c.header)}</th>`).join('');

    const tableRows = data.map((item, idx) => {
        const rowCells = columns.map(col => {
            const val = item[col.key];
            const displayVal = (val === null || val === undefined) ? '' : escapeHTML(String(val));
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
                <h2 class="text-xl font-bold text-gray-800">${title}</h2>
                <p class="text-gray-600 mt-1">${subtitle}</p>
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
