import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock FinanceHandler and PaymentHandler
vi.mock('../../../../wailsjs/go/handlers/FinanceHandler', () => ({
    GetExpenses: vi.fn(),
    SaveExpense: vi.fn(),
    DeleteExpense: vi.fn(),
    OpenShift: vi.fn(),
    CloseShift: vi.fn(),
    GetActiveShift: vi.fn(),
    AddCashMovement: vi.fn(),
    GetShiftMovements: vi.fn(),
    GetShiftHistory: vi.fn(),
    CreatePurchaseOrder: vi.fn(),
    GetPurchaseOrders: vi.fn(),
    GetPurchaseOrder: vi.fn(),
    UpdatePurchaseOrder: vi.fn(),
    DeletePurchaseOrder: vi.fn(),
    CancelPurchaseOrder: vi.fn(),
    ReceivePurchaseOrder: vi.fn(),
    PayPurchaseOrder: vi.fn(),
    GetPurchaseOrderStats: vi.fn(),
}));

vi.mock('../../../../wailsjs/go/handlers/PaymentHandler', () => ({
    CreatePayment: vi.fn(),
    GetPaymentsBySale: vi.fn(),
    GetPaymentsByCustomer: vi.fn(),
    DeletePayment: vi.fn(),
    PayInstallment: vi.fn(),
    GetCustomerInstallments: vi.fn(),
    GetInstallmentSummary: vi.fn(),
}));

import { expenses, payments, shift, purchaseOrders } from '../finance';
import * as FinanceHandler from '../../../../wailsjs/go/handlers/FinanceHandler';
import * as PaymentHandler from '../../../../wailsjs/go/handlers/PaymentHandler';

describe('Finance API Wrapper', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe('expenses api', () => {
        it('should list expenses', async () => {
            vi.mocked(FinanceHandler.GetExpenses).mockResolvedValue([] as any);
            await expenses.list();
            expect(FinanceHandler.GetExpenses).toHaveBeenCalled();
        });

        it('should save expense', async () => {
            vi.mocked(FinanceHandler.SaveExpense).mockResolvedValue(undefined as any);
            const data = { title: 'Rent' } as any;
            await expenses.save(data);
            expect(FinanceHandler.SaveExpense).toHaveBeenCalledWith(data);
        });

        it('should delete expense', async () => {
            vi.mocked(FinanceHandler.DeleteExpense).mockResolvedValue(undefined as any);
            await expenses.delete('exp1');
            expect(FinanceHandler.DeleteExpense).toHaveBeenCalledWith('exp1');
        });
    });

    describe('payments api', () => {
        it('should create payment', async () => {
            vi.mocked(PaymentHandler.CreatePayment).mockResolvedValue({ id: 1 } as any);
            const data = { amount: 100 } as any;
            await payments.create(data);
            expect(PaymentHandler.CreatePayment).toHaveBeenCalledWith(data);
        });

        it('should get by sale', async () => {
            vi.mocked(PaymentHandler.GetPaymentsBySale).mockResolvedValue([] as any);
            await payments.getBySale('s1');
            expect(PaymentHandler.GetPaymentsBySale).toHaveBeenCalledWith('s1');
        });

        it('should get by customer', async () => {
            vi.mocked(PaymentHandler.GetPaymentsByCustomer).mockResolvedValue([] as any);
            await payments.getByCustomer('c1');
            expect(PaymentHandler.GetPaymentsByCustomer).toHaveBeenCalledWith('c1');
        });

        it('should delete payment', async () => {
            vi.mocked(PaymentHandler.DeletePayment).mockResolvedValue(undefined as any);
            await payments.delete(1);
            expect(PaymentHandler.DeletePayment).toHaveBeenCalledWith(1);
        });

        it('should pay installment', async () => {
            vi.mocked(PaymentHandler.PayInstallment).mockResolvedValue(undefined as any);
            await payments.payInstallment('s1', 0, 500, 'cash');
            expect(PaymentHandler.PayInstallment).toHaveBeenCalledWith('s1', 0, 500, 'cash');
        });

        it('should get customer installments', async () => {
            vi.mocked(PaymentHandler.GetCustomerInstallments).mockResolvedValue([] as any);
            await payments.getCustomerInstallments('c1');
            expect(PaymentHandler.GetCustomerInstallments).toHaveBeenCalledWith('c1');
        });

        it('should get installment summary', async () => {
            vi.mocked(PaymentHandler.GetInstallmentSummary).mockResolvedValue({ total: 10 } as any);
            const res = await payments.getInstallmentSummary('s1');
            expect(PaymentHandler.GetInstallmentSummary).toHaveBeenCalledWith('s1');
            expect(res.total).toBe(10);
        });
    });

    describe('shift api', () => {
        it('should open shift', async () => {
            vi.mocked(FinanceHandler.OpenShift).mockResolvedValue({ id: 'shift1' } as any);
            await shift.open('staff1', 'Name', 50000);
            expect(FinanceHandler.OpenShift).toHaveBeenCalledWith('staff1', 'Name', 50000);
        });

        it('should close shift', async () => {
            vi.mocked(FinanceHandler.CloseShift).mockResolvedValue({ id: 'shift1' } as any);
            await shift.close('shift1', 60000, 'Done');
            expect(FinanceHandler.CloseShift).toHaveBeenCalledWith('shift1', 60000, 'Done');
        });

        it('should get active shift', async () => {
            vi.mocked(FinanceHandler.GetActiveShift).mockResolvedValue({ id: 'shift1' } as any);
            await shift.getActive();
            expect(FinanceHandler.GetActiveShift).toHaveBeenCalled();
        });

        it('should add movement', async () => {
            vi.mocked(FinanceHandler.AddCashMovement).mockResolvedValue({ id: 'm1' } as any);
            await shift.addMovement('shift1', 'cash_in', 'reason', 'staff1', 'name', 1000);
            expect(FinanceHandler.AddCashMovement).toHaveBeenCalledWith('shift1', 'cash_in', 'reason', 'staff1', 'name', 1000);
        });

        it('should get movements', async () => {
            vi.mocked(FinanceHandler.GetShiftMovements).mockResolvedValue([] as any);
            await shift.getMovements('shift1');
            expect(FinanceHandler.GetShiftMovements).toHaveBeenCalledWith('shift1');
        });

        it('should get shift history', async () => {
            vi.mocked(FinanceHandler.GetShiftHistory).mockResolvedValue([] as any);
            await shift.getHistory(10);
            expect(FinanceHandler.GetShiftHistory).toHaveBeenCalledWith(10);
        });
    });

    describe('purchase orders api', () => {
        it('should create PO', async () => {
            vi.mocked(FinanceHandler.CreatePurchaseOrder).mockResolvedValue({ id: 'po1' } as any);
            const data = { supplierId: 's1' } as any;
            await purchaseOrders.create(data);
            expect(FinanceHandler.CreatePurchaseOrder).toHaveBeenCalledWith(data);
        });

        it('should list POs', async () => {
            vi.mocked(FinanceHandler.GetPurchaseOrders).mockResolvedValue([] as any);
            await purchaseOrders.list('pending', 's1');
            expect(FinanceHandler.GetPurchaseOrders).toHaveBeenCalledWith('pending', 's1');
        });

        it('should get PO', async () => {
            vi.mocked(FinanceHandler.GetPurchaseOrder).mockResolvedValue({ id: 'po1' } as any);
            await purchaseOrders.get('po1');
            expect(FinanceHandler.GetPurchaseOrder).toHaveBeenCalledWith('po1');
        });

        it('should update PO', async () => {
            vi.mocked(FinanceHandler.UpdatePurchaseOrder).mockResolvedValue(undefined as any);
            const data = { id: 'po1' } as any;
            await purchaseOrders.update(data);
            expect(FinanceHandler.UpdatePurchaseOrder).toHaveBeenCalledWith(data);
        });

        it('should delete PO', async () => {
            vi.mocked(FinanceHandler.DeletePurchaseOrder).mockResolvedValue(undefined as any);
            await purchaseOrders.delete('po1');
            expect(FinanceHandler.DeletePurchaseOrder).toHaveBeenCalledWith('po1');
        });

        it('should cancel PO', async () => {
            vi.mocked(FinanceHandler.CancelPurchaseOrder).mockResolvedValue(undefined as any);
            await purchaseOrders.cancel('po1');
            expect(FinanceHandler.CancelPurchaseOrder).toHaveBeenCalledWith('po1');
        });

        it('should receive PO', async () => {
            vi.mocked(FinanceHandler.ReceivePurchaseOrder).mockResolvedValue(undefined as any);
            const items = [{ productId: 'p1', quantity: 5 }] as any;
            await purchaseOrders.receive('po1', items);
            expect(FinanceHandler.ReceivePurchaseOrder).toHaveBeenCalledWith('po1', items);
        });

        it('should pay PO', async () => {
            vi.mocked(FinanceHandler.PayPurchaseOrder).mockResolvedValue(undefined as any);
            await purchaseOrders.pay('po1', 5000, 'cash');
            expect(FinanceHandler.PayPurchaseOrder).toHaveBeenCalledWith('po1', 5000, 'cash');
        });

        it('should get stats', async () => {
            vi.mocked(FinanceHandler.GetPurchaseOrderStats).mockResolvedValue({ totalOrders: 1 } as any);
            const res = await purchaseOrders.getStats();
            expect(FinanceHandler.GetPurchaseOrderStats).toHaveBeenCalled();
            expect(res.totalOrders).toBe(1);
        });
    });
});
