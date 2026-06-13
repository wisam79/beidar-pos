import * as SaleHandler from '../../../wailsjs/go/handlers/SaleHandler';
import * as DiscountHandler from '../../../wailsjs/go/handlers/DiscountHandler';
import * as Models from '../../../wailsjs/go/models';
import { Discount } from './types';

export const sales = {
    list: (page: number, pageSize: number, search: string, status: string, date: string) =>
        SaleHandler.GetSales(page, pageSize, search, status, date),
    get: (id: string) => SaleHandler.GetSale(id),
    process: (s: Models.domain.Sale) => SaleHandler.ProcessSale(s),
    delete: (id: string) => SaleHandler.DeleteSale(id),
    return: (id: string) => SaleHandler.ReturnSale(id),
    park: (itemsJSON: string, customerName: string, customerID: string, note: string, total: number, itemsCount: number) =>
        SaleHandler.ParkSale(itemsJSON, customerName, customerID, note, total, itemsCount),
    getParked: () => SaleHandler.GetParkedSales(),
    getParkedCount: () => SaleHandler.GetParkedSalesCount(),
    retrieveParked: (id: number) => SaleHandler.RetrieveParkedSale(id),
    deleteParked: (id: number) => SaleHandler.DeleteParkedSale(id),
};

export const discounts = {
    list: () => DiscountHandler.GetAllDiscounts(),
    listActive: () => DiscountHandler.GetActiveDiscounts(),
    get: (id: string) => DiscountHandler.GetDiscount(id),
    save: (d: Discount) => DiscountHandler.CreateDiscount(d),
    update: (d: Discount) => DiscountHandler.UpdateDiscount(d),
    delete: (id: string) => DiscountHandler.DeleteDiscount(id),
    toggle: (id: string) => DiscountHandler.ToggleDiscountStatus(id),
    validateCoupon: (code: string) => DiscountHandler.ValidateCoupon(code),
    apply: (id: string) => DiscountHandler.ApplyDiscount(id),
};
