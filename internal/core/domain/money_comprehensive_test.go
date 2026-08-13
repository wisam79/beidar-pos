package domain

import (
	"encoding/json"
	"fmt"
	"math"
	"sync"
	"testing"
)

// ════════════════════════════════════════════════════════════════════════════════
// 📐 Test Suite: Comprehensive Amount & Financial Logic (25 tests)
// ════════════════════════════════════════════════════════════════════════════════

// ---------- 1. Chained arithmetic preserves precision ----------

func TestAmount_ChainedArithmetic(t *testing.T) {
	t.Run("Add-Sub-Mul-Div chain returns original", func(t *testing.T) {
		// 100.00 IQD → +50 → -30 → ×2 → ÷2 should equal 120.00
		start := NewAmount(100)       // 10000c
		result := start.Add(NewAmount(50)). // 15000c
							Sub(NewAmount(30)).  // 12000c
							Mul(2).              // 24000c
							Div(2)               // 12000c
		if result != NewAmount(120) {
			t.Errorf("chained ops = %s, want 120.00", result.String())
		}
	})

	t.Run("Percentage then Sub preserves cents", func(t *testing.T) {
		total := NewAmount(99.99) // 9999c
		tax := total.Percentage(15)
		afterTax := total.Add(tax)
		backToOriginal := afterTax.Sub(tax)
		if backToOriginal != total {
			t.Errorf("round-trip Percentage add/sub: got %s, want %s", backToOriginal.String(), total.String())
		}
	})
}

// ---------- 2. MulFloat precision boundary ----------

func TestAmount_MulFloat_FractionalPrecision(t *testing.T) {
	tests := []struct {
		name   string
		cents  int64
		factor float64
		want   int64
	}{
		{"1/3 fraction", 10000, 1.0 / 3.0, 3333},
		{"2/3 fraction", 10000, 2.0 / 3.0, 6667},
		{"tiny factor", 100, 0.001, 0},
		{"large factor", 1000, 999999.999, 999999999},
		{"identity", 12345, 1.0, 12345},
		{"zero factor", 99999, 0.0, 0},
	}
	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			got := FromCents(tc.cents).MulFloat(tc.factor).Cents()
			if got != tc.want {
				t.Errorf("MulFloat(%d, %f) = %d, want %d", tc.cents, tc.factor, got, tc.want)
			}
		})
	}
}

// ---------- 3. Fair installment splitting ----------

func TestAmount_InstallmentSplitting_NoLostCents(t *testing.T) {
	t.Run("3-month split of 100.00", func(t *testing.T) {
		total := NewAmount(100) // 10000c
		months := int64(3)
		perMonth := total.Div(months)

		sum := perMonth.Mul(months - 1)
		lastMonth := total.Sub(sum)
		reconstructed := sum.Add(lastMonth)

		if reconstructed != total {
			t.Errorf("installment reconstruction = %s, want %s", reconstructed.String(), total.String())
		}
	})

	t.Run("7-month split of 1000.00", func(t *testing.T) {
		total := NewAmount(1000)
		months := int64(7)
		perMonth := total.Div(months)

		sum := perMonth.Mul(months - 1)
		lastMonth := total.Sub(sum)
		reconstructed := sum.Add(lastMonth)

		if reconstructed != total {
			t.Errorf("7-month installment = %s, want %s", reconstructed.String(), total.String())
		}
	})

	t.Run("RoundToNearest 250 IQD denomination", func(t *testing.T) {
		amount := FromCents(129999) // 1299.99
		rounded := amount.RoundToNearest(25000)
		if rounded != FromCents(125000) {
			t.Errorf("RoundToNearest(25000) = %d, want 125000", rounded.Cents())
		}
	})
}

// ---------- 4. JSON marshal/unmarshal round-trip ----------

func TestAmount_JSONRoundTrip_AllFormats(t *testing.T) {
	tests := []struct {
		name     string
		input    string
		wantCent int64
	}{
		{"integer", `12`, 1200},
		{"decimal", `12.50`, 1250},
		{"zero", `0`, 0},
		{"negative", `-5.25`, -525},
		{"string quoted", `"99.99"`, 9999},
		{"large", `999999.99`, 99999999},
		{"tiny fraction", `0.01`, 1},
	}
	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			var a Amount
			if err := json.Unmarshal([]byte(tc.input), &a); err != nil {
				t.Fatalf("Unmarshal(%s) error: %v", tc.input, err)
			}
			if a.Cents() != tc.wantCent {
				t.Errorf("Unmarshal(%s) = %d cents, want %d", tc.input, a.Cents(), tc.wantCent)
			}

			marshaled, err := json.Marshal(a)
			if err != nil {
				t.Fatalf("Marshal error: %v", err)
			}

			var b Amount
			if err := json.Unmarshal(marshaled, &b); err != nil {
				t.Fatalf("re-Unmarshal error: %v", err)
			}
			if b != a {
				t.Errorf("round-trip: got %d, want %d", b.Cents(), a.Cents())
			}
		})
	}
}

// ---------- 5. JSON unmarshal rejects invalid input ----------

func TestAmount_JSONUnmarshal_InvalidInput(t *testing.T) {
	invalids := []string{`"abc"`, `"NaN"`, `"Inf"`, `"-Inf"`, `""`}
	for _, input := range invalids {
		t.Run(input, func(t *testing.T) {
			var a Amount
			err := json.Unmarshal([]byte(input), &a)
			if err == nil {
				t.Errorf("expected error for input %s, got nil", input)
			}
		})
	}
}

// ---------- 6. VAT calculation on multiple items ----------

func TestAmount_VATCalculation_MultiItem(t *testing.T) {
	// 3 items: 10.00, 20.50, 5.75 → subtotal = 36.25 → 15% VAT
	items := []Amount{NewAmount(10), NewAmount(20.50), NewAmount(5.75)}
	var subtotal Amount
	for _, item := range items {
		subtotal = subtotal.Add(item)
	}
	if subtotal != NewAmount(36.25) {
		t.Fatalf("subtotal = %s, want 36.25", subtotal.String())
	}

	vat := subtotal.Percentage(15)
	total := subtotal.Add(vat)

	// 36.25 * 0.15 = 5.4375 → rounded to 5.44
	if vat != FromCents(544) {
		t.Errorf("VAT = %d cents, want 544", vat.Cents())
	}
	if total != FromCents(4169) {
		t.Errorf("total = %d cents, want 4169", total.Cents())
	}
}

// ---------- 7. Discount exceeding subtotal clamped to subtotal ----------

func TestAmount_DiscountClamping(t *testing.T) {
	subtotal := NewAmount(50)
	discount := NewAmount(75)

	if discount > subtotal {
		discount = subtotal
	}
	result := subtotal.Sub(discount)
	if result != Zero() {
		t.Errorf("clamped discount result = %s, want 0.00", result.String())
	}
}

// ---------- 8. Concurrent Add safety ----------

func TestAmount_ConcurrentSummation(t *testing.T) {
	var mu sync.Mutex
	total := Zero()
	wg := sync.WaitGroup{}

	for i := 0; i < 1000; i++ {
		wg.Add(1)
		go func() {
			defer wg.Done()
			mu.Lock()
			total = total.Add(FromCents(100))
			mu.Unlock()
		}()
	}
	wg.Wait()

	if total != FromCents(100000) {
		t.Errorf("concurrent sum = %d, want 100000", total.Cents())
	}
}

// ---------- 9. ParseAmount edge cases ----------

func TestParseAmount_EdgeCases(t *testing.T) {
	tests := []struct {
		input   string
		want    int64
		wantErr bool
	}{
		{"0", 0, false},
		{"", 0, false},
		{"  12.50  ", 1250, false},
		{"-99.99", -9999, false},
		{"abc", 0, true},
		{"12.345", 1235, false}, // rounds to nearest cent
		{"0.005", 1, false},    // rounds up
	}
	for _, tc := range tests {
		t.Run(fmt.Sprintf("input=%q", tc.input), func(t *testing.T) {
			got, err := ParseAmount(tc.input)
			if tc.wantErr {
				if err == nil {
					t.Error("expected error, got nil")
				}
				return
			}
			if err != nil {
				t.Fatalf("unexpected error: %v", err)
			}
			if got.Cents() != tc.want {
				t.Errorf("ParseAmount(%q) = %d cents, want %d", tc.input, got.Cents(), tc.want)
			}
		})
	}
}

// ---------- 10. String formatting ----------

func TestAmount_StringFormat(t *testing.T) {
	tests := []struct {
		cents int64
		want  string
	}{
		{0, "0.00"},
		{1, "0.01"},
		{100, "1.00"},
		{1250, "12.50"},
		{-500, "-5.00"},
		{-1, "-0.01"},
		{10000000, "100000.00"},
	}
	for _, tc := range tests {
		t.Run(tc.want, func(t *testing.T) {
			got := FromCents(tc.cents).String()
			if got != tc.want {
				t.Errorf("FromCents(%d).String() = %q, want %q", tc.cents, got, tc.want)
			}
		})
	}
}

// ---------- 11. Div by zero safety ----------

func TestAmount_DivByZero_Safe(t *testing.T) {
	a := NewAmount(100)
	result := a.Div(0)
	if result != Zero() {
		t.Errorf("Div(0) = %s, want 0.00", result.String())
	}
}

// ---------- 12. Abs on positive, negative, zero ----------

func TestAmount_Abs_Comprehensive(t *testing.T) {
	if NewAmount(50).Abs() != NewAmount(50) {
		t.Error("Abs(positive) failed")
	}
	if NewAmount(-50).Abs() != NewAmount(50) {
		t.Error("Abs(negative) failed")
	}
	if Zero().Abs() != Zero() {
		t.Error("Abs(zero) failed")
	}
}

// ---------- 13. IsNegative / IsZero predicates ----------

func TestAmount_Predicates(t *testing.T) {
	if !Zero().IsZero() {
		t.Error("Zero().IsZero() should be true")
	}
	if NewAmount(1).IsZero() {
		t.Error("1.00.IsZero() should be false")
	}
	if !NewAmount(-1).IsNegative() {
		t.Error("-1.00.IsNegative() should be true")
	}
	if NewAmount(1).IsNegative() {
		t.Error("1.00.IsNegative() should be false")
	}
	if Zero().IsNegative() {
		t.Error("Zero().IsNegative() should be false")
	}
}

// ---------- 14. Product profit margin calculation ----------

func TestAmount_ProfitMarginCalculation(t *testing.T) {
	cost := NewAmount(75)
	price := NewAmount(100)
	profit := price.Sub(cost)
	// Margin = profit/price * 100 = 25%
	marginCents := profit.Mul(10000).Div(price.Cents())
	if marginCents != FromCents(2500) {
		t.Errorf("margin = %d, want 2500 (25.00%%)", marginCents.Cents())
	}
}

// ---------- 15. Inventory value = Σ(cost × stock) ----------

func TestAmount_InventoryValueAccumulation(t *testing.T) {
	type item struct {
		cost  Amount
		stock int64
	}
	items := []item{
		{NewAmount(10), 100},
		{NewAmount(25.50), 50},
		{NewAmount(3.75), 200},
	}
	var totalValue Amount
	for _, it := range items {
		totalValue = totalValue.Add(it.cost.Mul(it.stock))
	}
	// 10*100=1000 + 25.50*50=1275 + 3.75*200=750 = 3025.00
	if totalValue != NewAmount(3025) {
		t.Errorf("inventory value = %s, want 3025.00", totalValue.String())
	}
}

// ---------- 16. Shift variance = expected - actual ----------

func TestAmount_ShiftVarianceCalculation(t *testing.T) {
	opening := NewAmount(500)
	cashSales := NewAmount(1200)
	cashIn := NewAmount(100)
	cashOut := NewAmount(50)
	expected := opening.Add(cashSales).Add(cashIn).Sub(cashOut)
	actual := NewAmount(1740)
	variance := actual.Sub(expected)

	// expected = 500+1200+100-50 = 1750
	if expected != NewAmount(1750) {
		t.Errorf("expected balance = %s, want 1750.00", expected.String())
	}
	// variance = 1740 - 1750 = -10
	if variance != NewAmount(-10) {
		t.Errorf("variance = %s, want -10.00", variance.String())
	}
}

// ---------- 17. Split payment validation ----------

func TestAmount_SplitPaymentSumsToTotal(t *testing.T) {
	total := NewAmount(150)
	cash := NewAmount(80)
	credit := NewAmount(70)
	splitSum := cash.Add(credit)

	if splitSum != total {
		t.Errorf("split sum = %s, total = %s, should match", splitSum.String(), total.String())
	}
}

// ---------- 18. Customer debt ledger ----------

func TestAmount_CustomerDebtLedger(t *testing.T) {
	var debt Amount
	// sale 1: 500 on credit
	debt = debt.Add(NewAmount(500))
	// payment 1: 200 received
	debt = debt.Sub(NewAmount(200))
	// sale 2: 300 on credit
	debt = debt.Add(NewAmount(300))
	// payment 2: 600 received (overpay)
	debt = debt.Sub(NewAmount(600))

	if debt != Zero() {
		t.Errorf("customer debt = %s, want 0.00", debt.String())
	}
}

// ---------- 19. RoundToNearest with negative amounts ----------

func TestAmount_RoundToNearest_Negative(t *testing.T) {
	a := FromCents(-129999)
	rounded := a.RoundToNearest(25000)
	// Floor rounding for negative: -129999 → -150000
	if rounded != FromCents(-150000) {
		t.Errorf("RoundToNearest negative = %d, want -150000", rounded.Cents())
	}
}

// ---------- 20. Amount in struct JSON embedding ----------

func TestAmount_StructJSON(t *testing.T) {
	type Invoice struct {
		Subtotal Amount `json:"subtotal"`
		Tax      Amount `json:"tax"`
		Total    Amount `json:"total"`
	}
	inv := Invoice{
		Subtotal: NewAmount(100),
		Tax:      NewAmount(15),
		Total:    NewAmount(115),
	}
	data, err := json.Marshal(inv)
	if err != nil {
		t.Fatal(err)
	}

	var inv2 Invoice
	if err := json.Unmarshal(data, &inv2); err != nil {
		t.Fatal(err)
	}
	if inv2.Subtotal != inv.Subtotal || inv2.Tax != inv.Tax || inv2.Total != inv.Total {
		t.Errorf("struct round-trip mismatch: got %+v, want %+v", inv2, inv)
	}
}

// ---------- 21. NewAmount from float preserves with rounding ----------

func TestNewAmount_FloatRounding(t *testing.T) {
	// 0.1 + 0.2 in float64 = 0.30000000000000004
	sum := 0.1 + 0.2
	a := NewAmount(sum)
	if a.Cents() != 30 {
		t.Errorf("NewAmount(0.1+0.2) = %d cents, want 30", a.Cents())
	}
}

// ---------- 22. Percentage of zero ----------

func TestAmount_PercentageOfZero(t *testing.T) {
	result := Zero().Percentage(15)
	if result != Zero() {
		t.Errorf("Zero().Percentage(15) = %s, want 0.00", result.String())
	}
}

// ---------- 23. Large invoice with many items ----------

func TestAmount_LargeInvoice1000Items(t *testing.T) {
	var total Amount
	itemPrice := NewAmount(9.99) // 999c
	for i := 0; i < 1000; i++ {
		total = total.Add(itemPrice)
	}
	// 999 * 1000 = 999000c = 9990.00
	if total != FromCents(999000) {
		t.Errorf("1000-item total = %d, want 999000", total.Cents())
	}
}

// ---------- 24. Comparison operators ----------

func TestAmount_Comparisons(t *testing.T) {
	a := NewAmount(10)
	b := NewAmount(20)
	c := NewAmount(10)

	if !(a < b) {
		t.Error("10 < 20 should be true")
	}
	if !(b > a) {
		t.Error("20 > 10 should be true")
	}
	if a != c {
		t.Error("10 == 10 should be true")
	}
	if !(a <= c) {
		t.Error("10 <= 10 should be true")
	}
	if !(a >= c) {
		t.Error("10 >= 10 should be true")
	}
}

// ---------- 25. Float() inverse of NewAmount() ----------

func TestAmount_FloatInverse(t *testing.T) {
	tests := []float64{0, 1, 12.5, -99.99, 100000}
	for _, v := range tests {
		t.Run(fmt.Sprintf("%v", v), func(t *testing.T) {
			a := NewAmount(v)
			back := a.Float()
			diff := math.Abs(back - v)
			if diff > 0.005 {
				t.Errorf("Float() = %f, original = %f, diff = %f", back, v, diff)
			}
		})
	}
}
