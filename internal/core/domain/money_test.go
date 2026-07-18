package domain

import (
	"encoding/json"
	"testing"
)

func TestNewAmount(t *testing.T) {
	tests := []struct {
		input    float64
		expected int64
	}{
		{12.50, 1250},
		{0, 0},
		{0.01, 1},
		{1.005, 100}, // rounds to nearest cent
		{-5.99, -599},
		{1000, 100000},
	}
	for _, tt := range tests {
		got := NewAmount(tt.input)
		if got.Cents() != tt.expected {
			t.Errorf("NewAmount(%v) = %d; want %d", tt.input, got.Cents(), tt.expected)
		}
	}
}

func TestAmountArithmetic(t *testing.T) {
	a := NewAmount(10)
	b := NewAmount(3.50)

	if got := a.Add(b); got != NewAmount(13.50) {
		t.Errorf("Add: got %s, want 13.50", got)
	}
	if got := a.Sub(b); got != NewAmount(6.50) {
		t.Errorf("Sub: got %s, want 6.50", got)
	}
	if got := a.Mul(3); got != NewAmount(30) {
		t.Errorf("Mul: got %s, want 30.00", got)
	}
	if got := a.Div(4); got != NewAmount(2.50) {
		t.Errorf("Div: got %s, want 2.50", got)
	}
	if got := a.Percentage(10); got != NewAmount(1) {
		t.Errorf("Percentage: got %s, want 1.00", got)
	}
}

func TestAmountString(t *testing.T) {
	tests := []struct {
		input    float64
		expected string
	}{
		{12.5, "12.50"},
		{0, "0.00"},
		{-5.99, "-5.99"},
		{1000, "1000.00"},
	}
	for _, tt := range tests {
		got := NewAmount(tt.input).String()
		if got != tt.expected {
			t.Errorf("String() = %s; want %s", got, tt.expected)
		}
	}
}

func TestAmountJSON(t *testing.T) {
	type Wrapper struct {
		Value Amount `json:"value"`
	}

	// Serialize — now emits currency units, not cents
	w := Wrapper{Value: NewAmount(12.5)}
	b, err := json.Marshal(w)
	if err != nil {
		t.Fatalf("Marshal failed: %v", err)
	}
	if string(b) != `{"value":12.50}` {
		t.Errorf("Marshal = %s; want {\"value\":12.50}", string(b))
	}

	// Deserialize from float (currency units)
	var w1 Wrapper
	if err := json.Unmarshal([]byte(`{"value":12.50}`), &w1); err != nil {
		t.Fatalf("Unmarshal float failed: %v", err)
	}
	if w1.Value != NewAmount(12.5) {
		t.Errorf("Unmarshal float = %s; want 12.50", w1.Value)
	}

	// Deserialize from bare integer (currency units)
	var w2 Wrapper
	if err := json.Unmarshal([]byte(`{"value":12}`), &w2); err != nil {
		t.Fatalf("Unmarshal integer failed: %v", err)
	}
	if w2.Value != NewAmount(12) {
		t.Errorf("Unmarshal integer = %s; want 12.00", w2.Value)
	}

	// Deserialize from float string
	var w3 Wrapper
	if err := json.Unmarshal([]byte(`{"value":"12.50"}`), &w3); err != nil {
		t.Fatalf("Unmarshal float string failed: %v", err)
	}
	if w3.Value != NewAmount(12.5) {
		t.Errorf("Unmarshal float string = %s; want 12.50", w3.Value)
	}

	// Deserialize zero
	var w4 Wrapper
	if err := json.Unmarshal([]byte(`{"value":0}`), &w4); err != nil {
		t.Fatalf("Unmarshal zero failed: %v", err)
	}
	if w4.Value != Zero() {
		t.Errorf("Unmarshal zero = %s; want 0.00", w4.Value)
	}

	// Deserialize large value
	var w5 Wrapper
	if err := json.Unmarshal([]byte(`{"value":1000000}`), &w5); err != nil {
		t.Fatalf("Unmarshal large failed: %v", err)
	}
	if w5.Value != NewAmount(1000000) {
		t.Errorf("Unmarshal large = %s; want 1000000.00", w5.Value)
	}

	// Negative
	var w6 Wrapper
	if err := json.Unmarshal([]byte(`{"value":-5.99}`), &w6); err != nil {
		t.Fatalf("Unmarshal negative failed: %v", err)
	}
	if w6.Value != NewAmount(-5.99) {
		t.Errorf("Unmarshal negative = %s; want -5.99", w6.Value)
	}
}

func TestParseAmount(t *testing.T) {
	a, err := ParseAmount("  12.50  ")
	if err != nil {
		t.Fatalf("ParseAmount failed: %v", err)
	}
	if a != NewAmount(12.50) {
		t.Errorf("ParseAmount = %s; want 12.50", a)
	}

	_, err = ParseAmount("not_a_number")
	if err == nil {
		t.Error("ParseAmount should fail for invalid input")
	}
}

func TestAmountDivNegative(t *testing.T) {
	tests := []struct {
		val      float64
		div      int64
		expected float64
	}{
		{0.03, 2, 0.02},
		{-0.03, 2, -0.02},
		{0.03, -2, -0.02},
		{-0.03, -2, 0.02},
		{0.05, 3, 0.02},
		{-0.05, 3, -0.02},
	}
	for _, tt := range tests {
		got := NewAmount(tt.val).Div(tt.div)
		want := NewAmount(tt.expected)
		if got != want {
			t.Errorf("NewAmount(%v).Div(%d) = %s; want %s", tt.val, tt.div, got, want)
		}
	}
}
