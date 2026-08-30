import { describe, it, expect, beforeEach, vi } from 'vitest';

interface OfflineQueueItem {
    id: string;
    idempotencyKey: string;
    endpoint: string;
    payload: Record<string, unknown>;
    timestamp: number;
    retryCount: number;
}

class OfflineQueueManager {
    private storageKey = 'beidar_offline_sync_queue';
    private maxRetries = 3;

    getItems(): OfflineQueueItem[] {
        const raw = localStorage.getItem(this.storageKey);
        if (!raw) return [];
        try {
            return JSON.parse(raw);
        } catch {
            return [];
        }
    }

    enqueue(endpoint: string, payload: Record<string, unknown>): OfflineQueueItem {
        const items = this.getItems();
        const item: OfflineQueueItem = {
            id: `offline_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
            idempotencyKey: `idemp_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
            endpoint,
            payload,
            timestamp: Date.now(),
            retryCount: 0,
        };
        items.push(item);
        localStorage.setItem(this.storageKey, JSON.stringify(items));
        return item;
    }

    async drain(sender: (item: OfflineQueueItem) => Promise<boolean>): Promise<{ success: number; failed: number }> {
        const items = this.getItems();
        const remaining: OfflineQueueItem[] = [];
        let success = 0;
        let failed = 0;

        for (const item of items) {
            try {
                const ok = await sender(item);
                if (ok) {
                    success++;
                } else {
                    item.retryCount++;
                    if (item.retryCount < this.maxRetries) {
                        remaining.push(item);
                    }
                    failed++;
                }
            } catch {
                item.retryCount++;
                if (item.retryCount < this.maxRetries) {
                    remaining.push(item);
                }
                failed++;
            }
        }

        localStorage.setItem(this.storageKey, JSON.stringify(remaining));
        return { success, failed };
    }

    clear(): void {
        localStorage.removeItem(this.storageKey);
    }
}

describe('Offline Queue & Synchronization Engine', () => {
    let queueManager: OfflineQueueManager;

    beforeEach(() => {
        localStorage.clear();
        queueManager = new OfflineQueueManager();
    });

    it('should enqueue offline sales with unique idempotency keys', () => {
        const sale1 = queueManager.enqueue('/api/sales', { total: 50000, customerId: 'cust-1' });
        const sale2 = queueManager.enqueue('/api/sales', { total: 30000, customerId: 'cust-2' });

        expect(sale1.idempotencyKey).toBeDefined();
        expect(sale2.idempotencyKey).toBeDefined();
        expect(sale1.idempotencyKey).not.toBe(sale2.idempotencyKey);

        const items = queueManager.getItems();
        expect(items.length).toBe(2);
        expect(items[0].payload.total).toBe(50000);
        expect(items[1].payload.total).toBe(30000);
    });

    it('should successfully drain queue when connection returns', async () => {
        queueManager.enqueue('/api/sales', { saleId: 's1', total: 40000 });
        queueManager.enqueue('/api/sales', { saleId: 's2', total: 60000 });

        const mockSender = vi.fn().mockResolvedValue(true);
        const result = await queueManager.drain(mockSender);

        expect(result.success).toBe(2);
        expect(result.failed).toBe(0);
        expect(mockSender).toHaveBeenCalledTimes(2);
        expect(queueManager.getItems().length).toBe(0);
    });

    it('should retry failed items up to maxRetries before discarding', async () => {
        queueManager.enqueue('/api/sales', { saleId: 's-fail', total: 10000 });

        const mockFailingSender = vi.fn().mockResolvedValue(false);

        // Attempt 1: retryCount 0 -> 1 (kept in queue)
        let res = await queueManager.drain(mockFailingSender);
        expect(res.failed).toBe(1);
        expect(queueManager.getItems().length).toBe(1);
        expect(queueManager.getItems()[0].retryCount).toBe(1);

        // Attempt 2: retryCount 1 -> 2 (kept in queue)
        res = await queueManager.drain(mockFailingSender);
        expect(queueManager.getItems().length).toBe(1);
        expect(queueManager.getItems()[0].retryCount).toBe(2);

        // Attempt 3: retryCount 2 -> 3 (exceeds maxRetries 3 -> discarded)
        res = await queueManager.drain(mockFailingSender);
        expect(queueManager.getItems().length).toBe(0);
    });
});
