import * as FinanceHandler from '../../../wailsjs/go/handlers/FinanceHandler';
import * as PaymentHandler from '../../../wailsjs/go/handlers/PaymentHandler';
import * as Models from '../../../wailsjs/go/models';
import { Expense, Payment, PurchaseOrder, ReceiveOrderItem } from './types';

export const expenses = {
    list: (month: string = '') => FinanceHandler.GetExpenses(month),
    save: (e: Expense) => FinanceHandler.SaveExpense(e),
    delete: (id: string) => FinanceHandler.DeleteExpense(id),
};

export const payments = {
    create: (payment: Payment) => PaymentHandler.CreatePayment(payment as Models.domain.Payment),
    getBySale: (saleId: string) => PaymentHandler.GetPaymentsBySale(saleId),
    getByCustomer: (customerId: string) => PaymentHandler.GetPaymentsByCustomer(customerId),
    delete: (id: number) => PaymentHandler.DeletePayment(id),
    payInstallment: (saleId: string, installmentIndex: number, amount: number, method: string) =>
        PaymentHandler.PayInstallment(saleId, installmentIndex, amount, method),
    getCustomerInstallments: (customerId: string) => PaymentHandler.GetCustomerInstallments(customerId),
    getInstallmentSummary: (saleId: string) => PaymentHandler.GetInstallmentSummary(saleId),
};

export const shift = {
    open: (staffId: string, staffName: string, openingBalance: number) =>
        FinanceHandler.OpenShift(staffId, staffName, openingBalance),
    close: (shiftId: string, closingBalance: number, note: string) =>
        FinanceHandler.CloseShift(shiftId, closingBalance, note),
    getActive: () => FinanceHandler.GetActiveShift(),
    addMovement: (shiftId: string, type: string, reason: string, staffId: string, staffName: string, amount: number) =>
        FinanceHandler.AddCashMovement(shiftId, type, reason, staffId, staffName, amount),
    getMovements: (shiftId: string) => FinanceHandler.GetShiftMovements(shiftId),
    getHistory: (limit: number) => FinanceHandler.GetShiftHistory(limit),
};

export const purchaseOrders = {
    create: (order: PurchaseOrder) => FinanceHandler.CreatePurchaseOrder(order as Models.domain.PurchaseOrder),
    list: (status?: string, supplierId?: string) =>
        FinanceHandler.GetPurchaseOrders(status || '', supplierId || ''),
    get: (id: string) => FinanceHandler.GetPurchaseOrder(id),
    update: (order: PurchaseOrder) => FinanceHandler.UpdatePurchaseOrder(order as Models.domain.PurchaseOrder),
    delete: (id: string) => FinanceHandler.DeletePurchaseOrder(id),
    cancel: (id: string) => FinanceHandler.CancelPurchaseOrder(id),
    receive: (orderId: string, items: ReceiveOrderItem[]) =>
        FinanceHandler.ReceivePurchaseOrder(orderId, items as Models.domain.PurchaseOrderItem[]),
    pay: (orderId: string, amount: number, method: string) =>
        FinanceHandler.PayPurchaseOrder(orderId, amount, method),
    getStats: () => FinanceHandler.GetPurchaseOrderStats(),
};
