import * as CRMHandler from '../../../wailsjs/go/handlers/CRMHandler';
import { Customer, Supplier, PaginatedCustomers, PaginatedSuppliers } from './types';

export const customers = {
    list: () => CRMHandler.GetCustomers(),
    listPaged: (page: number = 1, pageSize: number = 50, search: string = ''): Promise<PaginatedCustomers> =>
        CRMHandler.GetCustomersPaged(page, pageSize, search),
    save: (c: Customer) => CRMHandler.SaveCustomer(c),
    delete: (id: string, force?: boolean) => CRMHandler.DeleteCustomer(id, force || false),
};

export const suppliers = {
    list: () => CRMHandler.GetSuppliers(),
    listPaged: (page: number = 1, pageSize: number = 50, search: string = ''): Promise<PaginatedSuppliers> =>
        CRMHandler.GetSuppliersPaged(page, pageSize, search),
    save: (s: Supplier) => CRMHandler.SaveSupplier(s),
    delete: (id: string, force?: boolean) => CRMHandler.DeleteSupplier(id, force || false),
};
