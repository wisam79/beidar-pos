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

	// Serialize
	w := Wrapper{Value: NewAmount(12.5)}
	b, err := json.Marshal(w)
	if err != nil {
		t.Fatalf("Marshal failed: %v", err)
	}
	if string(b) != `{"value":1250}` {
		t.Errorf("Marshal = %s; want {\"value\":1250}", string(b))
	}

	// Deserialize from number (cents)
	var w1 Wrapper
	if err := json.Unmarshal([]byte(`{"value":1250}`), &w1); err != nil {
		t.Fatalf("Unmarshal number failed: %v", err)
	}
	if w1.Value != NewAmount(12.5) {
		t.Errorf("Unmarshal number = %s; want 12.50", w1.Value)
	}

	// Deserialize from float string (legacy compatibility)
	var w2 Wrapper
	if err := json.Unmarshal([]byte(`{"value":"12.50"}`), &w2); err != nil {
		t.Fatalf("Unmarshal float string failed: %v", err)
	}
	if w2.Value != NewAmount(12.5) {
		t.Errorf("Unmarshal float string = %s; want 12.50", w2.Value)
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
