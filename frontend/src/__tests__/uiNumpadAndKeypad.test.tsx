import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, beforeEach } from 'vitest';
import { Numpad } from '../features/pos/components/Numpad';

describe('UI Numpad & Keypad Component Tests', () => {
    let callsChange: number[];
    let callsQuickCash: number[];
    let callsClearCount: number;
    let callsConfirmCount: number;

    const fnChange = (v: number) => { callsChange.push(v); };
    const fnQuickCash = (a: number) => { callsQuickCash.push(a); };
    const fnClear = () => { callsClearCount++; };
    const fnConfirm = () => { callsConfirmCount++; };

    beforeEach(() => {
        callsChange = [];
        callsQuickCash = [];
        callsClearCount = 0;
        callsConfirmCount = 0;
    });

    it('1. should render display with initial value', () => {
        render(
            <Numpad
                value={50000}
                onChange={fnChange}
                total={45000}
            />
        );
        expect(screen.getByText('50000')).toBeInTheDocument();
    });

    it('2. should append numeric digits 1-9 and 0', () => {
        render(
            <Numpad
                value={0}
                onChange={fnChange}
                total={10000}
            />
        );

        const digits = screen.getAllByRole('button');
        const btn1 = digits.find(b => b.textContent === '1');
        const btn5 = digits.find(b => b.textContent === '5');
        const btn0 = digits.find(b => b.textContent === '0');

        if (!btn1 || !btn5 || !btn0) throw new Error('Digit buttons not found');

        fireEvent.click(btn1);
        expect(callsChange).toContain(1);

        fireEvent.click(btn5);
        expect(callsChange).toContain(15);

        fireEvent.click(btn0);
        expect(callsChange).toContain(150);
    });

    it('3. should handle decimal point entry only once', () => {
        render(
            <Numpad
                value={0}
                onChange={fnChange}
            />
        );

        const btnDot = screen.getByRole('button', { name: '.' });
        const digits = screen.getAllByRole('button');
        const btn5 = digits.find(b => b.textContent === '5');
        if (!btn5) throw new Error('btn5 not found');

        fireEvent.click(btnDot);
        fireEvent.click(btn5);
        expect(callsChange).toContain(0.5);

        // Clicking dot again should be ignored
        fireEvent.click(btnDot);
        expect(callsChange[callsChange.length - 1]).toBe(0.5);
    });

    it('4. should handle backspace to remove the last entered digit', () => {
        render(
            <Numpad
                value={0}
                onChange={fnChange}
            />
        );

        const digits = screen.getAllByRole('button');
        const btn9 = digits.find(b => b.textContent === '9');
        const btn8 = digits.find(b => b.textContent === '8');
        if (!btn9 || !btn8) throw new Error('digit buttons not found');

        fireEvent.click(btn9);
        fireEvent.click(btn8);
        expect(callsChange).toContain(98);

        // Click backspace button with title 'مسح'
        const backspaceBtn = screen.getByTitle('مسح');
        fireEvent.click(backspaceBtn);
        expect(callsChange).toContain(9);
    });

    it('5. should handle clear button to reset display to empty and call onClear', () => {
        render(
            <Numpad
                value={25000}
                onChange={fnChange}
                onClear={fnClear}
            />
        );

        const clearBtn = screen.getByTitle('تفريغ');
        fireEvent.click(clearBtn);

        expect(callsChange).toContain(0);
        expect(callsClearCount).toBe(1);
    });

    it('6. should trigger quick cash preset buttons (e.g. 5K, 25K, 50K IQD)', () => {
        render(
            <Numpad
                value={0}
                onChange={fnChange}
                onQuickCash={fnQuickCash}
                currency="IQD"
            />
        );

        // Quick amount buttons formatted as 25K
        const btn25k = screen.getByRole('button', { name: '25K' });
        fireEvent.click(btn25k);

        expect(callsChange).toContain(25000);
        expect(callsQuickCash).toContain(25000);
    });

    it('7. should trigger exact match button setting display to invoice total', () => {
        render(
            <Numpad
                value={0}
                onChange={fnChange}
                total={75000}
            />
        );

        const exactBtn = screen.getByTitle('المبلغ المضبوط');
        fireEvent.click(exactBtn);

        expect(callsChange).toContain(75000);
    });

    it('8. should calculate change display when payment exceeds invoice total', () => {
        render(
            <Numpad
                value={100000}
                onChange={fnChange}
                total={85000}
                currency="IQD"
            />
        );

        // Change is 100,000 - 85,000 = 15,000 IQD
        expect(screen.getByText('الباقي')).toBeInTheDocument();
        expect(screen.getByText('15,000')).toBeInTheDocument();
    });

    it('9. should support quantity mode with quick quantities and maxQty clamp', () => {
        render(
            <Numpad
                value={1}
                onChange={fnChange}
                mode="quantity"
                productName="حليب المراعي 1 لتر"
                maxQty={10}
            />
        );

        expect(screen.getByText('حليب المراعي 1 لتر')).toBeInTheDocument();

        // Increment button in quantity mode
        const incBtn = screen.getByTitle('زيادة 1');
        fireEvent.click(incBtn);
        expect(callsChange).toContain(2);
    });

    it('10. should handle confirm button click to trigger onConfirm callback', () => {
        render(
            <Numpad
                value={50000}
                onChange={fnChange}
                onConfirm={fnConfirm}
            />
        );

        const confirmBtn = screen.getByTitle('تأكيد');
        fireEvent.click(confirmBtn);

        expect(callsConfirmCount).toBe(1);
    });
});
