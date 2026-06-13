import * as CRMHandler from '../../../wailsjs/go/handlers/CRMHandler';
import { Customer, Supplier } from './types';

export const customers = {
    list: () => CRMHandler.GetCustomers(),
    save: (c: Customer) => CRMHandler.SaveCustomer(c),
    delete: (id: string, force?: boolean) => CRMHandler.DeleteCustomer(id, force || false),
};

export const suppliers = {
    list: () => CRMHandler.GetSuppliers(),
    save: (s: Supplier) => CRMHandler.SaveSupplier(s),
    delete: (id: string, force?: boolean) => CRMHandler.DeleteSupplier(id, force || false),
};
