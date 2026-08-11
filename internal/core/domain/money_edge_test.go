package domain

import (
	"encoding/json"
	"math"
	"sync"
	"testing"
)

// TestAmount_OverflowProtection tests operations approaching math.MaxInt64 and math.MinInt64
// to verify arithmetic behavior, boundary checks, and stability.
func TestAmount_OverflowProtection(t *testing.T) {
	t.Run("Large amount additions and subtractions near MaxInt64", func(t *testing.T) {
		maxAmt := FromCents(math.MaxInt64)
		if maxAmt.Cents() != math.MaxInt64 {
			t.Fatalf("expected maxAmt.Cents() == math.MaxInt64, got %d", maxAmt.Cents())
		}

		// Zero addition / subtraction preserves boundary
		if got := maxAmt.Add(Zero()); got.Cents() != math.MaxInt64 {
			t.Errorf("maxAmt.Add(0) = %d, want %d", got.Cents(), int64(math.MaxInt64))
		}
		if got := maxAmt.Sub(Zero()); got.Cents() != math.MaxInt64 {
			t.Errorf("maxAmt.Sub(0) = %d, want %d", got.Cents(), int64(math.MaxInt64))
		}

		// Near max boundaries
		nearMax := FromCents(math.MaxInt64 - 500)
		added := nearMax.Add(FromCents(200))
		if added.Cents() != math.MaxInt64-300 {
			t.Errorf("nearMax.Add(200) = %d, want %d", added.Cents(), int64(math.MaxInt64-300))
		}

		subbed := added.Sub(FromCents(200))
		if subbed.Cents() != nearMax.Cents() {
			t.Errorf("roundtrip add/sub = %d, want %d", subbed.Cents(), nearMax.Cents())
		}
	})

	t.Run("Large amount boundaries near MinInt64", func(t *testing.T) {
		minAmt := FromCents(math.MinInt64)
		if minAmt.Cents() != math.MinInt64 {
			t.Fatalf("expected minAmt.Cents() == math.MinInt64, got %d", minAmt.Cents())
		}

		if got := minAmt.Add(Zero()); got.Cents() != math.MinInt64 {
			t.Errorf("minAmt.Add(0) = %d, want %d", got.Cents(), int64(math.MinInt64))
		}

		nearMin := FromCents(math.MinInt64 + 500)
		subbed := nearMin.Sub(FromCents(200))
		if subbed.Cents() != math.MinInt64+300 {
			t.Errorf("nearMin.Sub(200) = %d, want %d", subbed.Cents(), int64(math.MinInt64+300))
		}

		added := subbed.Add(FromCents(200))
		if added.Cents() != nearMin.Cents() {
			t.Errorf("roundtrip sub/add = %d, want %d", added.Cents(), nearMin.Cents())
		}
	})

	t.Run("Multiplication by 1 and -1 at boundary", func(t *testing.T) {
		amt := FromCents(100_000_000_000_000) // 10^14 cents = 1 trillion currency units
		if got := amt.Mul(1); got.Cents() != amt.Cents() {
			t.Errorf("amt.Mul(1) = %d, want %d", got.Cents(), amt.Cents())
		}
		if got := amt.Mul(-1); got.Cents() != -amt.Cents() {
			t.Errorf("amt.Mul(-1) = %d, want %d", got.Cents(), -amt.Cents())
		}
	})
}

// TestAmount_NegativeArithmetic tests subtraction creating negative amounts and verifies
// Abs(), IsNegative(), IsZero(), and all arithmetic combinations on negative numbers.
func TestAmount_NegativeArithmetic(t *testing.T) {
	t.Run("Subtraction resulting in negative", func(t *testing.T) {
		a := FromCents(1000)
		b := FromCents(2500)
		diff := a.Sub(b)

		if diff.Cents() != -1500 {
			t.Errorf("10.00 - 25.00: got %d cents, want -1500", diff.Cents())
		}
		if !diff.IsNegative() {
			t.Errorf("expected -15.00 to be negative")
		}
		if diff.IsZero() {
			t.Errorf("expected -15.00 to not be zero")
		}
		if diff.Abs() != FromCents(1500) {
			t.Errorf("Abs(-15.00) = %s, want 15.00", diff.Abs())
		}
		if diff.String() != "-15.00" {
			t.Errorf("String(-15.00) = %s, want '-15.00'", diff.String())
		}
	})

	t.Run("Negative plus negative", func(t *testing.T) {
		n1 := FromCents(-1000)
		n2 := FromCents(-2500)
		sum := n1.Add(n2)
		if sum.Cents() != -3500 {
			t.Errorf("-10.00 + -25.00 = %d, want -3500", sum.Cents())
		}
		if !sum.IsNegative() {
			t.Errorf("expected sum to be negative")
		}
	})

	t.Run("Negative minus negative", func(t *testing.T) {
		n1 := FromCents(-1000)
		n2 := FromCents(-3000)
		res := n1.Sub(n2) // -1000 - (-3000) = 2000
		if res.Cents() != 2000 {
			t.Errorf("-10.00 - (-30.00) = %d, want 2000", res.Cents())
		}
		if res.IsNegative() {
			t.Errorf("expected 20.00 to be positive")
		}
	})

	t.Run("Negative multiplications and divisions", func(t *testing.T) {
		n := FromCents(-500)
		if got := n.Mul(3); got.Cents() != -1500 {
			t.Errorf("-5.00 * 3 = %d, want -1500", got.Cents())
		}
		if got := n.Mul(-2); got.Cents() != 1000 {
			t.Errorf("-5.00 * -2 = %d, want 1000", got.Cents())
		}
		if got := n.Div(2); got.Cents() != -250 {
			t.Errorf("-5.00 / 2 = %d, want -250", got.Cents())
		}
		if got := n.Div(-2); got.Cents() != 250 {
			t.Errorf("-5.00 / -2 = %d, want 250", got.Cents())
		}
	})

	t.Run("Zero boundary properties", func(t *testing.T) {
		z := Zero()
		if !z.IsZero() {
			t.Errorf("Zero().IsZero() should be true")
		}
		if z.IsNegative() {
			t.Errorf("Zero().IsNegative() should be false")
		}
		if z.Abs() != Zero() {
			t.Errorf("Zero().Abs() should be Zero()")
		}
		if z.String() != "0.00" {
			t.Errorf("Zero().String() = %s, want '0.00'", z.String())
		}
	})
}

// TestNewAmount_FloatingPointEdgeCases verifies NewAmount against notorious IEEE-754
// floating point representations (such as 0.1+0.2, 19.99, 0.015, half-cent roundings).
func TestNewAmount_FloatingPointEdgeCases(t *testing.T) {
	tests := []struct {
		name     string
		input    float64
		expected int64
	}{
		{"0.1 + 0.2 drift", 0.1 + 0.2, 30},
		{"19.99 precision", 19.99, 1999},
		{"0.015 half cent round up", 0.015, 2},
		{"0.014 round down", 0.014, 1},
		{"-0.015 negative half cent round away from zero", -0.015, -2},
		{"-0.014 negative round toward zero", -0.014, -1},
		{"0.005 half cent round up", 0.005, 1},
		{"-0.005 negative half cent round", -0.005, -1},
		{"Tiny fraction 0.00001", 0.00001, 0},
		{"9999999.99 high value", 9999999.99, 999999999},
		{"123456789.99 large financial number", 123456789.99, 12345678999},
		{"0.07 + 0.01 classic float drift", 0.07 + 0.01, 8},
		{"0.29 * 100 drift", 0.29, 29},
		{"0.57 * 100 drift", 0.57, 57},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got := NewAmount(tt.input)
			if got.Cents() != tt.expected {
				t.Errorf("NewAmount(%v) = %d cents, want %d cents", tt.input, got.Cents(), tt.expected)
			}
		})
	}
}

// TestAmount_Percentage_BoundaryValues tests percentage calculations at 0%, 100%, 200%,
// 0.01%, fractional percentages, negative percentages, and negative amounts.
func TestAmount_Percentage_BoundaryValues(t *testing.T) {
	tests := []struct {
		name       string
		amount     Amount
		percentage float64
		expected   Amount
	}{
		{"0% of 100.00", FromCents(10000), 0.0, Zero()},
		{"100% of 100.00", FromCents(10000), 100.0, FromCents(10000)},
		{"200% of 100.00", FromCents(10000), 200.0, FromCents(20000)},
		{"0.01% of 10,000.00 (1M cents)", FromCents(1000000), 0.01, FromCents(100)},
		{"15% of 33.33 (3333 * 0.15 = 499.95 -> 500)", FromCents(3333), 15.0, FromCents(500)},
		{"33.333333% of 1.00 (100 * 0.33333333 = 33.33 -> 33)", FromCents(100), 33.333333, FromCents(33)},
		{"15% of negative -100.00", FromCents(-10000), 15.0, FromCents(-1500)},
		{"-10% of 100.00", FromCents(10000), -10.0, FromCents(-1000)},
		{"50% of Zero", Zero(), 50.0, Zero()},
		{"0.001% of 100.00 (10000 * 0.00001 = 0.1 -> 0)", FromCents(10000), 0.001, Zero()},
		{"0.005% of 100.00 (10000 * 0.00005 = 0.5 -> 1)", FromCents(10000), 0.005, FromCents(1)},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got := tt.amount.Percentage(tt.percentage)
			if got != tt.expected {
				t.Errorf("(%s).Percentage(%v) = %s (%d cents), want %s (%d cents)",
					tt.amount, tt.percentage, got, got.Cents(), tt.expected, tt.expected.Cents())
			}
		})
	}
}

// TestAmount_MulFloat_PrecisionStress tests MulFloat with large amounts, small multipliers,
// fractional multipliers, and round-tripping to verify precision retention.
func TestAmount_MulFloat_PrecisionStress(t *testing.T) {
	t.Run("Large amount with small multiplier", func(t *testing.T) {
		large := FromCents(100_000_000) // 1,000,000.00
		res := large.MulFloat(0.00001)  // 100000000 * 0.00001 = 1000 cents
		if res.Cents() != 1000 {
			t.Errorf("large.MulFloat(0.00001) = %d, want 1000", res.Cents())
		}
	})

	t.Run("Multiplication identities", func(t *testing.T) {
		amt := FromCents(123456)
		if got := amt.MulFloat(1.0); got != amt {
			t.Errorf("MulFloat(1.0) = %s, want %s", got, amt)
		}
		if got := amt.MulFloat(0.0); !got.IsZero() {
			t.Errorf("MulFloat(0.0) = %s, want 0.00", got)
		}
		if got := amt.MulFloat(-1.0); got.Cents() != -amt.Cents() {
			t.Errorf("MulFloat(-1.0) = %d, want %d", got.Cents(), -amt.Cents())
		}
	})

	t.Run("Division equivalence via float", func(t *testing.T) {
		amt := FromCents(30000) // 300.00
		res := amt.MulFloat(1.0 / 3.0)
		if res.Cents() != 10000 {
			t.Errorf("300.00 * (1/3) = %d cents, want 10000", res.Cents())
		}
	})

	t.Run("Round-tripping complementary factors", func(t *testing.T) {
		// 12345.67 * 2.5 = 30864.175 -> 3086418 cents
		// 30864.18 * 0.4 = 12345.672 -> 1234567 cents
		original := FromCents(1234567)
		scaled := original.MulFloat(2.5)
		if scaled.Cents() != 3086418 {
			t.Errorf("scaled = %d, want 3086418", scaled.Cents())
		}
		restored := scaled.MulFloat(0.4)
		if restored != original {
			t.Errorf("restored = %s, want original %s", restored, original)
		}
	})

	t.Run("Negative amount with negative multiplier", func(t *testing.T) {
		amt := FromCents(-5000)
		res := amt.MulFloat(-1.5) // -5000 * -1.5 = 7500
		if res.Cents() != 7500 {
			t.Errorf("-50.00 * -1.5 = %d cents, want 7500", res.Cents())
		}
	})
}

// TestAmount_RoundToNearest_AllDenominations verifies RoundToNearest across Iraqi Dinar (IQD)
// and standard currency denominations (250, 500, 1000, 5000, 25000 cents/fils) at boundaries.
func TestAmount_RoundToNearest_AllDenominations(t *testing.T) {
	tests := []struct {
		name     string
		amount   Amount
		unit     Amount
		expected Amount
	}{
		// Unit = 250
		{"250 unit: exact 0", FromCents(0), FromCents(250), FromCents(0)},
		{"250 unit: 100 -> 0", FromCents(100), FromCents(250), FromCents(0)},
		{"250 unit: 249 -> 0", FromCents(249), FromCents(250), FromCents(0)},
		{"250 unit: 250 -> 250", FromCents(250), FromCents(250), FromCents(250)},
		{"250 unit: 251 -> 250", FromCents(251), FromCents(250), FromCents(250)},
		{"250 unit: 499 -> 250", FromCents(499), FromCents(250), FromCents(250)},
		{"250 unit: 500 -> 500", FromCents(500), FromCents(250), FromCents(500)},

		// Unit = 500
		{"500 unit: 499 -> 0", FromCents(499), FromCents(500), FromCents(0)},
		{"500 unit: 500 -> 500", FromCents(500), FromCents(500), FromCents(500)},
		{"500 unit: 750 -> 500", FromCents(750), FromCents(500), FromCents(500)},
		{"500 unit: 999 -> 500", FromCents(999), FromCents(500), FromCents(500)},
		{"500 unit: 1000 -> 1000", FromCents(1000), FromCents(500), FromCents(1000)},

		// Unit = 1000
		{"1000 unit: 999 -> 0", FromCents(999), FromCents(1000), FromCents(0)},
		{"1000 unit: 1000 -> 1000", FromCents(1000), FromCents(1000), FromCents(1000)},
		{"1000 unit: 1999 -> 1000", FromCents(1999), FromCents(1000), FromCents(1000)},

		// Unit = 5000
		{"500 unit: 4999 -> 0", FromCents(4999), FromCents(5000), FromCents(0)},
		{"5000 unit: 5000 -> 5000", FromCents(5000), FromCents(5000), FromCents(5000)},
		{"5000 unit: 9999 -> 5000", FromCents(9999), FromCents(5000), FromCents(5000)},

		// Unit = 25000 (250 IQD in fils)
		{"25000 unit: 24999 -> 0", FromCents(24999), FromCents(25000), FromCents(0)},
		{"25000 unit: 25000 -> 25000", FromCents(25000), FromCents(25000), FromCents(25000)},
		{"25000 unit: 129999 -> 125000", FromCents(129999), FromCents(25000), FromCents(125000)},

		// Negative amounts floor rounding
		{"250 unit: -249 -> -250", FromCents(-249), FromCents(250), FromCents(-250)},
		{"250 unit: -250 -> -250", FromCents(-250), FromCents(250), FromCents(-250)},
		{"250 unit: -251 -> -500", FromCents(-251), FromCents(250), FromCents(-500)},

		// Invalid unit <= 0 returns unchanged
		{"0 unit unchanged", FromCents(1234), FromCents(0), FromCents(1234)},
		{"negative unit unchanged", FromCents(1234), FromCents(-250), FromCents(1234)},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got := tt.amount.RoundToNearest(tt.unit)
			if got != tt.expected {
				t.Errorf("(%d).RoundToNearest(%d) = %d, want %d",
					tt.amount.Cents(), tt.unit.Cents(), got.Cents(), tt.expected.Cents())
			}
		})
	}
}

// TestAmount_InstallmentSplit_NoLostCents tests dividing indivisible financial amounts
// across multiple installments (e.g. 3, 7, 11, 13 parts) with zero cent loss.
func TestAmount_InstallmentSplit_NoLostCents(t *testing.T) {
	testCases := []struct {
		name   string
		total  Amount
		parts  int
		unit   Amount // rounding unit (0 for exact cent split)
	}{
		{"1000.00 divided into 3 equal parts", FromCents(100000), 3, 0},
		{"1000.00 divided into 7 equal parts", FromCents(100000), 7, 0},
		{"1000.00 divided into 11 equal parts", FromCents(100000), 11, 0},
		{"1000.00 divided into 13 equal parts", FromCents(100000), 13, 0},
		{"333.33 divided into 3 equal parts", FromCents(33333), 3, 0},
		{"IQD 129,999 divided into 4 parts rounded to 25000 fils", FromCents(129999), 4, FromCents(25000)},
		{"Large 10M cents divided into 6 parts", FromCents(10000000), 6, 0},
	}

	for _, tc := range testCases {
		t.Run(tc.name, func(t *testing.T) {
			schedule := make([]Amount, tc.parts)
			remaining := tc.total

			for i := 0; i < tc.parts; i++ {
				partsLeft := int64(tc.parts - i)
				if partsLeft == 1 {
					// Last installment absorbs the exact remainder
					schedule[i] = remaining
				} else {
					var portion Amount
					if tc.unit > 0 {
						portion = (remaining.Div(partsLeft)).RoundToNearest(tc.unit)
					} else {
						// Integer division for equal distribution
						portion = FromCents(remaining.Cents() / partsLeft)
					}
					schedule[i] = portion
					remaining = remaining.Sub(portion)
				}
			}

			// Sum all installments
			sum := Zero()
			for _, inst := range schedule {
				sum = sum.Add(inst)
			}

			if sum != tc.total {
				t.Fatalf("Installment sum %d cents != total %d cents (lost %d cents)",
					sum.Cents(), tc.total.Cents(), tc.total.Cents()-sum.Cents())
			}

			// Ensure all installments are positive if total is positive
			if tc.total > 0 {
				for i, inst := range schedule {
					if inst <= 0 {
						t.Errorf("installment %d is not positive: %s", i+1, inst)
					}
				}
			}
		})
	}
}

// TestParseAmount_MalformedInputs tests ParseAmount with malformed strings, special floats,
// unicode symbols, and valid strings.
func TestParseAmount_MalformedInputs(t *testing.T) {
	invalidInputs := []struct {
		name  string
		input string
	}{
		{"Alphabetic string", "abc"},
		{"Multiple decimal points", "12.34.56"},
		{"Single hyphen", "-"},
		{"Plus sign only", "+"},
		{"Trailing letters", "12.34abc"},
		{"Currency prefix", "$100"},
		{"Euro symbol prefix", "€50"},
		{"Arabic numeral string", "١٢.٥٠"},
		{"Comma as decimal separator", "12,50"},
		{"Special word inf", "inf"},
		{"Special word -inf", "-inf"},
		{"Special word +inf", "+inf"},
		{"Special word NaN", "NaN"},
		{"Space in between digits", "12 34"},
	}

	for _, tt := range invalidInputs {
		t.Run("Invalid_"+tt.name, func(t *testing.T) {
			_, err := ParseAmount(tt.input)
			if err == nil {
				t.Errorf("ParseAmount(%q) expected error, but got nil", tt.input)
			}
		})
	}

	validInputs := []struct {
		name     string
		input    string
		expected Amount
	}{
		{"Empty string defaults to Zero", "", Zero()},
		{"Exact integer", "42", FromCents(4200)},
		{"Standard decimal", "12.50", FromCents(1250)},
		{"Single decimal place", "12.5", FromCents(1250)},
		{"Padded with whitespace", "   99.95   ", FromCents(9995)},
		{"Negative float", "-15.75", FromCents(-1575)},
		{"Zero decimal", "0.00", Zero()},
		{"Leading decimal point", ".50", FromCents(50)},
		{"Scientific notation 1e3", "1e3", FromCents(100000)},
	}

	for _, tt := range validInputs {
		t.Run("Valid_"+tt.name, func(t *testing.T) {
			got, err := ParseAmount(tt.input)
			if err != nil {
				t.Fatalf("ParseAmount(%q) unexpected error: %v", tt.input, err)
			}
			if got != tt.expected {
				t.Errorf("ParseAmount(%q) = %s (%d cents), want %s (%d cents)",
					tt.input, got, got.Cents(), tt.expected, tt.expected.Cents())
			}
		})
	}
}

// TestAmount_JSONRoundTrip tests JSON serialization and deserialization of structs containing
// Amount fields in various configurations.
func TestAmount_JSONRoundTrip(t *testing.T) {
	type FinancialRecord struct {
		ID          string            `json:"id"`
		Price       Amount            `json:"price"`
		Cost        Amount            `json:"cost"`
		Balance     Amount            `json:"balance"`
		Adjustments []Amount          `json:"adjustments"`
		Metadata    map[string]Amount `json:"metadata,omitempty"`
	}

	record := FinancialRecord{
		ID:      "REC-9988",
		Price:   FromCents(1999),
		Cost:    FromCents(1250),
		Balance: FromCents(-500),
		Adjustments: []Amount{
			FromCents(100),
			FromCents(250),
			FromCents(-50),
			Zero(),
		},
		Metadata: map[string]Amount{
			"fee":      FromCents(150),
			"discount": FromCents(75),
		},
	}

	// Serialize
	data, err := json.Marshal(record)
	if err != nil {
		t.Fatalf("json.Marshal failed: %v", err)
	}

	// Verify formatted JSON output
	var rawMap map[string]interface{}
	if err := json.Unmarshal(data, &rawMap); err != nil {
		t.Fatalf("json.Unmarshal raw map failed: %v", err)
	}

	if rawMap["price"] != 19.99 {
		t.Errorf("JSON price field = %v, want 19.99", rawMap["price"])
	}
	if rawMap["balance"] != -5.00 {
		t.Errorf("JSON balance field = %v, want -5.00", rawMap["balance"])
	}

	// Deserialize back into struct
	var restored FinancialRecord
	if err := json.Unmarshal(data, &restored); err != nil {
		t.Fatalf("json.Unmarshal struct failed: %v", err)
	}

	if restored.ID != record.ID {
		t.Errorf("ID = %q, want %q", restored.ID, record.ID)
	}
	if restored.Price != record.Price {
		t.Errorf("Price = %s, want %s", restored.Price, record.Price)
	}
	if restored.Cost != record.Cost {
		t.Errorf("Cost = %s, want %s", restored.Cost, record.Cost)
	}
	if restored.Balance != record.Balance {
		t.Errorf("Balance = %s, want %s", restored.Balance, record.Balance)
	}
	if len(restored.Adjustments) != len(record.Adjustments) {
		t.Fatalf("Adjustments len = %d, want %d", len(restored.Adjustments), len(record.Adjustments))
	}
	for i := range record.Adjustments {
		if restored.Adjustments[i] != record.Adjustments[i] {
			t.Errorf("Adjustments[%d] = %s, want %s", i, restored.Adjustments[i], record.Adjustments[i])
		}
	}
	if restored.Metadata["fee"] != FromCents(150) || restored.Metadata["discount"] != FromCents(75) {
		t.Errorf("Metadata mismatch: %v", restored.Metadata)
	}
}

// TestAmount_ConcurrentReadWrite runs 100 concurrent goroutines executing simultaneous
// Amount calculations, conversions, and JSON operations to verify thread and race safety.
func TestAmount_ConcurrentReadWrite(t *testing.T) {
	const goroutines = 100
	const iterations = 500

	var wg sync.WaitGroup
	wg.Add(goroutines)

	for i := 0; i < goroutines; i++ {
		go func(routineID int) {
			defer wg.Done()

			base := FromCents(int64(routineID * 100))

			for j := 0; j < iterations; j++ {
				// Arithmetic
				added := base.Add(FromCents(int64(j)))
				subbed := added.Sub(FromCents(int64(j)))
				if subbed != base {
					t.Errorf("routine %d iter %d: subbed %s != base %s", routineID, j, subbed, base)
				}

				// Multiplications & Percentages
				mul := base.Mul(2)
				div := mul.Div(2)
				if div != base {
					t.Errorf("routine %d iter %d: div %s != base %s", routineID, j, div, base)
				}

				pct := base.Percentage(50)
				expectedPct := base.Div(2)
				if pct != expectedPct {
					t.Errorf("routine %d iter %d: pct %s != expected %s", routineID, j, pct, expectedPct)
				}

				// Rounding & Abs
				rounded := base.RoundToNearest(FromCents(250))
				if rounded.Cents()%250 != 0 {
					t.Errorf("routine %d: rounded %d not multiple of 250", routineID, rounded.Cents())
				}

				neg := FromCents(-1000)
				if neg.Abs() != FromCents(1000) || !neg.IsNegative() {
					t.Errorf("routine %d: negative properties failed", routineID)
				}

				// String representation
				str := base.String()
				if len(str) == 0 {
					t.Errorf("routine %d: empty string representation", routineID)
				}

				// JSON Marshal / Unmarshal
				type wrap struct {
					Val Amount `json:"val"`
				}
				data, err := json.Marshal(wrap{Val: base})
				if err != nil {
					t.Errorf("routine %d: marshal failed: %v", routineID, err)
				}
				var out wrap
				if err := json.Unmarshal(data, &out); err != nil {
					t.Errorf("routine %d: unmarshal failed: %v", routineID, err)
				}
				if out.Val != base {
					t.Errorf("routine %d: JSON mismatch got %s, want %s", routineID, out.Val, base)
				}
			}
		}(i)
	}

	wg.Wait()
}
