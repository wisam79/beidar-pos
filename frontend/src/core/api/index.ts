import { products, stock, categories } from './products';
import { sales, discounts } from './sales';
import { customers, suppliers } from './customers';
import { expenses, payments, shift, purchaseOrders } from './finance';
import { stats } from './stats';
import { prefs, auth, staff, license, admin, cloud, system, ai } from './admin';
import { lan, drive } from './network';
import { print, desktopApi } from './desktop';
import { db, backup, ImportProductsCSVNative, ExportProductsCSVNative, DownloadProductsTemplateNative, ExportDatabaseBackupNative, ImportDatabaseBackupNative } from './misc';

export * from './types';

export const api = {
    system,
    products,
    sales,
    customers,
    expenses,
    suppliers,
    stock,
    categories,
    discounts,
    stats,
    prefs,
    db,
    print,
    auth,
    staff,
    license,
    admin,
    payments,
    drive,
    lan,
    cloud,
    shift,
    purchaseOrders,
    ai,
    backup,
    ImportProductsCSVNative,
    ExportProductsCSVNative,
    DownloadProductsTemplateNative,
    ExportDatabaseBackupNative,
    ImportDatabaseBackupNative,
};

export { desktopApi };
