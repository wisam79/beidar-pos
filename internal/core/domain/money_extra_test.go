package domain

import "testing"

func TestFromCents(t *testing.T) {
	if got := FromCents(12345); got.Cents() != 12345 {
		t.Errorf("FromCents(12345) = %d, want 12345", got.Cents())
	}
	if got := FromCents(0); !got.IsZero() {
		t.Errorf("FromCents(0) should be zero")
	}
}

func TestIsZeroIsNegativeAbs(t *testing.T) {
	if !Zero().IsZero() {
		t.Error("Zero().IsZero() should be true")
	}
	if NewAmount(5).IsZero() {
		t.Error("NewAmount(5).IsZero() should be false")
	}

	if !NewAmount(-5).IsNegative() {
		t.Error("NewAmount(-5).IsNegative() should be true")
	}
	if NewAmount(5).IsNegative() {
		t.Error("NewAmount(5).IsNegative() should be false")
	}

	if got := NewAmount(-5).Abs(); got != NewAmount(5) {
		t.Errorf("Abs = %s, want 5.00", got)
	}
	if got := NewAmount(5).Abs(); got != NewAmount(5) {
		t.Errorf("Abs(positive) = %s, want 5.00", got)
	}
}

func TestAmountDivByZero(t *testing.T) {
	got := NewAmount(10).Div(0)
	if !got.IsZero() {
		t.Errorf("Div(0) = %s, want 0.00", got)
	}
}

func TestAmountRoundToNearest(t *testing.T) {
	if got := NewAmount(1299.99).RoundToNearest(FromCents(25000)); got.Cents() != 125000 {
		t.Errorf("RoundToNearest(25000) = %d, want 125000", got.Cents())
	}

	// unit <= 0 returns the amount unchanged.
	if got := NewAmount(100).RoundToNearest(FromCents(0)); got != NewAmount(100) {
		t.Errorf("RoundToNearest(0) = %s, want 100.00", got)
	}
	if got := NewAmount(100).RoundToNearest(FromCents(-25000)); got != NewAmount(100) {
		t.Errorf("RoundToNearest(negative) = %s, want 100.00", got)
	}

	// Exact multiple is unchanged.
	if got := NewAmount(25).RoundToNearest(FromCents(2500)); got != NewAmount(25) {
		t.Errorf("RoundToNearest exact = %s, want 25.00", got)
	}
}